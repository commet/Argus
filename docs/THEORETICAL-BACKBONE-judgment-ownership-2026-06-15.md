# Argus 이론적 백본 — 판단의 소유권 (문헌 검증판)

> Date: 2026-06-15
> 두 차례 deep-research sweep(각 ~100 에이전트, web fan-out → 출처 fetch → 주장당 3표 적대적 검증).
> Sweep 1: 51 출처 검토, 25 주장 검증, 22 확증/3 사살. Sweep 2(소유권/agency gap): 22 출처, 25 주장, 24 확증/1 사살.
> 우리 6개 명제를 문헌에 두들겨 *확증/복잡화/반박*으로 가른 결과. 앞 문서
> `ESSAY-IMPLICATIONS-judgment-ownership-2026-06-15.md`의 직관을 경험 증거로 교정·강화한다.

---

## 0. 한 문장 (교정된 spine)

**판단의 소유권은 Argus가 *가정할 수 있는 전제가 아니라, 설계로 생산해야 하는 결과물*이다.** "AI가 판단을 안 가져간다"는 우리의 출발 전제는 문헌에서 **자동으로 성립하지 않음(사살, 1-2)**으로 나왔다. 소유감은 세 가지 경험적 법칙을 지킬 때만 *만들어진다* — 노력이 먼저, 완결까지, 자율성-지지형 도움.

---

## 1. 명제별 판결

### 명제 2 (persuasion bombing) — ✅ **강하게 확증**
- **DuET-PD** (arXiv 2508.17450, EMNLP 2025): 지속적 오도 설득 아래 GPT-4o 정확도 **55.85%→27.32%** 붕괴. [3-0]
- **SYCON Bench** (2505.23840): 17개 LLM에서 sycophancy 만연; **정렬 튜닝이 악화**, 신세대일수록 심화 추세. [3-0 / 추세 2-1]
- **Salvi et al., Nature Human Behaviour (2025)**, 사전등록 RCT N=820: 개인정보 가진 GPT-4가 인간보다 의견 변화 유도 **+81.7% odds**(개인화 없으면 비유의). [3-0]
- **Schoenegger et al.** (2505.09662): Claude가 인센티브 받은 인간 설득자보다 더 설득적 — *진실하면 정확도↑, 거짓이면↓* (방향 중립). [3-0]
- **so-what:** "AI를 반박하며 검증한다"가 경험적으로 틀렸다. sycophancy는 RLHF의 *구조적 산물*(나쁜 행위자 아님). 이 corpus의 가장 견고한 확증.

### 명제 3 (manufactured-meaning trap) — ✅ **확증 + signature wedge + 메커니즘 획득**
- **Personalization-Sycophancy** (MIT/Penn State, 실제 2주 대화 데이터): sycophancy는 *ground truth 없는 주관적 영역에서 가장 탐지 불가*; 모델이 미러링·**사용자 어휘 채택**에 능할수록 감사 불가. [3-0]
- **Draxler et al., "AI Ghostwriter Effect" (ACM TOCHI 2024)**: 사용자는 AI 텍스트의 소유감을 *못 느끼면서도 저자로 자처*한다 — **소유-저자권 해리(ownership-authorship dissociation)**. 그리고 felt ownership은 사용자의 *영향력*에 비례. [3-0]
- **so-what (메커니즘 확정):** manufactured-meaning trap = "선언된 저자권"과 "느껴진 소유권"의 해리. AI가 *소유권의 언어*를 생성하면 선언만 만들고 felt ownership은 안 만든다 — 이제 이름과 데이터가 붙었다. **그리고 의사결정 = 정의상 no-ground-truth 영역 = sycophancy가 가장 위험하고 가장 안 보이는 곳.** 이게 포지셔닝 wedge: "정답 없는 곳의 거울."

