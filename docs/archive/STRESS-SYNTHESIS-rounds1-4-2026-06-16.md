# 엔진 스트레스 테스트 라운드 1–4 — 최종 종합 + Argus 수정 실행 계획

> Date: 2026-06-16
> 메타튜닝 결정 엔진(`MECHANISM-frame-and-fork-2026-06-16.md`)을 4라운드·누적 ~98 적대 케이스·~400 에이전트로 부딪힌 결과의 종합. 각 라운드는 앞 라운드의 실패에서 다음 엔진 버전(v1→v4)과 채점 방법을 설계했다.
> 한 줄: **엔진의 *본절*("무엇을 판단할지엔 max generation")은 패치 가능했고 실제로 닫혔다. *거울절*("판단·개입할지 말지엔 zero judgment")은 패치 불가 — 개입 트리거가 곧 아키텍처라서다. 결론: 제품은 *발산 엔진*이 아니라 *절제(under-fire)를 디폴트로 하는 subtractive 인지(recognition) 표면*으로 재설계돼야 한다.**

---

## 1. 4라운드의 호(arc)

| 라운드 | 엔진 | 방법 | 핵심 결과 |
|---|---|---|---|
| **R1** | v1 (frame→fork, leverage×provenance, convergence) | 24 케이스, self-report | frame-check **0/24**, provenance **0/24**. 6 클러스터. **메타발견: 규칙들이 서로 충돌 → precedence 층 필요.** |
| **R2** | v2 (+6패치 +step-0 게이트 +precedence) | 25 케이스, self-report + 독립 verify | frame 0→정직 ~6, provenance 0→~4 (**0 탈출**). 단 **self-play가 harm을 24/25에서 못 봄.** mixed **~70/30 (a)**. |
| **R3** | v3 (+8패치 +(b)-leaner 2건 재정의) | 25 케이스, literal 라우트 + 독립 blind 패널(3-vote) | 두 (b)-leaner(forced-gate·taste-close) 재정의로 봉합. majority harm **4.2%**, spine 0. **~96/4 (a)** — 단 **negative control 0건 = over-fire 미검증.** |
| **R4** | v4 (+6패치) | 25 케이스(neg control 10) literal + **엄격 5-vote 패널** + over-fire·대칭 직접측정 | majority harm **72%**, neg control over-fire **60%**, asymmetric_steer modal(11). **평결 (b) — 척추에 금.** |

**호의 모양이 평결이다:** 매 라운드가 한 클러스터를 닫으면 harm이 *사라지지 않고 새 라벨로 재출현*했다.
```
R1: frame/provenance 0/24 (단일 가정 surface가 깨짐)
 → R2: false-closure, forced-fork, step-0 충돌 (패치가 충돌면을 증식)
 → R3: 비대칭-steer 잠복, reframe-pole 세탁 (능동 reframe이 새 공격면)
 → R4: over-fire 60%, asymmetric_steer 72% (발산 엔진이 발산을 제조)
```
이건 버그의 잔재가 아니라 **generate-a-fork / find-the-leverage 아키텍처의 emergent 속성.** 두더지를 때리면 옆에서 나온다 — 두더지가 *아키텍처*이기 때문.

---

## 2. 최종 평결 — (b) 척추에 금, 정직한 split

라운드 1의 열린 질문은 "frame/provenance 0/24가 (a) 패치 가능인가 (b) 척추에 금인가 — 생각으로 못 가른다, 부딪혀서 가른다"였다. 4라운드 부딪힌 답:

- **(a) 본절은 닫혔다.** "무엇을 판단할지엔 max generation" — 즉 *올바른 전제를 골라 정직하게 비추는* 일은 패치 가능했고 실제로 닫혔다: frame 0/24→24/25, provenance 세탁 차단, forced-gate 재정의(거부 아닌 태그+초안+escape), 명시 verdict 거부, 이해당사자 보존. **이건 진짜 진보다.**
- **(b) 거울절은 못 닫혔다.** "판단·개입할지 말지엔 zero judgment" — 즉 *찾을 게 없을 때 안 찾고, 평탄할 때 평탄으로 닫고, 기울지 않는* 일은 규칙 재정의로 달성 불가. 라운드 4가 사전등록한 (b) 3조건이 전부 충족: neg control over-fire 60% / 엄격 패널 harm 4.2%→72% / 대칭 tilt가 D1 ledger 통과(modal harm + spine 위반).

