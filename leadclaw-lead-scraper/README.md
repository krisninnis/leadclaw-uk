# LeadClaw Lead Scraper

Safe Google Places lead discovery for LeadClaw.

This scraper only discovers/imports public business leads. It does not enrich
emails, generate final outreach eligibility, or send emails. App-side enrichment
and compliance backfill remains in `leadclaw-uk` via:

```text
POST /api/outreach/backfill
```

## Repository status

In this workspace the scraper is an internal folder under `leadclaw-uk`, not an
active git submodule. The root `.gitmodules` file is empty. Treat this folder as
reviewable application tooling unless it is deliberately moved back to a
separate repository/submodule later.

## Safety rules

- Dry-run is the default.
- Default niche mode is clinic-only.
- Broader local-service scraping requires explicit `--niche-mode local-service`
  or explicit `--niches`.
- No outreach emails are sent by this scraper.
- Website email discovery is disabled by default and only runs with
  `--discover-emails`.
- Email discovery only checks a tiny fixed set of same-domain public pages and
  only collects visible business contact emails.
- Email discovery skips social profiles, booking platforms, and directory
  listings before making website page requests.
- No Supabase service-role key is required by this scraper.
- Live import uses the app endpoint and `LEAD_IMPORT_TOKEN`.
- Leads with missing company names, invalid websites, or platform-only websites
  are skipped before import.
- In-run duplicate prevention uses website, then email, then company+city.

## Required environment variables

For dry-run plan-only mode, no env vars are required.

For Google Places discovery:

```text
GOOGLE_PLACES_API_KEY=
```

For live import:

```text
LEAD_IMPORT_TOKEN=
LEADCLAW_IMPORT_URL=https://www.leadclaw.uk/api/leads/import
```

`LEAD_IMPORT_TOKEN` must match the app-side Vercel environment variable of the
same name. Do not use or expose Supabase service-role keys in this scraper.

## Dry-run commands

Plan only, no Google API key required:

```powershell
python .\leadclaw-lead-scraper\places_batch.py --dry-run --limit 5
```

Clinic-only discovery dry-run:

```powershell
$env:GOOGLE_PLACES_API_KEY="..."
python .\leadclaw-lead-scraper\places_batch.py --dry-run --limit 5 --niche-mode clinic --locations London
```

Broader local-service discovery dry-run:

```powershell
$env:GOOGLE_PLACES_API_KEY="..."
python .\leadclaw-lead-scraper\places_batch.py --dry-run --limit 5 --niche-mode local-service --locations Leeds Bristol
```

Explicit niche dry-run:

```powershell
$env:GOOGLE_PLACES_API_KEY="..."
python .\leadclaw-lead-scraper\places_batch.py --dry-run --limit 5 --niche-mode custom --niches plumber electrician --locations Leeds
```

Clinic dry-run without website email discovery:

```powershell
$env:GOOGLE_PLACES_API_KEY="..."
py .\leadclaw-lead-scraper\places_batch.py --dry-run --limit 5 --niche-mode clinic --locations Nottingham
```

Clinic dry-run with opt-in website email discovery:

```powershell
$env:GOOGLE_PLACES_API_KEY="..."
py .\leadclaw-lead-scraper\places_batch.py --dry-run --limit 5 --niche-mode clinic --locations Nottingham --discover-emails
```

Email discovery defaults:

- disabled unless `--discover-emails` is passed
- maximum pages per domain: `3`
- timeout per website request: `5` seconds
- delay between website page requests: `0.5` seconds
- pages checked by default, in order: homepage, `/contact`, `/contact-us`
- additional safe paths available when the max is deliberately increased:
  `/about`, `/about-us`, `/team`, `/get-in-touch`
- extraction sources: `mailto:` links, JSON-LD email fields, contact links,
  footer content, then visible page text
- preferred emails: `info@`, `hello@`, `contact@`, `enquiries@`, `office@`,
  `reception@`
- accepted fallback emails include `team@`, `admin@`, and firstname-style
  addresses when no stronger role address is visible

## Live import command

Start tiny and review the imported leads before backfilling enrichment:

```powershell
$env:GOOGLE_PLACES_API_KEY="..."
$env:LEAD_IMPORT_TOKEN="..."
$env:LEADCLAW_IMPORT_URL="https://www.leadclaw.uk/api/leads/import"
python .\leadclaw-lead-scraper\places_batch.py --live --limit 5 --niche-mode clinic --locations London
```

Tiny live import with opt-in website email discovery:

```powershell
$env:GOOGLE_PLACES_API_KEY="..."
$env:LEAD_IMPORT_TOKEN="..."
$env:LEADCLAW_IMPORT_URL="https://www.leadclaw.uk/api/leads/import"
py .\leadclaw-lead-scraper\places_batch.py --live --limit 5 --niche-mode clinic --locations Nottingham --discover-emails
```

## Run app-side enrichment after import

Dry-run backfill first:

```powershell
curl.exe -X POST https://www.leadclaw.uk/api/outreach/backfill `
  -H "Authorization: Bearer $env:OUTREACH_RUN_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"limit\":50}"
```

Apply after reviewing output:

```powershell
curl.exe -X POST https://www.leadclaw.uk/api/outreach/backfill `
  -H "Authorization: Bearer $env:OUTREACH_RUN_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"apply\":true,\"limit\":25}"
```

The backfill endpoint still does not send emails.

## GitHub Actions usage

Use the manual `Lead Scraper` workflow. Defaults:

- `dry_run=true`
- `limit=5`
- `niche_mode=clinic`
- `locations=London`
- `discover_emails=false`

Required secrets for discovery:

```text
GOOGLE_PLACES_API_KEY
```

Required secrets for live import:

```text
LEAD_IMPORT_TOKEN
LEADCLAW_IMPORT_URL
```

Do not add a scheduled scraper trigger until dry-run and tiny live imports have
been reviewed.

## Niche modes

`clinic`:

- `beauty`
- `dental`

`local-service`:

- `plumber`
- `electrician`
- `heating`
- `roofer`
- `garage`
- `estate_agent`

`custom`:

- requires explicit `--niches`

Niche queries are defined in `niches.json` and loaded by `niche_config.py`.
