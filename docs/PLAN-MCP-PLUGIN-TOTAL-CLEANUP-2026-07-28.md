# Argus MCP·Plugin 완전 정리 계획 및 세션 인계 정본

작성일: 2026-07-28  
기준 브랜치: `main`  
기준 커밋: `9bc2a70b`  
관련 병합: PR #309, PR #310  
상태: **공개 표면 1차 정리는 완료됐지만 저장소 내부 완전 정리는 아직 시작 전**

이 문서는 다른 세션이 Argus MCP·플러그인의 현재 구조를 잘못 추측하지
않도록 만든 정리 작업의 정본이다. 이미 무엇을 왜 지웠는지, 무엇은 실제
최종 기능이라 남겼는지, 무엇은 아직 남은 레거시인지, 앞으로 어떤 순서와
검증으로 완전히 걷어낼지를 규정한다.

이 문서는 다음 제품 설계를 대체하지 않는다.

- `docs/HANDOFF-2026-07-27-deep-judgment-and-one-dataset.md`
- `docs/ADR-2026-07-27-one-user-judgment-dataset.md`
- `docs/ARGUS-BLUEPRINT.md`

위 문서가 판단 도메인과 단일 데이터셋의 방향을 정한다면, 이 문서는 그
방향을 훼손하지 않고 MCP·플러그인의 전달 표면과 내부 구현을 정리하는
방법을 정한다.

---

## 1. 먼저 지켜야 할 최종 제품 결정

### 1.1 MCP 공개 표면은 정확히 여섯 개다

최종 공개·호출 가능 도구는 아래 여섯 개뿐이다.

1. `argus_capture`
2. `argus_predict`
3. `argus_check_in`
4. `argus_resolve`
5. `argus_patterns`
6. `argus_settings`

새 도구를 추가하거나 옛 이름을 호환 별칭으로 되살리지 않는다. 새 요구는
먼저 이 여섯 사용자 목적 중 하나에 속하는지 판단한다. 속하지 않는다면
공개 MCP에 즉시 추가하지 말고 제품 결정과 실제 사용자 증거를 요구한다.

### 1.2 플러그인 검토 역할은 정확히 네 개다

1. `domain-reviewer`
2. `evidence-reviewer`
3. `risk-reviewer`
4. `synthesizer`

모든 역할은 `model: inherit`을 사용한다. 일반 검토는 단일 모델이 수행한다.
명시적인 deep review에서만 필요한 전문가를 제한적으로 쓴다. 이름을 붙인
가상 조직이나 17명 명단을 다시 만들지 않는다.

### 1.3 핵심 사용자 루프

정리 과정에서 보존할 핵심은 다음 한 줄이다.

> 판단의 근거를 포착하고, 검증 가능한 예측을 남기고, 현실의 결과로 돌아와
> 기록하고, 그 기록을 다시 읽는다.

도구·에이전트·문서·평가의 수는 품질 지표가 아니다. 위 루프의 정확성,
사용자 권한, 출처, 원장 안전성, 결과 회귀 가능성이 품질 지표다.

### 1.4 데이터 원칙

- 로컬 정본은 프로젝트별 `.argus/` 아래에 둔다.
- 전역 `~/.argus/.bound` 색인을 다시 만들지 않는다.
- 계정 동기화 전에는 프로젝트 데이터가 자동 업로드되지 않는다.
- 기존 원장 호환 읽기와 마이그레이션은 “레거시”라는 이름만으로 삭제하지
  않는다.
- 새 독립 원장이나 새 JSONL writer를 만들지 않는다.
- 단일 사용자 판단 데이터셋 이행은 관련 ADR과 handoff의 순서를 따른다.

---

## 2. 1차 정리에서 실제로 한 일

핵심 커밋 `4e951e07`은 93개 파일에서 690줄을 추가하고 9,262줄을
삭제했다. 파일 39개를 완전히 삭제했다. 후속 커밋 `b5a60fb9`와
`6fbc8ab3`은 삭제된 경로와 과거 버전 핀을 참조하던 CI 계약을 최종
표면에 맞췄다.

### 2.1 MCP 호출 표면

이전 구조는 공개 도구와 내부 도구를 동시에 `TOOL_MAP`에 넣었다.
`tools/list`에서 숨겨도 과거 이름을 아는 모델이나 캐시된 프롬프트는 계속
호출할 수 있었다.

호출 가능했던 과거 내부 이름:

