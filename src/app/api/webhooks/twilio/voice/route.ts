// POST /api/webhooks/twilio/voice
//
// Fires when a (forwarded) call reaches a LeadClaw number. We treat every
// inbound call here as a missed call — forwarding-on-no-answer means the
// business already failed to pick up. We record the call and, if the caller's
// number is known, send the automatic SMS text-back. If the caller ID is
// withheld we record the call as requiring_review and send nothing.

import { createAdminClient } from "@/lib/supabase/admin";
import { logSystemEvent } from "@/lib/ops";
import { guardTwilioWebhook } from "@/lib/telephony/webhook-guard";
import { normalisePhoneNumber } from "@/lib/telephony/phone";
import {
  recordMissedCall,
  recordUsage,
  resolveClinicByPhoneNumber,
  sendMissedCallTextBack,
} from "@/lib/telephony/orchestration";

const XML_HEADERS = { "content-type": "text/xml; charset=utf-8" };

const VOICE_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Sorry, we can't take your call right now. We'll text you shortly so you can tell us how we can help.</Say><Hangup/></Response>`;
const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

function twiml(body: string, status = 200) {
  return new Response(body, { status, headers: XML_HEADERS });
}

export async function POST(req: Request) {
  const guard = await guardTwilioWebhook(req, "/api/webhooks/twilio/voice");
  if (!guard.allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  const { params, provider } = guard;
  const admin = createAdminClient({ optional: true });
  if (!admin) {
    console.error("[twilio.voice] supabase_not_configured");
    return twiml(EMPTY_TWIML);
  }

  const adminClient = admin as unknown as SupabaseUntypedClient;
  const parsed = provider.parseInboundVoiceWebhook(params);

  const toE164 = normalisePhoneNumber(parsed.toRaw);
  const fromE164 = normalisePhoneNumber(parsed.fromRaw);

  const clinic = await resolveClinicByPhoneNumber(adminClient, toE164);
  if (!clinic) {
    await logSystemEvent({
      level: "warn",
      category: "automation",
      message: "Twilio voice webhook for unknown number",
      meta: { to: toE164, callSid: parsed.providerCallId },
    });
    return twiml(EMPTY_TWIML);
  }

  const status = fromE164 ? "missed" : "requiring_review";

  const missedCallId = await recordMissedCall(adminClient, {
    clinicId: clinic.clinicId,
    phoneNumberId: clinic.phoneNumberId,
    provider: provider.name,
    providerCallId: parsed.providerCallId,
    fromE164,
    toE164,
    status,
    rawPayload: params,
  });

  await recordUsage(adminClient, clinic.clinicId, { missedCalls: 1 });

  // No caller number → cannot text back. Recorded for manual review only.
  if (!fromE164) {
    await logSystemEvent({
      level: "info",
      category: "automation",
      message: "Missed call with withheld caller ID — no text-back sent",
      meta: { clinicId: clinic.clinicId, missedCallId },
    });
    return twiml(VOICE_TWIML);
  }

  try {
    const result = await sendMissedCallTextBack(adminClient, provider, {
      clinicId: clinic.clinicId,
      customerE164: fromE164,
      phoneNumberId: clinic.phoneNumberId,
      fromE164: clinic.e164Number,
      missedCallId,
    });

    if (!result.ok) {
      console.error("[twilio.voice] text-back failed", result.error);
    }
  } catch (error) {
    console.error("[twilio.voice] text-back threw", error);
  }

  return twiml(VOICE_TWIML);
}
