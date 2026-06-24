// Internal orchestration for missed-call recovery.
//
// These helpers are deliberately provider-agnostic (they receive a
// TelephonyProvider) and admin-client-agnostic (they receive the Supabase admin
// client) so they are easy to unit-test with mocks. Webhook routes wire them
// together.

import { sendFounderAlertEmail } from "@/lib/email";
import type { TelephonyProvider } from "./types";

type AdminLike = SupabaseUntypedClient;

// --- Cost model (Phase 1, indicative; tune later) ----------------------------
// Pence per unit. Outbound SMS dominates; inbound + inbound-call legs are cheap.
export const COST_PENCE = {
  smsOutbound: 4,
  smsInbound: 1,
  missedCall: 1,
} as const;

export type UsageCounts = {
  smsOutbound?: number;
  smsInbound?: number;
  missedCalls?: number;
};

/** Estimate telephony cost (in whole pence) for a set of usage counts. */
export function estimateTelephonyCost(counts: UsageCounts): number {
  const out = counts.smsOutbound ?? 0;
  const inb = counts.smsInbound ?? 0;
  const calls = counts.missedCalls ?? 0;
  return (
    out * COST_PENCE.smsOutbound +
    inb * COST_PENCE.smsInbound +
    calls * COST_PENCE.missedCall
  );
}

export const DEFAULT_BUSINESS_NAME = "the team";

export function buildTextBackMessage(businessName: string): string {
  const name = businessName?.trim() || DEFAULT_BUSINESS_NAME;
  return `Hi, this is ${name}. Sorry we missed your call. Reply with your name and how we can help, and we'll get back to you shortly.`;
}

// --- Phone-number → clinic resolution ----------------------------------------

export type ResolvedPhoneNumber = {
  phoneNumberId: string;
  clinicId: string;
  provider: string | null;
  e164Number: string;
  label: string | null;
};

/**
 * Resolve the tenant (clinic) that owns a LeadClaw phone number, by the E.164
 * number a call/SMS was sent to. Returns null when unknown or inactive.
 */
export async function resolveClinicByPhoneNumber(
  admin: AdminLike,
  e164Number: string | null,
): Promise<ResolvedPhoneNumber | null> {
  if (!e164Number) return null;

  const { data } = await admin
    .from("phone_numbers")
    .select("id,clinic_id,provider,e164_number,label,status")
    .eq("e164_number", e164Number)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  const row = data as
    | {
        id: string;
        clinic_id: string;
        provider: string | null;
        e164_number: string;
        label: string | null;
      }
    | null;

  if (!row?.id || !row.clinic_id) return null;

  return {
    phoneNumberId: row.id,
    clinicId: row.clinic_id,
    provider: row.provider,
    e164Number: row.e164_number,
    label: row.label,
  };
}

