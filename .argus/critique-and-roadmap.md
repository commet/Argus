# Argus Plugin — Critique & Improvement Roadmap

> 2026-03-28 | 내부 리뷰 결과 정리 (v2)
> 현재 상태의 가혹한 평가 + 구조적 개선 방향

---

## Part 1: 현재 상태 평가

### 진짜 잘 된 것

1. **Context Contract chain** — reframe → recast → rehearse → refine 사이에 구조화된 데이터가 흘러감. 가정, 리스크, 페르소나가 단계 간 상속됨. 실제 파이프라인 아키텍처.
2. **Build/Decide 분기** — 질문 체계, 가정 차원, 산출물 형태가 컨텍스트에 따라 전부 바뀜. Product spec + scope cuts + implementation prompt는 실제로 써먹을 수 있는 결과물.
3. **Engine-driven backward recommendation** — "전원 거부 → /recast로", "thesis 공격 → /recast로", "문제 존재 의심 → /reframe으로". 잘못된 방향으로 전진하는 걸 실제로 막음.
4. **저널의 실제 출력 품질** — 코드 리뷰 SaaS 예시에서 thesis가 "시간 절약" → "시니어 영향력 확장"으로 전환. 생각이 발전하는 과정이 보임.

### 치명적 결함 5개

#### 1. 결과 피드백 부재 — 가장 큰 구멍

저널은 프로세스를 기록하지만 결과를 기록하지 않음. "SEA 진출" 결정의 DQ 72점이 좋은 결정이었는지 시스템이 영원히 모름.

- DQ 점수와 결과의 상관관계 검증 불가
- adaptive rules가 실제로 개선을 만드는지 확인 불가
- `/patterns`의 "성장"이 진짜 성장인지 프로세스 숙련도 증가인지 구분 불가

**테스트 없는 CI/CD — 빌드 성공만 알고, 실제 작동 여부는 모름.**

#### 2. Decision Theater — 검증을 대체하는 착각

사용자가 `/argus` → 페르소나 비판 → refine → DQ 81점을 받고, "충분히 검증했다"고 느끼지만:
- 실제 고객 인터뷰 0건
- 경쟁사 제품 직접 사용 0회
- 시장 데이터 확인 0건

Readiness meter와 DQ 점수는 인지적 위안. 잘 구조화된 추측에 숫자를 붙인 것.

**위험: 사용자가 실제 검증을 건너뛰는 근거로 사용할 수 있음.**

#### 3. LLM 자기 대화의 구조적 천장

페르소나는 같은 LLM이 역할극을 하는 것. "CodeRabbit+ESLint면 90% 잡힌다"는 Claude가 이미 아는 사실의 재포장.

진짜 stakeholder가 주는 것:
- **비대칭 정보**: 내부 사정, 과거 실패 경험
- **예측 불가능한 연결**: "3년 전에 비슷한 거 해봤는데..."
- **Skin in the game**: 실제 결과에 대한 이해관계

LLM 페르소나는 "그럴듯한 비판"은 만들지만 "예상 못 한 비판"에는 구조적 한계.

**핵심 질문: 잘 만든 단일 프롬프트 대비 4단계 파이프라인의 품질 차이가 유의미한가?**

#### 4. 삼중 편향 파이프라인

1. 사용자가 자기 가정의 확신도를 직접 평가 (Dunning-Kruger)
2. 이 평가를 기반으로 전략 선택 (오염된 입력 → 오염된 출력)
3. LLM이 결과의 품질을 채점 (자기 산출물 자기 채점)

과신하는 사용자 → "확신" 남발 → CONFIRMED 패턴 → 실행 중심 전략 → 검증 스킵 → 나쁜 결정. 시스템이 이걸 감지하려면 외부 신호가 필요한데, 현재 **제로**.

#### 5. Adaptive rules가 대부분의 사용자에게 죽은 코드

- Recurring blind spot: 같은 영역 2회+ 필요
- Strategy repetition: 같은 전략 3회+ 필요
- DQ trend: 3회+ /argus 사용 필요

대부분의 사용자는 1-3번 써보고 판단. **가장 강력한 차별 기능이 발동조차 하지 않음.**

### 부차적 결함 4개

