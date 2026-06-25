// Communication event log — write-side helpers with privacy redaction.
//
// Privacy rules (Phase 1):
//   * never persist full SMS / email body — store a short preview only;
//   * collapse whitespace and strip obvious PII-ish tokens from the preview;
//   * store enough to debug delivery (channel, provider, status, ids, error).
//
// The pure helpers (buildBodyPreview / buildEventRow) are exported so tests can
// assert redaction without a database. recordCommunicationEvent performs the
// best-effort insert and NEVER throws — logging must not break a send.

import { createAdminClient } from "@/lib/supabase/admin";
import type { CommunicationEvent } from "./types";

/** Max characters kept from a body in the event log. */
export const BODY_PREVIEW_MAX = 140;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Loose international phone matcher (7+ digits, optional +, spaces, dashes).
const PHONE_RE = /\+?\d[\d\s().-]{6,}\d/g;

/**
 * Produce a safe, truncated preview of a message body. Emails and phone
 * numbers embedded in the body are masked, whitespace is collapsed, and the
 * result is capped at BODY_PREVIEW_MAX with an ellipsis. Returns null for
 * empty input so the column stays NULL rather than an empty string.
 */
export function buildBodyPreview(
  body: string | null | undefined,
): string | null {
  if (!body) return null;

  const masked = String(body)
    .replace(EMAIL_RE, "[email]")
    .replace(PHONE_RE, "[phone]")
    .replace(/\s+/g, " ")
    .trim();

  if (!masked) return null;

  if (masked.length <= BODY_PREVIEW_MAX) return masked;
  return `${masked.slice(0, BODY_PREVIEW_MAX - 1).trimEnd()}…`;
}

/** Mask all but the domain of an email address for from/to columns. */
export function maskEmailAddress(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return trimmed;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at);
  const head = local.slice(0, 2);
  return `${head}${local.length > 2 ? "***" : ""}${domain}`;
}

/** Keep only the last 4 digits of a phone number for from/to columns. */
export function maskPhoneAddress(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return `***${digits.slice(-4)}`;
}

/** Shape a CommunicationEvent into the DB row (snake_case) with redaction applied. */
export function buildEventRow(event: CommunicationEvent): Record<string, unknown> {
  const isPhoneChannel =
    event.channel === "sms" ||
    event.channel === "whatsapp" ||
    event.channel === "voice" ||
    event.channel === "voicemail";

  const maskAddr = (v: string | null | undefined) =>
    isPhoneChannel ? maskPhoneAddress(v) : maskEmailAddress(v);

  return {
    clinic_id: event.clinicId ?? null,
    workspace_id: event.workspaceId ?? null,
    lead_id: event.leadId ?? null,
    enquiry_id: event.enquiryId ?? null,
    channel: event.channel,
    direction: event.direction,
    provider: event.provider,
    status: event.status,
    from_address: maskAddr(event.fromAddress),
    to_address: maskAddr(event.toAddress),
    subject: event.subject ?? null,
    body_preview: buildBodyPreview(event.bodyPreview),
    provider_message_id: event.providerMessageId ?? null,
    error_message: event.errorMessage ?? null,
    metadata: event.metadata ?? {},
  };
}

/**
 * Best-effort insert into communication_events. Returns the new row id, or null
 * when Supabase is not configured / the insert fails. NEVER throws.
 */
export async function recordCommunicationEvent(
  event: CommunicationEvent,
): Promise<string | null> {
  const admin = createAdminClient({ optional: true });
  if (!admin) {
    // No service role available (local/dev/test) — skip silently.
    return null;
  }

  try {
    const row = buildEventRow(event);
    const { data, error } = await (admin as unknown as SupabaseUntypedClient)
      .from("communication_events")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error("[communications] event insert failed", error.message);
      return null;
    }

    return (data as { id?: string } | null)?.id ?? null;
  } catch (error) {
    console.error(
      "[communications] event insert threw",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}
