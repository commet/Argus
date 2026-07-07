# Judgment Vitality Engine

> "서로를 지탱함을 통해서 얻은 안정감과 체계화 때문에 이들은 경직되어 간다."
> — 컴퓨터와 마음 기말고사 답안 (2014, 서울대 김재인 교수님 수업)

## 배경

2014년, 서울대 "컴퓨터와 마음" 수업에서 Bateson의 *Mind and Nature*을 원서로 읽으며 한 학기를 보냈다. 12년 후 Argus를 만들다 막혔을 때, 당시 시험 우수답안을 다시 꺼내 읽었다. 자아와 세계의 관계를 논한 기말 답안에서 발견한 위 문장이 — AI 아첨 문제, 형식적 수렴, 프로세스 게이밍 등 Argus가 부딪힌 모든 문제의 본질이었다.

User↔AI가 서로 동의하면 경직된다. User↔Persona가 예측 가능해지면 경직된다. User↔System을 게이밍하면 경직된다. System↔System이 DQ 인플레이션을 일으키면 경직된다.

10개의 이론적 기반을 10개의 개별 기능이 아닌, **하나의 엔진**으로 통합했다.

## 핵심 질문

**"이 판단 과정은 살아있는가, 죽어있는가?"**

## 아키텍처

concertmaster.ts 패턴을 따르는 **읽기 전용 레이어**. 기존 store/signal에서 읽고, recordSignal()로 쓰고, concertmaster coaching으로 전달.

```
각 단계 eval 기록 시 → buildStageFingerprint → stage_fingerprint signal
                                                        ↓
리허설 완료 → translateApprovalsToPlan → translated_approvals 저장
                                                        ↓
DQ 계산 시 → assessVitality → VitalityAssessment 저장 + signal
                                                        ↓
Concertmaster 호출 시 → vitality insights/coaching → 사용자에게 표시
```

## Phase 구성

### Phase 0: Actor Relationship 모델 전환

기존 `ai | human | both` → `human | ai | human→ai | ai→human`

| 값 | 의미 | 예시 |
|---|------|------|
| `human` | 사람만 | 이해관계자 미팅, 최종 의사결정 |
| `ai` | AI만 | 데이터 수집, 분석 자동화 |
| `human→ai` | 사람이 판단/방향, AI가 실행 | "전략 방향 잡으면 AI가 초안" |
| `ai→human` | AI가 생성/분석, 사람이 결정 | "AI가 옵션 제시하면 내가 선택" |

"경계가 아니라 관계를 설계하라" (2014 기말 3번 답안) — 누가 하느냐가 아니라 어떤 순서로 협업하느냐.

### Phase 1: Instrumentation (볼 수 있게 만들기)

- `buildStageFingerprint(phase, item)` → 각 단계 출력의 구조적 스냅샷
- `translateApprovalsToPlan(record, steps, personas)` → 페르소나 승인조건을 step 레벨로 매핑
- `buildProvenanceChain(reframe, recast, feedback, refine)` → 인사이트 출처 추적 (어떤 가정이 어디까지 영향을 미쳤는가)

### Phase 2: Measurement (γ 계산)

- `computeStageGamma(fingerprint)` → 각 단계가 생산한 진짜 부가가치 (0-1)
  - Reframe: 질문이 바뀌었는가, 가정의 수와 축 다양성
  - Recast: actor 다양성, 체크포인트 비율, 크리티컬 패스
  - Rehearse: 리스크 다양성, unspoken 리스크 비율, 승인조건 수
  - Refine: 이슈 해결량, 조건 충족률, iteration 횟수
- `computeProjectGamma(reframe, recast, feedback, refine)` → 전체 프로젝트 γ + provenance bonus
- `measureFeedbackNovelty(initial, reReview)` → 피드백 신선도 (0=동일, 1=완전히 다름)

빈 프로젝트 = γ 0.5 (neutral). 불완전 프로젝트 ≠ dead.

### Phase 3: Detection (경직 감지)

7종 경직 신호:

| 카테고리 | 신호 | severity |
|---------|------|----------|
| User↔AI | `convergence_too_fast` — 1회 수렴 + low γ | 0.3 |
| User↔AI | `frame_unchanged` — surface ≈ reframed (유사도 >0.8) | 0.6 |
| User↔Persona | `feedback_predictable` — 리뷰 vs 리리뷰 novelty <0.2 | 0.4 |
| User↔Persona | `same_persona_set` — 3회+ 연속 같은 세트 | 0.3 |
| User↔System | `low_gamma_high_dq` — γ <0.2 but DQ >70 | 0.7 |
| User↔System | `translated_approval_ignored` — 구체적 제안 미반영 | 0.5 |
| User↔System | `actor_pattern_rigid` — 같은 actor 패턴 반복 | 0.3 |