- `argus_open_decision`
- `argus_review`
- `argus_premises`
- `argus_seal`
- `argus_recheck`
- `argus_settle`
- `argus_recall`
- `argus_sync`
- `argus_amend`
- `argus_dismiss`
- `argus_candidates`
- `argus_watch`
- `argus_init`
- `argus_config`
- `argus_record`

1차 정리 후:

- `TOOLS`, `PUBLIC_TOOLS`, `TOOL_MAP`은 같은 여섯 도구만 가진다.
- 과거 이름은 호출 시 `UNKNOWN_TOOL`을 반환한다.
- 공개 목록뿐 아니라 실제 dispatcher에서 제거했다.
- 전용 테스트가 정확한 여섯 도구와 과거 별칭 거부를 강제한다.

### 2.2 기존 기능의 여섯 목적 통합

| 최종 목적 | 재사용하는 내부 기능 |
|---|---|
| `argus_capture` | 결정 열기, 전제 추가·수정, 열린 질문, 사실 재확인, 예측 수정, 종료 |
| `argus_predict` | 검증 가능한 예측과 확인일 봉인 |
| `argus_check_in` | 지금 돌아볼 예측·사실·질문 |
| `argus_resolve` | 사용자가 말한 현실 결과 기록 |
| `argus_patterns` | 과거 결정·영수증·전제·타임라인·회고 조회 |
| `argus_settings` | 초기화·설정·명시적 동기화 |

`open-decision.ts`, `premises.ts`, `recheck.ts`, `amend-dismiss.ts`,
`seal.ts`, `settle.ts`, `recall.ts`, `init-config.ts`, `sync.ts`는 이름이
과거 내부 개념을 반영하지만 현재 여섯 도구가 실제로 호출하는 엔진이다.
따라서 1차 정리에서는 재작성하지 않았다. 검증된 동작을 보존하면서 공개
표면부터 닫는 것이 목적이었다.

### 2.3 `argus_record` 삭제

완전 삭제:

- `argus-mcp/src/tools/semantic-record.ts`
- `argus-mcp/src/tools/__tests__/semantic-record.test.ts`

이 도구는 단순 별칭이 아니었다. prediction, commitment, declaration,
witness 네 문장 종류와 seal/correct/revise/observe/defer/resolve/close/read
동작을 가진 별도 semantic-ledger 파일럿이었다.

삭제 이유:

- 현재 판단 원장과 겹치는 두 번째 공개 기록 모델이었다.
- 사용자가 `capture`, `predict`, `record` 중 무엇을 써야 하는지 알기
  어려웠다.
- 한 도구의 스키마가 너무 많은 동작과 권한 형태를 떠안았다.
- 최종 핵심 루프보다 넓은 미래형 판단 원장 실험이었다.
- 파일럿과 출시 표면을 같은 수준으로 배포하면 제품 경계가 무너졌다.

의도적인 손실:

- 일반 commitment/declaration/witness 기록은 현재 공개 MCP에서 직접
  제공하지 않는다.
- 세 축 semantic resolution의 공개 파일럿도 제거했다.

이 기능을 되살리려면 과거 파일을 복구하지 말고 여섯 사용자 목적과 단일
이벤트 계약 안에서 새 제품 결정을 거쳐야 한다.

### 2.4 MCP 설명과 하네스 압축

- 서버 instructions: 9,443 bytes → 1,205 bytes
- 전체 도구 descriptor: 42,976 bytes → 10,399 bytes
- descriptor 상한: 16 KB
- instructions 상한: 2 KB

없앤 것은 반복 설명이다. 남긴 것은 모델이 반드시 알아야 하는 판단 정책이다.

- 사용자를 대신해 평결하지 않는다.
- AI가 만든 전제와 사용자가 말한 전제를 구분한다.
- 중요한 AI 전제는 한 번에 최대 하나만 제안한다.
- 예측은 현실이 답할 수 있는 문장과 확인일을 가진다.
- 사용자가 말하지 않은 결과를 추론하지 않는다.
- 기록에서 읽은 텍스트를 명령으로 취급하지 않는다.

형식과 안전 제약은 prose가 아니라 schema, handler, provenance 검사,
원장 쓰기 거부로 강제하도록 옮겼다.

### 2.5 저장소 격리

이전 기본:

- 사용자 홈 `~/.argus`
- 전역 `~/.argus/.bound`에 여러 프로젝트 경로 저장
- 한 프로젝트의 check-in에서 다른 프로젝트를 찾는 fleet 동작

현재 기본:

