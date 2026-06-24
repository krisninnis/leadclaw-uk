// POST /api/webhooks/twilio/status
//
// Message delivery-status callbacks. Updates the matching sms_messages row's
// delivery_status. Never errors if the message isn't found (status callbacks
// can arrive for messages we don't track).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardTwilioWebhook } from "@/lib/telephony/webhook-guard";

export async function POST(req: Request) {
  const guard = await guardTwilioWebhook(req, "/api/webhooks/twilio/status");
  if (!guard.allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  const { params, provider } = guard;
  const admin = createAdminClient({ optional: true });
  if (!admin) {
    return NextResponse.json({ ok: false, error: "supabase_not_configured" });
  }

  const adminClient = admin as unknown as SupabaseUntypedClient;
  const parsed = provider.parseMessageStatusWebhook(params);

  if (!parsed.providerMessageId || !parsed.deliveryStatus) {
    return NextResponse.json({ ok: true, matched: false });
  }

  const { error } = await adminClient
    .from("sms_messages")
    .update({ delivery_status: parsed.deliveryStatus })
    .eq("provider_message_id", parsed.providerMessageId);

  if (error) {
    console.error("[twilio.status] update failed", error);
    return NextResponse.json({ ok: true, matched: false });
  }

  return NextResponse.json({ ok: true, matched: true });
}
