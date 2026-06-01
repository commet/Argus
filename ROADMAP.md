# Argus Technical Roadmap

> "실행 비용이 0에 가까워질수록, 실행 이전의 판단의 가치는 올라간다."
> 이 로드맵은 이 테제를 기술적으로 실현하기 위한 설계도입니다.

---

## 0. Strategic Positioning

### Argus가 아닌 것
- LLM 프롬프트 래퍼가 아님
- 음악 메타포가 붙은 기획 도구가 아님
- ChatGPT에 좋은 프롬프트를 넣어주는 것이 아님

### Argus인 것
**모든 실행 도구의 앞단에 위치하는 판단 엔진.**

```
[사용자의 과제]
    ↓
  Argus  ← 여기. 다른 도구가 없는 지점.
    ↓
[RIPER, LangGraph, CrewAI, Cursor, 사람 실행]
```

경쟁 지형에서 확인된 사실:
- Plan Mode, /wizard, RIPER, AB Method, SDD → 전부 "어떻게 구현할까?"
- BMAD-METHOD → 가장 가까움. 하지만 개발 역할 페르소나이지 전략적 판단이 아님
- autoresearch → 목표가 확정된 후의 최적화. 목표 자체를 의심하지 않음

**Argus만이 묻는 질문: "이게 풀어야 할 진짜 문제인가?"**

### 기술적 해자 3가지

1. **맥락 누적 체인** — 각 단계의 판단이 구조화된 데이터로 다음 단계에 전달. 마크다운 붙이기가 아닌 타입드 파이프라인.
2. **판단 학습 루프** — 사용자의 선택/수정/피드백이 축적되어 다음 세션의 AI를 자동 조정. autoresearch 패턴의 전략 버전.
3. **실행 브릿지** — 사고 결과를 4종 산출물(Brief, Prompt Chain, Agent Spec, Checklist)로 변환. 아무 실행 도구에나 연결 가능.

---

## 1. Architecture Evolution: 마크다운 연결 → 타입드 파이프라인

### 현재 문제
```
decomposeToMarkdown(item) → string → recast prompt에 concat
```
이건 **텍스트 연결**이지 **맥락 전달**이 아님. 정보가 손실되고, 추적이 안 되고, 자동 반응이 불가능.

### 목표 아키텍처

```typescript
// 각 단계의 출력이 다음 단계의 입력을 정확히 정의
interface ContextChain {
  decompose: {
    reframed_question: string;         // → recast.governing_idea의 시드
    unverified_assumptions: HiddenAssumption[];  // verified=false인 것만
    selected_direction: string;         // 사용자가 선택한 방향
    user_uncertainty_type: 'why' | 'what' | 'how' | 'none';  // 인터뷰에서 수집
    success_criteria_clarity: 'measurable' | 'risk' | 'opportunity' | 'unclear';
  };
  recast: {
    governing_idea: string;
    steps: RecastStep[];
    key_assumptions: KeyAssumption[];   // decompose의 전제를 확장
    critical_path: number[];
    unresolved_judgments: string[];     // 사용자가 아직 결정 안 한 판단 포인트
  };
  rehearsal: {
    classified_risks: ClassifiedRisk[];
    untested_assumptions: string[];    // 선원 배치의 가정 중 공격받은 것
    approval_conditions: Record<string, string[]>;  // 페르소나별 승인 조건
    failure_scenarios: string[];
  };
  refinement: {
    resolved_issues: string[];
    persisting_issues: string[];
    convergence_score: number;
    loop_count: number;
  };
}
```

### 핵심 메커니즘: 양방향 추적

```
전제 변경 → 자동 영향 분석:
  decompose.assumption[2].verified = true
    → recast.key_assumptions에서 해당 항목 "확인됨" 표시
    → rehearsal에서 해당 가정 공격 제외
    → checklist에서 해당 검증 단계 제거

역추적:
  recast.step[3] ← 어디서 왔나?
    → decompose.selected_direction에서 파생
    → 사용자가 3개 선택지 중 2번을 골라서
    → 원래 가설은 "X이지만 Y를 고려하면 Z"
```

### 차용한 패턴
| 패턴 | 출처 | 적용 |
|------|------|------|
| `_Leverage: path_` 추적 주석 | SDD | 모든 산출물 필드에 출처 주석 |
| Steering documents | SDD | 조직 가치/제약/원칙을 프로젝트 수준에서 영속 |
| Branch-aware memory | RIPER-5 | 시나리오별 맥락 격리 |

