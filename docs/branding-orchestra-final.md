# Argus 브랜딩 최종 정리: 오케스트라 메타포 + 구현 설계

> `branding-orchestra-metaphor.md` (초안) + `branding-metaphor-deep-research.md` (심층 리서치) 통합.
> 확정된 방향만 남기고, 폐기된 아이디어는 제거.

---

## 1. 핵심 원칙: 2레이어 아키텍처

```
Layer 1: 구조 (불변, 기능적)
  4R 파이프라인. 메타포 없이도 작동. Notion의 "블록" 수준.

Layer 2: 브랜드 스킨 (가변, 분위기적)
  오케스트라 세계관. Slack의 브랜드 톤 수준. 독립 진화 가능.
```

**Layer 1은 기능 확장을 제약하지 않음.** 새 기능은 4R 안에 들어가면 됨.
**Layer 2는 이해를 강제하지 않음.** 악기 이름을 몰라도 아이콘 + 한 줄로 역할이 보임.

---

## 2. 살아남은 메타포 — 유지 + 강화

| 요소 | 기능적 매핑 | 왜 강한가 | 강화 방향 |
|---|---|---|---|
| **Argus** (이름) | 에이전트 실행 전 판단 | 포지셔닝이 한 단어에 인코딩 | 변경 없음 |
| **지휘자 = 사용자** | 직접 실행하지 않고 판단·조율 | 핵심 테제를 완벽히 담음 | 온보딩, 빈 화면에서 강화. 단 "지휘자가 되어가는 과정" 톤 |
| **악장(Concertmaster)** | 적응형 코칭 시스템 | 지휘자-연주자 중재 = 데이터 기반 메타 인사이트 | 유지. 사용자 대면 시 "악장" |
| **악보 해석 = Reframe** | 숨겨진 전제 발견 | "작곡가가 진짜 의도한 게 뭔가?" = 질문 재정의 | 이중 라벨 유지 (악보 해석 \| 문제 재정의) |
| **편곡 = Recast** | AI/인간 역할 분배 | 어떤 악기가 어떤 파트를 연주할지 배분 | 이중 라벨 유지 |
| **Score 이중 의미** | 악보(계획) + 점수(측정) | 자연스러운 공존 | UI에서 의도적 병치 |
| **비주얼 시스템** | 브랜드 정체성 | 이해를 요구하지 않으면서 차별화 | 오선지, 마디선, 페르마타, 다이내믹 마크, ConductorBaton |
| **Coda = 성찰** | 프로젝트 후 메타 성찰 | 구조적 위치와 기능이 동일 | 유지 |

---

## 3. 공식 폐기 목록

| 폐기 대상 | 폐기 이유 | 대체 |
|---|---|---|
| Movement I-IV 넘버링 | 2번 번역 필요 (Movement → 한국어 → 기능 설명) | 01/02/03/04 + 한국어 라벨 |
| Program Note 출력 형식 | 결정 문서는 "결정 자체"여야 함 | 기능적 출력 |
| Conductor's Remark (출력 섹션명) | 과잉 래핑 | 종합 판단 / DQ Score |
| 법정 어휘 직접 차용 | mixed metaphor 위험 | 중립 어휘로 (반론 → OK, "심리" → 불필요) |

---

## 4. 페르소나 = 연주자: 내부 기능 + 외부 스킨

### 4.1 내부: 기능적 분류 체계 (Layer 1)

기존 코드의 `decision_style` + `risk_tolerance`를 확장한 **역할 분류(persona_function)**:

```typescript
type PersonaFunction =
  | 'adversarial'    // 반론, 스트레스 테스트, 도발적 질문
  | 'analytical'     // 데이터, 구조, 논리 분석
  | 'empathetic'     // 사용자, 고객, 이해관계자 시선
  | 'integrative';   // 종합, 밸런스, 의사결정 프레이밍
```

이 분류는:
- 자동 앙상블 추천의 기준 (adversarial 최소 1명 필수 등)
- 블라인드 스팟 감지의 축 (기존 `AXIS_PERSONA_MAP`과 연결)
- 다양성 강제 규칙의 기반

