# JCR J3 Authority Domain Evidence

> 상태: **J3 구현·회귀 검증 완료**
> 기준 branch: `codex/jcr-runtime-j3`
> 선행점: `2adda5ae` (`J2 synthetic perspective firewall`)
> 실행 정본: `DESIGN-judgment-continuity-runtime-v1-2026-07-18.md` §5~§11, §24 J3

## 1. 구현한 정본 경계

J3는 E2의 네 localStorage 배열을 즉시 제거하거나 새 사용자 surface를 열지 않는다. 그 대신
E3A가 의존할 framework-free authority domain과 local reference adapter를 만든다.

```text
Authority Command
  -> strict envelope / semantic fingerprint
  -> current claim aggregate fold
  -> transition decision
  -> atomic event batch validation
  -> append receipt / current checksum
```

domain은 React, Zustand, Supabase, IndexedDB, filesystem, LLM SDK를 import하지 않는다. 서버와
브라우저 저장 구현은 같은 command/event/reducer 계약을 사용하도록 port 뒤에 남겼다.

## 2. ClaimAuthorityAggregate

claim마다 독립된 stream과 version을 가진다.

- statement/scope의 field-level `Authored<T>` provenance
- claim kind, support state, lifecycle
- resolved reality `AuthoritySupportUnit`
- counterexample
- grant revision/status/surface/scope
- aggregate version과 authority epoch

`ProposeClaim`, `ReviewClaim`, `RewordClaim`, `ContestClaim`, `AddCounterexample`,
`GrantInfluence`, `RevokeInfluence`, `RearmAskOnce`, `ForgetClaim`만 aggregate를 바꾼다.
client가 event를 직접 만들지 않는다.

reword, contest, reopen, retire, material counterexample, hard forget은 epoch를 올린다. reword,
contest, reopen, retire, material counterexample batch는 같은 epoch에서 기존 active grant를
원자적으로 invalidate한다. hard forget reducer는 statement, scope, support, counterexample를
비우고 모든 grant를 revoke한다.

## 3. support와 grant eligibility

`supported` proposal과 descriptive influence eligibility는 다음 현실 독립성을 요구한다.

- resolved, non-AI observation 3개 이상
- 서로 다른 support unit, case, resolution, observation ref
- 서로 다른 causal cluster와 source cluster
- `unknown_shared` cluster 0

model lineage는 provider/model/prompt/extractor/source-input metadata로 보존하지만 독립성 수에
기여하지 않는다. 테스트는 9개 model lineage가 같은 현실 cluster를 반복해도 support가 되지
않고, 같은 model이어도 세 독립 현실 case면 support가 되는 것을 고정한다.

개인 원칙은 direct/elicited user wording일 때만 별도 eligibility를 가진다. endorsement와 grant는
여전히 다른 command다. grant surface는 명시한 web/MCP/plugin에만 유효하며 자동 확장하지 않는다.

## 4. 동시성, retry, 철회 안전성

local adapter는 다음 server transaction의 reference semantics다.

- owner/origin/account erasure epoch 검증
- expected aggregate version/authority epoch 검증
- `(origin_id, idempotency_key)` exact retry
- 같은 key와 다른 semantic fingerprint hard conflict
- prospective full stream fold 성공 뒤에만 append
- receipt에 event ids, version, epoch, current-state checksum 반환

`ContestClaim`, `RevokeInfluence`, `ForgetClaim`은 인증된 local owner/origin 검증 뒤, canonical
version 검사 전에 local safety tombstone을 만든다. stale/offline command여도 이 runtime의 다음
influence는 0이다. 다른 계정 또는 차단 origin은 tombstone을 만들 수 없다. tombstone은
`pending`과 canonical `acknowledged`를 구분하므로 account-wide 철회를 거짓으로 표시하지 않는다.

## 5. schema evolution과 compatibility

event reader는 envelope 검증 → version dispatch → pure upcast → payload dispatch → reducer 순서다.

- current schema: v2
- v1 authored text: 원문을 보존하되 확인되지 않은 provenance는 `legacy_unknown`
- future schema: projection `blocked_unknown`, cursor 정지, minimum reader version 반환
- malformed/illegal order: projection `invalid`, 마지막 안전 cursor/checksum 반환
- event id나 occurred/recorded timestamp가 아니라 aggregate append version이 정본 순서

E2 compatibility bridge는 기존 `SelfKnowledgeClaim`을 read-only projection으로 보여준다. 과거
event chronology나 grant를 만들어내지 않고 aggregate version/epoch 0, grants `{}`로 유지한다.

## 6. use receipt와 artifact primitive

J3는 J5가 사용할 authorization primitive도 domain에 고정했다.

- `ask_once`: `once:<grant>:<epoch>:<revision>` unique slot
- same receipt/call retry: `exact_retry`
- 다른 call의 동일 slot: `already_used`
- trace/capsule 삭제와 무관한 작은 receipt state
- dispatch state: reserved/dispatched/provider_failed

artifact descriptor는 `staged -> verified -> ready`를 강제한다. descriptor SHA-256과 byte length가
검증값과 일치해야 verified가 되고, 검증 metadata가 일치해야만 ready ref를 authority content로
사용할 수 있다. quarantine/deleted 전이는 명시적이며 deleted artifact는 부활하지 않는다.

## 7. persistence declaration

이번 공정이 추가한 runtime store는 **in-memory local reference adapter뿐**이다. 새 localStorage
key, IndexedDB database, server table, object bucket, archive file write는 없다.

- authority events/use receipts/artifact descriptors의 타입과 port는 영속 계약의 정본 후보다.
- `LocalAuthorityAdapter`와 `LocalInfluenceUseReceiptStore`는 테스트/reference semantics이며 앱
  재시작 내구성을 주장하지 않는다.
- 기존 E2 localStorage는 compatibility read 경로로 그대로 남는다.
- server RLS/migration/outbox/object publish는 J4에서 별도 persistence declaration과 함께 연다.
- portable restore와 hard erasure coverage는 J8 전에는 완료라고 주장하지 않는다.

## 8. 검증 결과

2026-07-18 KST, repository root에서 production build 뒤 suite를 순차 실행했다.

| 검증 | 결과 |
|---|---|
| J3 신규 domain/adapter tests | 14 passed |
| J3 + current E2 targeted | 2 files, 49 passed |
| production `npm run build` | MCP kernel + Next.js production build passed |
| full Vitest suite | 254 files passed, 1 skipped; 3,280 tests passed, 10 skipped |
| TypeScript `npx tsc --noEmit` | passed |
| changed-file ESLint | 0 errors, 0 warnings |
| `git diff --check` | passed |

검증 corpus는 support independence, aggregate sequence, grant invalidation, exact retry, idempotency
conflict, stale version/epoch/erasure, wrong owner/blocked origin, two-claim independence, timestamp
irrelevance, rejected safety tombstone, hostile tombstone rejection, hard forget data minimization, future
schema block, legacy provenance upcast, malformed-command atomicity, ask-once reservation, artifact publish
state, E2 compatibility를 포함한다.

## 9. J3 종료선과 비주장

J3 exit인 domain/property·fault behavior와 E2 의도적 hardening 차이는 닫혔다. 의도적 차이는
model count 비권위화, strict user provenance, authority epoch, durable-use용 receipt 분리,
unknown-event fail-loud다.

이 문서는 server persistence, provider prompt mutation, capture consumer, recall index, restore,
public Patterns UI의 완료 증거가 아니다. 각각 J4~J9의 독립 gate를 통과해야 한다.