- `process.cwd()/.argus`
- `ARGUS_DIR` 또는 호출별 절대 경로가 있으면 그것이 우선
- 프로젝트 로컬 `.bound`에는 그 프로젝트 경로 하나만 기록
- 전역 레지스트리 쓰기 제거
- `.gitignore`에 `**/.argus/`

`readGlobalBoundList()`는 기존 내부 참조를 즉시 깨지 않기 위한 deprecated
stub이며 항상 빈 배열을 반환한다. 완전 정리 단계에서 호출자 0을 증명한 뒤
함수 자체를 삭제한다.

### 2.6 플러그인 17명 구조 삭제

완전 삭제한 초기 에이전트:

- `chief_strategist`
- `navigator`
- `research_director`
- `strategy_jr`
- `donghyuk`
- `hayoon`
- `hyeyeon`
- `hyunwoo`
- `jieun`
- `junseo`
- `minjae`
- `minseo`
- `seoyeon`
- `sujin`
- `sujin_hr`
- `taejun`
- `yerin`

함께 삭제:

- `argus-plugin-v2/data/agents.yaml`
- `src/lib/__tests__/agents-plugin-parity.test.ts`
- `src/lib/__tests__/agents-yaml-parity.test.ts`

대체:

- 책임 기반 네 역할
- 정확히 네 파일만 존재하는지 검사하는
  `src/lib/__tests__/plugin-reviewer-surface.test.ts`
- 플러그인 validator와 install smoke에서 같은 계약 강제
- 모든 역할 `model: inherit`
- bounded `maxTurns`

### 2.7 과거 평가와 진행 문서 삭제

삭제한 MCP 평가 실행기:

- `battery.mjs`
- `cases.mjs`
- `experience.mjs`
- `host-matrix.mjs`
- `life.mjs`
- `locale-consistency.mjs`
- `loop.mjs`
- `personas.mjs`
- `run-premises.mjs`
- `run-review.mjs`
- `run.mjs`

삭제한 과거 문서:

- `argus-mcp/evals/MCP-VERIFICATION-2026-07-14.md`
- `argus-mcp/evals/POLISH-BACKLOG.md`
- `argus-plugin-v2/BUILD_STATUS.md`
- `argus-plugin-v2/TEST_PLAN.md`
- `argus-plugin-v2/DEJARGON-AND-FRICTION-PLAN.md`
- `argus-plugin-v2/lib/rehearsal-prompt.md`

삭제 기준:

- 퇴역 도구 이름을 정답으로 가정
- 실제 배포물보다 소스 내부 구조를 검증
- 서로 중복되고 CI 합격 여부와 연결되지 않음
- 완료된 시점 보고서나 임시 작업 계획
- 17명 가상 조직을 유지하기 위한 프롬프트

새 `npm run verify`는 빌드, 타입, 단위·프로토콜 테스트, fuzz, 실제 stdio
E2E, 실제 tarball E2E, 손상 원장 거부, 패키지 내용, 플러그인 검증·설치
smoke·시뮬레이션을 한 경로에서 실행한다.

### 2.8 배포 패키지

MCP `files` allowlist:

- `dist/index.js`
- `README.md`
- `SECURITY.md`
- `LICENSE`
- package metadata

TypeScript 산출물 전체를 npm에 싣지 않고 esbuild의 단일 런타임 번들을
배포한다. dry-run 기준 tarball은 다섯 파일이다. 저장소에 내부 소스가
남아 있어도 소스 트리 전체가 npm 소비자에게 공개 표면으로 배포되지는 않는다.

---

## 3. 현재 남은 레거시와 기술 부채

1차 정리는 출시 표면을 닫은 작업이지 저장소 전체의 고고학적 정리가 아니다.
아래를 완료하기 전에는 “레거시 완전 삭제”라고 부르지 않는다.

### 3.1 MCP 도구 내부

현재 `argus-mcp/src/tools/`에는 17개 구현 파일이 있다.

최종 공개 표면에 직접 필요한 파일:

- `index.ts`
- `public-tools.ts`
- `tool-types.ts`
- `errors.ts`
- `check-in.ts`

공개 façade가 실제로 호출하는 내부 엔진:

- `open-decision.ts`
- `premises.ts`
- `recheck.ts`
- `amend-dismiss.ts`
- `seal.ts`
- `settle.ts`
- `recall.ts`
- `init-config.ts`
- `sync.ts`

현재 공개 경로에서 직접 호출되지 않는 과거 도구 후보:

- `review.ts`
- `watch.ts`
- `candidates.ts`

추가 잔존:

