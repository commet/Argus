-- Atomically enforce and record each user's outbound share limit.
-- The previous count-then-insert sequence raced under concurrent requests and
-- ignored database errors, allowing paid outbound channels to fail open.
create or replace function public.record_share_if_allowed(
  p_user_id uuid,
  p_channel text,
  p_target text default null,
  p_context text default null,
  p_limit integer default 50,
  p_scope_channel text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_limit < 1 or p_limit > 1000 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  if (
    select count(*)
    from public.share_log
    where user_id = p_user_id
      and created_at >= now() - interval '24 hours'
      and (p_scope_channel is null or channel = p_scope_channel)
  ) >= p_limit then
    return false;
  end if;

  insert into public.share_log (user_id, channel, target, context)
  values (
    p_user_id,
    left(p_channel, 40),
    case when p_target is null then null else left(p_target, 200) end,
    case when p_context is null then null else left(p_context, 100) end
  );

  return true;
end;
$$;

revoke all on function public.record_share_if_allowed(uuid, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.record_share_if_allowed(uuid, text, text, text, integer, text) to service_role;