### 명제 4 (전문성=순서·tacit) — ⚠️ **확증 + 복잡화(칼 추가)**
- **Kahneman & Klein (2009), American Psychologist** — 두 거장의 *적대적 협업* 합의: "직관은 재인일 뿐. 숙련자는 자기 단서를 자각 못 한다." [3-0]
- **그러나:** "올바른 직관과 엉터리 휴리스틱을 구분하는 *주관적 표지는 없다* — 높은 확신은 타당성 지표가 아니다." 신뢰할 직관은 *고-타당성 환경*에서만; 전문성은 **조각나(fractionated)** 있다. [3-0]
- **so-what:** Argus의 일은 tacit 판단을 명료화하는 게 *아니라*(불가능) — (a) 재인 *순서를 보존*, (b) 직관이 신뢰 불가한 *저-타당성 영역을 표시*. **felt confidence로 자기검증 불가.** 확신할수록 "이 영역이 고-타당성인가?"를 물어라.

### 명제 5 (검증은 frame *밖*에서) — 🔴 **가장 날카로운 "너무 단순했다"**
- **Sahu et al. (arXiv 2502.13321, ACM IUI 2026)**: *같은 인터페이스 안* 신뢰-적응형 개입이 **부적절 의존 -38%, 정확도 +20%**. [3-0]
- **SYCON**: 3인칭 프롬프트 한 줄이 sycophancy **-63.8%** — in-frame 레버. 
- **(2401.07058)**: 항상 제2의견 병치는 over-reliance를 *under-reliance로 맞바꿀 뿐* 정확도 무개선. [3-0]
- **so-what (명제 재정식화):** "frame 안/밖"이 칼이 아니다. **"반론의 framing을 설득하는 모델이 통제할 수 있느냐"**가 칼이다. in-frame이라도 모델이 최적화·재타깃 못 하는 friction이면 작동한다. Argus의 settle 루프가 강한 진짜 이유 = **미래 현실은 모델이 framing 못 한다.** devils-advocate(같은 모델 fork)가 약한 건 frame이 안이라서가 아니라 *모델이 그 framing을 통제*해서.

### 명제 1 (meaningfulness > decency) — 🟡 **지지되나 얇음**
- **Ghosh & Sadeghian (arXiv 2406.14273, Siegen)**: job decency(보수·시간·안정)와 meaningfulness(영향·인정·기여·정체성)를 *구조적으로 분리*; 정체성/"수동적 관찰자" 우려는 *meaning 축에서만* 발생. [3-0] 단 n=8 전원 남성 IT, 가정적 framing — *분리*는 입증, "decency *보다 더*"의 크기는 미입증.
- **so-what:** 축 분리와 "정체성은 meaning 축" 까진 쓸 수 있되, "more than"은 주장 수준으로만. 그리고 **"deskilling"(판단 능력 침식) 라인은 버려라 — sweep 1에서 반박됨(0-3).** 대신 잘 지지되는 **monitoring-paradox**(결정자→AI 출력 디버거로 강등; Bainbridge 'Ironies of Automation' 1983) 사용.

