# Argus MCP · Plugin 전면 개편을 위한 현재 상태 리뷰

작성일: 2026-07-16
성격: 현재 로컬 코드 스냅샷에 대한 제품·아키텍처·사용성 리뷰 및 개편 계획 입력 문서
대상: Argus MCP, `argus-driver`, `argus-plugin-v2`를 전면 개편하는 다음 작업 세션

## 0. 이 문서의 목적과 경계

이 문서는 현재 세션에서 코드를 수정하지 않고 다음을 남기기 위해 작성했다.

1. 지금 Argus MCP와 두 Claude Code 플러그인이 실제로 어떤 구조인지 설명한다.
2. 현재 코드가 잘하고 있는 것과 제품 차원의 모순을 분리한다.
3. 누가 어떤 형태로 Argus를 사용할 가능성이 높은지 정리한다.
4. Argus가 일상적인 기본 도구가 되기 위해 무엇을 우선 보완해야 하는지 제안한다.
5. 다른 세션이 전면 개편 계획을 세울 때 확인해야 할 결정 사항, 순서, 검증 기준을 제공한다.

이 문서는 구현 지시서나 확정 사양이 아니다. 특히 제품 철학, 사용자에게 추천을 제공할지 여부, rich plugin의 브랜드·범위는 창업자가 결정해야 한다. 다만 현재 코드에서 관찰되는 충돌과 위험은 숨기지 않는다.

### 리뷰 기준 상태

- 작업 디렉터리: `C:\Users\SAMSUNG\Documents\GitHub\commet\Argus`
- 브랜치: `main`
- 관찰 당시 브랜치 상태: `origin/main` 대비 ahead 1, behind 32
- 기존 로컬 수정 파일:
  - `.claude/launch.json`
  - `README.ko.md`
  - `README.md`
  - `argus-mcp/src/lib/validate-seal.ts`
  - `argus-plugin-v2/scripts/validate-gates.mjs`
  - `argus-plugin-v2/scripts/validate-gates.test.mjs`
- 이 리뷰는 위 로컬 변경을 포함한 현재 작업 트리를 읽었다.
- 이 문서를 추가하는 것 외에는 코드나 기존 문서를 수정하지 않았다.

## 1. 요약 판단

Argus의 핵심 원리는 이미 강하다. 특히 다음 루프는 분명하고 차별적이다.

```text
결정 포착
  → 사용자의 말로 반증 가능한 예측 저장
  → 확인일에 현실이 무엇을 했는지 기록
  → 모델이 사용자를 채점하지 않는 판단 영수증
```

문제는 코어의 품질보다 제품 경계다. 현재 저장소에는 사실상 세 제품이 겹쳐 있다.

1. **Argus MCP**: 결정론적 decision-accountability 코어
2. **argus-driver**: MCP를 Claude Code에 배선하고 복귀를 돕는 얇은 플러그인
3. **argus-plugin-v2**: 별도 상태 머신, 20개 스킬, 다중 에이전트, 버전 트리, Boss 리뷰를 가진 rich decision orchestration 제품

이 셋은 같은 브랜드와 일부 파일 계약을 공유하지만, 아직 하나의 코어와 얇은 어댑터 관계는 아니다. 특히 `argus-plugin-v2`는 MCP 코어를 호출하지 않고 같은 원장 의미와 쓰기·재생 규칙을 별도로 구현한다.

따라서 현재의 가장 큰 위험은 기능 부족이 아니라 다음 네 가지다.

1. **제품 정체성 충돌**: MCP는 추천·평결을 구조적으로 금지하지만 rich plugin은 `Recommendation`을 기본 산출물로 제공한다.
2. **두 번째 코어**: plugin이 MCP의 원장·상태 전이를 호출하지 않고 다시 구현한다.
3. **첫 가치까지의 과도한 비용**: 중요한 결정 한 번에 여러 질문, 2~4개 에이전트, 약 4~12분이 소요될 수 있다.
4. **실사용 가치 증거 부재**: 구조 검증은 강하지만 P5가 요구한 실제 완료 루프와 비교군은 아직 없다.

권장되는 큰 방향은 다음과 같다.

> Argus MCP를 유일한 판단 기록 코어로 확정하고, `argus-driver`를 기본 Claude Code 제품으로 삼으며, `argus-plugin-v2`의 rich orchestration은 명시적으로 요청할 때만 실행되는 고급 리뷰 제품으로 축소·재구성한다.

## 2. 현재 제품 구조

### 2.1 MCP: 가장 완성도가 높은 코어

MCP의 공개 도구는 여섯 개다.

| 공개 도구 | 사용자 목적 |
|---|---|
| `argus_capture` | 결정, 전제, 열린 질문을 사용자의 말로 포착 |
| `argus_predict` | 반증 가능한 예측과 확인일 저장 |
| `argus_check_in` | 지금 확인해야 할 기록만 표시 |
| `argus_resolve` | 현실에서 실제로 일어난 결과 기록 |
| `argus_patterns` | 기존 결정·영수증·누적 기록 읽기 |
| `argus_settings` | 언어·알림·동기화 설정 관리 |

근거:

