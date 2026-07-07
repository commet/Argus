# 엔진 스트레스 테스트 라운드 7 — 결과 (value⊥tilt 분리는 가능한가)

> Date: 2026-06-17
> 같은 5 어려운 분리 케이스를 5 제시형(baseline / axis_collapse / crux_question / epistemic_fact / tilt_tagged)으로 = 25 셀, **엄격 5-vote blind 패널**이 (value_add, tilt, crux 보존, over/under-fire, spine) 채점. 150 에이전트, 무실패, 25/25 전부 5-vote.
> 한 줄: **value∝tilt 결합은 *강하나 절대적이진 않다* — 어느 제시형도 다수 decouple 못 했고(전체 3/25=12%), best는 crux_question(2/5 decoupled, tilt 5/5→3/5, value 유지). 결정적 부작용 둘: tilt_tagged(방향을 정직히 태깅)는 *spine 위반 4건* — 면책해도 verdict는 verdict다; epistemic_fact(사실만)는 tilt 5/5 유지 + value 하락 — 내용을 비워도 방향은 안 비워진다. 결론: tilt 0의 깨끗한 제시형은 없다. *덜 기우는* 최선은 *방향적 진술이 아니라 맨-crux-질문*이고, 잔여 tilt는 제품-수준에서 *한계로 명명*할 것이지 출력마다 면책으로 세탁하면 안 된다.**

---

## 0. 핵심 표 — 제시형 × (value, tilt)

| 제시형 | value 중앙(평균) | tilt | crux 보존 | **decoupled** | over/under | spine |
|---|---|---|---|---|---|---|
| baseline (v6 방향적 진술) | 2 (2.4) | **5/5** | 5/5 | **0/5** | 0/0 | 0 |
| axis_collapse (중립 축) | 2 (2.4) | 4/5 | 5/5 | 1/5 | 0/0 | 0 |
| **crux_question (맨 질문)** | 2 (**2.4**) | **3/5** | 5/5 | **2/5** | 0/0 | **0** |
| epistemic_fact (사실만) | 2 (2.0) | **5/5** | 5/5 | 0/5 | 0/0 | 0 |
| tilt_tagged (방향 태깅) | 2 (2.0) | 5/5 | 5/5 | 0/5 | 1/0 | **4** |

decoupled = value_add≥2 **그리고** not majority-tilt. decoupled 셀 단 3개: **C1+axis_collapse, C2+crux_question, C4+crux_question.**

---

## 1. 결정적 발견 ① — 결합은 강하나 절대적이진 않다 (best = 맨-crux-질문)

- **어느 제시형도 다수 decouple 못 함.** 최고 crux_question 2/5. 전체 3/25(12%). → **value∝tilt는 *대체로* 깨지지 않는다** — 같은 crux를 어떻게 포장해도 보통 기운다.
- **그러나 절대도 아니다 — crux_question이 부분적으로 깬다.** 방향적 *진술*("넌 X를 가정해")을 *질문*("X가 실제로 어떤지가 결정을 가른다 — 어느 쪽이야?")으로 바꾸면 tilt 5/5→3/5로 떨어지고 *value는 유지*(평균 2.4, crux 보존 5/5, over/under/spine 0). **진술은 가리키고, 질문은 덜 가리킨다 — 단 crux는 똑같이 보존.** baseline은 *한 번도* decouple 못 함(0/5)이나 value는 최고(2.4) = 가장 유용하고 가장 기운다(value∝tilt 직접 예시).

## 2. 결정적 발견 ② — 방향을 *정직히 태깅*하면 더 나빠진다 (tilt_tagged spine 4건)

tilt_tagged(방향을 명시 노출 + "내 read지 verdict 아냐" 면책)가 **유일하게 spine 위반을 낸 제시형 — 4/5(C1·C2·C4·C5).** 패널은 면책에도 불구하고 *방향을 진술한 것 자체*를 verdict로 읽었다. C4는 over_fire까지.

> **이게 R4 boomerang·"honest provenance 불충분"의 최종 형태다:** **verdict는 면책으로 세탁되지 않는다.** "이건 X쪽으로 기울어, 근데 네 답은 아냐"는 — 사용자에겐 — 그냥 "X쪽으로 기울어"다. 방향을 *말하는 순간* 판정이고, 단서를 붙여도 판정이다. **출력마다 tilt를 태깅하는 설계(Falsification의 ai_surfaced 류를 방향까지 확장하는 것)는 정직해 보이나 spine을 *더* 위반한다.** 정직성은 *제품 수준의 1회 고지*("Argus는 crux를 짚고, 옅은 lean이 남을 수 있다")여야지, *출력마다의 verdict-면책*이면 안 된다.

