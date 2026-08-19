-- 지속하는 전제 — 기록을 시스템으로 만드는 스키마.
-- 적용: 2026-08-17, overture-db (sckixrzwqntynsisgcdx).
--
-- 왜 프레임 밖에 두나. 1층에서 전제는 cognitive_frame_elements 의 한 행이었다.
-- 그러면 프레임 3의 "전환율 유지"와 프레임 7의 같은 전제가 서로 다른 객체다.
-- 결과: 전제가 무너져도 다른 판단이 깨어나지 않고, M2(부패 전제 위 결정률)가
-- **원리적으로 계산 불가**다 (같은 전제인지 알 수 없으니 셀 수가 없다).
--
-- 그래서 전제는 자기 테이블에 살고, 프레임은 조인 테이블로 **참조**한다.
-- 전제 하나가 흔들리면 그것을 참조한 모든 살아있는 판단을 한 번의 조회로 찾는다.
--
-- 설계 규칙 셋:
--   1. 임계(사전 믿음)는 근거 없이 존재할 수 없다 — CHECK 로 강제한다.
--      모든 탐지기의 임계는 데이터에서 도출되지 않으므로(Chow→Bai-Perron,
--      CUSUM, ADWIN 전부), 근거가 없으면 그 임계는 검토될 수 없다.
--   2. 판독 원장은 append-only. unread 도 남는다 — 읽지 못한 사실 자체가
--      기록이고, 판독 실패를 '이상 없음'으로 처리하면 센서가 켜져 있다는
--      사실이 거짓 안심이 된다.
--   3. RLS 는 (select auth.uid()) 형태.

create table if not exists public.cognitive_premises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  body text not null default '',
  -- 신호 결박 목록 (kind/target/threshold/threshold_rationale/threshold_owner).
  bindings jsonb not null default '[]'::jsonb,
  -- 탐지 사전 믿음. null 이면 판정하지 않는다 — 기본 임계를 몰래 끼워넣지 않는다.
  cusum_prior jsonb,
  adwin_prior jsonb,
  portfolio_prior jsonb,
  -- 임계는 근거와 함께만 존재한다. 사전 믿음이 있으면 rationale 이 비어 있을 수 없다.
  constraint cusum_prior_needs_rationale check (
    cusum_prior is null
    or coalesce(btrim(cusum_prior->>'rationale'), '') <> ''
  ),
  constraint adwin_prior_needs_rationale check (
    adwin_prior is null
    or coalesce(btrim(adwin_prior->>'rationale'), '') <> ''
  ),
  constraint portfolio_prior_needs_rationale check (
    portfolio_prior is null
    or coalesce(btrim(portfolio_prior->>'rationale'), '') <> ''
  ),
  supersedes uuid,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 프레임 ↔ 전제 참조. 여기가 시스템의 배선이다.