- `argus-mcp/src/tools/index.ts:20-31`
- `argus-mcp/src/tools/public-tools.ts:276-383`
- `argus-mcp/README.md:165-189`

내부적으로는 더 많은 legacy 도구가 `TOOL_MAP`에 남아 있지만, 신규 host의 `tools/list`에는 목적형 공개 도구만 노출한다. 이 방향은 좋다. 사용자가 상태 머신의 부품을 배울 필요가 없기 때문이다.

MCP 코어의 강점은 중요한 규칙을 LLM의 지시문 준수에만 맡기지 않는다는 점이다.

- 평결·추천 도구가 존재하지 않는다.
- 예측 없이 결과를 기록하려 하면 거절한다.
- malformed seal을 거절한다.
- 원장은 append-only event log로 재생한다.
- 도구 호출은 같은 서버 안에서 직렬화해 read-replay-append 경합을 줄인다.
- v2 원장은 lock, `O_APPEND`, torn final line 방어, `fsync`, idempotency를 고려한다.
- 사용자 문장과 AI가 제시한 문장의 provenance를 분리한다.
- 로케일과 오류 표면을 한국어·영어로 분리한다.

주요 근거:

- `argus-mcp/src/lib/spine.ts`
- `argus-mcp/src/server.ts`
- `argus-mcp/src/lib/ledger-append.ts`
- `argus-mcp/src/lib/ledger-replay.ts`
- `argus-mcp/src/v2/ledger.ts`
- `argus-mcp/src/v2/bridge.ts`

### 2.2 argus-driver: 일상용 기본 제품에 가장 가까운 표면

`argus-driver`는 다음만 담당한다.

1. `.mcp.json`으로 `argus-decision-mcp@^1` 자동 배선
2. SessionStart에서 stale projection·due item·수확 큐를 감지하고 사실만 전달
3. 선택적으로 durable ledger-aware statusline 제공
4. 읽기 전용 doctor 제공

근거:

- `argus-driver/.mcp.json`
- `argus-driver/README.md`
- `argus-driver/hooks/session-start.js`
- `argus-driver/scripts/doctor.js`

이 플러그인은 원장을 직접 수정하거나 별도 판단 코어를 구현하지 않는다. stale 상태를 발견해도 자체적으로 고치지 않고 `argus_check_in` 또는 `argus_settings`라는 코어 손잡이로 돌려보낸다. 이는 저장소가 문서로 합의한 목표 구조인 “one deterministic core, thin adapters”에 가장 가깝다.

### 2.3 argus-plugin-v2: 강력하지만 별도 제품에 가까운 rich orchestration

현재 rich plugin의 주요 특징은 다음과 같다.

- plugin version: 2.7.0
- 사용자 스킬: 20개
- 전체 `SKILL.md`: 약 5,000줄
- agent persona: 17개
- 주요 흐름: `clarify → team → verify → boss → revise → Current Heading`
- artifact: session, draft tree, per-version analysis/workers/mix/verification/scaffold/current bearing
- 별도 scan/seal/settle/log/track/principles/sync 흐름
- SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop hooks

주요 사용자 명령은 다음과 같이 매우 넓다.

```text
sail, scan, seal, settle,
clarify, team, verify, boss, revise,
chart, log, principles, track,
configure, connect, push, pull, sync,
helm, help
```

근거:

- `argus-plugin-v2/.claude-plugin/plugin.json`
- `argus-plugin-v2/skills/help/SKILL.md`
- `argus-plugin-v2/skills/sail/SKILL.md`
- `argus-plugin-v2/skills/team/SKILL.md`

rich plugin의 장점은 실제 PR·파일·문서에 근거한 결과를 요구하고, worker 실패·challenged claim·human-required check를 깨끗한 성공으로 세탁하지 않으려는 규율이다. 특히 다음은 보존 가치가 높다.

- artifact를 주었는데 source-specific evidence가 없으면 실패로 간주
- 개발 결정은 파일·테스트·failure mode·최소 다음 패치를 요구
- worker 실패를 사용자 표면에서 숨기지 않음
- critical challenge가 해결되지 않으면 proceed로 라우팅하지 않음
- flat decision에서 fork·fog를 제조하지 않으려는 over-fire 규칙
- user-authored pole과 symmetric crux를 통해 모델의 은근한 tilt를 줄이려는 설계
- session artifacts를 write-once version directory로 분리해 merge conflict를 줄이려는 설계

하지만 이 규율 상당수는 prompt prose와 사후 validator에 의존한다. rich plugin의 핵심 상태 전이도 MCP 코어 호출이 아니라 스킬 지시문과 독립 JS 스크립트가 수행한다.

## 3. 현재 가장 중요한 제품 모순

### 3.1 “판단하지 않는다”와 “추천한다”의 충돌

MCP spine은 `verdict`, `recommend`, `decide`, `advise`, `grade`, `score`, `judge`, `rank`를 금지 동사로 둔다.

근거: `argus-mcp/src/lib/spine.ts:32-42`

서버 instructions도 다음을 명시한다.

- Argus records decisions; it does not judge them.
- Never deliver a verdict.
- Never manufacture a recommendation.