---

## 2. Phase-by-Phase Implementation

### Phase 0: Data Pipeline Foundation (기반)

**목표**: 마크다운 연결을 타입드 파이프라인으로 교체.

**구현 항목:**
1. `ContextChain` 인터페이스 정의 (types.ts)
2. `useContextChainStore` 생성 — 프로젝트별 체인 상태 관리
3. `buildContextForRecast(decomposeItem)` — 구조화된 handoff
4. `buildContextForRehearsal(recastItem, decomposeItem)` — 누적 handoff
5. `traceProvenance(field)` — 역추적 함수
6. 기존 `useHandoffStore`의 markdown string → ContextChain 객체로 교체

**기술 스펙:**
- ContextChain은 프로젝트 단위로 localStorage + Supabase 이중 저장
- 각 필드에 `_source: { phase, itemId, field, userModified }` 메타데이터
- `onAssumptionChange()` 이벤트 → 다운스트림 자동 갱신

**검증 기준:**
- [ ] recast가 decompose의 미확인 전제만 자동으로 key_assumptions에 포함하는가?
- [ ] 전제 1개를 "확인됨"으로 바꾸면 downstream 산출물이 자동 반영되는가?
- [ ] 최종 Agent Spec의 모든 필드에서 원래 가설까지 역추적 가능한가?

---

### Phase 1: Adaptive Decompose (지능형 항로 재설정)

**목표**: 같은 과제를 넣어도 사용자 유형과 맥락에 따라 다른 리프레이밍 전략을 선택.

**현재 문제:**
```
모든 과제 → 동일한 시스템 프롬프트 → 일반적 리프레이밍
```

**목표 아키텍처:**
```
인터뷰 신호 분석:
  origin=top-down + uncertainty=why + success=unclear
    → 리프레이밍 전략: "과제 존재 자체를 의심" (aggressive)

  origin=self + uncertainty=how + success=measurable
    → 리프레이밍 전략: "범위를 좁혀서 실행 가능하게" (focused)

  origin=fire + uncertainty=what + success=risk
    → 리프레이밍 전략: "근본 원인 진단 먼저" (diagnostic)
```

**구현 항목:**
1. `ReframingStrategy` 타입 정의: 'challenge_existence' | 'narrow_scope' | 'diagnose_root' | 'redirect_angle'
2. `selectReframingStrategy(interviewSignals)` — 인터뷰 응답 조합으로 전략 결정
3. 전략별 시스템 프롬프트 변형 (공통 구조 + 전략별 강조점)
4. 사용자 채택 데이터 축적 → 전략 선택 로직 자동 조정

**판단 학습 루프 (autoresearch 패턴 적용):**

```typescript
// Binary eval 정의
const DECOMPOSE_EVALS = [
  { id: 'question_accepted', question: '사용자가 제안된 질문을 수정 없이 선택했는가?' },
  { id: 'assumptions_useful', question: '전제 중 "확인됨"으로 마킹되지 않은 것이 1개 이상인가?' },
  { id: 'proceeded_to_recast', question: '사용자가 선원 배치 단계로 진행했는가?' },
  { id: 'no_immediate_reanalyze', question: '사용자가 즉시 재분석을 요청하지 않았는가?' },
];

// 매 세션 후 자동 기록
function recordDecomposeEval(item: DecomposeItem): EvalResult {
  return {
    strategy_used: item.reframing_strategy,
    interview_signals: item.interview_signals,
    evals: {
      question_accepted: item.selected_question === item.analysis.hidden_questions[0]?.question,
      assumptions_useful: item.analysis.hidden_assumptions.filter(a => !a.verified).length > 0,
      proceeded_to_recast: hasLinkedRecastItem(item),
      no_immediate_reanalyze: !item.reanalyzed_immediately,
    },
    pass_rate: calculatePassRate(evals),
  };
}

// 누적 후 전략 조정 (50+ 세션 이후)
function adaptStrategySelection(evalHistory: EvalResult[]): StrategyWeights {
  // 인터뷰 신호 조합별로 어떤 전략이 가장 높은 pass_rate를 보이는지
  const grouped = groupBy(evalHistory, e => signalKey(e.interview_signals));
  return Object.fromEntries(
    grouped.map(([key, results]) => [key, bestPerformingStrategy(results)])
  );
}
```

