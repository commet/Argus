# HANDOFF — 에이전트 표면 현황 (2026-07-31)

**독자**: 웹앱 전면 재설계를 진행 중인 세션.
**목적**: 다른 세션(이 문서 작성자)이 라이브 코드를 추적해 확인한 **현황 사실**을
전달한다. 방향 제안이나 답은 담지 않는다 — 재설계 세션이 상황을 파악해 자기
설계에 반영하기 위한 자료다. 모든 주장에는 파일 좌표를 붙였고, 전부 이 날짜의
`main` 기준으로 실측했다.

**한 줄 요약**: 웹앱의 멀티에이전트는 "그런 척"이 아니다 — 선발은 결정론적 점수
엔진, 실행은 워커당 별도 LLM 호출, 통합은 별도 호출이다. 다만 **페르소나의
인격(이름·말투)은 시스템 프롬프트 두 줄짜리 껍질**이고, 품질을 실제로 가르는 건
프레임워크 스킬·레벨 지시·검증 게이트다. 플러그인/MCP는 이름 없는 4역할로 이미
수렴했고, 웹앱 17명 명부는 손대지 않은 채 테스트가 두 표면의 **상호 독립**만
못박아 두었다.

---

## 1. 웹앱 라이브 경로 — 실제로 일어나는 일

진입: `src/components/workspace/progressive/ProgressiveFlow.tsx` (약 3,000줄,
상태 기계 본체). 사용자가 팀을 확정하면 `onDeployWorkers` →
`startWorkerExecution(ws)` (`ProgressiveFlow.tsx:871`).

### 1a. 팀 선발 — LLM이 아니라 결정론적 점수 엔진

`src/lib/agent-capabilities.ts` (`scoreAgentForTask`, ~:227):

```
score = 작업유형 적합도 × 0.5 + 도메인 × 0.3 + 산출물형 × 0.2 + 안티패턴 페널티
```

- 17명 각각에 점수를 매겨 뽑는다. 라우팅은 F3 "honest routing authority"
  커밋(`909108ad`)에서 단일화됐다 — 키워드 휴리스틱 3벌이 따로 놀던 것을 이
  파일 하나로 모았다.
