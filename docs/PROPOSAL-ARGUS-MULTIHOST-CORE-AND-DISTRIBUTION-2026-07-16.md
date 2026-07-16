# Argus 멀티호스트 Core·플러그인·설치 전략 제안

- 작성일: 2026-07-16
- 상태: **Discussion proposal**
- 검토 대상: Founder, Claude Fable, Argus 구현 담당자
- 결정 범위: Core/MCP/플러그인 경계, Claude Code·Codex 배포, 범용 설치기, 향후 TUI
- 관련 결정:
  - [`ADR-2026-07-14-total-architecture-direction.md`](./ADR-2026-07-14-total-architecture-direction.md)

이 문서는 기존 ADR을 대체하지 않는다. 기존의 **one deterministic core, many thin adapters** 방향을 실제 패키지 구조, 설치 경험, 호스트별 제품 경계로 구체화한다.

---

## 1. 결론

Argus는 하나의 제품과 하나의 결정 규율을 유지하되, 배포 표면은 호스트별로 나누는 것이 가장 적절하다.

```text
Argus
├─ Argus for Claude Code
├─ Argus for Codex
├─ Argus MCP
├─ Argus Web
└─ Argus TUI                         # 후속, 가치 검증 뒤
```

내부 구조는 다음을 목표로 한다.

```text
                    ┌─────────────────────────────┐
                    │         Argus Core          │
                    │ ledger · reducer · guards   │
                    │ provenance · due · receipt  │
                    └──────────────┬──────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
   Argus MCP adapter         Argus TUI adapter        Web/sync adapter
          │
          ├─ Argus for Claude Code
          ├─ Argus for Codex
          ├─ Cursor
          └─ other MCP hosts
```

여기서 플러그인은 MCP의 하위 비즈니스 로직이 아니다. 플러그인은 다음을 묶는 **호스트별 배포·워크플로 어댑터**다.

- MCP 연결 설정
- 호스트에 맞는 skills, hooks, commands, agents
- 온보딩과 도움말
- 호스트가 제공하는 고유 기능을 활용한 orchestration

최종 설치 추천은 **호스트별 공식 설치를 기본으로 하고, 선택형 범용 설치기를 보조로 제공하는 혼합형**이다.

```text
Claude Code 사용자  → Claude marketplace에서 Argus 하나 설치
Codex 사용자        → Codex marketplace에서 Argus 하나 설치
기타 MCP 사용자    → Argus MCP만 설치
여러 호스트 사용자 → npx argus install로 감지 후 선택 설치
```

플러그인을 설치한 사용자가 MCP를 별도로 이해하거나 추가 설치하게 만들지 않는다. 각 플러그인이 같은 Argus MCP를 자동 연결한다.

---

## 2. 왜 이 변경이 필요한가

현재 Argus는 제품 가치보다 구현 경계가 먼저 갈라져 있다.

### 2.1 현재 상태

- `argus-mcp/`는 deterministic decision-accountability 규칙과 MCP transport를 함께 가진다.
- `argus-plugin-v2/`는 Claude Code 전용 rich orchestration과 함께 일부 ledger/reducer 동작을 다시 구현한다.
- `argus-driver/`는 MCP 자동 연결, check-in, doctor, statusline을 제공하는 얇은 Claude Code 표면에 가깝다.
- Web은 별도 Supabase ledger와 UI 흐름을 가진다.
- 현재 `argus-plugin-v2`는 `.claude-plugin`, `${CLAUDE_PLUGIN_ROOT}`, Claude hooks와 agents에 의존하므로 Codex 플러그인으로 직접 재사용할 수 없다.

### 2.2 관찰된 문제

1. **같은 규칙의 복수 구현**
   - MCP, rich plugin, statusline, hooks가 ledger event와 projection을 각자 해석한다.
   - writer와 reducer가 여러 곳에 존재하면 결과와 용어가 함께 드리프트한다.

2. **호스트와 제품 가치의 결합**
   - Claude Code의 agents/hooks는 강력하지만 Argus의 핵심 가치가 Claude Code에 종속되면 Codex, Cursor, Desktop 등에서 제품이 달라진다.

