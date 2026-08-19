# JCR J6 Capture Convergence Evidence

> 상태: **J6 repository 구현·production check-in drain 검증 완료**
> 기준 branch: `codex/jcr-runtime-j6`
> 선행점: `3644b7f6` (`J5 Context Compiler`)
> 실행 정본: `DESIGN-judgment-continuity-runtime-v1-2026-07-18.md` §13, §15, §23, §24 J6

## 1. 하나의 capture brain과 하나의 writer

foreground `/argus:history scan`과 opt-in background queue는 모두
`captureTranscriptFile()`을 호출한다. 이 경계가 다음을 단독 소유한다.

- `CandidateExtractorPort`와 현재 deterministic floor
- host transcript의 typed user-turn parsing
- source quote byte 검증
- sensitive-content 차단
- stable candidate identity
- `harvestCandidateV2()` canonical append

plugin scan에 있던 별도 Claude detector prompt와 legacy candidate writer를 제거했다. extractor 구현을
나중에 바꿔도 source origin/session, byte span, raw quote hash, policy major, typed span, deterministic
sub-index로 만든 candidate identity는 바뀌지 않는다. extractor 이름·모델 버전은 identity 입력이 아니다.

## 2. provenance와 capture firewall

capture는 assistant turn, sidechain/meta/attachment, tool result, system reminder, command caveat, 질문, 명시적
미결정/부정, routine chatter를 후보로 만들지 않는다. string user content와 typed text block만 읽는다.

extractor가 제안한 quote가 raw transcript byte에 그대로 없으면 `quote_not_found`로 계수하고 쓰지 않는다.
검증을 host-reported로 낮추거나 모델 문장으로 대체하는 경로는 없다. private key, bearer/provider token,
영문·한국어 assigned secret가 있는 user turn은 quote search/hash/canonical write 전에 전부 차단하며 결과에는
category와 건수만 남긴다.

capture 결과는 후보일 뿐이다. endorse/grant/seal/promotion을 만들지 않는다.

## 3. 실제 bounded consumer

SessionStart hook은 opt-in일 때 원문이 아닌 transcript 경로만 queue에 멱등 enqueue하고 즉시 반환한다.
“백그라운드에서 이미 처리 중”이라고 말하지 않고 다음 Argus check-in이 제한된 수를 처리한다고 안내한다.

`argus_check_in`이 `drainCaptureOnCheckIn()`을 호출하는 production consumer다. 한 check-in sweep은 하루 1회,
주 2 candidate cap, 한 queue item, 10분 lease, 최대 3회 retry 경계를 지킨다. queue item lifecycle은 다음과
같이 명시적으로 보존된다.

`pending -> leased -> succeeded | no_candidate | retryable_failed -> exhausted`

완료·실패를 조용히 삭제하지 않으며 check-in 응답의 `capture_status`에서 content-free count와 마지막 drain
결과를 확인할 수 있다. opt-out 또는 `CLAUDE_PLUGIN_DATA` 부재면 소비하지 않는다.

## 4. status와 purge

내부 CLI는 다음 privacy surface를 제공한다.

- `capture-status --data-dir <absolute>`: status/attempt/completed time과 selective purge handle만 출력
- `capture-purge --data-dir <absolute> --item-id <id|all>`: transcript path, session id, candidate id,
  last error를 제거하고 `purged_by_user` receipt만 남김

plugin에서는 `/argus:history scan --status`와 `--purge <id|all>`로 같은 경계를 호출한다. live lease는 bulk
purge가 건너뛰고 그 수를 보고하므로 worker completion을 모호하게 만들지 않는다. status는 transcript
본문/path, session id, candidate 본문, error 본문을 출력하지 않는다.

## 5. parser와 stable identity parity

foreground/background parity test는 별도 home/repository에 같은 transcript를 넣어 candidate id와 canonical
event의 candidate/kind/quote/speaker/verification/evidence/source가 같음을 확인한다. 추가 corpus는 extractor
version 불변성, 반복 quote byte span, multi-candidate sub-index, hallucinated quote 거절, secret pre-hash 차단,
host-meta exclusion을 고정한다.

명시적 scan은 runtime 실패 시 scan-state cursor를 전진시키지 않는다. 따라서 canonical runtime이 없거나
파손된 응답이면 다음 scan에서 재시도하며, legacy writer로 fail-open하지 않는다.

## 6. persistence declaration

| record | 저장 위치/성격 | 원문 포함 | retention/삭제 |
|---|---|---:|---|
| transcript | Claude Code host 소유 | 예 | Argus가 복제하지 않음 |
| capture queue | `${CLAUDE_PLUGIN_DATA}/harvest-queue.json` 임시 lifecycle | 아니오(path만 처리 전 보유) | explicit selective/all purge |
| daily marker | plugin data 임시 rate state | 아니오 | plugin lifecycle |
| candidate event | `~/.argus/projects/{repository_id}/ledger.jsonl` canonical candidate | user quote/evidence | candidate action/account-local lifecycle |
| scan state | workspace `.argus/ledger/scan-state.json` projection cursor | 아니오 | 재생성/명시 삭제 가능 |

queue는 canonical memory store가 아니다. candidate event가 유일한 결과 정본이고 queue의 candidate ids는
lifecycle linkage다. opt-in 전에는 background queue를 만들지 않는다. J6는 transcript나 candidate content를
server로 전송하지 않는다.

## 7. 검증 결과

2026-07-18 KST, repository root에서 순차 실행했다.

| 검증 | 결과 |
|---|---|
| J6 capture/queue/hook/runtime targeted | 5 files, 41 passed |
| MCP TypeScript | passed |
| MCP full suite | 104 files, 998 passed |
| production `npm run build` | MCP kernel + Next.js production build passed |
| root full Vitest suite | 256 files passed, 1 skipped; 3,327 tests passed, 10 skipped |
| plugin decision-ledger smoke | 46 passed |
| plugin manifest/skill validation | passed |
| gate validation + tests | passed; 29 gate tests |
| static spine eval | 16 passed |
| capture status/purge CLI smoke | passed; missing args exit 1 |
| `git diff --check` | passed |

MCP full suite에서 기존 intentional rejection logging은 보였지만 실패는 0이다. 기존 macOS/Node 24 symlink
cleanup은 target traversal 가능성이 없는 `unlinkSync`로 고쳐 동일 test를 green으로 만들었다.

## 8. 비주장

J6의 deterministic extractor는 모든 자연어 결정을 완벽히 포착한다고 주장하지 않는다. precision-first
floor이며 extractor 교체를 위한 port와 identity invariance를 마련했다. queue drain은 daemon이 아니라
사용자가 실제 Argus check-in을 호출할 때 실행된다. capture candidate는 self-knowledge claim도, influence
authority도 아니다. recall ranking/index는 J7, complete local/server erasure와 portable restore는 J8,
public E3B surface는 O4 통과 뒤 J9 범위다.