- **민감 작업 하드 탈락**: 안티패턴이 걸린 민감 작업(SENSITIVE_TASK_TYPES)은
  -0.4 감점이 아니라 `-Infinity` — 적임자가 없으면 억지로 채우지 않고
  `unfilled`로 남긴다 (Contract-Net no-bidder 패턴, CLAUDE.md "Honest gap over
  fabrication" 원칙의 구현).
- 비판(critique) 역할 1명 보장: `isCriticAgentId` (:205)가 selectAgents·
  buildStages·runDebate 세 곳의 단일 정본.

### 1b. 실행 — 워커마다 진짜 별도 LLM 호출

`src/lib/worker-engine.ts`:

- `runAllAIWorkers` (:242) — 동시 `MAX_CONCURRENT = 3`, 재시도 `MAX_RETRIES = 1`.
- 워커 하나당 `runWorkerTask` (:~130)가 `callLLMStream` **본 호출 1회** (:183),
  이어서 AI 워커에 한해 `validateWorkerOutput` **검증 호출 1회** + 프레임워크
  guard-rails + 구체성 검사 (:195~220).
- 검증 최종 실패 시 **무음 수용 금지** — 사용자에게 재시도/스킵을 묻고, 30초
  무응답이면 자동 통과가 아니라 스킵 (:315 부근).
- `web_search` capability 보유 에이전트만 검색 컨텍스트 추가 주입 (:170).
- self/human 워커의 AI 출력은 `ai_preliminary`(예비 분석)로만 저장되고 사용자
  입력 대기(`waiting_input`)로 넘어간다 — AI가 사람 몫을 대신 채우지 않는다
  (Layer-0 ready-gate; 의존 입력이 비면 `blocked`).

### 1c. 페르소나가 실제로 하는 일 — 시스템 프롬프트의 앞 두 줄

`src/lib/progressive-prompts.ts` `buildWorkerTaskPrompt` (:331):

```
You are 규민, 숫자 분석가.        ← ① 정체성 (이름·역할·expertise·tone)
[Assigned Framework: ...전문]      ← ② 배정 프레임워크 스킬 (실질)
[senior level directive]           ← ③ 레벨별 지시 (실질)
[Quality checkpoints]              ← ④ 품질 체크포인트 (실질)
```

- ①이 이름 명부가 프롬프트에 닿는 유일한 지점이다. **②③④는 페르소나 이름과
  무관하게 agentId/frameworkKey로 붙는다.** 즉 이름을 바꾸거나 지워도 ②③④는
  그대로 작동한다 — 품질·비용에 미치는 영향 없음(이 문서 작성 세션이 코드로
  확인한 사실이며, A/B 실측을 한 것은 아니다).
- `aiScope`/`selfScope`가 프롬프트에 실제 주입된다 (:342 주석 — 예전엔 UI에만
  보여주고 주입은 안 해서 분업이 장식이었던 것을 고친 이력).

### 1d. 통합 — 별도 호출

- `runLeadSynthesis` (`src/lib/progressive-engine.ts:1092`) — 워커 결과 전부를
  받아 `callLLMJson` 1회 (maxTokens 3000). 산출: integrated_analysis,
  key_findings, unresolved_tensions, **open_question 1개** (합성 스파인 —
  평결 삭제, 커밋 `6d6b622` "중립 항해장" 참조).
- 단계 의존성이 있으면 `runPipeline` (`worker-engine.ts:368`)이 스테이지 순서로.
- Lead synthesis는 실패해도 Mix(초안 작성)는 진행된다 — 필수 아님
  (`ProgressiveFlow.tsx:1406` 주석).

### 1e. 호출 수 요약 (비용 감각)

워커 N명 팀 한 번 돌리기 = **N회(본) + N회 이하(검증) + 1회(리드 통합) +
1회(믹스/초안)** — 전부 실호출. 여기에 진입 단계의 분석(clarify)·질문 생성이
별도로 선행된다.

---

## 2. 이름 명부(17명)가 사는 곳 — 실측 전수

`규민|다은|현우|서연|혜연|민서|수진|하윤|도윤|정민|승현` grep 기준,
테스트 제외 **15파일**, 테스트 포함 18파일:

| 파일 | 역할 |
|---|---|
| `src/lib/agent-registry.ts` (105줄) | **ID 3계열 매핑의 단일 정본** — agentId('minjae') / personaId('numbers') / frameworkKey + 한/영 이름('규민'/'Ethan'). AgentId 타입이 여기서 파생돼 명부 누락 = 컴파일 에러 (커밋 `30275f23`) |
| `src/lib/worker-personas.ts` (424줄) | 이름·역할·이모지·expertise·tone·**형광색 HEX**(#8B5CF6 등)·완료 코멘트. 사용자 커스텀(이름 변경·새 페르소나 추가) 포함 |
| `src/lib/agent-capabilities.ts` | 라우팅 점수의 원천 (agentId 기준 — 이름은 주석에만) |
| `src/lib/agent-skills-data.ts` | 프레임워크 스킬 본문 (personaId 기준, 이름은 주석·경계 설명에) |
| `src/lib/orchestrator-framework.ts` | FRAMEWORK_PRIORITY (frameworkKey 기준) |
| `src/lib/progressive-prompts.ts` | 프롬프트 주입 지점 (§1c) |
| `src/lib/worker-engine.ts` | 실행 엔진 (이름은 completion note 경유) |
| `src/lib/demo-data.ts` (1,500줄+) | **데모 대본 3편** — "📊 규민이 합류했어요" 조인 메시지, 시나리오별 워커·결과 전문이 하드코딩 |
| `src/components/workspace/InteractiveDemo.tsx` | 데모 재생기 (`?demo=planning|proposal|strategy`) |
| `src/components/landing/films/ArgusHeroDemo.tsx` | 랜딩 히어로 필름 (다은→Sophie 등 영문명 병기) |
| `src/data/voyage-crew.ts` | 항해 뷰 크루 표기 |
| `src/stores/useAgentStore.ts`, `usePersonaStore.ts` | 상태 저장 (localStorage 동기화 대상) |
| `src/lib/agent-stats.ts`, `skill-quality-eval.ts` | 부속 |

표시 전용 컴포넌트(이름은 데이터 경유): `AgentSidebar.tsx`(595줄) ·
`WorkerCard.tsx`(718줄) · `WorkerPanel.tsx`(536줄) · `PersonaPoolModal.tsx`(524줄)
— 페르소나 **형광색·이모지 아바타·리플/셔머 애니메이션**이 여기 산다.

주의: `usePersonaStore`는 **Supabase 동기화 인터페이스**다. 페르소나 구조를
바꾸면 CLAUDE.md "Schema Sync" 규약(같은 커밋에 마이그레이션 + schema-drift
TABLE_COLUMNS 갱신)이 걸린다.

---

## 3. 플러그인 / MCP — 이미 수렴된 쪽

- **플러그인** (`argus-plugin-v2/agents/`): 이름 없는 기능 역할 **4개** —
  `domain-reviewer` · `evidence-reviewer` · `risk-reviewer` · `synthesizer`.
  전부 `model: inherit` + `maxTurns` 제한. 표준 사용엔 에이전트 팀 없음,
  `/argus:review` 명시 호출에만 제한적 투입 (bounded review).
- **MCP** (`argus-mcp`): 에이전트 표면 자체가 없다 — 공개 도구 6개뿐
  (capture/predict/check_in/resolve/patterns/settings).
- **독립 가드**: `src/lib/__tests__/plugin-reviewer-surface.test.ts`가
  플러그인 agents/ 디렉터리를 **정확히 위 4파일로 고정**하고
  "historical web persona roster로부터 독립"을 명시. 웹 명부가 플러그인으로
  새거나 그 반대가 되면 이 테스트가 빨간불.
- 구조 드리프트 가드: 커밋 `b2075ae4` (registry↔모든 장부 + webapp↔plugin).

**즉 당시 결정의 실체**: 플러그인만 갈아엎고, 웹앱은 그대로 두되, 서로 새지
않게 가드. 웹앱 쪽 정렬 작업은 시작된 적 없음. `docs/PARITY-MAP`은 현재
리포에 없음(아카이브 스윕 `2026-07-10`에서 제거된 것으로 추정 — 커밋 "공개
리포에서 내부 설계·전략 이력 제거").

---

## 4. 데모(대본) 경로 — 별도 세계

`/ko/workspace?demo=planning|proposal|strategy` → `InteractiveDemo.tsx` 재생.
LLM 호출 0회 — `demo-data.ts`의 하드코딩 대본이다. **이름·조인 메시지·결과
전문이 대본에 박혀 있으므로**, 에이전트 모델을 바꾸면 이 대본 3편(한/영 각각,
`demo-data-en.ts` 포함)은 별도로 다시 써야 한다. 라이브 경로만 고치면 데모와
어긋난다.

---

## 5. 2026-07-30~31에 이미 바뀐 것 (충돌 주의)

재설계 세션이 이 파일들을 만질 때 오늘 머지분과 겹치지 않게:

- **PR #345** (`31956d55`, main 머지 완료): 진행 표시 수리 3파일.
  - `CheckpointRail.tsx` — ① 배 잘림 수리: 활성 밴드의 가로 스크롤 박스가
    세로도 잘라서(overflow-x가 visible이 아니면 y도 visible 불가) 배가 절단돼
    있었다 → 배 머리 공간을 스크롤 박스 **안쪽**(pt-[17px])으로. ② 연결선을
    `[노드][선][노드]…[마지막 노드는 내용폭]` 사슬로 재배치 — 이전엔 각 노드가
    flex-1 칸 중앙에 갇혀 선이 칸 경계에서 끊겼다.
  - `flow-parts/voyage-progress.tsx` (신규) — 상태바의 "장식용 활동선" 대체.
    셀 수 있으면(검토 n/N) 배가 done/total 지점에 정박+지나온 물길만 잉크,
    셀 수 없으면 퍼센트 참칭 없이 항해. 잉크 선 배 SVG, currentColor,
    reduced-motion 대응.
  - `flow-parts/phase-chrome.tsx` — `PhaseStatusBar`가 VoyageProgress 사용.
- **PR #341/#340** (README 전수 정비 + statusline 배선): `argus-plugin-v2/`,
  `argus-mcp/README*`, 루트 README* — 웹앱 코드와는 안 겹침.

## 6. 검증 함정 (재설계 세션의 스크린샷 검증에 바로 유효)

- **이 리포의 headless 환경에서 framer-motion이 rAF가 살아 있어도
  `initial{}`(투명)에 얼어붙을 수 있다.** 데모 워크스루가 그려지는 건 클릭이
  프레임을 펌프해서다. 정적 페이지 스크린샷은 최종 스타일 CSS 오버라이드
  (`opacity:1 !important` 등)를 주입해야 실제 레이아웃을 볼 수 있다.
- `?e2e-no-anim=1` (`src/components/E2EMotionKill.tsx`)의 `__motionKilled`가
  이 경로에서 false로 남는 것 관찰됨 — 모듈 사이드이펙트가 안 탄다. 원인 미상,
  미조사.
- dev 서버: 워크트리는 `.env.local` 복사 + `argus-mcp` 빌드 선행 필수
  (없으면 tsc TS2307 / dev 500). 이번에 dev 서버가 Ready 후 요청을 영영
  안 받는 좀비 상태도 1회 관찰 — 재시작으로 해결.
- 헤드리스 검증 중 `AuthReadinessGate`("계정의 작업을 안전하게 연결하는
  중")와 `AuthGuard`("세션을 확인하는 중")가 fresh 컨텍스트에서 오래 잡을 수
  있다. `MARKETING_PATHS`(Providers.tsx:21)와 `PUBLIC_PATHS`
  (lib/public-paths.ts:8)가 게이트 예외 목록.

## 7. 결정되지 않은 것 (창업자가 아직 답하지 않음 — 이 문서는 답하지 않는다)

웹앱 17명 이름 명부의 거취. 논의된 선택지는 ① 시각만 정리(이름 유지,
이모지·형광색 제거) ② 플러그인처럼 이름 없는 기능 역할로 전면 전환 ③ 유지.
관련 사실: 이름은 프롬프트 정체성 두 줄 + UI 껍질이라 어느 쪽이든 엔진
수술이 아니다(§1c). 스파인 관점 참고 지점: CLAUDE.md Zero-Judgment 게이트,
`judgment-ownership-spine` (판단 주체 표기 문제).

## 8. 스파인 제약 (재설계가 밟기 쉬운 지뢰만)

- 합성은 평결 금지 — open_question 1개 게이트 (§1d).
- AI 출력이 사용자 소유 필드를 조용히 상속하지 않게 — provenance 태그
  (`authored: 'user'` 계열, `user-judgment-binding.test.ts`).
- 파생 패턴의 프롬프트 주입은 기본 제외 — `src/lib/epistemic/control-plane.ts`가
  단일 권한 (CLAUDE.md "LLM Prompt Injection Guidelines").
- 사용자 데이터는 `<user-data>` 래핑 + `sanitizeForPrompt()`.
- 왼쪽 세로 악센트 바 금지 (`no-left-accent-bar.test.ts`).
- 페르소나/에이전트 구조 변경 시: agent-registry에서 AgentId가 파생되므로
  명부와 장부(capabilities/skills/framework)가 어긋나면 **컴파일 에러**가 나게
  되어 있다 — 이 성질은 유지할 가치가 있는 안전장치다(사실 서술이며 설계
  지시는 아님).
