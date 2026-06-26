# 에이전트 재설계: 렌즈(WHO) + 패턴 오케스트레이션(HOW) — 2026-06-26

> 목표: 17개 에이전트 명패의 겹침/과포화/위계 문제를 풀고, "일이 협업 구조를
> 부르게" 해서 가벼운 질문은 가볍게·무거운 결정은 깊게 + 검증을 상수화.
> 영감: revfactory/harness의 패턴 카탈로그. 단 harness는 *코드팀 자동생성 메타도구*,
> Argus는 *의사결정 도구* — 개념만 흡수하고 맥락·이름·구성은 전부 우리 식.

## 두 축 분리

- **WHO = 7 렌즈** (라우팅 단위, 겹치지 않음). 17명의 지식·프레임워크·말투가드는
  전부 보존되고, "별도 에이전트 명패"만 7개로 묶인다.
- **HOW = 협업 패턴** (일의 성격이 부름). 분류 → 패턴 → 렌즈 협업 구조.

## 7 렌즈 ← 17명 매핑 (전문성 전부 보존)

| 렌즈 | 흡수 | 보존 프레임워크 |
|--|--|--|
| 🔍 탐색 | hayoon·sujin | CRAAP·출처평가·triangulation·벤치마킹 |
| 📊 수치 | minjae·hyeyeon | 시장규모·ROI·유닛이코노믹스·DCF·재무제표 |
| ♟️ 전략 | strategy_jr·hyunwoo·chief_strategist | Playing to Win·7 Powers·시나리오·Wardley |
| ⚠️ 검증 | donghyuk·taejun(법무) | 리스크매트릭스·pre-mortem·PIPA·계약검토 |
| 🛠️ 실행 | sujin_hr(HR)·yerin·junseo | Team Topologies·ADKAR·RICE·아키텍처 |
| ✍️ 전달 | seoyeon·jieun | SCQA·PAS·StoryBrand·UX 10법칙 |
| 🎛️ 지휘 | research_director·navigator | 종합·SCQA·모순 적출 |

한 렌즈가 넓을 때(예 실행=HR+PM+엔지니어)는 **task에 맞는 프레임워크만 로드**
(harness의 Progressive Disclosure). 라우팅은 렌즈 단위(7개), 프레임워크는 task별.

## 협업 패턴 (의사결정 맥락 → 4개, 단 sequential 보류)

| 패턴 | 모양 | 언제 |
|--|--|--|
| **single** | 한 렌즈 → 경량 검증 | 가벼운 질문 (활성화 절벽 완화) |
| **parallel** | 여러 렌즈 동시 → 지휘 종합 → 검증 | 기본 |
| **review_loop** | 병렬 → 적대적 검증 + 재시도(2~3) | 무거운/되돌릴 수 없는/위기 |
| ~~sequential~~ | 렌즈 릴레이(앞→뒤 입력) | **보류** — 의존성 그래프 wiring 필요, 결정엔 드묾 |

## 패턴 선택 로직 — `lib/orchestration-pattern.ts` `planOrchestration()` ✅ 구현됨

입력: `classifyInput` 결과(stakes/decisionType) + workerCount + `{userLeaning}`(Bind lean).

- **pattern**: workerCount≤1 → single / verifyDepth=deep → review_loop / 그 외 parallel
- **verifyDepth (검증은 항상 켜짐, 깊이만 조절)**:
  - deep: critical · on_fire · (leaning && important=확증편향)
  - light: routine && workerCount≤2 → **중립 crux 질문 하나만** (스파인: over-fire 금지)
  - standard: 그 외

**Argus 특색 2가지**: (1) 검증은 critical-only가 아니라 **crew 경로의 *상수***(워커가 배정되면 navigator review 항상 실행, 깊이만 조절). express 빠른경로는 워커가 없어 navigator가 아니라 *분석의 hidden_assumptions 표면화 + flinch 테스트*로 검증 — verifyDepth는 crew 경로의 navigator를 다스린다. 제품 정체성=놓친 반대편.
(2) Bind의 사용자 lean을 검증 깊이에 투입(확증편향이면 더 세게) — harness엔 없는 우리 신호.

## 위계 / retention (사용자 원래 의도 존중)

위계는 두 일을 했음: (a) 일 배정 "단순=주니어" — LLM에선 가짜 → **라우팅에서 제거**.
(b) retention 게임 "쓸수록 레벨업" — 진짜 목적 → **별개 레이어로 보존**(레벨/XP는
실력 게이트가 아니라 수집·성장 보상으로; 묶음 B에서 floor=senior로 이미 분리됨).
라우팅이 레벨에서 풀리니 "레벨 낮으면 답 구려 이탈"하는 역효과도 사라짐.

## 구현 단계

1. ✅ **패턴 두뇌** `orchestration-pattern.ts` (순수, 8테스트) — 어떤 패턴+검증깊이.
2. ⏳ **buildStages 통합** — `orchestrator.ts buildStages`가 planOrchestration 사용 →
   패턴별 stage 구성 + **검증 스테이지 항상 추가**(없으면 검증 워커 주입). verifyDepth를
   검증 워커 프롬프트 깊이로. progressive-engine/ProgressiveFlow 연결.
3. ⏳ **렌즈 레이어** — selectAgents 위에 7-렌즈 그룹핑(17 capability 재사용) +
   single 패턴 빠른 경로(가벼운 질문은 관문 skip).
4. ⏳ **eval 측정** — 재설계 전/후 아웃풋 품질 A/B(플러그인 eval harness 차용).

## harness 흡수 vs Argus 특색 (표절 아님 명시)

- 흡수: 패턴=협업구조 개념, Producer-Reviewer(=review_loop), 선택 결정트리,
  중간산출물 보존(=Bearing Ledger), Progressive Disclosure(프레임워크 task별 로드).
- 우리 것: 의사결정 맥락(코드팀 X), 7 렌즈 구성, 검증 상수화, Bind-lean 검증신호,
  over-fire 금지 스파인, 이름 전부 자체. 패턴은 분산컴퓨팅 고전(누구 것도 아님).
