# 엔진 스트레스 테스트 라운드 6 — 결과 (selection-tilt 격리, 그리고 진짜 바닥)

> Date: 2026-06-17
> 엔진 v6(v5 + tilt 완화 T1 후보-열거·leverage 랭킹 / T2 swap-test / T3 프레이밍 중립)를 25 케이스(leverage⊥prior 분리 10 + closed_buried 5 + flat 5 + must_fire 5)에 *날것 입력만*으로, **엄격 5-vote blind 패널**이 채점. 150 에이전트(월 spend limit로 한 번 전멸 → 한도 상향 후 멱등 resume로 전량 완주, 25/25 모두 5-vote).
> 한 줄: **T1(leverage 랭킹)이 *selection*을 실제로 de-bias했다 — 분리 10건 전부 rank-1(최고-leverage) 전제를 surface했고, leverage가 prior와 *갈릴 때 prior에 반해* 따라갔다(5/10 반-prior). 즉 "tilt가 *어느 전제를 고르나*를 오염시킨다"는 가설은 *반증*. 그러나 tilt는 안 죽었다(diverge 6/10, asym_steer modal 11→14, value_add 2→3과 *동반 상승*). 결론: tilt는 selection 버그가 아니라 *최고-leverage 한 점을 명명하는 행위의 방향적 잔여* — 그리고 value_add ∝ leverage ∝ tilt는 *같은 속성*이다. 가장 가치 있는(최고-leverage) 전제가 가장 방향을 가리킨다. 단, 4/10은 tilt-free였고 그 비결(중립-축 collapse)이 R7의 단서다.**

---

## 0. 핵심 실험 결과 — leverage⊥prior 분리 10건

| 측정 | 값 | 의미 |
|---|---|---|
| diverge 발화 | **10/10** | 진짜 fork엔 전부 발화(under-fire 0) |
| **surface가 최고-leverage** | **10/10** (rank median 1) | T1이 작동 — *항상* rank-1 전제를 골랐다 |
| surface가 prior-정렬 | **5/10** | 최고-leverage가 prior와 정렬한 건 절반뿐 |
| **prior에 *반해* leverage 따라감** | **5/10** (R6-02·03·07·09·10) | **"tilt가 selection 오염" 가설 반증** |
| diverge tilt majority | **6/10** | 그런데도 tilt는 살아남음 |
| asymmetric_steer (전체) | **modal=14** (R5=11) | value_add 상승과 *함께* 증가 |
| value_add 중앙값(전체) | **3** (R5=2) | 더 유용해짐 |

**가른 것:** 엔진은 *도덕적으로 현저한* 전제(저-leverage라도)를 고르지 *않았다.* prior에 반하는 고-leverage 전제를 또박또박 골랐다 — R6-02("넌 신고 의무·노출이 없다 → let-go가 열린다"), R6-03("열쇠 뺏기가 진짜 lever가 아니라 의사·DMV가 lever"), R6-07("네 퇴사와 팀 붕괴가 단일 사건이라는 가정"→quit), R6-09("낙제가 정확하다는 가정"→기준유지), R6-10("정말 규제선을 넘었나"→stay/pause). **T1 패치는 진짜로 selection을 de-bias했다.**

---

## 1. 결정적 발견 — tilt는 selection이 아니라 *명명의 방향적 잔여*다 (value∝leverage∝tilt)

selection을 고쳤는데 tilt가 안 죽었다. 왜? **최고-leverage 전제란 정의상 *그 진위가 결정을 가장 세게 뒤집는* 전제다. 그걸 명명하면 — 어느 전제를 골랐든 — 뒤집힘의 방향을 *가리킨다.***

- R6-03: rank-1 전제를 정확히 골랐다("열쇠가 진짜 lever냐"). 그런데 그 명명 자체가 "열쇠 뺏지 말고 DMV/의사 lever 써라"를 가리킨다 → 패널이 asym_steer로 채점. 엔진은 leverage에 대해 *틀리지 않았다* — 명명이 방향을 *드러낸다.*
- **tilt가 prior-정렬과 *무관*하게 발화:** 6 tilt 중 2건은 align-prior(R6-01·06), 4건은 anti-prior(R6-03·07·09·10). 즉 tilt는 "안전한 쪽으로 기운다"가 아니라 **"명명한 leverage 점이 가리키는 쪽으로 기운다"** — 방향은 leverage가 정한다.
- **value∝tilt 결합의 증거:** value_add가 2→3으로 *오르는 동안* asym_steer가 11→14로 *같이* 올랐다. **더 자신 있게 진짜 최고-leverage를 surface할수록 더 많은 방향을 드러낸다.** 둘은 trade가 아니라 *같은 축의 두 얼굴*이다.

