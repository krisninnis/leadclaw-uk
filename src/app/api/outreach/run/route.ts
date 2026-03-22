import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/ops";
import { isSuppressed, sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

I came across your clinic${city ? ` in ${city}` : ""} and wanted to reach out.

I'm building LeadClaw, a brand-new startup for clinics that helps capture website enquiries when staff are busy or out of hours.

It's free to get started, with an optional paid subscription later, and there's also a no-obligation free trial.

Because we're still early, we're improving the product constantly and listening closely to feedback from clinics.

The first 100 clients will also get founding-client perks like priority support, early feature access, and future benefits that won't be offered once we grow.

Would you like me to send over a very short example of how it could work for ${company}?

Best,
Kris
LeadClaw

Reply "no" to opt out.`;
  }

  if (v === 1) {
    return `Hi ${company} team,

Just a quick note — we help ${ctx.label}s${city ? ` in ${city}` : ""} respond faster when calls, forms, or messages come in at busy times.

LeadClaw is a brand-new startup, free to get started, with an optional paid subscription later and a no-obligation free trial.

We're updating the product constantly, and early clinics get a real chance to shape what we build with direct feedback.

The first 100 clients will also get founding-client perks like priority support, early feature access, and future benefits that won't be available later.

Would it help if I sent over a very short example for ${company}?

Best,
Kris
LeadClaw

Reply "no" to opt out.`;
  }

  return `Hi ${company} team,

Saw your business and thought I'd reach out.

I'm building LeadClaw, a brand-new startup for clinics that helps avoid losing website enquiries when staff are tied up or it's out of hours.

It's free to get started, with an optional paid subscription later, and there's a no-obligation free trial as well.

We're still early, so the product is always improving, and early users get a genuine chance to shape it with feedback.

The first 100 clients will also get founding-client perks like priority support, early feature access, and future benefits we won't offer once LeadClaw grows.

Want me to send a short example tailored to ${company}?

Best,
Kris
LeadClaw

Reply "no" to opt out.`;
}

function renderFollowUp1(lead: { company_name: string }) {
  return `Hi ${lead.company_name} team,

Just checking if you saw my last note.

LeadClaw is a brand-new startup for clinics, free to get started, with an optional paid subscription later and a no-obligation free trial.

We're improving it constantly, and early clinics get a real chance to shape the product with feedback.

The first 100 clients will also get founding-client perks like priority support, early feature access, and future benefits that won't be offered later.

If you'd like, I can send over a very short example of how it could work for ${lead.company_name}.

Best,
Kris
LeadClaw

Reply "no" to opt out.`;
}

function renderFollowUp2(lead: { company_name: string }) {
  return `Hi ${lead.company_name} team,

Final quick note from me.

If improving enquiry response times is on your radar, I'd be happy to send a short example tailored to your clinic.

LeadClaw is a new startup, free to get started, with an optional paid subscription later and a no-obligation free trial.

We're still early, so the product is always improving, and the first 100 clients will receive founding-client perks like priority support, early feature access, and future benefits that won't be available later.

If not, no worries at all.

Best,
Kris
LeadClaw

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
  ) {
    return true;
  }

  if (
    email.includes(".svg") ||
    email.includes(".webp") ||
    email.includes(".gif")
  ) {
    return true;
  }

  if (
    email.includes(".css") ||
    email.includes(".js") ||
    email.includes(".woff")
  ) {
    return true;
  }

  if (email.includes("@2x") || email.includes("@3x")) return true;

  if (
    email.includes("logo") ||
    email.includes("icon") ||
    email.includes("banner")
  ) {
    return true;
  }

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

  console.log("[outreach.run] auth debug", {
    tokenPresent: Boolean(token),
    tokenLength: token?.length || 0,
    authStartsWithBearer: auth.startsWith("Bearer "),
    authLength: auth.length,
  });

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
      lead.outreach_subject?.trim() ||
      `Quick question for ${lead.company_name}`;
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
        ) ||
        err.includes("sender_not_verified")
      ) {
        senderNotReady = true;
      }

      await sleep(600);
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
