# JCR J8 Portability / Erasure Closure Evidence

> 상태: **repository 구현 완료, production Supabase 적용·object-store rehearsal 대기**
> 기준 branch: `codex/jcr-runtime-j8`
> 선행점: `ced57dec` (`J7 Recall Engine Shadow`)
> 실행 정본: `DESIGN-judgment-continuity-runtime-v1-2026-07-18.md` §19–§24 J8

## 1. portable archive는 “다운로드”가 아니라 복원 계약이다

서버의 judgment archive v2는 다음을 하나의 ZIP으로 묶는다.

- project semantic event stream
- epistemic authority event stream
- account policy snapshot
- influence use receipt
- ready + independently verified artifact descriptor/bytes
- 명시적으로 전달된 legacy file
- content-free export receipt

manifest는 bundle/schema/min-reader, stream count/cursor, file SHA-256/bytes/media/class,
include/exclude class, retention/encryption truth, secret exclusion, signature 상태를 기록한다.
`archive_id`는 export receipt를 제외한 정렬된 file manifest와 source account/export time의
SHA-256으로 재계산하며 reader가 일치를 검증한다. 같은 artifact bytes는 content hash 경로 하나만
보존한다.

`ARGUS_EXPORT_SIGNING_KEY`가 32 byte 이상일 때 HMAC-SHA256 서명을 붙인다. 이 서명은 같은
Argus 운영 경계가 archive를 발급했는지 검증하기 위한 shared-secret 서명이지, 제3자가 공개키로
독립 검증하는 서명은 아니다. key가 없으면 manifest에 `unsigned`라고 표시하고,
`ARGUS_RESTORE_REQUIRE_SIGNATURE=true` 환경은 unsigned/unverified archive를 거절한다.

설정은 기존의 전체 server-row JSON(열람/법적 이동용)과 restore 가능한 judgment continuity ZIP을
서로 다른 버튼·설명으로 제공한다. JSON import가 server restore인 것처럼 쓰던 문구도 제거했다.

## 2. untrusted archive preflight

reader는 canonical write 전에 다음을 모두 끝낸다.

- compressed 64 MiB, expanded 256 MiB, single file 32 MiB, 10,000 files 상한
- streaming decompression byte limit
- absolute/drive/backslash/NUL/empty segment/`..` path 차단
- ZIP `unsafeOriginalName` 및 symlink 차단
- unmanifested/missing/duplicate file 차단
- manifest/file/archive-id/export-receipt hash 및 count 검증
- signature metadata와 HMAC constant-time 검증
- project event current-schema 검증
- authority legacy event deterministic upcast; unknown future event는 unsupported
- use receipt/artifact descriptor runtime shape 검증
- ready artifact의 descriptor hash/byte/verified fields와 실제 bytes 대조
- project mapping required, target ownership/existence, exact/new/conflict/unsupported 분류
- existing artifact가 ready + verified exact가 아니면 conflict

secret detector가 private key, bearer/provider token, assigned password/API key/secret을 발견하면 archive를
부분적으로 만들어 parity를 거짓 주장하지 않고 export 전체를 `ARCHIVE_SECRET_BLOCKED`로 중단한다.

## 3. restore phase와 partial-success 금지

`/api/account/restore`는 bearer owner와 `X-Argus-Target-Account` 원문 일치, 64 MiB body,
source→target project mapping을 요구한다. 기본 client wrapper는 dry-run이다.

적용 순서는 다음과 같다.

1. verified archive plan
2. new artifact staging/upload/hash verify/final publish
3. project events through the existing semantic gateway
4. authority command batches through the locked authority RPC
5. use receipts through a service-only exact/conflict RPC
6. portable retention policy field restore
7. recall projection full rebuild
8. complete project reducer / authority reducer / artifact state parity
9. durable restore receipt

