---
target: Argus decision loop web app
total_score: 23
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 6
timestamp: 2026-08-10T00-34-55Z
slug: src-app-locale-workspace-page-tsx
---
# Argus Decision Loop Critique

Method: dual-agent (A: impeccable_assessment_a · B: impeccable_assessment_b)

## Design Health Score

| # | Heuristic | Score | 핵심 근거 |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | 로딩, 진행 단계, 반환/정산 상태와 `aria-live`는 좋지만 Decision Desk 합계가 서로 다릅니다. |
| 2 | Match system / real world | 2 | 랜딩의 결정 언어는 명료하지만 실제 화면은 Project, Voyage, Frame, 문서 산출물이라는 옛 모델을 노출합니다. |
| 3 | User control and freedom | 2 | 취소·건너뛰기·닫기는 잘 갖췄지만 반환 완료 CTA 목적지가 문구와 다르고 되돌리기 범위가 불균일합니다. |
| 4 | Consistency and standards | 2 | Landing, idle Workspace, heavy flow, populated Decision Desk가 서로 다른 제품 모델처럼 느껴집니다. |
| 5 | Error prevention | 3 | 빈 제출 방지, 작업 보존, append-only 반환, 명시적 확인과 출처 표시는 강합니다. |
| 6 | Recognition rather than recall | 2 | 랜딩은 루프를 설명하지만 실제 사용자는 단계·지도·분기 개념을 기억해야 합니다. |
| 7 | Flexibility and efficiency | 2 | 단축 경로가 존재해도 사소한 결정이 9단계 경로와 문서 산출물로 들어갑니다. |
| 8 | Aesthetic and minimalist design | 2 | 랜딩은 탁월하지만 작업 화면과 Desk는 메타포·진행 chrome·작은 텍스트가 핵심 판단을 압도합니다. |
| 9 | Error recovery | 2 | 재시도와 입력 보존은 좋지만 `기록 보기`가 기록으로 가지 않는 회복 불일치가 있습니다. |
| 10 | Help and documentation | 3 | 가이드와 문맥 설명은 좋지만 경로 전환과 지도 의미 설명이 부족합니다. |
| **Total** |  | **23/40** | **Acceptable — 강한 브랜드와 반환 윤리, 미완성인 핵심 결정 루프.** |

## Design Specificity Verdict

Argus는 시각적으로 분명히 고유합니다. 종이·잉크·브라스, 에디토리얼 타이포그래피, 어두운 ledger proof, Argus companion이 만드는 `quiet decision desk`는 범용 AI 대시보드가 아닙니다. 그러나 실제 동작은 baseline 수집, 날짜 선택, 연속 질문, 9단계 진행, 문서 변환, export, reader preview, assumption test, logbook, sea map을 포함한 옛 전략·프로젝트 제품과 섞여 있습니다. 겉모습은 Argus지만 핵심 경험은 여전히 전제를 모아 memo를 만드는 consultant에 가깝습니다.

정적 detector는 관련 TSX 6개에서 263건을 찾았습니다: `design-system-font-size` 257건, `design-system-color` 6건. DESIGN.md frontmatter의 크기 범위가 실제 prose보다 좁아 12–16px 일부는 과탐이지만, 8px 글자, 반복되는 half-pixel 크기, 257개 개별 예외는 실제 시스템 drift입니다. 신뢰할 수 있는 사용자-visible overlay는 생성되지 않았고 DOM snapshot과 screenshot을 fallback evidence로 사용했습니다.

## Overall Impression

랜딩과 idle Workspace는 `막힌 결정 → 다음 움직임 → 현실 → 다음 판단`을 매우 잘 약속합니다. 반환도 현실을 먼저 묻고 과거 문장을 나중에 공개하는 구조가 훌륭합니다. 가장 큰 기회는 그 사이를 하나의 명확한 `DecisionCase`로 연결하는 것입니다. 현재 저장·도구·화면의 중심은 `결정 + 채택한 다음 움직임`이 아니라 `판단 문장/예측 + 전제 + 확인일 + 반환`입니다.

## What's Working