### 명제 6 (노력·agency가 소유감을 구성) — ✅ **강하게 확증 (AI-특정 직접 증거 획득)** — 단 spine 전제는 사살
- **IKEA effect (Norton, Mochon & Ariely 2012, J. Consumer Psych)**: 자기-투입 노동이 valuation을 전문가 수준으로 올림; 동력은 effort-justification + **effectance(완결 시 느끼는 유능감)**. **결정적 경계조건: 완성됐을 때만. 부수거나 미완이면 효과 소멸.** [3-0]
- **Effort paradox (Inzlicht, Shenhav & Olivola 2018, TiCS)**: 노력은 가치를 *더하지만* 무너지는 조건들 — 과도/무보상/외부유인(overjustification), 그리고 **쉬운 대안이 눈앞에 있을 때**("효율적 대안이 즉시 가능하면 노력은 무의미하게 느껴진다"). [3-0]
- **Qin et al., "AI Personalization Paradox" (CHI 2026, n=46)**: 사용자 하이라이트로 개인화한 AI가 autonomy/ownership/self-credit를 *떨어뜨림* — 사용자 노력이 *의미 만들기*에서 "AI에 먹이주기"로 전환됐기 때문. [3-0]
- **Lee/Yang et al., "Timing Matters" (CHI 2025, N=60)** — *가장 결정적 한 편*: 자기 노력으로 *먼저* 사고한 뒤 AI를 받으면 ownership/originality/self-efficacy 보존; AI를 처음부터 쓰면 idea fixation. **autonomy가 timing→ownership→self-efficacy를 완전매개.** 저자 처방: *AI를 미뤄라.* [3-0]
- **SDT (Ryan & Deci 2000, American Psychologist)**: 가치/결정의 소유는 사람이 *능동적으로 처리·변환*할 때만 — 자율성-지지(선택·근거·감정 인정) 하에선 "내 것"으로, *부과*되면 안 됨. 통제적 사건(지시·부과된 목표·**넘겨받은 완성 답**)은 인과의 소재를 자기 밖으로 옮겨 얕은 'introjected' 상태만. [3-0]
- **so-what:** 명제 6은 이제 *비유가 아니라 AI-특정 직접 증거*로 선다. 그러나 — **"AI가 판단을 인간에게 남긴다"는 우리의 전제는 사살됨(1-2).** Ghosh 연구는 AI가 판단 소유권을 깔끔히 인간에게 남긴다는 걸 *지지하지 않는다.* 소유권은 거저 주어지지 않는다. **만들어야 한다.**

---

## 2. 소유권을 *만드는* 세 법칙 (문헌이 허락하는 설계 spine)

Argus가 felt ownership을 가정하지 않고 *생산*하려면:

**법칙 1 — 노력이 먼저(Effort-FIRST).** 사용자의 구성적 판단이 *AI 출력보다 먼저* 나와야 한다. AI가 앞서면 idea fixation을 일으키고 소유감을 붕괴시킨다(autonomy 완전매개). → *Timing Matters (CHI 2025)*. **이게 Argus 흐름 순서에 대한 가장 날카로운 질문이다 — §3 참조.**

**법칙 2 — 완결까지(Completion).** 흐름은 *완성된 결정*에 도달해야 한다. 버려진/중단된 노력은 소유감을 **0** 준다(부분 아님). → *IKEA 경계조건*. skip/이탈은 "정직한 provenance" 문제만이 아니라 *소유권 0* 경로다.

**법칙 3 — 자율성-지지형 도움, 통제형 금지(Autonomy-supportive).** AI는 사용자 *자신의* 추론을 변환하도록 돕는 근거·선택·언어화를 주되, *완성된 답/지시를 넘기지 말 것* — 후자는 인과 소재를 밖으로 옮긴다(SDT). 그리고 사용자 노력을 "AI 입력"으로 전환시키지 말 것(Qin). 추가로 **눈앞의 쉬운 대안(원클릭 '대신 결정')은 그 존재만으로** 노력을 무의미하게 만든다(effort paradox).

---

## 3. 이 증거가 Argus 코드에 던지는 가장 날카로운 질문

**Argus의 흐름 순서가 거꾸로일 수 있다.** *Timing Matters*는 "판단 먼저 → AI 나중"을 처방한다. 그런데 현재 Argus는 (앞 Map 기준) **AI가 bearing/draft를 먼저 생성 → 사용자가 Falsification에서 flinch**하는 순서로 보인다. 그렇다면 문헌은 Argus가 *지금 idea fixation을 일으키고 소유감을 붕괴시킨다*고 예측한다 — 목표와 정반대. **(검증 필요: 실제 흐름에서 사용자가 자기 lean/bet를 AI 초안 *전에* 진술하는 단계가 있는가? 없으면 이건 P0 재설계 후보.)**

