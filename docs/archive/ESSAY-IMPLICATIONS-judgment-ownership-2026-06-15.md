# Argus 마스터 종합 — 세 에세이가 결정(結晶)시키는 제품 정체성

> Date: 2026-06-15
> Source: 배수정(persuasion bombing), 이경헌(AX 병목/순서·skills-as-code), 배수정(decency vs meaningfulness) 세 글에서
> Argus의 실제 코드·스킬·표면에 grounding한 함의 추출. 9-agent 워크플로(Map→Extract 4렌즈→Stress→Synthesize),
> 28개 함의 + 7개 adversarial caution. Stress 패스가 추출의 과잉(6개 아이디어를 25개로 부풀린 것, 강제
> 게이트의 역효과, 점수화의 자가당착)을 깎아낸 뒤의 정련된 결론.

## 1. 한 줄 요약

세 에세이는 한 척추로 수렴한다 — **판단의 소유권**: AI에게 판단을 빼앗기지 말고(E1), 자신의 판단을 실행 단위로 남기되(E2), 그렇게 남길수록 "이게 내 일이었다"는 감각이 흐려진다는 것(E3) — 그래서 Argus의 단 하나의 임무는 **AI의 생성력은 최대로, 판정력은 0으로 써서, '넘겨받은 소유권'을 '되찾은 소유권'으로 바꾸는 것**이다.

---

## 2. 삼각 구조: 판단의 소유권

**Through-line.** E1은 인식론, E2는 운영, E3는 의미/정체성의 층위에서 같은 한 가지를 말한다. 판단이 누구 것이냐. Argus는 이미 이 척추 위에 베팅돼 있다(`AI의 판정을 0으로`, `판정형 forbidden`, `blocked` 항상 false). 문제는 척추가 코드 곳곳에서 **우회되고 있다**는 것이다.

이 종합의 핵심은 두 긴장을 *제거*가 아니라 *동시에 지탱*해야 할 설계 제약으로 본다는 것이다.

**긴장 ① E1 ↔ E2 — 인코딩은 권위를 만들고, 권위는 검증 저항을 낮춘다.**
판단을 skill로 인코딩하면 출력이 "우리가 숙고한 판단"으로 읽힌다. 이게 바로 검증 저항을 낮춰 persuasion bombing을 *스케일*시킨다. 라이브러리가 "자신만만한 오답의 권위 있는 저장소"가 된다.
- Argus에서 구체적으로: SKILL.md는 `name/description/effort`만 들고 권위를 *주장*한다. 진짜 검증(backtest precision 94.9%, GATE G-W0/G0)은 `scripts/decision-watch-eval/`에 **무대 밖**에 있어, 사용 시점에서는 보이지 않는다. devils-advocate는 "independent evaluator"라 선언하지만 `context: fork` — 같은 weights, 두 번째 의자.
- **설계 제약:** skill의 권위는 *자신의 검증 출처를 들고 다니거나*, 아니면 적대자를 **진짜 외부 데이터(journal/자차표)**로 라우팅해야 한다. 같은 모델의 두 번째 인스턴스는 절대 외부 심판이 될 수 없다.

**긴장 ② E2 ↔ E3 — 잘 인코딩할수록 내 지문이 사라진다.**
판단을 잘 남길수록 skill이 판단을 *대신*하고, 출력에서 사용자의 흔적이 지워진다. E2의 성공이 E3의 침식을 *생산*한다.
- Argus에서 구체적으로: no-flinch 경로(`Falsification.tsx:230`, `real_bet: surfaced`). Argus가 판단을 *너무 잘* 인코딩해서 가장 부하 높은 가정을 사용자 대신 골라주고, 그걸 `governing_idea`로 도장 찍는다. E2의 완벽한 자동 초안이 곧 E3의 "이게 내 베팅이 아니다"를 만든다.
- **설계 제약:** 자동 초안이 좋을수록 provenance 정직성이 *더* 중요하다. 좋은 기계 초안이 사용자-소유 라벨을 상속받게 두지 말 것.

이 두 긴장의 교차점이 **manufactured-meaning trap**이다: AI가 "이게 당신의 판단입니다"라는 소유권의 언어 자체를 생성하면, E1의 persuasion bombing이 E3의 옷을 입은 것이다. 잃은 의미보다 *제조된* 의미가 나쁘다 — 손실이 알아챌 수 없게 되니까.

