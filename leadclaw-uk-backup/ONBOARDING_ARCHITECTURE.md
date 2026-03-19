# Beauty AI Agent — Installation + Onboarding System

## 1) Install Options Matrix

| Method | Pros | Cons | Required access | Time-to-live | Failure modes |
|---|---|---|---|---|---|
| 1-line script embed (preferred) | Fast, repeatable, cross-platform, easiest rollback | Can be blocked by cache/CSP/minify conflicts | Ability to add code to site header/footer | 5-15 min | Script blocked, snippet placed in wrong area, cache not purged |
| WordPress plugin (optional) | Better WP UX/settings, plugin-level diagnostics | Plugin maintenance + compatibility overhead | WP admin with plugin install capability | 15-30 min | Plugin conflict, disabled plugin, host restrictions |
| GTM container snippet (optional) | Controlled publish workflow, no theme edits | Requires GTM setup and publish rights | GTM workspace/container publish rights | 10-20 min | Not published, wrong trigger, blocked by consent mode |

## 2) WordPress Happy Path (Self-Serve)

1. Install trusted header/footer plugin (e.g. WPCode).
2. Paste widget script in footer on all pages.
3. Save and purge cache plugin + CDN.
4. Set business settings (hours/services/pricing ranges/contact methods).
5. Test on desktop, incognito, and mobile.
6. Confirm with screenshots:
   - snippet placement
   - live widget on homepage
   - test conversation
   - mobile view

Common fixes:
- purge cache/CDN
- disable JS minify temporarily
- ensure no duplicate snippet
- test with default theme if conflict suspected

## 3) Done-for-You Deployment Flow

### Intake data
- domain
- platform
- contact email
- services, hours, goals
- preferred handoff channel

### Safe access model
- Prefer self-serve snippet install first.
- If assisted:
  - WordPress: temporary user with minimum required rights
  - GTM: workspace-level publish only
  - Shopify/Wix/Squarespace: collaborator/contributor with code injection scope only

### Agent execution plan
1. Validate access scope and backup/rollback path.
2. Install snippet/plugin/tag based on platform.
3. Verify script load + widget render.
4. Run test enquiry flow.
5. If failure, rollback by removing snippet/plugin/tag and clearing cache.
6. Generate handover report with proof and rollback record.

### Post-install activation
Enable retention loops:
- missed enquiry recovery
- unanswered follow-up
- aftercare reassurance
- rebooking nudges
- dormant reactivation

## 4) Security + Compliance Checklist (Practical)

- data minimization: store only contact + enquiry metadata required for automation
- consent notice in chat form/footer
- no API keys in frontend snippets
- audit logs for install/update/rollback actions
- account separation per client/site/token
- rate limiting + abuse protection on public APIs
- do not store sensitive medical data/payment card details

## 5) Client Onboarding Assets

### Welcome email
Subject: Your AI assistant is ready to launch

Hi {{ClientName}},

Your assistant is ready for {{Domain}}.

1) Add script snippet: {{WidgetScript}}
2) Complete settings: {{SettingsLink}}
3) Test in incognito/mobile and reply DONE

### Non-technical explainer
This assistant captures missed enquiries, follows up automatically, nudges clients to rebook, and sends aftercare messages so your team spends less time chasing and more time treating.

### Troubleshooting checklist
- snippet installed on all pages
- no duplicate snippet
- cache/CDN purged
- mobile + incognito tested
- token/domain match
- handoff channel configured

## 6) Product Packaging Decision

Recommendation: script embed as default, GTM as secondary, plugin optional.

Versioning:
- serve stable script endpoint for most clients
- use token-based feature flags for safe rollouts
- maintain rollback channel for script versions

Multi-site support:
- one dashboard
- per-site widget token
- per-site settings + logs + retention schedules

## 7) Autonomous Task List

On every signup:
1. create client workspace
2. create site record
3. generate unique widget token
4. generate install package/snippet
5. queue onboarding tasks
6. run validation tests
7. schedule retention automations
8. generate handover report

Implemented API routes:
- `POST /api/onboarding/intake`
- `POST /api/onboarding/run`
- `GET /api/onboarding/assets`
- `GET /api/widget/bootstrap.js`
