-- ARGUS TWIN Phase 4 — 범위 위임 (신뢰 사다리의 마지막 칸).
--
-- 기획서 §4.5 의 불변식을 **스키마로** 못박는다. 위임은 이 제품에서 가장
-- 위험한 표면이므로(기계가 사람의 판단 자리에 가장 가까이 가는 곳), 규칙을
-- 코드에만 두지 않는다:
--
-- 1. `policy` 는 **사용자가 쓴 문장**이다. `user_words` 에 사용자의 원문 인용이
--    not null 로 들어간다 — 인용 없이는 행이 존재할 수 없다. AI 가 추출한
--    프로필 항목이 조용히 위임으로 승격되는 경로를 스키마가 막는다
--    (그것이 "저자성에 거짓말하지 않는다"의 이 표면에서의 형태다).
-- 2. `expires_at` 은 **not null**. 영원한 위임은 없다 — 사람은 변하고, 만료가
--    없으면 3년 전의 나에게 오늘의 결정을 넘기는 것이 된다.
-- 3. 위임은 **채점된다.** applications/supported/contradicted 가 귀환 정산으로
--    갱신되고, 어긋남이 임계를 넘으면 status='suspended' 로 스스로 멈춘다.
--    자기 성적으로 자기를 정지시키는 위임 — 이것이 이 제품이 위임을 다루는
--    방식이고, 우리가 아는 한 다른 어디에도 없다.
-- 4. 집행 흔적은 케이스에 남는다 (`argus_cases.delegation_id`) — 어떤 결정이
--    위임으로 내려졌는지 사후에 셀 수 있어야 정산도 철회도 의미가 있다.

create table if not exists public.argus_delegations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  -- 사용자가 승인한 정책 문장. "이 조건에서는 이렇게 한다".
  policy          text not null,
  -- 적용 범위. domain 은 결정론 사전 필터, condition 은 사용자의 말로 된 조건.
  scope_domain    text not null,
  scope_condition text not null,
  -- 위임을 만든 근거. 사용자가 실제로 말한 문장을 그대로 — 이것이 저자성의 증거다.
  user_words      text not null,
  -- 위임이 태어난 채택. 위임은 진공에서 생기지 않는다.
  created_from_case_id text references public.argus_cases(id) on delete set null,
  expires_at      timestamptz not null,
  -- active = 살아 있음, suspended = 성적으로 자동 정지, revoked = 사용자가 철회.
  -- 철회와 정지를 구분한다: 정지는 기계가 한 것이므로 사용자가 되살릴 수 있고,
  -- 철회는 사용자가 한 것이므로 기계가 되살리지 않는다.
  status          text not null default 'active'
                  check (status in ('active', 'suspended', 'revoked')),
  suspended_reason text,
  -- 성적. 이 셋은 귀환 정산이 갱신한다.
  applications    integer not null default 0 check (applications >= 0),
  supported       integer not null default 0 check (supported >= 0),
  contradicted    integer not null default 0 check (contradicted >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists argus_delegations_user_idx
  on public.argus_delegations (user_id, status);

-- 어떤 결정이 위임으로 내려졌는가. null 이 기본이고, 그것이 정상이다.
alter table public.argus_cases
  add column if not exists delegation_id uuid references public.argus_delegations(id) on delete set null;

comment on column public.argus_cases.delegation_id is
  'TWIN Phase 4 — 이 결정이 적용한 위임. 귀환 정산이 이것으로 위임을 채점한다.';

alter table public.argus_delegations enable row level security;

-- 본인 읽기·철회 가능. 생성은 service role 만 (MCP 채택 경로에서만 태어난다) —
-- 브라우저에서 직접 insert 할 수 있으면 "명시적 채택 행위로만 생긴다"가 깨진다.
drop policy if exists argus_delegations_own_read on public.argus_delegations;
create policy argus_delegations_own_read on public.argus_delegations
  for select using (auth.uid() = user_id);

drop policy if exists argus_delegations_own_update on public.argus_delegations;
create policy argus_delegations_own_update on public.argus_delegations
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- **RLS 만으로는 부족하다.** 위 정책은 "본인 행"만 제한할 뿐 어느 컬럼을
-- 고치는지는 보지 않으므로, 브라우저에서 `policy` 를 다시 쓰거나 `expires_at`
-- 을 2099년으로 밀거나 `contradicted` 를 0 으로 되돌릴 수 있다. 그러면 이
-- 테이블이 지키기로 한 것 셋이 한꺼번에 무너진다: 사용자 원문과 정책의 일치 ·
-- 만료의 실재 · **성적으로 스스로 멈추는 안전장치**. (RLS 의 WITH CHECK 는 OLD
-- 행을 볼 수 없어 "이 컬럼은 그대로여야 한다"를 표현할 수 없다.)
--
-- 컬럼 단위 권한이 그것을 정확히 표현한다. 사용자가 브라우저에서 바꿀 수 있는
-- 것은 **status 하나** — 철회와 재개, 즉 되돌리기뿐이다. 나머지는 정산 경로
-- (service role)만 쓴다. 되돌리기는 가장 쉬워야 하고, 성적 조작은 불가능해야 한다.
revoke update on public.argus_delegations from authenticated;
grant update (status) on public.argus_delegations to authenticated;

drop policy if exists argus_delegations_own_delete on public.argus_delegations;
create policy argus_delegations_own_delete on public.argus_delegations
  for delete using (auth.uid() = user_id);

comment on table public.argus_delegations is
  'TWIN Phase 4 — 범위 위임. 사용자 원문 인용 필수, 만료 필수, 성적으로 자동 정지.';