**차용한 패턴:**
| 패턴 | 출처 | 적용 |
|------|------|------|
| Binary eval (yes/no only) | autoresearch-skill | 4개 binary eval로 리프레이밍 품질 측정 |
| Single mutation isolation | autoresearch | 전략 하나씩만 변경하여 인과 관계 파악 |
| Anti-gaming validation | autoresearch-skill | "높은 pass rate이지만 실제로 쓸모없는" 경우 감지 |

---

### Phase 2: Multi-Lens Recasting (다관점 선원 배치)

**목표**: 워크플로우 설계를 단일 LLM 호출이 아닌 다관점 검증 시스템으로.

**현재 문제:**
```
prompt + context → 1개 LLM 호출 → workflow 전체 생성
```
한 번의 호출이 governing_idea부터 critical_path까지 전부 결정. 검증 없음.

**목표 아키텍처 (BMAD 패턴 차용):**

```
Step 1: 기본 워크플로우 생성 (현재와 동일)
    ↓
Step 2: 3-lens 병렬 검증 (BMAD subagent fan-out)
  ├─ [Skeptic] "이 계획의 가장 큰 약점은?"
  │   → JSON: { critical_gaps[], untested_assumptions[], vague_areas[] }
  │
  ├─ [Optimizer] "더 효율적인 순서나 역할 배분은?"
  │   → JSON: { redundant_steps[], reorder_suggestions[], automation_opportunities[] }
  │
  └─ [Domain] (과제 유형에 따라 동적 선택)
      → 시장 진출 → "Go-to-market risk reviewer"
      → 기술 개발 → "Technical feasibility reviewer"
      → 조직 변화 → "Change management reviewer"
      → JSON: { domain_risks[], missing_considerations[], industry_patterns[] }
    ↓
Step 3: 통합 + 사용자 판단
  ├─ 비쟁점: 자동 반영
  └─ 쟁점: 사용자에게 제시 → 판단 기록
```

**구현 항목:**
1. `ReviewLens` 인터페이스: { name, system_prompt, output_schema }
2. `selectDomainReviewer(taskDescription)` — 동적 리뷰어 선택 (BMAD 패턴)
3. `runParallelReview(workflow, lenses[])` — 3개 LLM 호출 병렬 실행
4. `triageReviewResults(results[])` — 비쟁점 자동 반영 / 쟁점 분류
5. UI: 리뷰 결과를 접을 수 있는 패널로 표시, 쟁점은 판단 카드로

**핵심 기술 스펙:**
- 각 리뷰어의 출력은 **구조화된 JSON** (BMAD "JSON-only output schema" 패턴)
- 리뷰어 간 결과 충돌 시 자동 감지 + 사용자에게 결정 위임
- 리뷰 결과는 JudgmentRecord로 축적 → 향후 어떤 리뷰가 유용했는지 학습
- LLM 호출 3회 추가 → maxTokens 각 1500으로 제한 (비용 관리)

**전제 의존성 그래프 (이 Phase에서 함께 구현):**

```typescript
interface AssumptionNode {
  id: string;
  text: string;
  verified: boolean;
  depends_on: string[];  // 다른 assumption의 id
  depended_by: string[]; // 이 assumption에 의존하는 것들
  risk_impact: number;   // 이게 틀리면 영향받는 downstream 요소 수
}

function buildAssumptionGraph(
  decomposeAssumptions: HiddenAssumption[],
  recastAssumptions: KeyAssumption[]
): AssumptionGraph {
  // LLM에게 의존 관계 분석 요청 (1회 추가 호출)
  // 또는 텍스트 유사도 기반 자동 연결
}

function findCriticalNode(graph: AssumptionGraph): AssumptionNode {
  // 가장 많은 다른 노드를 지탱하는 노드 = 먼저 검증해야 할 것
  return maxBy(graph.nodes, n => n.depended_by.length);
}
```

---

### Phase 3: Rehearsal Intelligence (학습하는 리허설)

**목표**: 페르소나 시뮬레이션이 세션을 거듭할수록 정확해지는 시스템.