- `PUBLIC_NAME_MAP`이 내부 결과의 과거 이름을 새 이름으로 번역한다.
- `tool-presentation.ts`에 사용되지 않는 `argus_record` 표시 정보가 남아
  있다.
- 주석·테스트·surface 문자열에 옛 도구 이름이 남아 있다.
- `MCP-NOTES.md`가 `argus_candidates` 시대 구조를 설명한다.

### 3.2 버전 폴더

- `argus-mcp/src/v2/`: 54 files
- `argus-mcp/src/v3/`: 16 files
- `argus-mcp/src/v4/`: 8 files

폴더 이름만 보고 삭제하면 안 된다.

- v2에는 현재 로컬 원장, 설치, bridge, lifecycle 구현이 섞여 있다.
- v3에는 웹앱이 직접 type import하는 semantic event/reducer가 있다.
- v4에는 진행 중인 판단 기초·JCR 작업과 테스트가 있다.

즉 “v2/v3/v4 = 모두 과거 버전”이 아니다. 현재 코드와 마이그레이션,
실험이 버전 이름 아래 섞여 있는 것이 문제다. 완전 정리는 내용을 분류해
최종 이름의 모듈로 이동한 뒤 버전 폴더를 없애는 작업이다.

### 3.3 웹앱과 MCP 소스 결합

웹앱 `src/lib/decision-kernel.ts`가 MCP의 v3 reducer/types/kind를 직접
import한다. 또 일부 핵심 파일은 웹앱과 MCP에 복사돼 byte-parity 테스트로
동기화된다.

예:

- `premises-core.ts`
- `numeric-drift.ts`
- `canonical-scales.ts`
- review library 일부

이 구조는 삭제를 어렵게 하고 한 저장소 안에 두 정본을 만든다. 공용 도메인
계약을 한 위치로 옮기기 전에는 MCP 쪽 파일을 죽은 코드로 판단하지 않는다.

### 3.4 플러그인 내부

공개 에이전트는 네 개로 정리됐지만 플러그인에는 여전히 다음이 섞여 있다.

- legacy `.argus/items.jsonl` writer와 reader
- decision-ledger 스크립트
- statusline, doctor, hook, eval, install script의 중복 검사
- 과거 명칭과 버전 번호가 포함된 진단·주석·테스트
- 여러 skill이 같은 판단 규칙을 반복 설명
- `argus-plugin-v2`라는 디렉터리 이름 자체의 버전 흔적

특히 `.argus/items.jsonl`은 기존 사용자 데이터를 담을 수 있으므로 importer
없이 writer/reader를 삭제하지 않는다. 자세한 이행 순서는 one-dataset
handoff의 4.3을 따른다.

### 3.5 문서와 증거 테스트

저장소에는 시점별 DESIGN, ADR, EVIDENCE, HANDOFF 문서가 많다. 역사 보존
가치는 있지만 무엇이 현재 정본인지 처음 보는 기여자가 구분하기 어렵다.

`blueprint-exit-evidence.test.ts`처럼 문서의 체크박스 수와 파일 존재를
검사하는 테스트는 삭제된 파일을 제품 실패처럼 취급할 수 있다. PR #309
직후 CI가 실패했던 직접 원인도 삭제한 semantic-record 테스트 경로가 이
메타 테스트에 남아 있었기 때문이다.

---

## 4. 완전 정리의 목표 구조

최종 구조는 버전 번호나 과거 UI 조직이 아니라 책임을 드러내야 한다.

### 4.1 MCP 목표

```text
argus-mcp/src/
  index.ts
  server.ts
  tools/
    capture.ts
    predict.ts
    check-in.ts
    resolve.ts
    patterns.ts
    settings.ts
    index.ts
    schemas.ts
    result.ts
  domain/
    events.ts
    projection.ts
    decisions.ts
    premises.ts
    predictions.ts
    resolutions.ts
    provenance.ts
  storage/
    path.ts
    ledger.ts
    lock.ts
    replay.ts
    integrity.ts
  sync/
    account.ts
    outbox.ts
    protocol.ts
  migration/
    legacy-local.ts
    legacy-plugin-items.ts
  apps/
    settle-card.ts
  resources/
    attention.ts
```

목표:

- `tools/`에는 여섯 공개 목적과 공용 경계 코드만 있다.
- 내부 결과도 처음부터 최종 도구 이름을 사용한다.
- `PUBLIC_NAME_MAP`이 필요 없다.
- `v2`, `v3`, `v4` 최상위 폴더가 없다.
- 호환 코드는 `migration/` 아래에 명시적으로 격리된다.
- 웹과 MCP가 공유하는 도메인 계약은 하나의 정본에서 import한다.
- npm bundle reachability에 최종 런타임만 포함된다.