**Vitality Score** = γ × (1 - rigidity_score)

| 범위 | 분류 | 의미 |
|------|------|------|
| >0.7 | alive | 진짜 판단 진행중 |
| 0.4-0.7 | coasting | 루틴화 시작 |
| 0.2-0.4 | performing | 형식적 수행 |
| <0.2 | dead | 순수 compliance |

### Phase 4: Response (티어별 개입)

에스컬레이션:
- 첫 발생 → Tier 1 (힌트)
- 2회차 → Tier 2 (명시적 플래그)
- 3회+ → Tier 3 (구조적 개입 제안)
- 5회+ 행동변화 없음 → Tier 4 (메타코칭)

Tier 4 예시:
> "서로 지탱하면 경직된다 — 이 AI와의 관계도 마찬가지일 수 있습니다. 이 도구를 잘 쓰는 것이 아니라, 진짜 판단을 내리는 것이 목표입니다."

concertmaster의 기존 insights/coaching에 자연스럽게 통합. tier 2+ 사용자에게만 표시.

## 파일 구조

| 파일 | 역할 |
|------|------|
| `src/lib/judgment-vitality.ts` | 엔진 전체 (Phase 1-4, 14개 함수) |
| `src/lib/__tests__/judgment-vitality.test.ts` | 단위 테스트 40개 |
| `src/lib/__tests__/judgment-vitality-simulation.test.ts` | 시나리오 시뮬레이션 7개 |
| `src/stores/types.ts` | VitalityAssessment, StageFingerprint, RigiditySignal 등 |
| `src/lib/concertmaster.ts` | vitality coaching 통합 |
| `src/lib/eval-engine.ts` | fingerprint 기록 통합 |
| `src/lib/decision-quality.ts` | vitality 계산+저장 통합 |

## 알려진 한계

### 의도적 한계 (v0)
- **gamma는 구조적 프록시.** "사고가 진짜 변했는가"가 아니라 "구조적 풍부함"을 측정. outcome 데이터 축적 후 calibrate 예정.
- **bag-of-words cosine similarity.** 한국어 합성어 문제 있음. Transformers.js (multilingual MiniLM) 교체 검토 중.
- **coaching 효과 미검증.** 경직 경고가 실제 행동 변화를 일으키는지는 outcome tracking 성숙 후 검증.

### 향후 개선 (research-cognitive-change-measurement.md 참고)
- 행동 신호 추가: 삭제 비율, 편집 위치 분산, 뒤로 돌아가기 패턴
- 담화 표지 감지: "하지만", "사실은", "다시 생각해보면" 등 전환 표지 카운트
- Sentence Embedding: `paraphrase-multilingual-MiniLM-L12-v2` (50MB, 브라우저, 한국어)
- 문장 단위 정보 이득: 새로 추가/삭제된 주장 비율 = thinking change index

## Devil's Advocate 리뷰 결과

15개 이슈 발견. 8개 즉시 수정:

| 수정 | 내용 |
|------|------|
| computeGamma 재설계 | 크로스 페이즈 비교 → 각 페이즈 자체 품질 측정 (`computeStageGamma`) |
| 임계값 0.15 → 0.3 | translateApprovalsToPlan 오탐 방지 |
| 불완전 프로젝트 보호 | 빈 fingerprint = 0.5 (neutral), not 0 (dead) |
| vitality 공식 일관성 | maxRigidity → avg rigidityScore로 통일 |
| fingerprint 중복 제거 | computeProjectGamma가 반환한 fingerprints 재사용 |
| 바 차트 세그먼트 추가 | human→ai, ai→human 시각화 |
| LLM 프롬프트 업데이트 | Recast AI에 새 actor 타입 안내 |
| ActorToggle 폴백 | 레거시 'both' → 'human→ai' 하이라이트 |

## 테스트 현황

- 단위 테스트: 40개 통과
- 시뮬레이션: 7개 시나리오 통과
- 전체: 1000/1000 통과 (기존 포함)
- 빌드: next build 성공
- 타입: tsc --noEmit 에러 0