**현재 상태**: accuracy_ratings가 수집되고, buildPersonaAccuracyContext()가 주입됨. 하지만:
- "정확했던 부분/부정확했던 부분"이 문자열 리스트라 구조적 학습 불가
- 프로젝트 간 페르소나 지식 이전 없음

**목표 아키텍처:**

```typescript
// 페르소나 행동 모델 (세션 축적으로 구축)
interface PersonaBehaviorModel {
  persona_id: string;

  // 축적 데이터
  typical_concerns: WeightedTopic[];      // 자주 제기하는 우려 유형
  approval_patterns: ApprovalPattern[];    // 어떤 조건에서 승인하는지
  blind_spots: string[];                   // 자주 놓치는 것 (사용자가 마킹)

  // 정확도 메타
  accuracy_by_aspect: Record<string, number>;  // 측면별 정확도
  // e.g., { "비용 예측": 0.8, "시장 반응": 0.4, "기술 가능성": 0.7 }

  // 행동 보정
  calibration_notes: string[];  // "이 페르소나는 비용을 과대평가하는 경향"
}
```

**구현 항목:**
1. `PersonaBehaviorModel` 구축 — accuracy_ratings를 구조적으로 분석
2. 페르소나 프롬프트에 행동 모델 주입 — "이 사람은 비용을 과대평가하는 경향이 있으니 보정하세요"
3. 교차 프로젝트 페르소나 지식 — 같은 "CEO" 페르소나가 여러 프로젝트에서 쓰이면 통합 학습
4. **리스크 전파**: rehearsal의 classified_risks가 자동으로 recast의 step에 매핑
   - critical risk → 해당 step에 경고 배지
   - unspoken risk → 별도 "주의" 패널

**차용한 패턴:**
| 패턴 | 출처 | 적용 |
|------|------|------|
| Dynamic reviewer selection | BMAD | 과제 도메인에 따라 페르소나의 관심사 자동 조정 |
| Structured JSON output | BMAD | 피드백 결과를 구조화하여 자동 분석 가능 |
| Accuracy tracking | Argus 자체 (이미 구현) | 강화: 문자열 → 구조적 aspect별 점수 |

---

### Phase 4: Self-Improving System (자가 개선)

**목표**: Argus의 시스템 프롬프트가 사용 데이터를 기반으로 자동 개선.

**autoresearch → Argus 번역:**

```
autoresearch                  →  Argus
─────────────────────────────────────────────
train.py (mutable)            →  SYSTEM_PROMPT (mutable)
val_bpb (metric)              →  binary eval pass rate
5min training window          →  1 user session
git commit/revert             →  prompt version + changelog
program.md (human guidance)   →  IMPROVEMENT_POLICY.md
```

**구현 항목:**

1. **Eval Framework** (`src/lib/eval-engine.ts`):
```typescript
interface BinaryEval {
  id: string;
  phase: 'decompose' | 'recast' | 'rehearsal';
  question: string;  // yes/no
  measure: (item: any) => boolean;
}

const EVALS: BinaryEval[] = [
  // Decompose
  { id: 'd_accepted', phase: 'decompose',
    question: '사용자가 AI 제안 질문을 수정 없이 채택했는가?',
    measure: (item) => item.selected_question === item.analysis?.hidden_questions?.[0]?.question },
  { id: 'd_useful_assumptions', phase: 'decompose',
    question: '전제 중 하나 이상이 미확인 상태로 선원 배치에 전달되었는가?',
    measure: (item) => item.analysis?.hidden_assumptions?.some(a => !a.verified) },
  { id: 'd_proceeded', phase: 'decompose',
    question: '선원 배치으로 진행했는가?',
    measure: (item) => hasLinkedItem(item, 'recast') },

  // Recast
  { id: 'o_no_major_edit', phase: 'recast',
    question: '사용자가 step을 50% 이상 수정하지 않았는가?',
    measure: (item) => calculateEditRate(item) < 0.5 },
  { id: 'o_proceeded', phase: 'recast',
    question: '리허설로 진행했는가?',
    measure: (item) => hasLinkedItem(item, 'persona-feedback') },

  // Rehearsal
  { id: 'r_accuracy_above_3', phase: 'rehearsal',
    question: '페르소나 정확도 평균이 3/5 이상인가?',
    measure: (item) => getAverageAccuracy(item) >= 3 },
];
```