3. **설치 선택의 모호함**
   - 사용자가 MCP, driver, rich plugin 중 무엇을 설치해야 하는지 이해해야 한다.
   - 구현 패키지 이름이 사용자 선택지로 노출된다.

4. **새 표면 추가 비용**
   - Codex plugin이나 TUI를 지금 구조에 바로 추가하면 세 번째, 네 번째 core 구현이 생길 가능성이 높다.

5. **터미널 안정성의 중복 비용**
   - statusline이 Unicode 폭과 ledger replay를 직접 구현한다.
   - 향후 TUI까지 같은 방식으로 만들면 Windows, CJK, resize, scrollback 문제가 표면마다 반복된다.

### 2.3 바꾸지 말아야 하는 핵심

- maximum generation, zero judgment
- user-authored와 ai-surfaced provenance 분리
- falsifiable prediction 없이 resolve 금지
- append-only history와 guarded transition
- flat/reversible decision의 restraint
- 명시적 사용자 outcome 없이 settle 금지
- no-grade receipt
- local-first privacy와 opt-in sync

Core 분리는 기능 확대가 아니라 이 규칙을 모든 표면에서 **한 번만 구현하기 위한 변경**이다.

---

## 3. 목표 아키텍처

### 3.1 `Argus Core`

Core는 LLM과 UI, 특정 호스트를 모르는 순수 TypeScript 도메인 계층으로 둔다.

#### Core가 소유할 것

- canonical event schema
- ledger append/replay 또는 storage port
- reducer와 state transition
- capture/predict/check-in/resolve/patterns/settings 도메인 함수
- falsifiability와 over-fire restraint gate
- authorship/provenance
- due calculation
- receipt projection
- migration과 compatibility reader
- locale/timezone을 주입받는 deterministic projection
- sync를 위한 도메인 계약

#### Core가 소유하지 않을 것

- MCP `Server` 객체와 transport
- Claude/Codex skill 문법
- host hook lifecycle
- multi-agent 구성
- Ratatui/Ink/React 렌더링
- MBTI 또는 특정 reviewer persona
- PR·문서 분석을 위한 LLM prompt

#### 권장 API 형태

구체적인 함수명은 구현 단계에서 확정하되 경계는 다음 형태가 적합하다.

```ts
type ArgusCore = {
  capture(input, context): Promise<CaptureResult>;
  predict(input, context): Promise<PredictResult>;
  checkIn(input, context): Promise<CheckInResult>;
  resolve(input, context): Promise<ResolveResult>;
  patterns(input, context): Promise<PatternsResult>;
};
```

`context`에는 clock, locale, storage, repository identity처럼 테스트 가능한 dependency를 주입한다. Core 내부에서 OS locale이나 현재 시간을 암묵적으로 읽는 경로를 줄인다.

### 3.2 `Argus MCP`

MCP는 Core를 MCP tools/resources로 번역하는 얇은 adapter다.

MCP가 담당할 것:

- tool/resource descriptor
- input/output schema와 protocol envelope
- stdio 및 향후 Streamable HTTP transport
- MCP capability negotiation과 elicitation fallback
- structuredContent와 text fallback
- MCP용 instructions
- MCP error code mapping

MCP가 담당하지 않을 것:

- Core와 다른 transition rule
- host별 orchestration
- Claude 또는 Codex 전용 copy
- 독자적인 ledger event

공식 MCP TypeScript SDK도 middleware와 runtime integration을 비즈니스 로직 없는 thin adapter로 유지하는 구조를 채택한다. Argus도 같은 원칙을 적용한다.

### 3.3 호스트별 플러그인

#### Argus for Claude Code

Claude plugin은 다음을 소유한다.

- `.claude-plugin/plugin.json`
- `.mcp.json`을 통한 Argus MCP 자동 연결
- Claude skills, commands, hooks, agents
- Claude Code의 artifact/PR/file grounding
- 명시적으로 요청된 deep review와 multi-agent orchestration
- optional statusline과 SessionStart attention

Core writer/reducer를 직접 구현하지 않는다. `seal`, `settle`, `history`, `settings`는 MCP/Core를 호출한다.

현재 `argus-driver`는 기본 Claude surface에 가장 가깝고, `argus-plugin-v2`는 rich review 자산을 가진다. 최종 패키징은 다음 둘 중 하나로 합의해야 한다.