근거: `argus-mcp/src/lib/spine.ts:56-73`

반면 rich plugin은 설치 설명부터 결과를 recommendation이라고 부른다.

- plugin description: recommendation, why, risk, alternative, next action
- Current Heading render 첫 필드: `Recommendation: {{current_course.summary}}`
- course status: proceed, hold, fork, anchor, revise, collect_evidence

근거:

- `argus-plugin-v2/.claude-plugin/plugin.json:5`
- `argus-plugin-v2/skills/sail/SKILL.md:395-523`
- `argus-plugin-v2/skills/sail/SKILL.md:538-567`

이것은 단순 용어 문제가 아니다. 제품의 본질에 대한 선택이다.

#### 개편 세션에서 반드시 결정할 질문

1. Argus는 결정을 대신 추천하는가?
2. 아니면 사용자의 판단을 구조화하고 현실과 다시 대조하는가?
3. 둘 다 한다면 한 모드 안에 섞을 것인가, `Advisor`와 `Ledger`처럼 권한을 명시적으로 분리할 것인가?

#### 이 리뷰의 권고

기본 제품은 추천하지 않는 편이 낫다. 일반 모델은 이미 추천을 제공한다. Argus의 방어 가능한 차별점은 추천의 질이 아니라 다음의 지속성이다.

```text
당시 무엇을 믿었는가
무엇이 틀리면 생각을 바꾸기로 했는가
실제로 현실은 무엇을 보여줬는가
```

rich review가 방향성을 제공해야 한다면 `Recommendation`보다 다음 형태가 제품 철학에 더 맞다.

- 현재 판단 구조
- 가장 강한 근거
- 결정을 뒤집을 핵심 전제
- 지금 할 수 있는 가장 작은 현실 검증
- 사용자가 선택한 다음 행동

### 3.2 같은 원장 의미를 두 구현이 소유

MCP의 v1 writer/replay와 v2 durable ledger는 다음을 구현한다.

- lock
- true append
- torn-write 방어
- fsync
- versioned event tolerance
- guarded transition
- idempotency
- migration/binding

반면 rich plugin의 `scripts/decision-ledger.js`는 별도 event replay와 `appendFileSync`를 사용한다.

근거:

- `argus-mcp/src/lib/ledger-append.ts`
- `argus-mcp/src/v2/ledger.ts`
- `argus-plugin-v2/scripts/decision-ledger.js:84-170`
- `argus-plugin-v2/scripts/check-contracts.js`
- `argus-plugin-v2/statusline/index.js`

plugin의 settle 스킬에는 `O_APPEND`, write verification, id stability 규칙이 자세히 적혀 있지만, 이는 코어 API가 아니라 모델이 따라야 하는 실행 지시문이다.

근거: `argus-plugin-v2/skills/settle/SKILL.md:89-140`, `184-198`

결과적으로 같은 이벤트 의미가 다음 위치에 반복된다.

- MCP v1 append/replay
- MCP v2 durable append/reducer
- MCP v3 semantic pilot
- rich plugin decision-ledger
- rich plugin check-contracts hook
- rich plugin statusline
- driver hook/statusline compatibility reader

모든 복제가 잘못은 아니다. zero-dependency statusline은 읽기 projection을 독립 구현할 수 있다. 하지만 **쓰기와 상태 전이의 두뇌는 하나여야 한다.**

#### 권장 수렴

- `/argus:seal` → `argus_predict`
- `/argus:settle` → `argus_resolve`
- `/argus:log` → `argus_patterns`
- premise/track 수정 → `argus_capture`
- config/sync → `argus_settings`
- rich plugin의 검토·에이전트 orchestration만 plugin에 남김

### 3.3 사용자에게 보이는 용어가 두 언어 체계

MCP는 plain vocabulary를 사용한다.

```text
decision, prediction, check-by, resolve, outcome, receipt,
premise, assumption, crux, patterns
```

rich plugin은 항해 은유를 사용한다.

```text
sail, seal, settle, bearing, fog, reef, anchor,
crew, helm, voyage, chart, wake
```

`argus-plugin-v2/DEJARGON-AND-FRICTION-PLAN.md`도 이 문제를 “한 제품이 두 언어를 말한다”고 정확히 진단한다. statusline은 내부 `anchor`를 사용자에게 `done`으로 번역한다. 반복 표면에서 자체 용어를 번역해야 한다면 기본 카드에서도 해독 비용이 있다는 뜻이다.

#### 권고

- 외부 용어는 MCP의 plain canon으로 통일한다.
- 항해 은유를 유지하려면 브랜드 장식이나 내부 artifact 이름으로 제한한다.
- 명령 이름까지 바꿀지는 migration alias 기간을 두고 결정한다.
- 한 번에 전체 rename을 수행한다. 부분 rename은 현재보다 혼란스럽다.

### 3.4 기본 설치 경로가 명확하지 않음

현재 사용자는 다음 선택지를 마주한다.

- root README의 MCP 한 줄 설치
- root README의 native plugin 안내
- root README 뒤쪽의 legacy `curl install.sh`
- marketplace의 `argus@argus`
- marketplace의 `argus-driver@argus`
- web app

