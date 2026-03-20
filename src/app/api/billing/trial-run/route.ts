import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, isSuppressed } from "@/lib/email";
import { logSystemEvent } from "@/lib/ops";
import {
  detectTrialStage,
  renderTrialEmail,
  type TrialStage,
} from "@/lib/trial-automation";

type SubscriptionRow = {
  id: string;
  email: string | null;
  status: string | null;
  trial_end: string | null;
  plan: string | null;
};

function isExpiredTrial(status: string | null | undefined, stage: TrialStage) {
  return (
    stage === "expired" && String(status || "").toLowerCase() === "trialing"
  );
}

export async function POST(req: Request) {
  const tokens = [
    process.env.BILLING_RUN_TOKEN?.trim(),
    process.env.ONBOARDING_RUN_TOKEN?.trim(),
  ].filter(Boolean) as string[];

  const auth = req.headers.get("authorization") || "";
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  const isVercelCron = ua.includes("vercel-cron");
  const bearerOk = tokens.some((t) => auth === `Bearer ${t}`);

  if (!isVercelCron && !bearerOk) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }

  const { data: subs, error } = await admin
    .from("subscriptions")
    .select("id,email,status,trial_end,plan")
    .in("status", ["trialing", "active", "past_due", "expired", "canceled"])
    .not("trial_end", "is", null)
    .limit(500);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://leadclaw.uk";
  const checkoutUrl = `${appUrl}/pricing`;

  let sentCount = 0;
  let skippedCount = 0;
  let expiredCount = 0;
  let downgradedToBasicCount = 0;
  let failedCount = 0;

  for (const sub of (subs || []) as SubscriptionRow[]) {
    const stage = detectTrialStage(sub.trial_end);
    if (!stage) continue;

    const normalizedEmail = (sub.email || "").trim().toLowerCase();
    if (!normalizedEmail) continue;

    if (isExpiredTrial(sub.status, stage)) {
      const { error: expireError } = await admin
        .from("subscriptions")
        .update({
          status: "expired",
          plan: "basic",
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);

      if (!expireError) {
        expiredCount += 1;
        downgradedToBasicCount += 1;

        await logSystemEvent({
          level: "info",
          category: "billing_trial",
          message: `Trial expired and downgraded to basic for ${normalizedEmail}`,
          meta: {
            subscriptionId: sub.id,
            email: normalizedEmail,
            previousPlan: sub.plan || null,
            newPlan: "basic",
            newStatus: "expired",
            trialEnd: sub.trial_end,
          },
        });
      } else {
        failedCount += 1;

        await logSystemEvent({
          level: "error",
          category: "billing_trial",
          message: `Failed to expire trial for ${normalizedEmail}`,
          meta: {
            subscriptionId: sub.id,
            email: normalizedEmail,
            error: expireError.message,
            trialEnd: sub.trial_end,
          },
        });

        continue;
      }
    }

    const { data: seen } = await admin
      .from("billing_notifications")
      .select("id")
      .eq("subscription_id", sub.id)
      .eq("stage", stage)
      .limit(1)
      .maybeSingle();

    if (seen?.id) {
      skippedCount += 1;
      continue;
    }

    if (await isSuppressed(normalizedEmail)) {
      await admin.from("billing_notifications").insert({
        subscription_id: sub.id,
        email: normalizedEmail,
        stage,
        status: "suppressed",
      });
      skippedCount += 1;
      continue;
    }

    const rendered = renderTrialEmail({
      stage: stage as TrialStage,
      checkoutUrl,
    });

    const result = await sendEmail({
      to: normalizedEmail,
      subject: rendered.subject,
      text: rendered.text,
      html: `<p>${rendered.text.replace(/\n/g, "<br/>")}</p>`,
    });

    await admin.from("billing_notifications").insert({
      subscription_id: sub.id,
      email: normalizedEmail,
      stage,
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : String(result.error || "send_failed"),
    });

    if (result.ok) {
      sentCount += 1;
    } else {
      skippedCount += 1;
      failedCount += 1;
    }
  }

  await logSystemEvent({
    level: "info",
    category: "billing_trial",
    message: `Trial run complete sent=${sentCount} skipped=${skippedCount} expired=${expiredCount} downgraded=${downgradedToBasicCount} failed=${failedCount}`,
    meta: {
      sentCount,
      skippedCount,
      expiredCount,
      downgradedToBasicCount,
      failedCount,
    },
  });

  return NextResponse.json({
    ok: true,
    sentCount,
    skippedCount,
    expiredCount,
    downgradedToBasicCount,
    failedCount,
  });
}