1. **blind spot이 "그럴듯한 관찰" 수준** — "수익화 도구가 아니라 audience-trust가 병목" 같은 건 PM 101. 진짜 불편한 진실이 아님.
2. **Build context가 주말 프로젝트에 과하다** — 10분 분석이 결정을 지연시킴. Analysis paralysis를 치료하겠다고 analysis를 더 시킴.
3. **포맷이 Claude Code 터미널에 종속** — code block + box-drawing이 Slack/Notion에서 깨짐.
4. **DQ 점수의 자기 채점** — 학생이 자기 시험 채점.

---

## Part 2: 근본 문제 진단

모든 결함이 하나로 수렴:

**LLM이 만들고, LLM이 평가하고, 사용자가 자기 보고하는 closed system에서 외부 신호가 없다.**

풀 방향 3가지:
1. **외부 신호를 주입한다** (evidence grounding)
2. **사용자 자신이 모르는 것을 드러낸다** (metacognition)
3. **명시적 피드백 없이 결과를 추론한다** (implicit signals)

---

## Part 3: 개선 설계 — 단계별 배치 (v2)

> v1에서는 개선안을 "유형별"(외부 신호, metacognition 등)로 정리했다.
> v2에서는 **파이프라인 단계별로 재배치**하되 개선안 간의 **데이터 흐름**을 설계.
> 개선안이 독립적으로 존재하면 각각의 가치가 작다. 서로 연결되면 가치가 곱해진다.

### 핵심 설계 원칙

**Crux가 파이프라인 전체를 관통한다.**
가정 중 "이것만 틀리면 전부 무너지는 것" 1개를 /reframe에서 식별. 이후 모든 단계의 초점이 된다: MVT가 crux를 검증하게 하고, 페르소나가 crux를 공격하고, validation checklist가 crux 검증 행동을 제시한다.

**Evidence는 /rehearse가 아니라 /recast에서 수집한다.**
v1에서는 evidence grounding을 /rehearse에 배치했다. 재검토: spec을 설계한 뒤에 evidence를 찾으면, 이미 evidence 없이 만든 spec을 뒤늦게 비판하는 셈이다. Evidence가 spec 설계 전에 들어와야 spec 자체가 현실에 기반한다.

**Anti-theater는 면책 조항이 아니라 행동 목록이다.**
"우리는 이걸 안 했습니다" 대신 "다음에 이걸 하세요" — crux 기반의 구체적 검증 행동을 제시.

**Conviction Arc는 /argus 전용이다.**
개별 스킬에 매번 확신도를 물으면 friction만 늘어남. /argus에서만, 시작과 끝 2번만. 가치는 delta에 있다.

### v1에서 보류로 변경한 것

| 아이디어 | 보류 이유 | 재검토 조건 |
|---|---|---|
| Inverse Persona | 가짜 유사 아이디어 생성 = LLM self-play 반복. Friction vs 가치 불확실 | 사용자 테스트에서 blind spot 품질이 여전히 낮을 때 |
| 정밀 Reference Class (base rate 수치) | WebSearch base rate의 신뢰도 낮음 (블로그 숫자) | 신뢰할 수 있는 데이터 소스가 확보될 때 |
| 실시간 Behavioral Signals | 스킬 아키텍처에서 response time 등 추적 불가 | hooks나 persistent agent 기능이 추가될 때 |
| Conviction Arc (개별 스킬) | 단일 스킬에서 1번만 물어보면 "arc"가 아님. Friction만 증가 | /argus delta가 유의미한 패턴을 보일 때 |

---

### /reframe 개선

#### R1. Absence Analysis — "말하지 않은 것"을 가정 생성에 연결

**위치:** Phase 1 (인터뷰) 후, Phase 2 (가정 생성) **전**

현재: LLM이 4축(가치/실행/사업/역량)에서 가정을 생성 → 사용자 평가
문제: 사용자가 이미 인지한 영역의 가정만 다룸

개선: 인터뷰 직후, 사용자 입력에서 **구조적으로 빠진 영역**을 식별. 빈 영역을 Phase 2 가정 생성의 **강제 입력**으로 연결.

