# Automated Business Runbook (Free Trial -> Paid)

## 0) Goal
Acquire trial clients, install quickly, prove value in 7 days, auto-convert to paid with minimal manual effort.

## 1) Live Endpoints
- Trial checkout: `POST /api/stripe/checkout`
- Onboarding intake: `POST /api/onboarding/intake`
- Onboarding runner: `POST /api/onboarding/run`
- Retention runner: `POST /api/retention/run`
- Trial billing runner: `POST /api/billing/trial-run`

## 2) Daily Automation Cadence
- Retention: every 30 minutes (local scheduler)
- Onboarding: every hour (local scheduler)
- Trial billing nudges: daily 09:15 (local scheduler + Vercel cron)

## 3) New Client Path (No-touch default)
1. Client starts trial from pricing.
2. System creates subscription/trial in Stripe.
3. Intake endpoint creates onboarding workspace + site + widget token.
4. Welcome/install assets sent.
5. Onboarding runner executes autonomous tasks.
6. Retention loops scheduled.
7. Trial runner sends staged conversion nudges.
8. Stripe webhook updates subscription on payment.

## 4) Success Criteria
- onboarding task failure rate <5%
- retention runner success >95%
- trial->paid conversion tracked in `subscriptions`
- all runner logs present in `workspace/logs`

## 5) Operator Checks (5 min/day)
- Verify scheduled tasks last result = 0
- Check logs: `retention-run.log`, `onboarding-run.log`, `billing-trial-run.log`
- Check `/api/retention/metrics`
- Check recent `system_events` errors

## 6) If Something Breaks
- Rollback install: remove widget script/tag/plugin
- Retry runners manually via scripts
- Confirm env vars + Supabase tables + Resend sender
- Keep using `https://leadclawai.vercel.app` if custom domain DNS is still propagating
