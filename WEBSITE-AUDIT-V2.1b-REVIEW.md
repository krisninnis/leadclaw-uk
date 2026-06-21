# Website Audit V2.1b — Implementation Review

**Date:** 2026-06-19
**Scope:** Public free-audit lead magnet — `POST /api/audit/public`, `fetch-site.ts` SSRF guard, `leads-store.ts`, `audit_leads` migration, `public-report.ts`, `public-audit-widget.tsx`, `/free-audit`, and the V2.1b tests.
**Type:** Review only. No code was changed.

---

## 1. Verdict

V2.1b is a clean, well-isolated feature. The engine is reused rather than forked, the lead table is correctly locked to the service role, the email gate is enforced server-side (report is withheld if the lead write fails), and the SSRF guard is genuinely thoughtful — it validates the host, resolves DNS, checks *every* answer, and re-validates on every redirect hop. Output is rendered through React text nodes, so reflected target content is escaped (no XSS).

The headline risks are not in the happy path; they are in three places: **(1) a residual DNS-rebinding gap in the SSRF guard, (2) a spoofable + fail-open rate limit on an expensive unauthenticated endpoint, and (3) commercial loss — the full audit and any consent record are thrown away, so captured leads are weak.** None are blockers for a soft launch, but the first two should be closed before this is promoted broadly, and the third caps the feature's revenue value.

Severity legend: **S1** = fix before broad launch · **S2** = fix soon · **S3** = hardening / polish.

| # | Area | Finding | Severity |
|---|------|---------|----------|
| F1 | SSRF | DNS rebinding: validated IP ≠ connected IP (TOCTOU) | **S1** |
| F2 | Abuse | Rate limit keyed on spoofable `X-Forwarded-For`, leftmost hop | **S1** |
| F3 | Abuse | `checkRateLimit` fails **open** — limiter outage removes all throttling | **S1** |
| F4 | Commercial | Full audit result discarded; only score + text summary persisted; no `audit_id` on lead | **S2** |
| F5 | Compliance | No consent artifact (lawful basis / opt-in timestamp) stored with PII | **S2** |
| F6 | Abuse | No port allowlist — bot will fetch any public IP on any port | **S2** |
| F7 | Abuse | No bot/CAPTCHA defence + no email verification → junk leads, open page-fetch proxy | **S2** |
| F8 | Data model | No dedup/upsert — same email/URL inserts duplicate rows | **S2** |
| F9 | Reliability | No body-read timeout (slow-drip) + total fetch time can exceed function limit | **S2** |
| F10 | Reuse | No caching/reuse — every submit re-runs 3 live fetches | **S3** |
| F11 | SSRF | IPv6 checks are string-prefix based; a few mapped/embedded forms unhandled | **S3** |
| F12 | Tests | Rebinding, ports, redirect-to-lead, decimal-IP, dedup all untested | **S2** |

---

## 2. SSRF security

The guard (`fetch-site.ts`) is the strongest part of the feature. `assertPublicAuditTarget` rejects non-http(s), credentialed URLs, internal suffixes (`.local`, `.internal`, …), `localhost`/`0.0.0.0`, bare single-label hosts, and a thorough IPv4 private/reserved blocklist (`0/8`, `10/8`, CGNAT `100.64/10`, loopback, link-local `169.254`, `172.16-31`, the `192.0.x`/TEST-NET ranges, benchmark `198.18/19`, and everything `>= 224`). It resolves DNS with `{ all: true }` and blocks if *any* answer is private. Redirects use `redirect: "manual"` and re-run the full validation on each hop. The `revalidates redirects` test confirms a 302 to `127.0.0.1` is blocked after exactly one fetch. WHATWG URL parsing also neutralises decimal/hex/octal IP encodings (e.g. `http://2130706433`) by normalising them to dotted form before the IP check runs.

### F1 — DNS rebinding (TOCTOU) — **S1**
`assertPublicAuditTarget` resolves the hostname with the injected `resolver` and validates the returned IPs, then hands the **hostname URL** to `fetchImpl`, which performs its *own* DNS resolution inside undici. The address that was validated is not guaranteed to be the address that is connected to. An attacker controlling DNS for a host they own can answer the guard's lookup with a public IP and the fetch's lookup with `127.0.0.1` / `169.254.169.254` (short/zero TTL). The redirect revalidation has the same gap on every hop. This is the one finding that meaningfully undermines the otherwise solid guard.

