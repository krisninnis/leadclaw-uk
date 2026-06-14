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
const BLOCKED_EMAIL_QUERY_PATTERNS = [
  "%.png%",
  "%.jpg%",
  "%.jpeg%",
  "%.svg%",
  "%.webp%",
  "%.gif%",
  "%.css%",
  "%.js%",
  "%.woff%",
  "%@2x%",
  "%@3x%",
  "%logo%",
  "%icon%",
  "%banner%",
];

const PRODUCTION_APP_URL = "https://www.leadclaw.uk";
const STALE_OUTREACH_COPY_PATTERNS = [
  "website assistant",
  "leadclaw-uk.vercel.app",
  "worth a quick look",
  "founding-client perks",
  "visitors drop off",
  "simple website assistant",
];

type OutreachLeadRow = {
  id: string;
  company_name: string;
  city: string | null;
  niche: string | null;
  created_at: string | null;
  contact_email: string | null;
  status: string;
  score: number | null;
  lead_quality_score: number | null;
  pecr_classification: string | null;
  company_number: string | null;
  outreach_subject: string | null;
  outreach_message: string | null;
  follow_up_stage: number | null;
  last_contacted_at: string | null;
};

type OutreachRunBody = {
  niches?: unknown;
  created_after?: unknown;
  createdAfter?: unknown;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeNiche(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");
}

function nicheContext(niche?: string | null) {
  const normalized = normalizeNiche(niche);

  if (["plumber", "plumbers", "plumbing"].includes(normalized)) {
    return "For plumbing teams, LeadClaw helps capture missed calls while you are on jobs, after-hours enquiries, emergency callout requests, and booking or callback details before the customer tries someone else.";
  }

  if (["heating", "heating_engineer", "heating_engineers"].includes(normalized)) {
    return "For heating engineers, LeadClaw helps capture boiler breakdown enquiries, emergency heating requests, out-of-hours calls, and callback details when the team is already out helping customers.";
  }

  if (["electrician", "electricians", "electrical"].includes(normalized)) {
    return "For electricians, LeadClaw helps turn website visitors, quote requests, missed calls, and callback requests into clear details your team can follow up.";
  }

  if (
    [
      "beauty",
      "aesthetic",
      "aesthetics",
      "aesthetic_clinic",
      "aesthetic_clinics",
      "beauty_clinic",
      "beauty_clinics",
    ].includes(normalized)
  ) {
    return "For beauty and aesthetic clinics, LeadClaw helps capture consultation or booking enquiries, out-of-hours interest, missed calls, and callback details without making treatment decisions.";
  }

  return "For UK service businesses, LeadClaw helps capture missed calls, quote requests, out-of-hours enquiries, and booking or callback details when the team is busy.";
}

function demoUrlForLead(id: string) {
  return `${PRODUCTION_APP_URL}/demo?source=outreach&lead=${encodeURIComponent(id)}`;
}

function hasStaleOutreachCopy(value?: string | null) {
  const lower = String(value || "").toLowerCase();
  return STALE_OUTREACH_COPY_PATTERNS.some((pattern) =>
    lower.includes(pattern),
  );
}

function hasCurrentOutreachPositioning(value?: string | null) {
  return String(value || "").toLowerCase().includes("ai receptionist");
}

function canUseStoredInitialMessage(value?: string | null) {
  return hasCurrentOutreachPositioning(value) && !hasStaleOutreachCopy(value);
}

function buildInitialSubject(lead: { company_name: string }) {
  return `AI receptionist idea for ${lead.company_name}`;
}

function variantFromId(id: string) {
  const n = Array.from(id || "").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return n % 3;
}

function renderInitialMessage(lead: {
  id: string;
  company_name: string;
  city?: string | null;
  niche?: string | null;
  contact_email?: string | null;
  outreach_message?: string | null;
}) {
  const storedMessage = lead.outreach_message?.trim();

  if (storedMessage && canUseStoredInitialMessage(storedMessage)) {
    return storedMessage;
  }

  const company = lead.company_name;
  const city = lead.city;
  const context = nicheContext(lead.niche);
  const demoUrl = demoUrlForLead(lead.id);
  const unsubUrl = unsubscribeUrl(lead.contact_email);
  const v = variantFromId(lead.id);

  if (v === 0) {
    return `Hi ${company} team,

I came across your business${city ? ` in ${city}` : ""} and wanted to reach out.

I'm building LeadClaw, an AI receptionist for UK service businesses. It helps capture missed calls, quote requests, out-of-hours enquiries, and booking or callback details when the team is busy.

${context}

I put together a quick demo for your business here:
${demoUrl}

If it looks useful, you can start with a no-obligation free trial and see whether it helps ${company} respond faster.

Would it be worth a look?

Best,
Kris
LeadClaw

---
Lead Claw Ltd (Company No. 13546017)
206 Whitechapel Road, London, E1 1AA
We found your business on Google Maps.
Privacy policy: ${PRODUCTION_APP_URL}/legal/privacy
Data rights: privacy@leadclaw.uk
Unsubscribe: ${unsubUrl}`;
  }

  if (v === 1) {
    return `Hi ${company} team,

Just a quick note after finding ${company}${city ? ` in ${city}` : ""}.

LeadClaw is an AI receptionist for UK service businesses. It gives people a simple way to leave details when nobody can answer, then helps the team follow up on missed calls, quote requests, out-of-hours enquiries, bookings, and callbacks.

${context}

Here is a quick demo link:
${demoUrl}

If this could help reduce missed enquiries for ${company}, the free trial is there to test it without a long setup.

Would it be useful to take a look?

Best,
Kris
LeadClaw

---
Lead Claw Ltd (Company No. 13546017)
206 Whitechapel Road, London, E1 1AA
We found your business on Google Maps.
Privacy policy: ${PRODUCTION_APP_URL}/legal/privacy
Data rights: privacy@leadclaw.uk
Unsubscribe: ${unsubUrl}`;
  }

  return `Hi ${company} team,

Saw your business and thought I'd reach out.

LeadClaw is an AI receptionist for UK service businesses. It helps capture missed calls, quote requests, out-of-hours enquiries, and booking or callback details, then keeps follow-up easier for the team.

${context}

I put together a quick demo for ${company} here:
${demoUrl}

If it fits, you can try LeadClaw without a long setup and see whether it helps your team respond faster.

Worth a look?

Best,
Kris
LeadClaw

---
Lead Claw Ltd (Company No. 13546017)
206 Whitechapel Road, London, E1 1AA
We found your business on Google Maps.
Privacy policy: ${PRODUCTION_APP_URL}/legal/privacy
Data rights: privacy@leadclaw.uk
Unsubscribe: ${unsubUrl}`;
}

function renderFollowUp1(lead: { company_name: string }) {
  return `Hi ${lead.company_name} team,

Just checking if you saw my last note.

LeadClaw is an AI receptionist for UK service businesses. It helps capture missed calls, quote requests, out-of-hours enquiries, and booking or callback details when the team is busy.

If useful, I can send over the quick demo again for ${lead.company_name}.

Best,
Kris
LeadClaw

Reply "no" to opt out.`;
}

function renderFollowUp2(lead: { company_name: string }) {
  return `Hi ${lead.company_name} team,

Final quick note from me.

If missed calls, quote requests, out-of-hours enquiries, or callback capture are on your radar, LeadClaw is an AI receptionist built to make those first details easier to collect.

If not, no worries at all.

Best,
Kris
LeadClaw

Reply "no" to opt out.`;
}

function unsubscribeUrl(email?: string | null) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.leadclaw.uk";
  return email
    ? `${appUrl}/api/unsubscribe?email=${encodeURIComponent(email)}`
    : `${appUrl}/api/unsubscribe`;
}

