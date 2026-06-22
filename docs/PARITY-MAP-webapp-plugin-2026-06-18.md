# 웹앱 ↔ 플러그인 완전 대응 지도 (2026-06-18)

> 두 표면의 *일치도/관계*를 코드를 직접 읽어 작성. 재드리프트 방지(단일원천화)의 기반 + "한쪽에만 있는 의도적 킥" vs "실수로 어긋난 것" 분리.
> 한 줄: **하나의 철학을 두 독립 구현(webapp = TS+LLM-API / plugin = 마크다운 SKILL). 런타임 공유는 probe-prompts 하나뿐. 플러그인이 under-fire 판단에서 앞서고, *웹앱의 매칭 게이트(judgment-gates.ts/crisis-gate.ts)는 포팅됐으나 연결 안 된 DEAD CODE* — R19~23 웹앱 개선은 프롬프트(STEP 0)로 한 것이지 그 코드가 작동한 게 아님. ~11개 공유 판단이 단일원천+parity 필요. overreach/flinch 킥은 의도적 webapp-only(척추-호환 → 플러그인 포팅 후보).**

## 분류 카운트
공유-일치 **11** · 어긋남(drifted) **9** · 웹앱만 **8** · 플러그인만 **2**

## 갱신 로그 (2026-06-18, R27 + 재드리프트 작업)
- **닫힌 드리프트:** 위기-우선 순서(A.9 일부). webapp STEP 0가 CRISIS를 평탄
  peer(VALIDATION 먼저)로 두던 것 → plugin의 Step1.6-before-1.7을 포팅(GATE A +
  "CRISIS WINS over VALIDATION" tie-break). 강제회귀 가드 `step0-gates.test.ts`.
- **닫힌 드리프트:** CourseStatus enum 단일원천+가드, crisis taxonomy 단일원천+가드,
  계약 `basis`(운/실력, A.8) webapp 포팅, decision-state 커버리지 가드.
- **새 공유 상태:** `self_profiling` (누가-나인가 요청 → 콜드리드 거부, anti-Barnum)
  를 webapp GATE B + plugin clarify Step1.7 양쪽에 추가(R27 cold_start).
- **정정:** Navigator(웹앱 §A.7 판정 코칭)는 **레거시 전용** — 라이브 progressive
  흐름엔 안 뜨고 legacy 4-tab(`?step=...`)에서만 렌더. 스파인 위험은 실재하나
  도달면이 좁음. "are you still intending to leave?" 류는 위반이 아니라 *의도된
  anti-dependency 킥*(하버 철학). 남은 진짜 위반은 처방형 "you should…" 코칭 카피.
- **재확인(R27):** value-monoculture·prompt-injection·dependency-erosion 3개 도메인은
  양 표면 모두 기존 기계로 이미 커버 — 회의자 검증이 조작된 발견 100% 기각.
- **닫힌 드리프트(§A.9 / §E.1 최우선):** webapp의 결정론적 위기-게이트(`classifyCrisis`)가
  죽은 코드(테스트만, 라이브 미연결)였던 것 → 이제 `runInitialAnalysis`에서 LLM *앞단*에
  연결. 위기면 토큰 0으로 short-circuit(skeleton=[] → 계획·계약봉인 차단, framing_locked),
  화면엔 비차단 `CrisisConcernBanner`(자원 링크 + "그래도 계속" 1탭, 결코 하드블록 X).
  설계는 understand→implement→**적대적 5렌즈 검증** 거쳤고, HIGH 결함 1개(우려문 이중
  렌더+"우리가 잡은 항로" 오라벨)를 근원 수정(우려문은 배너에만, real_question=원문,
  AnalysisCard는 차단 중 숨김). 리콜 레버는 여전히 LLM GATE A(미묘 케이스). 정밀 regex는
  안 넓힘(과발화 방지). 가드: `progressive-engine-crisis-wiring.test.ts`+`crisis-concern-render.test.tsx`.

