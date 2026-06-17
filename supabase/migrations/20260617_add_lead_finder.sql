create table if not exists public.lead_finder_configs (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Default Lead Finder',
  niche_mode text not null check (niche_mode in ('clinic', 'local-service', 'custom')),
  niches text[] not null default '{}',
  locations text[] not null default '{}',
  lead_limit integer not null default 25 check (lead_limit between 1 and 200),
  discover_emails boolean not null default true,
  email_discovery_max_pages integer not null default 7 check (email_discovery_max_pages between 1 and 7),
  dry_run boolean not null default true,
  schedule_enabled boolean not null default false,
  run_time_local time not null default '09:00',
  timezone text not null default 'Europe/London',
  created_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create index if not exists lead_finder_configs_updated_at_idx
  on public.lead_finder_configs (updated_at desc);

create table if not exists public.lead_finder_runs (
  id uuid primary key default gen_random_uuid(),
  config_id uuid null references public.lead_finder_configs(id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  trigger_source text not null default 'manual' check (trigger_source in ('manual', 'scheduled')),
  dry_run boolean not null default true,
  config_snapshot jsonb not null default '{}'::jsonb,
  summary jsonb not null default '{}'::jsonb,
  stdout text null,
  stderr text null,
  exit_code integer null,
  error text null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  created_by uuid null,
  created_at timestamptz not null default now()
);

create index if not exists lead_finder_runs_created_at_idx
  on public.lead_finder_runs (created_at desc);

create index if not exists lead_finder_runs_status_idx
  on public.lead_finder_runs (status, created_at desc);

alter table public.lead_finder_configs enable row level security;
alter table public.lead_finder_runs enable row level security;

comment on table public.lead_finder_configs is
  'Admin-only Lead Finder scraper configuration. Accessed through service-role protected routes.';

comment on table public.lead_finder_runs is
  'Admin-only Lead Finder scraper run history. Accessed through service-role protected routes.';