`argus-driver`가 목표 구조에 가장 가깝지만 root README의 주력 Claude Code 제품으로 자리 잡지 못했다. rich plugin과 driver 중 무엇을 설치해야 하는지도 명확하지 않다.

근거:

- `README.md:14-45`
- `README.md:194-235`
- `.claude-plugin/marketplace.json`
- `argus-driver/README.md`

#### 권고

사용자 선택을 세 개로 제한한다.

1. Web: 설치 없이 체험
2. MCP: 모든 지원 host의 기본 코어
3. Claude Code: MCP를 포함한 thin driver

rich review는 driver 설치 후 명시적으로 추가하거나 같은 패키지의 advanced command로 제공하되, 기본 loop와 분리한다.

## 4. 사용성 및 습관 형성 분석

### 4.1 가장 잘 맞는 사용자

#### A. Claude Code를 매일 쓰는 개발자·테크리드

대표 순간:

- PR을 병합하기 전
- schema/database migration을 실행하기 전
- 큰 refactor의 범위를 확정하기 전
- AI가 만든 구현 계획을 승인하기 전
- auth, billing, permissions처럼 실패 비용이 큰 영역을 건드리기 전

일상 흐름은 full crew가 아니라 다음이어야 한다.

```text
평소: driver가 조용히 check-in
결정 순간: 한 번의 prediction 제안
큰 결정: 사용자가 명시적으로 deep review 호출
확인일: 결과 기록과 receipt
```

#### B. 창업자·PM·독립 메이커

대표 결정:

- 출시 시점
- 가격
- 채용
- 공급업체
- 시장 진입
- 고객 세그먼트
- 중요한 프로젝트 중단/지속

이 사용자에게 장기 가치가 있는 것은 agent persona 수보다 판단 기록의 누적이다. “당시 전제와 실제 결과”가 재사용 가능한 자산이 된다.

#### C. AI의 과도한 확신과 아첨을 싫어하는 power user

이들은 더 좋은 답보다 provenance, falsifiability, no-grade receipt, append-only history를 높게 평가할 가능성이 크다. 현재 MCP 철학과 가장 잘 맞는 사용자다.

### 4.2 현재는 잘 맞지 않는 사용자

- 점심 전에 끝낼 수 있는 사소하고 되돌리기 쉬운 선택
- boilerplate 생성이나 단순 정보 조회 사용자
- 별도 학습 없이 즉시 화려한 추천을 기대하는 일반 소비자
- 모바일·remote-only MCP 환경 사용자. 현재 package는 local stdio 중심이다.
- 조직 차원의 권한, retention, audit, shared governance를 기대하는 엔터프라이즈 팀

팀 사용 가능성은 있지만 현재 기본은 personal/local이다. `.argus/sessions`와 ledger는 gitignored이며, sync도 명시적이다. 팀 제품을 주장하려면 access control, shared canonical history, redaction policy, retention, conflict semantics가 별도 제품 수준으로 필요하다.

## 5. 일상적인 기본 도구가 되는 데 막히는 지점

### 5.1 첫 가치까지 너무 오래 걸릴 수 있음

rich plugin은 medium/high decision에서 약 4~8분 또는 8~12분을 예고한다. 기본 stakes 경로에서도 team과 critique가 들어가며 2~4개 agent를 사용할 수 있다.

근거:

- `argus-plugin-v2/skills/sail/SKILL.md:304-360`
- `argus-plugin-v2/skills/team/SKILL.md:124-209`
- `argus-plugin-v2/skills/team/SKILL.md:244-275`

이 비용은 “중요할 때 여는 분석실”에는 정당할 수 있지만, “항상 켜져 있는 기본 도구”에는 맞지 않는다.

#### 목표

- 기본 경로: 수 초~20초 안에 한 화면
- 기본 사용자 질문: 최대 1회
- disambiguation이 꼭 필요할 때만 예외적으로 2회
- multi-agent: 명시적인 deep review에서만
- 비용·시간을 실행 전에 표시

### 5.2 첫 세션의 보상보다 미래 약속이 큼

Argus의 가장 강한 차별점은 `predict → reality → resolve` 뒤에 나타난다. 이는 본질적으로 시간이 걸린다. patterns도 여러 settlement가 쌓여야 통계적 의미가 생긴다.

따라서 첫 세션은 다음 즉시 가치를 제공해야 한다.

```text
내가 선택한 것
이 선택이 기대는 한 가지 전제
무엇이 나오면 다시 볼 것인지
언제 현실을 확인할 것인지
```

첫 resolve에서는 통계가 아니라 한 장의 `then vs now` 비교가 보상이어야 한다.

```text
그때의 예측
그때의 핵심 전제
실제로 일어난 일
사용자가 직접 적은 해석
AI VERDICT: NONE
```

패턴 통계는 3건 이후여도 되지만 회고 가치는 1건부터 보여줘야 한다.

### 5.3 return channel이 host마다 다르고 zero-config attention에 간극이 있음

MCP README는 서버가 수동적이며 주기적으로 스스로 깨울 수 없다고 정직하게 밝힌다. 현재 복귀 채널은 다음이다.