```
  ■ 입력에서 빠진 영역

  · 경쟁 — 누구와 싸우는지 언급 없음
  · 타이밍 — 왜 지금인지 설명 없음

  빈 영역에서 1개 이상의 가정이 자동 생성됩니다.
  의도적으로 생략한 것이 있으면 알려주세요.
  ▸ (또는 Enter → 계속)
```

**핵심:** 독립 섹션이 아니라 가정 생성 엔진의 입력. "경쟁 언급 없음" → 가정: "강한 경쟁자가 없거나, 경쟁이 문제가 아니라고 전제하고 있다." 사용자가 "의도적 생략"이라 답하면 skip.

**체크리스트 (build):** 경쟁, 타이밍, 사용자 근거(직접 경험 여부), 기술 난이도, 수익 모델
**체크리스트 (decide):** 경쟁/대안, 타이밍, 이해관계자, 되돌릴 수 있는지, 실행 주체

#### R2. Crux Identification — 가정 평가 직후

**위치:** Phase 2 가정 평가 완료 직후, Phase 3 (리프레이밍) 전

```
  ■ Crux — 핵심 분기점

  이 가정 중 하나만 틀려도 전부 무너지는 것은?

  · 다른 말로: 이것만 맞으면 나머지가 틀려도
    어떻게든 된다. 이것만 틀리면 나머지가
    맞아도 의미 없다.

  · 번호?  ▸
```

사용자가 crux를 지정하면 Context Contract에 `crux:` 필드로 전파.
이후 파이프라인에서의 역할:
- `/recast`: crux를 검증하는 단계가 spec에 포함되도록 설계
- `/rehearse`: 페르소나가 crux를 최우선 공격 대상으로 삼음
- `/refine`: validation checklist의 1번 항목이 crux 검증

#### R3. Epistemic Status — 카드에 근거 수준 표시

**위치:** /reframe 카드 하단 (readiness bar 근처)

```
  Epistemic  [근거 수준]
  · 경험적 근거 있음: 1/4 가정
  · LLM 추론: 3/4 ���정
  · 외부 검증: 0건
```

2줄. "이 분석이 얼마나 실제 데이터에 기반하는가"를 즉시 파악 가능. Evidence grounding (Phase 3) 구현 후 "외부 검증" 카운트가 올라감.

#### R4. MVT 제안 — Crux 기반, 1회

**위치:** /reframe 카드 출력 후, "다음?" 메뉴 전

```
  ⏸ Crux 검증 제안

  당신의 crux: "[가정 텍스트]"
  가장 싼 검증 방법:
  · [구체적 행동 — 30분 이내]
  · [구체적 행동 — 30분 이내]

  다음?  1 → /recast  v → 검증 후 재개  3 → 저장
```

**v1과의 차이:** "매 단계마다" → "1회, crux에 집중". 매번 묻는 건 무시됨. Crux의 성격에 따라 검증 방법이 달라짐:
- 문제 존재 의심 → "타겟 유저 1명에게 DM"
- 경쟁 우위 의심 → "경쟁사 제품 15분 사용"
- 지불 의향 의심 → "가격 반응 확인"

사용자가 `v` 선택 → 검증 결과 입력 → /recast context에 주입. `1` 선택 → skip.

---

### /recast 개선

#### C1. Evidence Gathering — Spec 설계 전에 현실 주입

**위치:** Context extraction 후, Step 1 (Governing idea / Product thesis) 전
**v1과의 차이:** 원래 /rehearse에 배치했으나 /recast로 이동. Evidence 없이 spec을 만들면 commitment bias가 생김.

```
[자동 — 사용자 개입 없음]

WebSearch 실행:
  - "[경쟁사명] review" / "[경쟁사명] user complaints"
  - "[도메인] failed startup" / "[유사 서비스] shutdown"
  - "[도메인] market size" (build context)

수집된 evidence를 Reflection block에 포함:

  💭 Evidence:
  ▸ CodeRabbit: custom rules 출시 (2026-01), GitHub 15K stars
  ▸ Reviewable.io: 2023 서비스 종료 — GitHub native review에 밀림
  ▸ DevTool trial→paid 평균 전환율: 2-5%

  이 데이터를 반영하여 spec을 설계합니다.
```

Evidence는 Contract의 `evidence:` 필드에 기록 → /rehearse로 전파.

