-- Remote MCP OAuth hardening: RFC 8707 audience binding + rotating refresh tokens.
-- Raw access/refresh credentials are never persisted; only SHA-256 hashes.

alter table public.plugin_tokens
  add column if not exists resource text;

comment on column public.plugin_tokens.resource is
  'RFC 8707 target resource for audience-bound Remote MCP tokens. NULL means a legacy/local PAT.';

alter table public.argus_oauth_grants
  add column if not exists resource text;

create table if not exists public.argus_oauth_refresh_tokens (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  client_id       text not null references public.argus_oauth_clients(client_id) on delete cascade,
  -- SET NULL matters: the daily access-token sweep must not disconnect a dormant
  -- client whose rotating refresh credential is still valid.
  access_token_id uuid references public.plugin_tokens(id) on delete set null,
  family_id       uuid not null default gen_random_uuid(),
  token_hash      text not null unique,
  label           text,
  scope           text not null,
  resource        text not null,
  status          text not null default 'active'
                  check (status in ('active', 'rotated', 'revoked')),
  expires_at      timestamptz not null,
  consumed_at     timestamptz,
  last_used_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists argus_oauth_refresh_tokens_user_idx
  on public.argus_oauth_refresh_tokens (user_id, created_at desc);
create index if not exists argus_oauth_refresh_tokens_expiry_idx
  on public.argus_oauth_refresh_tokens (expires_at);
create index if not exists argus_oauth_refresh_tokens_access_idx
  on public.argus_oauth_refresh_tokens (access_token_id)
  where access_token_id is not null;
create index if not exists argus_oauth_refresh_tokens_family_idx
  on public.argus_oauth_refresh_tokens (family_id, created_at desc);

-- If a rotated token is ever presented again, the route marks the whole family
-- revoked. This trigger closes the race where the first request claimed the old
-- row but had not inserted its replacement when the replay was detected.
create or replace function public.guard_argus_refresh_family()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.argus_oauth_refresh_tokens
    where family_id = new.family_id and status = 'revoked'
  ) then
    raise exception 'refresh token family revoked' using errcode = '28000';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_argus_refresh_family_before_insert
  on public.argus_oauth_refresh_tokens;
create trigger guard_argus_refresh_family_before_insert
before insert on public.argus_oauth_refresh_tokens
for each row execute function public.guard_argus_refresh_family();

alter table public.argus_oauth_refresh_tokens enable row level security;

-- Settings may list connection metadata and revoke a connection. It must select
-- explicit metadata columns: token_hash is server material, not UI data.
create policy "Users can read own argus_oauth_refresh_tokens"
  on public.argus_oauth_refresh_tokens for select
  using ((select auth.uid()) = user_id);
create policy "Users can delete own argus_oauth_refresh_tokens"
  on public.argus_oauth_refresh_tokens for delete
  using ((select auth.uid()) = user_id);

comment on table public.argus_oauth_refresh_tokens is
  'Remote MCP OAuth rotating refresh credentials. Hash only; one active row per current connection generation.';
