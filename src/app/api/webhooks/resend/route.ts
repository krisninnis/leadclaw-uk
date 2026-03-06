import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/ops";

type ResendWebhook = {
  type?: string;
  data?: Record<string, unknown>;
  created_at?: string;
};

type ResendTag = {
  name?: string;
  value?: string;
};

type OutreachEventRow = {
  lead_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

type LeadRow = {
  notes: string | null;
};

const NOT_INTERESTED = [
  "not interested",
  "no thanks",
  "remove me",
  "stop",
  "unsubscribe",
];
const INTERESTED = ["interested", "tell me more", "book", "demo", "yes"];

function normalizeEmail(raw: unknown) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^mailto:/, "");
}

function classifyReply(text: string) {
  const lower = text.toLowerCase();
  if (NOT_INTERESTED.some((k) => lower.includes(k))) return "not_interested";
  if (INTERESTED.some((k) => lower.includes(k))) return "interested";
  return "replied";
}

function nextFollowUp(status: string) {
  const now = new Date();
  if (status === "interested") now.setDate(now.getDate() + 2);
  else if (status === "replied") now.setDate(now.getDate() + 5);
  else if (status === "not_interested") now.setDate(now.getDate() + 30);
  return now.toISOString();
}

function parseNotes(raw: string | null) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { note_text: raw };
  }
}

async function findLeadId(
  admin: ReturnType<typeof createAdminClient>,
  payload: Record<string, unknown>,
) {
  if (!admin) return null;

  const rawTags = payload.tags;
  const tags: ResendTag[] = Array.isArray(rawTags)
    ? (rawTags as ResendTag[])
    : [];
  const leadTag = tags.find((t) => t?.name === "lead_id" && t?.value);
  if (leadTag?.value) return leadTag.value;

  const emailId = String(payload.email_id || payload.id || "");
  if (emailId) {
    const { data } = await admin
      .from("outreach_events")
      .select("lead_id,payload,created_at")
      .eq("event_type", "sent")
      .order("created_at", { ascending: false })
      .limit(200);

    const rows = (data || []) as OutreachEventRow[];
    const match = rows.find(
      (row) => String(row.payload?.email_id || "") === emailId,
    );

    if (match?.lead_id) return match.lead_id;
  }

  const to = normalizeEmail(payload.to || payload.email || payload.recipient);
  if (to) {
    const { data } = await admin
      .from("leads")
      .select("id")
      .eq("contact_email", to)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) return data.id as string;
  }

  return null;
}

export async function POST(req: Request) {
  const expected = process.env.RESEND_WEBHOOK_SECRET?.trim();
  const supplied =
    req.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ||
    req.headers.get("x-webhook-secret")?.trim() ||
    "";

  if (expected && supplied !== expected) {
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

  const body = (await req.json().catch(() => ({}))) as ResendWebhook;
  const eventType = String(body.type || "unknown");
  const payload = (body.data || {}) as Record<string, unknown>;

  const leadId = await findLeadId(admin, payload);

  await logSystemEvent({
    level: "info",
    category: "automation",
    message: `Resend webhook received: ${eventType}`,
    meta: { eventType, leadId },
  });

  if (!leadId) {
    return NextResponse.json({ ok: true, matchedLead: false });
  }

  await admin.from("outreach_events").insert({
    lead_id: leadId,
    channel: "email",
    event_type: `resend_${eventType.replace(/[^a-z0-9_.-]/gi, "_")}`,
    payload,
  });

  const replyText = String(
    payload.text || payload.reply_text || payload.body || "",
  );

  if (eventType.includes("reply") || replyText) {
    const status = classifyReply(replyText);

    const { data: lead } = await admin
      .from("leads")
      .select("notes")
      .eq("id", leadId)
      .maybeSingle();

    const typedLead = (lead || null) as LeadRow | null;
    const notes = parseNotes(typedLead?.notes || null) as Record<
      string,
      unknown
    >;

    const merged = {
      ...notes,
      outcome_label:
        status === "interested"
          ? "Interested reply captured"
          : status === "not_interested"
            ? "Not interested reply captured"
            : "Reply captured",
      follow_up_due_at: nextFollowUp(status),
      last_reply_excerpt: replyText ? replyText.slice(0, 500) : null,
      reply_captured_at: new Date().toISOString(),
      updated_via: "resend_webhook",
    };

    await admin
      .from("leads")
      .update({
        status,
        notes: JSON.stringify(merged),
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    await admin.from("outreach_events").insert({
      lead_id: leadId,
      channel: "email",
      event_type: "reply_captured",
      payload: { replyText: replyText.slice(0, 1000), status },
    });
  }

  return NextResponse.json({ ok: true, matchedLead: true, leadId });
}