account erasure epoch와 sync/blocked origin은 target-side security state라 source snapshot으로 덮지 않는다.
portable한 `retention_policy`만 복원한다. source event의 account/origin/idempotency transport identity는
target에 맞게 다시 binding하지만, reducer 의미와 canonical event identity는 비교 가능한 상태로 유지한다.

phase 중 실패하면 `failed` receipt를 반환하고 success를 표시하지 않는다. 앞 phase가 이미 적용된 경우도
다음 실행에서 exact prefix/artifact를 인식해 나머지를 이어갈 수 있다. durable receipt write 자체가
실패해도 route는 500과 `RESTORE_RECEIPT_PERSIST_FAILED`를 반환한다.

## 4. selective forget은 event 추가가 아니라 content erasure다

server `ForgetClaim`은 더 이상 일반 append 경로로 내려가지 않는다. exact claim-id confirmation 후:

1. 관련 event/payload/context capsule descriptor를 preflight
2. account prefix 밖 object locator가 하나라도 있으면 fail-closed
3. object bytes를 먼저 제거
4. account + claim advisory lock RPC
5. stale authority/account erasure epoch 검사
6. trace, use receipt, artifact descriptor, command receipt, projection outbox, recall document,
   authority event rows 삭제
7. account erasure epoch 증가 및 recall projection invalidation
8. content-free erasure receipt 기록

같은 receipt/confirmation retry는 삭제된 stream을 요구하지 않고 기존 receipt를 반환한다. 다른 receipt로
같은 claim id를 재사용하거나 authority event를 append하면 erased-subject trigger가 차단한다. object 삭제 뒤
DB 실패는 성공으로 표시하지 않으며 identity/rows를 남겨 retry가 가능하게 한다.

local reference adapter도 forget 후 원래 event stream과 confirmation text를 실제로 제거하고 최소 receipt만
남긴다. 동시에 account erasure epoch를 올리므로 삭제 전 offline command는 `stale_erasure_epoch`이고,
원래 forget retry만 exact receipt를 받을 수 있다.

## 5. account/browser/local lifecycle

- account delete는 artifact descriptor를 읽은 뒤 object bytes를 먼저 제거한다.
- cross-account locator나 object failure면 모든 table delete와 auth identity delete를 중단한다.
- 모든 `USER_DATA_TABLES` row를 시도한 뒤에만 auth identity를 마지막으로 삭제한다.
- row 일부 실패는 per-table receipt와 500을 반환하고 identity를 유지한다.
- 현재 browser는 해당 account IndexedDB authority outbox, Argus cache, Argus session keys를 별도 receipt로
  지운다. server가 다른 기기와 local MCP archive를 지울 수 있다고 주장하지 않는다.
- MCP local archive v2는 UUID repository id, exact confirmation, registry mapping, file hash/size/schema,
  symlink/traversal/unmanifested file, secret scan, reducer-state checksum을 검증한다.
- `local-purge --dry-run`은 exact project path와 registry bindings만 보여주고,
  실제 purge는 repository UUID 원문 confirmation을 다시 요구한다.
- legacy lifecycle v1 import도 repository UUID, allowlisted durable filename, hash/byte, regular-file 검사를
  거쳐 기존 path traversal/symlink write 가능성을 닫았다.

MCP 실제 unit journey는 `exportPortableLocalArchive → planOrPurgeRepository →
restorePortableLocalArchive`를 수행하고 ledger reducer state, legacy marker, registry binding parity를 확인한다.

## 6. retention, health, backpressure

trace TTL은 adapter가 임의의 7일 default를 만들지 않는다. 호출자가 양의 policy duration을 명시해야 하며,
retention worker는 이미 canonical row에 기록된 `expires_at`만 사용한다. expired context object를 먼저 지운 뒤
service-only locked RPC가 trace/descriptor rows를 제거한다.

`ContinuityHealth`는 다음 상태를 분리한다.

