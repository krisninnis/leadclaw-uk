alter table public.lead_finder_runs
  add column if not exists execution_mode text null,
  add column if not exists external_run_id text null,
  add column if not exists external_url text null,
  add column if not exists queued_at timestamptz null;

alter table public.lead_finder_runs
  drop constraint if exists lead_finder_runs_execution_mode_check;

alter table public.lead_finder_runs
  add constraint lead_finder_runs_execution_mode_check
  check (execution_mode is null or execution_mode in ('local', 'github_actions'));

create index if not exists lead_finder_runs_execution_mode_idx
  on public.lead_finder_runs (execution_mode, created_at desc);
