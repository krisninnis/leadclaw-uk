# Production Schema Verification

## 1. Table Inventory + RLS

(paste first query result here)
| schema_name | table_name | relkind | ...
| auth | audit_log_entries | ...
...
| public | website_audits | ...

---

## 2. Targeted Drift Check

(paste second query result here)
applications.plan PRESENT
clinics.owner_user_id PRESENT
...
widget_tokens.last_seen_domain PRESENT

---

## 3. Missing Tables Check

(paste third query result here)
appointments PRESENT
clinic_settings PRESENT
outreach_log PRESENT

---

## 4. Production Column Inventory

(paste column inventory here)
| table_name | ordinal_position | column_name | ...
| agent_commands | 1 | id | ...
...

---

Generated: 2026-06-20
Environment: Production Supabase
Purpose: Static schema snapshot for repository reconciliation.
