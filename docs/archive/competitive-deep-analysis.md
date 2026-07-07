# 경쟁력 심층 분석 (2026-03-30)

> 데이터 출처: Argus 구현 감사 (실제 코드/스킬 기반), 경쟁 제품 심층 리서치 (WebSearch/WebFetch 기반), 시장 니즈/스티키니스 리서치 (HN/Reddit/블로그/설문 기반)
>
> 원칙: 사실 기반, 과장 금지. 약한 것은 약하다고 쓴다.

---

## 1. Argus vs 경쟁 제품 1:1 매칭

### ChatPRD

- **무엇을 하나**: AI PM 코파일럿. 간단한 아이디어 입력 → PRD 자동 생성 → 코칭 피드백 → 팀 공유. Notion/Google Docs/Slack/Linear 연동. PRD 리뷰 기능(기존 문서 업로드 → 개선 제안). PM 스킬 코칭(우선순위 결정, 가설 수립, 트레이드오프 피드백).
- **가격**: Free(3개 문서), Pro $15/월(무제한 문서, GPT-4o/Claude/o1), Teams $29/seat/월(실시간 협업, Linear 연동)
- **트랙션**: 100K+ PM 사용, 6,835개 리뷰 평균 4.5점, 6자리 ARR, 20-30% MoM 성장(오가닉). 창업자 Claire Vo(LaunchDarkly CPO)가 주말에 혼자 만듦. 펀딩 없음.
- **사용자 불만 TOP 3**:
  1. ChatGPT 대비 차별화가 $15/월 가치인지 의문 -- "Why pay when I can just prompt ChatGPT well?" (추가 리서치 필요: 공개 리뷰에 부정적 피드백이 거의 없어 실제 이탈 이유 불명확)
  2. PM 전문 도구이므로 개발자에게는 맥락이 안 맞음 -- 개발자가 쓰기에는 PM 용어와 프레임워크에 편향
  3. 출력이 "잘 쓰인 문서"이지 "더 나은 판단"은 아님 -- coaching은 있지만 구조적 반론이나 가정 검증은 없음
- **Argus와 겹치는 것**: 아이디어 → 구조화된 문서 생성, "think before you build" 메시지, AI 코칭/피드백
- **Argus만 하는 것**: 숨겨진 가정 발굴 (reframe), 다관점 페르소나 시뮬레이션 (rehearse), anti-sycophancy 5단계, DQ 스코어링, 수렴 추적, devil's advocate, 3-tier 리스크 분류, context contract 체이닝, 판단 저널 기반 학습
- **ChatPRD가 하는데 Argus가 안 하는 것**: Notion/Slack/Linear/Google Drive 직접 연동, 팀 실시간 협업 에디터, 문서 버전 관리, PM 커리어 코칭, 기존 문서 리뷰/개선, 템플릿 라이브러리. **솔직히 ChatPRD의 "연동 생태계"는 Argus가 현재 전혀 없는 영역.**

### Manyfast (매니패스트)

- **무엇을 하나**: AI 기획 에디터. 한 줄 프롬프트 → 기능 정의 + IA(정보 아키텍처) 다이어그램 자동 생성 → 실시간 편집 → Excel/이미지/Markdown 내보내기 → MCP로 Cursor/Claude Code에 직접 전달.
- **가격**: 무료 체험 가능, 프리미엄 요금 비공개. 크레딧 기반 과금 (기능명세 1건 생성에 크레딧 소모).
- **트랙션**: 500+ 베타 사용자 (기사의 "5000명"은 과장), MoM 성장률 0%. Seed $300K (Laguna, SparkLabs, HBS Angels). 2024 iF Design Award 수상 2건.
- **사용자 불만 TOP 3**:
  1. 크레딧 소모 부담 -- 21년차 기획 전문가 Macbe: "초기 단계는 발산의 과정인데 크레딧 비용이 심리적 장벽"
  2. 텍스트 기반 명세에 한정 -- "유저플로우, 와이어프레임 등 기획에 필요한 스킬들이 더 탑재되길 기대합니다" (Macbe)
  3. ChatGPT/Claude 대비 차별화 부족 -- 시각화와 편집 기능 외에는 범용 LLM으로 대체 가능하다는 인식
- **Argus와 겹치는 것**: 아이디어 → 구조화된 출력, AI 에이전트 기반 기획 지원
- **Argus만 하는 것**: 판단 레이어 전체 (전제 의심, 다관점, anti-sycophancy, DQ 스코어링). Manyfast는 "무엇을 만들까"의 문서화이고, Argus는 "이게 맞는 판단인가"의 검증. 파이프라인에서 Argus가 상위에 위치.
- **Manyfast가 하는데 Argus가 안 하는 것**: 비주얼 IA 다이어그램, MCP를 통한 코딩 에이전트 직접 연결, 다중 포맷 내보내기(Excel/이미지), 실시간 협업 에디터. **MCP 연동은 Argus에도 유의미한 기회.**

### Superpowers (Claude Code Plugin)

