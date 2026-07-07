# Argus 논문 → 구현 매핑

> 40편의 학술 연구가 Argus의 각 메커니즘에 어떻게 반영되었는지 정리한 문서.
> 작성일: 2026-03-25

---

## 1. 아첨(Sycophancy) 문제 → 페르소나 리허설

### 논문 핵심

| 논문 | 발견 |
|------|------|
| Sharma et al. (Anthropic, ICLR 2024) | 5개 SOTA 모델 모두 체계적 아첨. RLHF가 "동의하는 답변"에 높은 점수 부여 |
| Perez et al. (Anthropic, 2022) | RLHF 학습 증가 → 아첨 심화 (역 스케일링) |
| Fanous et al. (Stanford, 2025) | 58% 상황에서 아첨, 78.5%는 맥락/모델 무관하게 지속 |
| Cheng et al. (2025) | LLM이 인간보다 45%p 더 높은 비율로 사용자 입장 보호 |
| Kaur et al. (EMNLP 2025) | 사용자 주장이 강할수록 아첨 강화 — 강한 반론이 필요 |

### Argus 반영

- **리허설(페르소나 피드백)**: 단일 LLM 대화의 아첨을 제품 구조로 우회. 이해관계자 관점을 강제하여 반론 생성
- **Eval: `unspoken_risks_surfaced`**: "모두 알지만 아무도 안 꺼내는" 리스크 측정. 아첨하는 AI는 이걸 못 찾음
- **DQ 스코어: `initial_framing_challenged`**: AI가 사용자의 초기 프레이밍에 도전했는지 추적
- **DQ 스코어: `blind_spots_surfaced`**: 페르소나가 발견한 사각지대 수
- **Prompt mutation**: `unspoken_risks_surfaced` 실패 시 "침묵의 리스크를 더 적극적으로 찾으라" 자동 보정

### 참고 논문
- https://arxiv.org/abs/2310.13548
- https://arxiv.org/abs/2212.09251
- https://arxiv.org/abs/2502.08177
- https://arxiv.org/abs/2505.13995
- https://aclanthology.org/2025.findings-emnlp.1241/

---

## 2. 멀티에이전트 토론 → 다관점 페르소나 피드백

### 논문 핵심

| 논문 | 발견 |
|------|------|
| Du et al. (MIT, ICML 2024) | 멀티에이전트 토론 → 추론 정확도 81%→89% (+8%p), 환각 감소 |
| Liang et al. (2023) | 다른 역할 에이전트 → 더 다양한 해결책 생성 |
| Chan et al. (2023) ChatEval | 서로 다른 평가자 페르소나 토론 → 인간 평가 상관 대폭 향상 |
| Wu et al. (Microsoft, 2023) AutoGen | 정의된 역할 + 턴테이킹 → 단일 에이전트 대비 우수 |

### Argus 반영

- **페르소나 기반 리허설**: 2-3명 이해관계자가 각자 관점에서 동시 피드백 = 디지털 멀티에이전트 토론
- **Eval: `persona_views_diverse`**: 페르소나들이 실제로 다른 관점을 냈는지 측정 (리스크 중복률 < 60%)
- **Auto-persona**: 맥락에서 자동으로 이해관계자 추출 (decision_style, risk_tolerance, success_metric 포함)
- **Prompt mutation**: 다양성 낮으면 "차별화된 관점을 제시하라" 자동 보정

### 참고 논문
- https://arxiv.org/abs/2305.14325
- https://arxiv.org/abs/2305.19118
- https://arxiv.org/abs/2308.07201
- https://arxiv.org/abs/2308.08155

---

## 3. 구조화된 추론 > 자유 대화 → 4단계 워크플로우

### 논문 핵심

| 논문 | 발견 |
|------|------|
| Dell'Acqua et al. (Harvard/BCG, 2023) | 758명 실험. 구조화된 AI 사용이 자유형 대비 12% 성과 향상. AI 능력 밖 영역에서 자유형은 오히려 품질 하락 |
| Wei et al. (NeurIPS 2022) | Chain-of-Thought → 추론 성능 2배 |
| Yao et al. (NeurIPS 2023) | Tree of Thoughts → 선형 CoT 실패하는 문제도 해결 |
| Kahneman (2011) | System 1(직관) vs System 2(분석). 자유 대화 = System 1, 구조화 = System 2 |
| Kahneman et al. (2021) Noise | 판단을 독립적 하위 평가로 분해 → 편향 + 노이즈 모두 감소 |