**왜 거울절이 구조적으로 불가인가 (환원 불가 residue):**
1. **over-fire ↔ under-fire는 fix가 아니라 dial이다.** R4-16·19는 *같은 출력*을 패널이 over_fire *와* under_fire로 동시에 봤다. "포크 제조 말라"와 "load-bearing 전제를 surface하라"는 본질적으로 상충 — 둘을 동시에 만족하는 규칙은 존재하지 않는다. 엔진은 *선택*해야 한다.
2. **frame-check/leverage-pre-pass는 confirmation-biased generator다.** "평탄(load-bearing 없음)"은 "here's one"보다 *신뢰성 있게 맞히기 어려운 타깃*이다. 평탄을 평탄으로 인식하는 건 능력 부재가 아니라 generator의 자연적 실패 지점.
3. **모델의 잔존 도덕 prior(정직·안전·취약자 편)는 어떤 대칭 규칙도 못 지운다** — weighting·charity에 살지 structure에 안 살아서. D1 같은 구조 ledger로는 못 잡는다. taste는 rule-patch 불가.
4. **honest provenance는 필요하나 불충분하다.** `ai_surfaced` 태그된 fork도 기운다(R4-19·21). 태그는 *거짓말*을 막을 뿐 *steer*를 막지 못한다.

> **한 줄:** v4는 *좋은 엔진*이지만 *안전한 엔진*은 아니다. 그리고 안전하지 않은 이유는 튜닝이 아니라 *그것이 엔진이라는 것* — 발산 기계는 발산이 없을 때 발산을 제조한다.

---

## 3. 이 결과가 기존 철학을 어떻게 *날카롭게* 하는가

이 4라운드는 새 철학을 만든 게 아니라 *이미 문서에 있던 직관을 검증하고 정밀화*했다:

- **harbor-and-voyage / anti-Siren (`MECHANISM` §7):** 원래 교훈은 "수렴은 에이전트·데이터를 더해서 안 생긴다 — 별도의 능동적 제약이다." 4라운드가 더 깊은 버전을 증명했다: **엔진의 *발산* 드라이브가 너무 구조적이라 *발산을 제조*한다.** Siren은 수렴의 *부재*가 아니라 발산 엔진 *안에* 산다. 그리고 이건 *설계가 아니라 항해로* 드러났다 — `MECHANISM` §7의 convergence 구멍이 첫 dogfood로 드러났듯, over-fire 구멍은 negative control을 *측정하자마자* dominant failure로 실현됐다. **종이는 못 보고 부딪힘만 본다(harbor의 핵심).**
- **judgment-ownership-spine:** 척추는 `max generation, zero judgment`. 4라운드는 **두 번째 절("zero judgment")이 어려운 절**임을 증명했다 — 그리고 그게 "사용자를 판단하지 마라"보다 넓다: "*개입할지 말지*를 판단으로 떠밀지 마라"까지 포함하며, 그건 발산 generator와 아키텍처 수준에서 상충한다.
- **literature 교정(memory):** "Argus의 flow가 *거꾸로*일 수 있다 — AI bearing을 *먼저* 생성하고 사용자가 나중에 flinch(Falsification). AI-first면 P0 재설계 후보." 4라운드가 이를 *확증*하고 처방을 구체화한다(§4 P0).
- **anti-Barnum / 압축(product-thesis):** "process는 0으로 압축, specificity는 절대 압축 마라." over-fire는 정확히 *process(의례·fork)를 압축 안 한* 실패다. subtractive recognition으로의 전환이 이 thesis의 직접 구현.

---

## 4. Argus 수정 실행 계획 (코드/아키텍처)

