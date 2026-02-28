# LeadClaw.uk

## Automation OS for UK Beauty & Aesthetic Clinics

LeadClaw is a vertical SaaS platform built for UK aesthetic and beauty clinics.  
It combines AI reception, retention automation, lead generation, onboarding automation, and subscription billing into one operational system.

**Live Platform:** https://leadclaw.uk

---

# 🚀 What LeadClaw Does

LeadClaw replaces manual follow-ups, missed enquiries, and admin overload with structured automation:

- 24/7 AI enquiry capture
- Trial → paid subscription automation
- Retention lifecycle workflows
- Lead scoring + outreach engine
- Automated onboarding installs
- Stripe subscription lifecycle management
- Admin operations dashboard
- Compliance logging + audit trail

---

# 🏗 System Architecture

## Frontend

- Next.js (App Router)
- Marketing site
- Pricing page
- Client Portal
- Admin Dashboard
- SEO landing pages

## Backend (API Routes)

- `/api/stripe/*`
- `/api/retention/*`
- `/api/onboarding/*`
- `/api/outreach/*`
- `/api/newsletter/*`
- `/api/admin/*`
- `/api/ops/*`

## Database

- Supabase (Postgres)
- Row Level Security (RLS)
- Auth via Magic Link
- Service role for webhook + automation writes

## Billing

- Stripe Checkout
- 7-day free trial
- Subscription persistence
- Customer billing portal
- Webhook-driven state sync

## Email

- Resend API
- Retention sequences
- Trial lifecycle emails
- Outreach campaigns
- Suppression + unsubscribe support

## Deployment

- Vercel (Production + Preview)
- Environment-specific Stripe configuration
- Token-protected automation endpoints

---

# 🌍 Environment Strategy (Critical)

Stripe environments must match deployment environments.

| Environment | Stripe Mode | Keys Used     |
| ----------- | ----------- | ------------- |
| Production  | Live        | `sk_live_...` |
| Preview     | Test        | `sk_test_...` |
| Development | Test        | `sk_test_...` |

Never mix test prices with live keys.

Production domain:  
`https://leadclaw.uk`

---

# 💻 Local Development

```bash
npm install
npm run dev
```
