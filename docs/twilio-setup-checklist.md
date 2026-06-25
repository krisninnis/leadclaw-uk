# Twilio Setup Checklist for the Admin SMS Test Path

This checklist is for the existing admin-only SMS test path. It does not cover
missed-call recovery, inbound SMS automation, WhatsApp, voice calling, billing,
queues, retries, or provider dashboards.

The path being configured is:

```text
/admin/communications-test
  -> POST /api/admin/communications/test-sms
  -> sendSms()
  -> COMMUNICATIONS_SMS_PROVIDER=twilio
  -> src/lib/communications/providers/twilio.ts
  -> src/lib/telephony/twilio.ts
  -> Twilio Messages REST API
  -> communication_events
```

## Required environment variables

Set these in the target runtime before attempting a real admin SMS test:

```env
COMMUNICATIONS_SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=+44xxxxxxxxxx
```

Alternatively, use a Messaging Service instead of a direct sender number:

```env
COMMUNICATIONS_SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Use either `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`.
If both are set, the current Twilio provider uses the Messaging Service SID.

`COMMUNICATIONS_DEFAULT_FROM_SMS` is optional. Leave it unset unless you
intentionally want `sendSms()` to pass a sender override into the provider.

## Read-only readiness check

After setting env vars and restarting the app, open this admin-only endpoint:

```text
GET /api/admin/communications/twilio-readiness
```

It checks local environment readiness only. It does not call Twilio, send SMS,
buy numbers, create Messaging Services, or mutate any LeadClaw data.

The response reports:

- whether `COMMUNICATIONS_SMS_PROVIDER` is set to `twilio`
- whether the Account SID and Auth Token are present
- whether a sender source exists
- whether the sender mode is `from_number`, `messaging_service`, or `missing`
- warnings for likely setup mistakes

It never returns secret env values.

## Manual Twilio steps still required

1. Sign in to the Twilio Console.
2. Copy the Account SID into `TWILIO_ACCOUNT_SID`.
3. Copy the Auth Token into `TWILIO_AUTH_TOKEN`.
4. Choose one sender strategy:
   - Use an SMS-capable Twilio phone number and set `TWILIO_FROM_NUMBER` in
     E.164 format, for example `+447...`; or
   - Use a Messaging Service, add an SMS-capable sender to its sender pool, and
     set `TWILIO_MESSAGING_SERVICE_SID`.
5. If using a Twilio trial account, verify the recipient number in Twilio before
   sending. Trial accounts can only send messages to verified recipients.
6. Add the env vars to the correct local/Vercel environment and redeploy or
   restart the server.
7. Visit `/api/admin/communications/twilio-readiness` while signed in as an
   admin. Confirm `ready: true`.
8. Only after the readiness check is green, use `/admin/communications-test` to
   send exactly one controlled test SMS.

## Safety notes

- Do not put `TWILIO_AUTH_TOKEN` in client-side code or `NEXT_PUBLIC_*` env vars.
- The readiness endpoint is admin-only and read-only.
- The readiness endpoint is not a Twilio connectivity test; it only checks local
  configuration presence/shape.
- The first real SMS should be sent only from the admin SMS test page and only
  to a number you are authorised to contact.
- `communication_events` stores masked phone numbers and redacted message
  previews. The admin SMS test path uses the existing `sendSms()` event logging.