**대원칙(라운드 4 code_implications의 종합):** 엔진을 *2폴 weighted fork generator*에서 **절제(under-fire)를 디폴트로 하는 subtractive recognition 표면**으로 바꾼다. 사용자에게 *엔진이 가중치 친 폴*을 절대 내보내지 않는다. dial을 *under-fire 쪽*으로 고정한다 — Argus는 지친 사람이 도착하는 orientation 제품이므로(`ARGUS-FINAL-DIRECTION`), 절제가 디폴트이고 더 원하면 사용자가 당긴다.

### P0 — 단일 최고-레버리지 (over-fire 60%를 직격)

**P0-1. leverage/step-0 디폴트를 뒤집는다.** `src/lib/probe-engine.ts`, `src/lib/progressive-prompts.ts`
- 현재 pre-pass는 leverage를 *찾도록* 편향된 generator → 평탄에서 60% over-fire.
- **변경:** "평탄 / do-nothing / 1줄 직답"을 *디폴트*로 두고, frame/fork *발화*에 **positive threshold 증거**를 요구한다(현재는 반대). 고-precision `FLAT` / `DO-NOT-FIRE` 분기를 명시 추가 — taste-close-grant나 직답을 **의례 0으로** 방출.
- **테스트:** negative-control 회귀 스위트(R4의 10건을 fixture로). over-fire majority가 ≤1/10이 될 때까지.

**P0-2. 사용자-facing 출력을 weighted fork → subtractive recognition으로.** `src/components/workspace/progressive/Falsification.tsx`(`real_bet: surfaced` @ :230), `src/lib/progressive-prompts.ts`, `src/lib/fork-to-question.ts`
- **현재 LIVE 결함:** `Falsification.tsx:230`이 no-flinch에서 기계-surfaced 문장을 `real_bet`(사용자-소유 필드)로 세탁한다. 게다가 `ai_surfaced` 플래그는 *아직 코드에 없다* — 그리고 라운드 4는 그 플래그가 *들어와도 불충분*함을 증명했다(태그된 fork도 기움).
- **변경:** 출력을 *가장 큰 load-bearing 전제 하나를 인지문으로 명명* + *crux 질문* + *핸들 반환*으로. **엔진이 가중치를 친 2폴을 사용자에게 절대 내보내지 않는다.** no-flinch 경로는 사용자-소유 필드(`real_bet`)에 기계 문장을 쓰지 않는다 — 최소한 `authored: 'ai_surfaced'` 태그(CLAUDE.md A2), 더 낫게는 *가중 bet 자체를 제시하지 않음*. 이게 manufactured-meaning 트랩을 그 자리에서 무력화한다.
- **테스트:** `falsification-render.test.tsx`에 "no-flinch 경로가 `real_bet`에 ai 문장을 쓰지 않는다" 가드.

### P1 — 누수 표면 제거 (asymmetric_steer 72%를 직격)

**P1-1. value-fork의 폴 가중치를 폐기.** `src/lib/fork-to-question.ts`
- D1 구조 ledger는 *질적* tilt(charity·vividness·caveat 배치·cost "녹이기"·verdict 어조)를 못 잡는다(R4-15 unbal 5/5 + spine 통과). 모델 도덕 prior는 규칙으로 제거 불가 → **누수하는 표면 자체를 없앤다.**
- **변경(권장):** value-fork에선 *무가중 폴 + crux*만 제시, 한쪽 cost "녹이기" 금지. 잔여 fork가 있으면 가드로 (a) swap-test(폴 swap해 두 번 생성, lean diff → 비대칭이면 평탄화) 또는 (b) charity/word-count/caveat parity lint.

**P1-2. 정체성/도덕 verdict를 contract로 수용 거부 + 부메랑 스캔.** `src/lib/decision-contract.ts`
- "나 나쁜 사람이냐" 류 정체성/도덕 verdict 프레이밍을 contract로 *수용 거부* — 결정으로 변환하거나 decline. 그리고 닫음 문장을 스캔해 *거부한 verdict의 연성 재발부*(R4-16·19·23에서 D3 통과한 boomerang)를 차단. `verification-is-not-a-chat` 불변 유지.

