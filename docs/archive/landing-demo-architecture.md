# 랜딩 데모 아키텍처

## 현재 상태 (2026-04-03)

### 구조 요약

```
Hero (page.tsx HeroFlow)
  ├── idle: 시나리오 카드 3개 + 직접 입력
  ├── 시나리오 클릭 → DemoShowcase (pre-computed, LLM 0)
  ├── 직접 입력 → assembling → analyzing → ready (실제 LLM)
  └── "내 상황으로 시작하기" → 실제 ProgressiveFlow
```

### 파일 맵

| 파일 | 역할 |
|------|------|
| `src/app/workspace/page.tsx` | HeroFlow 컴포넌트 — idle/assembling/analyzing/ready 4단계 morphing + 데모 분기 |
| `src/lib/demo-scenarios.ts` | 3개 시나리오 하드코딩 데이터 (분석, Q&A, 팀, worker 결과, mix, DM 피드백, 최종 문서) |
| `src/components/workspace/DemoShowcase.tsx` | 데모 자동 재생 컴포넌트 — step별 delay로 UI 순차 표시 |
| `src/components/workspace/progressive/ProgressiveFlow.tsx` | 실제 플로우 (LLM 호출) |
| `src/components/workspace/progressive/WorkerCard.tsx` | 인라인 보고 블록 (WorkerReportBlock) |
| `src/components/workspace/progressive/WorkerPanel.tsx` | 사이드 상태판 + 모바일 드로어 |
| `src/components/workspace/progressive/WorkerAvatar.tsx` | 컬러 이니셜 아바타 컴포넌트 |

---

## 사용자 여정 (두 갈래)

### 갈래 A: 데모 체험

```
1. Hero 도착
2. 시나리오 카드 클릭 (📋기획안 / 💰투자 / 🔍사업검토)
3. DemoShowcase 자동 재생:
   - 분석 카드 등장 (0.8s)
   - Q&A 질문 + 자동 답변 (2s)
   - 팀 배치 (아바타 stagger) (1.2s)
   - Worker 결과 순차 표시 (0.8s × 3)
   - Mix 초안 프리뷰 (1s)
   - DM 피드백 (1.2s)
   - 최종 문서 (1.5s)
4. 하단 CTA "내 상황으로 시작하기" → textarea에 시나리오 prompt 채워짐
5. 사용자가 수정하거나 그대로 → "시작" → 실제 LLM 플로우
```

### 갈래 B: 직접 시작

```
1. Hero 도착
2. 하단 입력창에 직접 타이핑 (또는 시나리오 카드 무시)
3. "시작" 클릭
4. assembling: 팀 아바타 4명 stagger 등장 (0-2초)
5. analyzing: LLM 스트리밍 분석 실시간 표시 (2-30초)
6. ready: ProgressiveFlow로 자연 전환
```

---

## 데모 데이터 구조

### DemoScenario 타입 (demo-scenarios.ts)

```typescript
interface DemoScenario {
  id: string;           // 'planning' | 'fundraising' | 'new_business'
  title: string;        // 카드 제목
  icon: string;         // 이모지
  desc: string;         // 카드 설명
  problemText: string;  // 사용자 입력 텍스트
  steps: DemoStep[];    // 재생할 단계들
}

interface DemoStep {
  type: 'analysis' | 'question' | 'answer' | 'team_deploy' | 'worker_result' | 'mix' | 'dm_feedback' | 'final';
  delay: number;  // 이전 단계에서 대기 시간 (ms)
  data: unknown;  // 타입별 데이터
}
```

### 3개 시나리오 요약

| ID | 시나리오 | 팀 구성 | 핵심 output |
|----|---------|---------|------------|
| `planning` | AI 챗봇 기획안 | 수진(시장조사) + 현우(MVP전략) + 민재(재무추정) | 기획안 + 대표님 피드백 |
| `fundraising` | 시리즈A IR | 수진(시장규모) + 민재(투자지표) | IR 자료 + KPI 벤치마크 |
| `new_business` | AI 세무 사업검토 | 태준(규제환경) + 동혁(리스크분석) | Go/No-Go 판단 + 조건 |

### step별 데이터 형식

| type | data 형식 |
|------|----------|
| `analysis` | `{ snapshot: AnalysisSnapshot }` |
| `question` | `{ question: FlowQuestion }` |
| `answer` | `{ answer: FlowAnswer }` |
| `team_deploy` | `{ workers: WorkerTask[] }` |
| `worker_result` | `{ workerId: string }` — workers 배열에서 해당 ID를 visible로 |
| `mix` | `{ mix: MixResult }` |
| `dm_feedback` | `{ feedback: DMFeedbackResult }` |
| `final` | `{ content: string }` — 마크다운 최종 문서 |

