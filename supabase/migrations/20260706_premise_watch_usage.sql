-- Monthly investigation counter for the premise-watch cron (Workstream E4).
-- Server-only system state — NO user data, no user_id. The cron reads this month's
-- count to auto-stop before the founder's Brave/LLM spend runs away, and increments
-- it after each run. The cron degrades fail-open if this table is absent (the
-- per-run cap + PREMISE_WATCH_ENABLED kill-switch remain the hard floors), so
-- applying this migration only ADDS the automatic monthly brake.

create table if not exists public.premise_watch_usage (
  month text primary key,                      -- 'YYYY-MM'
  count integer not null default 0,            -- investigations (= Brave + LLM calls) this month
  updated_at timestamptz not null default now()
);

-- Not user data; only the service-role cron touches it. RLS on + no policies =
-- denied for anon/authenticated, allowed for service-role (which bypasses RLS).
alter table public.premise_watch_usage enable row level security;

comment on table public.premise_watch_usage is
  'Monthly investigation counter for the premise-watch cron (cost cap). Server-only; no user data.';