*Direction (not implemented):* resolve once, then pin the connection to the validated literal IP — e.g. a custom undici dispatcher / `lookup` that returns the already-validated address while preserving the `Host` header and TLS SNI — so check-IP and connect-IP are identical.

### F6 — No port allowlist — **S2**
Validation covers host/IP but never the port. `http://<public-ip>:6379`, `:22`, `:3306`, `:8080`, etc. all pass. Internal IPs are blocked, but the bot will still connect to arbitrary services on arbitrary public IPs, which turns it into a port-prober/SSRF-to-public-service tool. Restricting to 80/443 (and the implicit default) would close this.

### F11 — IPv6 matching is textual — **S3**
`isBlockedIpv6` relies on string prefixes (`::`, `::1`, `/^f[cd]/`, `/^fe[89ab]/`, `ff`, `2001:db8:`) plus `mappedIpv4` for `::ffff:` forms. Canonical output from `URL`/DNS is handled, but it's fragile: `::ffff:0:0/96` (IPv4-translated), `64:ff9b::/96` (NAT64), and expanded/uncompressed forms aren't parsed into bytes. Low real-world risk because the WHATWG parser compresses literals and the system resolver returns canonical forms, but byte-level parsing would be more robust than prefix matching.

---

## 3. Abuse vectors

### F2 — Spoofable rate-limit key — **S1**
`getClientIp` returns `forwardedFor.split(",")[0]` — the **left-most** `X-Forwarded-For` entry. A client can set that header to a random value on every request, landing each call in a fresh limiter bucket and defeating the "3 per 10 min" cap entirely. On Vercel the trustworthy values are the right-most appended hop or `x-real-ip` (or `@vercel/functions` `ipAddress()`); the left-most is attacker-controlled. Because this limiter is the *only* thing standing between the public internet and an expensive, fetch-spawning endpoint, the bypass is high impact.

### F3 — Fail-open limiter — **S1**
`checkRateLimit` returns `true` on any limiter exception ("failing open"). Sensible for a cosmetic widget; risky here. If Upstash is unreachable or `UPSTASH_REDIS_REST_*` is unset (note `new Redis({...!})` — non-null assertions, so a missing env var yields a client that errors at call time), the public audit endpoint runs with **no throttling at all**, amplifying F1/F6/F9. This endpoint specifically warrants fail-closed (or a cheap in-memory fallback).

### F7 — No bot defence, no email verification — **S2**
The endpoint is unauthenticated with no CAPTCHA / proof-of-work / Turnstile, and email is validated only syntactically (`z.string().email()`), lower-cased, and stored. Consequences: (a) the bot will dereference any attacker-supplied public URL and reflect ~2 MB of it back as a "report," i.e. a lightweight fetch-proxy that attributes traffic to LeadClaw's IPs; (b) trivially scriptable junk/typosquat leads; (c) a third party's email can be entered (no verification), though no mail is sent so there's no bombing vector. At minimum, add a bot check and treat unverified leads as unverified in the CRM.

### Reputational note
The bot fetches the target's `/robots.txt` for *presence scoring* but does not honour its rules. Auditing arbitrary third-party sites on demand, ignoring robots, from LeadClaw IPs is a minor reputational/legal exposure worth a documented stance.

---

## 4. Lead capture flow

The flow is correct and the gate works: `runAudit` → `saveAuditLead` → only on a non-null lead is `buildPublicAuditReport` returned; a failed write returns 503 with no report (covered by test). Email is normalised to lowercase in both the route and the store. Schema validation (zod) rejects empty name / bad email before any work, and a 12 KB body cap is enforced.

Observations:

- **Cost precedes capture (by necessity).** The expensive 3-fetch `runAudit` runs *before* the lead is persisted (the summary needs the result). Combined with F2/F3 this means an attacker can burn audit cost without ever producing a usable lead. Acceptable given the data dependency, but it raises the stakes on the rate limit being real.
- **No verification / quality signal.** Nothing records whether the email is deliverable or the URL belongs to the submitter, so downstream sales can't distinguish a hot lead from noise.
- **`source` is hard-coded** to `"free_audit"` in both the migration default and the store, so the `source` column and its 1–80 length check carry no information yet. Fine as a forward hook, but currently dead.

---

## 5. Data model (`audit_leads`)

