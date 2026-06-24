# Argus 수요·시장·GTM + 고객여정 감사 (2026-06-24)

> 14-agent ultracode 워크플로우(argus-demand-gtm-audit, wf_5699649c). 엔지니어링이 아니라
> **수요·ICP·가격·해자·낯선 사람의 cold-start 여정**을 외부 증거로 친 뒤, 발견마다 "진짜냐
> founder 자뻑이냐"를 적대적으로 검증(§8이 버린 목록 = 필터가 작동한 증거). 다른 세션의 *내부*
> 귀환루프 감사(journey-fixes)와 안 겹치는 각도. 위로 없이, 사실만.
>
> 근거: 외부 시장 증거 + Argus 자체 텔레메트리(13유저 / 47프로젝트 / 0 sealed / 0 settled).

---

## 1. 가장 불편한 진실 1개

**해자(moat)라고 부르는 그것은 "아직 증명 안 된 가설"이 아니라, 너 자신의 데이터가 이미 반증하고 있는 주장이다.**

Argus의 전체 방어선은 "사용자가 결정→예측→정산(decide→predict→settle)을 반복하며 쌓이는 n=1 calibration history"다. 그런데 자체 계기판은 이렇게 말한다: **사용자 13명, 프로젝트 47개, 봉인된 contract 0개, 정산된 것 0개.**

이게 왜 치명적인가:
- 47번은 "생성·orientation 문" 이 열렸다는 뜻이다. 즉 드롭오프는 입구(로그인 버그)가 아니라 **정확히 해자가 사는 그 꼬리(seal→settle)에서** 100% 일어난다.
- 망가진 회원가입 문 탓을 할 수 없다. 문은 47번 열렸으니까.
- 이 47명은 세상에서 가장 동기부여된 코호트다 — 창업자가 직접 고른 얼리 유저. 그들조차 0%가 핵심 루프를 끝냈다.
- **창업자 본인도 자기 도구에서 contract를 단 한 번도 정산하지 않았다.** 이건 루프가 애초에 완주 가능하고/가치 있는 형태로 지어졌는지에 대한 약한 반증이다.

결론: "해자는 n=1 calibration history" 는 현재 *미증명*이 아니라 *반증된* 상태다. 가장 동기부여된 사람들이 0% 완주율을 기록했고, 그중엔 너도 포함된다.

---

## 2. 수요는 진짜인가? — 판정: **JTBD는 진짜, 그러나 Argus의 형식(format)에 대한 수요는 wishful**

**상위 문제(JTBD)는 거대하고 실재한다.** "어려운 결정을 같이 생각해줘"는 ChatGPT가 주당 8억~9억 명에게 무료로, 마찰 0으로 이미 해결해주는 일이다 (OpenAI 800M WAU, 2025년 12월 → 900M+, 2026년 6월). OpenAI 자체 분류에서 'Practical guidance'(조언/아이디에이션)는 29%로 두 번째로 큰 카테고리다. "ChatGPT로 어려운 결정 내리는 법" 콘텐츠는 Medium·Psychology Today의 인정받는 장르다.

**그러나 그 수요는 Argus의 형식으로 표현되지 않는다.** 'judgment is the bottleneck / what vs how' 거시 명제는 업계가 검증해준다(Gartner). 하지만 그 수요는 **"더 좋은 답을 더 빨리"** 로 발현되고 — 이건 incumbent가 가져간다 — "orientation harness", "Current Bearing", "decision contract"에 대한 *느껴지는 욕구*로 발현되지 **않는다.** 검색 어디에도 'decision orientation'을 이름으로 찾는 사용자는 없다. 그 어휘는 창업자가 만든 말이다.