- 랜딩 첫 화면은 하나의 약속, 하나의 입력, 하나의 worked example로 폐쇄 루프를 추론 없이 보여줍니다.
- idle Workspace는 초점, 위계, 카피, forgiving input에서 매우 좋습니다.
- 첫 반환은 observation-before-reveal, 출처 표시, opt-in memory, append-only history를 지켜 신뢰할 수 있습니다.
- 접근성 기반은 좋습니다: skip link, heading, textarea label, focus, `aria-live`, semantic dialog, reduced motion, modal focus restoration이 있습니다.
- 웹의 `DecisionContract`는 sealed statement, kind, origin, predicate, provenance, review condition, return event, settlement를 보존합니다. 단순한 전제 저장소보다 훨씬 발전했습니다.

## Priority Issues

### P1 — 핵심 객체가 `결정과 다음 움직임`을 1급 데이터로 갖지 않습니다

웹 계약에는 선택한 옵션·버린 옵션·채택한 다음 행동·담당자·행동 기한·성공/중단 기준이 독립 필드로 없습니다. MCP의 durable entry도 `text`, `predicate`, `check_by`, `outcome`, `premises` 중심입니다. 플러그인은 `Next move`를 출력하지만 MCP가 이를 별도 의미 객체로 보존하지 못합니다. 따라서 세 surface가 같은 제품 약속을 말하면서 다른 실체를 저장합니다.

Fix: canonical `DecisionCase`/`DecisionLoopCore`를 만들고 최소 필드로 `question`, `state(decide/test/research/defer/reframe/stop)`, `chosen_option`, `next_move`, `owner`, `act_by`, `observable_signal`, `return_trigger`, `learned_rule`를 둡니다. 웹/MCP/플러그인은 이 core의 adapter가 되어야 합니다.

### P1 — Light path는 사용자가 보지 않은 AI 문장을 먼저 저장할 수 있습니다

Light UI는 실제 persisted sentence를 permission ask에서 의도적으로 숨기고, 사용자가 `나중에 물어봐도 된다`고 허용하면 `offer.sentence`를 AI-surfaced sealed statement로 저장합니다. 그 문장은 저장 뒤 receipt에서야 보이고 수정됩니다. 출처 기록은 정직하지만 `리마인드 허용`은 `이 판단/행동 문장을 채택`과 다릅니다.

Fix: 저장 전에 정확한 판단 또는 다음 움직임을 보여주고 `채택`, `수정`, `아직 결정 안 함`을 분리합니다.

### P1 — Heavy path의 기본 seal이 실제 선택보다 중립적 crux를 저장하기 쉽습니다

`decision_read` prompt는 의도적으로 명령·선택·판결을 금지하고 `이 결정은 X인지 Y인지에 달렸다` 같은 중립 질문/조건을 생성합니다. 이 값이 `humanJudgment`에 prefill되고 untouched confirmation을 거쳐 sealed statement가 될 수 있습니다. 즉 좋은 분석 headline이 결정 자체로 둔갑할 수 있습니다.

Fix: `crux`와 `adopted_judgment`를 분리하고, 결정하지 않았다면 상태를 `research/defer/reframe`로 명시합니다. 다음 행동 없는 중립 crux를 `decided`로 봉인하지 않습니다.

### P1 — 간단한 결정도 legacy 9-step 문서 경험으로 빠집니다

브라우저에서 `Should I schedule the team meeting for Tuesday or Wednesday?`를 입력하자 baseline/date gate 뒤 `Progress 2/9`, Frame/Writing/Check, 문서 변환, Voyage record, 우측 decision map이 나타났습니다. 직접 choose/defer/stop/test로 닫는 경로보다 process와 artifact가 먼저입니다.

Fix: flat/light decision은 한 번의 material contribution 뒤 `Decide / Test / Research / Defer / Reframe / Stop`으로 닫고, 사용자가 의도적으로 deepen할 때만 heavy workspace로 전환합니다.

### P1 — 반환의 보상인 `다음 판단 규칙`이 사라집니다

반환 과정은 실제 관찰과 기준 변화를 묻지만 completion과 Decision Desk는 baseline과 outcome을 주로 보여주고 사용자가 바꾼 기준을 주 payoff로 보여주지 않습니다. `연습 닫고 기록 보기`는 기록 상세가 아니라 blank Workspace로 이동했습니다.

