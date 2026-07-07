# 타겟 페인 포인트 & 니즈 리서치 (2026-03-30)

> 6개 병렬 리서치 결과를 종합한 레퍼런스 문서. 영어 커뮤니티(Reddit, HN, Dev.to, Indie Hackers), 한국 커뮤니티(블라인드, OKKY, velog, 브런치, 커리어리, 리멤버), 정량 서베이, 기존 솔루션 갭 분석을 포함.

---

## 1. 개발자 관점 페인 포인트

### 1.1 "내 일이 아닌데 해야 하는" 상황들

#### 구체적 상황 목록

| 상황 | 맥락 | 빈도 |
|------|------|------|
| 기획서/PRD 작성 | 스타트업 (기획자 없음) | 매우 높음 |
| 사업계획서/투자 제안서 | 기술 창업자 | 높음 |
| 피치덱 작성 | 초기 스타트업 | 높음 |
| 비즈니스 케이스/ROI 문서 | 대기업 내부 제안 | 중간 |
| 요구사항 정의서 | SI/에이전시 | 매우 높음 |
| 프로젝트 견적/제안서 | 프리랜서/에이전시 | 매우 높음 |
| 마케팅 카피/랜딩 페이지 | 인디 해커/1인 개발 | 높음 |
| 경영진 보고서 | 대기업 CTO/테크리드 | 중간 |
| 전략 문서 | 스타트업 CTO | 높음 |
| 일정 산정/스코프 정의 | 모든 환경 | 매우 높음 |

#### 실제 인용