**그리고 방어 가능한 행동(돌아와서 현실에 비춰 정산하기)은 카테고리 전체에서 가장 지속되지 않는 행동이다.** Fatebook — 지구상에서 가장 calibration에 집착하는 청중(EA/rationalist/LessWrong)을 겨냥한, 무료·미니멀한 최적의 아날로그 — 조차 전체 사용자 통틀어 약 2.5만 질문 / 5만 예측 규모에 그친다. (주의: 이 수치는 2023년 런칭기 Manifund 펀딩 글에서 나온 것이라 "수년 후에도"라는 식의 인용은 시점 오류 — 8번 참조. 그래도 "니치"라는 결론은 decision-journal 리테션 문헌 및 Argus 자체 0/47과 수렴한다.)

판정: **수요 = 상위 JTBD는 real, Argus 특정 형식에 대한 수요는 현재 wishful에 가깝고, 핵심 행동의 지속성은 구조적으로 latent(거의 안 됨).** 천장은 "작지만 사랑받는 도구"이지 "벤처 규모 카테고리"가 아니다.

---

## 3. 누구에게 파는가 (ICP + wedge)

먼저, **반려된 두 후보부터.** 둘 다 매력적이라서 위험하다:

- **"인생 큰 결정 앞둔 창업자"** — 거부. SoloCEO(Indie Hackers)가 거의 동일한 클론으로 이미 출시돼 있고, 트랙션 0이며, *Argus의 자랑인 멀티모델 자기 스트레스테스트(GPT+Grok+Claude로 자기 설계 검증)를 똑같이 써먹었다.* 즉 그 차별점은 아무것도 차별 못 한다. 게다가 "일회성 인생 결정"은 정의상 **반복되는 정산 순간이 없어서** 1번에서 말한 병목 행동을 절대 못 만든다.
- **forecasting/rationalist 커뮤니티** — 거부. "철학을 공유하는 청중"과 "Argus를 채택할 청중"을 혼동한 것. 이 집단은 이미 Metaculus·Manifold·Fatebook·스프레드시트를 굴리고, 반사적으로 DIY이며, 그들의 윤리를 베낀 매끈한 스타트업에 회의적이다. 공유된 철학은 그들을 **고객이 아니라 비평가로** 만든다. 가장 팔기 어려운 시장이다.

**가장 날카로운 단일 beachhead (단, 검증된 게 아니라 *덜 틀린* 가설로):** 코드에 붙은(code-attached) 표면 — 실제 PR/코드 위에서 도는 `/blindspot`. 이유: Claude Code는 2M+ WAU의 큰 채널이고, code-attached 형태만이 그 안의 in-session JTBD("내 코드를 전진시켜라")와 충돌하지 않는다.

**하지만 정직하게: 이건 추천이 아니라 미검증 가설이다.** Argus가 인용하는 buildtolaunch 리뷰는 reflection 플러그인을 *한 개도* 리뷰하지 않는다 — 이건 채택 가능성에 대한 *반대 증거*다. 마켓플레이스에서 누군가 Argus를 설치→PR에 `/blindspot` 실행→돌아왔다는 데이터는 0건이다. 그리고 AI code review가 painkiller라는 증거($420M ARR, CodeRabbit 100K+ repo)는 **Argus에 불리하게 작동한다**: 개발자는 "이 코드에 버그 있다"(구체적·즉각적·기계적 결함)에 돈을 낸다. "네 아키텍처 판단이 틀렸/틀릴 것"에 돈을 낸다는 증거는 없다 — 후자는 Argus가 일부러 하는 그 일이다.

ICP 결론: **진짜 painkiller로 검증된 단일 ICP는 아직 없다.** code-attached 개발자가 가장 덜 틀린 출발점이지만, 전환은 미증명이다.

---

## 4. 낯선 사람의 여정 — 어디서 튕기나

**튕김 0순위: 애초에 도착하지 않는다 (top of funnel이 없다).**
- 'Decision-making tool' 카테고리는 검색 수요가 만성적으로 약하다. Product Hunt의 Decision Journal은 2018년 출시 후 8년간 팔로워 1명·업보트 105개. 대안 도구들은 각각 리뷰 1~6개. 이건 "문제는 인식하지만 도구를 검색하진 않는" 문제의 시그니처다.
- SEO/콘텐츠는 거래 의도(transactional intent)가 거의 0이다. 'decision-making framework' 같은 쿼리는 무료 컨설팅 콘텐츠로 도배돼 있고, 독자는 프레임워크만 챙겨 떠난다. 콘텐츠 모터는 몇 달을 태워 헛 트래픽만 만든다.
- 플러그인 채널은 이중 게이팅돼 있다: 21,600개+ skill 사이에서 13유저·별 0개 플러그인은 구조적으로 보이지 않고, 방문자가 이미 Claude Code 파워유저여야 한다.