### 4.2 플러그인 목표

```text
argus-plugin/
  .claude-plugin/
  .mcp.json
  agents/               # exactly four
  commands/
  skills/
  hooks/
  scripts/
    doctor.js
    validate-plugin.js
    install-smoke.mjs
    migrate-legacy-items.mjs
  README.md
  README.ko.md
  CHANGELOG.md
  LICENSE
```

목표:

- standard path는 다중 에이전트를 호출하지 않는다.
- deep review만 네 역할 중 필요한 역할을 고른다.
- skill은 여섯 MCP 도구 이름만 사용한다.
- 새 판단 기록은 MCP의 canonical writer 하나로만 쓴다.
- legacy items 파일은 importer 입력일 뿐 새 writer가 아니다.
- doctor, validator, smoke test의 책임이 겹치지 않는다.
- 충분한 호환 기간과 모든 참조 갱신 후 `argus-plugin-v2`를
  `argus-plugin`으로 바꾼다.

---

## 5. 실행 계획

각 phase는 별도 소규모 PR로 진행한다. 다른 세션의 대규모 기능 작업과 한
커밋에 섞지 않는다.

### Phase 0 — 병렬 작업 동결선과 실사

목표: 삭제 전에 현재 다른 세션의 작업을 보호하고 실제 도달성을 기록한다.

1. 작업 시작 직전 `origin/main`을 fetch한다.
2. 다른 세션의 열린 PR, 브랜치, 변경 파일을 확인한다.
3. 이 문서의 기준 커밋으로 reset하지 않는다.
4. 다음 항목의 machine-readable inventory를 만든다.
   - 여섯 도구에서 시작한 import graph
   - npm bundle metafile
   - plugin manifest에서 도달 가능한 skill/hook/script
   - 웹앱의 MCP 소스 직접 import
   - 모든 ledger writer
   - 모든 옛 공개 도구 문자열
5. 각 파일을 `runtime`, `migration`, `test`, `docs`, `dead`,
   `active-parallel-work` 중 하나로 분류한다.

완료 조건:

- 추측으로 삭제할 파일이 0개다.
- 다른 세션이 수정 중인 파일과 정리 PR의 충돌 목록이 문서화된다.
- `active-parallel-work` 파일은 해당 세션 병합 전 이동·대량 개명하지 않는다.

### Phase 1 — 확실한 dead leaf 제거

우선 후보:

- `argus-mcp/src/tools/review.ts`
- `argus-mcp/src/tools/watch.ts`
- `argus-mcp/src/tools/candidates.ts`
- `tool-presentation.ts`의 `argus_record`
- 퇴역 도구만 설명하는 `MCP-NOTES.md` 내용
- deprecated `readGlobalBoundList()`와 호출자가 0인 fleet helper
- 사용되지 않는 package script와 eval fixture

방법:

1. repo 전체 import와 동적 문자열 참조를 확인한다.
2. esbuild metafile에서 runtime bundle 비도달을 확인한다.
3. 삭제 전 관련 안전 요구가 다른 테스트에 있는지 확인한다.
4. 죽은 파일과 그 파일만 위한 테스트·문서 참조를 같은 커밋에서 삭제한다.
5. blueprint evidence map을 같은 커밋에서 수정한다.

완료 조건:

- build, typecheck, MCP verify, root coverage가 통과한다.
- 삭제한 심벌 이름을 `rg`로 찾았을 때 역사 changelog 또는 명시적 migration
  fixture 외에는 나오지 않는다.

### Phase 2 — 내부 엔진을 여섯 목적에 맞게 수렴

목표: 공개 façade가 과거 내부 도구를 번역하는 구조를 없앤다.

안전한 순서:

1. 현재 여섯 공개 도구의 characterization fixture를 고정한다.
2. 각 내부 handler가 반환하는 `tool`, `next_action`, 오류 복구 이름을 최종
   이름으로 바꾼다.
3. `PUBLIC_NAME_MAP`이 더는 변환할 것이 없음을 테스트한다.
4. façade와 내부 handler를 목적별 모듈로 합친다.
5. 다음 이름으로 파일을 정리한다.
   - open/premises/recheck/amend/dismiss → `capture.ts`
   - seal → `predict.ts`
   - settle → `resolve.ts`
   - recall → `patterns.ts`
   - init/config/sync public routing → `settings.ts`
6. 큰 파일은 사용자 목적이 아니라 domain/storage 책임으로만 분리한다.

