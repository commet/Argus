# 엔진 스트레스 테스트 라운드 1 — 결과

> Date: 2026-06-16
> 메타튜닝 결정 엔진(`MECHANISM-frame-and-fork-2026-06-16.md`)을 24개 적대적 케이스에 부딪힌
> 워크플로 결과(25 에이전트, 각 케이스가 어디서 깨지는지 자기보고 → 아키텍처 패치로 종합).
> 한 줄: **아키텍처는 버티지 못했다. 그리고 그게 라운드 1의 성과다.**

## 숫자

96개 phase 판정 중 **broke 30, strained 58, worked 8.** 24건 중 23건이 어딘가 broke, 21건 high-severity.

| phase | worked | strained | broke |
|---|---|---|---|
| frame-check | **0** | 18 | 6 |
| provenance | **0** | 15 | 9 |
| fork / branch-test | 5 | 11 | 8 |
| convergence | 3 | 14 | 7 |

**결정적 신호:** 엔진이 "제일 먼저, 제일 중요"라고 선언한 두 단계(frame-check, provenance)가 **한 번도 깨끗하게 작동하지 않았다.** worked 8건은 거의 fork/convergence의 기계적 정확성이고, 그조차 위에서 나쁜 frame을 받으면 오염됐다(garbage-in). 결함은 우연한 버그가 아니라 *척추의 시그니처 무브(단일 가정 surface)에서 직접* 나온다.

## 6개 실패 클러스터 (빈도 × severity 순)

1. **C1 (P0, 최악, 9건) — provenance가 융합 문장을 못 쪼갠다.** 3-bucket은 *화자* 단위로 정렬하는데, 한 문장 안에서 "관찰된 사실 + 해석/인과/예측"이 융합되면 쪼갤 수단이 없다. 그래서 "trust your facts"가 *정작 제일 검증이 필요한 절반*을 면제한다. 예: "이탈 고객 3명이 'no mobile'이라 적음" = 관찰(적었다) + 인과(그래서 떠났다)의 융합인데 통째로 trust.

2. **C2 (P0, 8건) — branch-test가 user의 altitude/선택지를 상속한다.** frame을 *검증*해야 할 단계가 frame을 *추인*한다. user가 준 이분법 안에서만 divergence를 보니 숨은 제3안을 파괴. 예: "현금 아끼기 vs 쓰기"로 보면 real fork지만 "성장 재개"라는 목표 고도에서 보면 둘 다 같은 벽.

3. **C3 (P0, 7건) — convergence가 치환된/날조된 답으로 과수렴한다.** 측정 가능한 변수로 좁히는 게 *닫힘처럼 느껴지지만* 다른 질문에 답한 것. false closure가 곧 세이렌. 예: "이 돈이 뭘 위한 거지?"라는 목표 공백에 default-assume이 목적을 *날조*해 닫음.

4. **C4 (P0, 4건) — frame-check가 본질적/정체성 내용을 "진짜 결정"으로 환원해 삭제한다.** "곁에 있고 싶다"(본질적 관계재)를 "케어를 어떻게 보장하나"(물류)로 강등. 비가역성의 유일한 근거를 지움. "나는 hack이 된다"는 정체성을 challengeable 가정으로 retag.

5. **C5 (P0/P1, 4건) — frame-check 앞에 step-0 게이트가 없다.** *무엇을* 판단할지엔 max generation, *판단할지 말지*엔 zero judgment. 우산 결정에 3-bucket 의례(비용 > stakes), 이미 닫힌 결정을 재개방(validation 요청 오인), 3개월 미결 회피를 데드라인으로 강화.

6. **C6 (P1, 4~5건) — Problem-1 라우팅이 2-bin뿐.** findable→measure / user-held→ask 사이 빈칸: findable-but-user-custodied, other-held, contaminated-source, time-revealed.

## 패치 (→ v2 후보)