**튕김 1순위: 도착해도 첫 5초에서 — 랜딩이 5초 테스트를 통과 못 한다.**
- 라이브 argus.voyage: hero = "So — how did it go?", sub = "Argus neither flatters nor argues. It just reads your plan, for real", CTA = "Set sail now", 프레임워크 = "Bind · listen · land". **보이는 화면 어디에도 이게 무슨 제품인지, 누구를 위한 건지가 없다.** 가장 싼 수정(평서문 한 문장)이 몇 달째 안 됐다는 건, 팀이 Argus가 뭔지 한 문장으로 못 말한다는 신호다.

**메타포는 자산인가 세금인가? — 현재는 세금이다.**
- 라이브 페이지는 'Bind·listen·land' + 'The Voyage' + 'Trail'을 쓰는데, repo는 'recast', 'Current Bearing', 'voyage/bearing/siren'을 쓴다. **최소 3개의 서로 설명 안 되는 메타포 시스템이 병렬로 돌고, 라이브는 어떤 내부 canon과도 일치하지 않는다.** 단 하나의 공유된 구체 문장이 없다. → A/B 테스트할 단일 프레임 자체가 없으니 "nautical 메타포가 자산이냐 세금이냐" 논쟁은 시기상조의 허영이다. 솔직한 독해: 메타포 증식은 낯선 사람의 이해를 위한 게 아니라 창업자 자신의 미학적 즐거움(Odyssey/harbor 우화)을 위한 설계다.

**가장 자해적인 카피: 프라이버시 약속이 해자를 정면으로 판다.**
- 라이브 화면: "one line is enough · we don't store what you write". 그런데 repo는 정반대 명제로 가득하다 — "own your accumulating n=1 calibration history"가 SettlementModal·decision-contract·VoyageFilm에 박혀 있다. 화해 가능한 해석(원본 free-text는 저장 안 하고 구조화 데이터는 저장)은 있지만, **낯선 사람은 그 뉘앙스를 못 본다.** 페이지가 방문자에게 "돌아오는 루프(=방어 가능한 가치 전부)를 기대하지 마"라고 능동적으로 말하고 있다.

**그리고 "zero judgment" 카피:** 라이브 페이지엔 실제로 그 문구가 없다(그 harm은 조건부). 하지만 'orientation', 'maximum generation' 류는 엔지니어 jargon이지 사용자 outcome이 아니다 — 둘 다 같은 5초 테스트에서 똑같이 실패하는 추상어다.

**우선순위 함정 주의:** "위 hero 카피를 고치는 게 최고 레버리지" 는 *같은 감사 안에서 자기모순이다* — top of funnel 자체가 없는데 어떻게 "최고 레버리지 bounce point"가 있나. 카피 다시 쓰기는 가장 쉽고 통제 가능한 일이라서, 그걸 "최고 레버리지"로 올리면 팀은 미해결 분배 문제를 회피하면서 생산적인 기분만 느낀다.

---

## 5. 가격·해자

**가격은 시기상조다 — 활성화 이벤트가 단 한 번도 발화한 적 없으니까.**
- OSS free→paid 전환율은 0.5~3% (대중 dev tool 0.3~1%, Elastic은 ~1%로 수십억 사업). 1% 가정 시 **~10명 유료 = 활성화 유저 ~1,000명 필요.** Argus는 활성화 0.
- Argus는 가격 문제가 없다. "사람이 제품을 단 한 번이라도 끝내는가" 문제가 있다. 오늘 적는 모든 가격 숫자는 검증할 funnel이 없는 픽션이다.

