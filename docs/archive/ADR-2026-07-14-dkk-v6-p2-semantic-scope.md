# ADR — Decision Knowledge Kernel v6 P2 의미 모델 범위

Date: 2026-07-14
Status: **Accepted — P2 semantic package scope**
Decision owner: Decision Knowledge Kernel implementation stream

## 결정

P2는 모든 배포 surface를 흉내 내지 않는다. 날짜 기반 return, local space의 human authority, append-order replay만 구현한다. 이 범위는 v6 의미를 축소하는 것이 아니라 아직 결정되지 않은 외부 경계를 정직하게 열어 두는 것이다.

| P0 미결 항목 | P2 결정 | 후속 phase |
|---|---|---|
| repository-local human identity | `human:local:<space_id>`가 local canonical identity | P3 import adapter에서 external identity mapping |
| direct command evidence | `authorization_ref`는 `user_utterance` 또는 `command_digest` pointer | P4 MCP receipt가 실제 pointer를 생성 |
| event-based return trigger | **미지원**; P2/P4는 `review_at` 필수 | P6 이후 별도 ADR 없이는 추가 금지 |
| signed import | **미지원**; import는 `legacy_unknown`으로 하향 | P3 trust-policy ADR |
| Supabase canonical/replica | P2에는 local JSONL semantic instance만 존재 | P6 deployment ADR |
| physical backup erasure | semantic layer는 logical erasure receipt만 모델링 | P6/P7 purge contract |
| private metric access | metric은 P5 harness에만 사용, instance data에는 저장하지 않음 | P5 privacy ADR |
| defer/close conflict UX | reducer는 `conflict` projection을 내고 자동 승자를 고르지 않음 | P6 UX ADR |

## P2 불변식

- 모든 Authorial Event는 local human `authorized_by`, mode, evidence ref를 가진다.
- `answered` resolution은 하나 이상의 Observation을 참조한다.
- Resolution은 Return Contract를 `subject_ref`로 가진다.
- `return_deferred`는 terminal state를 만들지 않는다.
- reducer는 append-order total function이며, 과거의 invalid event는 anomaly로 남긴다.
- `as_of` projection은 `recorded_at` 이후에 기록된 회고를 보지 않는다.

## Exit

이 ADR은 P2 package의 schema, reducer, guard, constitution fixture가 모두 이를 집행할 때만 완료다.