- 모든 tool response의 quiet due note
- `argus_check_in`
- `argus://attention` resource
- Claude Code driver SessionStart hook
- 선택적 statusline
- account sync를 통한 이메일
- calendar artifact

근거: `argus-mcp/README.md:191-207`

하지만 `resolveArgusDirForResource()`는 현재 `ARGUS_DIR`이 설정됐을 때만 directory를 반환한다. tool의 zero-config 기본값인 `~/.argus`나 기록된 `.bound`를 resource read에서는 사용하지 않는다.

근거: `argus-mcp/src/lib/argus-dir.ts:120-129`

즉 zero-config 설치에서 tools는 작동해도 passive attention resource는 unbound가 될 수 있다. “매일 돌아오는 도구”의 핵심 경로이므로 우선 확인해야 한다.

#### 개편 시 선택지

1. resource도 zero-config `~/.argus`를 사용
2. 마지막 bound directory를 사용하되 multi-project ambiguity를 명시
3. `argus://attention`을 global fleet view로 정의해 여러 project를 집계
4. driver가 현재 repo context를 안정적으로 제공

어느 쪽이든 tools와 resources가 같은 저장 위치 모델을 말해야 한다.

### 5.4 핵심 gate 일부가 사후 검사

MCP의 falsifiability·transition·no-prior-seal 같은 규칙은 결정론적이다. 반면 rich plugin의 tilt, manufactured fog/fork, evidence quality 규칙은 주로 prompt instruction이며 `Stop` hook에서 `validate-gates.mjs --latest --warn`으로 검사한다.

근거:

- `argus-plugin-v2/hooks/hooks.json`
- `argus-plugin-v2/scripts/validate-gates.mjs`
- `argus-plugin-v2/evals/static-gate.mjs`

사후 경고는 회귀 탐지에는 유용하지만 사용자가 이미 본 첫 결과를 막지는 못한다. 사용자 신뢰를 좌우하는 gate는 다음 중 하나로 이동해야 한다.

- render 전 deterministic validator
- schema-constrained assembly function
- MCP/core tool precondition
- 실패 시 결과를 내보내지 않는 hard gate

### 5.5 로케일·설명·문서 표면에 작은 불일치가 남음

관찰된 예:

- `argus_capture`, `argus_patterns`, `argus_settings` public schema의 field description 상당수가 한국어이며 high-level presentation만 bilingual이다.
- root README의 설치 안내가 marketplace와 legacy curl 경로를 함께 제시한다.
- repo map과 build status에는 과거 version/skill 수가 남아 있다.
- MCP README는 zero-config `~/.argus`와 project `.argus`를 문맥에 따라 달리 설명한다.
- statusline 구현은 `risk:`를 사용하지만 테스트는 과거 `🌫` glyph를 기대한다.

이들은 개별적으로 작지만 설치·도구 선택·신뢰 형성 단계에서 누적된다.

## 6. 저장 구조의 현재 전환 상태

현재 저장 계층은 한 세대로 끝나지 않는다.

### v1

- workspace 또는 지정 `argus_dir` 아래 `.argus/ledger/ledger.jsonl`
- 기존 도구와 plugin이 주로 기대하는 event shape
- MCP `appendLedger()`의 현재 기본 write path

### v2 durable ledger

- `~/.argus/projects/{repository_id}/ledger.jsonl`
- git common dir 기반 repository identity
- worktree에는 `.argus/project.json` binding/projection만 둠
- lock, event envelope, provenance, idempotency, reducer guard 제공
- v1 write 뒤 mirror되는 전환 구조

### v3 semantic pilot

- `semantic-v3.jsonl`
- `ARGUS_DKK_V6_PILOT=1`에서만 공개되는 `argus_record`
- explicit authorization, observation, resolution, closure를 의미적으로 분리
- P5 value gate가 HOLD이므로 일반 표면으로 승격되지 않음

근거:

- `argus-mcp/src/lib/ledger-append.ts`
- `argus-mcp/src/v2/ledger.ts`
- `argus-mcp/src/v2/events.ts`
- `argus-mcp/src/v3/store.ts`
- `argus-mcp/src/tools/semantic-record.ts`
- `docs/ADR-2026-07-14-dkk-v6-p5-value-gate.md`

### 개편 원칙

- 사용자가 이해해야 하는 canonical ledger는 하나여야 한다.
- migration reader와 compatibility mirror는 내부 구현이어야 한다.
- v3 semantic model이 가치 검증 전이면 현재 제품 카피와 기본 흐름이 이를 전제로 과장되어서는 안 된다.
- rich plugin session artifact와 personal judgment ledger를 같은 것으로 취급하지 않는다.
  - session artifact: 분석 과정, worker 결과, version tree
  - judgment ledger: 사용자가 채택한 판단, 예측, 현실 결과

## 7. 권장 목표 제품 구조

### 7.1 Argus Core

역할: 모든 surface가 공유하는 유일한 결정론적 판단 기록 코어

소유해야 하는 것:

- capture/predict/resolve/check-in/patterns/settings 의미
- ledger event schema
- transition guard
- authorship/provenance
- falsifiability validation
- due calculation
- receipt generation
- storage migration
- sync contract
- privacy defaults