- **C1:** provenance를 *화자*가 아니라 *진술 내용* 단위로. trust 전 content-test — 타인 행동 예측·인용된 제3자 판단·인과 귀속(because/그래서)을 포함하면 *말해졌다는 것*은 trust, *주장 내용*은 bucket B로. connective word pre-pass.
- **C1 보강:** 4번째 bucket — user-stated VALUE/WANT. 구성적 선(본질 가치)을 진단(C)에서 분리, fact처럼 trust하되 surface-as-checkable 금지.
- **C2:** branch-test를 *목표 고도*에서. user의 success metric 복원 후 각 branch를 목표까지 forward-simulate, 목표에서 갈릴 때만 real fork. + option-space completeness 게이트(숨은 제3안 탐색).
- **C3:** convergence 앞 necessary-but-not-sufficient 게이트("이 수치 하나로 결정이 뒤집히나?") + carried-not-closed 태깅 + I-don't-know TRIAGE(missing-input/user-custodied/goal-gap, default-assume 금지).
- **C4:** intrinsic-vs-instrumental 게이트. 본질 가치를 가진 X는 기능적 reframe을 primary로 금지, literal want와 나란히. 정체성-구성 변수면 "don't check the self, condition on it."
- **C5:** step-0 pre-gate 분류기 — STAKES(낮으면 1줄 답으로 붕괴), REQUEST-TYPE(validation이면 닫힌 결정 존중), RESISTANCE(장기 미결+무신규정보면 분기 금지, 저항 자체를 surface).
- **C6:** Problem-1에 bin 추가 + diagnostic 도메인 base-rate injector.

## 가장 중요한 메타 발견 — 규칙들이 *서로 충돌*한다

패치 6개를 더한다고 끝이 아니다. 라운드 1은 규칙들이 *독립이 아니라 서로 잠근다*는 걸 드러냈다.

- **convergence vs provenance-C:** case 7(죄책감)에서 convergence는 "non-closing tangent니 폐기"라 하고 provenance-C는 "중심 frame이니 surface"라 한다. *정반대 명령.*
- **anti-dead-end vs zero-judgment:** case 22(pure preference)에서 "항상 닫아라"와 "절대 대신 결정 마라"가 *상호 배타.*

→ 그래서 v2는 규칙 추가만이 아니라 **우선순위/중재(precedence) 층**이 필요하다. 어떤 규칙이 어떤 규칙을 이기는지. 이건 패치가 아니라 아키텍처 변경.

## 놀란 점 / 버틴 것

- **유능함이 무기가 된다.** 실패의 일부는 능력 *부족*이 아니라 *오용*. sunk-cost를 잘 알아서 회피를 무장시키고, de-escalation을 지혜처럼 해서 진짜 데드라인에 늑대 울음.
- **convergence 기계는 견고하다 — 단 좋은 frame 위에서만.** "good convergence on a bad frame ships the blindspot faster." 나쁜 입력을 *더 빨리* 배달한다.
- **fake-fork 붕괴 로직은 신뢰할 만하다.** 단 fake를 찾고도 *진짜* 발산 축을 재탐색하지 않는다.
- **validation-seeking은 모든 phase가 broke.** 정직한 출구가 구조적으로 없다.

## 열린 질문 (정직하게)

frame-check + provenance가 0/24라는 건 두 가지로 읽힌다. (a) **패치 가능** — 위 6패치 + precedence 층이 고친다. (b) **척추에 금** — "단일 가정 surface" 패러다임이 진짜 messy 결정엔 너무 brittle하다. **이건 생각으로 못 가른다.** 패치를 적용하고 라운드 2를 돌려서, frame/provenance가 0에서 벗어나면 (a), 여전히 깨지면 (b). 우리 자신의 아키텍처에 settle 루프를 거는 것.

## 라운드 2 설계

- P0 클러스터(C1 융합문, C2 altitude 상속)에 볼륨 집중 — 각 ~30 변형, 패치 전후 *탐지율* 측정.
- 케이스에 trap을 pre-annotate(fused statement / hidden third option / intrinsic good / closed decision / relayed prediction)해서 라벨된 detection-rate.
- per-phase 라벨을 넘어 *final-output harm* 측정(실제 출력이 railroad했나, 본질 가치를 지웠나, 닫힌 결정을 재개방했나).