Strengths: RLS enabled; `anon`/`authenticated` revoked; service-role-only policy; sensible `CHECK` lengths; `gen_random_uuid()` PK; helpful indexes including `lower(email), created_at`. The "browser never touches this table" comment matches the implementation.

### F4 — The audit itself is discarded — **S2 (also the biggest commercial miss)**
Public audits are **never written to `website_audits`**. The lead row keeps only `audit_score` (int) and a one-line `audit_summary` string. There is **no `audit_id` / foreign key**, no stored category scores, no recommendations, no `website_url` normalisation beyond the result's origin. So when sales follows up, they see "Audit score 63/100. Top priorities: …" and cannot re-open the report the prospect saw, can't segment by category weakness, and can't show change-over-time if the prospect returns. The full `AuditResult` already exists in memory at save time — persisting it (or an `audit_id` reference) is the single highest-leverage data change.

### F5 — No consent artifact — **S2**
The table stores name + email (PII for marketing) with no consent boolean, no opt-in timestamp, no captured copy of the disclosure text, and no IP/user-agent for audit trail. The widget's microcopy ("captures an audit lead only… does not add you to an outreach sequence") is good disclosure, but nothing about that promise is *recorded* per-row. Given this codebase's existing PECR/consent sensitivity, a `consent`/`marketing_opt_in` + `captured_at` lawful-basis record is worth adding before these leads feed any outreach.

### F8 — No dedup — **S2**
The `lower(email), created_at` index signals dedup intent, but `saveAuditLead` always `INSERT`s — there's no unique constraint and no upsert. Repeat submissions (same person re-running, or scripted) accumulate duplicate rows. Either an upsert keyed on `(lower(email), website_url)` or a documented "every run is an event" model with dedup at read time.

Minor: `email` allows length 3–320 with no format `CHECK` (format is enforced only in the app-layer zod). `website_url` stores `result.websiteUrl` (the normalised origin), so the path the user entered is lost.

---

## 6. Audit reuse