---

## 3. Argus의 정체성을 결정(結晶)화하는 함의 (IDENTITY)

**한 문장 정체성:** *"당신의 출력을 끌어올리되 당신의 판단을 가져가지 않는 유일한 AI."* (`max generation, zero judgment`)

이건 decency를 파는 copilot이 **구조적으로** 주장할 수 없다. 그들의 가치 제안("시간 절약, 부담 감소")은 AI가 *결정*해 주는 것을 요구한다. 그 순간 E1(설득 포획)과 E3(일의 주인이 흐려짐)이 동시에 발화한다. 더 정확히는 — decency 축은 E3가 "만족도를 움직이지 않는다"고 지목한 바로 그 축이다. Argus의 사용자는 정체성이 곧 판단인 지식노동자다. AI는 그의 **meaningfulness**를 건드리지, decency를 건드리지 않는다. "시간 절약"은 meaningfulness 불안에 잘못 처방된 약이다.

**구조적 차별점 (이미 출하됨):** E1의 처방은 "대화 밖으로 나가라"다. Argus는 *이미* 그 바깥 구조다 — AI에 넘기기 *전에* 돌리고, watch는 *과거* 트랜스크립트를 읽고, settle은 *나중에* 현실이 판정한다. 이게 E1이 말한 parallel judge다: frame 바깥, 설득 불가, 이미 출하됨.

**Moat — 정직하게.** 사전 종합은 moat를 "n=1 history 소유"라 했다. Stress가 이를 정당하게 깎는다: **경쟁자도 decision log를 쌓을 수 있다.** 데이터 축적 자체는 "주장하긴 쉽고 방어하긴 어렵다." 진짜 방어 가능한 것 두 가지:
1. **사용자가 settle하러 돌아오는가 (Return retention)** — 이건 *아직 미검증*이고, 검증되면 진짜 moat다.
2. **빈 거울을 보여줄 수 있는 규율** — 자차표는 5 settlement까지 잠겨 있고("데이터 없는 자차표는 빈 거울"), patterns는 sample size에 모든 주장을 스케일하고 날조를 거부한다. engagement에 최적화된 챗봇은 *구조적으로* 빈 거울을 보여줄 여유가 없다. 이게 데이터보다 방어 가능한 moat다 — 단, 이건 **규율이 일관되게 지켜지는 한**에서만 참이고, no-flinch 경로 같은 우회로가 그 규율을 *지금 깨고 있다*.

정직한 결론: moat는 "내가 가진 데이터"가 아니라 "그 데이터를 *되말할 수 있을 만큼* 신뢰하게 만드는 규율 + 돌아오게 만드는 retention"이다. 둘 다 아직 증명 전이다.

---

## 4. 장점을 강화하는 함의 (STRENGTHEN)

**P0 — 척추를 코드의 게이트로 만든다 (subtractive, 신규 숫자 없음).**
- `docs/ARGUS-FINAL-DIRECTION.md`에 불변식 명시: *"zero-judgment — 모든 새 surface는 통과해야 한다: 이 기능은 생성하는가, 판정하는가? 판정하면 척추를 위반한다."* `CLAUDE.md`에서 신규 surface 체크리스트 게이트로 참조. 이건 빌더를 제약하지 사용자를 훈계하지 않는다 — **engine 형태**다(§7 참조).

**P1 — 재-말하기를 *레이아웃*으로 강제한다 (숫자 아닌 구조).**
- `CurrentBearingCard.tsx`: 사용자-소유 삼각(`current_course` + `contract_seed.predicate` + `road_not_taken`)을 시각적 척추로 승격. `why_this_course`(AI judge의 `good_parts` verbatim)는 "AI가 본 근거" 접이식 블록으로 강등, 기계 귀속 명시. **re-sayable 테스트:** 사용자가 course + 베팅 + 안 가는 길만 읽고 한 호흡에 말할 수 있는가? `why_this_course`가 있어야 말이 되면 아직 re-sayable이 아니다.

**P1 — skill이 권위를 *얻게* 한다 (E1↔E2 긴장의 직접 처방).**
- 7개 SKILL.md frontmatter에 `owner / last_validated(날짜+gate, 예: G-W0) / review_cadence / status` 추가. `orchestrate`를 soft-alias가 아니라 `deprecated: true, superseded_by: recast`로 정식 처리. 무대 밖 backtest를 사용 시점에서 가시화 — E2의 "operated asset" 규율을 E1의 confident wrongness에 대한 in-product 방어로 전환.