금지:

- 동작을 새로 작성하면서 기존 테스트를 대량 삭제하지 않는다.
- 사용자 원장의 이벤트 형식을 동시에 바꾸지 않는다.
- public tool schema와 storage migration을 같은 PR에 섞지 않는다.

완료 조건:

- `argus-mcp/src/tools/`에서 옛 도구 이름 파일이 0개다.
- `PUBLIC_NAME_MAP` 삭제.
- 여섯 도구의 protocol/E2E 결과가 이전 fixture와 호환된다.

### Phase 3 — 공용 도메인 정본 만들기

목표: 웹앱과 MCP가 같은 코드를 복사하거나 MCP 내부 버전 폴더를 직접
import하지 않게 한다.

1. one-dataset ADR의 shared event envelope를 먼저 확정한다.
2. 공용 도메인 모듈 위치를 하나 정한다. workspace package가 가장 명확하다.
3. 다음을 단일 정본으로 옮긴다.
   - semantic event/types
   - reducer/projection
   - decision kind
   - premise semantics
   - numeric drift/canonical scales
   - provenance/authority contracts
4. 웹과 MCP가 공용 package를 import하도록 변경한다.
5. byte-parity copy와 drift test를 삭제한다.
6. v3/v4 파일 중 live domain 코드는 `domain/`으로, 호환 변환은
   `migration/`으로 이동한다.

다른 세션 보호:

- Deep Judgment와 one-dataset 세션이 event envelope 또는 v3/v4 contract를
  수정 중이면 그 세션의 설계를 먼저 병합한다.
- 이 phase는 해당 세션과 파일 소유권을 합의한 뒤 진행한다.
- 같은 타입을 정리 세션에서 별도로 재정의하지 않는다.

완료 조건:

- 웹의 `../../argus-mcp/src/...` import 0개.
- byte-parity 복제 파일 0개.
- v3/v4라는 버전 이름이 runtime ownership을 나타내지 않는다.

### Phase 4 — 레거시 데이터 마이그레이션 격리

목표: 호환성을 보존하되 runtime 핵심에서 레거시를 분리한다.

1. `.argus/items.jsonl` importer를 구현하고 모든 과거 event fixture를
   검증한다.
2. 반복 import가 중복 event를 만들지 않게 한다.
3. 새 plugin write는 여섯 MCP 도구/canonical writer만 사용한다.
4. 기존 local ledger schema upcaster와 importer를 `migration/` 아래로 옮긴다.
5. migration manifest에 다음을 기록한다.
   - 읽을 수 있는 과거 버전
   - 변환 규칙
   - 손실 가능 필드
   - 지원 종료 기준
6. migration code는 일반 runtime import graph에 섞지 않고 데이터 발견 시에만
   지연 로드한다.

완료 조건:

- 새 `.argus/items.jsonl` 쓰기 0건.
- importer parity와 idempotency 통과.
- 기존 사용자 fixture의 결정·전제·알림 의미가 보존된다.
- “레거시 데이터가 없다”는 조건에서 migration 모듈은 bundle hot path에 없다.

### Phase 5 — 버전 폴더 제거

Phase 3과 4 이후에만 수행한다.

분류:

- live domain → `domain/`
- live storage → `storage/`
- live sync → `sync/`
- host/apps → `apps/` 또는 `resources/`
- compatibility → `migration/`
- 실험이지만 계속할 것 → 별도 실험 브랜치나 명시적 `experimental/`
- 미도달·미사용 → 삭제

완료 조건:

- `src/v2`, `src/v3`, `src/v4` 폴더가 없다.
- runtime 코드에서 “legacy”는 migration 경계 외에 없다.
- 현재 웹/MCP/plugin 전체 검증이 통과한다.

### Phase 6 — 플러그인 최소화

1. plugin manifest에서 시작해 실제 도달 가능한 파일을 실사한다.
2. 네 agent 외 agent 파일 0개를 재확인한다.
3. 모든 skill에서 퇴역 MCP 도구 이름을 제거한다.
4. standard/deep 규칙의 중복 prose를 하나의 review contract로 모은다.
5. doctor는 사용자 환경 진단만 담당한다.
6. validator는 정적 구조만 담당한다.
7. install smoke는 설치 후 실제 로딩만 담당한다.
8. 중복 검사와 같은 fixture를 세 도구가 반복하면 하나의 공용 helper로
   합친다.
9. decision-ledger writer는 Phase 4 importer 이후 제거한다.
10. 전체 repo 참조를 한 PR에서 갱신할 수 있을 때만
    `argus-plugin-v2` → `argus-plugin` rename을 수행한다.

