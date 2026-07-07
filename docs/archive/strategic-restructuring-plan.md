# Argus 전략적 재구성 플랜

> 학술 연구 40편 + 제품화 사례 + Anthropic/OpenAI 방향성 + 코드 심층 분석을 종합한 문서.
> 작성일: 2026-03-24

---

## Part 1: 시장 분석 — Argus가 서 있는 곳

### 확인된 시장 공백

| 영역 | 현재 상태 | Argus와의 관계 |
|------|----------|-----------------|
| **AI 구조화된 의사결정 제품** | 없음. 프레임워크(CrewAI, AutoGen)만 있고 end-user 제품 부재 | **정확히 이 자리** |
| **AI 악마의 대변인 제품** | 없음. 어떤 메이저 랩도, 어떤 스타트업도 만들지 않음 | **Argus의 리허설이 유일한 구현체** |
| **의사결정 품질 측정 + AI** | Decision Intelligence 시장 $8B+이지만 frontier LLM 미연동 | **연결 기회** |
| **합성 페르소나 for 의사결정** | Synthetic Users 등은 UX 리서치용. 전략적 의사결정용은 없음 | **차별화 가능** |

### Anthropic이 관심 갖는 문제 vs Argus가 푸는 문제

```
Anthropic 연구 과제                    Argus가 하는 것
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
아첨(Sycophancy) 감소         ←→  페르소나가 구조적으로 반론 강제
CoT 충실성(faithfulness)      ←→  4단계 사고 과정을 명시적으로 추적
확장 가능한 감독(scalable oversight) ←→  다관점 검증으로 AI 출력 교차 검증
멀티에이전트 정렬              ←→  여러 페르소나 에이전트의 수렴 프로세스
```

**핵심 발견:**
> "어떤 메이저 랩도 '당신의 결정을 체계적으로 도전하고, 반론을 제시하고,
> 여러 관점에서 결과를 시뮬레이션하고, 인지편향을 피하게 돕는' 제품을 만들지 않았다."

이건 빈 자리가 아니라 **이름 없는 카테고리**야. Argus가 이 카테고리를 정의할 수 있다.

### 경쟁 환경

| 플레이어 | 뭘 하는가 | Argus vs 차이 |
|----------|----------|----------------|
| **Elicit** | AI 리서치 어시스턴트. 논문 검색/분석 | 리서치 도구 ≠ 의사결정 도구 |
| **Perplexity** | AI 검색엔진. 정보 수집 | 정보 수집 ≠ 판단 |
| **CrewAI/AutoGen** | 멀티에이전트 프레임워크 | 인프라 ≠ 제품 |
| **Synthetic Users** | 합성 유저 리서치 | UX 리서치 ≠ 전략적 의사결정 |
| **Cloverpop** | 의사결정 추적 플랫폼 | 추적만 함, AI 분석 없음. 사실상 실패 |
| **Claude Cowork** | 에이전틱 지식 작업 | 범용 자동화 ≠ 구조화된 사고 |

---

## Part 2: Argus 코드 심층 진단 — 핵심 Gap

### 현재 아키텍처의 강점
- 4단계 워크플로우가 학술 근거와 정확히 매핑됨
- context-chain이 단계 간 맥락을 타입-세이프하게 전달
- 페르소나 시스템이 자동 추출 + 수동 보완 + 정확도 추적 지원
- judgment_records로 사용자 판단 이력 추적
- eval-engine이 이진 평가 프레임워크 제공

### 치명적 Gap 5가지

#### Gap 1: Eval이 Decompose만 커버

```
현재:
  Decompose  → eval ✅ (4개 이진 평가)
  Recast → eval ❌
  Rehearsal   → eval ❌
  Refinement  → eval ❌

필요:
  모든 단계에 eval → 전체 워크플로우 품질 측정 가능
```

지금 상태로는 "Argus가 효과가 있다"를 증명할 수 없음.
Decompose 품질만 측정하고, 나머지 75%는 블랙박스.

#### Gap 2: 학습 루프가 단방향

```
데이터 수집 → localStorage/Supabase → ...끝

수집은 하지만 AI 프롬프트에 반영되지 않음:
- Coda 반성 → 사용자에게 보여주기만 함
- Judgment 기록 → 통계만 표시
- 페르소나 정확도 → context-builder에서 약하게 반영
- 전략 성과 → reframing-strategy와 연결 안 됨
```

