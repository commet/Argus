# 라운드 12 — 계획 (플러그인 하드닝 시작: *literal* v2.6 두뇌)

> Date: 2026-06-17
> 방향 전환(founder): webapp↔plugin 일치 *전에* 플러그인 두뇌부터 단단하게. R1~8은 추상 사양, R10은 webapp 코드를 시험했고 — **플러그인의 *실제* SKILL.md 두뇌는 미검증.** R12부터 그걸 부딪힌다.
> 한 줄: **플러그인 v2.6 clarify의 *literal* 판단 로직(§1.7 request-type 게이트 + rule 1b frame_status + density + §3.5 probe-skip)을 그대로 엔진으로, R9 family 전반 30 케이스에 엄격 blind 패널로 부딪혀 — 진짜 깨지는 곳 + 구체 SKILL.md 수정안. 오늘 라운드 반복으로 "수백 케이스" 누적. 목표는 "완벽"(점근선이라 불가)이 아니라 "쓸만하게 안전+가치, 한계 명명".**

## 1. 시험 대상 = 진짜 두뇌
엔진 에이전트가 plugin clarify의 *실제* 규칙을 그대로 따른다(추상 v-스펙 아님): step-0 4분류(open/validation/vent/info)+readiness, frame_status flat/load_bearing 레버리지 테스트, decision_density low-gate, flat이면 probe 스킵. **플러그인에 *없는* 것(위기 분류기·patterns·persona)도 일부러 안 넣어 — 그 빈틈이 실제로 harm 나는지 본다**(R11: 위기는 베이스 모델이 막을 수 있음 — literal 두뇌에서 재확인).

## 2. 케이스 30 (R9 family 전반)
flat(over-fire) 5 · must_fire 4 · tilt_trap 4 · step-0(validation/vent/info) 4 · closed_buried 3 · delegation 3 · crisis 4 · resistance(저항/회피) 3.

## 3. 채점 (엄격 4-vote blind)
출력만 보고: over_fire / under_fire / selection_tilt / crisis_handling / spine_violation / value_add / which_family_failed / one_line. + design_label로 family별 집계.

## 4. 산출 + 반복
family별 harm율 + 상위 실패 + **구체 SKILL.md 수정안**. R13+에서 수정 적용 후 재측정(literal 두뇌가 실제로 나아지나). settle/patterns/persona 등 *다른 스킬* 두뇌는 후속 라운드.

## 5. 모니터 사전 고려 (가벼운 체크)
플러그인이 남기는 기록(session/analysis/ledger.jsonl)이 *나중 webapp 뷰가 필요로 할 모양*인지 1줄 점검 — 스키마 안정성(연동 깨짐 방지).
