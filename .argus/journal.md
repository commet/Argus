## 2026-03-15 /argus — full pipeline
- Problem: "Should we expand to SEA?"
- Reframed: "Which single market validates our assumptions fastest?"
- Score: DQ 72
- Assumptions: 2 confident, 1 uncertain, 1 doubtful
- Growth edge: timing assumptions consistently missed
- Blind spots: regulatory timeline

## 2026-03-18 /reframe
- Original: "How to improve retention?"
- Reframed: "Why do power users churn after month 3?"
- Assumptions: 1 confident, 2 uncertain, 1 doubtful
- Growth edge: timing assumptions not explored

## 2026-03-22 /argus — full pipeline
- Problem: "AI feature prioritization"
- Reframed: "Which AI capability creates switching costs?"
- Score: DQ 78
- Assumptions: 3 confident, 1 uncertain, 0 doubtful
- Growth edge: competitive response timing
- Blind spots: team capacity during migration

## 2026-03-25 /argus — full pipeline
- Problem: "Hiring plan for Q2"
- Reframed: "Build vs buy decision masked as hiring question"
- Score: DQ 81
- Assumptions: 2 confident, 2 uncertain, 1 doubtful
- Growth edge: organizational change timing
- Blind spots: timeline assumption for onboarding

## 2026-03-28 /reframe
- Context: build
- Original: "프리랜서용 프로젝트 관리 앱"
- Reframed: "프리랜서가 Notion/Trello로 못 하는 딱 한 가지를 찾고, 주말에 그 프로토타입만 만들기"
- Interview: audience=niche success_model=revenue scale=weekend
- Pattern: mixed
- Strategy: narrow_scope
- Assumptions: 0 confident, 3 uncertain, 0 doubtful

## 2026-03-28 /recast
- Context: build
- Goal: "클라이언트별 마감·정산 추적 단일 목적 도구"
- Features: P0: 2 / P1: 1 / P2: 1 | Cuts: 5
- Key assumptions: 4 (3 from reframe + 1 new)

## 2026-03-28 /rehearse
- Context: build
- Personas: 지수 (타겟), 현우 (회의론자)
- Critical risks: 2 | Unspoken: 3
- Sharpest critique: "이거 결국 Notion 테이블 뷰 하나랑 뭐가 다른 건데?"

## 2026-03-27 /reframe
- Context: build
- Original: "1인 창작자를 위한 뉴스레터 수익화 도구"
- Reframed: "소규모 창작자가 수익화를 시도하다 포기하는 정확한 마찰 지점은 어디이며, 기존 플랫폼이 그걸 왜 안 푸는가?"
- Interview: origin=self, uncertainty=what, success=opportunity
- Pattern: mixed
- Strategy: narrow_scope
- Assumptions: 0 confident, 4 uncertain, 0 doubtful
  - ? 기존 도구로 해결 안 되는 구체적 불편이 있다
  - ? 창작자는 다양한 수익원을 원한다
  - ? 구독자 1,000명 이하도 월 50만원 수익 가능하다
  - ? 글쓰기와 수익화 도구 분리가 불만이다
- Blind spot: "수익화 도구가 아니라 audience-trust가 진짜 병목"
- Pipeline: reframe ✓ → recast · rehearse · refine

## 2026-03-27 /recast
- Context: build
- Goal: "가격 확신을 주는 수익화 런치킷 — 가격 추천 엔진 + 전환 랜딩페이지"
- Features: P0: 2 / P1: 1 / P2: 1 | Cuts: 5
- Key assumptions: 4 (4 from reframe + 1 new)
  - ? 유료 전환 포기 원인이 "가격 불확실성"이다 (M/L) reframe
  - ? 기존 도구로 해결 안 되는 불편이 있다 (M/L) reframe
  - ? 구독자 1,000명 이하도 월 50만원 수익 가능 (M/L) reframe
  - ? AI 가격 추천이 실제 의사결정을 돕는다 (M/L) new
- Pipeline: reframe ✓ → recast ✓ → rehearse · refine

## 2026-03-27 /rehearse
- Context: build
- Personas: 민지 (타겟 유저, 디자인 뉴스레터 400명), 재혁 (회의론자, 전직 미디어 PM)
- Critical: 가격 추천 근거 데이터 부재 시 신뢰 불가 / feature-not-product — Substack이 내일 추가하면 끝 / 핵심 가설(가격이 병목) 자체가 틀릴 가능성
- Unspoken: "내 글이 돈 받을 가치가 있는지 확신이 없다" — 심리적 장벽 / 수익화를 말하지만 행동까지 가는 창작자는 극소수 — TAM 환상
- Sharpest critique: "가격 추천 하나 때문에 별도 도구를 설치할 창작자가 몇이나 돼? Feature지 product가 아니야." — 재혁
- Unresolved: yes
- Pipeline: reframe ✓ → recast ✓ → rehearse ✓ → refine ·

## 2026-03-27 /reframe
- Context: build
- Original: "개발자를 위한 AI 코드 리뷰 자동화 SaaS"
- Reframed: "AI 코드 리뷰 도구가 5개 이상 존재하는 시장에서, 기존 도구가 의도적으로 방치하는 리뷰 마찰은 무엇이며, 독립 SaaS가 들어갈 틈이 있는가?"
- Interview: origin=self, uncertainty=why, success=measurable
- Pattern: mixed
- Strategy: narrow_scope
- Assumptions: 2 confident, 2 uncertain, 0 doubtful
  - ? 기존 도구 대비 틈새가 존재한다
  - ? 팀 리드/CTO가 월 구독료를 지불할 의향이 있다
