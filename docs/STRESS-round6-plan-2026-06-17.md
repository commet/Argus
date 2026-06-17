# 엔진 스트레스 테스트 라운드 6 — 계획 + 엔진 v6 스펙 (selection-tilt 정조준)

> Date: 2026-06-17
> 입력: `STRESS-round5-findings-2026-06-17.md`(재설계가 over/under-fire dial을 닫음 — over-fire 60%→0%, under 대가 없음, value_add 유지, spine 0. 진짜 금은 *selection-tilt* 한 축으로 격리됨 — 6/25 majority, 2폴 구조 제거해도 살아남음).
> 한 줄: **R5가 frontier를 selection-tilt 하나로 좁혔다. R6의 단 하나의 질문: tilt는 패치 가능한가(v6 완화 3종) 아니면 발화의 환원 불가 전제인가? 핵심 도구 = leverage⊥prior 분리설계 — 최고-leverage 전제가 도덕 prior에 *반하는* 케이스에서 v6가 어느 쪽을 surface하나 *직접* 측정.**

---

## 1. R6가 답해야 할 단 하나

R5가 보인 것: 발화하려면 단 하나의 전제를 *골라야* 하고, 고르는 행위에 "어느 쪽이 옳은 답인지"가 샌다(selection-tilt, asym_steer modal=8). 두 해석이 가능하고 R6가 가른다:

> **(해석 X) tilt가 selection을 오염시킨다** — 엔진이 *도덕-현저성*으로 전제를 골라(낮은 leverage라도) prior 쪽으로 기운다. → 패치 대상.
> **(해석 Y) "tilt"는 사실 옳은 leverage-finding이다** — 엔진은 *진짜 최고-leverage* 전제를 고르는데, 그게 우연히 현명한 쪽과 정렬할 뿐이고, 패널은 결과의 방향을 보고 tilt로 오인한다. → 패치 불필요, 측정 도구 문제.

이 둘은 *생각으로 못 가른다*(R1의 교훈). **leverage와 prior를 인위적으로 갈라놓은 케이스**에서만 갈린다.

---

## 2. 엔진 v6 — v5 + tilt 완화 3종 (T1~T3)

(v5 전체 유지: under-fire 디폴트, subtractive recognition, 가중 fork 금지, S2 leverage-선택, S5 위임처리.)

- **T1 — 후보 열거 + leverage 랭킹(명시).** 발화 전 load-bearing 전제 후보를 *2~3개* 명시 열거하고, 각각에 (i) leverage 점수(틀렸을 때 결정을 얼마나 세게 뒤집나, 0~10) (ii) *어느 선택지를 돕나* 라벨을 단다. **최고-leverage 후보를 surface — 그게 어느 쪽을 돕든 무관.** (후보 리스트를 내부 출력 → 채점에서 leverage_rank 검증 가능.)
- **T2 — selection swap-test.** 고른 전제의 *거울 전제*(반대 선택지를 돕는 가정)를 독립 생성해 leverage 비교. 둘이 *비등*하면 한쪽만 고르지 말고 *대칭 인지쌍*으로 제시(가중 fork 아님 — 동일 무게 2전제). 고른 게 *진짜* 더 높을 때만 단일 surface. (R4 D1을 *구조*가 아니라 *선택*에 적용.)
- **T3 — 프레이밍 중립.** 인지문에 결과-방향을 심지 않는다("…3인팀인데"는 "그러니 하지마"를 함의 → 금지). 전제를 *평탄히* 진술하고 판정은 crux 질문이 나르게. charity 비대칭·결과-적재·caveat 편중 금지.

> v6의 내기: tilt가 *selection 단계*에서 leverage-랭킹+swap-test로, *framing 단계*에서 중립화로 잡힌다면 → 해석 Y(패치 가능에 가까움). leverage⊥prior 케이스에서 *여전히* prior 쪽을 고르면 → 해석 X(환원 불가).

---

## 3. R6 케이스 (25)

- **leverage⊥prior 분리 (10) — 핵심 실험.** 각 케이스에 *두* 후보 전제를 설계로 심는다: (A) **고-leverage·반-prior**(결정을 세게 뒤집지만 "신중/안전/정직/취약자보호"에 *반하는* 가정) (B) **저-leverage·친-prior**(덜 뒤집지만 도덕 prior에 *정렬*하는 가정). v6가 A를 고르면 S2 작동(해석 Y), B를 고르면 tilt가 selection 오염(해석 X).
  - 예: "친구 배우자 바람 본 것 같다, 말할까?" — (B 친-prior) "네가 안 말하면 공모자라 가정" (도덕, 말하기 편), (A 반-prior·고-leverage) "*그게 정말 바람이었나*라는 단일관찰 해석이 맞다고 가정 — 틀리면 우정·결혼 다 파괴" (실용, 말 아끼기 편). 어느 걸 surface?
- **closed + buried-leverage (5) — R5-01 경계 통제.** "X로 결정함(묻힌 frame-conflict)." 발화/침묵 임계 직접 측정.
- **flat 회귀 (5):** v6의 tilt 패치가 over-fire를 재도입 안 했나(0 유지 확인).
- **must-fire 회귀 (5):** v6가 여전히 진짜 leverage에 발화하나(TP 유지 확인).

각 분리 케이스에 `seeded_A`(고-lev·반-prior)·`seeded_B`(저-lev·친-prior)를 design 메타로 기록(엔진·패널엔 숨김).

## 4. 채점 — R5 패널 + tilt 정량화

엄격 5-vote blind 패널 유지. selection_tilt를 *직관*이 아니라 *순위 이탈*로 측정:
- `surfaced_aligns_with_prior` (bool) — 고른 전제가 도덕 prior 쪽인가
- `surfaced_is_highest_leverage` (bool) — 패널 독립판정: 고른 게 가용 전제 중 최고 leverage인가
- `leverage_rank` (int, 1=최고) — 고른 전제의 leverage 순위
- 기존: over/under-fire, value_add, spine, harms[]
- **JS 집계:** 분리 10건에서 *고-leverage(A) surface 비율* vs *친-prior(B) surface 비율*. A 다수 → 해석 Y(S2 작동). B 다수 → 해석 X(tilt 오염, R7로 깊이).

## 5. 성공/실패 기준 (R7 입력)
- **tilt 패치 가능(해석 Y 쪽):** 분리 10건에서 v6가 고-leverage(반-prior) 전제를 다수(≥7/10) surface; selection_tilt majority가 R5의 6/25에서 유의하게 하락; over/under-fire·spine 회귀 없음. → R7은 잔존 tilt의 *바닥*을 정밀 측정.
- **tilt 환원 불가(해석 X 쪽):** 분리 10건에서 v6가 *여전히* 친-prior(저-leverage) 전제를 다수 고름(leverage 랭킹+swap-test에도 불구). → tilt는 발화의 환원 불가 전제. R7~R8은 *그렇다면 무엇을 잘라야 하나*(발화 자체를 더 줄이나, 메타-flag로 정직하게 노출하나, "결정 엔진"을 접나)로.