**가격 앵커가 2~4배 높게 잡혀 있다.**
- Copilot $10/mo, Cursor $20/mo는 매 세션 닫힌·재사용 가능한 artifact(돌아가는 코드)를 하루에도 여러 번 준다. Argus는 orientation만 주고 남는 artifact가 없으며 1년에 몇 번 쓰인다.
- 정직한 비교군은 저널링/웰니스 앱(~$5~6/mo, Headspace $69.99/yr ≈ $5.83/mo)이다. **Argus는 머릿속에선 daily coding copilot처럼 가격 매겨지지만, 행동은 저널링 앱처럼 한다** — 그리고 저널링은 시장 최악의 리테션 카테고리다(mental-health 앱 데이터: 3일 내 DAU 77% 소실).

**구독이라는 primitive 자체가 구조적으로 틀렸다.**
- Argus의 use-case(취직/창업/피벗)는 연 몇 번의 episodic 이벤트다. 구독을 정당화하는 유일한 것 = n=1 누적인데, 그게 0을 넘은 적이 없다. **MRR 스토리는 "이른" 게 아니라 *메커니즘이 없다*** — 의존하는 단일 이벤트가 0번 일어났으니까. 순환논법이다: 구독은 누적 해자로만 정당화되고, 해자는 여러 정산된 contract 후에만 존재하고, 정산된 contract는 0이다.

**outcome-based 가격(시장이 보상하는 모델)은 카테고리 불일치다.**
- Bessemer 2026 플레이북은 "price for outcomes"를 밀지만 canonical 예시는 Intercom($0.99/해결티켓), EvenUp, Leena AI — *측정 가능한 노동을 대체하는 엔터프라이즈 에이전트*다. 개인의 커리어 피벗엔 $/resolved-ticket 등가물이 없다. 즉 이 문헌은 "soft-ROI 조언에서 WTP가 죽는다"는 병을 진단해주지만, Argus엔 쓸 치료법을 주지 못한다.

**해자 방어력 — native LLM 메모리가 이미 무료로 추월 중이다.**
- OpenAI Dreaming V3(2026-06-04): 현실이 펼쳐지면 메모리를 자동 재기록("July에 싱가포르 갈 것"→"July 2026에 갔다"), 의식(ceremony) 0으로 패턴 자동 포착. Claude는 2026-03-02 Free에 chat memory + cross-session Memory Tool API. **Argus의 헤드라인 해자 조각("사용 패턴이 쌓이고 자동 주입된다")은 이제 두 기반 플랫폼의 기본 무료 기능이다.**
- Dreaming이 *복제 못 하는* 단 하나의 조각 = 불변·반증가능·사전 약정된 술어를 고정된 날짜에 현실로 채점하는 것. 그게 Argus가 정직하게 "다르다"고 말할 수 있는 유일한 것인데 — **그게 바로 0번 출하된 부분(0 settled)이다.** 생존한 차별점이 미발화 상태.

**전환비용·네트워크 효과 = 둘 다 0.**
- n=1은 정의상 cross-user 가치가 없다(한 유저 기록이 남에게 도움 0 → flywheel 없음). 유저당 데이터는 짧은 텍스트 몇 줄이라 ChatGPT/Claude 메모리에 몇 분 만에 붙여넣을 수 있고, 그러면 incumbent의 자동 패턴 감지를 무료로 얻는다. MIT 라이선스 + 가격 없음 = 상업적 lock-in 없음. **"own your n=1 history"는 소유의 느낌이지 경제적 전환비용이 아니다.**
- 그리고 구조적 입력(provenance 태그, falsifiable predicate)은 주말에 복제 가능한 commodity 템플릿이다. Notion 'Founder Decision Log'는 "identify patterns in your judgment and build playbooks that compound over time"를 $0~10에 — 거의 Argus 해자 문장 그대로 — 판다.

---

## 6. 첫 100명을 어디서

**가장 정직한 답: 지금은 acquisition을 돌리지 마라.**