- Blind spot: "자동화의 경쟁자는 다른 도구가 아니라 리뷰를 통해 주니어를 가르치고 싶은 시니어 개발자"
- Pipeline: reframe ✓ → recast · rehearse · refine

## 2026-03-27 /recast
- Context: build
- Goal: "시니어의 반복적 스타일 지적은 AI가, 설계 리뷰는 시니어가 — 팀 컨벤션 학습 기반 리뷰 어시스턴트"
- Features: P0: 2 / P1: 1 / P2: 1 | Cuts: 5
- Key assumptions: 4 (2 from reframe + 1 new + 1 confirmed)
  - ? 기존 도구 대비 "팀 컨벤션 학습" 틈새 존재 (M/L) reframe
  - ? CTO가 리뷰 시간 절약에 월 구독료 지불 (M/L) reframe
  - ? 시니어가 AI 스타일 지적을 도움으로 받아들임 (H/L) new
  - ✓ 코드 리뷰에 과도한 시간 소비 (H/H) reframe
- Pipeline: reframe ✓ → recast ✓ → rehearse · refine

## 2026-03-27 /rehearse
- Context: build
- Personas: 준호 (타겟, 시니어 백엔드 10인 팀), 수진 (회의론자, DevOps Codacy 해지 경험)
- Critical: false positive 20%+ 시 알림 피로로 이탈 / "팀 컨벤션 학습"이 패턴 매칭과 다른 점 증명 불가 / CTO(구매자)와 시니어(사용자) 인센티브 충돌
- Unspoken: 시니어에게 리뷰 시간은 비용이 아니라 영향력 행사 시간 / 셀프 디스럽션을 자발적으로 하는 사람은 없다
- Sharpest critique: "CodeRabbit + ESLint + Prettier면 90% 잡힌다. 남은 10%를 위해 새 SaaS 도입하고 PR 히스토리까지 넘길 팀이 있을까?" — 수진
- Unresolved: yes
- Pipeline: reframe ✓ → recast ✓ → rehearse ✓ → refine ·

## 2026-03-27 /refine
- Rounds: 1 | Converged: no (critical 1 remaining — 빌드 후 증명 필요)
- Critical issues: 3 → 1
- Key change: product thesis "시간 절약" → "시니어 영향력 확장" + core feature "컨벤션 학습" → "리뷰어 판단 학습"
- Sharpest critique resolved: "CodeRabbit+ESLint+Prettier면 90% 잡힌다" → 포지셔닝을 linter 영역에서 "리뷰어 판단 학습"으로 이동, 비교 축 자체를 전환
- Pipeline: reframe ✓ → recast ✓ → rehearse ✓ → refine ✓

## 2026-04-01 /argus — 신사업 기획안 2주
- Context: decide
- Judge: 대표님/CEO
- Problem: "백엔드 개발자인데 대표님이 2주 안에 신사업 기획안을 써오라고 했어"
- Reframed: "대표님이 이미 정한 영역에서, 지금 진입해야 하는 이유와 2주 안에 검증 가능한 것을 어떻게 분리해서 보여줄 것인가"
- Rounds: 2 (판단자 + 신사업 범위)
- Score: DQ 78
- Assumptions: 2 confirmed, 2 uncertain, 1 doubtful
  - ✗ 대표님이 원하는 건 완성된 기획안이다
  - ? 2주 안에 의미 있는 검증이 가능한가
- Simulation: 대표님, 2 critical, 1 important, 0 minor
- Fixes applied: 3 of 3
- Sharpest critique: "숫자를 던졌으면 뒷받침이 있어야지. '왜 우리인가'가 아직 아무 회사나 할 수 있는 말이야."
- Strength: Go/No-Go 기준을 수치로 정의하고 "하지 않는다"도 옵션에 포함
- Growth edge: "왜 우리인가"의 구체성 — 추상적 강점이 아니라 기술 자산 레벨로 내려가야 설득됨

## 2026-04-01 /argus — Argus 타겟 피벗
- Context: decide
- Judge: self (1인 프로젝트)
- Problem: "사업 방향 전환 — 제품 라인 피벗, 사용자 반응이 미지근"
- Reframed: "카테고리를 바꿔야 하나, 타겟을 바꿔야 하나? → 둘 다. 타겟 검증이 먼저."
- Rounds: 3 (피벗 동기 + 미지근의 정체 + 타겟 방향)
- Score: DQ 76
- Assumptions: 2 confirmed, 2 uncertain, 2 doubtful
  - ✗ PM이 AI 기획 검증에 자존심 저항 없이 쓸 것
  - ✗ Claude Code 사용자 중 PM이 충분히 있을 것
  - ? "기획 검증 도구" 포지셔닝이 전환율 개선할지
  - ? PM vs 개발자 중 어느 쪽이 더 절실한지
- Simulation: 까다로운 조언자, 2 critical, 1 important, 0 minor
- Fixes applied: 3 of 3
- Sharpest critique: "Claude Code 쓰는 PM이 얼마나 되는데?"
- Strength: 근본 진단 — "카테고리 인식 부재"를 METR RCT와 연결하여 구조적으로 설명
- Growth edge: 종화 피드백("기획하라고 된 개발자")을 건너뛰고 PM을 선택한 판단 — 검증 전에 직감으로 타겟을 고르는 패턴 반복
