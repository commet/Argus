# 엔진 스트레스 테스트 라운드 2 — 계획 + 엔진 v2 스펙

> Date: 2026-06-16
> 입력: `STRESS-round1-findings-2026-06-16.md`(엔진 v1을 24 케이스에 부딪힌 결과 — broke 30 / strained 58 / worked 8; **frame-check 0/24, provenance 0/24**), `MECHANISM-frame-and-fork-2026-06-16.md`(v1 스펙).
> 한 줄: **라운드 1이 찾은 6개 클러스터를 패치하고, 라운드 1의 진짜 발견(규칙들이 서로 잠근다)에 답하는 precedence 층을 더해 v2를 만들고, 새 25케이스로 v2가 0을 벗어나는지 측정한다.**

---

## 1. 라운드 1이 무엇을 결론지었나 (라운드 2의 출발점)

- 엔진이 "제일 먼저·제일 중요"라 선언한 두 단계(**frame-check, provenance**)가 **0/24**로 한 번도 깨끗하게 작동 안 함. 결함이 우연 버그가 아니라 척추의 시그니처 무브(단일 가정 surface)에서 직접 나옴.
- 6개 실패 클러스터: **C1** provenance가 융합 문장 못 쪼갬(9건, 최악) · **C2** branch-test가 user 프레임/고도 상속(8건) · **C3** convergence 과수렴/날조(7건) · **C4** frame-check가 본질·정체성 가치를 물류로 강등(4건) · **C5** frame-check 앞에 step-0 게이트 부재(4건) · **C6** Problem-1 라우팅 2-bin뿐(4~5건).
- **가장 무거운 발견:** 패치 6개를 더해도 끝이 아니다 — 규칙들이 *서로 충돌*한다. (convergence "곁가지 버려" ↔ provenance-C "중심 프레임 꺼내"; anti-dead-end "닫아라" ↔ zero-judgment "대신 결정 마라"). → **precedence(우선순위/중재) 층이 필요. 이건 패치가 아니라 아키텍처 변경.**
- 열린 질문(라운드 2~4가 답해야 함): frame/provenance 0/24는 (a) **패치 가능**인가, (b) **척추에 금**(단일 가정 surface 패러다임이 messy 결정엔 너무 brittle)인가? **생각으로 못 가른다. 패치 적용 후 0을 벗어나면 (a), 여전히 깨지면 (b).**

---

## 2. 엔진 v2 — 작동 스펙 (시뮬레이터가 문자 그대로 돌릴 버전)

v1의 4단계(frame-check → provenance → fork → convergence)는 유지하되, **앞에 step-0 게이트**를 두고, **각 단계에 라운드 1 패치**를 박고, **전체를 가로지르는 precedence 층**을 추가한다.

### Step-0 게이트 (신규 — C5의 승격) — "*무엇을* 판단할지엔 max generation, *판단할지 말지*엔 zero judgment"

엔진 본체를 돌리기 *전에* 날것의 입력을 세 축으로 분류하고 라우팅한다.

1. **STAKES / 가역성.** 사소·가역·저비용이면 → 의례 생략, 1줄 직답. (우산 결정에 3-bucket 의례 금지.)
2. **요청 유형 (REQUEST-TYPE).** (a) 항법을 구하는 *열린 결정* / (b) *이미 내린* 결정의 validation / (c) vent·정서 처리 / (d) 정보 요청. **(a)만 전체 엔진을 받는다.** (b)는 닫힘을 존중 — 재개방 금지, falsifiable 체크 *하나*만 제안. (c)는 분기 금지 — 들어주고, 원하면 결정으로 초대. (d)는 그냥 답.
3. **저항 / 준비도 (RESISTANCE).** 장기 미결 + 새 정보 없음 + 반복 회피면 → 병목은 분석이 아니다. 포크를 더 generate하면 *회피를 무장*시킨다(라운드 1: "유능함이 무기가 된다"). → 저항/회피 *자체*를 surface, 분기 보류.

> Step-0가 라운드 1의 두 번째 충돌(anti-dead-end ↔ zero-judgment)을 *상류에서* 해소한다 — "닫아라"는 오직 요청유형 (a)에만 적용된다. vent·validation·pure-preference는 닫힘 강제 경로에서 빠진다.

