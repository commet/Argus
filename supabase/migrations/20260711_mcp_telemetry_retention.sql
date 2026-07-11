-- MCP telemetry 90-day retention (창업자 확정 2026-07-11 — 정본 II-E).
--
-- mcp_telemetry는 익명 opt-in 운영 telemetry다 (20260709_mcp_telemetry.sql).
-- 익명이어도 무기한 보존은 약속 위반이다: SECURITY.md가 "90일 후 자동 삭제"를
-- 공시하므로, 그 공시를 사람이 기억해서 지키는 게 아니라 DB가 스스로 지키게
-- 한다 (pg_cron 일 1회 삭제 — 애플리케이션 코드 경로 없음, 잊힐 수 없음).
--
-- 사람이 나중에 수정할 때 알아야 할 것:
--  * 보존 기간을 바꾸려면 아래 interval '90 days' 하나만 바꾸고 이 마이그레이션을
--    다시 적용하면 된다 (unschedule → schedule이라 재실행 멱등).
--  * pg_cron 잡은 cron.job 테이블에서 확인: select * from cron.job;
--  * 수동 즉시 실행: delete from public.mcp_telemetry where created_at < now() - interval '90 days';

create extension if not exists pg_cron;

-- 재실행 멱등: 같은 이름의 기존 잡을 먼저 내리고 다시 건다.
do $$
declare
  jid bigint;
begin
  for jid in select jobid from cron.job where jobname = 'mcp-telemetry-retention-90d' loop
    perform cron.unschedule(jid);
  end loop;
end $$;

-- 매일 03:23 UTC — 트래픽 저점, 정각 러시 회피.
select cron.schedule(
  'mcp-telemetry-retention-90d',
  '23 3 * * *',
  $job$ delete from public.mcp_telemetry where created_at < now() - interval '90 days' $job$
);
