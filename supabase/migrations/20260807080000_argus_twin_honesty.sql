-- 분신 기록의 정직성 셋 (2026-08-07 전수 코드 리뷰에서 나온 수리).
--
-- 1. was_late — "봉인이 채택보다 늦어 채점 제외"라는 사실이 공개(reveal) 순간
--    파괴되던 것을 보존한다. status='late' 는 공개 때 'revealed' 로 덮이므로,
--    설명이 정확히 사용자가 찾아볼 시점에 사라졌다. 채점 로직은 원래도 늦은
--    봉인을 세지 않았다 — 다친 것은 숫자가 아니라 계기판의 정직성이다.
--
-- 2. offered_delegation_id — 결정을 열 때 위임 정책이 꺼내졌다는 사실을 서버가
--    결정론적으로 남긴다. 지금까지 케이스↔위임 연결은 모델이 채택 때
--    appliedDelegationId 를 에코해 줄 때만 생겼고(프롬프트 산문 의존), 빼먹으면
--    그 정책은 영영 조용히 채점에서 빠졌다. 그림자·프로필에는 크론 백스톱이
--    있는데 위임에만 없었다. 이 컬럼이 "꺼내졌는데 확인이 안 됐다"를 정직한
--    공백으로 말할 근거가 된다.
--
-- 3. argus_profile_items UPDATE 정책 — recall 과 설정 화면이 "편집·삭제 가능"
--    이라 말하는데 실제로는 UPDATE 정책이 없어 삭제만 가능했고, 그래서
--    provenance='user_edited' 는 한 번도 쓰인 적 없는 죽은 값이었다. 위임
--    테이블의 컬럼 한정 grant 선례(20260806120000)를 따라 문장·출처·시각만
--    연다 — 증거·반례·확신도는 기계 관할이므로 사용자가 근거를 조작하는 문은
--    열지 않는다.

-- ── 1. was_late ────────────────────────────────────────────────────────────
alter table public.argus_shadow_predictions
  add column if not exists was_late boolean not null default false;
comment on column public.argus_shadow_predictions.was_late is
  '봉인이 채택보다 늦었는가. status 는 공개 때 revealed 로 바뀌지만 이 사실은 남는다 — "채점 제외" 설명은 정산 후에 필요하다.';
-- 백필: 아직 공개되지 않은 late 행 (공개된 행에서는 이 사실이 이미 유실됐다 —
-- 지어내지 않고 false 로 둔다. 프로덕션은 현재 0행이라 실질 영향 없음).
update public.argus_shadow_predictions set was_late = true where status = 'late';

-- ── 2. offered_delegation_id ───────────────────────────────────────────────
alter table public.argus_cases
  add column if not exists offered_delegation_id uuid references public.argus_delegations(id) on delete set null;
comment on column public.argus_cases.offered_delegation_id is
  '이 결정을 열 때 꺼내진 위임 (서버가 남기는 결정론 기록). delegation_id 는 채택 때 모델 확인으로만 채워진다 — 둘이 갈리면 정산이 채점 누락을 정직하게 말한다.';

-- ── 3. 프로필 편집을 실화 ──────────────────────────────────────────────────
drop policy if exists argus_profile_own_update on public.argus_profile_items;
create policy argus_profile_own_update on public.argus_profile_items
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
-- 컬럼 한정: RLS 는 행을 지키고, grant 가 컬럼을 지킨다.
revoke update on public.argus_profile_items from authenticated;
grant update (content, provenance, updated_at) on public.argus_profile_items to authenticated;