## 3. 결정적 발견 ③ — 내용을 비워도 방향은 안 비워진다 (epistemic_fact 실패)

epistemic_fact(평가·조언 제거, 구조적 사실만)는 tilt 5/5 그대로 + value 2.4→2.0 하락. **"어느 사실을 surface하나"의 선택이 이미 방향이다** — 평가어를 빼도 *고른 미지수*가 가리킨다(R6 §1의 재확인). 게다가 사실로만 좁히면 value(crux의 날카로움)가 깎인다. **중립화는 tilt를 못 줄이고 value만 깎는다 = Pareto 열위.** axis_collapse(중립 축)도 C1(깨끗한 중립 축 존재)에서만 통하고(1/5) 나머진 tilt 유지 — *중립 축이 실재할 때만* 부분 작동.

## 4. 통제군 — 본질적 방향성 케이스가 *오히려* 더 decouple됨(반직관)

decoupled: directional(C2·C4) 2/10 vs neutral(C1·C3·C5) 1/15. **본질상 방향적인 결정(열쇠·폭로)에서 crux_question이 둘 다 decouple**했고, 중립-축 케이스에선 axis_collapse가 C1만. 해석: 본질 방향적 결정은 crux가 *경험적 미지수*("다른 방법으로 정말 막을 수 있나", "정말 정의된 선을 넘었나")라 *질문화*하면 사용자 확인거리로 깨끗이 환원된다. 반면 "중립 축" 케이스의 crux는 *가치/해석*이라 질문화해도 그 가치 쪽으로 샌다(C3·C5는 crux_question도 tilt). **→ tilt-free 가능성은 crux가 *경험적으로 확인 가능*하냐에 달렸지, 제시형 단독이 아니다.**

## 5. 평결 — spine의 거울절은 *점근선*이다 (도달 불가, 그러나 best-form은 출하 가능)

- **value∝tilt 결합은 환원-불가의 *바닥*으로 확정.** tuning으로 tilt 0에 못 간다(best 12% decouple). 단 *severity는 낮다* — baseline·axis·crux·epistemic 전부 spine 0, over/under 0, harm은 low/med asym_steer(체계적 옅은 lean). 재앙이 아니라 *옅고 일관된 기울기*.
- **best 출하형 = crux_question.** Pareto 최선: tilt 최소(3/5), value 유지(2.4, crux 5/5), spine/over/under 0. **방향적 진술(baseline) 폐기, 방향 태깅(tilt_tagged) 절대 금지(spine 악화), 사실-만(epistemic) 무익.**
- **정직 포지션 전환:** 거울절("개입·판단 방향에 zero judgment")은 *달성 상태가 아니라 점근선*이다. 그러므로 Argus의 정직한 자기서술은 "우린 판단 안 해"가 *아니라* **"우린 결정이 도는 단 하나의 질문을 짚는다 — 거기 옅은 lean이 남을 수 있고, 그건 출력마다 면책으로 가리지 않고 제품 수준에서 한계로 밝힌다."** (anti-Barnum thesis와 정합: process는 압축하되 specificity·정직은 압축 안 함.)

## 6. 라운드 8 설계 (closing — head-to-head + 최종 평결)

R8은 닫는 라운드: **v8(최종형) = v6의 under-fire 디폴트 + T1 leverage-selection + *crux_question 발화형* − T2-pair − tilt_tagged**를, **v4(원래 over-fire 엔진)와 *같은 케이스*로 head-to-head.**
1. **누적 배터리 ~20 케이스** 전 family(flat neg-control / must-fire / tilt-diverge / closed-buried / delegation)를 v4와 v8 *양쪽*에 — 동일 입력 대조.
2. **엄격 4~5-vote 패널**이 양쪽 출력 채점: total harm, over-fire, tilt, value_add, spine.
3. **결정적 측정:** v4 대비 v8의 *total harm 감소량*. R4 기록(v4: over-fire 60%, harm 72%, spine 3)과 동일 케이스에서 v8이 얼마나 내리나. **harm이 보존되면(그냥 옮겨감) → (b′) pivot 정당화. harm이 크게 내리고 value 유지면 → (c) best-form 출하 + 거울절은 명시 한계로.**
4. 최종 종합(`STRESS-SYNTHESIS-rounds5-8`)에 R5~8을 R1~4 위에 얹어 Argus 코드/아키텍처 수정안을 *갱신*(crux_question 발화형, tilt_tagged 금지, 제품-수준 한계 고지, settle 예측 재등록).
