# ARGUS R2 HARNESS — 구현 자체에 대한 적대적 검토 기록

Date: 2026-08-04
Status: **구현 직후 1차 review pass의 판정과 수정 기록. 발견은 코드에 반영 완료**
대상: `method-harness/` (커밋 880fa64 시점) → 수정 반영 커밋

---

## 검토 방법

litmus는 repo의 LLM-glue invariant 그대로다: *"여기 wire가 조용히 끊기면
무엇이 빨간불이 되는가?"* — 각 모듈을 규범(v1.0) 대비 대조하고, 측정기는
측정기 자신을 속이는 경로로 공격했다.

## 발견과 수정 (4건 — 전부 코드에 반영, 테스트 추가)

| # | 발견 | 심각도 | 수정 |
|---|---|---|---|
| 1 | **숫자 변경이 cosmetic으로 오분류.** "2주간→3주간"은 bigram 1쌍 차이라 verbatim으로 잡힘 — 일정 2배 변경이 rubber-stamp로 집계될 뻔했다. 측정기의 Goodhart 방어(v0.7)가 자기 자신의 맹점을 갖고 있었다. | 높음 | 숫자 토큰 multiset이 다르면 diff 비율과 무관하게 material. 회귀 테스트 추가. |
| 2 | **"baseline이 방향성 도움보다 먼저"가 산문으로만 존재.** 헌법 BASELINE 조항이 기계 검사 없이 프롬프트 신뢰에 맡겨져 있었다 — 이 repo가 금지하는 정확히 그 형태의 조용한 wire. | 높음 | reducer가 baseline event(캡처 또는 정직한 부재) 없는 `ai_proposal` fold를 throw (`PROPOSAL_BEFORE_BASELINE`). 테스트 추가. |
| 3 | **lesson 승인이 이전 상태 스냅샷을 오염.** 얕은 복사로 객체가 공유되어 `approved=true` 변이가 과거 fold 결과에 소급 반영 — append-only의 정신을 구현이 배반. | 중간 | 교체 방식으로 수정, 스냅샷 불변성 테스트 추가. |
| 4 | **pulled/pushed 감지 heuristic의 오탐.** "추천해줬던 거 별로였어"가 /추천/에 매치되어 major×one_way의 directional 문이 열릴 수 있다. | 중간 | 코드에 HONEST LIMIT 주석으로 명시: pilot harness에서는 명시적 요청 행위로 확정(감지가 아니라 사실), 그 전까지 R1 평가자가 gold case의 label을 감사. |

## 검토했으나 수정하지 않은 것 (사유 명시)

- **valueClaimRefs의 인용 선택 규약**: directional 추천은 citation=ref인
  user-source claim을 동반해야 lineage가 성립한다. 규약 미준수는 fail-closed
  (강등)로 이미 안전하다 — 문서화만 보강.
- **ISO 시간 문자열 비교**: 전 harness가 Z-normalized ISO를 쓰는 전제.
  타임존 혼입은 호출자 계약 위반이며, R3-A 연결부에서 정규화한다.
- **branching의 의미 동일성**: 두 branch의 expectedNextMove가 자구만 다르고
  의미가 같은 경우는 기계가 못 잡는다 — v1.0 §10.6이 이미 평가자 이관으로
  명시한 잔여다.

## 판정

수정 후 53/53 테스트 통과, strict 타입체크 클린, 전체 repo 스위트 green,
src↔harness 격리 가드 통과. **1차 pass 기준 구현은 v1.0의 기계 검사 목록
14건 전부와 zero-tolerance 대응표를 코드로 보유한다.** 남은 정직한 한계는
전부 명시되어 있으며(entailment, falsifier 품질, branching 의미 동일성,
pulled 감지), 각각 이관처(critic·평가자·pilot의 명시 행위)가 지정되어 있다.

다음 검토자에게: 이 문서의 "수정하지 않은 것"부터 공격하라.