2. **Prompt Versioning** (`src/lib/prompt-versions.ts`):
```typescript
interface PromptVersion {
  id: string;
  phase: string;
  prompt_text: string;
  mutation_description: string;
  eval_results: { eval_id: string; pass_rate: number }[];
  overall_pass_rate: number;
  status: 'active' | 'candidate' | 'discarded';
  created_at: string;
}

// Changelog (autoresearch 패턴)
interface PromptChangelog {
  version_id: string;
  mutation: string;          // "reframed_question 지시에 '구체적 숫자 포함' 추가"
  hypothesis: string;        // "구체적 질문일수록 채택률이 높을 것"
  result: 'keep' | 'discard';
  pass_rate_before: number;
  pass_rate_after: number;
  remaining_failures: string[];
}
```

3. **Autonomous Improvement Loop** (수동 트리거 → 점진적 자동화):
   - v1: 관리자가 eval 데이터 보고 수동으로 프롬프트 수정
   - v2: "개선 제안" 버튼 → AI가 실패 패턴 분석 + mutation 제안
   - v3: 주기적 자동 실행 (충분한 데이터 축적 후)

**검증 기준 (autoresearch-skill eval-guide 적용):**
- [ ] 모든 eval이 binary (yes/no)인가?
- [ ] 3-6개 범위인가? (현재 6개)
- [ ] 각 eval에 대해: 두 사람이 같은 결론을 내릴 수 있는가?
- [ ] 각 eval에 대해: eval을 게임할 수 있는가? (anti-gaming)

---

### Phase 5: Output Revolution (실행 브릿지)

**목표**: 산출물이 "예쁜 마크다운"이 아니라 "실제로 쓸 수 있는 실행 도구".

**현재 문제**: 4종 산출물이 전부 마크다운 문자열 생성. Copy-paste 수준.

**목표:**

1. **Prompt Chain 2.0** — 맥락 인식 프롬프트 체인
```
현재: "시장 조사를 해주세요" (generic)
목표:
  "동남아 시장 진출의 타당성을 검증하기 위해
   다음 질문에 답하는 시장 분석을 수행해주세요:

   핵심 맥락:
   - 이 과제의 진짜 질문: '진출 이유가 타 성장 옵션보다 매력적인가?'
   - 미확인 전제: '동남아가 최우선 시장이다' (아직 검증 안 됨)
   - 이해관계자 우려: CFO가 ROI 근거를 요구할 것 (승인 조건: 3년 NPV 분석)

   이 프롬프트의 결과물은 선원 배치 Step 2의 입력이 됩니다.
   다음 프롬프트로 넘어가기 전에 [체크포인트]를 확인하세요."
```

2. **Agent Spec 2.0** — 가정 검증이 내장된 에이전트 스펙
```yaml
workflow:
  step_1:
    task: "시장 규모 분석"
    actor: ai
    # 새로운 필드들:
    validates_assumption: "assumption_2"  # 이 단계가 검증하는 전제
    abort_condition: "TAM < $50M"         # 이 조건이면 전체 중단
    success_signal: "TAM/SAM 분석 완료 + 경쟁사 맵 3개 이상"
    feeds_into: "step_3"                  # 다음 단계 의존성
```

3. **Execution Checklist 2.0** — 라이브 체크리스트
   - 체크박스 상태를 Supabase에 저장
   - 체크포인트 도달 시 자동 알림
   - 전제 검증 결과를 실시간 반영 (가정이 틀린 것으로 확인되면 관련 단계 경고)

**차용한 패턴:**
| 패턴 | 출처 | 적용 |
|------|------|------|
| `_Leverage:` / `_Requirements:` 추적 | SDD | 프롬프트 체인의 각 프롬프트에 맥락 출처 명시 |
| Approval gate | SDD + RIPER | 체크포인트에서 사용자 확인 없이 다음 단계 불가 |
| Constitution | SDD spec-kit | 조직 수준의 원칙을 모든 산출물에 반영 |

---

### Phase 6: Cross-User Intelligence (네트워크 효과) — 장기

**목표**: 사용자가 늘수록 모든 사용자에게 더 좋아지는 시스템.

**구현 (Supabase 기반):**

