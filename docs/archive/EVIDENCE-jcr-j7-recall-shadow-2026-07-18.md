# JCR J7 Recall Engine Shadow Evidence

> 상태: **J7 repository 구현·local benchmark/shadow gate 완료, production migration/cross-OS runtime gate 대기**
> 기준 branch: `codex/jcr-runtime-j7`
> 선행점: `f283cbf7` (`J6 capture convergence`)
> 실행 정본: `DESIGN-judgment-continuity-runtime-v1-2026-07-18.md` §14, §15, §23.6, §24 J7

## 1. RecallDocument는 projection이다

`RecallDocument`는 project judgment와 epistemic claim을 같은 검색기에서 다루는 envelope다. canonical
event/state를 대체하거나 수정하지 않는다. document는 canonical refs, authority, lifecycle, project/time,
source hashes, sensitivity, projection version을 보존한다.

- project semantic event → judgment document
- authority event stream → claim document
- hard-erased judgment와 forgotten claim → document 0
- superseded judgment → successor link 보존
- invalid/unknown source stream → whole coordinator `ready=false`; 부분 정상처럼 노출하지 않음

project-qualified document id를 사용해 서로 다른 project의 같은 judgment id가 충돌하지 않는다. projector는
AI 제안을 user authority로 올리지 않고, checkpoint도 `ai_summary_projection`과
`support_unit_eligible=false`를 고정한다.

## 2. deterministic query plan

실행 순서는 다음으로 고정했다.

1. query normalization과 bounded plan
2. authority/lifecycle/kind/project/time hard filter
3. lexical candidate retrieval
4. adapter 결과에 같은 hard filter와 projection version 재검사
5. deterministic lexical/phrase/source-diversity rerank
6. superseded neighbor grouping
7. query hash, ranking/projection version, returned canonical refs, stale exclusions를 가진 result receipt

adapter가 out-of-scope 또는 stale document를 반환해도 planner가 다시 제외한다. semantic/vector retrieval은
`semantic_enabled=false`다. 현재 corpus에서 lexical+structured failure 증거가 없으므로 vector dependency와
semantic score를 authority/evidence weight로 도입하지 않았다.

Postgres query syntax는 user string을 직접 전달하지 않는다. shared tokenizer가 글자/숫자 term만 만들고
Argus가 OR tsquery를 조립한다. local engine도 같은 term을 쓴다. Latin 기술어와 한국어 조사 경계를
분리하고 한국어 bigram을 추가해 `Postgres로`, `저장하기로` 같은 문장을 검색할 수 있다.

## 3. LocalSearchPort packaging spike

promotion 후보 중 pure-JS inverted index를 reference local adapter로 선택했다.

| 후보 | 결과 |
|---|---|
| native SQLite FTS5 | 현재 Node 18/20/22 + 3 OS prebuild/install 증거 없음; 보류 |
| Node SQLite package | dependency/ABI/package-size gate 전 public contract 고정 금지 |
| pure JS inverted index | dependency 0, native binary 0, open port 0, browser/Node-compatible source; 채택 |
| vector sidecar | corpus gate 미충족; 제외 |

index는 canonical이 아니다. `replace()`가 새 document/posting 구조를 완성한 뒤에만 pointer를 교체하므로
invalid rebuild가 기존 complete index를 반쯤 덮지 않는다. snapshot은 projection version/document checksum을
검증하며 파손 시 unhealthy가 되고 canonical source에서 rebuild해야 한다. public filename/SQLite schema는
고정하지 않았다.

100k에서 common-term query가 과도한 object map을 만들던 초기 구현은 typed score/seen arrays와 numeric
posting slots로 교체했다. 같은 benchmark에서 100k query p50이 225.8ms에서 67.94ms로, 관측 heap이
1,028MB에서 283.84MB로 내려갔다.

### benchmark

2026-07-18, macOS / Node 24.13.0, 25 query runs, synthetic mixed lifecycle/project corpus:

| documents | rebuild | query p50 | query p95 | observed heap |
|---:|---:|---:|---:|---:|
| 1,000 | 14.15ms | 1.06ms | 1.46ms | 11.90MB |
| 10,000 | 67.21ms | 7.85ms | 11.52ms | 41.53MB |
| 100,000 | 618.15ms | 67.94ms | 109.21ms | 283.84MB |

