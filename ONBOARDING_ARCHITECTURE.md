# LeadClaw AI Workflow - Installation + Onboarding System

## 1) Install Options Matrix

| Method | Pros | Cons | Required access | Time-to-live | Failure modes |
|---|---|---|---|---|---|
| 1-line script embed (preferred) | Fast, repeatable, cross-platform, easiest rollback | Can be blocked by cache/CSP/minify conflicts | Ability to add code to site header/footer | 5-15 min | Script blocked, snippet placed in wrong area, cache not purged |
| WordPress plugin (optional) | Better WP UX/settings, plugin-level diagnostics | Plugin maintenance + compatibility overhead | WP admin with plugin install capability | 15-30 min | Plugin conflict, disabled plugin, host restrictions |
| GTM container snippet (optional) | Controlled publish workflow, no theme edits | Requires GTM setup and publish rights | GTM workspace/container publish rights | 10-20 min | Not published, wrong trigger, blocked by consent mode |

## 2) WordPress Happy Path (Self-Serve)

1. Install trusted header/footer plugin such as WPCode.
2. Paste widget script in footer on all pages.
3. Save and purge cache plugin plus CDN.
4. Set workspace settings such as hours, services, pricing ranges, and contact methods.
5. Test on desktop, incognito, and mobile.
6. Confirm with screenshots:
   - snippet placement
   - live widget on homepage
   - test request
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
- workflow goals
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
3. Verify script load and widget render.
4. Run test request flow.
5. If failure, rollback by removing snippet/plugin/tag and clearing cache.
6. Generate handover report with proof and rollback record.

### Post-install activation
Enable workflow loops:
- request capture
- unanswered follow-up
- data cleanup
- document extraction
- weekly reporting
- dormant lead reactivation

## 4) Security + Compliance Checklist (Practical)

- data minimization: store only contact and request metadata required for automation
- consent notice in chat form/footer
- no API keys in frontend snippets
- audit logs for install/update/rollback actions
- account separation per client/site/token
- rate limiting and abuse protection on public APIs
- do not store sensitive medical data or payment card details

## 5) Client Onboarding Assets

### Welcome email
Subject: Your AI workflow assistant is ready to launch

Hi {{ClientName}},

Your assistant is ready for {{Domain}}.

1. Add script snippet: {{WidgetScript}}
2. Complete settings: {{SettingsLink}}
3. Test in incognito/mobile and reply DONE

### Non-technical explainer
This assistant captures requests, follows up automatically, helps organise
incoming work, and reduces repetitive admin so your team can spend more time on
the work that matters.

### Troubleshooting checklist
- snippet installed on all pages
- no duplicate snippet
- cache/CDN purged
- mobile and incognito tested
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
- per-site settings, logs, and workflow schedules

## 7) Autonomous Task List

On every signup:
1. create client workspace
2. create site record
3. generate unique widget token
4. generate install package/snippet
5. queue onboarding tasks
6. run validation tests
7. schedule workflow automations
8. generate handover report

Implemented API routes:
- `POST /api/onboarding/intake`
- `POST /api/onboarding/run`
- `GET /api/onboarding/assets`
- `GET /api/widget/bootstrap.js`
