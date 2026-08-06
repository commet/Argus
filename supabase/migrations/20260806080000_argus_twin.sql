-- ARGUS TWIN — 판단 분신 (기획서 ARGUS-TWIN-PLAN-2026-08-06 부록 A).
--
-- 테이블 4개가 각자 다른 신뢰 규칙을 갖는다:
--
-- 1. argus_shadow_predictions — 봉인 예측. **RLS on + 정책 0 = service role 전용.**
--    사용자 본인도 정산 전에는 못 읽는다 — 자기 예측을 미리 보면 봉인이 무의미
--    해진다 (§7.3 관찰 우선의 기계 쌍둥이). 전문은 여기, 해시는 원장 이벤트로.
-- 2. argus_profile_items — 판단 프로필. 본인 read/delete 허용 (프로필은 편집
--    가능한 거울이어야 한다). 증거 없는 항목은 애초에 삽입되지 않는다 (CHECK).
-- 3. argus_simulation_runs — 극장 산출물. 본인 read. **등급 라벨 not null** —
--    라벨 없는 시뮬 출력은 저장 자체가 불가능하다 (허구가 사실로 위장 금지).
-- 4. argus_case_bank — 결과가 이미 나온 공개 사례. 전역(user_id 없음), 쓰기는
--    service role 만. 콜드스타트용 엄밀 채점 트랙.

-- ── 1. 봉인 예측 ─────────────────────────────────────────────────────────
create table if not exists public.argus_shadow_predictions (
  id              uuid primary key default gen_random_uuid(),
  case_id         text not null references public.argus_cases(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  -- 무엇을 예측했는가. outcome = 현실이 뭐라 답할지 (주 지표).
  -- choice = 사용자가 뭘 고를지 (lean 부재 시에만 유효한 match 채점).
  -- deviation = 사용자가 밝힌 lean 에서 이탈할지 (lean 존재 시의 비자명 예측).
  target          text not null check (target in ('outcome', 'choice', 'deviation')),
  -- 반증 가능한 기대 문장 — "무엇이 보이면 이 예측이 틀린 것인가"가 문장 안에
  -- 있어야 한다. 자유 서술에 소수점 성적을 붙이는 LLM-glue 함정의 방지선.
  expectation     text not null,
  reasoning       text not null,
  confidence      real not null check (confidence >= 0 and confidence <= 1),
  -- open 입력에 사용자의 lean 이 있었는가. 있었으면 choice 예측은 오염이며
  -- match rate 에서 제외된다 (PRD 반박 1).
  contaminated_by_lean boolean not null default false,
  -- 실제 사용된 모델 — 모델이 바뀌면 성적 비교가 오염되므로 층화 채점용.
  model_id        text not null,
  -- 봉인 내용의 sha256. 공개 시점에 재계산 대조를 통과해야 공개된다.
  -- (원장 이벤트로 앵커하려던 초안은 폐기 — reducer 가 모르는 이벤트 타입을
  -- 만나면 조용히 undefined 상태가 되는 것을 시공 중 확인했다. 하네스는
  -- Track R 영역이라 오늘 확장하지 않는다. PRD 부록 A 이탈 기록 참조.)
  content_hash    text not null,
  sealed_at       timestamptz not null default now(),
  -- 정산 때만 채워진다. revealed_at 이 null 인 행은 어떤 사용자 표면에도
  -- 나가지 않는다 (코드 가드 + RLS 정책 부재의 이중 방어).
  revealed_at     timestamptz,
  -- 3치 판정. indeterminate 는 채점 모수에서 제외 — 정직한 공백.
  verdict         text check (verdict in ('supported', 'contradicted', 'indeterminate')),
  verdict_quote   text,          -- 판정의 근거로 인용한 관찰 문장 (판정 시 필수)
  -- sealed = 봉인 완료, late = 채택이 봉인보다 빨랐음(match 채점 제외),
  -- revealed = 정산 공개 완료. "생성 대기" 상태는 없다 — 행은 봉인과 함께만
  -- 태어난다 (내용 없는 행이 있으면 expectation not null 이 거짓말이 된다).
  -- 생성 실패의 재시도는 크론이 "그림자 없는 최근 케이스"를 스캔해서 한다.
  status          text not null default 'sealed'
                  check (status in ('sealed', 'late', 'revealed')),
  created_at      timestamptz not null default now()
);
create index if not exists argus_shadow_case_idx on public.argus_shadow_predictions (case_id);

-- ── 2. 판단 프로필 ───────────────────────────────────────────────────────
create table if not exists public.argus_profile_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  -- L1 = 가치·기준, L2 = 믿음·보정, L3 = 정책 (조건→행동)
  layer           text not null check (layer in ('L1', 'L2', 'L3')),
  domain          text not null default 'general',
  content         text not null,
  -- 증거는 정산된 케이스 id 만 (극장 산출물 금지 — 분신이 자기 상상을 배우면
  -- 안 된다). 실존·정산 여부는 결정론 층이 삽입 전 검증한다.
  -- cardinality() 를 쓴다: array_length 는 빈 배열에 NULL 을 돌려주고
  -- CHECK 는 NULL 을 통과시켜 빈 증거가 새어 들어온다 (20260806090000 에서 교정).
  evidence_case_ids text[] not null check (cardinality(evidence_case_ids) >= 1),
  confidence      real not null check (confidence >= 0 and confidence <= 1),
  counterexamples text[] not null default '{}',
  -- ai_extracted = 추출 파이프라인이 만듦, user_edited = 사용자가 고침.
  provenance      text not null default 'ai_extracted'
                  check (provenance in ('ai_extracted', 'user_edited')),
  status          text not null default 'active' check (status in ('active', 'retired')),
  expires_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists argus_profile_user_idx on public.argus_profile_items (user_id, status);

-- ── 3. 극장 산출물 ───────────────────────────────────────────────────────
create table if not exists public.argus_simulation_runs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  -- untaken = 가지 않은 길, case_bank = 공개 사례 채점, distant = 먼 케이스
  source          text not null check (source in ('untaken', 'case_bank', 'distant')),
  -- 라벨이 곧 신뢰 등급이다. graded = 실결과로 채점됨, prediction = 예측,
  -- fiction = 허구(가지 않은 길 재생). not null — 무라벨 저장 불가.
  grade_label     text not null check (grade_label in ('graded', 'prediction', 'fiction')),
  source_ref      text,          -- untaken: case_id / case_bank: bank id
  content         text not null,
  -- case_bank 채점 시에만: 분신의 선택이 실제 결과와 맞았는가 + Brier 성분
  correct         boolean,
  brier_component real,
  model_id        text not null,
  created_at      timestamptz not null default now()
);
create index if not exists argus_sim_user_idx on public.argus_simulation_runs (user_id, created_at desc);