1. `argus-driver`를 기본 `Argus for Claude Code`로 승격하고 rich review를 별도 opt-in plugin으로 유지
2. 두 패키지를 하나의 Claude plugin으로 합치되 rich review는 `/argus:review` 같은 명시적 opt-in skill로 숨김

추천은 **2번**이다. 사용자에게 Argus가 둘로 보이지 않으면서 기본 경로는 얇게 유지할 수 있다. 단, rich review가 default auto-trigger로 되돌아오지 않도록 activation contract를 테스트해야 한다.

#### Argus for Codex

Codex plugin은 신규 adapter다.

- `.codex-plugin/plugin.json`
- `.mcp.json`과 `mcpServers`를 통한 같은 Argus MCP 연결
- Codex용 skills와 hooks
- Codex의 plugin/skill discovery와 multi-agent 기능에 맞춘 workflow
- Claude 전용 `AskUserQuestion`, `${CLAUDE_PLUGIN_ROOT}`, Claude hook event 제거

첫 버전은 MCP + 소수 skills만 제공한다. Claude의 17-agent 구조를 곧바로 복제하지 않는다.

권장 v1 surface:

```text
Argus MCP tools
$argus-review          # 명시적 deep review
$argus-check           # due/check-in
$argus-history         # patterns/history
```

#### 기타 MCP 호스트

Cursor와 일반 MCP host는 Argus MCP만 사용한다. host-specific plugin이 없더라도 deterministic discipline과 기본 instruction-guided flow가 작동해야 한다.

### 3.4 TUI

TUI는 MCP 결과 안에 그리는 화면이 아니다. 터미널을 직접 소유하는 별도 adapter다.

```text
argus
argus dashboard
argus due
```

초기 범위는 coding-agent chat을 재구현하지 않고 다음에 한정한다.

- due/overdue decision inbox
- Current Heading
- predict 확인
- resolve/amend 입력
- history/patterns
- Web 또는 host에서 deep review를 여는 handoff

TUI는 Core를 직접 import하거나, 장기적으로는 안정된 local protocol/client를 통해 Core runtime에 연결할 수 있다. 어느 경계를 택하든 renderer 안에 domain rule을 두지 않는다.

---

## 4. 최종 설치·배포 추천

### 4.1 기본 원칙

1. **브랜드는 하나, 설치물은 호스트별**
2. **사용자는 자기 호스트용 Argus 하나만 설치**
3. **플러그인 설치가 MCP 연결까지 완료**
4. **공식 marketplace를 우선**
5. **범용 설치기는 보조 경로**
6. **감지는 자동, 변경은 명시적 동의 후**
7. **설치·업데이트·제거가 대칭적이고 idempotent**

### 4.2 사용자별 기본 경로

| 사용자 | 기본 설치 | 내부적으로 설치되는 것 |
|---|---|---|
| Claude Code | `Argus` Claude plugin | skills/hooks/agents + MCP config |
| Codex | `Argus` Codex plugin | skills/hooks + MCP config |
| Cursor/기타 | Argus MCP | MCP server config |
| Web 사용자 | 설치 없음 | Web app |
| Terminal dashboard | Argus CLI/TUI | Core client + renderer |

문서와 사이트의 첫 질문은 패키지 설명이 아니라 **“어디서 Argus를 사용하나요?”**여야 한다.

```text
[ Claude Code ] [ Codex ] [ Cursor / MCP ] [ Web ] [ Terminal ]
```

### 4.3 플러그인 내부 MCP 연결

Claude와 Codex plugin 모두 같은 MCP package를 가리킨다.

개념 예시:

```json
{
  "mcpServers": {
    "argus": {
      "command": "npx",
      "args": ["-y", "argus-decision-mcp@^1"]
    }
  }
}
```

실제 버전 전략은 compatibility matrix로 고정한다.

```text
Argus Core 1.x
Argus MCP 1.x
Argus for Claude 1.x → MCP ^1
Argus for Codex 1.x  → MCP ^1
```

플러그인 릴리스 CI에서 선언된 MCP 범위의 최소·최신 버전을 모두 smoke test한다.

### 4.4 선택형 범용 설치기

보조 설치기는 다음 UX를 권장한다.

```bash
npx argus install
```