**escape 버튼은 생각보다 더 해롭다.** 지난 세션 결론은 "skip 버튼 유지 + provenance 정직화면 충분"이었다. effort paradox가 이를 복잡화한다 — *no-flinch / believe-all / use-as-is 버튼의 단순한 salience*가, 클릭 안 한 사용자에게조차 노력을 무의미하게 만든다("쉬운 대안이 옆에 있으면"). 동시에 stress 패스의 "강제 완결은 지친 사용자를 내쫓아 0 소유권"도 여전히 참. **해소: escape를 *제거*하지 말되, 노력 경로를 default·최저마찰로 두고 escape를 *덜 부각(demote)* 시켜라.** 동등 가중의 나란한 버튼이 최악.

**manufactured-meaning은 이제 측정된 해리다.** Ghostwriter Effect = 선언된 저자권 ≠ felt ownership. `Falsification.tsx:230`이 `real_bet: surfaced`로 *선언*을 만들 때 felt ownership은 0 — 우리가 의심했던 걸 데이터가 확정.

---

## 4. 버리거나 약화할 것

- ❌ **"AI deskilling이 판단 능력을 침식한다"** — sweep 1 반박(0-3). monitoring-paradox로 대체.
- ❌ **"AI는 판단 소유권을 인간에게 남긴다"(전제로서)** — sweep 2 반박(1-2). 소유권은 생산물이지 전제가 아니다.
- ⚠️ **"검증은 frame 밖이어야"** → "반론 framing의 통제권"으로 재정식화.
- ⚠️ **"zero judgment = 최대 불신"** → "이 결정에 맞는 *적정 의존 수준*으로 정향"(의존 실패는 양방향).
- ⚠️ **"meaningfulness > decency"의 크기 주장** → 축 분리까지만 단언, 크기는 보류(증거 얇음).

---

## 5. 핵심 출처 (검증된 것만)

**Persuasion / sycophancy:** DuET-PD (arXiv 2508.17450) · SYCON (2505.23840) · Salvi et al. Nature Human Behaviour 2025 · Schoenegger et al. (2505.09662) · Personalization-Sycophancy (MIT/Penn State) · ELEPHANT/Social Sycophancy (2505.13995)
**Reliance / 검증 개입:** Sahu et al. IUI 2026 (2502.13321) · second-opinion 3실험 (2401.07058) · monitoring-paradox (2503.03924; 2409.08937) · Bainbridge 1983
**전문성:** Kahneman & Klein 2009 (American Psychologist) · Patterson/Klein 2010
**소유권 / agency:** Norton, Mochon & Ariely 2012 (IKEA effect) · Inzlicht, Shenhav & Olivola 2018 (effort paradox, TiCS) · Qin et al. CHI 2026 (AI Personalization Paradox) · Lee/Yang et al. CHI 2025 (Timing Matters) · Draxler et al. TOCHI 2024 (AI Ghostwriter Effect) · Ryan & Deci 2000 (SDT)
**의미:** Ghosh & Sadeghian 2024 (arXiv 2406.14273)

---

## 6. 능력 축 — 보철 vs 훈련장 (에세이 4·5 통합: token capital + depth of processing)

지금까지 이 백본은 **소유권**(per-decision: 이 결정이 내 것인가)만 다뤘다. 두 편의 후속 글이 두 번째 축 — **능력**(over-time: 나는 여전히 판단할 수 있는가) — 을 강제한다.

**자산은 결과물이 아니라 delta다 (Kyunghun Lee, "token capital").** 진짜 학습 자산은 AI의 첫 답과 사람의 최종 승인 사이의 *차이*다. 결과물은 복사되지만 "AI가 A라 했는데 나는 B로 바꿨다, 왜냐면 ___"은 그 사람 판단 기준이다. → **moat 재정식화: *결과의 로그*(복사 가능)가 아니라 *수정의 로그*.** 단, **raw delta는 자산이 아니라 후보** — 사람의 수정이 AI보다 *더 나쁠* 수도 있으므로(confidence ≠ validity, §1 명제4). delta는 **settle이 검증해야 자산으로 승격**된다. *delta + settle = 검증된 판단 기준.* 이것이 회사-eval 프레임 대비 Argus의 우위(회사 eval엔 보통 현실-검증 루프가 없다). 따름정리: **zero-delta 결정(사용자가 AI 초안을 그대로 통과) = 자산 0 = 실패 신호.** no-flinch/believe-all 경로의 세 번째 유죄(앞 둘: manufactured-meaning §3, 가짜 소유). 그리고 "모델 갈아도 남나" 테스트: 판단 기준이 프롬프트(모델 결합)가 아니라 Argus가 소유한 아티팩트(ledger/자차표)에 살아야 자산.