완료 조건:

- plugin이 만드는 판단 truth writer는 MCP canonical writer 하나.
- 네 agent, bounded deep review, model inheritance가 validator로 고정.
- install package에 미도달 skill/script/data가 없다.
- 디렉터리 rename 후 옛 경로 참조 0개.

### Phase 7 — 문서 정본과 역사 격리

목표: 기여자가 현재 문서와 과거 증거를 혼동하지 않게 한다.

최종 문서 계층:

```text
docs/
  README.md                 # 현재 정본 색인
  architecture/
  adr/
  operations/
  contributing/
  archive/                  # 역사 자료, 비정본
```

규칙:

- 현재 동작과 다른 문서는 삭제하거나 `archive/`로 이동하고 상단에
  `NON-CANONICAL` 표시를 붙인다.
- 같은 주제의 final/v2/v6 문서가 여러 개이면 현재 ADR 하나를 정본으로
  지정한다.
- 완료된 BUILD_STATUS, TEST_PLAN, 날짜별 polish backlog는 유지하지 않는다.
- 역사 evidence가 법적·데이터 마이그레이션 근거가 아니면 Git history로
  충분한지 판단한다.
- 제품 테스트가 문서 파일의 존재나 체크박스 수를 제품 정확성으로 간주하지
  않게 한다.
- exit evidence는 실행 가능한 테스트 이름과 CI artifact를 가리키고,
  삭제된 파일 경로를 수동 배열로 중복 보관하지 않는다.

완료 조건:

- `docs/README.md`만 읽어도 현재 정본을 찾을 수 있다.
- 과거 문서가 현재 구현 지시처럼 노출되지 않는다.
- 문서 삭제가 제품 CI 실패를 만들지 않는다.

### Phase 8 — 최종 배포 표면 잠금

1. MCP package allowlist를 재검증한다.
2. esbuild metafile에서 최종 runtime dependency를 보관한다.
3. plugin package allowlist 또는 manifest reachability 검사를 추가한다.
4. 퇴역 도구·17명 agent·전역 registry·legacy writer의 금지 문자열 gate를
   추가한다.
5. CI에서 다음을 한 번만, 명확한 이름으로 실행한다.
   - package build/typecheck
   - protocol + unit
   - actual stdio E2E
   - packed tarball E2E
   - damaged-ledger refusal
   - migration fixtures
   - plugin validate/install smoke
   - root tests and security gates

최종 완료 조건:

- 공개 MCP 도구 6개.
- 호출 가능한 별칭 0개.
- plugin agent 4개.
- 고정 모델 0개.
- 전역 프로젝트 registry 0개.
- 새 legacy items writer 0개.
- 버전 이름 runtime 폴더 0개.
- 웹→MCP source 상대 import 0개.
- 복제된 공용 domain source 0개.
- 문서 정본 색인 1개.
- npm dry-run allowlist 통과.
- GitHub Actions, GitGuardian, 배포 검증 전체 green.

---

## 6. 삭제 판정 규칙

파일은 아래 셋 중 하나를 만족할 때만 삭제한다.

1. 최종 사용자 목적에 필요 없고 import/runtime/package reachability가 0이다.
2. 동일 기능이 최종 구조로 이전됐고 행동·데이터 parity가 증명됐다.
3. 창업자가 기능 범위 자체를 명시적으로 종료했고 기존 사용자 데이터
   migration이 필요 없다.

아래 이유만으로는 삭제하지 않는다.

- 파일 이름에 v2/v3/v4 또는 legacy가 들어감
- 테스트가 현재 불편함
- 코드가 길거나 이해하기 어려움
- 새 구현이 더 예뻐 보임
- 다른 세션의 작업 의도를 모름

삭제와 동시에 해야 하는 것:

- import/reference 제거
- docs/evidence 갱신
- package/manifest 갱신
- 대체 테스트 또는 삭제 사유 기록
- migration 필요 여부 확인
- `git diff --check`

---

## 7. 병렬 세션 작업 규약

다른 세션은 이 절을 먼저 읽는다.

1. 기준 커밋 `9bc2a70b`는 reset 목표가 아니라 설명 기준점이다.
2. 작업 시작 시 최신 `origin/main` 위에서 diff를 다시 계산한다.
3. 다른 세션의 커밋을 되돌리거나 과거 파일로 덮어쓰지 않는다.
4. `public-tools.ts`, v3 domain, v4 foundation, premise core,
   decision-ledger migration을 수정하기 전 해당 영역의 열린 작업을 확인한다.