```text
Argus를 사용할 수 있는 환경을 찾았습니다.

 ◉ Claude Code
 ◉ Codex
 ○ Cursor
 ○ Argus TUI

스페이스로 선택 · Enter로 설치
```

비대화형 명령:

```bash
npx argus install --claude
npx argus install --codex
npx argus install --claude --codex
npx argus install --all
npx argus install --dry-run
npx argus install --yes

npx argus doctor
npx argus update
npx argus uninstall
```

#### 설치기 안전 계약

- 실행 파일, config directory, marketplace availability를 감지한다.
- 감지된 모든 host에 자동 설치하지 않는다.
- `--all`은 명시적 opt-in이다.
- marketplace 설치가 가능하면 config 직접 편집보다 marketplace를 우선한다.
- config를 수정할 때 Argus managed block만 다룬다.
- 변경 전 계획을 보여주고 `--dry-run`을 제공한다.
- 기존 사용자 설정을 덮어쓰지 않는다.
- 중간 실패 후 재실행해도 복구 가능한 idempotent operation으로 만든다.
- `doctor`는 plugin, MCP, hook, ledger binding, version compatibility를 점검한다.
- `uninstall`은 Argus가 관리한 설정만 제거하고 사용자 ledger는 기본적으로 보존한다.
- telemetry와 Web sync는 설치와 분리된 opt-in이다.

### 4.5 왜 세 개를 모두 다운로드하게 하지 않는가

Claude만 사용하는 사람에게 Codex plugin은 가치가 없고, Codex만 사용하는 사람에게 Claude agents/hooks는 불필요하다. 세 패키지를 한 번에 설치하면 다음 비용이 생긴다.

- 불필요한 권한과 hook 노출
- 업데이트 실패 지점 증가
- 제품 경계 혼란
- uninstall 책임 불명확
- 사용하지 않는 host config 변경

코드는 한 monorepo에서 관리하되, 사용자는 자기 host용 artifact 하나만 설치하는 것이 맞다. 여러 host를 실제로 사용하는 사람에게만 범용 설치기가 복수 선택을 제공한다.

---

## 5. 공개 구현 비교와 판단 근거

레퍼런스는 **공식 구현을 아키텍처 기준으로**, 커뮤니티 프로젝트를 **배포 UX의 시장 관찰**로 사용한다. 커뮤니티 구현의 popularity가 correctness를 보증한다고 간주하지 않는다.

### 5.1 공식 레퍼런스