benchmark는 `npm run jcr:recall-bench`로 재현한다. 메모리는 canonical input과 index가 rebuild 직후 함께
존재하고 GC를 강제하지 않은 보수적 process observation이다. production corpus relevance/latency SLO를
증명하는 수치는 아니다.

## 4. Postgres projection

`epistemic_recall_documents`는 GIN FTS와 hard-filter columns를 가진 rebuildable table이다. authenticated
user는 자기 projection SELECT만 가능하고 INSERT/UPDATE/DELETE 권한은 없다. service-role-only
`replace_epistemic_recall_documents`가 transaction 안에서 full replacement와 health state upsert를 수행한다.

`epistemic_recall_projection_state`는 projection version, source cursor/checksum, document count, status,
rebuild time을 보존한다. canonical stream에 unknown/invalid event가 있으면 server rebuild worker는 기존
projection을 ready라고 계속 주장하지 않고 `blocked_unknown` health를 기록한다.

두 table 모두 `USER_DATA_TABLES`에 등록되어 export/account erasure에 포함된다. 이들은 canonical이 아니며
삭제 후 event planes에서 rebuild할 수 있다.

## 5. progressive disclosure

- search result: title/lifecycle/project/time/authority/canonical refs
- `buildJudgmentTimeline` / `buildAuthorityTimeline`: event-ref가 붙은 변경/근거/settlement 이웃
- `projectJudgmentCheckpoint`: active cases, exact user event refs, unresolved review questions, missing evidence,
  content-hashed file locator, next verification dates

checkpoint는 source ref 없는 문장을 만들지 않는다. invalid file hash는 버리고 completeness를
`partial_invalid_source`로 표시한다. 현재 session의 live provider prompt나 background influence에는 어떤
recall body도 넣지 않았다.

## 6. persistence declaration

| record | 성격 | 삭제/복구 |
|---|---|---|
| project/authority events | canonical source | J8 authority lifecycle/account erase |
| RecallDocument table | server rebuildable projection | account erase/언제든 rebuild |
| projection state | content-free server health | account erase/rebuild 갱신 |
| pure-JS index/snapshot | local rebuildable cache | purge/corruption 후 canonical rebuild |
| checkpoint | AI summary projection | source revoke/delete 시 rebuild |
| result receipt | per-query returned value, content-free refs/features | caller audit retention; authority 아님 |

검색 relevance는 grant가 아니다. explicit recall result는 Context Compiler의 background influence
authorization을 우회하지 않는다.

## 7. 검증 결과

| 검증 | 결과 |
|---|---|
| J7 recall + erasure targeted | 2 files, 19 passed |
| TypeScript | passed |
| changed-file ESLint | 0 errors, 0 warnings |
| production `npm run build` | MCP kernel + Next.js production build passed |
| root full Vitest suite | 257 files passed, 1 skipped; 3,349 tests passed, 10 skipped |
| full repository lint | 0 errors; 127 pre-existing warnings within 145 cap |
| 1k/10k/100k benchmark | completed; table above |
| corruption/rebuild/atomic replace | passed |
| query syntax/injection corpus | passed |
| Postgres/local document/filter conformance | passed |
| migration RLS/service-only replace/erasure drift | passed |
| `git diff --check` | passed |

## 8. 비주장과 promotion gate

repository에 migration과 rebuild worker가 있지만 이 환경에서 실제 Supabase에 적용하지 않았다. Postgres
GIN query와 transaction은 live DB integration/EXPLAIN/fault injection을 거쳐야 production-ready다.

pure-JS 선택으로 native install risk는 제거했지만 이번 실행은 macOS/Node 24뿐이다. repository CI는
Ubuntu/Node 20에서 merge 시 검증하지만 Windows와 Node 18/22 실측 matrix는 아직 없다. 따라서
“모든 supported platform에서 이미 검증됨”이라고 주장하지 않는다. cross-OS matrix가 green이 되기 전
local engine을 irreversible public storage contract로 고정하지 않는다.

J7는 public search/Patterns UI, live prompt influence, vector DB, always-on daemon을 열지 않는다. portable
bundle/restore와 complete cache/object/outbox erasure는 J8, E3B surface는 O4 통과 뒤 J9 범위다.
