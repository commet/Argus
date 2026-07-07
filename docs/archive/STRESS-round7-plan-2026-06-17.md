# 엔진 스트레스 테스트 라운드 7 — 계획 (value⊥tilt 분리 실험)

> Date: 2026-06-17
> 입력: `STRESS-round6-findings-2026-06-17.md`(T1이 selection을 de-bias함 — "tilt가 어느 전제를 고르나 오염" 반증; 그러나 tilt는 *명명의 방향적 잔여*로 살아남음 — value∝leverage∝tilt 결합. tilt-free 4건의 비결 = 중립-축 collapse).
> 한 줄: **R6의 단 하나의 질문을 *직접* 부딪힌다: 고-leverage의 가치를 지키며 tilt를 떨구는 *제시형*이 있나, 아니면 가치=tilt라 분리 불가인가? 같은 5 케이스를 5 제시형으로 돌리는 5×5 factorial로 (value_add, tilt) 쌍을 측정. 어느 제시형도 못 깨면 → 종합의 radical pivot 정당화. 한 제시형이라도 깨면 → 그게 v8 최종형.**

---

## 1. 설계 — 5 base 케이스 × 5 제시형 = 25 셀

같은 의사결정에 *제시형 변수만* 바꿔 (value, tilt)를 비교(within-subjects). base 5건은 R6에서 *전부 tilt를 낸* 어려운 분리 케이스:
- **C1** = 친구 배우자 바람(중립 축 존재: "네 read가 맞나")
- **C2** = 아버지 운전 열쇠 (**본질상 방향적 통제군** — "누가 진짜 lever냐"가 본질상 열쇠-뺏기 반대를 가리킴; collapse할 중립 축이 약함)
- **C3** = 퇴사 vs 팀붕괴
- **C4** = 안전/규제 폭로
- **C5** = 낙제생 성적

5 제시형(엔진은 T1으로 최고-leverage 전제를 찾되, *지정된 형식*으로만 렌더):
1. **baseline** — v6 디폴트(방향적 인지 *진술*: "넌 X를 가정해 — 맞아?").
2. **axis_collapse** — 방향적 주장 금지; 결정이 도는 *중립 축/사용자 본인의 미지수*만 surface, 어느 폴도 안 가리킴(R6-04 모델).
3. **crux_question** — *질문*으로만; 무엇을 가정하는지 말하지 않고, 답이 결정을 뒤집는 단일 질문만 중립 표현.
4. **epistemic_fact** — *구조적/사실적 미지수*만; 평가·조언 내용 전부 제거. "아직 모르는 것"을 말하지 "해야 할 것"을 말하지 않음.
5. **tilt_tagged** — 최고-leverage 전제를 명명 *하고* 그게 가리키는 방향을 *명시 태깅 + 면책*("이걸 명명하면 X쪽으로 기울어 — 내 read지 네 답 아냐").

## 2. 채점 — 엄격 5-vote, 제시형별 (value, tilt)

각 셀의 user-facing 출력만 보고 blind 패널이: `value_add`(0~3) / `selection_tilt{present,direction}` / `over_fire` / `under_fire` / `spine_violation` / `crux_preserved`(고-leverage crux가 살아 있나 — value의 직접 측정) / `one_line`.

**JS 집계(제시형별, 5 케이스 평균):** value_add 중앙값, tilt majority 비율, **decoupled 비율**(= value_add≥2 *그리고* not tilt인 셀 수). + C2(방향적 통제군) 단독 분해 — 결합이 *그 부분집합에선* 절대적인가.

## 3. 성공/실패 (R8 입력)
- **결합 깨짐(분리 가능):** 어떤 제시형이 *5 케이스 중 다수*에서 value_add≥2 & tilt-free(decoupled). → 그 제시형이 v8 후보, R8이 전 배터리로 확정.
- **결합 절대(분리 불가):** 모든 제시형이 trade만 함(tilt 떨구면 value도 떨어지고, value 지키면 tilt 남음). 특히 baseline 대비 *어느 것도 Pareto 개선 못 함*. → **value∝tilt 확정** → 종합의 radical pivot(결정엔진→record/settle) 정당화, R8은 그 pivot의 비용/형태를 부딪힘.
- C2류(본질 방향적)에서만 결합 절대면 → *부분적 분리*(중립 축 있는 케이스만 ship, 본질 방향적은 발화 안 함)라는 제3안.