소유하지 않아야 하는 것:

- 모델이 어떤 분석 프레임을 사용할지
- 몇 개 agent를 실행할지
- MBTI persona
- PR review의 구체적인 분석 내용

### 7.2 Argus Driver

역할: Claude Code에서 Core를 일상적으로 사용할 수 있게 하는 기본 제품

권장 기본 기능:

- MCP 자동 배선
- SessionStart check-in
- 현재 repo binding
- one-time onboarding
- optional statusline
- doctor
- 명시적 privacy/harvest consent

기본 설치 이름은 사용자에게 `Argus` 하나로 보여주는 편이 낫다. 내부 package가 driver라는 사실은 중요하지 않다.

### 7.3 Argus Review

역할: 사용자가 중요한 결정을 깊게 검토하고 싶을 때만 호출하는 premium orchestration

권장 범위:

- artifact intake
- real code/PR/document grounding
- one crux
- source-backed reasons
- one load-bearing risk
- smallest reality check or engineering action
- optional multi-agent review
- output을 Core의 `capture/predict`로 넘길 수 있는 draft 생성

권장하지 않는 기본 동작:

- 모든 중요해 보이는 질문에 자동 multi-agent 실행
- 20개 명령을 사용자에게 노출
- plugin 자체 ledger write/replay
- 기본 MBTI setup
- 사용자가 요청하지 않은 추천/결론 권한

브랜드 선택지:

- 별도 plugin 이름: `argus-review`
- 같은 driver 안 advanced skill: `/argus:review --deep`
- 기존 `sail` alias는 compatibility 기간만 유지

## 8. 우선순위 제안

## P0. 제품 경계와 신뢰 회복

### P0-1. 추천 권한 결정

완료 조건:

- MCP, driver, rich review가 같은 문장으로 Argus의 역할을 설명
- `Recommendation`을 유지할지 제거할지 결정
- 유지한다면 user-requested advisory mode와 ledger mode의 권한 경계 명시
- install description, help, Current Heading, receipt copy가 같은 철학 사용

### P0-2. 기본 Claude Code 설치를 driver로 통일

완료 조건:

- root README에서 Claude Code 기본 경로 하나
- marketplace에서 기본/advanced 관계 명확
- legacy curl install은 migration 문서로 이동하거나 제거
- 첫 설치 후 사용자가 배워야 할 명령 0~1개

### P0-3. plugin의 ledger write를 MCP Core 호출로 치환

완료 조건:

- seal/settle/log/track/config/sync가 공개 MCP 도구를 사용
- plugin script가 canonical ledger event를 직접 쓰지 않음
- hook/statusline은 read-only projection 또는 Core 호출만 수행
- plugin/MCP vocabulary와 outcome mapping drift 테스트 추가

### P0-4. zero-config attention 복구

완료 조건:

- 환경변수 없는 설치에서 tool과 resource가 같은 ledger를 봄
- single project와 multi-project 의미가 명확
- install → predict → restart/session start → due attention → resolve 경로 자동 테스트

### P0-5. release 전체 green

완료 조건:

- locale, timezone, home, current date를 테스트에서 명시적으로 고정
- built protocol test가 다른 suite와 경합하지 않음
- statusline stale expectation 수정
- Windows와 non-Korean CI에서 동일 결과
- release 문서의 pass 숫자가 실제 현재 suite와 일치

## P1. 첫 가치와 기본 루프 단축

### P1-1. 기본 interaction 최대 1회

- ready-made prediction draft
- Keep / Reword / Skip
- disambiguation을 제외하면 추가 질문 없음
- free-text를 처음부터 요구하지 않음

### P1-2. immediate decision snapshot

- decision
- one premise
- flip signal
- check date
- provenance

### P1-3. 첫 resolve payoff 강화

- receipt 본문을 host가 structured data를 숨겨도 surface에서 볼 수 있게 함
- then vs now를 한 화면에 표시
- no grade 유지
- full file/absolute path 또는 stable reopen handle 제공 여부 결정

### P1-4. rich review를 명시적 opt-in으로

- 기본 경로 수 초
- `--deep`에서만 agent budget과 4~12분 preview
- flat/reversible case에서는 즉시 restraint

## P2. 표면과 용어 수렴

### P2-1. plain vocabulary 통일

- predict / resolve / patterns / decision / premise / risk / current call
- command alias migration 기간 정의
- 내부 artifact 이름 변경은 별도 compatibility plan과 함께

### P2-2. 사용자 명령 축소

권장 외부 표면 예:

```text
자연어 기본 사용
/argus:review      명시적 깊은 검토
/argus:check       지금 볼 것
/argus:history     기록
/argus:settings    설정/doctor
```

내부 clarify/team/verify/revise 단계는 사용자에게 목록으로 판매하지 않는다.

### P2-3. docs single source

- 제품별 audience와 install path
- storage 위치
- privacy/sync 조건
- passive reminder의 한계
- measured와 unmeasured claim 구분
- version/current command inventory 자동 검증

## P3. 가치가 검증된 뒤의 확장