#### Gap 3: 결과(Outcome) 추적 없음

```
현재 흐름:
  문제 → 분석 → 페르소나 → 수렴 → 끝 ← 여기서 멈춤

빠진 것:
  → 실행 → 결과 기록 → "가설이 맞았나?" → "어떤 리스크가 실현됐나?"
```

이게 없으면:
- "Argus를 쓰면 더 나은 결정을 내린다"를 증명 불가
- 페르소나 예측 정확도를 실제 결과와 비교 불가
- 시간이 지나도 데이터의 가치가 쌓이지 않음

#### Gap 4: 수렴 판정이 취약

```
현재:
- 승인 조건 매칭이 문자열 유사도 0.5 (fragile)
- 수렴 기준 하드코딩 (critical_risks == 0 AND approval >= 80%)
- 페르소나가 조건을 바꾸면 이전 조건 소실

문제:
- "CFO 설득하기" ≠ "재무 승인 확보" (의미는 같지만 매칭 실패)
- 탐색적 프로젝트에 80% 기준은 과도, 안전 프로젝트엔 부족
```

#### Gap 5: Retrospective 답변 미저장

```
현재:
  generateRetrospectiveQuestions() → 질문 생성
  → 사용자가 읽음
  → 끝 (답변 저장 안 함)

낭비:
  가장 가치 있는 데이터(사용자의 성찰)가 수집되지 않음
```

---

## Part 3: 재구성 전략 — "LLM 포장지"에서 "의사결정 품질 플랫폼"으로

### 핵심 전환

```
AS-IS:                              TO-BE:
"AI가 사고를 도와주는 도구"          "의사결정 품질을 측정하고 개선하는 플랫폼"
 (LLM이 가치의 80%)                  (LLM은 30%, 측정/학습이 70%)

AI 호출 → 결과 표시 → 끝            AI 호출 → 결과 → 실행 → 결과추적 → 학습 → 개선
     ↑ 포장지                              ↑ 플랫폼
```

### Phase 0: 기반 — 전체 단계 Eval 확장 [최우선]

현재 `eval-engine.ts`의 decompose 4개 eval을 전 단계로 확장.

**Recast Evals (제안):**

| Eval ID | 질문 | 측정 방법 |
|---------|------|----------|
| `governing_idea_kept` | 사용자가 핵심 아이디어를 유지했는가? | governing_idea 편집 여부 |
| `steps_not_restructured` | AI 설계를 크게 재구성하지 않았는가? | step 추가/삭제 2개 이하 |
| `actor_assignments_kept` | AI의 역할 배정을 대부분 유지했는가? | actor override < 30% |
| `assumptions_identified` | AI가 유의미한 핵심 가정을 찾았는가? | key_assumptions >= 2개 |

**Rehearsal Evals (제안):**

| Eval ID | 질문 | 측정 방법 |
|---------|------|----------|
| `risks_found_useful` | 사용자가 식별된 리스크를 유용하게 평가했는가? | accuracy_rating avg >= 3 |
| `critical_risks_addressed` | critical 리스크가 refinement에서 처리됐는가? | critical → addressed 비율 |
| `persona_diversity` | 페르소나들이 서로 다른 관점을 제시했는가? | classified_risks 중복률 < 50% |
| `unspoken_surfaced` | "unspoken" 리스크가 1개 이상 나왔는가? | unspoken_risks >= 1 |

**Refinement Evals (제안):**

| Eval ID | 질문 | 측정 방법 |
|---------|------|----------|
| `converged_efficiently` | 3회 이내 수렴했는가? | iterations <= 3 |
| `issues_decreasing` | 이슈가 반복마다 줄었는가? | issue_trend 단조 감소 |
| `no_circular_issues` | 같은 이슈가 반복되지 않았는가? | 이전 iteration 이슈 재출현율 < 20% |
| `approval_stable` | 승인 조건이 안정적이었는가? | 조건 변경률 < 30% |

→ **총 16개 eval (4 x 4단계)** — Argus 전체 워크플로우 품질을 정량 측정.

### Phase 1: Outcome Tracking — 진짜 해자

