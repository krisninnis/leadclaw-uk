import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/ops";
import { isSuppressed, sendEmail } from "@/lib/email";

const BLOCKED_EMAIL_SUBSTRINGS = [
  "example.com",
  "wix.com",
  "wixpress.com",
  "sentry.io",
  "cloudflare.com",
  "godaddy.com",
  "googletagmanager.com",
  "google-analytics.com",
  "doubleclick.net",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "vimeo.com",
  "fontawesome.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "jsdelivr.net",
  "cdnjs.com",
  "unpkg.com",
  "stripe.com",
  "shopify.com",
  "squarespace.com",
  "wordpress.com",
  "mailchimp.com",
  "sendgrid.net",
  "amazonses.com",
  "zendesk.com",
  "intercom.io",
  "drift.com",
  "crisp.chat",
  "tawk.to",
  "latofonts.com",
];

const BLOCKED_PREFIXES = [
  "noreply@",
  "no-reply@",
  "donotreply@",
  "do-not-reply@",
  "mailer-daemon@",
  "postmaster@",
];

const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function inferBusinessContext(company: string) {
  const c = company.toLowerCase();
  if (c.includes("nail")) {
    return { label: "nail salon", pain: "missed booking calls and DMs" };
  }
  if (c.includes("skin") || c.includes("aesthetic") || c.includes("cosmetic")) {
    return {
      label: "aesthetic clinic",
      pain: "missed high-intent treatment enquiries",
    };
  }
  if (c.includes("lash") || c.includes("brow")) {
    return { label: "lash & brow studio", pain: "missed appointment requests" };
  }
  return { label: "beauty clinic", pain: "missed enquiries" };
}

function variantFromId(id: string) {
  const n = Array.from(id || "").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return n % 3;
}

function renderInitialMessage(lead: {
  id: string;
  company_name: string;
  city?: string | null;
  outreach_message?: string | null;
}) {
  if (lead.outreach_message?.trim()) {
    return lead.outreach_message.trim();
  }

  const company = lead.company_name;
  const city = lead.city;
  const ctx = inferBusinessContext(company);
  const v = variantFromId(lead.id);

  if (v === 0) {
    return `Hi ${company} team,

Quick one — I noticed you’re a ${ctx.label}${city ? ` in ${city}` : ""}. We help clinics reduce ${ctx.pain} with a lightweight AI front desk (7-day free trial, no rebuild).

Want me to send a 2-minute setup walkthrough tailored to your current process?

Best,
LeadClaw AI

Reply "no" to opt out.`;
  }

  if (v === 1) {
    return `Hi ${company} team,

Most ${ctx.label}s lose enquiries when the team is busy. We plug in a simple AI responder that captures and qualifies leads automatically${city ? ` across ${city}` : ""}.

Happy to share a quick personalised demo for your business if useful.

Best,
LeadClaw AI

Reply "no" to opt out.`;
  }

  return `Hi ${company} team,

Saw your business and thought this might help: we set up an AI front desk that answers common questions, captures missed leads, and nudges rebookings for clinics like yours${city ? ` in ${city}` : ""}.

If you want, I can send the 2-minute install steps.

Best,
LeadClaw AI

Reply "no" to opt out.`;
}

function renderFollowUp1(lead: { company_name: string }) {
  return `Hi ${lead.company_name} team,

Just checking if you saw my previous message.

A lot of clinics are surprised how many enquiries get missed when staff are busy or after hours.

LeadClaw adds a simple AI front desk to your site so those missed enquiries get captured automatically.

Happy to send a quick example if useful.

Best,
LeadClaw AI

Reply "no" to opt out.`;
}

function renderFollowUp2(lead: { company_name: string }) {
  return `Hi ${lead.company_name} team,

Final quick note from me.

If improving website enquiry capture is something you're looking at this year, I’d be happy to send a short walkthrough.

If not, no worries at all.

Best,
LeadClaw AI

Reply "no" to opt out.`;
}