/** Best-effort business name for a clinic, used in the text-back message. */
export async function getBusinessNameForClinic(
  admin: AdminLike,
  clinicId: string,
): Promise<string> {
  const { data: clinic } = await admin
    .from("clinics")
    .select("name")
    .eq("id", clinicId)
    .limit(1)
    .maybeSingle();

  const clinicName = (clinic as { name: string | null } | null)?.name?.trim();
  if (clinicName) return clinicName;

  // Fall back to the onboarding client's business name via onboarding_sites.
  const { data: site } = await admin
    .from("onboarding_sites")
    .select("onboarding_client_id")
    .eq("clinic_id", clinicId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const clientId = (site as { onboarding_client_id: string | null } | null)
    ?.onboarding_client_id;

  if (clientId) {
    const { data: client } = await admin
      .from("onboarding_clients")
      .select("business_name,client_name")
      .eq("id", clientId)
      .limit(1)
      .maybeSingle();

    const c = client as
      | { business_name: string | null; client_name: string | null }
      | null;
    const name = c?.business_name?.trim() || c?.client_name?.trim();
    if (name) return name;
  }

  return DEFAULT_BUSINESS_NAME;
}

// --- Missed call recording ----------------------------------------------------

export type RecordMissedCallInput = {
  clinicId: string;
  phoneNumberId: string | null;
  provider: string | null;
  providerCallId: string | null;
  fromE164: string | null;
  toE164: string | null;
  /** "missed" when caller known; "requiring_review" when caller withheld. */
  status: string;
  rawPayload?: unknown;
  occurredAt?: string;
};

export async function recordMissedCall(
  admin: AdminLike,
  input: RecordMissedCallInput,
): Promise<string | null> {
  const { data, error } = await admin
    .from("missed_calls")
    .insert({
      clinic_id: input.clinicId,
      phone_number_id: input.phoneNumberId,
      provider: input.provider,
      provider_call_id: input.providerCallId,
      from_e164: input.fromE164,
      to_e164: input.toE164,
      status: input.status,
      occurred_at: input.occurredAt || new Date().toISOString(),
      raw_payload: input.rawPayload ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[telephony] recordMissedCall failed", error);
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
}

// --- Conversations ------------------------------------------------------------

export type Conversation = {
  id: string;
  clinic_id: string;
  enquiry_id: string | null;
  status: string | null;
};

export async function findOrCreateConversation(
  admin: AdminLike,
  input: {
    clinicId: string;
    customerE164: string;
    phoneNumberId: string | null;
    missedCallId?: string | null;
    initialStatus?: string;
  },
): Promise<Conversation | null> {
  const { data: existing } = await admin
    .from("sms_conversations")
    .select("id,clinic_id,enquiry_id,status")
    .eq("clinic_id", input.clinicId)
    .eq("customer_e164", input.customerE164)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const found = existing as Conversation | null;
  if (found?.id) return found;

  const { data, error } = await admin
    .from("sms_conversations")
    .insert({
      clinic_id: input.clinicId,
      customer_e164: input.customerE164,
      phone_number_id: input.phoneNumberId,
      missed_call_id: input.missedCallId ?? null,
      status: input.initialStatus || "open",
      last_message_at: new Date().toISOString(),
    })
    .select("id,clinic_id,enquiry_id,status")
    .single();

  if (error) {
    console.error("[telephony] findOrCreateConversation failed", error);
    return null;
  }
  return data as Conversation | null;
}

async function recordSmsMessage(
  admin: AdminLike,
  input: {
    clinicId: string;
    conversationId: string;
    direction: "inbound" | "outbound";
    fromE164: string | null;
    toE164: string | null;
    body: string;
    provider: string | null;
    providerMessageId: string | null;
    deliveryStatus: string | null;
    rawPayload?: unknown;
  },
): Promise<void> {
  const { error } = await admin.from("sms_messages").insert({
    clinic_id: input.clinicId,
    conversation_id: input.conversationId,
    direction: input.direction,
    from_e164: input.fromE164,
    to_e164: input.toE164,
    body: input.body,
    provider: input.provider,
    provider_message_id: input.providerMessageId,
    delivery_status: input.deliveryStatus,
    raw_payload: input.rawPayload ?? null,
  });
  if (error) console.error("[telephony] recordSmsMessage failed", error);
}

// --- Outbound text-back -------------------------------------------------------

export type TextBackResult =
  | { ok: true; conversationId: string; providerMessageId: string | null }
  | { ok: false; error: string };

/**
 * Send the automatic SMS text-back for a missed call, recording the outbound
 * message and opening a conversation. Caller must have a known customer number.
 */
export async function sendMissedCallTextBack(
  admin: AdminLike,
  provider: TelephonyProvider,
  input: {
    clinicId: string;
    customerE164: string;
    phoneNumberId: string | null;
    fromE164: string | null;
    missedCallId?: string | null;
  },
): Promise<TextBackResult> {
  const conversation = await findOrCreateConversation(admin, {
    clinicId: input.clinicId,
    customerE164: input.customerE164,
    phoneNumberId: input.phoneNumberId,
    missedCallId: input.missedCallId ?? null,
    initialStatus: "awaiting_reply",
  });

  if (!conversation) {
    return { ok: false, error: "conversation_create_failed" };
  }

  const businessName = await getBusinessNameForClinic(admin, input.clinicId);
  const body = buildTextBackMessage(businessName);

  const result = await provider.sendSms({
    to: input.customerE164,
    from: input.fromE164,
    body,
  });

  await recordSmsMessage(admin, {
    clinicId: input.clinicId,
    conversationId: conversation.id,
    direction: "outbound",
    fromE164: input.fromE164,
    toE164: input.customerE164,
    body,
    provider: provider.name,
    providerMessageId: result.ok ? result.providerMessageId : null,
    deliveryStatus: result.ok ? "queued" : "failed",
  });

  await admin
    .from("sms_conversations")
    .update({
      status: "awaiting_reply",
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversation.id);

  await recordUsage(admin, input.clinicId, { smsOutbound: 1 });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return {
    ok: true,
    conversationId: conversation.id,
    providerMessageId: result.providerMessageId,
  };
}

// --- Inbound SMS --------------------------------------------------------------

export async function recordInboundSms(
  admin: AdminLike,
  input: {
    clinicId: string;
    conversationId: string;
    fromE164: string | null;
    toE164: string | null;
    body: string;
    provider: string | null;
    providerMessageId: string | null;
    rawPayload?: unknown;
  },
): Promise<void> {
  await recordSmsMessage(admin, {
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    direction: "inbound",
    fromE164: input.fromE164,
    toE164: input.toE164,
    body: input.body,
    provider: input.provider,
    providerMessageId: input.providerMessageId,
    deliveryStatus: "received",
    rawPayload: input.rawPayload,
  });

  await admin
    .from("sms_conversations")
    .update({
      status: "replied",
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.conversationId);

  await recordUsage(admin, input.clinicId, { smsInbound: 1 });
}

// --- Enquiry creation from an SMS reply --------------------------------------

/**
 * Create or update an enquiry (lead) from an inbound SMS, reusing the existing
 * enquiries table. Links the enquiry back to the conversation. Returns the
 * enquiry id.
 */
export async function createOrUpdateEnquiryFromSms(
  admin: AdminLike,
  input: {
    clinicId: string;
    conversation: Conversation;
    customerE164: string;
    body: string;
  },
): Promise<string | null> {
  const service = input.body.trim().slice(0, 255) || "Missed call enquiry";

  // Existing conversation already has a lead → append the latest message.
  if (input.conversation.enquiry_id) {
    await admin
      .from("enquiries")
      .update({
        service,
        notes: JSON.stringify({
          source: "missed_call_sms",
          last_reply_excerpt: input.body.slice(0, 500),
          updated_via: "twilio_sms_webhook",
          updated_at: new Date().toISOString(),
        }),
      })
      .eq("id", input.conversation.enquiry_id);
    return input.conversation.enquiry_id;
  }

  const { data, error } = await admin
    .from("enquiries")
    .insert({
      clinic_id: input.clinicId,
      name: null,
      email: null,
      phone: input.customerE164,
      service,
      preferred_time: null,
      status: "new",
      notes: JSON.stringify({
        source: "missed_call_sms",
        customer_e164: input.customerE164,
        first_reply_excerpt: input.body.slice(0, 500),
        created_via: "twilio_sms_webhook",
      }),
    })
    .select("id")
    .single();

  if (error) {
    console.error("[telephony] createOrUpdateEnquiryFromSms failed", error);
    return null;
  }

  const enquiryId = (data as { id: string } | null)?.id ?? null;
  if (enquiryId) {
    await admin
      .from("sms_conversations")
      .update({ enquiry_id: enquiryId, updated_at: new Date().toISOString() })
      .eq("id", input.conversation.id);
  }
  return enquiryId;
}

/** Notify the business owner that a missed-call lead replied. */
export async function notifyOwnerOfSmsLead(input: {
  businessName: string;
  customerE164: string;
  body: string;
}): Promise<void> {
  try {
    await sendFounderAlertEmail({
      title: "New recovered missed-call lead (SMS)",
      lines: [
        { label: "Business", value: input.businessName },
        { label: "From", value: input.customerE164 },
        { label: "Message", value: input.body.slice(0, 800) },
        { label: "Channel", value: "Missed call → SMS text-back" },
      ],
      tags: [{ name: "source", value: "missed_call_sms" }],
    });
  } catch (error) {
    console.error("[telephony] notifyOwnerOfSmsLead failed", error);
  }
}

// --- Usage metering -----------------------------------------------------------

function currentPeriod(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Increment the current billing-period usage counters for a clinic and refresh
 * the estimated cost. Best-effort: failures are logged, never thrown.
 */
export async function recordUsage(
  admin: AdminLike,
  clinicId: string,
  counts: UsageCounts,
): Promise<void> {
  const { start, end } = currentPeriod();

  const { data: existing } = await admin
    .from("telephony_usage")
    .select(
      "id,sms_outbound_count,sms_inbound_count,missed_call_count",
    )
    .eq("clinic_id", clinicId)
    .eq("period_start", start)
    .limit(1)
    .maybeSingle();

  const row = existing as
    | {
        id: string;
        sms_outbound_count: number | null;
        sms_inbound_count: number | null;
        missed_call_count: number | null;
      }
    | null;

  const smsOutbound = (row?.sms_outbound_count ?? 0) + (counts.smsOutbound ?? 0);
  const smsInbound = (row?.sms_inbound_count ?? 0) + (counts.smsInbound ?? 0);
  const missedCalls = (row?.missed_call_count ?? 0) + (counts.missedCalls ?? 0);
  const estimatedCost = estimateTelephonyCost({
    smsOutbound,
    smsInbound,
    missedCalls,
  });

  if (row?.id) {
    await admin
      .from("telephony_usage")
      .update({
        sms_outbound_count: smsOutbound,
        sms_inbound_count: smsInbound,
        missed_call_count: missedCalls,
        estimated_cost_pence: estimatedCost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  } else {
    const { error } = await admin.from("telephony_usage").insert({
      clinic_id: clinicId,
      period_start: start,
      period_end: end,
      sms_outbound_count: smsOutbound,
      sms_inbound_count: smsInbound,
      missed_call_count: missedCalls,
      estimated_cost_pence: estimatedCost,
    });
    if (error) console.error("[telephony] recordUsage insert failed", error);
  }
}

// --- Inbound keyword classification (STOP / START / HELP) ---------------------

export type InboundIntent = "stop" | "start" | "help" | "reply";

export function classifyInboundKeyword(body: string): InboundIntent {
  const word = body.trim().toUpperCase();
  if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(word)) {
    return "stop";
  }
  if (["START", "YES", "UNSTOP"].includes(word)) return "start";
  if (["HELP", "INFO"].includes(word)) return "help";
  return "reply";
}
