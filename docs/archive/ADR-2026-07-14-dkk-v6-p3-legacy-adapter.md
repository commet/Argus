# ADR — Decision Knowledge Kernel v6 P3 Legacy Adapter

Date: 2026-07-14
Status: **Accepted — read-old / write-new boundary**
Decision owner: Decision Knowledge Kernel implementation stream

## 결정

v2 JSONL은 원본 파일과 이벤트 이름을 바꾸지 않고 읽는다. v3는 새 write의 canonical semantic format이며, v2를 v3로 재작성하거나 v2 provenance에서 human authorization을 추론하지 않는다.

Legacy adapter의 출력은 `SemanticEvent`가 아니라 다음이다.

```text
LegacySemanticHint
+ authority_status: legacy_unknown
+ legacy timestamp
+ exact / split / degraded / opaque disposition
+ named loss report
```

따라서 legacy projection은 읽기·검색·비교에 참여할 수 있지만, v3 writer가 요구하는 `authorized_by + mode + evidence`를 갖는 것처럼 보이지 않는다.

## 판정

| v2 family | disposition | v3 읽기 의미 |
|---|---|---|
| harvest | exact | Proposal |
| seal | split | Judgment + Return Contract |
| amend | degraded | legacy revision hint; 과거 statement를 덮지 않음 |
| dismiss | degraded | withdrawal/dismissal hint |
| settle (terminal) | split | Resolution hint + Closure hint, legacy outcome extension 보존 |
| settle (`still_pending`)·snooze | exact | Return deferred hint |
| premise family | degraded | premise/observation hint와 named authority loss |
| candidate family | exact/degraded/opaque | proposal lifecycle만 보존 |
| bearing·waypoint·gate·sync | opaque | legacy extension으로 보존 |

모든 v2 event name은 code mapping table에 정확히 하나의 disposition을 가져야 한다. 새 v2 event가 생기면 P3 test가 빨간불이 된다.

## 손실 규칙

- `legacy_unknown` authority는 손실이 아니라 **명명된 불확실성**이다.
- v2 `held / avoided / missed / partial`은 사람 등급으로 변환하지 않고 legacy extension으로 보존한다.
- v2 `amend`가 결과 인지 뒤 발생했는지는 legacy data만으로 판별할 수 없다. 그래서 v3의 in-place amend로 승격하지 않는다.
- opaque data는 버리지 않는다. projection이 모르면 원문·이름·event id를 유지한다.

## 검증

- v2 `EVENT_NAMES` 전수와 mapping table의 키가 같다.
- seal, terminal settle, still_pending, unknown authority, opaque sync의 adapter fixture가 존재한다.
- adapter는 입력 event를 mutate하지 않는다.
- read-old 결과와 write-new `SemanticEventSchema`가 한 번의 test에서 함께 검증된다.