```sql
-- 익명 집계 테이블
CREATE TABLE reframing_patterns (
  id uuid PRIMARY KEY,
  interview_signal_hash text,  -- origin+uncertainty+success 조합의 해시
  strategy_used text,          -- 어떤 리프레이밍 전략이 사용됐는지
  pass_rate float,             -- binary eval 통과율
  sample_count int,            -- 이 패턴의 샘플 수
  updated_at timestamp
);

-- 개인 식별 정보 없이 패턴만 집계
-- "위에서 내려온 지시 + 왜 해야 하는지 모름 + 성공 기준 불명확"
--   → 'narrow_scope' 전략이 pass_rate 0.78 (n=47)
--   → 'challenge_existence' 전략이 pass_rate 0.35 (n=23)
```

이 데이터가 쌓이면:
- 새 사용자가 같은 패턴의 과제를 입력했을 때
- "비슷한 상황에서 범위를 좁히는 리프레이밍이 78%의 채택률을 보였습니다"
- 전략 선택의 기본값을 데이터 기반으로 설정

---

## 3. Implementation Priority Matrix

```
                    높은 Impact
                        ↑
                        |
   Phase 4 (Self-     |  Phase 1 (Adaptive
   Improving)          |  Decompose)
                        |          ★
   Phase 6 (Cross-    |  Phase 2 (Multi-Lens
   User)               |  Recast)
                        |
   ─────────────────────┼──────────────────→ 높은 Feasibility
                        |
   Phase 3 (Rehearsal  |  Phase 0 (Data
   Intelligence)       |  Pipeline)   ★★★
                        |
                        |  Phase 5 (Output
                        |  Revolution)
```

**★★★ Phase 0을 먼저**: 타입드 파이프라인 없이는 다른 모든 Phase가 마크다운 해킹에 의존.
**★ Phase 1+2를 다음**: 사용자가 체감하는 가장 큰 변화. Decompose + Recast가 진짜 "달라졌다" 느껴지는 순간.

### 권장 순서

```
Phase 0 (1-2주) → Phase 1 (2-3주) → Phase 2 (2-3주) → Phase 5 (1-2주) → Phase 3 (2주) → Phase 4 (2-3주) → Phase 6 (장기)
```

Phase 5를 Phase 3보다 앞에 놓는 이유: 산출물 품질 개선이 사용자에게 즉시 가시적.
Phase 4는 충분한 데이터가 쌓인 후에야 의미 있으므로 뒤로.
Phase 6은 사용자 기반이 생긴 후.

---

## 4. Technical Debt Resolution (병행)

Phase 구현과 병행하여 해결해야 할 기술 부채:

1. **Supabase 마이그레이션** — 새 필드들 (reframed_question, why_reframing_matters, verified, context_chain 등)
2. **에러 핸들링 강화** — LLM 호출 실패 시 graceful degradation
3. **성능 최적화** — Phase 2의 병렬 LLM 호출 시 rate limit 관리
4. **다국어 지원** — 시스템 프롬프트의 한국어/영어 분리
5. **테스트** — 최소한 context-builder, convergence, similarity에 대한 유닛 테스트

---

## 5. Success Metrics

### 단기 (Phase 0-2 완료 시점)
- 리프레이밍 채택률 (수정 없이 AI 제안 선택) > 60%
- 선원 배치까지 진행률 > 70%
- 평균 전제 "확인됨" 마킹 수 > 0.5개/세션 (사용자가 전제에 관여하는 증거)

### 중기 (Phase 3-5 완료 시점)
- 페르소나 정확도 평균 > 3.5/5
- 산출물 실제 사용률 (copy/download) > 40%
- 리파인먼트 루프 수렴까지 평균 반복 < 3회

### 장기 (Phase 6 시작 시점)
- 재방문율 > 50% (2주 내)
- 프로젝트 완료율 (4단계 모두 완료) > 30%
- 코다 성찰 작성률 > 20%

---

## 6. The One-Line Summary

**Argus는 "LLM에 좋은 프롬프트를 넣어주는 도구"가 아니라, "사용자의 판단 패턴을 학습하여 점점 더 정확한 리프레이밍을 제공하는 지능형 전략 엔진"이 되어야 한다.**

기술적 해자는 축적에서 나온다. 프롬프트는 복사할 수 있지만, 1000명의 사용자가 1000번의 판단을 내린 결과로 조정된 시스템은 복사할 수 없다.