**HN — 프로젝트 견적의 어려움:**
> "Badly. It is not a joke comment... we're bad at this. No matter how we do it, that's the thing that we should never forget."
> — HN "Ask HN: Developers, how do you estimate projects and write proposals?" (https://news.ycombinator.com/item?id=18433475)

**HN — 견적이 약속이 되는 문제:**
> "businesses/clients tend to see an estimate as a promise, or a target."
> — 같은 쓰레드

**HN — 시간이 길어질수록 무의미한 견적:**
> "if the estimate is >= 2 weeks, the estimate is worthless."
> — 같은 쓰레드

**DEV Community — 개발자가 마케팅을 싫어하는 이유:**
> Developers spend "probably 90% of their time on product and 10% on marketing, when they needed to be closer to 50-50 if they wanted to build a side project that actually made money."
> — Dev.to, Indie Hackers 다수 쓰레드

**Indie Hackers — 마케팅 혐오:**
> "I hated doing marketing, so built an AI tool to take care of it."
> — Indie Hackers post (https://www.indiehackers.com/post/i-hated-doing-marketing-so-built-an-ai-tool-to-take-care-of-it-fc67ae7f86)

**PostHog 뉴스레터 — PM이 병목이 되는 구조:**
> "PMs become the bottleneck and gatekeeper for all decisions, and engineers feel frustrated."
> — PostHog "Product management is broken. Engineers can fix it" (https://posthog.com/newsletter/product-management-is-broken)

**Quora — 요구사항을 개발자가 써야 하는 상황:**
> "Where are our requirements?" → Executive: "You'll have to write the requirements."
> — Quora, "What are the most frustrating but unavoidable aspects of a software engineer's job?"

**Stack Overflow Blog — 개발자가 하기 싫은 업무:**
> Stack Overflow 2024 Developer Survey: 41.3%의 개발자가 "meetings"을 핵심 생산성 저해 요소로 꼽았고, "tasked with non-development work"는 37.5%로 3위.
> — https://stackoverflow.blog/2025/12/10/tell-us-what-you-really-really-do-not-want-to-spend-time-working-on

**LinkedIn — 63% CTO/CIO가 비즈니스 가치 커뮤니케이션에 어려움:**
> "63% of CIOs and CTOs struggle to communicate the business value of IT to other business executives."
> — LinkedIn article, Beyond FinOps

**ZenBusiness Survey — 90%+가 직무 외 업무 수행:**
> "over 90% of respondents indicated they have undertaken tasks beyond their official job descriptions."
> — ZenBusiness Survey (검색 결과에서 인용)

### 1.2 핵심 어려움

#### 1.2.1 번역 문제 (기술 → 비즈니스 언어)

개발자의 가장 근본적 어려움은 **기술적 성과를 비즈니스 임팩트로 번역하는 것**이다.

> "When developers speak in jargon—APIs, CI/CD, microservices—the business impact often gets lost. This isn't just a communication problem; it's a strategic risk."
> — DEV Community, "Translating Tech Speak into Business Value Stories"

> "Your job isn't to simplify the tech—it's to elevate its relevance."
> — 같은 출처

**구체적 번역 실패 패턴:**
- 개발자: "We're building a new backend" → 경영진이 듣고 싶은 것: "The new backend enables real-time insights, letting sales close deals 30% faster."
- 개발자: "Improved uptime by 0.5%" → 경영진이 듣고 싶은 것: "$200K/year saved in churn and support tickets."

> "25.9% of platform teams struggle with executive buy-in, and it's not because their technical arguments are weak—it's because they're speaking the wrong language."
> — Platform Engineering blog

#### 1.2.2 구조화 문제 ("어디서부터 시작?")

> "writing clearly is very, VERY difficult." Programming compounds this challenge since software involves constant trade-offs and conditional reasoning ("it depends"), making comprehensive documentation exponentially harder."
> — Kislay Verma, "Why programmers don't write documentation" (https://kislayverma.com/programming/why-programmers-dont-write-documentation/)

> 27%의 피치덱이 founder-market fit을 확립하지 못해 실패한다. 기술 창업자들은 기술적 전문성이 비즈니스 기회로 이어지는 이유를 설명하는 데 특히 어려움을 겪는다.
> — 검색 결과 통계

**핵심 패턴**: 개발자는 "what"(무엇을 만들었나)은 잘 설명하지만, "why it matters commercially"(왜 비즈니스적으로 중요한가)를 명확히 전달하지 못한다.

#### 1.2.3 시간 문제 (코딩 시간 빼앗김)

**정량 데이터:**
- IDC 2024: 개발자는 전체 업무 시간의 **16%만 코딩**에 사용. 나머지 84%는 운영/지원 업무.
- Microsoft Research "Time Warp" 연구 (2024, 484명 MS 개발자): 실제 코딩 시간 ~11%, 미팅/커뮤니케이션 ~12%. 개발자가 **원하는** 코딩 시간 ~20%.
- Atlassian DevEx 2025 (3,500명): 50%의 개발자가 **주 10시간 이상**을 비코딩 업무에 낭비.
- Stripe Developer Coefficient: 주 **17시간**을 유지보수 작업(디버깅, 리팩토링)에 소비.
- McKinsey 2024: 개발자는 **32%만 코드 작성**, 나머지 68%는 미팅·중단·행정 업무.

> "It can take around 23 minutes to refocus after an interruption."
> — 다수 연구 인용

> "interrupted tasks take twice as long and contain twice as many errors as uninterrupted tasks."
> — Sophie Leroy "attention residue" 연구

> "developers switch tasks (or get interrupted) about 59% of the time during the day, and 29% of those interrupted tasks are never resumed."
> — Context switching 연구

#### 1.2.4 자존감 문제 ("나는 이걸 잘 못한다")

> Imposter syndrome은 **58%의 테크 직원**과 **57%의 CS 학생**에게 영향을 미친다.
> — 다수 출처 (Write the Docs, Simple Programmer, Turing 등)

> "imposter syndrome hinders programmers from taking on projects that are different from the types they usually take on, from speaking up and chipping in ideas at work."
> — Qodo.ai blog

**"Glue Work" 함정**: 비코딩 업무(온보딩, 로드맵 업데이트, 문서화)를 하는 개발자는 "not technical enough"라는 평가를 받는다.

> "Left unconscious, glue work can be career limiting and can push people into less technical roles and even out of the industry."
> — Tanya Reilly, "Being Glue" (https://www.noidea.dog/glue)

> Junior engineers who focus on glue work may receive high ratings but not promotions, being told they need to "deliver more features and be more technical."
> — 같은 출처

#### 1.2.5 피드백 루프 문제 ("이게 아닌데"의 반복)

> "clients treat estimates as promises rather than forecasts... developers look like goats 95% of the time."
> — HN 견적 쓰레드

> "they tend to treat the date/cost line as a promise, but the scope as infinitely flexible."
> — 같은 쓰레드

> "none of my customers would accept [open-ended pricing]. They have a budget and your price has to fit the budget period."
> — 같은 쓰레드

**정치적 압력**: 조직이 현실적 평가 대신 원하는 출시일로부터 역산하여 일정을 잡는 패턴. 개발자는 불가능한 타임라인을 충족하거나 미달 이유를 설명해야 하는 위치에 놓인다.

### 1.3 한국 개발자 특수 상황

#### 1.3.1 한국 스타트업/SI 문화 특유의 맥락

**기획자 없는 스타트업 (가장 빈번한 패턴):**

> "기획을 하면서 개발을 병행할 수 있을 거라고 생각했지만 생각했던 것과 달리 개발은 전혀 할 수 없었습니다. 기획도 운영면으로 접어드니 기획 일 만으로도 벅차게 되었습니다."
> — velog, "디자이너에서 개발자로, 그리고 기획자로" (https://velog.io/@juhee067)

> "처음 경험하는 기획 업무는 어렵고, 무엇이 제대로 된 기획인지조차 알기 힘들었습니다. 기획의 깊이를 가늠할 수 없었고, 개발자와의 협업에서 어느 정도의 자율성을 부여해야 할지도 감이 잡히지 않았습니다."
> — 같은 출처

**8년차 개발자의 스타트업 회고 (배진호, Medium):**

> 1. "일정을 조율해주는 사람이 없다"
> 2. "일을 주는 사람이 개발자가 아니다"
> 3. "일의 분량을 내가 예측해야 한다"
> — https://medium.com/@baejinho (스타트업 회고 1년 3개월)

기존 대기업(삼성 SDS) 프로세스: "설계 기간 → 개발 기간 → 테스트 기간 → 문서 작성 기간 → 릴리즈 → 릴리즈 확인"
→ 스타트업에서는: **"개발 → 반영"** 으로 압축.
> "원래 있어야할 기간들이 사라진 느낌"

**블라인드 — 기획자 필요성 논쟁:**

> "요구사항이 잘못전달(기획자가 요구사항을 잘못이해)" — 일정 부족과 비현실적 개발 업무 초래.
> — 블라인드, "개발직군 기획자 필요한가요?" (https://www.teamblind.com/kr/post/개발직군-기획자-필요한가요-tH0EJTTr)

> "개발자가 혼자 구상하고 논의하고 정리하고 결정하기에 힘에 부치는 상황이 있거나 직접 결정하기 어렵다고 판단될 때가 있어서 기획자가 필요할 수 있습니다."
> — 같은 쓰레드 답변

한 응답자는 한국 IT를 **"수동적이고 보수적"**이라 평하며, 대부분의 "기획자"가 전략적 사고자가 아닌 행정 지원 역할을 하고, 실제 사업 결정은 대표나 영업부서가 한다고 지적.

#### 1.3.2 블라인드/OKKY 등에서 나온 한국 특수 페인포인트

**OKKY — "개발자란 힘들다":**
5년차 Java 개발자가 입사 3일 만에 파견, 거의 매주 야근, 모니터/노트북 열악. 팀 구성원이 모두 다른 조직 소속이라 "답변이 명확하게 돌아오지 않는 경우가 많고" 자연스럽게 잡무를 떠안는 구조.
— https://okky.kr/articles/1550669

**IT직군별 동상이몽 (배진호, Medium):**
> 개발자: "말이 안되는 일정" (impossible deadlines)
> 기획자: 개발자와 디자이너 사이에서 갈등 중재자
> 대표: 개발자 채용 어려움, 왜 비싼지 이해 못함
> — https://medium.com/@baejinho

**당근마켓 창업기 — 기획자 없이 기획하기:**
개발자 7명, 디자이너 1명, 마케터 1명, 공동대표(기획 배경) 1명으로 운영. 기획을 두 가지로 분리:
1. **직관적/감각적**: 시장 통찰, 트렌드 — 소수만 가능한 희소 역량
2. **기술적/실무적**: 유저 플로우, 기능 명세 — "누구든지 할 수 있습니다"
> — 당근마켓 테크블로그 (Medium)

**주니어의 성장 착각:**
> "회사의 성장이 곧 나의 성과이자 성장의 증거가 될 거라 믿었다"
> "증명할 수 있는 기술이나 전문성 없이 '경험'만으로는 경력으로 인정받기 어렵다"
> — 브런치, "스타트업에서 성장한다는 주니어의 착각" (https://brunch.co.kr/@goodgdg/43)

**기획서 소통 비용:**
> "기획서에 다 적어놨는데도 개발자가 계속 물어본다" — 컴포넌트, State, Variant 규칙이 빠지면 질문이 폭발하고 "회의 시간이 기획서를 잡아먹는다."
> — heyaiidea.com

**"간단하죠? 해주세요" — 한국 개발자 문화의 밈:**
> "간단하죠? 해주세요" — 기획자/대표가 복잡한 기능을 이 한 마디로 요청하는 패턴. 한국 개발자 커뮤니티에서 사실상 공통 밈이 되었다.
> "개발 언어가 거의 외국어 수준이여서 소통이 안 된다"
> — velog, "오늘도 개발자가 안 된다고 말했다" 서평 (https://velog.io/@okko8522)

**"오늘도 개발자가 안 된다고 말했다" — 베스트셀러:**
이 페인 포인트가 한국에서 **책이 될 정도로** 문화적으로 공명. 비개발자가 개발자에게 무언가를 요청했을 때 "안 된다"로 돌아오는 좌절, 그리고 개발자 입장에서 기술적 제약을 비기술 언어로 설명할 수 없는 좌절 — 양쪽의 페인포인트를 동시에 대변.

**기획자 역할의 구조적 소멸:**
> "기획자는 왜 IT 기업에서 점차 사라져 가는가" — 현대 IT가 복잡해지면서(마이크로서비스, ML, 인프라) 개발자가 기획자보다 빠르게 기획을 흡수. 기획자 역할이 구조적으로 사라지면서 그 부담이 개발자에게 전이.
> — https://seokjun.kim/why-engineers-become-ceo/

**기획서 속도의 역전:**
> "기획서와 실제 제품의 속도가 거의 비슷하거나, 때로는 역전된다" — 워터폴 조직에서 "스펙 변경사항이 메일과 메신저로 협의되면서 기획서는 항상 뒤처지는 상황." 결론: "기획자는 기획서가 아니라 제품(Product)을 남겨야 한다"
> — 브런치, 마이리얼트립 Growth Lead (https://brunch.co.kr/@leoyang99/2)

**커리어리 — 직무 전환 고민:**
"개발자에서 서비스기획으로 이직하고싶어요", "27살, 기획자냐 개발자냐 그것이 문제입니다" 등 다수의 직무 전환 질문이 커리어리에서 반복적으로 등장. 이는 기획과 개발 사이의 역할 경계가 불명확한 한국 시장의 구조적 문제를 반영.
— https://careerly.co.kr/qnas/

---

## 2. 비개발자 경영진 관점 페인 포인트

### 2.1 개발자에게 기획 맡겼을 때 겪는 문제

**"오늘도 개발자가 안 된다고 말했다" — 양쪽의 좌절:**
> 개발자가 "안 됩니다"라고 말할 때, 대안 없이 대화를 닫는 것처럼 느껴진다. 이 패턴이 한국에서 베스트셀러 책 제목이 될 만큼 구조적이고 보편적인 문제.
> "일부 개발자는 방어가 아닌 공격으로 느껴질 만큼 단호하게 이야기하기도 합니다"
> — 요즘IT/Wishket, 7년차 기획자 사례 (https://yozm.wishket.com/magazine/detail/2274/)

**"나는 개발 중에 투명인간이 된다":**
> 비기술 창업자는 개발이 시작되면 기여할 방법을 모르고 소외감을 느낀다. "You're a non-technical co-founder in the process of product development, feeling a bit like a fifth wheel."
> — Vadim Kravcenko

**기대와 현실의 괴리:**
> Many founders say "I need an app" without being able to explain what that app actually does, which is like walking into a restaurant and saying "I need food" then getting frustrated when they bring you a salad instead of a steak.
> — Shawn Mayzes, "10 Things Non-Technical Founders Should Know Before Hiring"

**진행 상황 파악 불가:**
> 한 비기술 공동창업자는 "to-the-hour estimates, granular checklists so he could 'see progress'"를 요구하고 "prescribe implementation" — 비즈니스 결과 대신 구현 방식을 지시.
> — HN "Ask HN: What do non-technical founders need to know about software dev?" (41 points, 57 comments)

**기술 역량 평가 불능:**
> "Without knowing what's truly involved in technical development, founders may not realize if a feature is taking three times longer and costing three times as much as it should, and they risk being strung along with perpetual explanations about 'technical complexities'."
> — 2023 First Round Capital Survey: **68%의 비기술 창업자**가 "managing technical teams"을 최대 도전으로 꼽음.

**과도하게 기술적인 문서:**
> "Most developer experience initiatives fail not because of poor technical execution, but because they can't effectively communicate their value to decision-makers."
> — LinkedIn, IT-Business Alignment article

> "the most frustrating aspect of dealing with IT is when conversations about business solutions are shrouded with technical jargon that sounds like obfuscation and turf protection."
> — LinkedIn, "The Conundrum of IT-Business Alignment"

### 2.2 소통 갭에서 오는 좌절

**양측 모두 충분히 소통한다고 생각하지만 실제로는 아님:**
> "Both parties usually think they are communicating enough. They're usually not. Set regular check-ins."
> — HN non-technical founder 쓰레드

**과도한 요구 vs 기술적 불가능:**
> "They don't even know how little they know about software" — making it difficult to explain technical impossibilities without appearing condescending.
> — Jason Cohen, A Smart Bear blog (https://blog.asmartbear.com/non-technical-communication/)

이에 대한 반론:
> "If I cannot explain to someone who is generally reasonably intelligent something from my area of expertise then most likely it is me who is stupid."
> — 같은 글 댓글

**비개발자가 요청하는 것 vs 실제 원하는 것:**
> Non-technical founders often "suggest solutions that are round-about or overly complicated" when describing problems rather than asking developers what's actually needed.
> — HN 쓰레드

### 2.3 한국 스타트업 경영진 특수 상황

**스타트업 실패의 65%가 인적 요인:**
> 하버드 경영대학원 노암 와서만 교수가 1만 명 이상 창업자 데이터 분석 결과.
> — 이코노미조선 (https://economychosun.com/client/news/view.php?boardName=C22&t_num=13607387)

**한국 스타트업의 소통 실패 패턴:**
> "불완전한 아이디어를 직원들과 함께 개발하려 하면 '무언가 이상한 물건이 나의 의사와 상관없이 나왔다'는 결과가 나온다."
> "형용사를 남발하는 것이 아니라 구체적인 수치와 설명으로 요구사항을 바꾸어라."
> — 브런치, "스타트업, 그렇게 실패한다." (https://brunch.co.kr/@supims/12)

**기획서가 없는 개발의 결과:**
> "신뢰 관계 없이는 애자일스러운 개발은 그냥 꿈일 뿐입니다."
> — 같은 출처

**개발 견적의 블랙박스:**
> "개발 견적에 대한 정확한 기준 부재"로 인해 대표는 개발자의 요구를 신뢰하기 어렵다. "개발 일정이 여러 개발자에게 물어보면 다 달라서 감잡을 수 없을때" 기획 자체가 어려워진다.
> — IT 직군별 동상이몽 (Medium)

**대표의 현실:**
> 대표들은 "쿠팡 같은 서비스 만들어보자"고 제안하면 개발자들이 거부하는 경험. "꿈은 큰데 현실 가능성이 떨어져보일때" 갈등 발생.
> — 같은 출처

---

## 3. AI 시대가 만든 새로운 압력

### 3.1 "개발자도 다 해야 하는 시대"

**역할 확장의 현실:**
> "In 2025, four in 10 developers said AI had already expanded their career opportunities, and close to seven in 10 expect their role to change even further in 2026."
> — Stack Overflow 2025 Developer Survey

> "65% of developers expect their role to be redefined in 2026, moving from routine coding toward architecture, integration and AI-enabled decision-making."
> — 같은 출처

> "A survey of over 500 senior developers found that 74% expecting to move from hands-on coding towards designing technical solutions, and 50% anticipating an increased focus on strategy and architecture."
> — 별도 서베이

**Boris Cherny (Claude Code 창시자, 2026):**
> "It's just going to be replaced by 'builder,' and it's going to be painful for a lot of people."
> — Fortune (https://fortune.com/2026/02/24/will-claude-destroy-software-engineer-coding-jobs-creator-says-printing-press/)

Anthropic에서 **70-90%의 코드가 AI 생성**. Cherny 본인은 2025년 11월부터 100% Claude Code로 코딩, 하루 10-30개 PR을 수동 편집 없이 배포. 그의 팀에서는 **모든 직군이 코딩** — PM, 디자이너, 엔지니어링 매니저, 재무팀까지.

> "The strongest engineers also have aptitude for design, infrastructure, or business."
> — Pragmatic Engineer 인터뷰 (https://newsletter.pragmaticengineer.com/p/building-claude-code-with-boris-cherny)

**AI 기반 해고 — 잠재력에 의한 선제적 구조조정:**
> HBR (2026.01): 1,006명 글로벌 임원 서베이 — **60%** 조직이 AI의 잠재적 영향을 예측하여 인원 감축. **단 2%만** 실제 검증된 AI 성과에 기반한 감축.
> Klarna: 40% 인력 감축 후, "lower costs had also led to lower quality"로 고객 서비스 직원 재고용.
> — HBR, "Companies Are Laying Off Workers Because of AI's Potential, Not Its Performance" (https://hbr.org/2026/01/companies-are-laying-off-workers-because-of-ais-potential-not-its-performance)

**Task Expansion (업무 확장) 현상:**
8개월 간의 200인 기술 회사 민족지학(ethnographic) 연구:
> "Product managers wrote code, researchers took on engineering tasks, and employees attempted work they would have previously outsourced or avoided. AI made these tasks feel 'newly accessible' and provided an 'empowering cognitive boost.'"
> — Harvard Business Review, "AI Doesn't Reduce Work—It Intensifies It" (https://hbr.org/2026/02/ai-doesnt-reduce-work-it-intensifies-it)

> "You had thought that maybe...you could be more productive with AI, then you save some time, you can work less. But then really, you don't work less. You just work the same amount or even more."
> — 같은 연구, 엔지니어 인터뷰

### 3.2 팀 축소 + 역할 확장 트렌드

**솔로 파운더 급증:**
- 2019년: 신규 스타트업의 **23.7%**가 솔로 파운더
- 2024년: **35%** (Carta 데이터)
- 2025년 상반기: **36.3%** (Carta Solo Founders Report 2025)
> — https://carta.com/data/solo-founders-report/

**스타트업 팀 사이즈 축소:**
- Seed 라운드 소비자 스타트업 평균 직원 수: 2022년 **6.4명** → 2024년 **3.5명**
> — https://carta.com/data/startup-headcounts-2024/

> "A 5-person team in 2026 can ship what a 50-person team shipped in 2016."
> — Andres Max, "Are Large Software Teams Still Relevant in the Age of AI?"

> "What took 5-7 people now being done by 2-3."
> — 같은 출처

**Entry-level 채용 급감:**
> Ravio Tech Hiring 2025: 신입(P1/P2) 채용 **73.4% 감소**. AI/ML 채용은 88% 증가, 행정직 채용은 35.5% 감소.
> — https://ravio.com/blog/tech-hiring-trends

**한국 시장:**
> "스타트업까지 작지만 강한 팀, 다기능·융합형 인재 중심의 조직 구조로 재편되고 있습니다."
> — 코드트리 블로그, "2025년 개발자 채용 트렌드와 2026년 전망"

> 한국 IT 스타트업 채용 공고 급감, 신입 채용 비중 2021년 대비 절반 이하.
> — 같은 출처

> 카카오, LINE, 쿠팡, 배민, 당근, 토스 등 주요 한국 테크기업이 2025년 신입 개발자 공개채용 계획 **없음** (네이버 제외).
> — 같은 출처

### 3.3 AI 도구가 만든 역설적 기대

**METR 연구 — AI 생산성의 인지 착각 (2025.07):**
> 16명의 숙련 오픈소스 개발자(평균 22K+ stars, 1M+ lines 레포) 대상 무작위 대조 시험.
> AI 도구 사용 시 **19% 느려졌지만**, 본인은 24% 빨라졌을 거라 예측했고, **끝난 후에도 20% 빨라졌다고 믿었음**.
> 시간의 상당 부분이 AI가 생성한 코드를 정리하는 데 소비됨.
> — METR (https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)

**Toss Tech — 디자이너 없이 개발자가 UI까지:**
> 디자인 시스템을 충분히 견고하게 만든 후, **6개월 내에 개발자가 디자이너 없이 독립적으로 UI 제작**. 개발자의 역할 경계가 디자인까지 확장되는 실제 사례.
> — Toss Tech Blog (https://toss.tech/article/removing_designers_in_ai_era)

**'AI Brain Fry' — 도구 피로 (BCG, 2026.03):**
> 1,488명 미국 직장인 서베이. AI 도구 **4개 이상** 사용 시 생산성 오히려 하락.
> 14% 더 많은 정신적 노력, 12% 더 많은 정신적 피로, 19% 정보 과부하 증가.
> **34%**의 "brain fry" 경험자가 퇴사 의향. 물리적 증상: "fog" 또는 "buzzing".
> — Fortune (https://fortune.com/2026/03/10/ai-brain-fry-workplace-productivity-bcg-study/)

**가장 먼저 AI를 받아들인 사람이 가장 먼저 번아웃 (TechCrunch, 2026.02):**
> 효율성 향상이 근무 시간 감소로 이어지지 않음. 기대가 확대되어 여유 시간을 모두 흡수.
> "Work began bleeding into lunch breaks and late evenings. Their to-do lists expanded to fill every hour that AI freed up, and then kept going."
> — TechCrunch (https://techcrunch.com/2026/02/09/the-first-signs-of-burnout-are-coming-from-the-people-who-embrace-ai-the-most/)

**Vibe Coding의 양면:**
Andrej Karpathy가 2025년 2월 명명. 2025년 말 조사: **84%의 개발자**가 AI 코딩 도구 사용 중/계획, **51%**가 매일 사용. Y Combinator 2025 Winter batch의 **25%**가 코드베이스의 95%를 AI로 생성.

> "Rapid creation is getting commoditized, while professional engineering judgment is becoming more valuable, not less."
> — Vibe Coding 가이드 (다수 출처)

**AI 생산성의 역설:**
> "developers are saving 10 hours a week using AI and losing 10 hours a week to inefficiencies."
> — Atlassian State of Developer Experience 2025

> "66% of developers say they are spending more time fixing 'almost-right' AI-generated code."
> — Stack Overflow 2025

> Experienced open-source developers were **19% slower** when using AI coding tools, despite predicting they would be 24% faster and still believing afterward they had been 20% faster.
> — 검색 결과 인용 연구

**'AI Brain Fry' 현상:**
> Fortune (2026-03-10): BCG 연구에 따르면 AI 도구가 피로를 줄이지 않고 오히려 증가시킴. "AI brain fry is real—and it's making workers more exhausted, not more productive."
> — https://fortune.com/2026/03/10/ai-brain-fry-workplace-productivity-bcg-study/

**10x Engineer 신화의 변질:**
> "The 10x engineer of the past was a mythical coder who single-handedly built empires, but in today's world... the most valuable engineers are the ones who lift others, simplify decisions, and guide teams toward impact."
> — DEV Community, "The 10x Engineer in 2026"

> "Roles in tech are converging, and by 2026, the traditionally separate roles of Product Manager, Designer, and Engineering Manager might evolve into a unified 'Full-Stack Product Lead'."
> — Medium, "Product Management in 2025"

### 3.4 정량 데이터

| 지표 | 수치 | 출처 |
|------|------|------|
| 개발자가 코딩에 쓰는 시간 비율 | **16%** (2024) | IDC "How Do Software Developers Spend Their Time?" |
| 실제 코딩 시간 (MS 개발자) | **~11%** | Microsoft Research "Time Warp" (2024, n=484) |
| 비코딩 업무에 주 10시간+ 낭비 | **50%** | Atlassian DevEx 2025 (n=3,500) |
| 비코딩 업무에 주 6시간+ 낭비 | **90%** | 같은 출처 |
| AI로 주 10시간+ 절약 | **68%** | 같은 출처 |
| AI 도구 사용 중 개발자 | **85%** (2025) | JetBrains Dev Ecosystem 2025 (n=24,534) |
| AI 코딩 보조 사용 | **62%** | 같은 출처 |
| 미팅이 생산성 저해 1위 | **41.3%** | Stack Overflow 2024 |
| "비개발 업무 부여"가 저해 요소 | **37.5%** | 같은 출처 |
| 기술 부채가 최대 불만 | **62%** | Stack Overflow 2025 |
| 개발자 번아웃 (critical) | **22%** | LeadDev Survey (2025.03) |
| 개발자 번아웃 (moderate) | **25%** | 같은 출처 |
| "리더가 내 페인포인트를 모른다" | **63%** (전년 44%) | Atlassian DevEx 2025 |
| 역할 재정의 예상 (2026) | **65%** | 다수 서베이 종합 |
| 전략/아키텍처 집중 증가 예상 | **50%** | 500+ 시니어 개발자 서베이 |
| 현재 메트릭이 실제 기여를 반영하지 못함 | **66%** | JetBrains 2025 |
| 솔로 파운더 비율 (2025) | **36.3%** (2019년 23.7%에서 증가) | Carta Solo Founders Report 2025 |
| Seed 스타트업 평균 직원 (2024) | **3.5명** (2022년 6.4명) | Carta |
| AI 코드의 major issues 발생률 | **1.7배** (인간 대비) | CodeRabbit 분석 (2025.12, n=470 PR) |
| AI 코드의 보안 취약점 | **2.74배** (인간 대비) | 같은 출처 |
| AI로 인해 번아웃 증가 | 8개월 200인 연구 확인 | HBR 2026.02 |
| AI 도구 4개+ 사용 시 생산성 하락 | 14% 정신적 노력 증가, 34% 퇴사 의향 | BCG 2026.03 |
| 숙련 개발자 AI 사용 시 속도 | **19% 느려짐** (본인은 빨라졌다고 착각) | METR 2025.07 (n=16) |
| AI 잠재력 기반 선제적 해고 | **60%** 조직 (실제 검증 기반은 2%) | HBR 2026.01 (n=1,006) |
| 신입(P1/P2) 채용 감소 | **73.4%** | Ravio 2025 |
| 주당 미팅 시간 | **~11시간** (대기업 12.2h) | 다수 서베이 |
| 실제 코딩 시간 (하루 중앙값) | **52분** | Software.com (n=250K+) |
| 컨텍스트 스위칭으로 30-60분 집중력 손실 | | Sophie Leroy "attention residue" 연구 |
| 컨텍스트 스위칭 연간 글로벌 비용 | **$450B** | 다수 출처 |
| 반복 수작업에 소비하는 시간 | **36%** | Harness 2026 (n=700) |
| AI 리더십 의사결정 활용 vs 잘 관리 | **60%** 활용, **5%** 잘 관리 | Deloitte 2026 |

---

## 4. 기존 솔루션과 갭

### 4.1 현재 사용되는 도구들

#### 범용 AI (ChatGPT, Claude)
- 가장 많이 사용되는 "기획서 작성" 도구
- 프롬프트에 따라 기획서, 제안서, 사업계획서 초안 생성 가능

#### 기획서/PRD 전문 도구
| 도구 | 포지셔닝 | 사용자 규모 | 특징 |
|------|----------|------------|------|
| **ChatPRD** | PM용 AI 코파일럿 | 10만+ 설치 | PRD 생성, 코칭, Notion/Slack 연동 |
| **Manyfast** | AI 기획 에디터 | 500+ 베타 | PRD, 기능명세, 플로우차트 자동 생성 |
| **Gamma** | AI 프레젠테이션 | 수백만 | 프레젠테이션/문서 자동 생성 |
| **Tome** | AI 스토리텔링 | 수백만 | 스토리 중심 프레젠테이션 |
| **Beautiful.ai** | 디자인 중심 프레젠테이션 | — | 자동 레이아웃 |

#### 사업계획서 전문 도구
| 도구 | 특징 |
|------|------|
| **LivePlan** | 재무 모델링 중심, Reddit에서 높은 평가 ("helped secure a $4 million acquisition") |
| **PrometAI** | AI 기반 투자자용 사업계획서, 재무 예측 |
| **Plannit.AI** | 초보 창업자용, 가이드식 AI 지원 |
| **Venture Planner** | 단계별 AI 계획 생성기 |

#### 제안서 도구
| 도구 | 특징 |
|------|------|
| **PandaDoc** | 문서 관리 + 결제 + 분석 통합 |
| **Proposify** | 디자인 중심, 에이전시/프리랜서 |
| **Qwilr** | 인터랙티브 웹 기반 제안서 |
| **Better Proposals** | 개발자 제안서 템플릿 제공 |

#### 한국 도구
| 도구 | 특징 |
|------|------|
| **다글로 AI** | 기획서 자동 초안 생성 (10분) |
| **이드로우마인드(EdrawMind)** | 아이디어→기획서 구조화 AI |
| **Notion AI** | 범용 워크스페이스 내 AI |

#### 프로젝트 관리/커뮤니케이션
- Jira, Confluence, Slack, Notion — 협업에는 좋지만 "기술→비즈니스 번역" 기능 없음

### 4.2 각 도구의 한계

#### ChatGPT/Claude (범용 AI)
> "ChatGPT sometimes gives generic, shallow answers to questions it used to handle adeptly."
> — TechRadar, Blue Avispa 등 다수

- **맥락 부재**: 사용자의 기술 스택, 비즈니스 상황, 조직 맥락을 모름
- **구조 부재**: 매번 "기획서 써줘"라고 해도 프레임워크 없이 generic한 결과
- **반복 불가**: 이전 판단의 맥락이 유지되지 않음
- **비판 부재**: 항상 사용자 의견에 동조 (sycophancy)

> "AI-written text overusing tropes or defaulting to 'gray goo' storytelling: technically competent, yet emotionally disengaged."
> — 검색 결과

> "LLMs hallucinate more than they help unless the task is narrow, well-bounded, and high-context. Chaining tasks sounds great until you realize each step compounds errors."
> — Reddit AI agent developer

#### Notion AI
- **가격 장벽**: Business 플랜 필요 ($20/user/month)
- **대용량 데이터 성능 문제**: 문서가 커지면 느려짐
- **오프라인 미지원**: "single most requested feature for years"
> — Notion AI 2025-2026 리뷰 다수

#### Gamma / Tome
- Gamma: "output often felt more like a document than a deck, with text-heavy slides"
- Gamma: 다른 도구(Slack, Figma, Notion)와 통합 부족
- Tome: 무료 티어 제한적, "autoformatting doesn't work as well as Gamma's, with slides usually overloaded with text"
> — Plus AI, Alai Blog 리뷰

#### ChatPRD
- **PM 특화**: 개발자가 비즈니스 문서를 쓰는 용도로 설계되지 않음
- **판단 레이어 없음**: 전제 의심, 다관점 검증, anti-sycophancy 미지원
- 문서 생성기이지 판단 도구가 아님

#### Manyfast (한국)
- **판단 레이어 없음**: 전제 의심, 다관점, anti-sycophancy 모두 미지원
- 500+ 베타 사용자, MoM 성장률 0% (2026.03 기준)
- PRD/기능명세 자동 생성은 하지만 "왜 이것을 만들어야 하는가"에 대한 질문은 안 함

#### 사업계획서 도구 (LivePlan, PrometAI 등)
- **개발자 맥락 부재**: 기술적 배경에서 비즈니스 가치를 추출하는 기능 없음
- 일반 창업자/경영인 대상 설계
- 재무 모델링에 특화, "왜 이 기술이 비즈니스적으로 가치가 있는가" 번역 미지원

#### 제안서 도구 (PandaDoc, Proposify 등)
- **문서 포맷팅/전송에 특화**: 내용의 quality는 사용자가 책임
- AI 기능은 있으나 "기술 → 비즈니스 번역"이 아닌 "어조 교정" 수준
- 2026년 대부분 AI writing assistant 내장했지만, 도메인 맥락 이해 없음

### 4.3 아직 채워지지 않은 니즈 (= Argus 기회)

#### Gap 1: "기술적 맥락에서 비즈니스 문서를 생성하는" 도구가 없다
- 모든 기존 도구는 **비즈니스 → 비즈니스** (경영인이 경영 문서를 쓰는 것) 전제
- **기술 → 비즈니스** 번역은 어떤 도구도 핵심 기능으로 제공하지 않음
- 개발자가 자신의 기술적 작업/프로젝트를 입력하면 비즈니스 가치 프레이밍을 자동 생성하는 도구 = 시장 공백

#### Gap 2: "어디서부터 시작해야 하는지" 구조를 잡아주는 도구가 없다
- ChatGPT에 "기획서 써줘"라고 하면 generic template 출력
- **문제 정의 → 가정 발견 → 구조화 → 비즈니스 프레이밍** 순서를 안내하는 도구 부재
- Argus의 4R(Reframe → Recast → Rehearse → Refine) 파이프라인이 정확히 이 갭

#### Gap 3: "내가 쓴 것이 괜찮은지" 검증해주는 도구가 없다
- AI 도구들은 문서를 생성하지만 **비판적 검토를 하지 않음**
- 경영진/투자자 관점에서 "이게 설득력 있는가"를 사전 검증하는 기능 부재
- Argus의 Rehearse(페르소나 사전 검증) + Refine(수렴 루프)이 이 갭

#### Gap 4: "반복 사용할수록 나아지는" 도구가 없다
- 모든 기존 도구는 stateless (매번 처음부터)
- 이전 판단의 패턴, 자주 놓치는 가정, 성공/실패 이력을 학습하는 도구 = 0개
- Argus의 judgment data flywheel 개념

#### Gap 5: 한국 시장 특수 도구 부재
- 한국어 기획서 작성에 특화된 AI 도구가 사실상 없음
- 다글로 AI, 이드로우마인드 등이 있으나 "개발자→기획" 특화 아님
- "한국 스타트업 개발자가 대표에게 보여줄 기획서"를 전문으로 만들어주는 도구 = 완전한 공백
- FastCampus에서 "AI 도구로 기획하기" 유료 강좌 다수 운영 중 — **수요는 확인되었으나 제품이 없다**는 방증

#### Gap 6: "AI 피드백 받기 전에 사고를 구조화하는" 도구가 없다
- Microsoft Research CHI 2025 "Tools for Thought": ExtendAI 프로토타입 — 사용자가 AI 피드백 받기 **전에** 자기 추론을 먼저 명확히 하도록 유도. "AI as an assistant is about speed. AI as a tool for thought is about depth."
- **Argus의 4R 파이프라인과 거의 동일한 구조**이지만, 이것은 학술 연구이지 제품이 아님
- 같은 연구: "Higher confidence in GenAI = less critical thinking" — AI 의존도가 높을수록 비판적 사고 감소
> — https://www.microsoft.com/en-us/research/blog/the-future-of-ai-in-knowledge-work-tools-for-thought-at-chi-2025/

#### Gap 7: 다관점 시뮬레이션 도구가 없다
- AI Consensus ($299/seat): 같은 질문을 **7개 모델에 돌려서 비교** — 다른 모델, 같은 관점
- 고유한 동기와 관심사를 가진 **이해관계자 시뮬레이션**을 하는 제품은 0개
- Cloverpop ($17M 투자유치): 의사결정을 추적하지만 **개선하지는 않음**
- Deloitte 2026: "60% of executives use AI in decisions, only 5% manage it well"

---

## 5. 핵심 인사이트 요약

### 가장 빈번하게 등장하는 페인포인트 TOP 5

| 순위 | 페인포인트 | 출현 빈도 | 핵심 맥락 |
|------|-----------|----------|----------|
| **1** | **기술 → 비즈니스 언어 번역 불능** | 6개 리서치 모두 | 63% CTO/CIO가 어려움 인정. 경영진은 ROI 원하고 개발자는 기능 설명. |
| **2** | **"어디서부터 시작해야 할지 모르겠다"** | 영어/한국 개발자 모두 | 기획서/제안서/사업계획서의 구조 자체를 모름. "처음 경험하는 기획 업무는 어렵고, 무엇이 제대로 된 기획인지조차 알기 힘들었습니다." |
| **3** | **코딩 시간 빼앗김 (84%가 비코딩 업무)** | 정량 데이터 다수 | IDC: 16%만 코딩. 미팅 11시간/주. 50%가 주 10시간+ 낭비. |
| **4** | **팀 축소 → 1인 다역 강요** | AI 시대 + 한국 특수 | 솔로 파운더 36.3%. Seed 평균 3.5명. "기획도 하고 개발도 하고." |
| **5** | **AI 도구의 generic output** | 도구 갭 분석 | "gray goo storytelling." 맥락 부재. 반복 불가. 비판 없음. |

### 가장 강렬한 감정적 반응을 보인 주제들

1. **"개발자인데 기획하라고?"의 정체성 위기**
   - 한국 커뮤니티에서 가장 감정적 반응. 블라인드, OKKY에서 퇴사 고민과 직결.
   - "기획을 하면서 개발을 병행할 수 있을 거라고 생각했지만 개발은 전혀 할 수 없었습니다."

2. **Glue Work의 커리어 함정**
   - 비코딩 업무를 많이 하면 "not technical enough" 평가. 승진 차단.
   - 가장 유능한 엔지니어가 가장 나쁜 퍼포머로 보이는 역설.

3. **AI가 일을 줄이는 게 아니라 늘린다는 깨달음 (+ 인지 착각)**
   - "You don't work less. You just work the same amount or even more."
   - BCG 연구: "AI brain fry is real." — 도구 4개+ 사용 시 생산성 오히려 하락
   - METR: 숙련 개발자가 AI로 19% 느려졌는데도 빨라졌다고 착각 — **자기 기만의 구조**
   - 가장 먼저 AI를 받아들인 사람이 가장 먼저 번아웃 (TechCrunch)

4. **견적이 약속이 되고, 스코프는 무한히 늘어나는 구조**
   - 프리랜서/에이전시 개발자에게 가장 고통스러운 패턴.

5. **경영진의 "왜 이렇게 오래 걸려?"와 개발자의 "당신이 뭘 원하는지 말을 안 해줬잖아"**
   - 양측 모두 좌절하는 구조적 소통 실패.

### Argus가 해결할 수 있는 구체적 시나리오

**시나리오 1: "대표님이 기획서 한번 써보라고 했다"**
- 개발자가 Argus에 기술적 프로젝트를 입력
- Reframe: 숨겨진 비즈니스 가정 발견 ("이 기능을 만드는 진짜 이유가 뭐지?")
- Recast: AI/인간 역할 분배 ("이 부분은 AI가 초안, 이 부분은 네가 판단")
- Rehearse: 경영진 관점 페르소나가 사전 비평 ("투자자가 이걸 보면 뭐라고 할까?")
- Refine: 이슈 해소까지 반복
- **산출물**: 비즈니스 프레이밍이 된 기획서 초안 + 경영진에게 공유할 요약

**시나리오 2: "혼자서 사업계획서를 써야 하는 기술 창업자"**
- 기술적 해결책은 있지만 "왜 이것이 돈이 되는지" 프레이밍 불능
- Argus가 "why it matters" 번역 + 투자자 관점 사전 검증

**시나리오 3: "프리랜서 개발자의 프로젝트 제안서"**
- 견적과 스코프를 비즈니스 가치로 번역
- 클라이언트가 이해할 수 있는 언어로 변환
- "견적 ≠ 약속" 프레이밍 자동 포함

**시나리오 4: "CTO가 경영진에게 기술 투자를 설득해야 할 때"**
- "We're building a new backend" → "이것이 매출에 미치는 영향은 X"
- 63% CTO가 어려워하는 정확히 그 문제를 구조화된 파이프라인으로 해결

**시나리오 5: "스타트업 개발자가 PM 없이 PRD를 써야 할 때"**
- ChatPRD와 달리 "이것을 왜 만들어야 하는가"부터 질문
- 가정 발견 → 우선순위 → 구현 계획 순서로 안내

**시나리오 6: "디자이너 없이 UI 기획까지 해야 하는 풀스택 개발자"**
- Toss Tech 사례처럼 디자이너 역할까지 확장된 개발자
- 사용자 관점 프레이밍 → 비즈니스 임팩트 정리 → 이해관계자 사전 검증

**시나리오 7: "AI 도구를 쓰는데 generic한 결과만 나와서 좌절"**
- ChatGPT에 "기획서 써줘"→ 맥락 없는 템플릿 출력
- Argus: 질문부터 시작 (Reframe) → 맥락을 만든 후 → 그 맥락으로 결과 생성

---

## 출처 인덱스

### 정량 데이터 주요 출처
- IDC "How Do Software Developers Spend Their Time?" (2024)
- Microsoft Research "Time Warp: The Gap Between Developers' Ideal vs Actual Workweeks in an AI-Driven Era" (2024, n=484)
- Microsoft Research CHI 2025 "Tools for Thought" — ExtendAI 프로토타입, AI 비판적 사고 연구
- Atlassian "State of Developer Experience Report 2025" (n=3,500)
- Stack Overflow Developer Survey 2024, 2025
- JetBrains Developer Ecosystem Survey 2024 (n=23,262), 2025 (n=24,534)
- GitHub Octoverse 2025
- Carta Solo Founders Report 2025, Startup Headcounts 2024
- HBR "AI Doesn't Reduce Work—It Intensifies It" (2026.02)
- HBR "Companies Are Laying Off Workers Because of AI's Potential" (2026.01, n=1,006)
- BCG "AI Brain Fry" Study (2026.03, n=1,488)
- METR AI Productivity RCT (2025.07, n=16 experienced OS developers)
- LeadDev Burnout Survey (2025.03)
- DORA Report 2025
- Ravio Tech Hiring Trends 2025-2026
- Harness State of DevOps Modernization (2026, n=700)
- Software.com Code Time Report (n=250K+)
- Cortex State of Developer Productivity 2024
- Deloitte "AI and the Future of Human Decision-Making" (2026)
- Mercury Startup Economics Report 2025 (n=1,500)
- CodeRabbit AI Code Quality Analysis (2025.12, n=470 PRs)
- First Round Capital Survey (2023): 68% 비기술 창업자가 tech team 관리를 최대 도전으로 꼽음

### 한국 출처
- 블라인드 (teamblind.com/kr)
- OKKY (okky.kr)
- 브런치 (brunch.co.kr)
- velog (velog.io)
- 커리어리 (careerly.co.kr)
- 리멤버 커뮤니티 (community.rememberapp.co.kr)
- Medium 한국어 포스트 (배진호 @baejinho 등)
- 당근마켓 테크블로그
- Toss Tech Blog (toss.tech)
- 이코노미조선
- 코드트리 블로그
- 플래텀 (platum.kr)
- 요즘IT/Wishket (yozm.wishket.com)
- "오늘도 개발자가 안 된다고 말했다" (김정철 & 김수지, 단행본)
- seokjun.kim — "기획자는 왜 IT 기업에서 점차 사라져 가는가"

### 영어 출처
- Hacker News (news.ycombinator.com)
- Indie Hackers (indiehackers.com)
- DEV Community (dev.to)
- Stack Overflow Blog
- PostHog Newsletter
- A Smart Bear blog (Jason Cohen)
- Tanya Reilly "Being Glue" (noidea.dog/glue)
- Fortune — Boris Cherny 인터뷰, AI Brain Fry
- TechCrunch — AI 번아웃 분석
- Pragmatic Engineer Newsletter — Boris Cherny, Writing in Tech
- METR — AI 생산성 RCT
- Vadim Kravcenko — Non-technical founder 가이드
- Percolator Substack — Non-technical founder 가이드
- Various LinkedIn, Medium/Substack posts