- device stored / account sync pending / account stored
- search projection pending
- source unavailable
- worker retrying / exhausted
- canonical/projection cursor, outbox/queue/artifact counts
- last success/error, local archive path, backup age

authority IndexedDB outbox는 account당 1,000 records / 4 MiB, single-command 4 MiB, 8 attempts 상한을 가진다.
terminal record만 oldest-first로 먼저 회수하고 pending authority command를 조용히 버리지 않는다. capacity가
남지 않으면 explicit failure다. drain은 origin round-robin, exponential capped backoff, sanitized error code,
`RETRY_EXHAUSTED` terminal state를 사용한다.

## 7. persistence declaration

| record | 저장 위치/성격 | content | retention/delete |
|---|---|---:|---|
| project/authority events | Supabase canonical tables | 예 | explicit forget/account delete; time TTL 없음 |
| use receipt | Supabase authorization canonical | hash/id only | claim forget/account delete |
| artifact bytes | `epistemic-artifacts/{user}/...` | 예 | descriptor policy/forget/account delete |
| context trace/capsule | Supabase + object store bounded audit | 예 | stored `expires_at` policy worker/forget/delete |
| recall/checkpoint | rebuildable projection | 파생 | 언제든 invalidate/rebuild/delete |
| erasure receipt | Supabase minimal tombstone | 본문 없음 | account delete |
| restore receipt | Supabase phase/result receipt | plan/result metadata | account delete |
| browser outbox | IndexedDB account partition | command content | ack/terminal eviction/logout/delete |
| MCP ledger | `~/.argus/projects/{repository_id}` canonical local | 예 | exact local purge |
| archive ZIP/dir | user-chosen download path | 예 | user-owned; server delete 범위 밖 |

server ZIP은 transport encryption을 제공하지 않는다. Supabase at-rest encryption을 end-to-end encryption이라고
부르지 않는다. archive 파일의 보관·암호화는 다운로드 이후 사용자 책임이다.

## 8. 검증 결과

2026-07-18 KST, repository root에서 실행했다.

| 검증 | 결과 |
|---|---|
| J8 archive/restore/erasure/routes/outbox targeted | 6 root files, 58 passed |
| MCP portable lifecycle targeted | 1 file, 10 passed |
| MCP full suite | 104 files, 1,000 passed |
| root full suite | 259 passed, 1 skipped; 3,377 passed, 10 skipped |
| MCP TypeScript/build | passed |
| Next.js production build | passed; restore route 포함 |
| ESLint | 0 errors, pre-existing warning budget 안 127 warnings |
| plugin gate tests | 29 passed |
| decision signal tests | 68 passed |
| static spine eval | 16 passed |
| `git diff --check` | passed |

주요 red/green fixture는 signed/unsigned/wrong signature, hash tamper, traversal, symlink, declared expansion bomb,
secret, supported legacy upcast, missing mapping, target conflict, partial append failure, non-judgment reducer parity,
object-before-row deletion, cross-account locator, browser account partition, stale erasure epoch, local
export→purge→restore를 포함한다.

## 9. 아직 완료라고 주장하지 않는 것

이 commit은 migration을 production Supabase에 적용하지 않았고 production object storage에서 실제
export→forget/delete→restore rehearsal을 수행하지 않았다. 따라서 production RPO/RTO, managed backup 복구,
cross-region disaster recovery 완료 증거가 아니다. 배포 전 다음이 별도 gate다.

1. staging migration apply + rollback/forward-only review
2. 실제 auth account/project mapping archive restore
3. object upload/delete failure injection과 retry
4. production-like DB/object export→delete→restore semantic parity
5. backup age/RPO/RTO 기록

또한 settings에는 archive export가 있지만 source→target project mapping을 설명하는 일반 사용자용 restore
wizard는 아직 열지 않았다. API/client dry-run과 receipt가 canonical 복원 경계다. E3B claim review/Patterns
표면은 O4 통과 뒤 J9이며 J8이 그것을 우회해 공개하지 않는다.
