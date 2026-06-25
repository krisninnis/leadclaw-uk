# LeadClaw Communications Layer

Provider-agnostic foundation for every message LeadClaw sends or receives:
email, SMS, WhatsApp, voice and voicemail. Phase 1 ships the abstraction and an
event log; it does **not** buy numbers, route live voice, or build missed-call
recovery.

## Why this exists

LeadClaw historically called a single vendor's SDK directly from routes — Resend
for email, and (in the telephony module) Twilio for SMS/voice. That couples
business logic to one vendor, makes a second provider a cross-cutting change, and
leaves no uniform place to see what was sent.

The communications layer fixes this: callers use a small set of internal
functions and never import a provider SDK. The vendor behind each channel is a
config choice, and every send/receive can be logged uniformly.

```
route / lib  ──►  @/lib/communications  ──►  EmailProvider / SmsProvider / ...
                       │                          (resend, twilio, telnyx,
                       └──► communication_events    vonage, plivo, whatsapp_cloud, mock)
```

## Public API

Import only from `@/lib/communications`:

| Function | Phase 1 status |
| --- | --- |
| `sendLeadNotificationEmail(input)` | **Functional** (email) |
| `sendTrialLifecycleEmail(input)` | **Functional** (email) |
| `sendSms(input)` | Stub → `provider_not_configured` unless `mock` |
| `sendWhatsApp(input)` | Stub → `provider_not_configured` unless `mock` |
| `recordInboundVoicemail(input)` | Logs a receipt event only (no capture) |
| `recordCommunicationEvent(event)` | **Functional** (best-effort log) |

Every function returns a uniform `CommunicationResult` (`{ ok: true, ... }` or
`{ ok: false, error, detail }`) and **never throws** for an expected failure
(missing provider, vendor error, bad recipient). Callers branch on `result.ok`.

## Provider abstraction design

- `types.ts` — domain model: `CommunicationChannel`, `CommunicationDirection`,
  `CommunicationStatus`, `CommunicationProvider`, the `Send*Input` payloads,
  `CommunicationResult`, and `CommunicationEvent`. Types only — zero runtime cost.
- `provider.ts` — narrow adapter interfaces: `EmailProvider`, `SmsProvider`,
  `WhatsAppProvider`, each extending `BaseProvider` (`name`, `isConfigured()`).
- `providers/mock.ts` — `MockProvider` implementing all three. Records safe
  metadata in-memory, logs one redacted line, **never** does network I/O.
- `providers/resend.ts` — `ResendEmailProvider`, a thin wrapper over the existing
  `src/lib/email.ts` `sendEmail()` (no new Resend SDK usage; reuses its API-key
  check, from-address resolution and suppression handling).
- `config.ts` — resolves `COMMUNICATIONS_*` env vars to a provider per channel.
- `events.ts` — redaction helpers + best-effort insert into `communication_events`.
- `index.ts` — provider factories + the service functions above.

Adding a vendor = one new file under `providers/` + one line in the relevant
factory in `index.ts`. Routes never change.

## Current providers

| Channel | Default | Wired in Phase 1 | Accepted config values |
| --- | --- | --- | --- |
| Email | `resend` | `resend`, `mock` | `resend`, `mock` |
| SMS | _none_ | `mock` | `mock`, `twilio`, `telnyx`, `vonage`, `plivo` |
| WhatsApp | _none_ | `mock` | `mock`, `whatsapp_cloud`, `twilio` |

Real SMS/WhatsApp vendor names are accepted by config but resolve to a
not-configured stub until their adapters land (Phase 2). Note: the separate
`src/lib/telephony/` module already contains a working Twilio SMS/voice provider
used by the Missed Call Recovery infra — Phase 2 will bridge the SMS channel of
this layer to it rather than re-implementing Twilio.

## Configuration

All optional; missing values fall back to safe defaults and never fail the build.

```
COMMUNICATIONS_EMAIL_PROVIDER=resend|mock          # default: resend
COMMUNICATIONS_SMS_PROVIDER=mock|twilio|telnyx|vonage|plivo   # default: unset → not configured
COMMUNICATIONS_WHATSAPP_PROVIDER=mock|whatsapp_cloud|twilio   # default: unset → not configured
COMMUNICATIONS_DEFAULT_FROM_EMAIL=...              # falls back to RESEND_FROM_EMAIL
COMMUNICATIONS_DEFAULT_FROM_SMS=...                # E.164 or messaging-service id
```

Behaviour when unset: email keeps working via Resend; SMS/WhatsApp return
`provider_not_configured` gracefully.

## Event log & privacy

`communication_events` (migration `20260625_add_communication_events.sql`,
additive, RLS service-role-only, `set_updated_at` trigger) stores one row per
communication with: channel, direction, provider, status, masked from/to,
subject, a redacted `body_preview`, provider message id, error, `metadata`
jsonb, and tenant/lead/enquiry FKs (all nullable, `ON DELETE SET NULL`).

Privacy rules enforced in `events.ts`:

- **Never store full body** — only `body_preview`, capped at 140 chars with
  embedded emails/phones masked (`[email]`, `[phone]`) and whitespace collapsed.
- **Mask addresses** — email → `ab***@domain`; phone → `***1234`.
- **No sensitive medical detail** in logs — only delivery-debugging metadata.
- Logging is **best-effort**: a failed insert never breaks a send.

## What's integrated now

One low-risk path is live: the **hot-demo founder alert** in
`src/app/api/outreach/demo-visit/route.ts` now calls `sendLeadNotificationEmail`
instead of `sendFounderAlertEmail`. The same alert email is still delivered
(behaviour-preserving) and the send is now logged to `communication_events`.
No other email path was refactored.

## Roadmap

**Phase 2 — SMS**
- Real SMS adapter(s); bridge SMS channel to existing `src/lib/telephony` Twilio
  provider.
- Missed-call text-back.

**Phase 3 — Voicemail**
- Voicemail capture, recording storage, transcription (extend
  `recordInboundVoicemail`).

**Phase 4 — Voice**
- AI voice receptionist, call routing, appointment booking.

## Cost notes

- **Email (Resend):** free tier then usage-based; existing account.
- **SMS/WhatsApp (Twilio/Telnyx/Vonage/Plivo, WhatsApp Cloud):** per-message +
  per-number fees; WhatsApp adds per-conversation pricing. Not incurred in
  Phase 1 (no live SMS/WhatsApp sending, no numbers purchased).
- **Voice/recording/transcription:** per-minute; deferred to Phases 3–4.

The provider abstraction exists partly so cost can be optimised by switching or
mixing vendors per channel without code changes.