#### C2. Outcome Hook 설정 — 성공 지표에 체크 날짜 부여

**위치:** 성공 지표 정의 시점

/recast에서 성공 지표를 정의할 때, 저널에 체크 날짜를 함께 기록:

```
journal entry에 추가:
- Outcome check: "[성공 지표 텍스트]"
- Check after: [2주 후 날짜]
- Topic: "[주제]"
```

이 데이터는 모든 스킬의 "Before starting"에서 체크됨 (→ Cross-cutting 참조).

---

### /rehearse 개선

#### H1. Evidence-grounded personas — 사실 기반 비판

**위치:** 페르소나 리뷰 생성 시

/recast의 Contract에서 `evidence:` 필드를 상속. 추가로 failure case 검색:

```
[자동]
WebSearch 추가: "why [similar product] failed", "[domain] post-mortem"

페르소나 context에 주입:
  수진: "Reviewable.io가 2023년에 같은 포지션으로 망했다.
   GitHub이 native review를 개선할 때마다 존재 이유가 줄었다.
   네 서비스가 이 운명을 피하려면 뭘 다르게 해야 하나?"
```

**v1과의 차이:** evidence를 /rehearse에서 처음 수집하는 게 아니라 /recast에서 수집한 것을 상속 + failure case만 추가 검색. 중복 방지.

#### H2. Crux 집중 공격 — Contract에서 crux를 받아서 최우선 공격

**위치:** 페르소나 리뷰의 구조

/reframe Contract의 `crux:` 필드를 읽고, **모든 페르소나의 첫 번째 공격 대상을 crux로 강제:**

```
  수진의 리뷰:
  [crux 공격] "팀 컨벤션 학습이 패턴 매칭과 다른 점을
  증명할 수 있나? — 이게 네 전체 thesis의 분기점이야."

  [그 외 리스크] ...
```

현재: 페르소나가 자유롭게 공격 대상 선택 → crux를 빗나갈 수 있음.
개선: crux가 보장된 공격 대상. 나머지는 자유.

---

### /refine + /argus 마무리

#### F1. Validation Checklist — "다음?" 대신 행동 목록

**위치:** /refine 최종 카드, /argus 최종 deliverable
**v1과의 차이:** "이 분석에서 하지 않은 것" 면책 조항 → crux 기반 행동 목록. 면책은 cookie consent처럼 무시됨.

```
  ■ 다음 행동 (Argus 밖에서)

  1. ★ [crux 가정] 검증
     → [구체적 행동]: [30분 내 가능한 것]
  2. □ [uncovered assumption] 확인
     → [구체적 행동]
  3. □ 경쟁사 [이름] 직접 사용 (15분)

  완료 표시는 다음 실행 시 물어봅니다.
```

Crux 기반이라 모든 사용자에게 다른 체크리스트. Passive outcome hook과 연결.

#### F2. Conviction Delta — /argus 전용

**위치:** /argus Stage 1 시작 시 + Stage 5 종료 시

```
Stage 1 시작:
  "이 결정/아이디어에 대한 확신? (1-10)" → 기록

Stage 5 종료 (DQ 카드 후):
  "지금은? (1-10)" → 기록

  Conviction: 8 → 5 (delta -3)
```

- delta 0 또는 상승: "파이프라인이 기존 생각을 확인만 했을 수 있습니다" (경고)
- delta -2 이상 하락, 미회복: "재고할 근거가 충분합니다"
- 하락 후 회복: "stress test를 거쳐 강화된 확신입니다" (건강함)

저널에 `conviction_delta: -3` 기록 → `/patterns`에서 장기 추적.
개별 스킬에서는 묻지 않음.

#### F3. Epistemic Status — 최종 누적

**위치:** /argus Stage 5 deliverables, /refine 최종 카드

```
  Epistemic Status (전체 파이프라인):
  · 사실 기반 가정: 1/4
  · 외부 evidence: [N]건
  · 실제 검증: 0건 (MVT 미실행 / 또는 "1건: [내용]")
  · LLM 추론 비율: ~70%
```

/reframe의 R3과 연결되지만 여기서는 **전체 파이프라인 누적**. Evidence grounding 구현 전에는 "외부 evidence: 0건"이 정직하게 표시.

---

