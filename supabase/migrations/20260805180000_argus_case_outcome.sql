-- 정산 결과를 케이스 행에 투영한다 (R3-B 원격 MCP 파일럿).
--
-- 왜 필요한가: 이 제품의 해자는 계획이 아니라 **정산**이다. 비슷한 결정을 다시
-- 만났을 때 "지난번엔 무엇을 가정했고 실제로 어떻게 됐는지"를 되돌려주는 것이
-- 범용 AI가 못 하는 유일한 것이다. 그런데 `argus_recall` 은 제목 목록만 돌려주고
-- 있었다 — 전략의 심장이 배선되지 않은 채였다.
--
-- 왜 원장을 매번 fold 하지 않는가: 목록 한 번에 케이스 10개의 이벤트를 전부
-- 읽어야 하고, 그것이 대화 한 턴의 지연이 된다. argus_events 가 정본이고 이
-- 컬럼들은 거기서 **다시 만들 수 있는 캐시**다 (마이그레이션 20260805100000의
-- 설계 주석과 같은 규칙). 캐시가 틀리면 원장으로 고칠 수 있다.

alter table public.argus_cases
  add column if not exists last_observation text,   -- 실제로 일어난 일 (사용자의 말)
  add column if not exists recall_gap      text,    -- 정산 직전의 기억 (기록과 대조할 것)
  add column if not exists choice          text,    -- 그때 채택한 것
  add column if not exists settled_at      timestamptz;

-- "정산이 끝난 결정" 목록이 주 질의다.
create index if not exists argus_cases_settled_idx
  on public.argus_cases (user_id, settled_at desc)
  where settled_at is not null;

comment on column public.argus_cases.last_observation is
  '정산 때 사용자가 말한 실제로 일어난 일. argus_events 에서 재생 가능한 캐시.';
comment on column public.argus_cases.recall_gap is
  '기록을 열기 직전의 무보조 회상. 기록과의 차이가 이 제품이 재는 유일한 것이다.';