function appendTextUnsubscribe(text: string, email?: string | null) {
  const lower = text.toLowerCase();
  if (lower.includes("/api/unsubscribe") || lower.includes("unsubscribe:")) {
    return text;
  }

  return `${text}\n\nUnsubscribe: ${unsubscribeUrl(email)}`;
}

function renderHtml(text: string, email?: string | null) {
  const htmlBody = text
    .split("\n\n")
    .map((block) => `<p>${block.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const unsub = unsubscribeUrl(email);

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

function boundedInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(Math.floor(parsed), max));
}

function parseStringArray(raw: unknown) {
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const values: string[] = [];

  for (const item of raw) {
    const value = String(item || "").trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    values.push(value);
  }

  return values;
}

function parseIsoDate(raw: unknown) {
  const value = String(raw || "").trim();
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function applyEmailSelectionGuards(query: SupabaseUntypedQueryBuilder) {
  return BLOCKED_EMAIL_QUERY_PATTERNS.reduce(
    (currentQuery, pattern) =>
      currentQuery.not("contact_email", "ilike", pattern),
    query,
  );
}

export async function POST(req: Request) {
  const startedAt = Date.now();

  const token = process.env.OUTREACH_RUN_TOKEN?.trim();
  const auth = req.headers.get("authorization") || "";

  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as OutreachRunBody;
  const scopedNiches = parseStringArray(body.niches);
  const scopedCreatedAfter = parseIsoDate(body.created_after ?? body.createdAfter);

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 400 },
    );
  }

  const dailyCap = boundedInt(process.env.OUTREACH_DAILY_CAP, 5, 0, 5);
  const minLeadQualityScore = boundedInt(
    process.env.OUTREACH_MIN_LEAD_QUALITY_SCORE,
    90,
    0,
    100,
  );
  const batchSize = boundedInt(process.env.OUTREACH_BATCH_SIZE, 5, 1, 5);
  const perEmailDelayMs = boundedInt(
    process.env.OUTREACH_PER_EMAIL_DELAY_MS,
    50,
    0,
    250,
  );

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);

  const { data: sentTodayRows } = await (admin as unknown as SupabaseUntypedClient)
    .from("outreach_events")
    .select("id")
    .eq("channel", "email")
    .eq("event_type", "sent")
    .gte("created_at", dayStart.toISOString())
    .limit(100);

  const sentToday = ((sentTodayRows || []) as Array<{ id: string }>).length;
  const remainingDaily = Math.max(0, dailyCap - sentToday);
  const remainingThisRun = Math.min(remainingDaily, batchSize);

  console.log("[outreach.run] starting", {
    dailyCap,
    sentToday,
    remainingDaily,
    batchSize,
    remainingThisRun,
    minLeadQualityScore,
    scopedNiches,
    scopedCreatedAfter,
  });

  if (remainingThisRun === 0) {
    return NextResponse.json({
      ok: true,
      sentCount: 0,
      skippedCount: 0,
      sent: [],
      skipped: [],
      capped: true,
      dailyCap,
      sentToday,
      batchSize,
      minLeadQualityScore,
      scopedNiches,
      scopedCreatedAfter,
    });
  }

  let leadQuery = (admin as unknown as SupabaseUntypedClient)
    .from("leads")
    .select(
      "id,company_name,city,niche,created_at,contact_email,status,score,lead_quality_score,pecr_classification,company_number,outreach_subject,outreach_message,follow_up_stage,last_contacted_at",
    )
    .eq("status", "queued")
    .eq("pecr_classification", "corporate")
    .not("contact_email", "is", null)
    .not("outreach_subject", "is", null)
    .not("outreach_message", "is", null)
    .gte("lead_quality_score", minLeadQualityScore);

  leadQuery = applyEmailSelectionGuards(leadQuery);

  if (scopedNiches.length > 0) {
    leadQuery = leadQuery.in("niche", scopedNiches);
  }

  if (scopedCreatedAfter) {
    leadQuery = leadQuery.gte("created_at", scopedCreatedAfter);
  }

  const { data: leads, error } = await leadQuery
    .order("lead_quality_score", { ascending: false })
    .limit(remainingThisRun * 4);

  if (error) {
    console.error("[outreach.run] lead query failed", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const sent: Array<{ id: string; email: string; subject: string }> = [];
  const skipped: Array<{ id: string; email: string; reason: string }> = [];
  const seenEmails = new Set<string>();
  let senderNotReady = false;

  for (const lead of (leads || []) as OutreachLeadRow[]) {
    if (sent.length >= remainingThisRun) break;

    const totalElapsed = Date.now() - startedAt;
    if (totalElapsed > 45000) {
      console.warn("[outreach.run] stopping early to avoid timeout", {
        totalElapsed,
        sent: sent.length,
        skipped: skipped.length,
      });
      break;
    }

    const leadStartedAt = Date.now();
    const email = normalizeEmail(lead.contact_email);
    const leadQualityScore = Number(lead.lead_quality_score);
    const hasReviewedMessage = Boolean(
      lead.outreach_subject?.trim() && lead.outreach_message?.trim(),
    );

    if (senderNotReady) {
      skipped.push({ id: lead.id, email, reason: "sender_not_verified" });
      continue;
    }

    if (
      lead.status !== "queued" ||
      lead.pecr_classification !== "corporate" ||
      !Number.isFinite(leadQualityScore) ||
      leadQualityScore < minLeadQualityScore ||
      lead.last_contacted_at ||
      Number(lead.follow_up_stage || 0) > 0 ||
      !hasReviewedMessage
    ) {
      skipped.push({ id: lead.id, email, reason: "unsafe_lead_state" });

      await (admin as unknown as SupabaseUntypedClient).from("outreach_events").insert({
        lead_id: lead.id,
        channel: "email",
        event_type: "skipped",
        payload: { reason: "unsafe_lead_state" },
      });

      continue;
    }

    if (!email || isBadEmail(email)) {
      skipped.push({ id: lead.id, email, reason: "invalid_email" });

      await (admin as unknown as SupabaseUntypedClient).from("outreach_events").insert({
        lead_id: lead.id,
        channel: "email",
        event_type: "skipped",
        payload: { reason: "invalid_email", email },
      });

      continue;
    }

    if (seenEmails.has(email)) {
      skipped.push({ id: lead.id, email, reason: "duplicate_email_in_batch" });

      await (admin as unknown as SupabaseUntypedClient).from("outreach_events").insert({
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

      await (admin as unknown as SupabaseUntypedClient).from("outreach_events").insert({
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

    if (followUpStage === 0) {
      if (
        !canUseStoredInitialMessage(lead.outreach_message) ||
        hasStaleOutreachCopy(subject)
      ) {
        subject = buildInitialSubject(lead);
      }

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

    const deliverableText = appendTextUnsubscribe(text, email);
    const html = renderHtml(deliverableText, email);

    const result = await sendEmail({
      to: email,
      subject,
      html,
      text: deliverableText,
      tags: [
        { name: "lead_id", value: lead.id },
        { name: "source", value: "outreach" },
        { name: "follow_up_stage", value: String(nextStage) },
      ],
    });

    if (!result.ok) {
      const err = String(result.error || "send_failed");

      skipped.push({ id: lead.id, email, reason: err });

      await (admin as unknown as SupabaseUntypedClient).from("outreach_events").insert({
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

      if (perEmailDelayMs > 0) {
        await sleep(perEmailDelayMs);
      }

      console.warn("[outreach.run] send failed", {
        leadId: lead.id,
        email,
        err,
        leadMs: Date.now() - leadStartedAt,
        totalMs: Date.now() - startedAt,
      });

      continue;
    }

    const sentAt = new Date().toISOString();

    sent.push({ id: lead.id, email, subject });

    await (admin as unknown as SupabaseUntypedClient).from("outreach_events").insert({
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

    const { error: outreachLogError } = await (
      admin as unknown as SupabaseUntypedClient
    )
      .from("outreach_log")
      .insert({
        email,
        business_name: lead.company_name,
        subject,
        sent_at: sentAt,
        email_number: nextStage,
        status: "sent",
        classification: lead.pecr_classification,
        company_number: lead.company_number || null,
        google_place_id: null,
      });

    if (outreachLogError) {
      console.error("[outreach.run] outreach_log insert failed", {
        leadId: lead.id,
        email,
        error: outreachLogError.message,
      });
    }

    await (admin as unknown as SupabaseUntypedClient)
      .from("leads")
      .update({
        status: "contacted",
        follow_up_stage: nextStage,
        last_contacted_at: sentAt,
        outreach_subject: subject,
        outreach_message: deliverableText,
        updated_at: sentAt,
      })
      .eq("id", lead.id)
      .eq("status", "queued")
      .eq("pecr_classification", "corporate")
      .gte("lead_quality_score", minLeadQualityScore);

    if (perEmailDelayMs > 0) {
      await sleep(perEmailDelayMs);
    }

    console.log("[outreach.run] sent", {
      leadId: lead.id,
      email,
      subject,
      leadMs: Date.now() - leadStartedAt,
      totalMs: Date.now() - startedAt,
    });
  }

  await logSystemEvent({
    level: "info",
    category: "outreach",
    message: `Outreach run complete: sent=${sent.length}, skipped=${skipped.length}`,
  });

  console.log("[outreach.run] complete", {
    sent: sent.length,
    skipped: skipped.length,
    totalMs: Date.now() - startedAt,
    batchSize,
    dailyCap,
    minLeadQualityScore,
    scopedNiches,
    scopedCreatedAfter,
    sentTodayBeforeRun: sentToday,
    sentTodayAfterRun: sentToday + sent.length,
  });

  return NextResponse.json({
    ok: true,
    sentCount: sent.length,
    skippedCount: skipped.length,
    sent,
    skipped,
    capped: sentToday + sent.length >= dailyCap,
    dailyCap,
    minLeadQualityScore,
    scopedNiches,
    scopedCreatedAfter,
    sentToday: sentToday + sent.length,
    batchSize,
    totalMs: Date.now() - startedAt,
  });
}