**P1-3. Current Bearing이 추천 tilt를 싣지 않게.** `src/lib/current-bearing.ts`, `CurrentBearingCard.tsx`
- user vs ai_surfaced shading은 옳으나 *불충분*. **기우는 bearing은 위장된 verdict다.** 6-field bearing의 폴을 엔진 charity 비대칭 없이 렌더하도록 규율 추가. `why_this_course`는 AI 귀속 접이식 유지(기존 A7), 단 tilt 금지.

**P1-4. Zero-Judgment Gate에 거울절(over-fire)을 명문화.** `CLAUDE.md`(이번 커밋에 포함)
- 현재 게이트는 "사용자를 판단하나"만 잡고 "*over-fire하나*"를 안 잡는다. **over-fire(평탄에 fork 제조 / 저-stakes 의례 / 닫힌 결정 재개방 / stay 정답인데 engagement 떠밀기)도 척추 위반**임을 신규 surface 체크리스트에 추가. 엔진뿐 아니라 *게이트*에서 거울절을 강제. (이건 빌더-facing engine 형태, signboard 아님 — 기존 규율 준수.)

### P2 — 정직성 보강 (불충분함을 알고 한다)

- **`ai_surfaced` provenance 플래그(CLAUDE.md A2)**: 여전히 *정직성*을 위해 할 가치 있음 — 단 라운드 4가 *안전 fix가 아님*을 증명했으니 그렇게 오인 금지. P0-2/P1-1 *뒤에* 보조로.
- **negative-control 회귀 스위트 상설화**: R4의 10 neg control + R1~R4의 대표 적대 케이스를 `src/lib/__tests__/`에 fixture로 박아, 엔진 프롬프트 변경 시 over-fire/tilt 회귀를 CI에서 잡는다. (self-play 금지 — 채점은 독립 rubric.)

### 아키텍처 결정 (founder 대리 판단, memory/philosophy 근거)

over-fire/under-fire가 dial이고 둘 다 못 만족시키므로 **선택이 필요**하다. 척추 문서(`ARGUS-FINAL-DIRECTION`: "지친 사용자가 첫 화면에서 act", "uncertainty는 작고 named")와 anti-Barnum thesis("process 0 압축")에 근거해 **under-fire를 디폴트로 고정**한다: 전제 하나를 명명하고 핸들을 돌려주는 절제된 표면, over-fire(fork 제조)는 배제, 더 깊이 원하면 사용자가 당긴다("바닥은 싸게, 천장은 깊게" — `MECHANISM` §4). 이 결정을 `ARGUS-FINAL-DIRECTION`에 amendment로 기록할 것(후속).

---

## 5. 우리 아키텍처에 거는 Decision Contract (settle 루프)

이 종합 자체가 가설이다. settle 루프를 우리 설계에 건다:

- **예측(predicate):** P0-1(디폴트 뒤집기) + P0-2(subtractive recognition) 적용 후, **negative-control 회귀 스위트에서 over-fire majority ≤ 1/10**, 그리고 적대 스위트에서 **asymmetric_steer majority가 P1-1 적용 후 절반 이하로** 떨어진다.
- **반증 조건:** P0/P1 적용 후에도 over-fire가 ≥ 4/10이거나 asymmetric_steer가 안 줄면 — (b)가 *튜닝으로도 못 푸는 깊이*라는 뜻이고, 그땐 "결정 엔진" 자체를 접고 *순수 기록·정산 도구*(watch/settle만)로 축소하는 더 급진적 pivot을 검토.
- **정산일:** P0 구현 후 라운드 4 방법론(엄격 5-vote + neg control)으로 재측정 = "라운드 5". 설계가 아니라 *부딪힘*이 판정한다.

> harbor 노트: 이 4라운드는 *항해*였다(설계가 아니라). 그리고 항해가 한 일은 정확히 harbor 철학이 약속한 것 — 종이 설계가 "닫혔다"고 한 엔진(`MECHANISM` §8 "설계는 여기서 닫혔다")의 구멍을, 부딪힘이 드러냈다. 다음 정직한 수는 더 정교한 엔진 설계가 아니라, *절제하는 표면*을 짓고 다시 부딪히는 것이다.
