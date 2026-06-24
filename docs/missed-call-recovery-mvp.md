# Missed Call Recovery — Phase 1 (MVP infrastructure)

This documents the Phase 1 technical foundation only. It proves the core loop:

```
missed call → SMS text-back → SMS reply → enquiry created → owner notified → visible in portal
```

It is **not** the full commercial launch. Out of scope (deliberately not built):
AI voice receptionist, voicemail transcription, appointment booking, billing/plan
changes, number provisioning UI, nav links, and any change to the existing
website widget. See `MISSED-CALL-RECOVERY-STRATEGY.md` for the wider plan.

---

## Architecture overview

A thin provider abstraction (`src/lib/telephony`) isolates Twilio so a second
provider (e.g. Telnyx) can be added later without touching routes or logic.

| Layer | Files |
|---|---|
| Provider interface | `src/lib/telephony/types.ts` |
| Twilio provider (REST via `fetch`, signature via `crypto`) | `src/lib/telephony/twilio.ts` |
| Test/no-op provider | `src/lib/telephony/test-provider.ts` |
| Factory + webhook helpers | `src/lib/telephony/index.ts` |
| Phone normalisation (pure) | `src/lib/telephony/phone.ts` |
| Orchestration (DB + provider glue) | `src/lib/telephony/orchestration.ts` |
| Webhook signature guard | `src/lib/telephony/webhook-guard.ts` |

No new npm dependency is added — Twilio is called over its REST API with `fetch`,
and request-signature validation uses Node's built-in `crypto` (HMAC-SHA1).

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | to send/validate | Twilio account SID (Basic auth user). |
| `TWILIO_AUTH_TOKEN` | to send/validate | Auth token; used for REST auth **and** webhook signature validation. |
| `TWILIO_FROM_NUMBER` | if no messaging service | Default E.164 sender for outbound SMS. |
| `TWILIO_MESSAGING_SERVICE_SID` | optional | If set, used instead of `From` for sending. |
| `TWILIO_WEBHOOK_BASE_URL` | optional | Override the public base URL used to reconstruct the signed webhook URL (defaults to `getAppUrl()`). |
| `TELEPHONY_PROVIDER` | optional | Provider selector; defaults to `twilio`. |

**The app builds and runs without any of these set.** Missing config never throws
at import time:
* `sendSms()` returns `{ ok: false, error: "twilio_not_configured" }`;
* webhook signature validation returns `not_configured`, and the webhook guard
  then *allows* the request through (so local testing works) while logging a
  warning. In production, always set `TWILIO_AUTH_TOKEN` so signatures are
  enforced.

---

## Database

Additive migration: `supabase/migrations/20260624_add_missed_call_recovery.sql`.
Five new tables, all RLS-enabled with a `service_role`-only policy (webhooks and
admin reads use the service-role client; tenant scoping is by `clinic_id`):

* `phone_numbers` — LeadClaw numbers owned by a clinic (lookup key for routing).
* `missed_calls` — one row per inbound (forwarded) call.
* `sms_conversations` — a text thread with one customer number; links to `enquiries`.
* `sms_messages` — individual inbound/outbound SMS with delivery status.
* `telephony_usage` — per-clinic, per-period counters + estimated cost (pence).

The existing `enquiries` and `clinics` tables are reused unchanged. No destructive
statements; everything is `IF NOT EXISTS`.

To apply: run the migration through your normal Supabase migration flow (the same
way prior `supabase/migrations/*.sql` files are applied). A `phone_numbers` row
must exist (clinic_id + active E.164 number) before calls/SMS to that number will
be recognised.

---

## Webhook URLs

Point your Twilio number's webhooks at:

| Event | Method | URL |
|---|---|---|
| Voice (A call comes in) | `POST` | `https://<your-app>/api/webhooks/twilio/voice` |
| Messaging (A message comes in) | `POST` | `https://<your-app>/api/webhooks/twilio/sms` |
| Message status callback | `POST` | `https://<your-app>/api/webhooks/twilio/status` |