function renderHtml(text: string, email?: string | null) {
  const htmlBody = text
    .split("\n\n")
    .map((block) => `<p>${block.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.leadclaw.uk";
  const unsub = email
    ? `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`
    : `${appUrl}/api/unsubscribe`;

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      ${htmlBody}
      <p style="font-size:12px;color:#64748b">To opt out, <a href="${unsub}">unsubscribe</a>.</p>
    </div>
  `;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeEmail(raw: unknown) {
  const base = String(raw || "")
    .trim()
    .toLowerCase();
  if (!base) return "";

  const cleaned = base
    .replace(/^mailto:/, "")
    .replace(/\\u003c/g, "")
    .replace(/\\u003e/g, "")
    .replace(/&lt;/g, "")
    .replace(/&gt;/g, "")
    .replace(/\s+/g, "")
    .replace(/[<>"'()[\]{}]/g, "")
    .replace(/[.,;:)>]+$/g, "");

  try {
    return decodeURIComponent(cleaned);
  } catch {
    return cleaned;
  }
}

function isBadEmail(email: string) {
  if (!email) return true;
  if (!EMAIL_REGEX.test(email)) return true;
  if (BLOCKED_PREFIXES.some((p) => email.startsWith(p))) return true;
  if (BLOCKED_EMAIL_SUBSTRINGS.some((d) => email.includes(d))) return true;
  if (email.includes("u003c") || email.includes("u003e")) return true;
  if (
    email.includes(".png") ||
    email.includes(".jpg") ||
    email.includes(".jpeg")
  )
    return true;
  if (
    email.includes(".svg") ||
    email.includes(".webp") ||
    email.includes(".gif")
  )
    return true;
  if (
    email.includes(".css") ||
    email.includes(".js") ||
    email.includes(".woff")
  )
    return true;
  if (email.includes("@2x") || email.includes("@3x")) return true;
  if (
    email.includes("logo") ||
    email.includes("icon") ||
    email.includes("banner")
  )
    return true;
  return false;
}

function daysSince(dateString?: string | null) {
  if (!dateString) return null;
  const then = new Date(dateString);
  if (Number.isNaN(then.getTime())) return null;
  return (Date.now() - then.getTime()) / 86400000;
}

export async function POST(req: Request) {
  const token = process.env.OUTREACH_RUN_TOKEN?.trim();
  const auth = req.headers.get("authorization") || "";

  if (!token || auth !== `Bearer ${token}`) {
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

  const dailyCap = Number(process.env.OUTREACH_DAILY_CAP || 20);
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const { data: sentTodayRows } = await admin
    .from("outreach_events")
    .select("id")
    .eq("channel", "email")
    .eq("event_type", "sent")
    .gte("created_at", dayStart.toISOString())
    .limit(1000);

  const sentToday = (sentTodayRows || []).length;
  const remaining = Math.max(0, dailyCap - sentToday);

  if (remaining === 0) {
    return NextResponse.json({
      ok: true,
      sentCount: 0,
      skippedCount: 0,
      sent: [],
      skipped: [],
      capped: true,
      dailyCap,
      sentToday,
    });
  }

  const { data: leads, error } = await admin
    .from("leads")
    .select(
      "id,company_name,city,contact_email,status,score,outreach_subject,outreach_message,follow_up_stage,last_contacted_at",
    )
    .in("status", ["new", "contacted"])
    .not("contact_email", "is", null)
    .gte("score", 50)
    .order("score", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const sent: Array<{ id: string; email: string; subject: string }> = [];
  const skipped: Array<{ id: string; email: string; reason: string }> = [];
  const seenEmails = new Set<string>();
  let senderNotReady = false;

  for (const lead of leads || []) {
    if (sent.length >= remaining) break;

    const email = normalizeEmail(lead.contact_email);

    if (senderNotReady) {
      skipped.push({ id: lead.id, email, reason: "sender_not_verified" });
      continue;
    }

    if (!email || isBadEmail(email)) {
      skipped.push({ id: lead.id, email, reason: "invalid_email" });

      await admin.from("outreach_events").insert({
        lead_id: lead.id,
        channel: "email",
        event_type: "skipped",
        payload: { reason: "invalid_email", email },
      });

      continue;
    }

    if (seenEmails.has(email)) {
      skipped.push({ id: lead.id, email, reason: "duplicate_email_in_batch" });

      await admin.from("outreach_events").insert({
        lead_id: lead.id,
        channel: "email",
        event_type: "skipped",
        payload: { reason: "duplicate_email_in_batch", email },
      });

      continue;
    }

    seenEmails.add(email);

    if (await isSuppressed(email)) {
      skipped.push({ id: lead.id, email, reason: "suppressed" });

      await admin.from("outreach_events").insert({
        lead_id: lead.id,
        channel: "email",
        event_type: "skipped",
        payload: { reason: "suppressed", email },
      });

      continue;
    }

    const followUpStage = Number(lead.follow_up_stage || 0);
    const elapsedDays = daysSince(lead.last_contacted_at);

    let subject =
      lead.outreach_subject?.trim() || `Quick idea for ${lead.company_name}`;
    let text = "";
    let nextStage = followUpStage;

    if (lead.status === "new" || followUpStage === 0) {
      text = renderInitialMessage(lead);
      nextStage = 1;
    } else if (followUpStage === 1) {
      if (elapsedDays === null || elapsedDays < 3) {
        continue;
      }
      subject = `Quick follow up for ${lead.company_name}`;
      text = renderFollowUp1(lead);
      nextStage = 2;
    } else if (followUpStage === 2) {
      if (elapsedDays === null || elapsedDays < 4) {
        continue;
      }
      subject = `Final quick note for ${lead.company_name}`;
      text = renderFollowUp2(lead);
      nextStage = 3;
    } else {
      continue;
    }

    const html = renderHtml(text, email);

    const result = await sendEmail({
      to: email,
      subject,
      html,
      text,
      tags: [
        { name: "lead_id", value: lead.id },
        { name: "source", value: "outreach" },
        { name: "follow_up_stage", value: String(nextStage) },
      ],
    });

    if (!result.ok) {
      const err = String(result.error || "send_failed");
      skipped.push({ id: lead.id, email, reason: err });

      await admin.from("outreach_events").insert({
        lead_id: lead.id,
        channel: "email",
        event_type: "failed",
        payload: { error: err, email, subject, follow_up_stage: nextStage },
      });

      if (
        err.includes(
          "You can only send testing emails to your own email address",
        )
      ) {
        senderNotReady = true;
      }

      if (err.includes("rate_limit_exceeded")) {
        await sleep(700);
      }

      continue;
    }

    sent.push({ id: lead.id, email, subject });

    await admin.from("outreach_events").insert({
      lead_id: lead.id,
      channel: "email",
      event_type: "sent",
      payload: {
        subject,
        email,
        email_id: result.id || null,
        follow_up_stage: nextStage,
      },
    });

    await admin
      .from("leads")
      .update({
        status: "contacted",
        follow_up_stage: nextStage,
        last_contacted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    await sleep(600);
  }

  await logSystemEvent({
    level: "info",
    category: "outreach",
    message: `Outreach run complete: sent=${sent.length}, skipped=${skipped.length}`,
  });

  return NextResponse.json({
    ok: true,
    sentCount: sent.length,
    skippedCount: skipped.length,
    sent,
    skipped,
    capped: sentToday + sent.length >= dailyCap,
    dailyCap,
    sentToday: sentToday + sent.length,
  });
}
