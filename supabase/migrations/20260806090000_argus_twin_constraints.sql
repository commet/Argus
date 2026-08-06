-- TWIN 제약 보강 (2026-08-06 CodeRabbit 리뷰 + 자체 확인).
--
-- 1) 빈 증거 배열이 통과하고 있었다.
--    `array_length('{}'::text[], 1)` 은 NULL 을 돌려주고 PostgreSQL CHECK 는
--    NULL 을 **통과**시킨다. 그래서 `check (array_length(evidence_case_ids,1) >= 1)`
--    은 빈 배열을 막지 못했다 — 프로필의 fail-closed 증거 계약(증거 없는 항목은
--    존재할 수 없다)이 DB 층에서 뚫려 있었다는 뜻이다. cardinality() 는 빈
--    배열에 0 을 돌려주므로 의도대로 막는다.
--
-- 2) 같은 케이스에 그림자가 두 벌 생길 수 있었다.
--    응답 후 생성(after())과 시간당 백스톱 크론이 같은 케이스를 동시에 잡으면
--    (크론이 "그림자 없음"을 읽은 직후 after() 가 삽입) 예측이 중복 봉인된다.
--    중복은 채점 모수를 부풀려 성적을 왜곡한다. (case_id, target) 유일 색인이
--    두 번째 삽입을 **크게 실패**시킨다 — 조용한 중복보다 시끄러운 거절이 낫다.

alter table public.argus_profile_items
  drop constraint if exists argus_profile_items_evidence_case_ids_check;

alter table public.argus_profile_items
  add constraint argus_profile_items_evidence_case_ids_check
  check (cardinality(evidence_case_ids) >= 1);

create unique index if not exists argus_shadow_case_target_uniq
  on public.argus_shadow_predictions (case_id, target);
