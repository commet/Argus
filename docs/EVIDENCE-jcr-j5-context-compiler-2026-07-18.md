# JCR J5 Context Compiler Evidence

> 상태: **J5 repository 구현·shadow gate 완료, live provider prompt 미연결**
> 기준 branch: `codex/jcr-runtime-j5`
> 선행점: `190d4a07` (`J4 server authority storage`)
> 실행 정본: `DESIGN-judgment-continuity-runtime-v1-2026-07-18.md` §16, §23, §24 J5

## 1. 한 compiler와 두 실행 모드

`compileAuthorityContext()`가 authority candidate가 prompt 근처에 갈 수 있는 유일한 신규 경계다.

- `audit`: would-use section/capsule/trace를 만들지만 live prompt를 반환하지 않고 receipt를 소모하지 않음
- `dispatch`: 같은 판정 뒤 server/local use receipt를 예약한 경우에만 prompt section을 반환

현재 앱 LLM route에는 이 compiler를 연결하지 않았다. 따라서 J5 shadow 비교가 기존 provider prompt를
바꾸지 않는다. public E3B gate도 열지 않았다.

## 2. deterministic eligibility

background influence는 다음을 모두 통과해야 한다.

1. retrieval candidate의 canonical ref가 claim version/last event와 일치
2. forgotten/superseded/contested/비-endorsed가 아님
3. user-authored principle이거나 독립 현실 support가 충분함
4. active grant가 현재 authority epoch/revision에 속함
5. surface/domain/project/session/time scope 일치
6. explicit recall/background purpose 일치
7. conflict component가 안전하게 해소됨
8. source/total token budget 안에 전체 section이 들어감
9. typed renderer 성공
10. dispatch mode면 use reservation 성공
11. capsule/trace persistence 성공

background cap은 call당 1이다. 선택 순서는 session/project/role/domain specificity, statement freshness,
claim ID 순이며 profile score나 model confidence를 만들지 않는다. token 초과 section은 자르지 않고
명시적 exclusion으로 남긴다.

explicit recall은 grant 없이도 사용자가 소유한 contested/retired record를 상태/source label과 함께
볼 수 있다. 이 경로는 background personalization receipt로 세지 않는다.

## 3. conflict set

conflict는 pair 하나가 아니라 연결 component로 계산한다. A↔B, B↔C면 세 claim 전체가 같은 set다.

- adapt grant뿐이면 전부 `conflicting_authority`, section 0
- set 안에 ask_once grant가 있으면 claim을 선택하지 않고 set 전체에 대한 중립 질문 하나
- 선택되지 않은 claim도 related IDs와 함께 exclusion trace
- recency/specificity가 conflict를 이기는 경로 0

## 4. injection-safe rendering과 capsule binding

behavioral language는 `retrieve_only`, `ask_once`, `adapt_generation` 고정 template에서만 나온다.
저장 statement는 XML-escaped untrusted data cell에만 있고 role token, role label, code fence, newline을
중화한다. raw transcript/file/tool invocation/URL을 expand하거나 실행하지 않는다.

capsule은 두 hash를 분리한다.

- `body_hash`: 렌더된 context body integrity
- `capsule_hash`: body + full call envelope + current task constraints + selected claim version/epoch + renderer version

따라서 같은 call ID와 같은 memory body라도 현재 user task가 바뀌면 기존 receipt exact retry로
통과하지 않는다. 현재 task가 과거 memory보다 높은 권위를 가진다는 불변식을 receipt까지 묶는다.

## 5. use reservation transaction

`reserve_epistemic_influence_use` RPC는 authority append와 동일한 claim advisory lock을 잡고 다음을
canonical event stream에서 다시 확인한다.

- account erasure epoch
- current authority epoch
- current lifecycle endorsed
- 최신 grant event와 revision/effect/surface/scope
- revoke 또는 grants-invalidated가 grant 뒤에 없는지
- server clock 기준 start/expiry
- ask_once unique slot `once:<grant>:<epoch>:<revision>`

