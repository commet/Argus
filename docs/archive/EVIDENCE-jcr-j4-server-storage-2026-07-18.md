# JCR J4 Server Storage Evidence

> 상태: **J4 repository 구현·회귀 검증 완료, production migration 적용은 배포 gate**
> 기준 branch: `codex/jcr-runtime-j4`
> 선행점: `fa639ab5` (`J3 claim authority domain`)
> 실행 정본: `DESIGN-judgment-continuity-runtime-v1-2026-07-18.md` §8~§12, §24 J4

## 1. 서버 정본

`20260718_jcr_epistemic_authority.sql`은 다음 user-scoped 정본을 추가한다.

- `epistemic_account_policies`
- `epistemic_authority_events`
- `epistemic_command_receipts`
- `epistemic_use_receipts`
- `epistemic_artifact_descriptors`
- `epistemic_projection_outbox`

모든 table은 RLS가 켜지고 authenticated role은 자기 row SELECT만 가능하다. authority append RPC는
PUBLIC/anon/authenticated에서 revoke되고 service role만 실행한다. private
`epistemic-artifacts` bucket도 direct user policy를 열지 않았다.

## 2. command gateway와 concurrency

`/api/epistemic/commands`는 bearer token owner를 확인한 뒤 command envelope/fingerprint를 검증하고,
server가 현재 stream을 strict reader로 fold한 뒤 J3 decision function으로 event batch를 만든다.
client event append API는 없다.

DB RPC는 claim별 advisory transaction lock 안에서 다음을 다시 검사한다.

- account erasure epoch와 allowed/blocked origin
- exact current aggregate version/authority epoch
- contiguous event version과 non-regressing epoch
- command/origin/idempotency/fingerprint/user가 batch 전체에서 동일함
- schema v2와 object payload
- payload artifact가 ready + verified인지

같은 transaction에서 event batch, durable command receipt, projection outbox row를 쓴다. 이 중 하나가
실패하면 전부 rollback된다.

### command receipt를 별도 둔 이유

reword/contest/reopen/material counterexample는 한 command에서 state event와 grant invalidation event를
함께 만든다. 따라서 event table의 `(origin, idempotency_key)` 단일 unique는 정상 batch와 모순이다.
J4는 stream version/event id unique를 event table에 두고, command-level exact retry unique를
`epistemic_command_receipts (user_id, origin_id, idempotency_key)`에 둔다. 이 구조가 atomic multi-event
batch와 hard idempotency conflict를 동시에 보장한다.

## 3. browser IndexedDB outbox

E3B가 사용할 `IndexedDbAuthorityCommandOutbox`는 event가 아니라 command를 저장한다.

- database: `argus-jcr`
- store: `authority_command_outbox`
- account partition 필수
- `pending -> attempted -> succeeded | abandoned`
- attempts/next retry/error 보존
- same command/fingerprint enqueue는 exact retry
- command id reuse + 다른 fingerprint는 hard conflict
- account logout/erase용 `purgeAccount`

drain은 at-least-once delivery다. server ack 뒤 local ack 전 crash는 같은 command를 재전송하지만 durable
receipt가 exact retry로 돌려주므로 event를 중복하지 않는다. transient failure는 bounded exponential
backoff, stale/idempotency 같은 non-retryable result는 abandoned로 남겨 자동 merge하지 않는다.

## 4. staged artifact publish

server artifact gateway는 다음 순서만 허용한다.

1. account-scoped staging/final locator를 가진 staged descriptor insert
2. staging upload
3. staging download + byte length/SHA-256 재검증
4. descriptor verified 전이
5. content-addressed final key copy
6. final download + byte length/SHA-256 재검증
7. descriptor ready 전이
8. staging cleanup

text/markdown/json/PDF만 허용하고 UTF-8/NUL, JSON parse, PDF magic을 검사해 명백한 MIME 위장을
descriptor 생성 전에 거절한다. corrupt final copy는 quarantined이며 ready가 되지 않는다. authority
RPC도 ready/verified descriptor가 아닌 `payload_ref`를 거절한다.

## 5. erasure/export coverage

여섯 table을 `USER_DATA_TABLES`와 schema drift mirror에 함께 등록했다. 기존 export는 모든 table row를
owner filter로 포함한다.

account deletion은 descriptor row를 지우기 전에 final/staging object locator를 account prefix로
검증해 제거한다. object read/remove가 실패하면 다음을 모두 지키며 500 receipt를 반환한다.

- descriptor를 삭제하지 않음
- 다른 user row를 삭제하지 않음
- auth identity를 삭제하지 않음
- 실패 locator map을 잃지 않아 재시도 가능

object 제거가 성공한 뒤에만 모든 table과 마지막 auth identity를 삭제한다.

## 6. persistence declaration

| 저장소 | 정본성 | retention/삭제 |
|---|---|---|
| authority events | claim authority canonical | account erase/J8 selective forget |
| command receipts | idempotency canonical | account erase; content 최소화 |
| use receipts | authorization-use canonical | account erase/J8 policy |
| artifact descriptors + private bytes | content canonical | descriptor-driven object erase |
| projection outbox | rebuild delivery state | success/retention worker, account erase |
| browser IndexedDB outbox | device-local pending command | account partition, explicit purge |

기존 E2 localStorage 네 key는 아직 compatibility shadow다. J4는 이를 자동 업로드하지 않으며 sync opt-in
전 network content egress 0을 유지한다. server export는 descriptor rows를 포함하지만 artifact bytes
bundle과 restore는 아직 J8 범위이므로 backup 완료를 주장하지 않는다.

## 7. 검증 결과

2026-07-18 KST, repository root에서 production build 뒤 suite를 순차 실행했다.

| 검증 | 결과 |
|---|---|
| J4 storage/server + delete/export/erasure targeted | 4 files, 29 passed |
| production `npm run build` | MCP kernel + Next.js production build passed; command route 포함 |
| full Vitest suite | 255 files passed, 1 skipped; 3,300 tests passed, 10 skipped |
| TypeScript | passed |
| changed-file ESLint | 0 errors, 0 warnings |
| `git diff --check` | passed |

검증은 USER_DATA_TABLES drift, RLS/RPC grants, lock/epoch/idempotency SQL contract, outbox state/backoff/account
partition/purge, server-side event decision, cross-account pre-read rejection, durable exact retry, staged/final
hash, corrupt copy quarantine, MIME mismatch, object-first account erasure와 identity preservation을 포함한다.

## 8. 배포 gate와 비주장

이 repository 환경에는 local PostgreSQL/Supabase CLI가 없어 migration을 실제 DB에 적용하지 않았다.
따라서 production promotion 전에는 승인된 migration 적용, live RLS catalog 검사, 두 account integration,
concurrent RPC/fault injection을 다시 수행해야 한다. repository 구현 완료를 production schema 적용
완료로 표현하지 않는다.

J4는 provider prompt를 변경하지 않는다. use reservation/compiler/Inspector는 J5, capture worker는 J6,
recall projector는 J7, artifact-byte export/restore와 전체 lifecycle은 J8이다.