### Argus 반영

- **4단계 워크플로우**: 악보 해석 → 편곡 → 리허설 → 합주 연습. 사고를 강제 구조화
- **16개 binary eval**: 4단계 각각의 품질을 독립적으로 측정 (Kahneman의 "판단 분해")
- **Context chain**: 단계 간 맥락을 타입-세이프하게 전달. 자유 대화의 맥락 손실 방지
- **DQ 스코어**: Spetzler(2016) Decision Quality 6요소를 코드로 구현
- **체크포인트 설계**: Dell'Acqua가 강조한 "AI 능력 밖 영역에서의 인간 감독" 구현

### 참고 논문
- https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4573321
- https://arxiv.org/abs/2201.11903
- https://arxiv.org/abs/2305.10601

---

## 4. 프리모템 / 전향적 사후분석 → failure_scenario + 리스크 분류

### 논문 핵심

| 논문 | 발견 |
|------|------|
| Klein (HBR, 2007) | "이미 실패했다고 가정" → 위험 식별 30% 향상, 집단사고 타파 |
| Mitchell et al. (1989) | 확실성 프레이밍 → 다른 인지 검색 프로세스 활성화 (원조 연구) |
| Tetlock & Gardner (2015) | 구조화된 반증 탐색이 예측 정확도 극적 향상 |

### Argus 반영

- **페르소나 피드백의 `failure_scenario`**: 각 이해관계자가 "이 계획이 실패하는 시나리오"를 필수 작성 = 디지털 프리모템
- **리스크 3분류** (critical/manageable/unspoken): 단순 나열이 아닌 행동 가능한 분류 체계
- **Outcome tracker**: 프리모템 예측 리스크가 실현됐는지 사후 검증 → Klein 연구에서 빠진 "예측 정확도 피드백 루프" 구현
- **`analyzePersonaPredictionAccuracy()`**: 페르소나별 리스크 예측 정확도를 카테고리별로 추적

### 참고 논문
- https://hbr.org/2007/09/performing-a-project-premortem
- https://doi.org/10.1037/0278-7393.15.4.596

---

## 5. 델파이 기법 → Refinement Loop (합주 연습)

### 논문 핵심

| 논문 | 발견 |
|------|------|
| Helmer & Dalkey (RAND, 1950s) | 독립 예측 → 공유 → 수정 → 반복이 비구조적 토론보다 정확. 앵커링/집단사고 제거 |
| Wang et al. (ICLR 2023) | 여러 추론 경로 + 다수결 → 단일 경로 대비 +17.9% |

### Argus 반영

- **합주 연습(Refinement Loop)**: 페르소나 피드백 → 수정 → 재피드백 → 수렴까지 반복 = 디지털 델파이
- **수렴 기준**: critical_risks == 0 AND 80% 승인 조건 충족
- **Eval: `converged_efficiently`**: 3회 이내 수렴 여부
- **Eval: `issues_trending_down`**: 반복마다 이슈 감소 여부 (수렴 품질)
- **Eval: `approval_conditions_met`**: 고영향력 조건 충족률

---

## 6. 페르소나 시뮬레이션 유효성 → Auto-persona + 정확도 추적

### 논문 핵심

| 논문 | 발견 |
|------|------|
| Argyle et al. (2023) | LLM에 배경 부여 → 실제 해당 집단 설문 응답과 유사 ("실리콘 샘플링") |
| Park et al. (UIST 2023) | LLM 에이전트가 장기간 일관된 페르소나 유지 가능 |
| Horton (NBER 2023) | GPT가 경제 에이전트 역할 수행, 행동경제학 실험 결과 재현 |
| Chiang et al. (ACM IUI 2024) | 상호작용형 악마의 대변인이 가장 효과적, 인지 부하 거의 없음 |

### Argus 반영