### Cross-cutting: Passive Outcome Trigger

**위치:** 모든 스킬의 "Before starting" adaptive rules에 추가

```
### Adaptive rule: Outcome check

저널에서 `Outcome check:` 필드가 있고,
`Check after:` 날짜가 오늘 이전인 항목이 있으면:

  💭 [N]일 전 "[주제]":
     목표: "[성공 지표]"
     어떻게 됐나요?
       1 · 달성  2 · 진행 중  3 · 포기  4 · skip

답변을 저널에 기록:
  - Outcome: [달성/진행 중/포기/skip]
  - (달성/포기 시) 어떤 가정이 맞았고 틀렸나? [1줄 기록]

skip 시 다음 실행에서 1번만 더 물어보고, 이후 묻지 않음.
```

별도 `/outcome` 스킬이 아니라 기존 흐름에 자연스럽게 끼워넣음. skip 2회 시 영구 skip.

**데이터 활용:** outcome이 쌓이면 `/patterns`에서:
- "확신 가정의 적중률: N%" (calibration)
- "자주 틀리는 가정 유형: [영역]" (validated blind spots)
- "DQ N점 이상 결정의 성공률: N%" (score 유효성 검증)

---

### 데이터 흐름 요약

```
/reframe
  ├─ R1. Absence Analysis → 가정 생성 입력
  ├─ R2. Crux → Contract.crux (전 단계 전파)
  ├─ R3. Epistemic Status (단계별)
  └─ R4. MVT 제안 (crux 기반, 1회)
       │
       ↓ Contract: crux, assumptions, evidence_basis

/recast
  ├─ C1. Evidence Gathering (WebSearch) → Contract.evidence
  ├─ C2. Outcome Hook → journal.outcome_check
  └─ spec 설계에 evidence 반영
       │
       ↓ Contract: evidence, crux (상속), spec, personas

/rehearse
  ├─ H1. Evidence-grounded personas (evidence 상속 + failure case 추가)
  └─ H2. Crux 집중 공격 (crux 상속)
       │
       ↓ Contract: risks, critiques, crux_attack_result

/refine + /argus
  ├─ F1. Validation Checklist (crux 기반 행동 목록)
  ├─ F2. Conviction Delta (/argus만)
  └─ F3. Epistemic Status (누적)

Cross-cutting:
  └─ Passive Outcome Trigger (모든 스킬 Before starting)
      → /patterns의 calibration 데이터
```

---

## Part 4: 실행 계획

### Phase 1 — SKILL.md만 수정 (코드 0줄, 즉시)

| # | 개선 | 대상 스킬 | 변경 내용 |
|---|---|---|---|
| R1 | Absence Analysis | /reframe | Phase 1→2 사이에 빈 영역 식별 + 가정 생성 연결 |
| R2 | Crux Identification | /reframe | Phase 2 후 crux 질문 + Contract에 `crux:` 필드 |
| R3 | Epistemic Status (단계) | /reframe | 카드에 근거 수준 2줄 추가 |
| H2 | Crux 집중 공격 | /rehearse | Contract에서 crux 읽고 최우선 공격 지시 |
| F1 | Validation Checklist | /refine, /argus | "다음?" 대신 crux 기반 행동 목록 |
| F3 | Epistemic Status (누적) | /argus | 최종 deliverable에 전체 epistemic 표시 |

**이 6개가 서로 연결됨:**
R1(빈 영역) → R2(crux 선택의 재료) → H2(crux 공격) → F1(crux 검증 행동) + R3/F3(정직성)

### Phase 2 — 구조 변경

| # | 개선 | 대상 | 필요한 것 |
|---|---|---|---|
| R4 | MVT 제안 | /reframe | crux 성격별 검증 방법 매핑 |
| F2 | Conviction Delta | /argus | 시작/끝 기록 + 저널 포맷 변경 |
| C2 | Outcome Hook | /recast + 전체 | 저널에 outcome_check 필드 + Before starting rule |

### Phase 3 — 도구 추가 (WebSearch)

| # | 개선 | 대상 | 필요한 것 |
|---|---|---|---|
| C1 | Evidence Gathering | /recast | allowed-tools에 WebSearch 추가 + gathering 로직 |
| H1 | Evidence-grounded personas | /rehearse | evidence 상속 + failure case 추가 검색 |