-- ── 3.5 기각 대안 투영 ───────────────────────────────────────────────────
-- "가지 않은 길" 재생의 재료. 원장에는 채택 카드의 rationale 안에 있지만,
-- 극장 크론이 사용자 10명 × 케이스 전부의 원장을 fold 하면 그것이 주간
-- 배치의 지연이 된다 (argus_cases 투영 넷과 같은 캐시 규칙). 정산 시점에
-- 한 번 투영한다.
alter table public.argus_cases
  add column if not exists rejected_alternative text;

comment on column public.argus_cases.rejected_alternative is
  'TWIN — 채택 때 사용자가 버린 대안. 극장의 "가지 않은 길" 재생 재료. 원장에서 재생 가능한 캐시.';

-- ── 4. resolved case bank (전역) ─────────────────────────────────────────
create table if not exists public.argus_case_bank (
  id              text primary key,
  domain          text not null,
  situation       text not null,             -- 결정 시점에 알 수 있던 것만
  options         jsonb not null,            -- [{key, label}]
  outcome_key     text not null,             -- 실제로 일어난 쪽
  outcome_note    text not null,             -- 무슨 일이 있었나
  source_url      text not null,             -- 출처 없는 사례는 넣지 않는다
  created_at      timestamptz not null default now()
);

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table public.argus_shadow_predictions enable row level security;
alter table public.argus_profile_items      enable row level security;
alter table public.argus_simulation_runs    enable row level security;
alter table public.argus_case_bank          enable row level security;

-- shadow: 정책 없음 = service role 전용. 본인도 정산 전 조회 불가가 설계다.
-- case_bank: 읽기는 공개(전역 사례), 쓰기는 service role 만.
drop policy if exists argus_case_bank_read on public.argus_case_bank;
create policy argus_case_bank_read on public.argus_case_bank for select using (true);

drop policy if exists argus_profile_own_read on public.argus_profile_items;
create policy argus_profile_own_read on public.argus_profile_items
  for select using (auth.uid() = user_id);
drop policy if exists argus_profile_own_delete on public.argus_profile_items;
create policy argus_profile_own_delete on public.argus_profile_items
  for delete using (auth.uid() = user_id);

drop policy if exists argus_sim_own_read on public.argus_simulation_runs;
create policy argus_sim_own_read on public.argus_simulation_runs
  for select using (auth.uid() = user_id);

comment on table public.argus_shadow_predictions is
  'TWIN — 봉인 예측. service role 전용(정책 0). 해시는 argus_events 로, 정산 전 공개 금지.';
comment on table public.argus_profile_items is
  'TWIN — 판단 프로필. 증거(정산 케이스) 없는 항목은 CHECK 로 차단. 편집 가능한 거울.';
comment on table public.argus_simulation_runs is
  'TWIN — 시뮬레이션 극장 산출물. 등급 라벨 not null — 허구가 사실로 위장 못 한다.';
comment on table public.argus_case_bank is
  'TWIN — 결과가 이미 나온 공개 사례 (콜드스타트 엄밀 채점 트랙). 출처 필수.';