## A. 어긋난 것 (drifted — 정렬 필요)
1. **frame_status(평탄 판정):** plugin 작동(wired) ↔ webapp 포팅됐으나 **DEAD(unwired)** — 라이브 웹앱 흐름은 여전히 평탄에 over-fire(프롬프트 STEP 0로만 부분 커버).
2. **density 게이트:** plugin wired ↔ webapp `applyDecisionDensityGate` 한 번도 안 불림.
3. **Strategic Fork 폴:** webapp 엔진이 폴을 써줌 ↔ plugin은 사용자-위임+대칭 crux, 엔진-가중 폴 금지(R14/R16, 검증된 modal tilt 수정).
4. **Current Bearing:** webapp 하드코드 always-go(proceed/collect_evidence만, current-bearing.ts:183) ↔ plugin 전체 상태셋+FLAT 절제 코스+폴-parity.
5. **DM/boss 리뷰:** webapp에 plugin의 no-concern-manufacturing·voice-preservation·fix-required 가드 없음.
6. **Lead Synthesis:** webapp이 recommendation_direction 방출 ↔ plugin은 모순 보존+추천 없음.
7. **Insight 표면:** webapp Navigator는 구식 판정 코칭("you should…", 에스컬레이션) ↔ plugin log --insights는 근거 기반·≤3줄·blanket 금지. **webapp이 CLAUDE.md rule#2 위험.**
8. **계약 `basis`(운/실력):** plugin settle 있음(R17) ↔ webapp decision-contract.ts 없음.
9. **위기 감지:** webapp 결정론적 regex+자원링크 ↔ plugin LLM-only(결정론 백업 없음).

## B. 의도적 한쪽-only (킥/기질 — 실수로 날리지 말 것)
- **Overreach/Flinch 사다리 (webapp-only, *의도*):** 성공-주장을 끝까지 부풀려 사용자가 flinch로 잘못된 전제를 자각하게 하는 *명명된 킥*. plugin의 동명 "overreach defense"는 *다른 것*(under-fire 가드). **평결: 척추-호환(사용자가 판단, 엔진 verdict 0) → plugin에 opt-in deep method로 *포팅 권장*, 단 frame_status로 게이트(평탄엔 금지)·verdict-free 유지.** (이번 동기화에 *안 날아감* — buildInitialAnalysisPrompt만 수정했고 buildOverreachPrompt/Falsification.tsx 그대로.)
- **Helm (plugin-only):** 코딩-에이전트 계획의 비가역 op 사전스캔. webapp 무관 → 유지, 포팅 X.
- **Judgment Vitality + 개입 (webapp-only):** plugin 누락이 척추-정답(rule#2: 미보정 tier 노출 금지). webapp판은 *내부-라우팅 전용으로* 또는 제거.
- **Decision Quality 점수 (webapp-only):** 'write-only until L5'(memory). 내부 유지, plugin 누락 정상.
- **다중 persona UI (webapp-only):** plugin 단일 boss는 합리적 substrate 선택. 단 *정확도 보정 학습 루프*는 plugin도 고려 가치.
- **Chart 버전트리 (plugin-only):** plugin의 child-draft 모델 반영. webapp 선형 in-place는 의도적 차이.

## C. 단일원천화 후보 (재드리프트 방지 — 한 곳 + parity 테스트)
frame_status 규칙 · density/stakes 임계값 · fork-폴 제시규칙(R14/R16) · Current Bearing 스키마+CourseStatus enum+상태규칙 · request/decision-type 분류 taxonomy(webapp 7 vs plugin 4+crisis 통일) · stakeholder-review 가드(DM↔boss) · 계약+정산 스키마/채점의미(+basis를 webapp에) · 성적표 집계(손실 포함, R10 회귀 방지) · insight/pattern 규칙(근거·표본크기·blanket 금지) · 위기 taxonomy+자원(safety-critical) · lead-synthesis 추천 방출 정책(척추 결정 1회).

## D. 누락 (한쪽에 있어야 하는데 없음)
- plugin: reframe-on-rejection(틀린 frame 수정), 결정론적 위기-regex 백업, persona-정확도 보정 루프, convergence Q&A 심화.
- webapp: 버전트리 맵.

## E. 재드리프트 방지 계획 (1번)
1. **DEAD CODE 살리기 (최우선):** webapp `judgment-gates.ts`/`crisis-gate.ts`/`request-type-classifier.ts`를 progressive-engine에 *실제 wire* — 지금은 프롬프트로만 판단, 코드 게이트는 죽어있음.
2. **선언적 코어 단일원천:** C의 후보(특히 enum·taxonomy·임계값·crisis·fork규칙)를 `data/`로 → webapp import + plugin 참조 + **parity 테스트**(probe-prompts-parity.test.ts 모델 확장)로 CI가 드리프트 차단.
3. **동작 parity harness:** R12~23 stress fixture를 두 표면에 돌려 *판단 동일성* 검증(명심: 코드 공유 못 하는 절차는 fixture로 묶음).
4. **의도적 한쪽-only는 명시 등록**(B) — 실수 동기화로 안 날아가게.

> 정직: 이 지도도 코드 읽기 기반 1회 스냅샷. 실DB/실행 동작과 다를 수 있으니 wiring 시 재확인. 최종 검증은 실사용.