**P2 — Falsification을 E1의 "대화 밖으로 나가기"로 *재명명*(개념).**
- 단, Stress를 honor: 이건 **un-skippable로 만들지 않는다**(§7). Falsification은 사용자가 producer의 frame을 깨고 자기 말로 재서술하는 유일한 exit다. 그 정체성을 설계 문서에 못 박되, skip 버튼은 그대로 둔다.

---

## 5. 단점을 보완하는 함의 (COMPENSATE)

가장 시급한 두 결함은 *지금 코드에 살아있는* manufactured-meaning trap과 persuasion-bombing-self-risk다.

**P0 — manufactured-meaning trap (no-flinch laundering). 단, Stress가 처방을 결정한다.**
- 결함: `Falsification.tsx:230`이 `real_bet`(= "사용자 자신의 베팅"이라는 이름의 필드)에 기계-surfaced 문장을 세탁해 넣고, Current Bearing이 이를 사용자의 governing_idea로 출력한다. 가장 지친 사용자(= E1이 가장 취약하다고 한 바로 그 사람)가 100% AI 산문을 자기 판단으로 도장받는다.
- **Stress의 결정적 반박을 honor:** "강제 작성 게이트"는 잘못된 약이다. `Falsification.tsx:223-235`의 설계 노트는 *실제 사용자 테스트의 기록된 응답*이다 — "8분차, 바쁜 사용자는 탭을 닫고 문서를 영영 못 받는다." 강제 게이트는 지친 사용자를 *보호*하는 게 아니라 *내쫓는다*. 그러면 부분 소유권이 아니라 **0 소유권**이다. epistemic 순수성이 E3의 meaningfulness 축을 위해 E3의 decency 축을 파괴한다.
- **올바른 불변식: "누가 썼는지 거짓말하지 않는다" — "타이핑 없이는 못 나간다"가 아니다.**
  - `FalsificationResult`에 `authored: 'user' | 'ai_surfaced'` 플래그. typed가 아닌 모든 경로(believeAll, use-as-is, skip)에서 `ai_surfaced`. 이걸 `Predicate`로 운반해 Current Bearing이 *조용히* 다르게 shade. **마찰 추가 없음, 무손실, skip 버튼 유지, 수치 없음.** 이게 이 클러스터에서 유일하게 안전한 형태다.

**P1 — per-line provenance shading > 전역 honest-clause.**
- "70% LLM 추론, 외부 검증 0건"이라는 단일 면책은 한 번 읽히고 무시된다 — 자신만만한 *그 줄*과 함께 이동하지 않는다. 각 bearing 필드를 출처로 shade: ai-inferred(unverified) / user-said / reality-settled. 전부 amber인 bearing은 한 단어 disclaimer 없이도 "이건 미검증 모델 산문"을 *시각적으로* 신호한다. honest-clause를 각주가 아니라 작동하게 만든다.

**P1 — 복사되는 산출물에 authorship 도장 (export).**
- 실제 소유권 순간은 카드가 아니라 **클립보드**에서 일어난다. `bearingToMarkdown()` (`current-bearing.ts`)이 `why_this_course`를 1인칭 평문으로 찍으면, 가리킬 문서를 손에 쥐여주는 것이다. 사용자-소유 필드만 1인칭, AI 근거는 "리뷰가 본 근거"로 귀속, governing_idea가 no-flinch/기계 경로면 footer 도장: "이 판단은 아직 당신의 말로 확인되지 않았습니다."

**P1 — devils-advocate "독립"은 라벨이지 아키텍처가 아니다 — 단, 신중하게.**
- fork는 producer의 blind spot과 설득 반사를 *공유*한다. Argus가 가진 유일한 진짜 외부 출처는 이미 소유한 것 — 사용자의 n=1 journal/자차표. "지난 5번 중 4번 이 confidence에서 일정을 틀렸다"는 *데이터*는 producing model이 generated critique처럼 수사적으로 녹여버릴 수 없다.
- **단 Stress를 honor:** 이건 journal이 *진짜 외부 데이터*라서만 허용된다 — 두 번째 모델이 아니다. 그 구분을 칼같이 유지. 그리고 §7/§3에 따라 이건 **5-settlement 데이터 floor가 차야** 작동하므로 **late-ladder**다, 지금 작업 아님.