| 레퍼런스 | 관찰 | Argus에 적용할 판단 |
|---|---|---|
| [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) | server/client와 runtime middleware를 나누며 middleware에는 business logic을 넣지 않는다고 명시 | Core와 MCP transport 분리 |
| [OpenAI Codex](https://github.com/openai/codex) | `codex-core`, protocol, app-server, TUI를 분리 | Core와 renderer 사이에 명시적 계약 필요 |
| [Codex protocol README](https://github.com/openai/codex/blob/main/codex-rs/protocol/README.md) | core↔TUI와 외부 app-server type을 protocol crate에 두고 business logic을 피함 | Argus result/event type을 UI와 분리 |
| [Codex TUI/Core boundary check](https://github.com/openai/codex/blob/main/.github/scripts/verify_tui_core_boundary.py) | TUI가 core를 직접 import하지 못하도록 CI에서 검사 | TUI가 생길 경우 architecture test 추가 |
| [OpenAI Plugins](https://github.com/openai/plugins) | `.codex-plugin/plugin.json`이 skills/hooks/MCP/apps를 묶음 | Codex plugin 하나로 MCP까지 설치 |
| [OpenAI plugin manifest spec](https://github.com/openai/plugins/blob/main/.agents/skills/plugin-creator/references/plugin-json-spec.md) | `mcpServers`, `skills`, `hooks`, `apps` 경로를 manifest에 선언 | Codex package layout 기준 |
| [Anthropic Claude plugins official](https://github.com/anthropics/claude-plugins-official) | `.claude-plugin`, `.mcp.json`, commands/agents/skills를 한 plugin에 구성 | Claude plugin 하나로 MCP까지 설치 |
| [Grok Build](https://github.com/xai-org/grok-build) | agent runtime과 TUI pager를 나누고 TUI를 독립 package로 구성 | TUI를 plugin output으로 착각하지 않기 |
| [Grok pager architecture](https://github.com/xai-org/grok-build/blob/main/crates/codegen/xai-grok-pager/README.md) | AppView/AgentView와 Action→Effect 구조 | interactive state와 side effect 분리 |
| [Grok inline terminal](https://github.com/xai-org/grok-build/tree/main/crates/codegen/xai-ratatui-inline) | native scrollback, Unicode, resize 문제를 별도 계층에서 처리 | 직접 width table을 확장하지 말고 검증된 terminal layer 사용 |
| [Grok PTY harness](https://github.com/xai-org/grok-build/tree/main/crates/codegen/xai-grok-pager-pty-harness) | 실제 PTY에서 scroll/resize/input regression을 검증 | Argus TUI/statusline의 실제 terminal test 기준 |

#### 공식 레퍼런스에서 반복되는 공통 원칙

1. 비즈니스 규칙은 transport와 renderer 밖에 둔다.
2. protocol 또는 typed result가 core와 surface의 경계가 된다.
3. plugin은 skills/hooks/MCP를 묶는 배포 단위다.
4. TUI는 host plugin이 아니라 독립 application surface다.
5. renderer correctness는 unit snapshot만으로 충분하지 않다.

### 5.2 커뮤니티 배포 레퍼런스

| 레퍼런스 | 배포 형태 | 판단 근거 |
|---|---|---|
| [Superpowers](https://github.com/obra/superpowers) | 한 저장소, Claude/Codex/Cursor/OpenCode 등 host별 별도 설치 | 공통 methodology를 공유해도 install은 harness별이라는 명시적 사례 |
| [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) / [oh-my-codex](https://github.com/Yeachan-Heo/oh-my-codex) | 같은 철학을 Claude와 Codex 별도 product/package로 제공 | host specialization이 크면 별도 adapter가 자연스러움 |
| [Vercel Labs Skills CLI](https://github.com/vercel-labs/skills) | 하나의 CLI가 다수 agent를 감지·선택하고 `--agent`, `--all`, symlink/copy 지원 | Argus 선택형 범용 설치기의 직접적인 UX 참고 |
| [LazyCodex](https://github.com/code-yeongyu/lazycodex) | Codex-specific distribution, `install/doctor/uninstall`, marketplace 보조 | 설치기 health contract와 thin distribution 참고 |
| [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) | `--platform=codex/opencode/both`, host capability에 따라 edition 차등 | 모든 host에 같은 기능을 억지로 제공하지 않는 graceful degradation 참고 |

#### 커뮤니티 레퍼런스에서 반복되는 배포 패턴

- source는 공유하지만 host-specific package/marketplace entry를 둔다.
- 여러 host를 지원하면 interactive installer 또는 `--agent/--platform`을 제공한다.
- 공식 marketplace가 있으면 host별 marketplace 설치가 기본이다.
- 복수 host 설치는 명시적으로 선택한다.
- `doctor`, `update`, `uninstall`이 설치만큼 중요하다.
- host capability가 다르면 동일 브랜드 아래에서도 feature edition이 달라질 수 있다.

---

## 6. Grok·Codex에서 가져올 것과 가져오지 않을 것

### 6.1 반드시 참고할 것

#### A. Core와 UI 사이의 강제 경계

OpenAI Codex는 문서상의 권고를 넘어 CI로 TUI/Core direct dependency를 막는다. Argus도 최소한 다음 drift test가 필요하다.

- plugin이 ledger writer를 import하지 않는지
- statusline이 canonical reducer를 다시 구현하지 않는지
- Claude/Codex skill이 transition rule을 prose로만 복제하지 않는지
- 모든 public surface가 같은 outcome/provenance mapping을 사용하는지

#### B. Action → Effect → State

향후 TUI와 installer는 입력 처리, side effect, state update를 분리한다.

```text
keypress / command
  → Action
  → deterministic decision
  → Effect(file/MCP/install)
  → Result
  → State update
  → Render
```

이 구조는 install 중간 실패, cancel, retry, dry-run에도 유리하다.

#### C. PTY와 terminal invariant test

TUI 또는 statusline 변경 시 다음을 실제 terminal scenario로 검증한다.

- 폭 40/80/120
- 한글, emoji, combining character
- Windows Terminal과 legacy fallback
- rapid resize
- long decision text wrapping
- native scrollback 보존
- idle repaint 없음
- Ctrl+C와 terminal restoration

#### D. protocol-first rendering

Core result를 terminal string으로 바로 만들지 않는다. 먼저 typed view model을 만든다.

```ts
type DueDecisionView = {
  id: string;
  title: string;
  dueState: 'overdue' | 'today' | 'upcoming';
  dueDate: string;
  provenance: 'user' | 'ai_surfaced';
};
```

Claude, Codex, TUI, Web이 이 의미를 각자 표현하되 해석은 바꾸지 않는다.

### 6.2 가져오지 않을 것

- Grok/Codex 전체 coding-agent TUI를 재현하지 않는다.
- TUI를 만들기 위해 Argus 전체를 Rust로 rewrite하지 않는다.
- chat, shell, diff viewer, worktree manager를 Argus TUI 범위에 넣지 않는다.
- Ratatui 선택을 선결정하지 않는다. Node/TypeScript 배포 비용과 terminal 품질을 spike로 비교한다.
- 특정 프로젝트의 model routing, agent persona, token strategy를 Argus Core에 넣지 않는다.
- 모든 host에서 기능과 화면이 같다고 약속하지 않는다.

---

## 7. 권장 저장소와 릴리스 구조

최종 이름은 별도 naming decision이 필요하지만 책임 경계는 다음이 적절하다.

```text
packages/
  argus-core/
    src/
      domain/
      ledger/
      projections/
      validation/

  argus-mcp/
    src/
      tools/
      resources/
      transports/

  argus-cli/                       # installer/doctor, 후속 TUI entry

plugins/
  claude/
    .claude-plugin/
    .mcp.json
    skills/
    agents/
    hooks/

  codex/
    .codex-plugin/
    .mcp.json
    skills/
    hooks/

shared/
  workflow-contracts/
  schemas/
  vocabulary/
  fixtures/
```

### 공유와 복사의 기준

- domain rule과 schema는 Core에서 공유한다.
- workflow intent와 acceptance criteria는 `shared/workflow-contracts`에서 공유할 수 있다.
- Claude/Codex의 `SKILL.md` 전체를 동일 파일로 강제하지 않는다.
- host-specific invocation, hook, agent API는 adapter에 둔다.
- generated copy가 필요하면 source와 generator를 하나로 두고 drift test를 추가한다.

### 버전과 릴리스

- 한 monorepo와 한 release train을 권장한다.
- Core/MCP/plugin 호환 범위를 machine-readable하게 둔다.
- package version이 항상 같아야 할 필요는 없지만 release note에 compatibility를 명시한다.
- plugin CI는 clean home에서 fresh install → first use → due → resolve → uninstall을 검증한다.

---

## 8. 단계별 마이그레이션

Big-bang rewrite를 피한다. 각 단계는 독립적으로 되돌릴 수 있고 사용자 가치를 보존해야 한다.

### Phase 0 — 제품·권한 결정

결정할 것:

- 기본 Argus가 recommendation을 제공하는가, decision record만 구조화하는가
- `argus-driver`와 `argus-plugin-v2`를 하나로 합칠 것인가
- rich review의 명시적 activation 문구와 예산
- canonical ledger version과 migration 종료 기준

산출물:

- product contract
- surface map
- command/skill map
- compatibility policy

### Phase 1 — Core 추출, 동작 변경 없음

- `argus-mcp`의 domain/ledger/reducer를 `argus-core` 경계로 이동
- public MCP schema와 결과를 변경하지 않음
- clock, locale, home, repository identity dependency injection
- 기존 fixture를 Core contract test로 승격
- MCP는 thin adapter로 Core를 호출

완료 조건:

- 기존 MCP golden/protocol test 통과
- Core는 MCP SDK를 import하지 않음
- 같은 input/event fixture가 기존과 같은 projection 생성

### Phase 2 — Claude plugin 수렴

- plugin direct writer 제거
- seal/settle/history/settings를 MCP/Core 호출로 변경
- statusline과 hook은 read-only projection 또는 Core CLI 호출 사용
- driver와 rich plugin 설치 경로를 하나로 통합
- rich review는 명시적 opt-in으로 유지

완료 조건:

- Claude fresh install 명령 하나
- plugin/MCP cross-surface contract test
- direct canonical ledger append implementation이 Core 외부에 없음

### Phase 3 — Codex plugin v1

- `.codex-plugin/plugin.json`
- `.mcp.json`
- 최소 skills
- clean Codex home install smoke
- Claude 전용 instruction 제거

완료 조건:

- Codex plugin 설치만으로 Argus MCP가 연결됨
- predict → restart/check-in → resolve lifecycle 통과
- Claude와 동일한 receipt semantics

### Phase 4 — 범용 설치기

- `install`, `doctor`, `update`, `uninstall`
- host detection과 explicit selection
- dry-run, managed block, idempotency
- marketplace-first strategy

완료 조건:

- Claude only, Codex only, both, none 시나리오
- 부분 실패 복구
- uninstall 후 사용자 ledger 보존

### Phase 5 — 작은 TUI spike

- due inbox와 resolve 한 경로만 구현
- Node-native 또는 Rust 후보를 startup size, install friction, CJK/Windows, PTY correctness로 비교
- Grok/Codex의 renderer architecture와 PTY test를 참고

완료 조건:

- TUI가 Core rule을 재구현하지 않음
- Windows/Linux/macOS 최소 smoke
- 실제 사용자가 CLI text보다 TUI를 선호한다는 신호

### Phase 6 — 가치 검증 뒤 확장

- real lifecycle cohort
- return rate와 resolve rate
- first-value time
- host별 activation/drop-off
- TUI 사용률

검증 전에는 remote fleet, organization governance, full agent dashboard를 기본 범위로 확장하지 않는다.

---

## 9. 아키텍처·설치 검증 기준

### 9.1 Architecture gates

- Core가 MCP/Claude/Codex/TUI package를 import하지 않는다.
- plugin이 canonical ledger writer를 소유하지 않는다.
- renderer가 transition을 결정하지 않는다.
- host instructions가 load-bearing safety guard가 아니다.
- 같은 fixture가 모든 surface에서 같은 semantic result를 만든다.

### 9.2 Install gates

- 호스트별 기본 설치 명령 하나
- 플러그인 설치 뒤 별도 MCP 수동 설정 불필요
- 설치 전 변경 계획 표시
- 재설치와 update가 idempotent
- `doctor`가 actionable recovery 제공
- uninstall이 사용자 data를 묵시적으로 삭제하지 않음
- unsupported host에서는 honest failure

### 9.3 User-value gates

- 첫 prediction까지 걸린 시간
- 설치 후 첫 성공 lifecycle 비율
- due attention 전달률
- due 후 resolve 비율
- rich review opt-in 비율과 완료율
- 사용자가 설치물 이름을 이해하지 않아도 올바른 경로를 선택하는지

---

## 10. 주요 위험과 대응

| 위험 | 대응 |
|---|---|
| Core 추출이 대규모 rewrite가 됨 | behavior-preserving extraction, fixture-first, phase별 merge |
| Claude와 Codex UX를 억지로 동일화 | semantic contract만 공유하고 host interaction은 adapter에서 분리 |
| plugin 설치가 임의 코드 실행 통로가 됨 | marketplace-first, hook 승인, dry-run, 최소 권한, 명확한 uninstall |
| 범용 설치기가 사용자 config를 손상 | managed block, backup, idempotency, partial failure recovery |
| `argus-driver`와 rich plugin 브랜드 혼란 지속 | 사용자-facing package를 Argus 하나로 통합, deep review는 opt-in |
| TUI가 제품 범위를 삼킴 | due/resolve spike로 제한, 가치 gate 전 확장 금지 |
| Web ledger와 local ledger가 계속 분리 | Core event/semantic contract를 공유하고 storage adapter로 수렴 계획 수립 |
| 호스트별 기능 차이가 품질 차이로 보임 | 공통 discipline floor와 host-specific premium을 문서에서 분리 |

---

## 11. 명시적 비목표

- 모든 사용자가 Claude, Codex, MCP 세 패키지를 한꺼번에 설치하게 만들지 않는다.
- 하나의 `SKILL.md`가 모든 host에서 무조건 동일하게 동작한다고 가정하지 않는다.
- Claude의 agents/hooks를 Codex에 문법 변환만 해서 복제하지 않는다.
- 플러그인 prompt가 deterministic Core guard를 대신하지 않는다.
- 지금 단계에서 full-screen Argus coding agent를 만들지 않는다.
- Core 분리와 동시에 ledger v3, remote transport, team ledger를 모두 출시하지 않는다.
- 설치 편의를 위해 사용자 설정과 data를 묵시적으로 변경·삭제하지 않는다.

---

## 12. Claude Fable과 합의할 질문

### A. Product authority

1. 기본 Argus는 recommendation을 제공하는가, 아니면 사용자의 current call을 구조화하고 검증 질문만 제공하는가?
2. rich review가 방향성을 제시할 수 있다면 어떤 명시적 요청과 disclosure가 필요한가?

### B. Claude packaging

3. `argus-driver`와 `argus-plugin-v2`를 하나의 `Argus for Claude Code`로 합칠 것인가?
4. 합친다면 rich review의 유일한 activation은 무엇인가?
5. 기존 `/argus:sail` alias를 얼마 동안 유지할 것인가?

### C. Core boundary

6. Core의 canonical storage는 v1/v2 중 무엇인가?
7. Web은 Core package를 직접 사용하나, 같은 event contract를 구현한 remote adapter를 사용하나?
8. Core를 별도 public npm package로 배포할 필요가 있는가, monorepo internal package로 시작할 것인가?

### D. Codex scope

9. Codex v1은 MCP + 3개 skills로 제한해도 충분한가?
10. Codex hooks와 multi-agent orchestration은 어떤 실제 사용자 신호 뒤에 추가할 것인가?

### E. Installer

11. marketplace-only 설치를 먼저 완성하고 범용 설치기를 후순위로 둘 것인가?
12. 범용 설치기가 지원할 최초 host는 Claude와 Codex만으로 제한할 것인가?

### F. TUI

13. TUI의 첫 job은 due inbox인가, Current Heading인가?
14. TUI spike의 성공 기준과 중단 기준은 무엇인가?

---

## 13. 최종 추천안

합의를 위한 기본안은 다음과 같다.

1. **Argus Core를 먼저 분리한다.**
   - MCP의 기능을 재설계하기 전에 현재 deterministic behavior를 그대로 추출한다.

2. **MCP를 universal capability floor로 유지한다.**
   - 모든 host가 같은 capture/predict/check-in/resolve/patterns 규율을 사용한다.

3. **Claude와 Codex plugin을 별도 adapter로 만든다.**
   - 사용자-facing 이름은 둘 다 `Argus`다.
   - 각 plugin이 같은 MCP 연결을 포함한다.

4. **`argus-driver`와 rich Claude plugin은 사용자 관점에서 하나로 수렴한다.**
   - 기본은 quiet driver behavior다.
   - deep review는 명시적 opt-in이다.

5. **설치는 host별 marketplace를 기본으로 한다.**
   - Claude 사용자는 Claude plugin 하나, Codex 사용자는 Codex plugin 하나만 설치한다.

6. **범용 설치기는 보조로 제공한다.**
   - host를 감지하지만 사용자가 선택한 곳만 변경한다.
   - install/doctor/update/uninstall 전체 lifecycle을 제공한다.

7. **TUI는 Core 수렴 뒤 작은 spike로 진행한다.**
   - Grok Build와 OpenAI Codex의 경계·이벤트·PTY test를 참고한다.
   - coding-agent TUI 전체를 복제하지 않는다.

8. **공식 구조를 기준으로, 커뮤니티 설치 UX를 선택적으로 차용한다.**
   - Grok 하나에 의존하지 않는다.
   - 공식 MCP/OpenAI/Anthropic 구현을 architecture baseline으로 둔다.

한 문장으로 요약하면:

> **Argus의 결정 규율은 하나의 Core에 두고, MCP를 범용 실행 경계로 유지하며, Claude와 Codex에는 각 호스트의 공식 플러그인 형태로 같은 Core를 전달하고, 여러 호스트 사용자를 위해 명시적 선택형 설치기를 제공한다.**