- 구속 조건(binding constraint)은 분배가 아니라 **활성화**다. 13유저 funnel은 주로 깨진 랜딩 문제가 아니라 *거의 0에 가까운 카테고리 pull*이 어떻게 생겼는지 그 자체다. "문 고치면 온다"는 수요 문제를 전환 문제로 오진하는 것이다.
- 제품은 단 한 명의 인간에게도(창업자 본인 포함) 자기 핵심 가치를 아직 증명 못 했다. **1~3개의 진짜 sealed+settled 루프가 존재하기 전까지** 트래픽을 끄는 건, 일회성 'real story' 런칭 자산을 0% 완주 버킷에 태워버리는 짓이다.

**그럼에도 첫 100명을 *결국* 어디서 — 가장 싼 현실적 채널 순:**
1. **Claude Code 마켓플레이스 (code-attached 표면만)** — 21,600개 skill 중 별 0개로는 구조적으로 안 보이지만, 2M WAU의 raw 사이즈는 code-attached `/blindspot`이라면 첫 100명을 *그럴듯하게* 공급할 수 있는 유일한 채널이다. 단 전환은 미증명.
2. **창업자의 손수 1:1 온보딩** — 활성화가 병목이므로, 100명 트래픽보다 5명을 손으로 끝까지(seal→settle) 끌고 가는 게 지금 유일하게 의미 있는 "acquisition"이다.

**쓰지 말 채널:** SEO/콘텐츠(거래 의도 0, 몇 달 소모), Show HN("수백 가입" 수치는 검증 안 됨·생존편향이고, 측정되는 건 usage이지 Argus의 sealed 루프가 아님), rationalist 커뮤니티(3번 참조).

---

## 7. 다음 3수 (우선순위 순)

이미 끝난 내부 엔지니어링과 구분: engine, decision-contract 컬럼, plugin↔webapp bridge, /import, 계정 마이그레이션, 센서/계측 — 다 됐다. engine 품질은 병목이 *아니다*. 병목은 "루프가 단 한 번이라도 닫히는가"다.

**수 1 — 창업자 본인이 contract를 3개 봉인하고, 그중 1개를 실제로 정산하라 (dogfood).**
- **무엇:** 너 자신의 진짜 결정 3개로 seal→예측→고정 날짜→정산까지 완주. 손으로, 의식적으로.
- **왜:** 0 settled는 입구 버그로 변명 불가능하다(문은 47번 열렸다). 창업자조차 루프를 닫은 적 없다는 건 *루프가 완주 가능/가치 있게 지어졌는지*에 대한 반증이다. 이걸 통과 못 하면 다른 모든 수는 무의미하다.
- **싼 테스트:** 이번 주. 코드 한 줄 안 짜도 됨. 30/60일 뒤 정산일이 진짜 가치를 주는지 *네가 직접* 느끼는가? 안 느끼면 — 그게 제품의 답이다.

**수 2 — return trigger(돌아오게 만드는 시계)를 사용자 표면에 실제로 붙여라.**
- **무엇:** 자동 정산 리마인더(이메일/알림). statusline decay는 dogfood-only라 배포 플러그인엔 없다.
- **왜:** 카테고리 리더들이 *전부* 이걸 엔지니어링했다 — Fatebook은 이메일 "resolve your question" 리마인더 + 비공식 Android 알림 앱 + Beeminder 강제 통합. Decision Journal·Loqbooq도 자동 재참여를 붙였다. **그들조차 그러고도 니치에 머문다.** Argus는 그 scaffolding이 *하나도* 없으면서 가장 어려운 리테션 행동에 방어선을 걸었다. 해자는 사용자 수요가 아니라 *아직 안 지어진 인프라*에 막혀 있다.
- **싼 테스트:** 가장 단순한 이메일 cron 하나. "수 1"에서 너부터 그 리마인더로 돌아오는가?