Fix: 모든 반환을 `그때의 판단 → 현실 관찰 → 무엇이 달라졌나 → 사용자가 채택한 다음 규칙` receipt로 끝내고, CTA를 정확한 record detail로 연결합니다.

### P1 — Decision Desk는 portfolio 질문보다 sea-map과 legacy Project를 앞세웁니다

브라우저에서 `All 2`, `in progress 2`, `2 total`과 아래 `3 decisions`가 동시에 보였습니다. 첫 viewport는 큰 ocean map이 차지하고 실제 due return, next move, returned learning은 아래로 밀립니다. 상세에는 All projects, Copy project summary, Markdown summary, step-by-step workspace가 노출됩니다.

Fix: Desk 기본 IA를 `지금 움직일 결정 / 현실을 기다리는 결정 / 돌아와 판단할 결정 / 배운 규칙`으로 만들고 map은 secondary view로 내립니다. 합계의 단일 source of truth를 정합니다.

### P2 — 첫 기여 전 baseline/date gate와 작업 화면의 인지 부하가 큽니다

한 문장 제출 뒤 두 번째 textarea, preset date 5개, custom date, Skip이 동시에 나옵니다. active work에는 단계, phase, breadcrumb, source, mirror, question, early exit, log, map이 함께 보입니다. 결정의 보상보다 추가 입력이 먼저 옵니다.

Fix: 첫 응답에서 reframe/trade-off/conditional recommendation/smallest test 중 하나를 먼저 기여하고, record를 채택할 때만 signal/date를 묻습니다. history/map/log는 요청 전 접습니다.

### P2 — 디자인 토큰 적용이 불완전합니다

Detector의 263건 중 일부는 설정 과탐이지만 8px metadata, 작은 map label, 반복되는 임의 크기와 직접 색상은 실제 접근성·일관성 문제입니다.

Fix: DESIGN.md의 machine-readable scale을 실제 허용 범위와 맞춘 뒤 detector를 다시 실행하고, 8px 및 half-pixel 예외부터 제거합니다.

## Persona Red Flags

- **Alex, power user:** 사소한 일정 결정에도 9단계, 문서 변환, 지도, voyage record가 노출되어 fast path가 빠르지 않습니다.
- **Jordan, first-timer:** 랜딩의 mental model은 즉시 이해되지만 다음 화면에서 baseline/date와 Frame/Writing/Check로 바뀌어 다른 제품에 들어온 듯합니다.
- **Sam, accessibility-dependent:** semantic structure는 좋지만 8px metadata, 작은 map label, 공간 축에 의존한 sea map이 primary orientation으로 부적합합니다.
- **Casey, mobile/distracted:** mobile input과 return bottom sheet는 좋지만 두 번의 긴 wait, baseline/date gate, multi-screen return이 중단에 취약합니다.
- **Founder/product leader:** 원하는 것은 한 가지 날카로운 challenge와 reversible move인데, 현재 기본 경로는 두 번째 진술을 받고 premise를 mirror한 뒤 memo/export를 줍니다.

## Minor Observations

- Empty Decision Desk는 명료하지만 populated state가 그 명료함을 잃습니다.
- mobile Desk에서는 실제 결정 목록보다 `기록이 보여주는 것`이 먼저 큰 영역을 차지합니다.
- copy/export controls가 next judgment보다 시각적으로 경쟁합니다.
- landing header와 app header는 각각 좋지만 다른 제품으로 진입하는 느낌을 강화합니다.
- Brass 강조는 절제되어 있으나 workflow completion보다 returned learning에 더 써야 합니다.

## Questions to Consider

- Argus가 추가 질문 전에 단 하나만 기여한다면 reframe, trade-off, conditional recommendation, smallest useful test 중 무엇이어야 합니까?
- 사용자가 60초 뒤 반드시 손에 쥐어야 할 것은 `채택한 움직임 + 관찰 신호 + 반환 조건`이 맞습니까?
- 가장 빠른 exit가 왜 decision state가 아니라 memo를 만듭니까?
- Return이 제품의 증명이라면 왜 바뀐 다음 판단 규칙이 return receipt와 Desk card의 중심이 아닙니까?
- 기본 경로에서 map, branches, export, document stages를 빼는 것이 오히려 Argus를 더 독특하게 만들지 않습니까?