---

## 6. 북극성 지표 (METRIC)

**지표: re-sayable / explain-your-own-decision.** E3의 유일하게 정직한 의미 측정 — "세션 후 사용자가 자기 일을 자기 말로 더 잘 설명할 수 있는가." DQ score(`computeDecisionQuality()`, src/ 호출자 0개)도 Judgment Vitality gamma("uncalibrated structural proxy")도 둘 다 무효다. 둘 중 하나를 의미 신호로 출하하는 것 자체가 manufactured-meaning trap이다 — 숫자가 felt ownership을 대신 서는 것.

**Stress가 정의를 강하게 제약한다. 이걸 honor한다:**
- ❌ **연속 divergence SCORE 금지.** `real_bet`과 AI 초안 사이 semantic/edit distance는 proxy의 proxy다 — 사용자가 AI의 *의미*를 다른 단어로 re-say하면(높은 어휘 거리, 0 재파악) 또는 더 게으르고 나쁜 문장을 타이핑하면(거리 멀지만 더 나쁨), 측정이 무너진다. 단일 숫자를 의미 신호로 출하 = 금지된 판정형 + E3의 경고 반복.
- ❌ **죽은 DQ sparkline에 새 uncalibrated 숫자 점등 금지.** `quote`/`real_bet`은 "web에서 비어있을 수 있다" — 검증할 populated 데이터가 *아직 없다*.
- ✅ **방어 가능한 형태 = 이진 정직 플래그:** "top predicate가 user-authored였나 ai_surfaced였나?" 이건 string 비교, 모델 판정 불필요, 이미 존재하는 필드. 북극성 = **`self_authorship_rate` = hand-typed bet 계약 / 전체 계약** + **Return/settlement retention** (= 모든 n=1 지표의 데이터를 *생산*하는 것).

**Argus가 instrument하는 법 (구체):**
1. `FalsificationResult.authored` 플래그를 sealed contract에 운반 (§5 P0와 같은 작업, 추가 비용 0).
2. patterns skill에서 `self_authorship_rate`를 *frequency statement*로 노출 ("최근 10개 결정 중 6개를 당신 말로 다시 적었습니다") — confidence-tier 규율 하에. 점수 아닌 빈도.
3. **진짜 북극성은 retention이다:** "due에 돌아와 settle한 계약 비율." 이게 moat가 방어 가능한지를 결정하는 미검증 변수다(§3). 여기에 계측을 집중하라 — 비어있는 ledger를 읽는 personalization 기능이 아니라.
4. DQ sparkline은 **점등 말고 어둡게 둔다** — settled 데이터와 검증된 정의가 생길 때까지.

---

## 7. 하지 말아야 할 것 (per Stress)

**1. Falsification을 un-skippable로 만들지 마라.** skip escape는 negligence가 아니라 실측된 tab-abandonment에 대한 기록된 응답이다. 강제 게이트는 가장 지친 사용자를 보호하지 않고 내쫓는다(0 소유권). 불변식은 "절대 거짓말 안 한다"지 "절대 타이핑 없이 못 나간다"가 아니다.

**2. parallel judge-agent를 cargo-cult하지 마라.** E1의 org-fix는 producer-pipeline 회사용 조언이다. judge-agent를 문자 그대로 추가하거나 bearing 정확도를 *노출되는 기능*으로 채점하면 두 출하 불변식을 위반한다(`판정형 forbidden`, `claim scoreboard 금지`). "자차표가 ARGUS를 채점" → "proceed bearing이 X% 맞았다"는 correctness scoreboard다. NO가 ~0 비용의 *질문*으로 framed된 도구에서, bearing이 right/wrong으로 채점되는 순간 질문이 단언이 된다. **내부 calibration 로깅은 팀 정직성용으로 OK, 사용자에게 "Argus는 X% 맞다"로 노출하는 건 금지.** settle loop이 *이미* frame 바깥 심판이다.