**새 모듈: `outcome-tracker.ts`**

사용자가 실행 후 기록하는 구조:

```typescript
interface OutcomeRecord {
  id: string;
  project_id: string;
  recorded_at: string;

  // 가설 검증
  hypothesis_result: 'confirmed' | 'partially_confirmed' | 'refuted' | 'not_testable';
  hypothesis_notes: string;

  // 리스크 실현
  materialized_risks: {
    risk_id: string;        // classified_risk에서 참조
    persona_id: string;     // 누가 예측했는가
    category: string;       // critical / manageable / unspoken
    actually_happened: boolean;
    impact_description?: string;
  }[];

  // 승인 조건 충족
  approval_outcomes: {
    condition_id: string;
    met_in_reality: boolean;
    notes?: string;
  }[];

  // 전반적 결과
  overall_success: 'exceeded' | 'met' | 'partial' | 'failed';
  key_learnings: string;
  what_would_change: string;
}
```

**이것이 만드는 데이터:**
- 페르소나 X가 예측한 리스크 중 실제로 일어난 비율 → 페르소나 예측 정확도
- "unspoken 리스크"가 실제로 가장 치명적이었는가? → 리스크 분류 가치 증명
- 전체 워크플로우를 거친 프로젝트의 성공률 → Argus 효과 증명

### Phase 2: 학습 루프 완성

**2A. Retrospective 답변 저장 + 활용**

```typescript
// 새로운 타입
interface RetrospectiveAnswer {
  question_id: string;
  question_text: string;
  category: 'process' | 'judgment' | 'learning';
  answer: string;
  data_basis: string;
  project_id: string;
  created_at: string;
}
```

- `retrospective.ts` 수정: 답변 저장 → Supabase + localStorage
- `context-builder.ts` 수정: 과거 프로젝트 retrospective 답변을 새 프로젝트의 시스템 프롬프트에 주입
- 특히 "다음에 다르게 할 것" 답변은 직접 프롬프트에 반영

**2B. 전략 선택 → 데이터 기반 전환**

```
현재:
  reframing-strategy.ts → 규칙 기반 (if/else)
  eval-engine.ts → 전략별 성과 분석 (별도)
  → 연결 안 됨

개선:
  reframing-strategy.ts가 eval-engine의 전략 성과 데이터를 참조
  → "이 신호 조합에서 역사적으로 가장 효과적이었던 전략" 선택
  → 충분한 데이터가 없으면 기존 규칙 기반으로 fallback
```

**2C. Prompt Mutation 전 단계 확장**

```
현재: prompt-mutation.ts가 decompose eval 실패만 처리
개선: 16개 전체 eval의 실패 패턴에 대응하는 mutation 맵 구축
```

### Phase 3: Decision Quality 측정 프레임워크

**학술 기반 DQ 프레임워크를 코드로 구현**

Spetzler (2016) Decision Quality + Kahneman (2021) Decision Hygiene 기반:

```typescript
interface DecisionQualityScore {
  project_id: string;
  measured_at: string;  // 의사결정 시점 (결과와 독립)

  // DQ 6요소
  appropriate_frame: number;      // 리프레이밍이 원래 질문보다 나았는가
  creative_alternatives: number;  // 대안이 몇 개 생성됐는가
  relevant_information: number;   // 핵심 가정이 검증됐는가
  clear_values: number;           // 이해관계자 우선순위가 명확했는가
  sound_reasoning: number;        // 논리적 비약 없이 수렴했는가
  commitment_to_action: number;   // 실행 가능한 구체적 계획인가

  // Anti-sycophancy 지표
  initial_framing_challenged: boolean;  // AI가 초기 프레이밍에 도전했는가
  blind_spots_surfaced: number;         // 페르소나가 발견한 사각지대 수
  user_changed_mind: boolean;           // 리허설 후 사용자가 입장을 바꿨는가

  // 프로세스 품질 (Noise 기반)
  decomposition_quality: number;  // 판단이 하위 평가로 잘 분해됐는가
  independence_of_views: number;  // 페르소나들이 독립적 관점 제시했는가

  // 종합
  overall_dq: number;  // 0-100
}
```