- **Auto-persona**: 프로젝트 맥락에서 이해관계자 자동 추출 (role, influence, decision_style, risk_tolerance, success_metric)
- **Persona accuracy tracking**: 피드백 정확도를 사용자가 평가, aspect 단위로 강점/약점 분석
- **Context builder의 `buildPersonaAccuracyContext()`**: 과거 정확도를 향후 프롬프트에 주입하여 보정
- **Outcome tracker의 `analyzePersonaPredictionAccuracy()`**: 예측 리스크 vs 실제 결과 비교

### 참고 논문
- https://doi.org/10.1017/pan.2023.2
- https://arxiv.org/abs/2304.03442
- https://arxiv.org/abs/2301.07543
- https://dl.acm.org/doi/10.1145/3640543.3645199

---

## 7. 의사결정 품질 독립 측정 → Decision Quality Score

### 논문 핵심

| 논문 | 발견 |
|------|------|
| Spetzler et al. (2016) | DQ 6요소: 프레이밍, 대안, 정보, 가치, 추론, 실행 의지. "좋은 결정 ≠ 좋은 결과" |
| Kahneman et al. (2021) Noise | "의사결정 위생" — 구조화된 프로토콜 준수가 편향 + 노이즈 감소 |
| Howard (Stanford, 1960s-2000s) | 의사결정 품질은 결과가 아닌 프로세스로 측정 |

### Argus 반영

- **`computeDecisionQuality()`**: 6요소를 Argus 데이터에서 자동 계산
  - appropriate_frame: 리프레이밍이 원래 질문과 다른가
  - creative_alternatives: 대안 질문이 몇 개 생성됐는가
  - relevant_information: 핵심 가정이 검증됐는가
  - clear_values: 이해관계자 관점이 반영됐는가
  - sound_reasoning: 수렴이 논리적이었는가
  - commitment_to_action: 구체적 실행 계획이 있는가
- **`analyzeDQTrend()`**: 시간에 따른 DQ 추세 분석 (improving/stable/declining)
- **`correlateDQWithOutcomes()`**: DQ 스코어와 실제 결과 비교 — 핵심 연구 질문 답변 함수

---

## 고유한 연구 기여 — Argus만의 질문

기존 연구들은 각각 **하나의 메커니즘**만 검증:
- CoT → 추론 구조화만
- Multi-Agent Debate → 토론만
- Pre-mortem → 위험 식별만
- Devil's Advocate → 반론만
- Delphi → 반복 수렴만

**Argus가 답할 수 있는 고유한 질문:**

> "이 모든 기법을 하나의 워크플로우로 통합했을 때 시너지가 있는가?"

이를 답하기 위해 구현된 측정 체계:

```
[16개 eval] → 각 단계 품질 독립 측정
[DQ 스코어] → 전체 프로세스 품질 종합
[Outcome tracker] → 실제 결과와 비교
[correlateDQWithOutcomes()] → "높은 DQ → 더 나은 결과?" 검증
```

---

## 실제 구현 파일 매핑

| 학술 원리 | 측정 파일 | 핵심 함수 |
|----------|----------|----------|
| 아첨 우회 | `eval-engine.ts` | `REHEARSAL_EVALS` (`unspoken_risks_surfaced`) |
| 멀티에이전트 | `eval-engine.ts` | `REHEARSAL_EVALS` (`persona_views_diverse`) |
| 구조화 추론 | `decision-quality.ts` | `computeDecisionQuality()` |
| 프리모템 | `outcome-tracker.ts` | `analyzePersonaPredictionAccuracy()` |
| 델파이 수렴 | `eval-engine.ts` | `REFINEMENT_EVALS` (`converged_efficiently`) |
| 페르소나 유효성 | `outcome-tracker.ts` | `analyzePersonaPredictionAccuracy()` |
| DQ 독립 측정 | `decision-quality.ts` | `correlateDQWithOutcomes()` |
| 자가 보정 | `prompt-mutation.ts` | `applyPromptMutations(tool)` |
| 학습 루프 | `context-builder.ts` | `buildEnhancedSystemPrompt()` |
| 회고 피드백 | `retrospective.ts` | `saveRetrospectiveAnswer()` |

---

*전체 참고 논문 목록은 `docs/research-foundations.md` 참조.*
*전략적 재구성 플랜은 `docs/strategic-restructuring-plan.md` 참조.*