create table if not exists public.cognitive_frame_premises (
  id uuid primary key default gen_random_uuid(),
  frame_id uuid not null references public.cognitive_frames(id) on delete cascade,
  premise_id uuid not null references public.cognitive_premises(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (frame_id, premise_id)
);

-- 전제의 판독 원장. cognitive_frame_readings 와 별개인 이유: 판독은 전제에
-- 붙는 사실이고 프레임에 붙는 사실이 아니다. 전제가 여러 프레임에 참조되므로
-- 프레임에 매달면 같은 판독이 중복된다.
create table if not exists public.cognitive_premise_readings (
  id uuid primary key default gen_random_uuid(),
  premise_id uuid not null references public.cognitive_premises(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  binding_kind text not null,
  target text not null,
  value text,
  unread_reason text,
  verdict text not null check (verdict in ('holds','alert','unread')),
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  -- 같은 신호를 같은 시각에 두 번 적지 않는다 (원장 중복은 탐지 통계를 왜곡한다).
  unique (premise_id, binding_kind, target, observed_at)
);

create index if not exists cognitive_premises_user_updated_idx
  on public.cognitive_premises (user_id, updated_at desc) where deleted_at is null;
create index if not exists cognitive_frame_premises_premise_idx
  on public.cognitive_frame_premises (premise_id);
create index if not exists cognitive_frame_premises_frame_idx
  on public.cognitive_frame_premises (frame_id);
-- 탐지는 시간순 판독 열을 읽으므로 (premise_id, observed_at) 이 핫 경로다.
create index if not exists cognitive_premise_readings_premise_observed_idx
  on public.cognitive_premise_readings (premise_id, observed_at);

-- 전제 문장도 봉인 후 불변이다. 어느 봉인 프레임이라도 이 전제를 참조하면
-- 문장을 바꿀 수 없다 — 봉인된 판단이 기댄 전제가 사후에 바뀌면 그 판단의
-- 빈티지가 무너진다 (Croushore-Stark: 당시 정보 상태로만 평가 가능해야 한다).
create or replace function public.cognitive_premise_immutable_when_referenced()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sealed_refs int;
begin
  if new.body is distinct from old.body then
    select count(*) into sealed_refs
    from public.cognitive_frame_premises fp
    join public.cognitive_frames f on f.id = fp.frame_id
    where fp.premise_id = old.id and f.status in ('sealed','settled');

    if sealed_refs > 0 then
      raise exception '봉인된 판단 %건이 이 전제를 참조합니다 — 문장을 바꿀 수 없습니다. 새 전제를 만들고 supersedes 로 이으세요', sealed_refs;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cognitive_premise_seal_guard on public.cognitive_premises;
create trigger cognitive_premise_seal_guard
  before update on public.cognitive_premises
  for each row execute function public.cognitive_premise_immutable_when_referenced();

alter table public.cognitive_premises enable row level security;
alter table public.cognitive_frame_premises enable row level security;
alter table public.cognitive_premise_readings enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'cognitive_premises' and policyname = 'own_premises') then
    create policy own_premises on public.cognitive_premises
      for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'cognitive_frame_premises' and policyname = 'own_frame_premises') then
    create policy own_frame_premises on public.cognitive_frame_premises
      for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'cognitive_premise_readings' and policyname = 'own_premise_readings') then
    create policy own_premise_readings on public.cognitive_premise_readings
      for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end $$;

-- 귀속 (M5). 사전등록과 사후 귀속을 **둘 다** 남긴다 — 결과를 본 뒤의 선택만
-- 기록하면 그 선택 자체가 사후 합리화의 산물이다 (Fischhoff 1977: 사후확신은
-- 경고로 줄지 않고, 당시 기록의 보존만이 듣는다).
--
-- ⚠️ 이 블록은 2026-08-17 실DB에 먼저 적용됐고 저장소 파일에는 누락돼 있었다.
-- erasure-coverage 가드는 **마이그레이션 파일에서** 사용자 범위 테이블을 파생하므로,
-- 파일에 없으면 계정 삭제·내보내기가 이 표를 영영 건너뛴다. 점검에서 잡아 보강한다.
create table if not exists public.cognitive_attributions (
  frame_id uuid primary key references public.cognitive_frames(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  -- 봉인 시점의 사전등록.
  prereg_if_right text check (prereg_if_right in ('judgment','luck','both','unclear')),
  prereg_if_wrong text check (prereg_if_wrong in ('judgment','luck','both','unclear')),
  prereg_at timestamptz,
  -- 정산 시점의 실제 귀속. 기계가 추론하지 않는다 — 사용자가 고른다
  -- (Nisbett-Wilson: 자기보고도 못 믿는데 타자의 해석은 더하다).
  settled_attribution text check (settled_attribution in ('judgment','luck','both','unclear')),
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cognitive_attributions enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'cognitive_attributions' and policyname = 'own_rows') then
    create policy own_rows on public.cognitive_attributions
      for all to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
end $$;