Voice returns TwiML (a short spoken line + hangup). The voice handler treats every
inbound call as a missed call (the forwarding-on-no-answer setup means the
business already failed to answer).

---

## Behaviour summary

**Voice** → resolve clinic by the called number → record `missed_calls`
→ if the caller's number is present, open a conversation and send the SMS
text-back; if the caller ID is **withheld**, record status `requiring_review`
and send nothing → return TwiML.

**SMS** → resolve clinic by the called number → store inbound message
→ `STOP/UNSUBSCRIBE` marks the conversation `opted_out` (no lead, no alert);
`HELP`/`START` handled without creating a lead → otherwise create/update an
`enquiries` row, link it to the conversation, and email the owner via the
existing `sendFounderAlertEmail` helper.

**Status** → update the matching `sms_messages.delivery_status`; silently ignores
unknown message IDs.

Text-back copy (configurable later):

> Hi, this is {businessName}. Sorry we missed your call. Reply with your name and how we can help, and we'll get back to you shortly.

`businessName` is derived from the clinic, then the onboarding client's business
name, falling back to "the team".

---

## Local testing

The Jest suite mocks all Twilio network calls; no credentials needed.

```bash
# Run the telephony tests (cold start can take ~20s on first compile)
npx jest src/__tests__/telephony-phone.test.ts \
         src/__tests__/telephony-twilio.test.ts \
         src/__tests__/telephony-orchestration.test.ts \
         src/__tests__/api/twilio-webhooks.test.ts --runInBand
```

Manual webhook smoke test (no signature when `TWILIO_AUTH_TOKEN` is unset):

```bash
# Simulate an inbound SMS reply (requires a phone_numbers row for +441174960000)
curl -X POST http://localhost:3000/api/webhooks/twilio/sms \
  -H 'content-type: application/x-www-form-urlencoded' \
  --data 'MessageSid=SMtest&From=%2B447700900123&To=%2B441174960000&Body=Leaking%20tap'
```

End-to-end with real Twilio: use the [Twilio CLI / console] to point a UK number's
voice + messaging webhooks at a tunnelled URL (e.g. ngrok), set the env vars, and
place a call / send a text.

---

## Known limitations (Phase 1)

* **UK forwarded-call CLI must be validated manually.** The whole text-back flow
  depends on the *original* caller's number being presented on a
  conditional-call-forwarded leg. This varies by UK carrier and divert type and
  has **not** been verified in production. Validate on real UK mobile + landline
  carriers before any pilot. If CLI is withheld, the call is recorded as
  `requiring_review` and no SMS is sent (by design).
* No number provisioning UI — `phone_numbers` rows are inserted manually for now.
* No outbound conversation UI — the portal surface (`/portal/calls`) is read-only.
* No nav link to `/portal/calls` yet (kept isolated to avoid editing shared nav).
* Cost figures in `telephony_usage` are indicative estimates, not billed amounts.
* Signature enforcement is bypassed when `TWILIO_AUTH_TOKEN` is unset (dev mode).

---

## First pilot checklist

1. [ ] Apply the migration to the target environment.
2. [ ] Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_NUMBER`
       (or `TWILIO_MESSAGING_SERVICE_SID`).
3. [ ] Buy/assign a UK Twilio number and insert a `phone_numbers` row
       (`clinic_id`, `e164_number`, `status = 'active'`).
4. [ ] Point the number's voice + messaging + status webhooks at the three routes.
5. [ ] **Validate forwarded-call CLI** on the pilot customer's real carrier:
       confirm the original caller number reaches the voice webhook.
6. [ ] Configure the customer's conditional call forwarding (forward on
       no-answer/busy) to the LeadClaw number.
7. [ ] Place a test missed call → confirm the text-back arrives.
8. [ ] Reply to the text → confirm an `enquiries` row appears, the owner email
       fires, and it shows in `/portal/calls`.
9. [ ] Confirm `STOP` opts the conversation out and sends no further messages.
10. [ ] Review `telephony_usage` for the clinic and sanity-check counts.
```