- **무엇을 하나**: Claude Code에 7단계 구조적 개발 워크플로우를 부여하는 오픈소스 스킬 프레임워크. Brainstorm → Isolated Git Worktree → Detailed Plan → Subagent Development → TDD → Code Review → Branch Completion. `/brainstorming`, `/write-plan`, `/execute-plan` 등 슬래시 커맨드.
- **가격**: 무료 (MIT 라이선스, $0 매출)
- **트랙션**: GitHub 93K-124K stars, 8,600 forks, 2025년 10월 출시. 5개월 만에 하루 2,000 stars 증가. Claude Code 플러그인 마켓플레이스 공식 등록 (2026-01-15). 112K+ 사용자 커뮤니티.
- **사용자 불만 TOP 3**:
  1. 플러그인 로딩 실패 -- "Claude blocked superpowers plugin?" (GitHub Issue #643), 스킬 미로딩, SessionStart 훅 미작동
  2. 컨텍스트 윈도우 소모 -- 구조화된 워크플로우가 컨텍스트를 빠르게 소진
  3. Claude Code rate limit 이슈와 결합 -- "sessions meant to last hours are literally burning out in minutes"
- **Argus와 겹치는 것**: 슬래시 커맨드 기반 구조적 워크플로우, brainstorm-plan-execute 흐름, Claude Code 플러그인 배포 채널
- **Argus만 하는 것**: 판단 품질 자체에 집중 (Superpowers는 코드 품질에 집중). Anti-sycophancy, 다관점 시뮬레이션, DQ 스코어링, 판단 저널, build/decide context 분기. **Argus는 "무엇을 만들까"를 결정하고, Superpowers는 "어떻게 만들까"를 실행하는 구조. 경쟁이 아니라 보완.**
- **Superpowers가 하는데 Argus가 안 하는 것**: TDD 강제, isolated git worktree, subagent 병렬 실행, 코드 리뷰 자동화, 실행 계획의 분 단위 태스크 분해. **Superpowers의 23만 다운로드는 "깊이보다 배포 채널과 편의성이 트랙션을 만든다"는 증거. Argus가 배워야 할 교훈.**

### Cursor Plan Mode

- **무엇을 하나**: Cursor IDE 내장 기능. Shift+Tab으로 활성화. 코드베이스 분석 → 명확화 질문 → Markdown 플랜 생성 → 인터랙티브 편집 → 승인 후 구현. 코드와 계획이 한 환경에 통합.
- **가격**: Cursor Pro $20/월 (Plan Mode 포함), Pro+ $60/월, Ultra $200/월
- **트랙션**: Cursor ARR $1B 근접, 수백만 사용자. Plan Mode는 2025 출시 이후 "Most new features at Cursor now begin with Agent writing a plan."
- **사용자 불만 TOP 3**:
  1. 코드 실행 맥락에 한정 -- 전략적 판단이나 비즈니스 결정에는 사용 불가
  2. 플랜이 얕을 수 있음 -- "planning has been shown to significantly improve the code generated" 하지만 다관점 검증은 없음
  3. rate limit 소모 -- Plan Mode 자체가 컨텍스트를 상당히 사용
- **Argus와 겹치는 것**: "코드 전에 생각하라"는 철학, 구조화된 플래닝 단계
- **Argus만 하는 것**: 코드 밖의 판단 (비즈니스 전략, 제품 방향, 이해관계자 관리). 다관점, anti-sycophancy, DQ 스코어링. Cursor Plan Mode는 "이 코드를 어떻게 구현할까"이고, Argus는 "이 프로젝트를 해야 하는가, 한다면 무엇이 성공 조건인가".
- **Cursor가 하는데 Argus가 안 하는 것**: 코드베이스 직접 분석, 플랜에서 바로 구현으로 전환, IDE 내장, tab-tab-tab 흐름의 중독적 UX, inline diff 리뷰. **Cursor의 스티키니스 핵심 교훈: "생각과 실행 사이 마찰이 0에 가까울수록 습관이 된다."**

### Notion AI

- **무엇을 하나**: Notion 워크스페이스 내 AI 어시스턴트. PRD 생성, 문서 요약, 다국어 번역, 톤 변경, 액션 아이템 추출. 2025년 9월 Notion 3.0부터 자율 AI Agent 추가 (최대 20분 자율 작업, 수백 페이지 동시 처리).
- **가격**: Free $0 (AI 제한), Plus $10-12/user/월, Business $20-24/user/월 (AI 전체 기능 포함, GPT-4.1 + Claude 3.7 Sonnet)
- **트랙션**: 전 세계적 협업 도구 표준. 구체적 AI 기능 사용자 수 미공개.
- **사용자 불만 TOP 3**:
  1. AI를 위해 Business 플랜($20/user/월) 필요 -- "repeatedly paying for AI tools, questioning why pay for AI in Notion when you have it elsewhere"
  2. 대용량 워크스페이스 성능 저하 -- "As workspaces grow, performance can slow down"
  3. AI가 있어도 "판단"은 안 함 -- PRD 초안은 만들지만 "Human judgment is recommended to validate" (공식 문서)
- **Argus와 겹치는 것**: AI로 기획 문서 초안 생성, 문서 기반 워크플로우
- **Argus만 하는 것**: 판단 품질 검증 전체. Notion AI는 "문서를 빠르게 만든다"이고, Argus는 "그 문서의 전제가 맞는지 검증한다".
- **Notion AI가 하는데 Argus가 안 하는 것**: 데이터베이스/위키/프로젝트 관리 통합, 팀 전체 협업 플랫폼, API/MCP 연동, 에이전트 자율 실행, 거대한 사용자 베이스와 생태계. **Notion AI는 "모든 것의 허브"이므로 직접 경쟁이 아니라, Argus 산출물이 Notion으로 내보내지는 관계가 자연스럽다.**

### Claude Projects / Custom GPTs

- **무엇을 하나**: Claude Projects (2026-03): 전용 워크스페이스 + 영속 메모리 + 커스텀 인스트럭션 + 예약 태스크. ChatGPT Projects: 대화/파일/인스트럭션을 한 곳에 유지. Custom GPTs: 특정 태스크용 전문 AI 어시스턴트 (GPT Store 배포 가능).
- **가격**: Claude Pro $20/월, Claude Max $100-200/월. ChatGPT Plus $20/월, Teams $25/seat/월.
- **트랙션**: Claude 기준 2026-03 월간 1.4억+ 방문, 개발자 70%가 Claude Sonnet 4.6 선호 (코딩 태스크 기준). Custom GPTs는 GPT Store에 수백만 개.
- **사용자 불만 TOP 3**:
  1. 세션 간 메모리 리셋 -- "The #1 complaint in AI agent communities is memory that resets between sessions." "spending 5-10 minutes per session re-establishing context"
  2. 컨텍스트 윈도우 한계 -- 복잡한 프로젝트에서 대화가 길어지면 초기 맥락 유실
  3. 판단이 아니라 생성 -- 반론, 가정 검증, 편향 탐지 구조가 없음. 사용자가 직접 프롬프트 엔지니어링해야 함.
- **Argus와 겹치는 것**: 개발자가 "생각 정리"에 쓸 수 있음, 커스텀 인스트럭션으로 구조화 가능
- **Argus만 하는 것**: 구조화된 4R 파이프라인, 자동 anti-sycophancy, 페르소나 시뮬레이션, DQ 스코어, 저널 기반 학습. **핵심 차이: Claude/GPT는 "도구"이고, Argus는 "방법론이 내장된 도구". 누구나 Claude에게 "가정을 의심해봐"라고 말할 수 있지만, 5단계 anti-sycophancy를 일관되게 적용하는 사용자는 거의 없다.**
- **Claude/GPT가 하는데 Argus가 안 하는 것**: 범용 대화, 파일 업로드/분석, 웹 검색, 코드 실행, 이미지 생성, 수백만 종류의 태스크 처리. **Argus는 이들 플랫폼 위에서 동작하는 레이어이므로, 경쟁이 아니라 기생 관계가 맞다.**

### Replit Agent / v0.dev / Lovable

- **무엇을 하나**: "Vibe coding" 도구. 자연어로 앱 설명 → AI가 계획 + 구현 + 배포. Replit Agent 4: plan-while-building (2026), task 기반 병렬 실행, 변경 승인 전 과금 없음. v0.dev (→v0.app): Vercel 기반 풀스택 앱 빌더, step-by-step 플랜 자동 생성. Lovable: 구현 전 design/style/color 계획 먼저, Chat Mode로 전략적 개선 후 Agent Mode 실행.
- **가격**: Replit Core $25/월, v0 Premium $20/월, Lovable $20/월
- **트랙션**: Replit 4,200만+ 사용자(전체), v0 수백만 사용자, Lovable 급성장 중.
- **사용자 불만 TOP 3**:
  1. 프로토타입은 빠르지만 프로덕션 레벨 유지보수 어려움 -- "structural limitations around flexibility, backend control, scalability" (Lovable)
  2. AI가 만든 코드의 품질 불확실 -- "AI solutions that are almost right, but not quite" (개발자 45% 최대 불만)
  3. 계획 단계가 얕음 -- 비즈니스 판단, 이해관계자 검증, 리스크 평가 없이 바로 구현으로 진입
- **Argus와 겹치는 것**: "plan before build" 철학의 초보적 형태
- **Argus만 하는 것**: 판단 품질 검증 전체. 이 도구들은 "무엇을 만들까"가 이미 결정된 후의 실행 도구.
- **이 도구들이 하는데 Argus가 안 하는 것**: 실제 앱 구현, 배포, 호스팅, 실시간 미리보기, 데이터베이스 연결. **Argus의 Agent Harness 산출물이 이 도구들의 입력이 되는 구조가 자연스럽다.**

### Kiro (Amazon, 2026)

- **무엇을 하나**: Amazon의 spec-driven agentic IDE. EARS(Easy Approach to Requirements Syntax) 기반 요구사항 생성 → 아키텍처/디자인 문서 자동 생성 → 태스크 분해 → 자동화된 hook 기반 실행. AWS 서비스 깊은 연동.
- **가격**: 무료 티어 있음, 상세 미공개
- **트랙션**: 2026년 초 출시, 빠르게 주목받는 중. "6 Best Spec-Driven Development Tools" 목록에 등재.
- **사용자 불만 TOP 3**: 추가 리서치 필요 (출시 초기라 사용자 피드백 데이터 부족)
- **Argus와 겹치는 것**: spec-first 접근, 구현 전 구조화된 계획 단계, "execution agents cannot be the decision layer" 철학
- **Argus만 하는 것**: 판단 품질 검증 (다관점, anti-sycophancy, DQ). Kiro는 요구사항을 구조화하지만, 그 요구사항의 전제가 틀렸는지 검증하지 않는다.
- **Kiro가 하는데 Argus가 안 하는 것**: EARS 형식 요구사항, 코드베이스 분석 기반 아키텍처 제안, automated hooks, AWS 서비스 직접 연동, IDE 환경. **Kiro의 가장 큰 위협: Amazon 규모의 자원 + spec-driven 철학이 Argus의 상류 영역까지 확장될 가능성.**

### Scott AI (YC, 2026)

- **무엇을 하나**: "Agentic workspace for engineering team alignment." 여러 AI 에이전트가 아키텍처 설계를 병렬 탐색 → 핵심 분기점 표면화 → 인간이 선택 → 코딩 에이전트에 전달. "Execution agents cannot be the decision layer."
- **가격**: 미공개 (베타)
- **트랙션**: YC F25 배치, 초기 단계
- **사용자 불만 TOP 3**: 추가 리서치 필요 (초기 단계 제품)
- **Argus와 겹치는 것**: **가장 직접적인 경쟁 후보.** "실행 에이전트는 판단 레이어가 아니다"는 메시지가 Argus와 거의 동일. 다관점 탐색(agent swarm debate), spec alignment.
- **Argus만 하는 것**: 코드 밖의 전략적 판단, anti-sycophancy, DQ 스코어링, 판단 저널/학습, 개인 사용자 초점. Scott AI는 팀 + 코딩 에이전트 정렬에 집중.
- **Scott AI가 하는데 Argus가 안 하는 것**: 다중 에이전트 병렬 아키텍처 탐색, 팀 alignment 워크스페이스, 코딩 에이전트(Claude/Codex/Cursor) 직접 연결. **Scott AI의 존재는 "판단 레이어" 시장의 실재를 확인해준다. 동시에 YC 자금력이 있는 경쟁자가 있다는 뜻.**

### Compyle (YC F25, 2026)

- **무엇을 하나**: "The coding agent that asks before it builds." 코딩 에이전트가 자율 실행하지 않고, 먼저 질문하고 리서치/계획 아티팩트를 만든 후, 구현이 사용자 결정과 맞지 않으면 멈추고 다시 묻는다.
- **가격**: 미공개 (베타)
- **트랙션**: YC F25 배치, 2인 팀 (ex-Hadrius YC W23)
- **Argus와 겹치는 것**: "question-first, human judgment preserved" 철학이 Argus와 정렬
- **Argus만 하는 것**: 비즈니스/전략 판단, anti-sycophancy, DQ, 저널. Compyle은 코드 구현 범위에 한정.
- **Compyle이 하는데 Argus가 안 하는 것**: 실제 코드 구현, 구현 중 실시간 검증

### LinqAlpha Devil's Advocate (기관 투자 특화)

- **무엇을 하나**: 투자 가설을 압력 테스트하는 AI 에이전트. Blind spots 발견, 반론 생성.
- **트랙션**: 170+ 기관투자자 사용, 엔터프라이즈 가격
- **Argus와의 관계**: **Anti-sycophancy를 핵심 기능으로 만든 유일한 상용 제품이지만**, 투자 수직(vertical) 특화. Argus의 devil's advocate가 범용 버전. LinqAlpha의 존재는 "가정 검증 도구"에 대한 시장 수요를 확인.

### BMAD Method (오픈소스, 2025)

- **무엇을 하나**: "Breakthrough Method for Agile AI-Driven Development." Analysis → Planning → Solutioning → Implementation 4단계. 다중 AI 페르소나(Analyst, PM, Architect, Developer) 사용. PRD → User Story → Design → Implementation.
- **가격**: 무료 (오픈소스)
- **트랙션**: GitHub에서 주목받는 중, 커뮤니티 기반 성장
- **Argus와 겹치는 것**: 다중 페르소나 기반 구조화된 워크플로우, spec-first 접근
- **Argus만 하는 것**: anti-sycophancy, DQ 스코어링, 판단 저널, 수렴 추적, devil's advocate. BMAD는 "좋은 개발 프로세스"이고, Argus는 "좋은 판단 프로세스".
- **BMAD가 하는데 Argus가 안 하는 것**: 전체 SDLC 커버 (개발까지), 팀 역할 시뮬레이션(Scrum Master 페르소나 등)

---

## 2. Argus의 진짜 경쟁력 평가

### 2.1 확실한 경쟁력 (다른 제품이 구조적으로 따라하기 어려운 것)

**1. Context Contract 기반 4R 체이닝**
- 왜 따라하기 어려운가: reframe→recast→rehearse→refine 각 단계가 구조화된 계약(context contract)으로 연결되어, 다음 단계가 이전 단계의 출력을 field-by-field로 읽는다. 이것은 단순한 프롬프트 체이닝이 아니라 **타입이 있는 데이터 파이프라인**이다. 경쟁자가 비슷한 것을 만들려면 단계 간 계약 설계부터 해야 하고, 이 설계는 의사결정 이론(Thompson-Tuden, Cynefin)에 기반하므로 코딩만으로 복제 불가.
- 사용자 가치: "AI에게 한 번 질문하고 끝"이 아니라, 질문이 정제되고, 대안이 설계되고, 시뮬레이션 되고, 수렴하는 과정. 결과물의 품질이 단일 프롬프트와 구조적으로 다르다.

**2. 5단계 Anti-sycophancy 구조**
- 왜 따라하기 어려운가: Science 저널 2026-03 발표 -- "AI affirming users' actions 49% more often than humans." 모든 AI 도구가 이 문제를 갖고 있지만, **구조적으로 해결하는 제품은 0개**. Argus의 blind spot 강제, framing 차이 강제, devil's advocate 3-lens, persona softening 금지, DQ anti-sycophancy 체크리스트는 프롬프트 한 줄로 복제할 수 없는 시스템이다.
- 사용자 가치: "AI가 내 말에 동의하지 않는다"는 것 자체가 가치. 연구에 따르면 sycophantic AI는 prosocial intentions를 감소시키고 dependence를 촉진한다. Argus는 이 반대를 한다.

**3. 판단 저널 기반 적응 학습**
- 왜 따라하기 어려운가: `.argus/journal.md`에 모든 실행 이력이 축적되고, 반복되는 blind spots는 강제 추가, 전략 반복은 플래그, DQ 추세에 따라 비평 강도를 조절한다. 이것은 **시간이 지날수록 강해지는 경쟁력**(네트워크 효과가 아니라 "개인 데이터 효과"). 경쟁자가 오늘 시작해도 사용자의 과거 판단 데이터가 없으므로 같은 품질을 낼 수 없다.
- 사용자 가치: 10번 쓰면 1번 쓸 때보다 더 정확한 피드백을 받는다. /patterns로 자기 사고 패턴을 볼 수 있다.

**4. Build vs Decide 컨텍스트 분기**
- 왜 따라하기 어려운가: 같은 "계획" 도구가 product thesis/user stories/P0-P1-P2와 governing idea/storyline/execution steps를 완전히 다른 플로우로 처리하는 것은 의사결정 이론 이해 없이 설계 불가.
- 사용자 가치: 개발자가 직면하는 두 가지 근본적으로 다른 상황(만들기 vs 결정하기)에 각각 최적화된 도구를 하나로 제공.

### 2.2 주장은 하지만 실제로 약한 것 (솔직한 자기 비판)

**1. DQ 스코어링의 실제 가치 체감**
- DQ(Decision Quality) 6요소 각 0-5, 총 백분율. **이론적으로는 강력하지만**, 회의적인 개발자 관점에서 "숫자로 매긴 판단 품질"이 실제로 의미 있는지 불확실. 숫자가 높다고 좋은 결정인지, 낮다고 나쁜 결정인지의 validation이 없다. **DQ 점수가 실제 결정 결과와 상관관계가 있다는 증거가 아직 없다.**

**2. 페르소나 시뮬레이션의 깊이**
- 8개 필드(name, role, influence, decision_style 등)로 페르소나를 정의하지만, 이것은 결국 LLM 역할극이다. 연구에 따르면 LLM의 역할극은 "표면적 역할극 수준"에 머물 수 있다 (Argus 아키텍처 문서 자체도 "B 없이 C를 돌리면 Forward 단계의 신호가 표면적 역할극 수준"이라고 인정). 실제 이해관계자의 정치적 역학, 개인적 동기, 조직 내 역사적 갈등을 LLM이 제대로 시뮬레이션하기 어렵다.

**3. "30초면 시작"이라는 약속의 현실성**
- /reframe 하나는 30초일 수 있지만, 전체 파이프라인(/argus)은 5-10분. 이것은 ChatGPT에 질문 던지는 것(10초)보다 **훨씬 느리다**. 개발자가 "빨리 답 좀 줘"를 원하는 순간에 Argus의 구조화된 프로세스는 오히려 마찰이 된다. Cursor의 교훈: "생각과 실행 사이 마찰이 0에 가까울수록 습관이 된다."

**4. 3가지 산출물의 실제 사용 빈도**
- Sharpened Prompt, Thinking Summary, Agent Harness를 산출하지만, 실제로 사용자가 이 세 가지를 모두 쓰는지 데이터가 없다. Agent Harness(YAML)는 AI 에이전트 사용자에게만 의미가 있고, Thinking Summary를 팀에 실제로 공유하는 개발자가 몇 %인지 불명확.

### 2.3 경쟁력이 아닌 것 (다른 제품도 할 수 있거나 이미 하는 것)

**1. "구조화된 계획"**
- Cursor Plan Mode, Replit Plan Mode, Kiro, Superpowers, BMAD 모두 "코드 전에 계획하라"를 이미 구현. "구조화된 계획"은 Argus만의 것이 아니다. **차이는 "코드 계획"이 아니라 "판단 품질"에 있는데, 이 차이를 사용자에게 설명하기 어렵다.**

**2. "다관점"**
- Perplexity Model Council (3모델), AI Consensus (7모델 3단계), MindMesh (7에이전트 토론) 등 "여러 관점"을 제공하는 도구가 이미 존재. 차이는 Argus가 "멀티모델"이 아니라 "멀티관점"(같은 모델이 다른 이해관계자 역할)이라는 것이지만, 외부에서 보면 비슷해 보인다.

**3. "AI 코칭"**
- ChatPRD가 이미 PM 코칭을 하고 있고, 10만+ 사용자가 "it feels like having a personal coach" 라고 평가. Argus의 /patterns도 일종의 코칭이지만, ChatPRD만큼 명시적이고 접근성 높은 코칭 UX는 아니다.

---

## 3. 시장 니즈 ↔ Argus 기능 매칭

### 3.1 니즈가 있고 Argus가 잘 하는 것 (Sweet Spot)

**1. "AI가 예스맨인 것"에 대한 불만**
- 리서치: "AI affirming users' actions 49% more often than humans" (Science, 2026). "Sycophantic AI decreases prosocial intentions." 개발자 45%가 "AI solutions that are almost right, but not quite"를 최대 불만으로 꼽음.
- Argus 매칭: 5단계 anti-sycophancy, devil's advocate, 3-tier 리스크 분류가 정확히 이 니즈를 공략.

**2. "코드 전에 생각해야 한다"는 인식 확산**
- 리서치: Addy Osmani -- "Planning first forces you and the AI onto the same page." Claude Code 공식 워크플로우: Explore→Plan→Code→Commit. "The value won't come from faster typing, but from better decisions made earlier."
- Argus 매칭: 4R 파이프라인이 정확히 "코드 전 구조적 사고"를 제공. Build context에서 P0/P1/P2 기능 우선순위까지.

**3. "비코딩 업무에 쓰는 시간이 너무 많다"**
- 리서치: 개발자 50%가 주당 10시간+ 비코딩 태스크에 소비. 주당 11시간 회의. "Writing large amounts of documentation is avoided like the plague."
- Argus 매칭: /reframe 30초, /argus 5-10분으로 RFC/제안서/전략 문서의 초안 품질을 높인다. "빈 페이지" 문제 해결.

**4. "Staff+ 승진에 전략적 사고력이 필요하다"**
- 리서치: "Communication and writing skills are indispensable for pitching your ideas." "Strategic thinking is a mindset about creating the framework to drive your organization's long-term success." Staff engineer 승진에서 가장 큰 갭 = 기술적 의사결정을 설득력 있게 전달하는 능력.
- Argus 매칭: Thinking Summary로 팀에 공유, DQ 스코어로 객관적 근거, 판단 저널로 의사결정 기록 (/patterns로 성장 추적).

### 3.1+ 아직 매칭 안 된 숨겨진 Sweet Spot

**5. "메모리/맥락 유지"가 킬러 피처 — 아무도 제대로 못하고 있음**
- 리서치: "#1 complaint in AI agent communities: memory that resets between sessions." 전문가들이 "주 5시간+"을 AI에게 같은 맥락을 반복 설명하는 데 소비. Supermemory MCP는 이 하나의 문제만 풀어서 **일일 60K+ 사용자** 확보.
- Argus 매칭: `.argus/journal.md` + /patterns가 이미 이 문제를 부분적으로 해결. **그러나 이것이 사용자에게 보이지 않음.** "Argus는 당신의 지난 10개 결정을 기억하고 패턴을 분석합니다"라는 메시지가 전면에 나오면 ChatGPT/Claude 대비 즉각적 차별화 포인트.

**6. "Brag Document" + ADR — 개발자 커리어 인프라의 공백**
- 리서치: Julia Evans의 "brag document" 개념이 개발자 사이에서 대규모 채택. 2주마다 1-2문장씩 성과 기록 → 성과 리뷰, 이력서, 승진 준비에 활용. **하지만 이걸 자동화하는 도구 = 0개.** 수동 Google Docs.
- ADR(Architecture Decision Records)도 같은 패턴: AWS 공식 추천, 주요 기업 사용, 그러나 "writing and updating ADRs takes time."
- Argus 매칭: Argus의 저널은 **구조화된 의사결정 기록**. 이것을 "판단 기록 → 커리어 성장 증거"로 리프레이밍하면, Brag Doc + ADR의 자동화 버전이 되는 것. 저널 → "이번 분기 주요 의사결정 5개 요약" 자동 생성이 가능.

**7. 개발자의 실제 기획 워크플로우에서 가장 비어있는 단계**
- 리서치 (Pragmatic Engineer, Addy Osmani 등): 개발자의 실제 비코딩 문서 작성 프로세스는 7단계:
  0. **회피/미루기** → 1. 맥락 수집 → 2. 템플릿 찾기 → 3. 문제 정의 (**가장 어려움**) → 4. 초안 → 5. 자기 비평 → 6. 공유/피드백 → 7. 승인
- **Argus가 가장 큰 가치를 넣을 수 있는 단계**:
  - Step 0→1: "빈 페이지 문제" 해결. 3개 질문 → 골격 자동 생성
  - Step 3: 문제 정의 — /reframe이 정확히 이 단계. "왜"를 먼저 명확히 하도록 밀어줌
  - Step 5: 자기 비평 — "말하는 러버덕". /rehearse가 이 단계. **개발자는 AI가 문제를 풀어주는 게 아니라 "더 명확하게 생각하도록 도와주는 것"을 원함**
  - Step 6: 사전 리뷰 시뮬레이션 — 실제 공유 전에 리뷰어 반응 예측

### 3.2 니즈가 있는데 Argus가 안 하는 것 (기회)

**1. 연동 생태계 (Notion/Slack/Jira/Linear/Google Docs 내보내기)**
- 니즈 근거: ChatPRD의 핵심 가치 중 하나가 Notion/Slack/Linear 연동. 개발자의 최대 시간 낭비 요인 = "finding information" + "context switching between tools." Markdown 내보내기만으로는 부족.
- 현재 상태: Argus는 `.argus/` 폴더에 로컬 파일 저장. 클립보드 복사 외 직접 연동 없음.

**2. 팀 공유/협업 기능**
- 니즈 근거: RFC/Design Doc 프로세스의 핵심은 "피드백과 승인." "Publishing the proposal to the wider team, inviting them to ask questions." 혼자 쓰는 도구는 조직 내 확산이 어렵다.
- 현재 상태: Thinking Summary를 Slack에 공유하는 기능은 있으나, 팀이 함께 Argus 산출물에 코멘트하거나 승인하는 워크플로우는 없음.

**3. 기존 문서/코드 분석 기반 판단**
- 니즈 근거: Cursor/Kiro는 코드베이스를 직접 분석하여 맥락을 파악. ChatPRD는 기존 PRD를 업로드하면 리뷰. 현실의 판단은 "백지에서 시작"이 아니라 "기존 상황 위에서" 이루어진다.
- 현재 상태: Argus는 사용자가 텍스트로 상황을 설명해야 함. 기존 문서/코드를 입력으로 받아 자동으로 맥락을 파악하는 기능 없음.

**4. 버전 히스토리 / 반복 비교**
- 니즈 근거: "Version history allows users to debug with confidence." "Iteration becomes science rather than guesswork." ADR(Architecture Decision Records)의 핵심 = 결정의 이유와 맥락 보존.
- 현재 상태: 저널에 실행 이력은 남지만, 같은 의사결정의 v1 vs v2 vs v3를 시각적으로 비교하는 기능은 없음.

**5. MCP(Model Context Protocol) 연동**
- 니즈 근거: Manyfast의 차별점 중 하나. MCP로 기획 문서를 Cursor/Claude Code에 직접 전달. 개발자 워크플로우에 자연스럽게 들어가려면 MCP는 점점 필수.
- 현재 상태: Argus는 Claude Code 플러그인으로 동작하므로 Claude Code 내에서는 자연스럽지만, Cursor/다른 에이전트와의 MCP 연동은 없음.

### 3.3 Argus가 하는데 니즈가 불명확한 것 (리스크)

**1. DQ 스코어 수치화**
- 0-5 x 6요소를 백분율로 환산하는 것이 개발자에게 의미 있는 지표인지 검증 안 됨. 개발자는 "코드 커버리지 80%"는 이해하지만, "Decision Quality 73%"가 무엇을 의미하는지 직관적이지 않을 수 있음. 점수를 높이려고 노력하게 되는 행동 유도 효과가 있는지도 불명확.

**2. 수렴 추적 (Convergence Tracking)**
- Critical issues remaining, new issues per change, approval conditions met. 이론적으로 우아하지만, 대부분의 개발자는 1-2번 실행으로 충분하다고 느낄 가능성. "Max 3 rounds decide, 1 round build" 규칙도 있지만, 3라운드까지 가는 사용자가 몇 %인지 의문.

**3. 3가지 산출물 중 Agent Harness**
- YAML 형태의 에이전트 실행 지시서. AI 에이전트를 적극적으로 활용하는 사용자에게만 가치. 전체 개발자 중 이 수준의 AI 활용을 하는 비율은 아직 소수. 하지만 미래 가치는 높을 수 있음 -- Karpathy의 `program.md`와 구조적 동형이라는 점에서.

---

## 4. 추가 탑재 검토 대상

### 4.1 HIGH IMPACT -- 작은 노력으로 큰 차이를 만들 수 있는 것

**1. 클립보드/마크다운 원클릭 내보내기 개선**
- 무엇: Thinking Summary를 Notion/Confluence/Slack 포맷으로 원클릭 변환. 현재 마크다운은 있지만 플랫폼별 최적화 포맷이 없음.
- 왜 임팩트가 큰가: ChatPRD의 Notion 내보내기가 사용자에게 매우 높은 평가를 받음. 내보내기 품질이 도구의 "끝맛"을 결정. 개발자의 최대 시간 낭비 = 도구 간 맥락 전환.
- 구현 난이도: 낮음. 마크다운 변환 포매터 추가 수준.
- 경쟁사 현황: ChatPRD(Notion/Google Docs/Slack), Manyfast(Excel/이미지/Markdown), Cursor(Markdown 파일 저장)

**2. 기존 문서 입력 지원 (/reframe --file)**
- 무엇: 기존 PRD, RFC, 제안서 파일을 입력으로 받아 가정 추출 + 리프레이밍. "이 문서의 전제가 맞는가?"
- 왜 임팩트가 큰가: 현실의 판단은 "백지에서 시작"보다 "기존 문서 위에서" 이루어짐이 더 빈번. ChatPRD의 "기존 PRD 리뷰" 기능이 높은 사용률. Claude Code가 이미 파일 읽기를 지원하므로 기술적으로 자연스러움.
- 구현 난이도: 낮음-중간. 파일 내용을 reframe 프롬프트에 주입하는 수준.
- 경쟁사 현황: ChatPRD(기존 문서 업로드 → 리뷰), Kiro(코드베이스 분석 → 요구사항 생성)

**3. "Aha moment" 단축 -- /reframe 결과를 즉시 시각적으로 보여주기**
- 무엇: /reframe 실행 시, 숨겨진 가정을 발견하는 순간을 강조하는 UX. "당신이 놓치고 있는 3가지" 같은 핵심 인사이트를 먼저 보여주고, 상세는 접기.
- 왜 임팩트가 큰가: "Time to First Value (TTFV) is how fast users feel the 'aha' moment -- less than 5 minutes being ideal." "Reducing your product's time to value = reducing time to the aha moment." /reframe의 aha moment이 30초 이내에 오면 습관 형성 가능성이 급상승.
- 구현 난이도: 낮음. 출력 포맷 조정.
- 경쟁사 현황: Cursor Tab의 "tab-tab-tab" 흐름이 매번 미니 aha moment을 제공하여 중독성 확보.

**4. 저널 기반 /patterns의 "Before vs After" 시각화**
- 무엇: 3회 이상 실행 후, "당신의 첫 실행 때 vs 지금"의 DQ 변화, 발견 blind spot 패턴, 사고 스타일 변화를 한눈에 보여주기.
- 왜 임팩트가 큰가: Brag document 문화 -- "jot it down. One line. Two sentences max." 개발자는 자기 성장을 기록하고 싶어함. Staff+ 승진 준비에 직접 활용 가능. "Investment" 단계(Hook Model) = 사용자가 데이터를 넣을수록 떠나기 어려워짐.
- 구현 난이도: 중간. 저널 데이터 파싱 + 트렌드 계산.
- 경쟁사 현황: 이것을 하는 경쟁자 = 0개. 완전한 블루오션.

### 4.2 MEDIUM IMPACT -- 검토할 만한 것

**1. MCP 서버 제공**
- 무엇: Argus 산출물(Context Contract, Agent Harness)을 MCP를 통해 다른 AI 에이전트(Cursor, Replit 등)에 직접 전달.
- 왜 검토할 만한가: Manyfast의 MCP 연동이 차별점으로 작용. 개발자 워크플로우에서 "Argus로 판단 → MCP로 에이전트에 전달 → 구현"이 매끄러워지면 파이프라인 잠금 효과.
- 구현 난이도: 중간-높음. MCP 프로토콜 구현 + 산출물 구조화.
- 경쟁사 현황: Manyfast(MCP 구현 완료), Claude Code(MCP를 foundational로 취급)

**2. 팀 공유 링크 (읽기 전용)**
- 무엇: Argus 실행 결과를 URL 하나로 팀에 공유. 인터랙티브 리뷰 아님, 읽기 전용 렌더링.
- 왜 검토할 만한가: RFC 프로세스의 핵심 = "wider team에 publish." 현재 Slack 공유는 텍스트 덤프 수준. 깔끔한 렌더링된 링크는 "전문적으로 보이는" 효과. 팀 내 확산의 시작점.
- 구현 난이도: 중간. 웹앱 쪽 기능.
- 경쟁사 현황: ChatPRD Teams(실시간 협업), Notion(기본 제공)

**3. 프리셋 시나리오 라이브러리**
- 무엇: "스타트업 MVP 결정", "팀 구조 변경", "기술 스택 마이그레이션", "채용 vs 외주" 등 개발자가 자주 직면하는 판단 시나리오의 프리셋. 시작 시 선택하면 관련 기저율, 일반적 blind spots, 추천 페르소나가 자동 설정.
- 왜 검토할 만한가: "빈 페이지 문제" 해결. Argus의 기저율 데이터(M&A 70% 가치 파괴, IT 프로젝트 31% 성공 등)를 자연스럽게 노출. ChatPRD 템플릿 라이브러리의 판단 버전.
- 구현 난이도: 중간. 프리셋 데이터 구조화 + /reframe에 주입.
- 경쟁사 현황: ChatPRD(문서 템플릿), BMAD(역할 프리셋). 판단 시나리오 프리셋을 하는 제품 = 0개.

**4. "Quick mode" -- 전체 파이프라인 없이 단일 질문에 대한 판단 지원**
- 무엇: "이 결정 괜찮을까?" → 숨겨진 가정 3개 + 주요 리스크 2개 + 1문장 권고. 1분 이내.
- 왜 검토할 만한가: 전체 4R 파이프라인은 5-10분. 모든 판단이 그 투자를 요구하지는 않음. "작은 판단"에 대한 가벼운 도구가 있으면 일일 사용 빈도가 올라가고, 습관 형성에 유리. Cursor Tab이 "완벽한 코드 리뷰"가 아니라 "빠른 제안"으로 스티키니스를 확보한 것과 같은 원리.
- 구현 난이도: 낮음. /reframe의 경량 버전.
- 경쟁사 현황: Claude/ChatGPT에 직접 물어보는 것과의 차별화 필요. 구조화된 anti-sycophancy가 1분짜리 버전에서도 작동하는 것이 관건.

### 4.3 LOW PRIORITY -- 나중에 해도 되는 것

**1. 다중 LLM 모델 지원**
- Claude 외에 GPT, Gemini 등을 선택할 수 있게. 현재 Claude Code 플러그인이므로 Claude에 고정. Perplexity Model Council처럼 멀티모델을 쓰는 것은 "다관점"과 다르며, Argus의 핵심 가치가 아님.

**2. 모바일 앱**
- 판단의 구조화된 프로세스는 모바일에 맞지 않음. 결과 조회용 읽기 전용 뷰는 검토할 수 있으나 우선순위 낮음.

**3. 실시간 팀 협업 에디터**
- 구현 비용 대비 초기 단계에서의 가치가 불확실. 먼저 읽기 전용 공유 링크로 팀 사용 패턴을 관찰한 후 결정.

**4. 자체 AI 모델 학습**
- 사용자 판단 데이터로 fine-tuned 모델. 데이터 규모, 프라이버시 이슈, 비용 대비 현재 단계에서 불필요. Claude의 기본 능력이 충분히 강력.

---

## 5. "디테일이 차이를 만든다" -- 스티키니스 마이크로패턴

### 패턴 1: "Tab-Tab-Tab" 흐름 (Progressive Commitment)

- **왜 작동하는가**: Cursor Tab의 핵심. 제안 수락 → 다음 편집 위치 자동 하이라이트 → Tab으로 이동 + 적용. 한 번의 판단("이 제안 괜찮아?")이 다음 판단으로 자연스럽게 이어진다. "After accepting a suggestion, Cursor may highlight the next logical edit location -- pressing Tab again jumps there."
- **Argus 적용**: /reframe 결과에서 "이 가정을 검증하시겠습니까? [Y/Enter]" → 바로 /recast로 → "이 실행 계획을 시뮬레이션 하시겠습니까? [Y/Enter]" → /rehearse로. 각 단계 전환에 사용자가 "의식적으로 다음 명령어를 입력"하는 것이 아니라, Enter 하나로 다음 단계로 흘러가게.

### 패턴 2: Diff View로 신뢰 구축

- **왜 작동하는가**: Cursor의 diff view가 Git PR처럼 변경 사항을 보여주고, 라인별 accept/reject를 허용. "Giving full control and building trust in the AI's output." 사용자가 AI 출력을 통제하고 있다는 느낌이 신뢰와 습관을 만든다.
- **Argus 적용**: /refine에서 이전 버전 대비 변경 사항을 diff 형태로 표시. "이전 계획에서 수정된 3곳" 처럼 명시적으로 보여주기. 사용자가 AI의 수정을 항목별로 수락/거부할 수 있으면 "내가 통제하고 있다"는 느낌.

### 패턴 3: "Aha Moment"을 30초 이내로

- **왜 작동하는가**: "Time to First Value (TTFV) -- less than 5 minutes being ideal." GitHub Copilot의 경우 81.4%가 설치 당일 사용 시작, 96%가 당일 제안 수락. 첫 가치 체감이 빠를수록 retention이 높다.
- **Argus 적용**: /reframe의 첫 출력이 "당신이 놓치고 있는 것"을 정확히 짚어주는 순간이 aha moment. 이 순간을 가능한 한 빨리, 가능한 한 날카롭게 만들어야 한다. 장황한 분석보다 "핵심 한 문장"이 먼저 나오고, 상세는 뒤에.

### 패턴 4: Variable Reward (매번 다른 발견)

- **왜 작동하는가**: B.F. Skinner의 variable ratio schedule -- "variable reinforcement schedules produce stronger habit persistence than constant rewards." 슬롯 머신 원리. 매번 같은 결과가 아니라 "이번에는 어떤 blind spot을 찾아줄까?"라는 기대가 재사용을 유도.
- **Argus 적용**: 이미 구조적으로 작동 중. 저널 기반 학습이 매번 다른 피드백을 생성하고, 페르소나가 랜덤 요소를 갖고 있음. 이것을 더 강화하려면 "이번 실행에서 새로 발견된 것" 을 명시적으로 하이라이트.

### 패턴 5: Investment Loop (사용할수록 떠나기 어렵게)

- **왜 작동하는가**: Hook Model의 Investment 단계 -- "an investment of time and effort that ensures users will return." Obsidian의 링크 그래프, Notion의 데이터베이스, Cursor의 .cursorrules 파일 -- 사용자가 쌓은 데이터가 전환 비용을 만든다.
- **Argus 적용**: `.argus/journal.md`가 이미 이 역할. 하지만 현재는 "쌓이고 있다"는 것을 사용자가 체감하기 어려움. /patterns를 실행할 때 "10회 실행 기반, 3개 패턴 발견"처럼 축적량을 명시적으로 보여주면 전환 비용 인식이 높아진다.

### 패턴 6: Morning Workflow 편입

- **왜 작동하는가**: "Habit stacking lands when new actions attach to morning routines you already follow." "Planning tasks takes a few minutes at the end of day and saves the 'what should I work on?' decision fatigue the next morning."
- **Argus 적용**: 개발자의 아침 루틴: 이메일/Slack 확인 → Jira/Linear 보드 확인 → 코드 시작. 여기에 "오늘의 주요 판단 1개를 /reframe으로 정리"가 끼어들 수 있다면 일일 사용이 된다. 이를 위해 Quick mode(1분짜리 경량 판단 지원)가 필수적.

### 패턴 7: 외부 관점 앵커 (Outside View)

- **왜 작동하는가**: 인지과학 연구 -- "전문가는 구조적 유사성으로 문제를 분류하고, 초보자는 표면적 유사성으로 분류한다." 기저율 제시("이 유형의 결정은 역사적으로 50% 실패")가 Kahneman의 "outside view"를 자동으로 제공.
- **Argus 적용**: 이미 설계됨 (Layer 1: 도메인별 기저율). 핵심은 이 데이터를 자연스럽게 주입하는 것. "참고: 비슷한 프로젝트의 역사적 성공률은 31%입니다"가 /reframe 초반에 나오면, 사용자의 과신 편향을 즉시 교정.

---

## 6. 최종 전략 권고

### 지금 Argus의 포지션 (한 문장)

"판단 품질"이라는 미개척 카테고리에서 유일하게 구조적 해결책을 갖고 있지만, 사용자가 이 카테고리의 존재를 인식하지 못하고 있으며, 경쟁자들이 상류(판단)와 하류(실행) 양쪽에서 빠르게 확장 중이다.

### 가장 위험한 것 (한 문장)

Kiro(Amazon), Scott AI(YC) 같은 자본력 있는 플레이어가 "spec-driven" / "decision layer" 영역에 진입하면서, Argus의 시간적 우위가 빠르게 줄어들고 있다 -- 특히 Argus가 아직 트랙션 데이터(사용자 수, retention)를 확보하지 못한 상태에서.

### 가장 유망한 것 (한 문장)

개발자 45%가 "AI가 거의 맞지만 정확히 맞지 않다"를 최대 불만으로 꼽는 상황에서, anti-sycophancy + 판단 저널 기반 학습이라는 조합은 "써볼수록 강해지는 도구"로서 시간이 Argus의 해자가 되는 구조를 만들 수 있다.

### 즉시 해야 할 것 TOP 3

1. **Aha moment 30초 내 달성**: /reframe의 첫 출력을 "핵심 발견 1문장 + 숨겨진 가정 3개"로 압축하여, 사용자가 "이 도구는 다르다"를 즉시 체감하게. 장황한 분석은 접기로 숨기기. TTFV(Time to First Value)가 생존을 결정한다.

2. **Quick mode 구현**: 전체 4R 파이프라인(5-10분) 없이, 1분 이내에 "이 판단의 숨겨진 리스크 3개"를 돌려주는 경량 모드. 일일 사용 빈도를 높여 습관을 형성하지 않으면, 가끔 쓰는 도구는 잊혀진다. ChatGPT "무료로 물어보기"와의 경쟁에서 이기려면 "구조적으로 다른 답"이 1분 안에 나와야 한다.

3. **기존 문서 입력 지원 (/reframe --file)**: 백지 시작보다 기존 PRD/RFC/제안서를 던지고 "이게 맞나?"라고 묻는 사용 사례가 현실적으로 더 빈번. Claude Code가 파일 읽기를 이미 지원하므로 구현 비용 낮음. ChatPRD의 "기존 문서 리뷰"가 높은 사용률인 것이 증거.

### 하지 말아야 할 것 TOP 3

1. **문서 생성 도구로 포지셔닝하지 마라**: ChatPRD(10만+), Manyfast, Notion AI가 이미 장악한 영역. "PRD를 만들어드립니다"로 가면 레드오션에서 무자본으로 싸우는 것. Argus의 가치는 "문서를 만든다"가 아니라 "그 문서의 전제가 틀렸는지 알려준다"에 있다.

2. **기능 확장보다 핵심 경험 날카롭게 하기를 먼저**: Notion 연동, 팀 협업, MCP 서버 등은 모두 "있으면 좋은 것"이지만, /reframe의 aha moment이 무디면 아무도 연동할 동기가 없다. Superpowers가 23만 다운로드를 만든 것은 "Notion 연동" 때문이 아니라 "brainstorm-plan-execute가 체감적으로 달랐기" 때문.

3. **DQ 점수를 마케팅 전면에 내세우지 마라**: "Decision Quality 73%"는 만든 사람에게는 의미 있지만, 처음 보는 개발자에게는 "또 하나의 임의적 점수"다. 점수가 아니라 "당신이 놓치고 있는 것을 찾아줍니다"라는 구체적 결과를 전면에. DQ 점수는 파워 유저가 스스로 발견하게 두라.