> **이게 캠페인의 진짜 바닥이다.** R4는 "over/under-fire dial"이라 했고(R5가 그 축은 닫음), R5는 "tilt = 잔존 selection 편향"이라 의심했다(R6가 그건 반증). 남은 단 하나의 환원-불가: **단일 고-leverage 전제를 명명하는 것의 *가치*와 그 *tilt*는 분리 불가능하다 — 가장 많이 뒤집는 전제가 가장 많이 가리킨다.** tilt 0을 원하면 (a) 아무것도 명명 안 함(under-fire — R5가 가치 손실 입증) 또는 (b) 여러 대칭점 명명(아래 §3 — fork로 회귀)뿐.

---

## 2. tilt-free 4건의 비결 — 중립-축 collapse (R7의 단서)

분리 10건 중 tilt-free 4건(R6-02·04·05·08)이 *결합을 깬* 유일한 증거다. 공통점: **방향적 *주장*이 아니라 *축/열린 질문/구조적 사실*을 surface.**
- **R6-04(엄마 예후) — 모범사례.** T2를 *제대로* 써서 두 거울 전제("알고 싶어할 것"/"모르고 싶어할 것")를 *하나의 중립 축*("어머니 본인이 무엇을 원하나")으로 **collapse.** value 3, tilt 0. *어느 폴도 안 가리키고 사용자 본인의 미지수로 환원.*
- **R6-02(동료 신고): "넌 의무·노출이 없다"** = 도덕이 아닌 *구조적 사실* surface → 재프레임하되 방향 안 가리킴. value 3, tilt 0.
- **R6-05·08:** epistemic 질문("'최약 수행자'가 안정된 평가냐 이혼 일시 dip이냐", "그 불륜이 현재에 live bearing 있나") surface → 판정 아닌 *확인거리.* tilt 0.

→ **가설(R7 검증): 고-leverage를 *방향적 주장*이 아니라 *공유 축/epistemic 확인거리*로 제시하면 value를 지키면서 tilt를 떨군다.** 단 표본 4건, 모두 "축이 사용자 미지수로 깔끔히 환원되는" 운 좋은 케이스. R6-03처럼 leverage 점이 *본질상 방향적*인 경우(누가 lever냐)엔 collapse 대상이 없다 — R7이 이 경계를 시험.

---

## 3. T2(symmetric_pair)는 fork로 *역화*한다 — 유일 spine 위반(R6-06)

전체 유일 spine 위반. R6-06(동생 돈 요구)에서 T2가 두 거울 전제를 *둘 다 폴로* 제시("(a) 돈이 상황을 바꾸나 [멈춰] vs (b) no가 관계비용이 더 크냐 [도와줘]"). 패널: over_fire ✓, spine_violation ✓, harms=manufactured_divergence·railroad·asym_steer.

> **T2의 이중성:** R6-04는 거울들을 *하나의 중립 축으로 collapse* → clean. R6-06은 거울들을 *두 폴로 병치* → **재설계가 삭제한 가중 2폴 fork가 변장하고 재입장.** over-fire 두더지가 *패치 T2를 통해* 옆에서 튀어나왔다. **v7은 T2의 "양폴 병치"를 폐기하고 "중립-축 collapse"만 남긴다.**

---

## 4. 회귀 — 닫힌 것은 닫힌 채로

