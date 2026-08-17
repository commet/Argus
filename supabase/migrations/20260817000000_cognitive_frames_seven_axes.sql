-- 인지 구조 기록 (재정초 브리프 원형 E+B 하이브리드의 일곱 축 일반화).
-- 적용 완료: 2026-08-17, overture-db (sckixrzwqntynsisgcdx).
--
-- 설계 근거는 src/lib/cognition/axes.ts 의 문헌 주석에 있다. 스키마에서 지켜야
-- 하는 것 셋:
--   1. 봉인 후 element.body 불변 (P1 빈티지 보존) — 트리거로 강제한다.
--      산문 규칙은 지켜지지 않는다는 것을 이 저장소가 소급 측정으로 확인했다
--      (기계가 검사하지 않는 규약의 준수율 90%, n=60).
--   2. world 는 파생값 — crossings 가 비면 in_frame 이어야 한다. CHECK 로 잠근다.
--      "곧 확인할 것이다"는 현실 접촉이 아니다.
--   3. RLS 는 (select auth.uid()) 형태 — 행마다 함수를 재평가하지 않게.
--
-- 실DB 불변식 시험 (2026-08-17, 4/4 양방향 정상):
--   증거 없는 reality_contact  → CHECK 가 거부      ✓
--   증거 있는 reality_contact  → 정상 통과 (위양성 0) ✓
--   봉인 후 body 수정          → TRIGGER 가 거부     ✓
--   봉인 후 재진술 추가        → 정상 허용 (body만 잠긴다) ✓

create table if not exists public.cognitive_frames (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null default '',
  status text not null default 'drafting'
    check (status in ('drafting','comprehension_pending','sealed','settled')),
  -- 봉인된 확신도. resolvable=false 면 채점 분모에서 빠진다 (calibration.ts).
  confidence_value smallint check (confidence_value is null or (confidence_value between 0 and 100)),
  confidence_about_element_id uuid,
  confidence_resolvable boolean,
  confidence_resolvable_reason text,
  -- 정산.
  settled_falsifier_observed boolean,
  settled_observed text,
  settled_evidence_ref text,
  settled_observed_at timestamptz,
  -- 회고는 저장되지만 원문을 덮지 않는다 (M1: 사후확신은 경고로 줄지 않는다 —
  -- Fischhoff 1977. 유일하게 듣는 처방은 당시 기록의 보존이다).
  settled_retrospective text,
  sealed_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cognitive_frame_elements (
  id uuid primary key default gen_random_uuid(),
  frame_id uuid not null references public.cognitive_frames(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  axis text not null
    check (axis in ('frame','values','premises','inference','confidence','alternatives','falsifier')),
  body text not null default '',
  -- 저자성: 정본 어휘를 그대로 (stores/types.ts JudgmentAttribution).
  authored text not null default 'user' check (authored in ('user','ai_surfaced')),
  wording_source text not null default 'user_direct'
    check (wording_source in ('user_direct','user_reworded','ai_surfaced','imported','legacy_unknown')),
  -- 편집 깊이. E-0 발견 2: 'AI가 썼다'가 아니라 'AI가 썼는데 손대지 않았다'가 위험.
  revision_distance numeric(6,4) not null default 1 check (revision_distance between 0 and 1),
  revision_rounds smallint not null default 0 check (revision_rounds >= 0),
  -- 두 세계. crossings 가 비어 있으면 in_frame 이어야 한다 (자기선언 금지).
  world text not null default 'in_frame' check (world in ('in_frame','reality_contact')),
  crossings jsonb not null default '[]'::jsonb,
  constraint world_requires_crossing check (
    world = 'in_frame' or jsonb_array_length(crossings) > 0
  ),
  -- 이해 재진술 게이트 (이 프로젝트가 문헌에 보태는 부분 — 출처 태깅은 이 실패를
  -- 막지 못한다. E-0: 하중 개념구 11/11 AI 발원 + 같은 92턴에 이해 거부 12건).
  comprehension_state text not null default 'not_required'
    check (comprehension_state in ('own_words','echo','absent','not_required')),
  comprehension_restatement text not null default '',
  comprehension_overlap numeric(6,4) not null default 0 check (comprehension_overlap between 0 and 1),
  comprehension_echo_threshold numeric(6,4) not null default 0.6,
  -- 전제 축의 신호 결박. 임계는 근거와 함께만 존재한다 (모든 탐지기의 임계는
  -- 검증 불가능한 사전 믿음이다 — Chow→Bai-Perron, CUSUM, ADWIN 전부).
  bindings jsonb not null default '[]'::jsonb,
  -- 덮어쓰기 대신 잇는다.
  supersedes uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 신호 판독 원장. append-only — unread 도 남는다 (읽지 못한 사실 자체가 기록이고,
-- 판독 실패를 '이상 없음'으로 처리하면 센서가 켜져 있다는 사실이 거짓 안심이 된다).
create table if not exists public.cognitive_frame_readings (
  id uuid primary key default gen_random_uuid(),
  frame_id uuid not null references public.cognitive_frames(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  binding_kind text not null,
  target text not null,
  value text,
  unread_reason text,
  verdict text not null check (verdict in ('holds','alert','unread')),
  observed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists cognitive_frames_user_updated_idx
  on public.cognitive_frames (user_id, updated_at desc) where deleted_at is null;
create index if not exists cognitive_frame_elements_frame_idx
  on public.cognitive_frame_elements (frame_id) where deleted_at is null;
create index if not exists cognitive_frame_readings_frame_observed_idx
  on public.cognitive_frame_readings (frame_id, observed_at desc);

create or replace function public.cognitive_element_immutable_after_seal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  frame_status text;
begin
  select status into frame_status from public.cognitive_frames where id = old.frame_id;
  if frame_status in ('sealed','settled') and new.body is distinct from old.body then
    raise exception '봉인된 프레임의 문장은 수정할 수 없습니다 — 새 원소를 만들고 supersedes 로 이으세요';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cognitive_element_seal_guard on public.cognitive_frame_elements;
create trigger cognitive_element_seal_guard
  before update on public.cognitive_frame_elements
  for each row execute function public.cognitive_element_immutable_after_seal();

alter table public.cognitive_frames enable row level security;
alter table public.cognitive_frame_elements enable row level security;
alter table public.cognitive_frame_readings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'cognitive_frames' and policyname = 'own_frames') then
    create policy own_frames on public.cognitive_frames
      for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'cognitive_frame_elements' and policyname = 'own_elements') then
    create policy own_elements on public.cognitive_frame_elements
      for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'cognitive_frame_readings' and policyname = 'own_readings') then
    create policy own_readings on public.cognitive_frame_readings
      for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end $$;