**측정 시점이 중요:**
- 이건 **결과와 독립적으로** 의사결정 시점에 측정
- "좋은 결정 ≠ 좋은 결과" (Spetzler)
- 나중에 outcome과 비교하면 "높은 DQ → 더 나은 결과?" 검증 가능

---

## Part 4: Anthropic에게 매력적인 프로덕트가 되려면

### Anthropic이 사고 싶을 것 = "증명된 안티-시코팬시 제품"

**왜:**
- Anthropic은 sycophancy를 모델 레벨에서 풀려고 함 (Constitutional AI, persona vectors, Petri)
- 하지만 모델 레벨만으로는 한계가 있다고 인정 (Claude 4.5도 70-85% 개선일 뿐 100% 아님)
- **제품 레벨 솔루션**은 그들의 접근을 보완 — 모델이 아무리 좋아져도 구조화된 다관점 검증은 추가 가치
- OpenAI의 2025년 4월 GPT-4o 아첨 위기(롤백까지 함)가 이 문제의 심각성을 시장에 각인

**Argus가 증명해야 할 것:**

```
"Argus의 구조화된 다관점 검증을 거치면,
단일 Claude 대화 대비:
- 사각지대 발견 N배 증가
- 사용자의 초기 확증편향 X% 교정
- 의사결정 후 결과 만족도 Y% 향상"
```

이 데이터가 있으면:
- 블로그/논문 발표 가능
- Anthropic의 안전성 내러티브와 정확히 맞물림
- "Claude를 이렇게 쓰면 더 안전하고 효과적"이라는 증거 = Anthropic이 원하는 것

### 구체적 연구 설계

**비교 실험 (사용자 충분히 모인 후):**

```
A그룹: Claude에게 직접 "이 결정 어떻게 생각해?" 물어봄
B그룹: Argus 4단계 워크플로우로 같은 결정 처리

측정:
1. 사각지대 발견 수 (A vs B)
2. 초기 가정 변경 횟수 (A vs B)
3. 위험 식별 수 (A vs B)
4. 6개월 후 결과 만족도 (A vs B)
```

이건 Dell'Acqua (2023) Harvard/BCG 연구의 Argus 버전이 됨.

### 현실적 로드맵

```
Phase 0 [1-2주]   전체 단계 Eval 확장
                   → "측정할 수 있다"의 기반

Phase 1 [2-3주]   Outcome Tracking 모듈
                   → "결과를 추적한다"의 기반

Phase 2 [3-4주]   학습 루프 완성
                   → Retrospective 저장, 전략 데이터 기반화, Mutation 확장
                   → "시간이 지날수록 좋아진다"의 기반

Phase 3 [4-6주]   Decision Quality 측정
                   → DQ 스코어 자동 계산
                   → "품질을 정량화한다"의 기반

Phase 4 [6-8주]   대시보드 + 인사이트
                   → 사용자에게 "당신은 이런 의사결정자입니다" 보여주기
                   → "개인화된 가치"의 기반

Phase 5 [이후]    비교 연구 시작
                   → A/B 데이터 수집
                   → "Argus가 효과 있다"의 증거
```

---

## Part 5: 형태(Form Factor) 최종 결론

### 리서치 결과 기반 재평가

| 형태 | 판단 | 근거 |
|------|------|------|
| **웹앱 (현재)** | ✅ 유지 + 강화 | 데이터 수집/측정/학습의 본진. DQ 대시보드와 outcome 추적의 자연스러운 홈 |
| **MCP/Plugin** | ⏸️ 보류 | MCP는 이미 산업 표준(97M+ 월간 SDK 다운로드). 나중에 만들어도 늦지 않음. 지금은 측정 기반부터 |
| **메시징 봇** | ❌ 당분간 안 함 | 구조화된 4단계 + DQ 측정을 채팅으로 담을 수 없음 |
| **API** | 🔜 Phase 3 이후 | DQ 측정 API를 외부에 제공 — "의사결정 품질 측정 as a Service" |

### MCP를 나중에 만들 때의 전략

```
MCP 제공 범위:
- Decompose (1단계) 무료 체험
- DQ 스코어 요약 조회

MCP에서 안 되는 것:
- 전체 4단계 워크플로우
- Outcome 추적 + 학습 루프
- 개인화된 인사이트

→ "맛보기 → 웹앱 전환" 퍼널
→ 프롬프트가 보여도 상관없음 — 가치는 축적된 데이터에 있으니까
```