### Phase 간 의존성

```
Phase 1은 독립적 — 즉시 실행 가능
Phase 2의 R4는 Phase 1의 R2(crux)에 의존
Phase 2의 C2는 Phase 1과 독립
Phase 3의 H1은 Phase 3의 C1(evidence)에 의존
Phase 3은 Phase 1/2와 독립 — 병렬 가능
```

---

## Part 5: 핵심 판단

### 한 문장 요약

> "혼자 일하는 사람에게 '똑똑한 동료 한 명이 30분 같이 생각해주는 것'의 80%를 제공한다. 나머지 20%는 진짜 동료만 채울 수 있다. 개선안의 목표는 이 80%를 95%로 올리는 것이 아니라, 80%의 한계를 정직하게 인정하면서 사용자가 나머지 20%를 직접 채우도록 유도하는 것이다."

### 개선 후 달라지는 것

| | 현재 | Phase 1 후 | Phase 3 후 |
|---|---|---|---|
| 가정 발견 | LLM이 생성 | LLM 생성 + 부재 영역 자동 추가 | 좌동 |
| 가정 평가 | 사용자 자기 보고 | 자기 보고 + crux 강제 선택 | 자기 보고 + evidence 제시 |
| 페르소나 비판 | LLM 상상 기반 | crux 집중 공격 | 실제 데이터 + 실패 사례 기반 |
| 최종 산출물 | DQ 점수 + readiness bar | + epistemic status + validation checklist | + evidence 출처 표기 |
| 피드백 루프 | 없음 | outcome hook (passive) | outcome → calibration → patterns |
| 시스템 정직성 | 없음 (자기 채점) | epistemic status 명시 | evidence 비율 정량화 |

### 해자가 될 수 있는 것

1. **Crux 관통 설계** — 단일 핵심 가정이 파이프라인 전체의 초점이 되는 구조. 프롬프트 복사만으로는 이 데이터 흐름을 복제하기 어려움.
2. **Evidence grounding** — 실시간 데이터 주입. 프롬프트만으로 복제 불가.
3. **Outcome-linked calibration** — 시간이 지날수록 강해지는 유일한 장벽. "당신의 확신 가정 적중률: 62%"는 사용 이력 없이는 불가능.
4. **Epistemic honesty** — "이 분석의 70%는 LLM 추론입니다"라고 선언하는 도구는 시장에 없음.
5. **Metacognitive tools** — 사용자의 사고 자체를 분석 대상으로 만듦 (absence analysis, conviction delta, crux 선택).

### 해자가 되기 어려운 것

- 4R 파이프라인 구조 — 프롬프트만으로 복제 가능
- 페르소나 역할극 — 아무 LLM이나 할 수 있음
- DQ 점수 — self-assessed metric (epistemic status로 보완하되, 근본 한계 존재)
- 저널 포맷 — 텍스트 파일, 복제 비용 제로

### 열린 질문

1. **Evidence 품질 편차**: WebSearch 결과가 항상 유용하지는 않음. 저품질 evidence가 오히려 해가 될 수 있다. → 품질 필터 기준은?
2. **Crux를 사용자가 못 고를 때**: "다 중요해요"라고 하면? → 시스템이 자동 선택 (importance H + certainty L인 것) + 이유 제시? 사용자에게 override 허용?
3. **Passive outcome의 skip 비율이 높을 때**: 데이터가 안 쌓이면 calibration 불가. → skip 외에 더 자연스러운 수집 방법은? (예: "같은 주제로 /reframe 재실행" 자체를 negative outcome으로 추론?)
4. **Conviction delta가 항상 0일 때**: 형식적 답변이면 의미 없음. → conviction 대신 다른 metacognitive 신호? (예: "이 분석에서 가장 놀라웠던 것은?"처럼 open-ended?)
5. **Absence Analysis의 false positive**: 언급하지 않은 게 항상 "전제"는 아님. 단순히 관련 없거나 알면서 생략한 것일 수 있음. → 과도한 지적은 오히려 friction. 빈 영역 중 "이 결정에 실제로 영향을 줄 가능성이 높은 것"만 표시하는 필터 필요?