client timestamp는 server clock과 5분 이상 다르면 거절되고, grant validity는 server clock으로 판단한다.
same receipt/full payload는 exact retry, ask_once의 다른 call은 `ASK_ONCE_ALREADY_USED`, altered payload는
conflict다. provider와 DB를 하나의 transaction으로 묶지 않으므로 reservation은 at-most-once
authorization이다. provider failure 뒤 같은 call transport retry만 허용하고 다른 call은 재무장되지 않는다.

## 6. trace/capsule과 Inspector

`ContextCompilerTrace`는 include/exclude reason, provenance, claim version/epoch, grant/receipt, conflict refs,
requested/used tokens, tokenizer/renderer version, capsule hash를 연결한다.

- local test/reference: `MemoryContextInspectorStore`
- server: `ServerContextAuditStore`
- capsule body: private ready artifact (`kind=context_capsule`)
- trace metadata: `epistemic_context_traces`
- retention: 기본 7일 bounded, `expires_at` 필수

server trace exact retry는 trace/capsule checksum이 같을 때만 성공이다. Inspector metadata listing은 capsule
body를 내보내지 않는다. telemetry 연동도 없다. trace write 실패는 이미 예약된 receipt를
`provider_failed`로 표시하고 prompt section 0으로 회수한다.

provider dispatch helper는 성공/실패를 receipt와 internal Inspector linkage에 기록한다. receipt 성공 뒤
provider 실패가 ask_once를 자동 재무장하지 않는다.

## 7. tokenizer

`TokenizerRegistry`는 provider/model counter를 adapter edge에서 등록한다. provider tokenizer가 없거나
throw/0/비정상 값을 내면 Unicode 3 code points/token + overhead의 보수적 deterministic fallback을 쓴다.
trace에는 tokenizer 이름과 requested/used token을 남긴다.

## 8. persistence declaration

J5는 `epistemic_context_traces` table을 추가해 `USER_DATA_TABLES`, RLS, export/account erasure coverage에
등록했다. capsule bytes는 J4 private artifact bucket/descriptor protocol을 재사용한다.

| record | 정본/성격 | 삭제 |
|---|---|---|
| use receipt | authorization-use canonical | account erase/J8 policy |
| context trace | bounded audit metadata | expiry worker/account erase |
| context capsule | bounded private artifact | descriptor/object erase |
| Inspector memory store | test/internal reference | process lifetime |

trace/capsule retention은 use receipt와 분리된다. trace/capsule expiry가 ask_once를 재무장하지 않는다.
artifact bytes를 포함한 portable export/restore는 J8 전에는 backup으로 주장하지 않는다.

## 9. 검증 결과

2026-07-18 KST, repository root에서 production build 뒤 suite를 순차 실행했다.

| 검증 | 결과 |
|---|---|
| J3/J5/erasure targeted | 3 files, 38 passed |
| production `npm run build` | MCP kernel + Next.js production build passed |
| full Vitest suite | 256 files passed, 1 skipped; 3,327 tests passed, 10 skipped |
| TypeScript | passed |
| changed-file ESLint | 0 errors, 0 warnings |
| `git diff --check` | passed |

targeted corpus는 audit non-consumption, dispatch reservation, prompt injection, trace fault, explicit recall,
contested/revoked/stale epoch/ref, pair/transitive conflicts, neutral ask, deterministic cap, token exclusion,
provider failure/exact retry, changed-task call binding, provider success linkage, tokenizer fallback, server lock/RPC
grant checks/service-role gate, context trace RLS/erasure를 포함한다.

## 10. 비주장

J5는 live prompt에 memory를 주입하지 않는다. production migration도 J4와 같은 배포 gate가 남아 있다.
capture convergence는 J6, recall/index는 J7, expiry worker와 portable restore/complete erasure는 J8,
public Inspector/Patterns UX는 O4 통과 뒤 J9 범위다.