- remote HTTP transport
- mobile/remote host experience
- team/shared ledger
- organization policy/audit
- richer pattern analytics
- automated premise watch
- additional orchestration/personas

P5가 통과하기 전에 P3를 기본 제품 주장으로 끌어올리지 않는 것이 좋다.

## 9. 실제 사용자 검증 계획

현재 P5 문서는 다음을 사실로 기록한다.

- structural lane 통과
- real v6 pilot cycle 0
- matched baseline cycle 0
- 최소 조건별 10 completed cycles 필요
- 결과는 `hold`

근거: `docs/ADR-2026-07-14-dkk-v6-p5-value-gate.md:49-68`

개편은 다음 퍼널을 측정해야 한다.

### Activation

- install → 첫 유용한 call 비율
- 24시간 내 첫 prediction 비율
- 첫 가치까지 걸린 시간
- 첫 흐름의 사용자 질문 수

### Prediction quality and friction

- Keep / Reword / Skip 비율
- user-authored vs ai-surfaced 비율
- invalid or vibe predicate 거절률
- prediction을 만들기 위해 사용자가 새 문장을 직접 작성해야 했던 비율

### Return loop

- due reminder 전달률
- due 후 7일 내 resolve 비율
- still_pending 후 재등장률
- receipt 열람률
- 30일 내 두 번째 completed loop 비율

### Perceived value

- “Argus가 없어지면 아쉬운 순간이 있는가?”
- 가장 가치 있었던 순간이 review인가, prediction인가, return인가, receipt인가?
- 사용자가 질문·시간 비용을 reconstruction benefit과 바꿀 의향이 있는가?

### Trust invariants

- fabricated user authorship 0
- outcome self-grading 0
- settle without explicit user outcome 0
- silent lost write 0
- reminder that can never resolve 0
- blocked result presented as executable 0

### 권장 go/no-go 전제

최소 10개의 실제 completed Argus lifecycle과 matched baseline을 확보하기 전까지 “일상 기본 툴로 검증됨”이라고 주장하지 않는다. 구조 검증은 출시 가능성을 보여주지만 습관 가치를 증명하지 않는다.

## 10. 이번 리뷰에서 실행한 검증

### MCP

명령:

```text
cd argus-mcp
npm test
```

관찰 결과:

```text
Test Files  4 failed | 83 passed (87)
Tests       6 failed | 846 passed (852)
```

실패 분류:

1. locale 관련 4건
   - 한국어 OS의 `Intl` locale이 테스트의 “기본 en” 가정과 충돌
   - `LANG=en_US`만 설정하고 `Intl`을 격리하지 않아 init이 `locale: ko`를 쓸 수 있음
   - 제품의 한국어 OS 동작 자체가 틀렸다고 단정할 수 없고, 테스트 환경 격리 문제에 가까움
2. check-in bounded test 1건
   - 25개의 실제 filesystem seal을 순차 수행하며 15초 timeout 초과
   - Windows I/O와 suite 병렬 부하에 민감
3. protocol resource test 1건
   - test journey는 `today_override=2026-07-02`를 사용하지만 resource는 실제 현재 날짜를 사용
   - 실제 2026-07-16 기준 premise가 다시 due가 되어 `fact_count=1`
   - logical clock을 resource까지 주입하지 못한 시간 격리 문제

해석:

- core state machine이 대량으로 무너진 결과는 아니다.
- 하지만 release suite가 locale·현재 날짜·filesystem 속도에 독립적이지 않다.
- 일상 기본 도구는 reminder와 날짜 의미가 핵심이므로 이 종류의 비결정성은 P0로 다루는 것이 맞다.

### rich plugin

실행한 명령과 결과:

```text
node scripts/validate-plugin.js
  → passed

node scripts/validate-gates.test.mjs
  → 22 passed, 0 failed

node scripts/test-decision-signals.mjs
  → 68 passed, 0 failed

node scripts/test-check-contracts.mjs
  → all 39 cases passed

node scripts/simulate-plugin.js
  → 8 cases, 1 negative simulation passed

node evals/static-gate.test.mjs
  → 12 passed, 0 failed

node scripts/test-statusline.mjs
  → 1 failed
```

statusline 실패는 narrow terminal case가 `🌫` glyph를 기대하지만 현재 구현은 plain `risk:`를 사용하기 때문이다.

근거:

- 기대값: `argus-plugin-v2/scripts/test-statusline.mjs:343-352`
- 현재 구현: `argus-plugin-v2/statusline/index.js:440-452`

이는 사용자 기능 결함보다는 테스트와 plain-language 변경 사이의 드리프트다.

## 11. 보존해야 할 것

전면 개편이 현재 코드의 좋은 규율까지 지우지 않도록 다음은 명시적으로 보존한다.

1. **No verdict / no grade receipt의 구조적 강제**
2. **사용자 문장과 AI draft의 provenance 분리**
3. **예측 없이 결과 기록 거절**
4. **still_pending을 terminal settlement로 처리하지 않음**
5. **append-only history와 과거 의미 불변**
6. **flat/reversible case에서 restraint**
7. **사용자가 제공한 artifact를 실제로 읽고 source-specific evidence 제공**
8. **worker/coverage 실패를 깨끗한 성공으로 세탁하지 않음**
9. **secret redaction과 local-first privacy**
10. **sync와 telemetry의 명시적 opt-in**
11. **corrupt/torn state를 조용히 정상으로 취급하지 않음**
12. **P5 HOLD를 GO로 과장하지 않음**