---

## DemoShowcase 컴포넌트 (DemoShowcase.tsx)

### 핵심 로직

```
state:
  currentStep: number (-1 = intro)
  isPlaying: boolean
  snapshot, questions, answers, workers, visibleWorkerIds, mix, dmFeedback, finalContent

auto-advance:
  useEffect → setTimeout(delay) → processStep → setCurrentStep++

processStep(step):
  switch(step.type) → 해당 state에 data 추가

UI:
  실제 컴포넌트 스타일 그대로 사용 (rounded-2xl, gradient-gold 등)
  단 실제 store/LLM 없이 local state로만 렌더링
```

### 사용자 조작

- **"결과 보기" (SkipForward)**: 모든 남은 step을 즉시 처리 → 최종 문서까지 한번에
- **"돌아가기"**: 시나리오 선택으로 복귀
- **"내 상황으로 시작하기"**: 실제 플로우 진입 (데모 시나리오의 prompt가 textarea에 채워짐)

---

## Hero Morphing (page.tsx HeroFlow)

### Phase 전환

```
type HeroPhase = 'idle' | 'assembling' | 'analyzing' | 'ready';

idle → (시나리오 클릭) → demoScenario 설정 → DemoShowcase 렌더
idle → (직접 입력 + 시작) → assembling → analyzing → ready → ProgressiveLayout
```

### assembling (0-2초)

- 입력 텍스트가 pill로 축소
- getPersonaPool()에서 4명 프리뷰 아바타 stagger 등장
- 동시에 runInitialAnalysis(text, onToken) 시작

### analyzing (2-30초)

- 팀 아바타 row 상단 고정
- LLM 스트리밍 텍스트 실시간 타이핑 (커서 깜빡)
- 30초 대기가 아니라 "분석 과정을 보는" 경험

### ready

- snapshot + question 저장 완료
- onReady(projectId) → ProgressiveLayout으로 전환

---

## 에이전트 팀 시스템 연동 상태

### 현재 (이 세션에서 구현)

- WorkerPersona 기반 (worker-personas.ts)
- 키워드 매칭 자동 배정 (assignPersona)
- 10개 페르소나 + 커스텀 추가 가능
- 레벨 시스템: junior/senior/guru
- 스킬셋: agent-skills.ts (프레임워크, 체크리스트, 도구, 레벨별 프롬프트)

### 최신 커밋 (다른 세션, 0d5c0ce)

- Agent 통합 타입 (agent-types.ts) — Worker + Persona + Boss 통합
- useAgentStore 중앙 스토어 — 14인 팀, XP/레벨, 해금
- 체인 에이전트 (리서치·전략) — 사용량 기반 상위 에이전트 해금
- 지휘자(Conductor) + 악장(Concertmaster) 특수 에이전트
- /agents 허브 UI (AgentHub, AgentCard, AgentProfile)
- /api/search (Brave Search API) — 웹 검색 연동
- Supabase 마이그레이션 (agents, agent_chains, agent_activities)

### Hero 프리뷰 ↔ 실제 팀 불일치

- Hero assembling에서 getPersonaPool() 4명은 프리뷰용
- 실제 팀은 initWorkers에서 execution_plan 기반으로 배정
- 다른 세션의 useAgentStore.assignAgentToTask()가 최종 배정 로직
- TODO: Hero 프리뷰를 지휘자 에이전트의 팀 구성 결과로 대체

---

## 보완 필요 사항

### P0 (데모 품질)
- [ ] 데모 시나리오 3개의 내용 품질 검증 — 실제 전문가 리뷰 필요
- [ ] 데모 재생 타이밍 미세 조정 — 실제 사용자 테스트 후 delay 최적화
- [ ] "결과 보기" 스킵 시 애니메이션이 갑작스러움 — transition 보강

### P1 (UX)
- [ ] 데모 → 실제 전환 시 textarea에 prompt가 채워지는데, 사용자가 "이대로 시작"할 수 있는 원클릭 옵션 필요
- [ ] 데모 중 하단 CTA가 항상 보이는데, 초반에는 너무 이르게 느껴질 수 있음 — step 3 이후부터 표시?
- [ ] 모바일에서 데모 스크롤이 자동이라 사용자 스크롤과 충돌 가능

### P2 (확장)
- [ ] Pre-computed 데모를 더 많은 시나리오로 확장 (5-10개)
- [ ] 사용자가 데모 중간에 직접 답변 선택 가능하게 (인터랙티브 데모)
- [ ] 데모 완료 후 "이 결과물을 공유하기" 기능
- [ ] Hero 프리뷰 팀을 실제 에이전트 시스템과 동기화
