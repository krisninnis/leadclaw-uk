# Production Schema Verification

## 1. Table Inventory + RLS

| schema_name | table_name | relkind | ...
| auth | audit_log_entries | ...
...
| public | website_audits | ...

## 2. Targeted Drift Check

applications.plan PRESENT
clinics.owner_user_id PRESENT
...
widget_tokens.last_seen_domain PRESENT

## 3. Missing Tables Check

appointments PRESENT
clinic_settings PRESENT
outreach_log PRESENT

## 4. Production Column Inventory

| table_name | ordinal_position | column_name | ...
| agent_commands | 1 | id | ...
...

Generated: 2026-06-20
Environment: Production Supabase
Purpose: Static schema snapshot for repository reconciliation.