5. 정리 PR은 한 phase와 한 책임만 가진다.
6. 대량 rename과 행동 변경을 같은 PR에 넣지 않는다.
7. 충돌이 나면 최종 여섯 도구와 one-dataset ADR을 기준으로 수동 통합한다.
8. 어느 쪽 구현이 최신인지 불명확하면 코드를 지우지 말고
   `active-parallel-work`로 표시한다.
9. unrelated local file
   `.claude/hookify.block-claude-process-kill.local.md`는 커밋하지 않는다.
10. 각 PR 설명에 아래를 적는다.
    - 삭제한 파일/심벌
    - 삭제 가능한 근거
    - 대체 최종 경로
    - 보존한 데이터 호환성
    - 실행한 검증
    - 다음 phase의 blocker

권장 PR 순서:

1. inventory + dead leaf
2. six-tool internal convergence
3. shared domain ownership
4. legacy importer and writer retirement
5. version-folder removal
6. plugin minimization and rename
7. docs/archive cleanup
8. final release lock

---

## 8. 검증 명령

각 phase에서 최소:

```powershell
git diff --check
npm run lint
npx tsc --noEmit
npx vitest run --coverage --reporter=dot
npm --prefix argus-mcp run verify
node argus-plugin-v2/scripts/validate-plugin.js
node argus-plugin-v2/scripts/install-smoke.mjs
```

경로 rename 이후에는 마지막 두 명령의 새 경로를 사용한다.

최종 문자열·표면 감사 예:

```powershell
rg -n "argus_(open_decision|review|premises|seal|recheck|settle|recall|sync|amend|dismiss|candidates|watch|init|config|record)" argus-mcp argus-plugin src
rg -n "(chief_strategist|navigator|research_director|strategy_jr|donghyuk|hayoon|hyeyeon|hyunwoo|jieun|junseo|minjae|minseo|seoyeon|sujin|sujin_hr|taejun|yerin)" argus-plugin src
rg -n "\.argus/items\.jsonl|readGlobalBoundList|~/.argus/.bound" .
rg -n "argus-mcp/src/(v2|v3|v4)" src
```

검색 결과가 무조건 0이어야 하는 것은 아니다. migration fixture와
CHANGELOG는 과거 이름을 설명할 수 있다. 그러나 runtime, skill, current docs,
tool descriptor에서 발견되면 완료가 아니다.

---

## 9. 현재 품질 기준선

1차 정리와 후속 CI에서 확인된 기준선:

- MCP test files 114개, tests 1,090개 통과
- 최종 MCP/plugin verification 10개 gate 통과
- plugin simulation 8/8 통과
- repository static gates 29/29
- signal checks 64/64
- root coverage test 통과
- TypeScript 통과
- lint error 0
- packed MCP E2E 통과
- actual stdio picker round-trip 통과
- unreadable ledger write refusal 통과
- GitGuardian 통과
- Vercel 배포 검증 통과
- GitHub Actions 전체 green

정리 후 테스트 수가 줄어드는 것 자체는 실패가 아니다. 다만 삭제한 테스트가
보호하던 사용자·안전·데이터 계약이 어디로 갔는지 설명하지 못하면 실패다.

---

## 10. 최종 판정과 다음 세션의 첫 행동

현재 상태:

- 외부 공개 표면: 크게 정리됨
- 모델의 레거시 도구 오호출: 차단됨
- 하네스 비용: 크게 줄어듦
- 플러그인 역할: 네 책임으로 수렴
- 내부 source ownership: 아직 복잡함
- 버전 폴더: live/migration/experimental이 혼재
- legacy data writer: importer 전이라 일부 유지
- 문서 정본성: 아직 불명확

따라서 다음 세션은 곧바로 v2/v3/v4 폴더를 삭제하지 않는다. 첫 작업은
**Phase 0 inventory와 다른 세션의 active file 확인**, 두 번째 작업은
**Phase 1 dead leaf 제거**다. one-dataset/event-envelope 작업이 진행 중이면
Phase 3과 4는 그 결과를 정본으로 받아 이어간다.

완전 정리의 목적은 줄 수를 최소화하는 것이 아니다. 최종 사용자 목적,
도메인 정본, 데이터 writer, 배포 경로가 각각 하나의 명확한 주인을 갖게
하는 것이다. 그 상태가 되면 큰 삭제는 결과로 따라오며, 그 전의 무차별
삭제는 정리가 아니라 회귀다.