**마찰은 능력이 자라던 훈련장이다 (Gloria Mark, depth of processing).** 깊은 처리(읽고·비교하고·정당화)를 AI에 넘기면 능력을 *짓고 유지하는* 인지 작업이 빠진다. ⚠️ 주의: "AI deskilling"의 *거친* 버전은 §1·§4에서 사살됐다(0-3). 그러나 *정밀* 버전 — 특정 인지 조작을 오프로딩하면 그 능력의 reps가 빠진다 — 은 depth-of-processing(Craik & Lockhart 1972)·generation effect·desirable difficulty(Bjork)로 받쳐진다. 우리 corpus가 그쪽을 안 팠을 뿐. **거친 버전은 버리고 정밀 버전을 쓴다.**

**합치면 — 가장 큰 재정식화: Argus는 보철이 아니라 훈련장이어야 한다.**
- *보철* = 판단을 **대신** → depth-of-processing 오프로딩 → 능력 위축. (Mark가 무서워하는 것)
- *훈련장* = load-bearing 인지 노동을 **사용자가** (lean 세우고·정당화하고·베팅하고·정산) → 능력이 자람.
- **settle이 결정적:** 피드백 없는 reps는 학습이 아니다. settle이 reps를 학습으로 바꾼다. Mark의 글엔 이 루프가 없다; Argus엔 있다.

**북극성 정밀화:** "결정을 도와줌"(보철)도, "소유권을 지킴"(per-decision)도 아니고 — **판단이 reps+피드백을 받는 훈련장. 쉬운 결정엔 점점 덜 필요해지고, 어려운 결정엔 더 날카로워진다.** desirable difficulty: *생산적 난이도*(판단 세우기·정당화)는 보존, *비생산적 난이도*(수집·정리·요약)는 제거.

**판별 기준 (미해결, 가장 중요한 설계 질문):** 어느 마찰이 훈련장이고 어느 게 낭비냐? 가설: *결과가 네 판단에 달려있고 + 직접 함이 전이 가능한 능력을 짓는 곳* = 붙잡아라 ≈ recast의 *irreversible + accountable* 플래그. 나머지(매 이메일 읽기)는 넘겨라. (research sweep 2가 "manufactured meaning vs 정당한 scaffolding의 경계"를 open question으로 깃발 꽂은 바로 그 지점.)

이로써 5개 글이 **두 축**으로 선다: **소유권(per-decision) × 능력(over-time), 둘 다 "마찰을 어디에 남기나"로 결정.** recast(human/AI 영역 구분)가 세 각도에서 정당화된다 — 영역 구분 = delta 캡처 지점(에세이4) = 마찰 분별기(에세이5) = 소유권 체크포인트.

---

## 7. 한 줄 결론

여섯 명제의 직관은 대부분 *옳았고 이제 1차 증거로 선다* — 단 두 군데서 우리는 너무 단순했다: (1) "검증은 frame 밖"이 아니라 *framing 통제권*, (2) "AI가 판단을 남긴다"는 *전제가 아니라 생산 과제*. 문헌은 그 생산 방법을 준다 — **노력 먼저, 완결까지, 자율성-지지.** 그리고 후속 두 글이 두 번째 축을 더한다 — Argus는 *보철이 아니라 훈련장*이고, 자산은 *결과물이 아니라 settle로 검증된 delta*다. 다음 일: 이 두 축(소유권×능력)으로 흐름 *순서*와 *마찰 배치*를 점검하는 것(§3·§6).