**기존 코드와의 관계:**
| 기존 필드 | 관계 | 비고 |
|---|---|---|
| `decision_style` (analytical/intuitive/consensus/directive) | 유지. persona_function과 독립 | 같은 adversarial이라도 analytical vs intuitive 차이 |
| `risk_tolerance` (low/medium/high) | 유지. 직교 축 | adversarial + high risk = 가장 공격적 |
| `influence` (high/medium/low) | 유지. 가중치 축 | function과 무관한 권한 레벨 |
| `extracted_traits` | 유지. 자유 텍스트 | function은 시스템 분류, traits는 LLM 추출 |

### 4.2 외부: 악기 스킨 (Layer 2)

**persona_function → 악기군 매핑:**

| Function | 악기군 | 아이콘 | 한 줄 설명 (사용자에게 보이는 것) |
|---|---|---|---|
| adversarial | Brass (금관) | 🎺 | "도전하고 반론합니다" |
| analytical | Strings (현악) | 🎻 | "분석하고 검증합니다" |
| empathetic | Woodwinds (목관) | 🎵 | "사람의 관점에서 봅니다" |
| integrative | Percussion (타악) | 🥁 | "전체를 종합합니다" |

**세부 악기 배정 (시스템이 자동으로, 사용자는 아이콘+한 줄만 봄):**

```
adversarial:
  🎺 핵심 반론자        — 가장 직접적인 도전
  📯 숨겨진 리스크 탐지  — 구조적 약점 발굴
  🎵 대안 제시자        — 다른 길을 보여줌

analytical:
  🎻 논리 구조 분석     — 핵심 논증 검토
  🎻 데이터 검증        — 증거 기반 확인
  🎻 실행 가능성 체크   — 현실성 평가
  🎻 장기 관점          — 시간 축의 리스크와 기회

empathetic:
  🎵 고객/사용자 관점   — 최종 사용자 시선
  🎵 내부 팀 관점       — 실무자 현실
  🎵 시장/경쟁 관점     — 외부 환경
  🎵 규제/컴플라이언스  — 법적 제약

integrative:
  🥁 종합 판단          — 전체 균형
  🥁 우선순위 정리      — 무엇이 먼저인가
  🥁 미묘한 신호 포착   — 놓치기 쉬운 단서
```

**일관성 원칙**: 같은 persona_function + 같은 세부 역할이면 항상 같은 악기 아이콘. 사용자가 학습하고 애착이 생기려면 반복 가능한 identity 필요.

### 4.3 사용자 경험 예시

**리허설 결과 화면:**
```
🎺 핵심 반론 — 김도현 팀장
"투자 대비 효과가 불분명합니다. 6개월 뒤에도 이 결정이 맞다고 할 수 있나요?"

🎻 데이터 검증 — 박서연 실장
"제시된 시장 규모 데이터의 출처가 2024년입니다. 최신 수치 확인이 필요합니다."

🎵 고객 관점 — 이지은 매니저
"실제 사용자가 이 기능을 원하는지 직접 물어본 적이 없습니다."
```

사용자가 보는 것: 아이콘 + 역할 한 줄 + 이름 + 피드백.
악기를 모르는 사용자: 🎺="반론하는 사람"으로 학습. 끝.
악기를 아는 사용자: "트럼펫이 또 반대하네" — 더 재미있게 경험.

---

## 5. 앙상블 규모: 결정 복잡도 기반

| 규모 | 인원 | 브랜드 이름 | 적합한 결정 |
|---|---|---|---|
| Solo | 1 | Solo | 빠른 체크 |
| Duo | 2 | Duet | 찬반 대립, 핵심 트레이드오프 |
| Quartet | 3-4 | Quartet | 표준 검토. 대부분 여기 |
| Chamber | 5-8 | Chamber | 중요한 전략적 판단 |
| Orchestra | 9+ | Full Orchestra | 조직 차원 대형 결정 |

**시스템이 추천하는 방식:**
- "이 결정에는 **Quartet**이면 충분합니다" (UI에서)
- 내부적으로: adversarial 1 + analytical 1 + empathetic 1 + integrative 0-1

---

## 6. Smart Ensemble: 자동 편성 추천