**3. inspection ORDER 클러스터를 지금 짓지 마라 — P0에서 강등.** E2의 "순서"는 회사가 영업사원의 *문서화된* 체크 순서를 인코딩하는 것이다. 이를 "probe_trace를 reaction latency와 로깅 → 10세션 후 개인 inspection order 도출 → reframe 4차원을 사용자별 재정렬"로 매핑하는 건 사변적이다 — 클릭 latency에서 안정적 개인 순서가 복원된다는 증거가 없고, reframe을 사용자의 *습관적 렌즈* 먼저 보게 재정렬하면 **확인편향을 맨 앞에** 둔다(reframe의 존재 이유와 정반대). 결정적 신호: 바로 다음 함의가 *자기 기능에 대한 방어*(recognition gate)를 발명한다. 자기 제안 기능에 방어를 지어야 하면 그 기능은 미숙하다. reframe의 고정 순서는 유지하되 정직하게 "기본값"으로 라벨(당신 것 아님), 그리고 blind spot이 걱정이면 mirroring의 *반대* — 의도적으로 **비습관적 차원을 surface**하라.

**4. n=1 moat 기능을 빈 데이터 floor 위에 짓지 마라.** "5 settlement" / "10+ session"에 게이트된 모든 함의(journal로 적대자 라우팅, miss-rate로 reframe 재정렬, deviation-calibration, 과거 말 scaffolding, deprecation hygiene)는 *파운더 외 아무도 도달 못 한 자산*을 소비한다. ledger는 gitignore/dogfood-only, quote는 web에서 빈다. **데이터를 생산하는 것(Return rung, settlement retention)이 load-bearing 우선순위다 — 아무도 안 쌓은 데이터를 읽는 기능이 아니라.**

**5. 철학을 signboard로 만들지 마라 (chat-native vs step-outside 긴장).** 에세이 어휘를 landing copy로 포팅하려는 충동을 거부 — "같은 창에서 검수하면 당신은 두 번째 설득 대상", "the only AI that...", persuasion bombing 이론 stanza. 척추 자신이 경고한다: `메타인지는 엔진이지 간판이 아니다`. meaning 불안 지식노동자는 *의미와 인식론을 강의하는* 도구에 가장 알레르기 반응한다. **좋은 형태(engine):** CLAUDE.md의 zero-judgment 게이트, "verification is not a chat"를 내부 설계 불변식으로. **나쁜 형태(signboard):** persuasion-bombing 이론, 소유권 설교를 surface에. *오리엔테이션을 시연하라, 인식론을 서술하지 마라.* — 한 가지 주의: E1의 멀티턴 회피가 Argus의 진짜 강점이라 해도(single-shot flinch는 모델에게 반박 턴을 안 준다), 이건 *내부 불변식*으로만 가치 있다. 단, refine의 multi-turn 루프는 예외 — 3 rounds cap을 *정확히* persuasion 재논쟁 창을 막기 위한 것으로 유지하라.

**6. uncalibrated meaning을 출하하지 마라 — Vitality를 격리하라.** (이건 NOT-build이자 가장 안전한 즉시 실행 — §8) Judgment Vitality(`gamma`, `rigidity_score`, `tier`)는 사용자가 *누구인지*에 대한 판정을 계산해 concertmaster 코칭에 먹인다 — gamma는 자인된 uncalibrated proxy. E1(분석으로 분장한 confident wrongness) + E3(판단이 얼마나-살아있는지의 제조된 언어) + `메타인지는 엔진이지 간판` 위반의 삼중 위반. calibrate하지 말고 *서지 못할 의미 점수를 surface하길 거부*하라.

**7. 25개를 mandate로 착각하지 마라.** 추출은 ~6개 아이디어를 25개로 부풀려 false-consensus P0를 쌓았다(re-sayability 3-4회, Vitality 격리 2회, no-flinch laundering 3회, skill metadata 2회). 중복을 evidence로 이중계산하지 마라. **subtractive·신규-숫자-없는 승리를 먼저 출하** — Vitality 격리(uncalibrated 주장을 *삭제*)와 silent ai_surfaced provenance. metric·judge·계측 schema·landing 철학을 *추가*하는 모든 것은 그걸 정당화할 settled 데이터가 생길 때까지 연기.

---

## 8. 즉시 실행 후보 (ACTIONS)

### 안전 — 지금 해도 됨 (subtractive 또는 honest-provenance, 신규 숫자/판정 없음)