**수 3 — 랜딩 첫 화면에 평서문 한 문장 + provenance 화해 카피.**
- **무엇:** "이게 무슨 제품이고 누구를 위한 것인가"를 메타포 없이 한 문장으로. 그리고 "we don't store what you write" 와 "n=1 history" 의 자기모순을 한 줄로 화해(원본 텍스트 vs 구조화 데이터).
- **왜:** 가장 싼 수정인데 몇 달째 안 됐다 → 팀이 Argus를 한 문장으로 못 말한다는 신호. **단, 이건 1순위가 아니라 3순위다** — top of funnel이 없는 상태에서 카피는 "최고 레버리지"가 아니라 "가장 통제하기 쉬워서 회피용으로 끌리는" 일이다. 자기기만 주의.
- **싼 테스트:** 낯선 사람 5명에게 첫 화면 5초 보여주고 "이거 뭐 하는 거야?" 물어라. 메타포 없이.

**관통하는 한 줄:** 너는 엔진(자동차)을 다 만들었다. 문제는 **시동이 한 번도 걸린 적 없다**는 것이다. 다음 3수는 전부 "시동이 걸리는가, 그리고 너 자신에게라도 가치 있는가"를 묻는다. 그게 yes가 되기 전엔 가격도, acquisition도, 메타포 논쟁도 전부 아직 출발 안 한 차의 마케팅 기획이다.

---

## 8. 우리가 안 믿기로 한 것 (필터가 작동했다는 증거)

아래는 "창업자를 기분 좋게 하지만 증거 없는" 주장들 — 의도적으로 버렸다:

- **"이미 수요 입증된 슬라이스(/blindspot)를 Argus가 소유한다"** — 거부. /blindspot이 demanded라는 측정값 0건(사용량·검색량·텔레메트리 모두 없음). 게다가 "내 계획에서 뭘 놓쳤나"는 ChatGPT/Claude가 무료·즉시로 하는 바로 그 commodity다. demanded도 아니고 owned도 아니다.
- **"therapy/companionship이 generative AI 1위 use-case (63%)"** — 버림. OpenAI 자체 분류 1위는 Writing 40%·Practical guidance 29%·Info 24%. 63%/therapy는 제3자(Sentio) 설문의 선택편향. 날카로운 투자자의 소스 체크를 못 버틴다. 헤드라인 JTBD는 검증된 800~900M WAU + 29% 수치로 충분히 선다.
- **"Fatebook이 *수년 후에도* 2.5만/5만에 그친다"** — 시점 교정. 그 수치는 2023 런칭기 Manifund 글에서 나왔다. 런칭 스냅샷을 다년 최종 총량으로 제시하면 적이 "헤드라인 비교 숫자가 3년 묵었다"고 전체 논지를 공격한다. *니치 결론은 다른 증거로 살아남지만* 이 시점 framing은 잘라야 한다.
- **"개발자 워크플로가 정산 시계를 공짜로 준다"** — 거부. PR 머지는 *코드가 도는지*만 정산한다(CodeRabbit 영역). *아키텍처 판단이 옳았는지*는 ADR 문헌상 수개월~수년 시계다("18개월 뒤엔 완전히 미스터리"). 공짜 시계는 배포엔 진짜, 판단엔 환상이다.
- **"ADR/RFC 저자는 pre-qualified 모집단"** — 거부. ADR 라이프사이클은 Proposed→Accepted→Superseded이고, 결과 채점(graded/settled) 상태가 *없다.* 그들은 *기록* 습관을 증명했지 *돌아와 현실에 채점* 습관을 증명하지 않았다. 새 논쟁에 supersede할 뿐 옛 판단을 점수 매기지 않는다.
- **"self-grading ADR은 비어 있는 기회 공간"** — 거부. gap ≠ pull. 아무도 안 지었다는 게 "오면 온다"가 아니라 "아무도 영수증을 원치 않는다"일 확률이 최소한 동등하다.
- **"orientation 포지셔닝이 옳다 / 사람들은 '결정이 어디 서 있는지'에 돈 낸다"** — 거부. orientation은 canonical vitamin 단어. 돈 내는 모든 카테고리는 구체적·날짜 박힌 통증을 판다(code-review="이게 깨진다").
- **"zero-judgment spine이 시장이 보상하는 outcome 가격을 *구조적으로 금지*한다"** — 과장으로 거부. 자기모순(contract 자체가 closed-loop이고 기록/calibration에 과금하면 verdict 없이도 청구 가능). "irreconcilable conflict"는 수사이지 구조적 사실이 아니다.
- **"43% 엔터프라이즈 바이어가 outcome 가격을 중시"** — 수치 오류. Futurum 1H 2026은 27%. 게다가 엔터프라이즈 데이터를 1인 B2C에 적용한 카테고리 오류.
- **"decision-contract-as-billable-unit이 철학+시장 둘 다 맞는 그 모델"** — 거부. 0 sealed·0 settled. "지으면 낼 것"의 교과서. 가설이지 결론이 아니다.
- **"사람이 결정당 $100~250 낸다 = 잠재 WTP"** — 거부. 그 돈은 신뢰·책임전가·사회적 증거 때문에 *사람 코치*에게 간다. 소프트웨어로 이전된다는 증거 0.
- **"15~20% trial 전환이 현실적 upside"** — 거부. 2026 ChartMogul은 trial GOOD 4~6%. 15~20%는 카드 선등록 모델 수치이고, Argus의 무료 OSS 모터와 모순.
- **"product gets smarter without retraining / n=1이 방어 자산"** — 거부. 0 settled = 학습할 입력 0. 입력 없는 flywheel은 미래 상태에 대한 약속이지 조용히 쌓이는 자산이 아니다. 네트워크 효과·전환비용·lock-in 전부 0.
- **"decision journal이 forecasting 정확도 19% 개선했다"** — 미검증으로 버림. 인용 연구가 검색에 안 잡힘. 게다가 사실이라도 $0~10 템플릿 카테고리의 검증된 value prop은 *복제를 부르지 uniqueness를 주지 않는다.*
- **"voyage/bearing/siren framing이 보존/테스트할 브랜드 자산"** — 거부. 라이브가 canonical 프레임을 일관되게 배포조차 안 하고, 전환 데이터 0, 낯선 사람 반응 관찰 0. 테스트할 단일 프레임 자체가 없다.
- **"hero 한 줄 고치기가 최고 레버리지 bounce point"** — 거부. 같은 감사 안에서 자기모순(top of funnel 0). 가장 통제 쉬운 일을 "최고 레버리지"로 올려 미해결 분배 문제를 회피하는 founder-flattering.
- **"마켓플레이스 300K 방문 / 9,000(혹은 101) 플러그인이 wedge"** — 수치 obsolete + 거부. 현 디렉토리는 21,600+ skill. reach ≠ retention ≠ ICP. "101개라 튀기 쉽다"는 더 이상 존재하지 않는 시장에서 추론한 것.
- **"in-workflow /blindspot·/rehearse 표면이 유일하게 acquisition-viable"** — 미검증 가설로 재분류. 전환 증거 0, 인용한 리뷰는 reflection 플러그인을 0개 리뷰(=반대 증거). "더 그럴듯함" ≠ "viable".
- **"ChatGPT가 잊어버리는 결정의 audit 레이어로 viable / 방어 가능"** — 거부. "AI가 내 결정을 잊는다" 통증이 두 번째 도구+정산 의식을 채택할 만큼 acute하다는 증거 0(latent pain은 전환 안 됨). 게다가 ChatGPT 2026 memory가 바로 그 gap을 메우는 중.

---

*관련 파일(절대경로): C:\Users\admin\documents\github\argus\docs\ARGUS-FINAL-DIRECTION.md (canonical 포지셔닝), C:\Users\admin\documents\github\argus\src\lib\decision-contract.ts (해자 술어 정의), C:\Users\admin\documents\github\argus\src\components\landing\voyage\Act2DecisionVoyage.tsx (라이브 hero). 단 위 진단은 코드가 아니라 funnel(0 settled)과 외부 시장 증거에 근거한다 — 엔진은 문제가 아니다.*