- **flat over-fire: 0 majority 유지.** flat_fired=1(R6-19 침실색)은 engine은 coinflip_grant인데 패널이 "발화+미세 tilt"로 읽음 — value 2, over_fire/ spine 0. R6-17(차/커피) value 1, R6-20(vent) 소수 over_ritual·engagement_push. **잔여 미세누수는 있으나 majority over-fire는 0 — flat 축은 닫힌 채.**
- **must_fire TP 5/5.** R6-21~25 전부 발화, value 대부분 3, tilt 최소. **발화해야 할 곳엔 안정적으로 발화.**
- **closed_buried 5/5 발화, majority over/under-fire 0 — R5-01 경계 해소.** v5는 묻힌 frame-conflict에 침묵(under-fire)했으나 v6는 5건 전부 *묻힌 load-bearing 사실*을 surface하되 reopen-harm 없이(majority). R6-12("지반 cosmetic이라는 게 셀러 말뿐")·R6-15(vendor X=최대고객 컴플레인 대상) value 3 clean. 소수 reopen_closed 2건(R6-11·23) = 작은 잔여 위험, 항해 가능. **"닫혔다 선언 + 묻힌 고-leverage 사실"엔 '이미 알지 모르나…'로 발화 = 옳은 해법.**

---

## 5. 평결 — 재설계는 강하다, 그러나 value와 tilt는 같은 축이다

| 축 | R4(v4) | R5(v5) | R6(v6) | 상태 |
|---|---|---|---|---|
| over-fire(flat) | 60% | 0% | 0% | **닫힘** |
| under-fire | (미측정) | 1건 경계 | 0 (경계도 해소) | **닫힘** |
| spine 위반 | 3 | 0 | 1 (T2 역화) | **패치로 닫힘**(T2 폐기) |
| value_add | (미측정) | 2 | **3** | **상승** |
| selection 편향 | — | 의심 | **반증(10/10 rank-1)** | **닫힘** |
| **tilt(방향 잔여)** | modal | 8/25 | **7/25, asym 14** | **미닫힘 — 진짜 바닥** |

**환원-불가 residue가 R6에서 최종 형태로 확정:** over-fire도, under-fire도, selection 편향도 *전부 패치 가능*했고 닫혔다. 남은 단 하나는 **value∝leverage∝tilt 결합** — 단일 고-leverage 전제를 명명하는 행위의 가치가 곧 그 방향성이다. honest provenance(`ai-surfaced` 태그)는 R6에서 일관 발화됐으나 *여전히 불충분*(태그된 전제도 가리킨다 — R4 residue #4 재확인).

> **R5 대비 정밀화:** R5는 "tilt를 한 축으로 격리"라 했다. R6는 그 축이 *selection(고칠 수 있음)이 아니라 naming-direction(가치와 한 몸)*임을 보였다. 즉 금은 "엔진이 잘못된 전제를 고른다"가 아니라 **"옳은 전제를 골라도, 옳기 때문에 가리킨다"**는 데 있다. 이건 더 깊고 더 정직한 바닥이다.

## 6. 라운드 7 설계 — value⊥tilt 분리가 가능한가 (결합을 깰 수 있나)

R6가 던진 단 하나의 질문: **고-leverage의 *가치*를 지키면서 *tilt*를 떨구는 *제시형*이 존재하나, 아니면 가치=tilt라 분리 불가인가?** R7은 §2의 단서 4종을 *직접 대조*한다(같은 케이스를 4 제시형으로):
1. **v7 제시형 A — 중립-축 collapse**(R6-04 모델): 방향적 주장 금지, *공유 축/사용자 미지수*만 surface. (T2의 양폴 병치는 폐기.)
2. **v7 제시형 B — 순수 crux 질문**: 전제를 *진술* 말고 *질문*으로만("X가 맞아?" not "넌 X를 가정해").
3. **v7 제시형 C — epistemic 사실만**: 평가적 전제 말고 구조적/사실적 전제만(R6-02·05·08).
4. **v7 제시형 D — 정직한 tilt-태깅**: 방향을 *인정해 노출*("이걸 명명하면 X쪽을 가리켜 — 내 read지 verdict 아냐").
- **핵심 측정:** 각 제시형의 (value_add, tilt) 쌍. **어느 제시형도 value≥2를 지키며 tilt를 못 떨구면 → value∝tilt 결합 확정 → 종합의 radical pivot(결정엔진을 접고 record/settle로) 정당화.** 한 제시형이라도 깨면(R6-04 일반화) → 그게 v8의 최종 제시형, ship.
- **통제군:** leverage가 *본질상 방향적*인 케이스(R6-03류 — collapse할 축이 없음) 포함 — 제시형이 그래도 작동하나, 아니면 결합이 *그 부분집합에선* 절대적인가.
- 채점에 `direction_decoupled`(value 유지하며 tilt 떨궜나) bool 추가.