---

## Part 6: 핵심 코드 변경 사항 정리

### 수정할 파일

| 파일 | 변경 내용 | Phase |
|------|----------|-------|
| `eval-engine.ts` | Recast/Rehearsal/Refinement eval 추가 (12개) | 0 |
| `stores/types.ts` | OutcomeRecord, RetrospectiveAnswer, DecisionQualityScore 타입 추가 | 0-3 |
| `retrospective.ts` | 답변 저장 로직 추가 | 2 |
| `context-builder.ts` | Retrospective 답변 + Outcome 데이터를 프롬프트에 주입 | 2 |
| `reframing-strategy.ts` | eval-engine 전략 성과 연동 | 2 |
| `prompt-mutation.ts` | 전 단계 eval 실패 대응 mutation 맵 확장 | 2 |
| `convergence.ts` | 의미 기반 승인 조건 매칭 (LLM 활용 or 임베딩) | 2 |
| `signal-recorder.ts` | Outcome 이벤트 + DQ 스코어 기록 추가 | 1-3 |

### 새로 만들 파일

| 파일 | 목적 | Phase |
|------|------|-------|
| `outcome-tracker.ts` | 실행 결과 기록 + 리스크 실현 추적 + 가설 검증 | 1 |
| `decision-quality.ts` | DQ 스코어 자동 계산 (Spetzler + Kahneman 기반) | 3 |
| `anti-sycophancy-metrics.ts` | 아첨 우회 효과 측정 (사각지대, 입장 변경, 도전 횟수) | 3 |

### 수정할 컴포넌트

| 컴포넌트 | 변경 | Phase |
|----------|------|-------|
| `RefinementLoopStep.tsx` | 수렴 후 Outcome 기록 UI 추가 | 1 |
| `WorkspaceStep (새)` | 프로젝트별 DQ 대시보드 | 4 |
| `ConcertmasterInline.tsx` | Outcome 기반 인사이트 추가 | 4 |

### DB 마이그레이션

```sql
-- outcome_records 테이블
create table outcome_records (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  hypothesis_result text check (hypothesis_result in ('confirmed','partially_confirmed','refuted','not_testable')),
  hypothesis_notes text,
  materialized_risks jsonb default '[]',
  approval_outcomes jsonb default '[]',
  overall_success text check (overall_success in ('exceeded','met','partial','failed')),
  key_learnings text,
  what_would_change text,
  created_at timestamptz default now()
);

-- retrospective_answers 테이블
create table retrospective_answers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  question_id text not null,
  question_text text not null,
  category text check (category in ('process','judgment','learning')),
  answer text not null,
  data_basis text,
  created_at timestamptz default now()
);

-- decision_quality_scores 테이블
create table decision_quality_scores (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id),
  appropriate_frame numeric,
  creative_alternatives numeric,
  relevant_information numeric,
  clear_values numeric,
  sound_reasoning numeric,
  commitment_to_action numeric,
  initial_framing_challenged boolean,
  blind_spots_surfaced integer,
  user_changed_mind boolean,
  overall_dq numeric,
  created_at timestamptz default now()
);
```

---

## Part 7: 한 줄 요약

**"프롬프트는 공개해도 된다. 프레임워크도 공개해도 된다.
하지만 '이 방법이 실제로 효과가 있다'는 증거와,
'당신의 3개월치 의사결정 품질 데이터'는 복제할 수 없다."**

Argus의 다음 단계는 새로운 기능을 추가하는 게 아니라,
**이미 만든 것의 효과를 측정하는 시스템을 구축하는 것**이다.

---

*이 문서는 다음 리서치에 기반함:*
- *학술 논문 40편 (research-foundations.md 참조)*
- *제품화 사례 분석: Elicit, Consensus, CrewAI, AutoGen, Synthetic Users, Cloverpop 등*
- *Anthropic 전략: MCP 생태계, Claude Cowork, 아첨 연구, 해석가능성 연구*
- *OpenAI 전략: o3/o4 추론 모델, GPT Store 실패, 아첨 위기*
- *Argus 소스코드 심층 분석: /src/lib/ 전체 + /src/stores/types.ts*