### 기능적 로직 (Layer 1)

과제 유형 → 최적 persona_function 조합을 데이터 기반으로 추천.

```
투자 결정 → adversarial 2 + analytical 1 + empathetic 1 + integrative 1
  이유: 리스크가 핵심이므로 adversarial 비중 높게

브랜딩 전략 → empathetic 2 + adversarial 1 + analytical 1 + integrative 1
  이유: 사용자/시장 관점이 핵심이므로 empathetic 비중 높게

채용 결정 → empathetic 2 + analytical 1 + integrative 1
  이유: 사람 관점이 중심, 강한 adversarial은 오히려 부적합
```

### 성장 (데이터 축적에 따라)

1. **초기**: 과제 유형별 기본 템플릿
2. **중기**: 사용자 과거 DQ 데이터 기반 "이 조합이 효과적이었음"
3. **장기**: "이 function을 빼면 DQ가 N% 떨어지는 경향 — 유지 추천"

### 기존 코드와의 연결

현재 `auto-persona.ts`의 `recommendBlindSpotPersona()`가 이미 축별 블라인드스팟을 감지함:
- `customer_value` 축 약하면 → empathetic 추천
- `feasibility` 축 약하면 → analytical 추천
- `business` 축 약하면 → analytical (financial) 추천
- `org_capacity` 축 약하면 → empathetic (internal) 추천

이 로직에 persona_function을 연결하면 Smart Ensemble의 기반이 됨.

---

## 7. 구현 설계

### 7.1 타입 변경 (`stores/types.ts`)

```typescript
// 새 필드 추가
export interface Persona {
  // ... 기존 필드 유지 ...

  // Layer 1: 기능적 분류 (시스템 사용)
  persona_function?: 'adversarial' | 'analytical' | 'empathetic' | 'integrative';

  // Layer 2: 악기 스킨 (UI 표시용)
  instrument?: InstrumentSkin;  // persona_function에서 자동 파생 가능
}

export interface InstrumentSkin {
  section: 'brass' | 'strings' | 'woodwinds' | 'percussion';
  instrument: string;   // 'trumpet', 'violin', 'flute', 'timpani' 등
  icon: string;         // 이모지 or 아이콘 키
  label: string;        // "핵심 반론" — 사용자에게 보이는 한 줄
}
```

### 7.2 악기 배정 로직 (`lib/instrument-skin.ts`, 신규)

```typescript
// persona_function + 세부 역할 조합으로 악기를 결정론적 배정
export function assignInstrument(
  persona: Persona,
  roleInEnsemble: string  // 'core_objection' | 'data_validation' | ...
): InstrumentSkin {
  // persona_function → section 매핑
  // roleInEnsemble → 세부 악기 매핑
  // 결정론적: 같은 input → 항상 같은 output
}

// 앙상블 전체에 악기 배정 (중복 방지)
export function assignEnsembleInstruments(
  personas: Persona[]
): Map<string, InstrumentSkin> {
  // 같은 section 내에서 악기 중복 방지
  // influence 높은 persona에게 더 "주요" 악기 우선 배정
}
```

### 7.3 UI 변경 포인트

| 컴포넌트 | 현재 | 변경 |
|---|---|---|
| `PersonaCard.tsx` | 이름 첫 글자 아바타 + 색상 해시 | 악기 아이콘 추가 (이름 옆 또는 아바타 교체) |
| `FeedbackMessage.tsx` | 색상 해시 아바타 | 악기 아이콘 + "🎺 핵심 반론" 라벨 추가 |
| `FeedbackResult.tsx` | 페르소나 카드 그리드 | 섹션별 그룹핑 옵션 (Brass / Strings / ...) |
| `FeedbackRequest.tsx` | 페르소나 선택 체크박스 | 악기 아이콘으로 시각적 구분 강화 |
| 플러그인 출력 | `**이름** — 역할` | `🎺 **이름** — 역할 — 핵심 반론` |

### 7.4 플러그인 스킬 변경

Rehearse/Refine 출력에서 페르소나 앞에 악기 아이콘 + 한 줄 라벨 추가:

