-- TWIN M5 — 보정 거울의 재료 (2026-08-06 밤).
--
-- 앞선 판단을 뒤집는다. 기획서 부록 C.5 는 "사용자 자신의 보정은 확신도
-- 사전등록 입력이 없어서 지을 수 없다"고 적었는데, **입력은 이미 있었다.**
-- `argus_adopt` 의 `materialBeliefs` 가 각 믿음에 confident / uncertain /
-- contested 를 받고 있었고, 그것은 결과를 알기 전에 사용자가 자기 손으로
-- 적은 확신도다 — 사전등록의 정의 그대로다. 없던 것은 입력이 아니라
-- **소비**였다: 정산 때 그 믿음들을 현실과 대조하는 경로가 없었다.
--
-- (이것이 이 리포가 반복해서 겪는 형태다. 생산된 필드는 기본이
--  dead-on-arrival 이고, 소비를 가드하지 않으면 아무도 눈치채지 못한다.)
--
-- 채점 규율은 그림자와 같다:
-- · 3치 판정. 인용 없는 supported/contradicted 는 indeterminate 로 강등
-- · indeterminate 는 모수에서 제외 (정직한 공백)
-- · **숫자를 지어내지 않는다.** 세 등급에 0.85/0.6/0.4 같은 확률을 붙여
--   Brier 를 계산하고 싶은 유혹이 있으나, 그 숫자는 사용자가 말한 적이 없다.
--   등급별 적중률(신뢰도 구간별 비율)만 낸다 — 그것이 보정의 정의이고,
--   지어낸 확률 없이 계산할 수 있는 유일한 정직한 형태다.
--
-- zero-judgment: 채점 대상은 **사용자가 그때 적어 둔 예측**이지 사용자가
-- 아니다 (CLAUDE.md TWIN 수정조항). 정체성 점수·등급은 여전히 금지다.

create table if not exists public.argus_belief_checks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  case_id           text not null references public.argus_cases(id) on delete cascade,
  -- 그때 사용자가 적은 믿음 문장 그대로. 근거를 되짚을 수 있어야 성적이 의미를 갖는다.
  belief            text not null,
  -- 결과를 알기 전에 사용자가 고른 확신 등급. 이것이 사전등록이다.
  stated_confidence text not null check (stated_confidence in ('confident', 'uncertain', 'contested')),
  verdict           text not null check (verdict in ('supported', 'contradicted', 'indeterminate')),
  verdict_quote     text,
  model_id          text not null,
  created_at        timestamptz not null default now()
);

-- 같은 케이스의 같은 믿음이 두 번 채점되면 모수가 부풀려진다. 크론 백스톱과
-- after() 가 겹칠 수 있으므로 DB 가 두 번째를 **크게 실패**시킨다.
create unique index if not exists argus_belief_case_belief_uniq
  on public.argus_belief_checks (case_id, belief);
create index if not exists argus_belief_user_idx
  on public.argus_belief_checks (user_id, created_at desc);

alter table public.argus_belief_checks enable row level security;

-- 본인 읽기·삭제. 그림자와 달리 봉인이 아니다 — 이것은 사용자가 자기 손으로
-- 적은 문장의 채점이므로, 근거를 언제든 볼 수 있어야 숫자에 이의를 제기할 수
-- 있다. 쓰기는 정산 경로(service role)만.
drop policy if exists argus_belief_own_read on public.argus_belief_checks;
create policy argus_belief_own_read on public.argus_belief_checks
  for select using (auth.uid() = user_id);

drop policy if exists argus_belief_own_delete on public.argus_belief_checks;
create policy argus_belief_own_delete on public.argus_belief_checks
  for delete using (auth.uid() = user_id);

comment on table public.argus_belief_checks is
  'TWIN M5 — 채택 때 사용자가 사전등록한 믿음의 확신 등급을 정산 관찰과 대조한 것. 등급별 적중률만 내고 확률은 지어내지 않는다.';
