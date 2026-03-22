import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/ops";
import { isSuppressed, sendEmail } from "@/lib/email";
import {
  renderRetentionMessage,
  type RetentionBehavior,
} from "@/lib/retention";
import { hasFullLeadClawAccess } from "@/lib/subscription-access";

export async function POST(req: Request) {
  const token = process.env.RETENTION_RUN_TOKEN?.trim();
  const auth = req.headers.get("authorization") || "";
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  const isVercelCron = ua.includes("vercel-cron");

  if (!isVercelCron && (!token || auth !== `Bearer ${token}`)) {
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

  const now = new Date().toISOString();

  const { data: rows, error } = await admin
    .from("retention_tasks")
    .select(
      "id,behavior,retention_client_id,retention_clients(id,client_name,email,phone,service,clinic_name,objection)",
    )
    .eq("status", "queued")
    .lte("due_at", now)
    .order("due_at", { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const sent: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const row of rows || []) {
    const client = Array.isArray(row.retention_clients)
      ? row.retention_clients[0]
      : row.retention_clients;

    if (!client) {
      await admin
        .from("retention_tasks")
        .update({ status: "failed", error: "client_not_found" })
        .eq("id", row.id);

      skipped.push({ id: row.id, reason: "client_not_found" });
      continue;
    }

    const behavior = row.behavior as RetentionBehavior;

    // Re-check subscription access before sending.
    // Paid retention should only send for full-access subscriptions.
    let clinicHasFullAccess = false;

    if (client.clinic_name) {
      const { data: onboardingClient } = await admin
        .from("onboarding_clients")
        .select("contact_email,business_name,client_name")
        .or(
          `business_name.eq.${client.clinic_name},client_name.eq.${client.clinic_name}`,
        )
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const clinicEmail =
        String(onboardingClient?.contact_email || "")
          .trim()
          .toLowerCase() || null;

      if (clinicEmail) {
        const { data: subscription } = await admin
          .from("subscriptions")
          .select("status,plan")
          .eq("email", clinicEmail)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        clinicHasFullAccess = hasFullLeadClawAccess(subscription?.status);
      }
    }

    if (!clinicHasFullAccess) {
      skipped.push({
        id: row.id,
        reason: "subscription_no_longer_full_access",
      });

      await admin
        .from("retention_tasks")
        .update({
          status: "skipped",
          error: "subscription_no_longer_full_access",
        })
        .eq("id", row.id);

      continue;
    }

    // idempotency / anti-spam guard
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recent } = await admin
      .from("retention_events")
      .select("id")
      .eq("retention_client_id", row.retention_client_id)
      .eq("behavior", behavior)
      .eq("status", "sent")
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();

    if (recent?.id) {
      skipped.push({ id: row.id, reason: "duplicate_recent_send" });

      await admin
        .from("retention_tasks")
        .update({ status: "skipped", error: "duplicate_recent_send" })
        .eq("id", row.id);

      continue;
    }

    const rendered = renderRetentionMessage(behavior, {
      clientName: client.client_name,
      service: client.service,
      clinicName: client.clinic_name,
      objection: client.objection,
    });

    let delivered = false;
    let finalReason: string | null = null;

    if (client.email) {
      if (await isSuppressed(client.email)) {
        finalReason = "suppressed";
        skipped.push({ id: row.id, reason: finalReason });
      } else {
        const result = await sendEmail({
          to: client.email,
          subject: rendered.subject,
          text: rendered.text,
          html: `<p>${rendered.text.replace(/\n/g, "<br/>")}</p>`,
        });

        if (result.ok) {
          delivered = true;
        } else {
          finalReason = String(result.error || "send_failed");
          skipped.push({ id: row.id, reason: finalReason });
        }
      }
    } else {
      finalReason = "email_missing";
      skipped.push({ id: row.id, reason: finalReason });
    }

    await admin.from("retention_events").insert({
      retention_task_id: row.id,
      retention_client_id: row.retention_client_id,
      behavior,
      channel: client.email ? "email" : "manual",
      status: delivered ? "sent" : "skipped",
      payload: { subject: rendered.subject, text: rendered.text },
    });

    await admin
      .from("retention_tasks")
      .update({
        status: delivered ? "sent" : "skipped",
        sent_at: delivered ? new Date().toISOString() : null,
        error: delivered ? null : finalReason || "unknown",
      })
      .eq("id", row.id);

    if (delivered) {
      sent.push(row.id);
    }
  }

  await logSystemEvent({
    level: "info",
    category: "retention",
    message: `Retention run complete: sent=${sent.length} skipped=${skipped.length}`,
    meta: { sent, skipped },
  });

  return NextResponse.json({
    ok: true,
    sentCount: sent.length,
    skippedCount: skipped.length,
    sent,
    skipped,
  });
}