## 12. 과감히 줄이거나 뒤로 미뤄도 되는 것

1. 기본 사용자에게 보이는 20개 명령
2. 기본 설정의 MBTI Boss 질문
3. 모든 중요 결정에 자동 multi-agent crew
4. 기본 출력의 항해 은유 전체
5. plugin 자체 ledger writer/replayer
6. 사용자가 요청하지 않은 recommendation 권한
7. 실사용 가치 검증 전의 추가 persona·agent·pattern 기능
8. root README의 여러 설치 경로
9. 사용자에게 노출되는 v1/v2/v3 migration machinery

## 13. 개편 계획을 세우는 세션을 위한 결정 체크리스트

아래 질문을 코드 작업 전에 닫는 것이 좋다.

### Product authority

- [ ] Argus는 recommendation을 제공하는가?
- [ ] 제공한다면 언제, 누구의 명시적 요청으로, 어떤 disclosure와 함께 제공하는가?
- [ ] default mode의 한 문장 가치 제안은 무엇인가?

### Product packaging

- [ ] `argus-driver`가 기본 Claude Code plugin인가?
- [ ] rich plugin은 별도 package인가, advanced skill인가?
- [ ] 기존 `/argus:sail` 등의 alias를 얼마나 유지하는가?

### Core ownership

- [ ] canonical writer는 무엇인가?
- [ ] canonical reader/reducer는 무엇인가?
- [ ] plugin이 MCP public tools를 호출하도록 어떻게 연결할 것인가?
- [ ] v1/v2/v3 전환 종료 기준은 무엇인가?

### User experience

- [ ] 기본 흐름의 최대 질문 수는 몇 개인가?
- [ ] 첫 화면은 몇 초 안에 나와야 하는가?
- [ ] 첫 세션에서 즉시 주는 artifact는 무엇인가?
- [ ] multi-agent는 어떤 명시적 trigger에서만 실행되는가?

### Return loop

- [ ] zero-config attention의 canonical scope는 project인가 global인가?
- [ ] Claude Code 외 host에서 due item을 어떻게 다시 보여주는가?
- [ ] email/calendar/account sync가 core인가 optional companion인가?

### Evidence

- [ ] P5 실제 사용자 cohort와 baseline을 누가 어떻게 수집하는가?
- [ ] 어떤 수치가 iterate, hold, kill을 의미하는가?
- [ ] marketing claim과 measured claim을 어떻게 분리하는가?

## 14. 권장 개편 순서

전면 개편이라도 big-bang rewrite보다 다음 순서가 안전하다.

### 1단계: 결정과 표면 고정

- recommendation 권한 결정
- Core / Driver / Review 경계 확정
- plain vocabulary 확정
- install path 확정

산출물:

- 짧은 product contract
- surface map
- command map
- compatibility policy

### 2단계: writer 수렴

- rich plugin seal/settle/history/settings를 MCP로 전환
- plugin direct write 제거
- cross-surface contract tests
- v1/v2 migration 경로 유지

### 3단계: 기본 루프 축소

- one-tap predict
- immediate decision snapshot
- zero-config check-in/attention
- first receipt payoff
- rich review explicit opt-in

### 4단계: 테스트·릴리스 경화

- logical clock
- locale isolation
- temp home isolation
- Windows performance budget
- fresh install real host smoke
- docs inventory validation

### 5단계: 실제 사용자 관찰

- 최소 cohort 실행
- funnel 측정
- qualitative interview
- P5 재실행

### 6단계: 검증된 기능만 확장

- remote/mobile
- team/shared history
- advanced patterns
- additional orchestration

## 15. 최종 권고 형태

가장 설득력 있는 최종 구조는 다음과 같다.

```text
Argus Core
  모든 host에서 동일한 판단 기록 규율
  capture → predict → check-in → resolve → patterns

Argus Driver
  Claude Code 기본 설치
  자동 MCP 배선 + 조용한 복귀 + doctor/statusline

Argus Review
  중요한 순간에만 명시적으로 호출
  코드·PR·문서 grounded review
  결과를 Core에 저장할 ready-made draft로 전달
```

이 구조라면 Argus는 다음 두 요구를 동시에 만족할 수 있다.

- 평소에는 거의 보이지 않는 일상 기본 도구
- 정말 중요한 결정에서는 깊게 들어가는 고급 검토 도구

핵심은 두 모드가 같은 원장, 같은 provenance, 같은 no-grade discipline을 공유하는 것이다.

## 16. 한 문장 결론

Argus는 기능을 더 붙여야 일상 도구가 되는 것이 아니라, **MCP를 유일한 코어로 확정하고, driver를 기본 제품으로 삼고, rich plugin을 명시적 고급 리뷰로 재배치하며, 첫 가치와 복귀 비용을 줄여야** 일상 도구가 될 가능성이 높다.