Reuse is good at the *engine* layer (the public route calls the same `runAudit`/scorer as the authenticated flow, so behaviour can't drift) but absent at the *result* layer.

### F10 — No caching of audit results — **S3**
Every submission triggers a fresh `runAudit`: one homepage GET plus two aux GETs (`/robots.txt`, `/sitemap.xml`), each up to an 8 s timeout. There is no short-TTL cache keyed by normalised URL, so two people auditing the same popular site (or one person retrying) re-pay the full network cost and re-hit the target. A 10–15 minute cache by normalised origin would cut cost, smooth load on target sites, and make duplicate-lead handling easier. Public audits also don't reuse a recent authenticated `website_audits` row for the same origin, and vice-versa.

---

## 7. Conversion funnel

The funnel is the strongest *product* aspect and is a clear win over the old auth-gated audit. `/free-audit` has clean SEO metadata and canonical; the widget gates the report behind name/email, then reveals score ring → category cards → top-5 → full recommendations → full category breakdown with evidence → CTA. `shouldShowBookDemo(score < 80)` adapts the CTA: low scorers get **Book Demo** + **Start Free Trial**, healthy scorers get **Start Free Trial** only. Smooth-scroll to the report and `aria-live="polite"` are nice touches.

Weaknesses:

- **The "lock" is purely client-side theatre, but the data isn't leaked** — good. The real report only arrives in the POST response after capture. No server-rendered findings to scrape. (Confirmed: nothing sensitive in initial HTML.)
- **No result permalink / emailed copy.** Because nothing is persisted to a viewable record (F4) and no email is sent, the prospect cannot return to their report and the captured lead gets no follow-up email — a missed nurture touch at the exact moment of peak intent.
- **CTA depth is shallow.** A single `score < 80` threshold drives all messaging; the report doesn't translate the *specific* worst category into the pitch ("your Conversion score is 41 — here's how LeadClaw fixes that"), which is where this kind of tool converts.
- **No analytics events** on submit/success/CTA-click are visible in the widget, so funnel drop-off can't be measured (the app has PostHog + GA wired elsewhere).
- **Failed-fetch UX is honest but discouraging:** a site that times out still consumes a lead slot and shows a low/failed report; worth deciding whether to capture the lead at all on a hard fetch failure.

---

## 8. Test coverage

What exists is good and well-targeted: SSRF rejection of a dozen internal targets, private-DNS rejection, "any private answer" rejection, redirect-revalidation, the route's happy path, the lead-failure 503 gate, field validation, rate-limit 429, and the store's trim/normalise/insert shape. There is also a `public-audit-widget.test.tsx`.

### F12 — Missing tests — **S2**
Material gaps, roughly in priority order:

1. **DNS rebinding** — no test where the guard's lookup returns public but the connection would hit private (the actual F1 risk; the current test only covers the guard itself resolving private).
2. **Port allowlist** — no test asserting `:22` / `:6379` are rejected (and currently they wouldn't be).
3. **Redirect → lead** — the SSRF redirect test throws; there's no test that a *successful* multi-hop redirect produces a saved lead with the final origin.
4. **Encoded-IP inputs** — `http://2130706433`, `http://0x7f.0.0.1`, `http://[::ffff:127.0.0.1]` not asserted (parser likely handles them, but it's load-bearing and untested).
5. **Body cap / slow-drip** — `readCapped` truncation at 2 MB and timeout behaviour are unverified.
6. **Dedup** — no test pinning the "duplicate submissions" behaviour (because it isn't defined yet).
7. **Rate-limit key** — no test that distinct `X-Forwarded-For` values are/aren't treated as distinct clients (would have surfaced F2).
8. **Fail-open** — no test asserting what happens when the limiter throws.
9. **Widget** — worth confirming the test covers the error-path render and the `score >= 80` CTA branch.

---

## 9. Bugs & edge cases (consolidated)

- **F1 rebinding** and **F2 XFF spoof** are the two that are closest to "bug" rather than "hardening."
- **F9 — body read is not time-bounded.** The `AbortController` timer is cleared when `timedFetch` returns; `readCapped` then streams the body with no deadline. A server dribbling bytes under the 2 MB cap can hold the connection open well past 8 s. Separately, worst-case wall-clock (main 8 s + body + 2 aux) can exceed the platform function limit (no `maxDuration` is set in `vercel.json`), surfacing as an opaque 500 / lost lead on slow targets.
- **`httpsOk` edge:** `site.ok && (site.finalUrl ?? url).startsWith("https://")` — a site that 200s over http (or redirects https→http) is scored as not-HTTPS even when reachable; intended, but worth confirming against the `health/https` check's wording.
- **`getClientIp` "unknown" bucket:** when no IP headers are present, all callers share the literal key `"unknown"` — one shared limiter bucket (mostly a local/dev concern).
- **Redis client constfrom `!` env asserts:** missing Upstash env vars don't fail fast at boot; they fail at first `.limit()` call, which F3 then swallows.
- **`source` column is currently inert** (always `"free_audit"`).

No memory-safety, injection, or auth-bypass bugs were found; RLS and the service-role boundary are correct, and rendered output is escaped.

---

## 10. Commercial weaknesses (summary)

1. **Weak lead asset (F4).** Capturing an email but discarding the audit means the most valuable context — *what's wrong with their site* — never reaches sales in usable form. Persist the full result and link it to the lead.
2. **No moment-of-intent follow-up.** No emailed report, no permalink. The prospect is hottest the instant they see a low score; the feature currently does nothing with that moment beyond on-screen CTAs.
3. **Consent not recorded (F5).** Limits how these leads can lawfully be worked, and is a latent compliance liability for a UK outreach business.
4. **Cost/abuse exposure (F2/F3/F6/F10).** Each lead costs three live fetches with throttling that is both spoofable and fail-open and no caching — the unit economics and the abuse surface are coupled to the same weak control.
5. **Generic pitch.** The CTA doesn't weaponise the prospect's worst category, which is the highest-converting move a scored audit can make.

---

## 11. Suggested sequencing (no code written here)

1. **Close the two S1 abuse/security gaps:** pin DNS (F1) and fix the rate-limit key + make this endpoint fail-closed (F2/F3). Add a port allowlist (F6) in the same pass.
2. **Make the lead worth having:** persist the full audit and reference it from `audit_leads`, add a consent/opt-in record, and send/permalink the report (F4/F5).
3. **Add the missing tests** for rebinding, ports, encoded IPs, successful-redirect-to-lead, and dedup (F12).
4. **Then** dedup/upsert (F8), short-TTL result cache (F10), body-read timeout + `maxDuration` (F9), and category-specific CTA copy.

*End of review — no source files were modified.*