### Phase 1 — 틀 점검 (frame-check) + C4 패치

- v1대로: 수준(무엇을 결정하는지) + 제일 큰 AI-supplied 전제 + 잠정 답을 한 덩어리로 되비춤.
- **C4 — intrinsic-vs-instrumental 게이트.** 본질 가치(곁에 있고 싶다, 이 일이 곧 나다)를 가진 X는 **기능적 reframe을 primary로 금지**. literal want를 *그대로* 1차 프레임으로 들고, 물류는 그 *아래* 종속. ("곁에 있고 싶다"를 "케어를 어떻게 보장하나"로 강등 = 비가역성의 근거를 지움 = 금지.)
- **정체성-구성 변수 규칙:** 변수가 사용자의 정체성을 구성하면(예: "나는 hack이 된다") → **"don't check the self, condition on it."** 그 정체성을 challengeable 가정으로 retag하지 말고, *주어진 제약*으로 받아 그 위에서 분기.

### Phase 2 — provenance + C1 패치 (라운드 1 최악 클러스터)

- v1의 3버킷을 **내용(진술) 단위**로 재정의(*화자* 단위 아님): 한 문장이 누구 입에서 나왔든, 그 *내용*을 분해해 버킷팅.
- **connective-word pre-pass.** "그래서 / because / 그러니까 / 결국 / ~라서" 같은 인과·추론 접속을 먼저 스캔. 그 절은 *관찰*이 아니라 *인과 귀속/예측*이다.
- **4버킷:**
  - **A. 사용자 사실** (관찰·행동·상태: "나 지쳤어", "고객 셋이 *요청* 메일 보냄") → 믿는다, 재심 X.
  - **B. AI가 채운 추론** (사용자가 말 안 한 빈칸) → 점검한다, 주 타깃.
  - **C. 사용자의 프레임/진단** ("내 문제는 동기야") → override X, gently surface(leverage 있을 때만 — §Precedence).
  - **D. 사용자의 가치/원함** (구성적 선: "곁에 있고 싶다") → 사실처럼 *믿되* surface-as-checkable **금지**(C4와 한 몸). 진단(C)과 분리.
- **융합 문장 splitter (C1 핵심).** "이탈 고객 3명이 'no mobile'이라 *적음*"(A: 적었다는 관찰) + "*그래서* 떠났다"(B: 인과 귀속) → 통째로 trust 금지. *말해졌다는 것*은 trust(A), *주장된 인과/예측*은 B로 보내 점검. 타인 행동 예측·인용된 제3자 판단·인과 귀속을 포함하면 그 절은 B.

### Phase 3 — 갈림길 / branch-test + C2 패치

