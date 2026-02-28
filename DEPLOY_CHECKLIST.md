# Deploy Checklist — Clinic Retention Engine

## 1) Database
- [ ] Run latest `supabase/schema.sql`
- [ ] Confirm tables exist:
  - `retention_clients`
  - `retention_tasks`
  - `retention_events`

## 2) Environment Variables
- [ ] `RETENTION_INGEST_TOKEN`
- [ ] `RETENTION_RUN_TOKEN`
- [ ] `RETENTION_METRICS_TOKEN` (optional; falls back to RUN token)
- [ ] `RESEND_API_KEY`
- [ ] `RESEND_FROM_EMAIL`
- [ ] `NEXT_PUBLIC_APP_URL`

## 3) Schedule Automation
- [ ] Cron/automation every 15-30 min:
  - `POST /api/retention/run`
  - Header: `Authorization: Bearer <RETENTION_RUN_TOKEN>`

## 4) Trigger Wiring (from your app/events)
- [ ] New enquiry -> `triggerType=enquiry_received`
- [ ] Treatment completed -> `triggerType=treatment_completed`
- [ ] Hesitation detected -> `triggerType=consultation_hesitation`
- [ ] Dormant segment -> `triggerType=client_dormant`

## 5) Smoke Tests
- [ ] Call `/api/retention/ingest` with test payload
- [ ] Call `/api/retention/run`
- [ ] Verify row status transitions: `queued -> sent/skipped`
- [ ] Verify logs in `retention_events`
- [ ] Verify metrics via `GET /api/retention/metrics`

## 6) Guardrails
- [ ] Keep message templates short + no-pressure
- [ ] No booking engine features added
- [ ] No heavy CRM coupling unless required
- [ ] Maintain suppression/unsubscribe handling

## 7) Scraper Bot Readiness
- [ ] Activate venv: `.venv\Scripts\activate`
- [ ] Validate help commands:
  - `.venv\Scripts\python run.py --help`
  - `.venv\Scripts\python places_run.py --help`
  - `.venv\Scripts\python places_batch.py --help`
- [ ] Ensure `.env` has Supabase + (optional) Google Places key
