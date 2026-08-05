-- 원격 MCP 서버 원장 (기획서 ARGUS-REMOTE-MCP-PLAN-2026-08-05 §5)
--
-- 파일럿 전용·폐기 전제 테이블 셋. v1.0 §15.5의 pilot harness 예외 안에서만
-- 존재한다: 기존 canonical schema(projects/personas/…)는 건드리지 않고, 이
-- 세 테이블만으로 완결되며, 파일럿 종료 시 통째로 drop 가능하다.
--
-- 설계: argus_events 가 정본이고 나머지 둘은 그로부터 fold 가능한 캐시다
-- (하네스의 이벤트 소싱 구조를 서버에 그대로 옮긴다). 그래서 events 는
-- append-only 이며 UPDATE/DELETE 권한을 주지 않는다 — "나중 사실은 덧붙고,
-- 이전에 믿었던 것을 고치지 않는다"(§AUTHORITY)가 DB 층에서도 참이어야 한다.

-- ── 결정 하나 = 행 하나 ────────────────────────────────────────────────────
create table if not exists public.argus_cases (
  id            text primary key,               -- 하네스의 caseId
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text,                           -- 사용자 표현의 결정 질문
  state         text not null default 'OPEN',   -- 하네스 CasePhaseState의 사본
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists argus_cases_user_idx on public.argus_cases (user_id, updated_at desc);

-- ── append-only 원장 ──────────────────────────────────────────────────────
create table if not exists public.argus_events (
  id            text primary key,               -- 하네스가 생성한 이벤트 id
  case_id       text not null references public.argus_cases(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  type          text not null,                  -- LedgerEvent['type']
  at            timestamptz not null,           -- 이벤트가 말하는 시각
  payload       jsonb not null,                 -- 이벤트 본문 전체
  created_at    timestamptz not null default now()
);
create index if not exists argus_events_case_idx on public.argus_events (case_id, at);
create index if not exists argus_events_user_idx on public.argus_events (user_id, created_at desc);

-- ── 귀환 계약 (크론이 읽는 유일한 테이블) ────────────────────────────────
create table if not exists public.argus_returns (
  id            uuid primary key default gen_random_uuid(),
  case_id       text not null references public.argus_cases(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  kind          text not null,                  -- commitment | signal | outcome | learning
  due_at        timestamptz not null,           -- 이 날짜에 서버가 먼저 찾아간다
  from_step     text,                           -- 어느 계획 단계에서 나왔는지
  status        text not null default 'armed',  -- armed | sent | completed | dropped
  sent_at       timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
-- 크론의 주 질의: "지금 만기이고 아직 안 보낸 것"
create index if not exists argus_returns_due_idx on public.argus_returns (status, due_at)
  where status = 'armed';
create index if not exists argus_returns_user_idx on public.argus_returns (user_id, due_at);

-- ── RLS: 자기 데이터만 ───────────────────────────────────────────────────
alter table public.argus_cases   enable row level security;
alter table public.argus_events  enable row level security;
alter table public.argus_returns enable row level security;

drop policy if exists argus_cases_own on public.argus_cases;
create policy argus_cases_own on public.argus_cases
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- events 는 읽기와 삽입만. 수정·삭제 정책을 만들지 않는 것이 곧 append-only 강제다.
drop policy if exists argus_events_read on public.argus_events;
create policy argus_events_read on public.argus_events
  for select using (auth.uid() = user_id);
drop policy if exists argus_events_insert on public.argus_events;
create policy argus_events_insert on public.argus_events
  for insert with check (auth.uid() = user_id);

drop policy if exists argus_returns_own on public.argus_returns;
create policy argus_returns_own on public.argus_returns
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

comment on table public.argus_cases is
  'R3-B 원격 MCP 파일럿 — 결정 케이스. 파일럿 전용·폐기 가능 (v1.0 §15.5).';
comment on table public.argus_events is
  'R3-B 원격 MCP 파일럿 — append-only 원장. 정본이며 UPDATE/DELETE 정책이 의도적으로 없다.';
comment on table public.argus_returns is
  'R3-B 원격 MCP 파일럿 — 귀환 계약. 크론이 due_at 기준으로 먼저 찾아간다.';