- v1 불변식 유지: **대칭 branch 생성**(답 먼저 정하고 반대 흉내 금지 — motivated reasoning이 거부 갈래를 strawman으로 만들어 가짜 수렴시킨다).
- **C2 — 목표 고도(goal-altitude) forward-sim.** 분기를 *사용자가 준 이분법 안*이 아니라 *목표 고도*에서 본다. ① 사용자의 success metric/목표를 먼저 복원(없으면 §Phase4 I-don't-know triage의 goal-gap으로) → ② 각 branch를 *목표까지* forward-simulate → ③ **목표에서 갈릴 때만 real fork.** ("현금 아끼기 vs 쓰기"는 표면 fork지만 "성장 재개" 목표 고도에선 둘 다 같은 벽 → fake.)
- **option-space completeness 게이트.** 사용자 이분법을 추인하기 전에 "숨은 제3안"을 1회 능동 탐색. (이분법 상속 = C2의 절반.)
- **fake-fork 붕괴 후 재탐색 (라운드 1 보강).** fake로 판정하면 거기서 멈추지 말고 *진짜* 발산 축을 재탐색한다. (라운드 1: "fake를 찾고도 진짜 발산 축을 재탐색 안 한다.")

### Phase 4 — 수렴(convergence) + C3 패치

- v1 두 규칙 유지: 곁가지 버린다(처음 질문을 손에 쥠) / 닫을 때 닫는다.
- **C3-a — necessary-but-not-sufficient 게이트.** 측정 가능한 변수로 좁히기 전에 묻는다: **"이 수치 하나로 결정이 진짜 뒤집히나?"** 아니면 false closure(다른 질문에 답한 것 = 세이렌). leverage 없는 변수로의 좁힘 금지.
- **C3-b — carried-not-closed 태깅.** 못 닫은 미지를 *닫힌 척* 말지 말고 "carried"로 명시 운반.
- **C3-c — I-don't-know TRIAGE (날조 금지).** 사용자가 "모르겠어"면 default-assume으로 목적을 *날조*해 닫지 않는다. 세 갈래로 분류: **missing-input**(알아낼 작은 실험으로 → settle 루프) / **user-custodied**(사용자만 아는 것 — 가정 명시 후 그것만 확인받고 진행) / **goal-gap**(목표 자체가 비었음 — 목표를 먼저 복원, 이게 진짜 첫 질문). "이 돈이 뭘 위한 거지?"라는 목표 공백을 default가 메워 닫는 것 = 금지.

### Problem-1 라우팅 + C6 패치

전제의 출처를 2-bin(findable→measure / user-held→ask)이 아니라 **6-bin**으로: findable→measure · user-held→ask · **findable-but-user-custodied**(찾을 수 있으나 사용자가 쥔 것) · **other-held**(제3자가 쥔 것) · **contaminated-source**(출처 오염 — 그 자체를 의심) · **time-revealed**(시간이 지나야 드러남 → settle 루프). + **diagnostic 도메인 base-rate injector**(진단성 주장엔 도메인 기저율 주입).

### Precedence 층 (신규 아키텍처 — 라운드 1의 진짜 발견에 대한 답)

라운드 1: "규칙 추가만으로 안 된다 — 어떤 규칙이 어떤 규칙을 이기는지의 층이 필요." v2의 답은 **임의 우선순위 리스트가 아니라, 충돌을 *상류에서 해소*하고 남은 진짜 충돌만 척추로 tie-break하는 구조**다.

**원리 1 — 대부분의 충돌은 상류에서 사라진다.**
- *anti-dead-end ↔ zero-judgment* (pure-preference 충돌): **Step-0 요청유형**과 **branch-test leverage**가 해소. "닫아라"는 요청유형 (a)+real-fork에만 적용. fake-fork(목표에서 안 갈림)면 "닫는다"는 *방향 추천*이 아니라 **"네 목표론 안 갈린다 — 네 취향이다, 네가 고른다"는 답을 내놓고 닫는 것.** 닫음 = "방향 추천"이 아니라 "*처음 질문에 대한 답*을 낸다"로 재정의 → 두 규칙 공존.
- *convergence "곁가지 버려" ↔ provenance-C "프레임 꺼내"* (guilt 충돌): **leverage-on-original-question**이 공통 판별자. 프레임은 *처음 질문에 leverage가 있을 때만* surface(그 프레임을 바꾸면 처음 질문의 답이 바뀌나?). 있으면 곁가지가 아니다 → 꺼낸다(provenance-C 승). 없으면 곁가지 → 버린다(convergence 승). **둘 다 leverage를 거치면 충돌이 아니다.** (라운드 1이 leverage를 *답-전제*에만 쓰고 *프레임*엔 안 쓴 것이 구멍.)

**원리 2 — 남은 진짜 충돌의 고정 서열 (척추 grounding):**
1. **불가침 (절대 양보 안 함):** ① zero-judgment/honest-provenance(사용자 사실·가치 override 금지, AI 산문을 사용자-소유 필드로 세탁 금지, 사용자가 누구인지 uncalibrated 판정 surface 금지) ② 대칭 branch 생성. **어떤 패치도 이걸 위반하면 그 패치가 진다.**
2. **frame-integrity ≻ convergence:** 검증 안 된 load-bearing 프레임 위에서 convergence 기계를 돌리지 않는다. (라운드 1: "good convergence on a bad frame ships the blindspot faster" — 나쁜 프레임을 *더 빨리* 배달.)
3. **intrinsic-protection ≻ instrumental-reframe** (C4): 본질·정체성 가치를 물류로 강등하는 reframe은 primary가 될 수 없다.

---

## 3. 라운드 2 케이스 설계 (25개, trap pre-annotated)

라운드 1의 라운드-2 설계 지침을 따른다: **P0 클러스터(C1 융합문, C2 altitude 상속)에 볼륨 집중 + 새 아키텍처(step-0 게이트, precedence)를 직접 공격 + per-phase 라벨을 넘어 *final-output harm* 측정.**

**Trap 라벨 (케이스마다 1개 이상 pre-annotate):**
`FUSED`(융합 사실+추론) · `ALTITUDE`(목표 고도에서만 보이는 발산/수렴) · `THIRD-OPT`(숨은 제3안) · `INTRINSIC`(본질·정체성 가치) · `CLOSED`(이미 닫힌 결정/validation) · `RELAYED`(제3자 행동·판단의 전달) · `RESISTANCE`(분석으로 위장한 회피) · `GOAL-GAP`(목표 자체가 빔) · `FALSE-CLOSURE`(측정가능하나 다른 질문) · `CONTAMINATED`(오염된 출처) · `LOW-STAKES`(사소) · `CONFLICT`(규칙 충돌 유발 — guilt형/pure-preference형) · `COMPETENCE-TRAP`(진짜 데드라인/진짜 sunk-cost를 회피로 오인하게 만드는 함정).

**배분 (대략):** FUSED 6 · ALTITUDE 5 · CONFLICT 4 · CLOSED/REQUEST-TYPE 3 · INTRINSIC 3 · RESISTANCE/COMPETENCE-TRAP 3 · GOAL-GAP/FALSE-CLOSURE 3 · LOW-STAKES 2 · 기타(THIRD-OPT/RELAYED/CONTAMINATED) 각 케이스에 부수. (한 케이스가 복수 trap을 품어 합은 25 초과.)
도메인 다양화: 커리어·관계·금전·건강·창업·팀/조직·제품 결정 골고루. 라운드 1 케이스와 *중복 금지*(새 24~25개).

## 4. 측정 (방법론 강화)

각 케이스에 대해 v2 시뮬레이터가 산출:
1. **step-0 라우팅**이 맞았나 (열린결정/validation/vent/정보 오분류 여부).
2. **per-phase 판정** worked/strained/broke (라운드 1과 연속) — frame-check, provenance, fork, convergence, **precedence**(신규).
3. **trap별 detection** DETECTED / MISSED / PARTIAL.
4. **final-output harm** — 엔진이 *실제로 사용자에게 내놓을 문장*을 생성하고, 그게 railroad / erase-intrinsic / reopen-closed / fabricate-goal / arm-avoidance / false-closure 중 무엇을 했나(none 포함).
5. **spine 위반 여부** (zero-judgment/honest-provenance 위반 bool).

그리고 **adversarial verify**: 독립 skeptic이 표본을 재심 — "worked인데 *credit 못 받을* 자기-아첨인가"(self-play ceiling 방어), "broke인데 *부당한* break인가" 양방향.

## 5. 라운드 2 성공 기준 ((a)/(b)로 가는 신호)

- **(a) 쪽 신호:** frame-check·provenance가 0을 *유의미하게* 벗어남(예: 각 worked ≥ 8/25). trap detection-rate가 v1 대비 상승. precedence 층이 라운드 1의 두 명명 충돌을 실제로 해소.
- **(b) 쪽 신호:** frame/provenance가 여전히 0~소수에 머묾. 패치가 *새* 충돌을 만들어 충돌 총량이 안 줆. step-0 게이트가 오분류로 새 harm을 도입.
- 어느 쪽이든 라운드 3은 v2의 *가장 약한 표면*을 정조준한다.

> 정직성 노트: 이 계획의 v2 설계 판단(특히 precedence 층)은 founder의 memory/philosophy(zero-judgment 척추, harbor=항해가 설계를 이긴다, 빼기·정직 우선)에 근거한 *대리 판단*이다. 검증은 설계가 아니라 라운드 2~4의 부딪힘이 한다.
