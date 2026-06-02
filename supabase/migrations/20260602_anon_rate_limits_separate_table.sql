-- Anonymous (IP-hash) rate limiting, separated from auth-bound rate_limits.
--
-- BUG FIXED: rate_limits.user_id has FK -> auth.users(id). The old
-- check_anon_rate_limit() inserted a synthetic UUID derived from the IP hash,
-- which never exists in auth.users, so every anon call raised FK violation
-- 23503. The function's "EXCEPTION WHEN OTHERS THEN RETURN false" swallowed it,
-- returning false -> route returned 429 needsLogin -> anonymous visitors got
-- 0 free calls instead of ANON_LIMIT (30). Authenticated path (real auth.uid)
-- was unaffected.
--
-- Fix: dedicated table with no FK, storing the IP hash as text directly.
-- rate_limits (auth, FK + ON DELETE CASCADE) is left untouched.

create table if not exists public.anon_rate_limits (
  ip_hash text not null,
  date date not null default current_date,
  count int not null default 0,
  primary key (ip_hash, date)
);

-- Only the SECURITY DEFINER function below touches this table; no direct
-- client access (RLS on, no policies).
alter table public.anon_rate_limits enable row level security;

create or replace function public.check_anon_rate_limit(p_ip_hash text, p_limit integer default 3)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  current_count int;
begin
  -- Route sends a 32-char hex slice; guard against empty/short input.
  if p_ip_hash is null or length(p_ip_hash) < 16 then
    return false;
  end if;

  -- Atomic upsert + cap check in one statement. No EXCEPTION swallow:
  -- real errors must surface (route logs + fails closed) instead of being
  -- silently turned into "quota exhausted".
  insert into anon_rate_limits (ip_hash, date, count)
  values (p_ip_hash, current_date, 1)
  on conflict (ip_hash, date)
  do update set count = anon_rate_limits.count + 1
  where anon_rate_limits.count < p_limit
  returning count into current_count;

  -- No row returned -> daily limit already reached.
  return current_count is not null;
end;
$function$;

grant execute on function public.check_anon_rate_limit(text, integer) to anon, authenticated, service_role;
