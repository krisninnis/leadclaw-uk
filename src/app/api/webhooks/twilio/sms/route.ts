// POST /api/webhooks/twilio/sms
//
// Fires when a customer replies by SMS to a LeadClaw number. We record the
// inbound message, attach it to a conversation, create/update an enquiry (lead)
// using the existing enquiries table, link it to the conversation, and notify
// the owner. STOP/START/HELP keywords are handled without creating a lead.

import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/ops";
import { guardTwilioWebhook } from "@/lib/telephony/webhook-guard";
import { normalisePhoneNumber } from "@/lib/telephony/phone";
import {
  classifyInboundKeyword,
  createOrUpdateEnquiryFromSms,
  findOrCreateConversation,
  getBusinessNameForClinic,
  notifyOwnerOfSmsLead,
  recordInboundSms,
  resolveClinicByPhoneNumber,
} from "@/lib/telephony/orchestration";

const XML_HEADERS = { "content-type": "text/xml; charset=utf-8" };
const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

function twiml(body = EMPTY_TWIML, status = 200) {
  return new Response(body, { status, headers: XML_HEADERS });
}

export async function POST(req: Request) {
  const guard = await guardTwilioWebhook(req, "/api/webhooks/twilio/sms");
  if (!guard.allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  const { params, provider } = guard;
  const admin = createAdminClient({ optional: true });
  if (!admin) {
    console.error("[twilio.sms] supabase_not_configured");
    return twiml();
  }

  const adminClient = admin as unknown as SupabaseUntypedClient;
  const parsed = provider.parseInboundSmsWebhook(params);

  const toE164 = normalisePhoneNumber(parsed.toRaw); // LeadClaw number
  const fromE164 = normalisePhoneNumber(parsed.fromRaw); // customer

  const clinic = await resolveClinicByPhoneNumber(adminClient, toE164);
  if (!clinic || !fromE164) {
    await logSystemEvent({
      level: "warn",
      category: "automation",
      message: "Twilio SMS webhook for unknown number or sender",
      meta: { to: toE164, hasFrom: Boolean(fromE164) },
    });
    return twiml();
  }

  const conversation = await findOrCreateConversation(adminClient, {
    clinicId: clinic.clinicId,
    customerE164: fromE164,
    phoneNumberId: clinic.phoneNumberId,
  });

  if (!conversation) {
    return twiml();
  }

  await recordInboundSms(adminClient, {
    clinicId: clinic.clinicId,
    conversationId: conversation.id,
    fromE164,
    toE164,
    body: parsed.body,
    provider: provider.name,
    providerMessageId: parsed.providerMessageId,
    rawPayload: params,
  });

  const intent = classifyInboundKeyword(parsed.body);

  // Compliance keywords: do not create a lead or notify.
  if (intent === "stop") {
    await adminClient
      .from("sms_conversations")
      .update({ status: "opted_out", updated_at: new Date().toISOString() })
      .eq("id", conversation.id);
    return twiml();
  }

  if (intent === "help") {
    return twiml();
  }

  if (intent === "start") {
    await adminClient
      .from("sms_conversations")
      .update({ status: "open", updated_at: new Date().toISOString() })
      .eq("id", conversation.id);
    return twiml();
  }

  const enquiryId = await createOrUpdateEnquiryFromSms(adminClient, {
    clinicId: clinic.clinicId,
    conversation,
    customerE164: fromE164,
    body: parsed.body,
  });

  const businessName = await getBusinessNameForClinic(
    adminClient,
    clinic.clinicId,
  );

  await notifyOwnerOfSmsLead({
    businessName,
    customerE164: fromE164,
    body: parsed.body,
  });

  await logSystemEvent({
    level: "info",
    category: "automation",
    message: "Recovered missed-call SMS lead",
    meta: { clinicId: clinic.clinicId, enquiryId, conversationId: conversation.id },
  });

  return twiml();
}