| # | target file(s) | 변경 (한 줄) | effort |
|---|---|---|---|
| A1 | `src/lib/judgment-vitality.ts`, concertmaster 코칭 호출부 | VitalityAssessment `tier`/`score`를 사용자-facing copy에서 제거, 내부 라우팅 신호로만 격리; `ARGUS-FINAL-DIRECTION.md` deliberate-non-do에 기록 | **S** |
| A2 | `src/components/workspace/progressive/Falsification.tsx`, `src/lib/decision-contract.ts` | `FalsificationResult.authored: 'user'\|'ai_surfaced'` 추가, typed 아닌 모든 경로(believeAll/use-as-is/skip)에 `ai_surfaced`; Predicate로 운반 — **skip 버튼·마찰 그대로** | **S** |
| A3 | `src/lib/current-bearing.ts`, `CurrentBearingCard.tsx` | A2의 authored 플래그 + settlement verdict를 각 `why_this_course` 줄에 thread, 좌측 border tint로 shade(amber=ai-inferred / ink=user-said / green=settled) | **M** |
| A4 | `src/lib/current-bearing.ts` (`bearingToMarkdown()`) | export에서 AI 근거를 출처 귀속, governing_idea가 ai_surfaced면 "아직 당신의 말로 확인 안 됨" footer 도장 | **S** |
| A5 | `.agents/skills/{argus,recast,rehearse,refine,reframe,blindspot,patterns}/SKILL.md` | frontmatter에 `owner/last_validated(+gate)/review_cadence/status` 추가; `orchestrate`를 정식 `deprecated` | **S** |
| A6 | `.agents/skills/doctor/` | skill `last_validated`가 `review_cadence`보다 오래되면 경고 — staleness를 진단 가능한 조건으로 | **S** |
| A7 | `CurrentBearingCard.tsx` | 사용자-소유 삼각(`current_course`+`contract_seed`+`road_not_taken`)을 시각 척추로 승격, `why_this_course`는 "AI가 본 근거" 접이식으로 강등 | **M** |
| A8 | `docs/ARGUS-FINAL-DIRECTION.md`, `CLAUDE.md` | "zero-judgment" 불변식 + "verification is not a chat"를 **내부 설계 게이트**로 명문화(landing copy 아님); 신규 surface 체크리스트로 참조 | **S** |
| A9 | `src/lib/decision-quality.ts`, `NavigatorStrip`/`buildLearningCurve()` | populated되지 않는 DQ sparkline을 어둡게(데드코드 표시 또는 제거) — uncalibrated 숫자 점등 금지 | **S** |

### 파운더 결정 필요 (데이터 floor·retention 검증·정체성 라인에 의존)

| # | target | 결정 사항 | effort |
|---|---|---|---|
| B1 | progressive flow 전반 (Return rung, settle 경로) | **최우선 load-bearing:** settlement/Return retention 계측 — moat가 방어 가능한지 결정하는 미검증 변수. 이게 다른 모든 n=1 기능의 데이터를 생산한다 | **L** |
| B2 | patterns skill / `self_authorship_rate` | hand-typed bet 비율을 *frequency statement*(점수 아님)로 노출할지 — 단 quote 필드가 web에서 채워진 *후* | **M** |
| B3 | `.agents/skills/rehearse/SKILL.md`, `devils-advocate.md` | journal-cited critique를 외부 출처로 우선 surface — **5-settlement floor 차고, journal이 진짜 외부 데이터일 때만**, late-ladder | **M** |
| B4 | Falsification ↔ recast signal | recast가 irreversible/accountable로 flag한 결정에서 auto-pass *난이도를 높일지*(완전 차단 아님 — Stress 한계 내) | **M** |
| B5 | landing / 포지셔닝 copy | "max generation, zero judgment"·"empty mirror" moat를 *시연*으로 보여줄지 — **에세이 이론을 surface에 강의하지 않는 선에서**(signboard 금지) | **M** |

**연기/보류 (증거 생길 때까지):** probe-order 계측, reframe 차원 사용자별 재정렬, deviation-calibration metric, 과거 말 scaffolding, pattern recency-deprecation, bearing-accuracy scoreboard — 전부 빈 ledger를 소비하거나 판정형을 재도입한다.

---

핵심 한 줄: **빼는 것(A1)과 거짓말 안 하는 것(A2)을 먼저 출하하고, 숫자·심판·계측·철학을 *추가*하는 모든 것은 settle된 데이터가 그걸 정당화할 때까지 미뤄라.** 척추는 이미 옳다 — 일은 코드가 우회하는 지점에서 척추를 load-bearing으로 만드는 것이다.