```
현재:
**김도현** — 데이터 분석 리드 — 투자 효과 의심 → **보류**

변경 후:
🎺 **김도현** — 데이터 분석 리드 — 핵심 반론 → **보류**
```

### 7.5 Supabase 변경

```sql
ALTER TABLE personas
  ADD COLUMN persona_function TEXT CHECK (persona_function IN ('adversarial', 'analytical', 'empathetic', 'integrative'));
-- instrument는 클라이언트에서 파생하므로 DB에 저장 불필요
```

### 7.6 자동 분류: persona_function 결정 방법

**신규 페르소나 생성 시:**
- Recast에서 자동 생성: LLM 프롬프트에 persona_function 필드 추가하여 함께 분류
- 수동 생성: `decision_style` + `risk_tolerance` + `priorities`를 기반으로 추론
  - `risk_tolerance: high` + 반론 중심 priorities → adversarial
  - `decision_style: analytical` + 데이터 중심 → analytical
  - 사용자/고객/팀 관련 priorities → empathetic
  - 종합/균형 지향 → integrative

**기존 페르소나:**
- 마이그레이션: 기존 필드로 추론하여 자동 배정 (optional이므로 null도 허용)

---

## 8. 다른 도메인에서의 선택적 흡수

오케스트라 프레임을 유지하되, **중립 어휘로 번역된** 다른 도메인의 좋은 아이디어:

| 원천 | 아이디어 | Argus에서의 적용 | 실제 어휘 |
|---|---|---|---|
| 우주 미션 | GO/NO-GO 폴 | 페르소나 수렴 체크 | "준비 완료 / 보류" (GO/NO-GO 직접 안 씀) |
| 요리 | "간 맞추기" 감각 | Refine 단계 톤 | "균형을 맞추는 중" (틀린 걸 고치는 게 아님) |
| 항해 | 항로 수정 = 숙련 | 반복의 긍정적 프레이밍 | "조율 중" (음악 어휘로 자연스럽게 번역) |

**원칙: 다른 도메인 어휘를 직접 쓰지 않는다.** mixed metaphor 방지. 아이디어만 가져오고 표현은 음악 또는 중립 어휘로.

---

## 9. 톤 가이드라인

### 쓸 것
- "앙상블을 구성합니다" (페르소나 생성 시)
- "리허설을 시작합니다" (검증 단계 진입 시)
- "조율 중입니다" (Refine loop 시)
- "이 결정에는 Quartet이면 충분합니다" (규모 추천 시)
- "🎺가 강하게 반대하고 있습니다" (핵심 반론 시)

### 쓰지 않을 것
- 음악 전문 용어 (sforzando, pizzicato, rubato...)
- 악기를 아는 사람만 이해할 수 있는 비유
- 다른 도메인 용어 직접 차용 (GO/NO-GO, 미장플라스 등)
- "지휘봉 기능", "보면대" 같은 구체적 음악 사물을 기능명으로

### 핵심 원칙
> 악기 이름을 몰라도 아이콘과 한 줄 설명으로 역할이 보여야 한다.
> 메타포를 학습해야 제품을 쓸 수 있으면 메타포가 실패한 것이다.

---

## 10. 메타포 졸업 설계

| 단계 | 메타포 역할 | 사용자 경험 |
|---|---|---|
| 초보 | 멘탈 모델 형성 | "악보를 해석하듯 문제를 읽으세요" — 비계 역할 |
| 중급 | 습관화 | 아이콘만 보고 역할 인식. 설명 안 읽음 |
| 숙련 | 투명화 | 메타포를 의식하지 않음. 4R 프로세스 자체만 사용 |

악장(Concertmaster)의 적응형 루프가 이 졸업을 실현:
데이터 축적 → 자동 채움 증가 → 속도 향상 → 메타포 비계 불필요.

---

## 11. 이 문서로 대체되는 문서들

- `branding-orchestra-metaphor.md` — 초안. 악기 매핑 상세, Movement 구조, Program Note 등 이 문서에서 폐기된 내용 포함
- `branding-metaphor-deep-research.md` — 리서치. 10개 대안 탐색, 케이스 스터디, 메타포 이론. 참고 자료로 유지하되 **실행 기준은 이 문서**
