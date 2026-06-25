# Argus 총체 해체 분석 — 8개 렌즈 멀티에이전트 (2026-06-25)

> 방법: 7개 독립 리더 에이전트(아키텍처 / UX·플로우 / 통합백엔드 / GTM·전략 / 디자인 / 데이터·퍼널 / 플러그인)가 실제 파일을 읽고 각각 "자랑거리 · 약점 · 보완"을 구조화 산출 → 1개 적대적 검증 에이전트가 양쪽 주장을 실파일 대조로 검증(살린 것 / 죽인 것 / 모두가 놓친 것). 총 8 에이전트, ~86만 토큰, 171 툴콜, 라이브 DB(overture-db) 대조 포함.
>
> 이 문서는 "잘했다"를 칭찬하려는 게 아니라, **동료에게 추천할 만한 진짜 강점**과 **AI 바이브코딩 티가 나는 진짜 약점**을 가감 없이 분리하고, guru라면 어떤 순서로 손볼지 정리한 것이다.

---

## 한 줄 평결

> **엔진은 세계 최상급으로 잘 만들었는데, 루프의 마지막 조각이 아직 미완성이라 시동이 걸릴 수가 없다.**

엔지니어링 장인정신(LLM 플루밍, 결정 계약 코어, 가드 테스트, 웹훅 보안)과 디자인 장인정신(랜딩)은 진짜다 — 흉내가 아니다. 그런데 제품의 존재 이유인 핵심 루프(seal→generate→settle, 결정을 봉인하고 나중에 현실과 정산)는 **단 한 번도 끝까지 닫힌 적이 없다**(라이브 DB: `decision_graded` 이벤트 0건, 영속된 `decision_contract` 0건).

**중요한 인과 교정:** 이 0건은 "수요가 없다"거나 "아무도 안 한다"는 *수요 실패*가 아니라, **루프를 닫는 데 필요한 마지막 조각들이 아직 미완성**이라 구조적으로 닫힐 수가 없는 *기능 미완성*의 결과다. 구체적으로 (1) 돌아오는 채널(checkin-due 리마인더)이 샌드박스 발신자 버그로 실사용자에게 배달이 막혀 있고(H1), (2) 익명 seal이 서버에 영속되지 않아 정산 경로가 끊겨 있다(H3). 즉 자동차에 결함이 있는 게 아니라 *연료 호스 마지막 이음매가 아직 안 끼워진* 것 — 그래서 시동이 안 걸린 것이지, 시동을 거부당한 게 아니다. 나머지 모든 것(메타포, 17 에이전트, 3D 항해 영상)은 이 마지막 이음매를 끼우기 전까지는 시동 안 걸린 차를 위한 마케팅이다.

---

## 1. 진짜 자랑할 만한 것 (검증 통과 — 동료에게 추천 가능)

적대적 검증 에이전트가 실제 파일을 대조해 **살아남은** 것만 추렸다.

### A. 엔지니어링이 "AI 웹앱치고"가 아니라 그냥 잘 만들어졌다
- **`llm.ts` = 프로덕션급 LLM 플루밍.** 프로바이더별 서킷 브레이커(5실패/30초, Anthropic↔OpenAI↔Gemini 격리), 지수 백오프 + ±25% 지터(15초 캡), 스트리밍 idle 워치독(30초) + 하드캡(180초)으로 좀비 소켓을 끊고 *구별되는* 타임아웃 에러를 던져 스피너가 실제로 풀린다, 80ms onToken 플러시 스로틀로 리렌더 폭주 방지. 대부분의 AI 웹앱이 이 레이어를 *가짜로* 때운다. (`src/lib/llm.ts:112-225, 791-890`) — **rare/novel**
- **`repairTruncatedJSON` = 진짜 브래킷-스택 JSON 복구기.** max_tokens로 객체 중간에 잘려도 버리지 않고, 문자열/이스케이프 상태와 브래킷 스택을 추적해 구조적으로 안전한 경계까지 되감아 열린 컨테이너를 닫고 재파싱 → 앞쪽 필드가 살아남는다. 보통은 try/catch 한 번 하고 포기한다. (`src/lib/llm.ts:240-329`) — **rare/novel**
- **`decision-contract.ts` = 제품의 척추, 가장 깨끗하게 설계됨.** predicate가 (출처+정규화 텍스트)로부터 djb2 결정론적 stable id를 받아서, 계약을 재생성해도 사용자가 매긴 채점이 절대 고아가 안 됨(조인은 항상 id, 자유 텍스트 X). `now`를 주입받는 순수 함수라 settle/grade 루프 전체가 테스트 쉬움. 제품이 가장 틀리면 안 되는 한 조각이 가장 잘 지어졌다. (`src/lib/decision-contract.ts:55-117`)

### B. 프로덕션 상처를 CI로 박제한 가드 테스트
- PGRST204(TS 필드에 DB 컬럼이 없으면 행 전체가 조용히 거부됨)에 데였던 경험을, 17개 테이블의 실제 컬럼을 거울처럼 베낀 schema-drift 테스트 + 미등록 스토리지 키를 CI에서 빨갛게 만드는 persistence-contract 테스트 + 패리티 테스트로 응답했다. 조용한 데이터 유실 한 부류를 빨간 빌드로 바꾼 가드레일. (`schema-drift.test.ts`, `persistence-contract.test.ts`, CLAUDE.md 7단계 체크리스트)
- `deleteAllUserData`를 깨진 16테이블 클라이언트 루프 → 29테이블 service-role 엔드포인트로 재건, 부분 삭제 시 거짓 성공 대신 throw. (`db.ts:302-327`)

### C. "세이렌 앞에서 밧줄 묶기"가 장식이 아니라 진짜로 구현됨 (제품의 가장 방어가능한 아이디어)
- 제출 즉시 분석은 병렬로 쏘지만 스트림은 **버퍼링되어 렌더 안 됨** → 사용자의 직감(lean)이 AI를 듣기 *전에* 진짜로 포착된다. BindCard의 lean 필드는 모델 출력으로 절대 prefill 안 됨(불변식이 코드 docblock에 박힘). 대부분의 "결정 도구"가 흉내만 내는 anti-anchoring 디바이어스를 정직하게 구현. (`workspace/page.tsx:319-347`, `BindCard.tsx:11-33`) — **rare/novel**
- predicate id가 콘텐츠 해시라 재도출해도 판정이 사라지지 않는 위변조 저항 원시타입 + `user` vs `ai_surfaced` 저자 태깅으로 "AI가 띄운 위험을 내가 예견했다"는 2차 사후편향 차단. 출판된 대부분의 의사결정 저널 설계를 능가. (`SealMoment.tsx:130-199`)
- **침묵을 출력으로:** 물어볼 falsifiable한 게 없으면 SealMoment가 `null` 렌더 + 내부 신호만 발생(질문을 *제조하지 않음*). "zero judgment" 불변식이 UI에서 실제로 강제됨. (`SealMoment.tsx:253, 108-113`)

### D. 통합 백엔드 — 4개 채널이 전부 진짜로 동작, 웹훅 보안은 평균 이상
- Telegram / Slack / email / cron 모두 실제 외부 API 호출 + DB 연결상태 + env 없으면 503로 우아하게 죽음(크래시 X). 스텁이 아니다.
- **웹훅 보안이 정석:** Slack 이벤트는 HMAC-SHA256(v0:ts:body) + 5분 리플레이 윈도 + `timingSafeEqual`, OAuth state는 HMAC 서명 + 10분 TTL, Telegram은 secret 토큰 검증, 리플레이 멱등 처리(sent→responded를 RPC 전에 선점). 대부분의 팀이 틀리는 부분. (`slack/events/route.ts:31-105`, `email/inbound:105-127`) — **rare/novel**
- 모든 아웃바운드가 서버측 rate-limit, 그것도 채널별이 아니라 공유 limiter라 채널 넘나들며 우회 불가. cron은 fail-closed(CRON_SECRET 없으면 거부, constant-time 비교). (`share-guard.ts:27-56`, `checkin-due/route.ts:50`)

### E. 디자인 — 랜딩은 진짜 최상급, 템플릿 냄새 0
- **자체 제작 "선장의 항해일지/청사진" 디자인 언어.** 자가 토큰 시스템(`bp-*`): 빛바랜 양피지 + 네이비 잉크 + **금색은 화면당 정확히 한 번만**, border-radius:0 잉크 플레이트, 모노스페이스 기술 여백주석(좌표 `37°34′N · 126°58′E`, `§ 0 · 세이렌`), 치수 틱, 오픈 서클 노드, 헤어라인 룰. AI 기본 티(글래스모피즘/OLED블랙/네온 그라디언트/전부 둥근모서리)가 **하나도 없다.** (`globals.css ~71-81, ~2580-2800`, `SirenHero.tsx`) — **rare/novel**
- 펜이 종이에 글씨 쓰는 걸 시뮬레이션하는 손-안무 SVG + 영상-동기화 "잉크 인용구" 모션(글자는 안 움직이고 마스크 알파만, 1.5px 글로우 nib이 젖은 가장자리를 탐). 가중치 위계를 헤더 주석에 *디자인 룰로 명문화*("grid 0.5px < reader hairlines 1.6px < the plan 3px < ONE gold node"). (`VoyageFilm.tsx`, `ForkPath.tsx`) — **rare/novel**
- shadcn 0, @radix-ui 0, cn()/clsx 0. 손으로 만든 컴포넌트, 진짜 입체 그림자. reduced-motion / focus-visible 접근성이 폴리시 *아래까지* 내려가 있음. — 폰트는 금지 기본값 회피(Noto Serif KR / Nanum Myeongjo / JetBrains Mono / Pretendard).

### F. 자기 자신에게 정직한 계측과 문서
- daily-report cron이 진짜 정교한 퍼널 계측(KST 윈도잉, WoW 델타, 소스별 전환, 소유자 세션 자동제외) — 스케줄도 실제로 돈다.
- /admin 대시보드가 **0을 거짓말하지 않게** 설계됨 — 영속 퍼널 + 행동 return-loop 두 개를 나란히, sealed/settled가 0이면 "핵심 루프가 실사용자에게 단 한 번도 안 돌았다"고 평문으로 muted 카드에 띄움.
- 플러그인 eval 하버스트가 **자기 제품이 실패하는 걸 잡아서** 커밋(`report.json` flagged:3 — charity-asymmetric poles, manufactured lean). 바닐라 vanity 하버스트는 all-green을 찍는다.
- 문서 정직성: CHANGELOG가 "새 가드는 회귀 바닥이지 안전 증명이 아니다"라고 *직접* 쓴다. 14-에이전트 GTM 감사 §8은 창업자에게 유리한 주장들을 증거 부족으로 *삭제한* 목록이다. pre-PMF 스타트업에서 가장 희귀한 자산.

### G. 플러그인(argus-plugin-v2) — 생태계 기준 위
- **eval 하버스트가 진짜다(rare).** 실제 `sail/SKILL.md`를 시스템 프롬프트로 모델에 먹여 bearing을 *생성*시킨 뒤 3중 채점(결정론적 static gate + 회의적 LLM judge + CI 임계값 non-zero exit). 대부분 플러그인은 eval이 0이고, 있어도 손으로 쓴 fixture를 채점한다. 이건 *모델이 실제 출하 프롬프트로 생성한 것*을 채점.
- **under-fire / zero-judgment 척추가 일관되게 기계적으로 강제됨** — flat이면 probe·crew 건너뜀, engine-weighted pole 금지(swap-test + 4개 tilt 벡터 + "폴은 사용자가 쓰게"가 기본), 바빠 보이려고 challenge 제조 금지. 카테고리에서 진짜로 독창적인 제품 입장.
- **Stop hook 기계 게이트(`validate-gates.mjs`)** — 모델이 *방금 쓴* 세션 JSON을 읽어 토큰 압박에 "건너뛸" 수 없는 spine 위반을 잡음. "프로즈 룰은 바닥이지 강제가 아니다(R29: 25–44% 프로즈 강제 실패)"는 판단과 그 응답(프로즈를 사후 기계 체크로 받침)이 정확한 아키텍처.
- statusline이 zero-dep / never-throw / .git/HEAD 직접 읽기 / CJK·이모지 더블폭 / PS5.1 BOM 스트립 — 독립 statusline 프로젝트보다 낫다.

---

## 2. 아쉬운 것 · 바이브코딩 티 (심각도순, 가감 없이)

### 🔴 CRITICAL

**C1. 핵심 루프가 한 번도 닫힌 적 없다 — 단, 수요 실패가 아니라 기능 미완성 때문이다.**
라이브 DB: `decision_graded` 이벤트 *통산 0건*, 영속 `decision_contract` *0건*, `plugin_decisions`/`plugin_bearings` 0건. 제품의 존재 이유(나의 n=1 정산된 트랙레코드를 소유)가 ~3개월/47 프로젝트 후 뒷받침 행이 0이다. **하지만 이 0은 "아무도 하려 들지 않았다"가 아니라, 루프를 닫는 마지막 두 조각이 아직 미완성이라 닫힐 수가 없었다는 뜻이다 — H1(샌드박스 발신자로 리마인더 배달 막힘)과 H3(익명 seal 서버 미영속)가 정산 경로를 물리적으로 끊고 있다.** "0 = 수요 반증"으로 읽으면 안 된다(아래 C2 주의). (`argus_metrics`, 라이브 쿼리)

**C2. 해자(moat) 검증은 *아직 불가능* — 루프가 닫힌 적이 없어서 검증도 반증도 못 했다.**
방어가능성 전부가 n=1 decide→predict→settle 누적에 걸려 있는데, 퍼널은 47 오픈 / 0 봉인 / 0 정산. 단, **이 숫자로 "해자가 반증됐다"고 단정하면 과한 해석이다** — 정산 경로 자체가 미완성(H1/H4 리마인더, H3 익명 영속)이라 사용자가 *닫고 싶어도 닫을 수 없는* 상태였기 때문이다. 게다가 47 중 46개가 BIND/계약 기능(2026-06-25) *이전에* 생성됐다(아래 M-cohort). 즉 지금까지의 0은 "해자가 작동 안 한다"의 증거가 아니라 "해자를 시험할 도구를 아직 다 안 만들었다"의 증거다. **해자가 진짜인지 가짜인지는 H1/H3를 고친 *다음에야* 처음으로 측정 가능하다.** (이전 GTM 감사의 "해자 반증" 프레이밍은 이 미완성 변수를 덜 반영했다 — 본 문서가 그 부분을 교정한다.)

**C3. 네이티브 LLM 메모리가 지금 무료로 해자를 먹고 있다.**
헤드라인 해자("사용패턴 자동 누적·주입")가 OpenAI Dreaming + Claude Memory의 기본 무료 기능이 됨. n=1 데이터는 몇 줄 텍스트라 ChatGPT/Claude에 붙여넣으면 같은 자동 패턴 탐지를 공짜로 얻음. 네트워크 효과 0, 스위칭 비용 0, MIT 라이선스 = 락인 0. **살아남는 차별점은 단 하나 — 날짜 박힌 falsifiable predicate를 현실로 채점하는 것 — 인데 그게 정확히 0건 출하된 조각이다.**

### 🟠 HIGH

**H1. (가장 큰 발견) 리마인더 발신자(from)가 샌드박스 주소라 실사용자에게 배달이 막혀 있다 — 그래서 창업자 dogfood가 거짓 양성을 만들 위험.**

먼저 **수신자/발신자를 정확히 구분**한다 (실코드 재확인):
- **수신자(`to`)는 가입자 본인이 맞다.** `checkin-due/route.ts:100` `to: email`, 이 `email`은 `u?.user?.email`(line 84) = 그 계약을 만든 *가입자*. 창업자에게 보내도록 짠 게 절대 아니다. (← 창업자 직관이 맞았다)
- **문제는 발신자(`from`)다.** `checkin-due/route.ts:99` `from: 'Argus <onboarding@resend.dev>'`. 이건 Resend의 **테스트/샌드박스 발신 주소**다.
- **Resend 공식 규칙:** 도메인 인증 전 `onboarding@resend.dev`로는 *"Resend 계정을 만들 때 쓴 본인 이메일 주소로만"* 발송할 수 있고, **다른 수신자에게 보내면 거부된다.** 다른 사람에게 보내려면 도메인을 인증하고 from을 그 도메인 주소로 바꿔야 한다. (Resend Docs — Managing Domains; resend-node issue #454)
- **그런데 argus.voyage 도메인은 이미 인증돼 있다** — `email/send/route.ts:71`은 일부러 `from: Argus <share@${EMAIL_FROM_DOMAIN || 'argus.voyage'}>`를 쓰고, `send-question`도 마찬가지다. **오직 `checkin-due`(와 `daily-report`)만 샌드박스 주소를 쓴다.** `daily-report`는 수신자가 창업자(REPORT_EMAIL)라 무해하지만, `checkin-due`는 수신자가 가입자라 치명적이다.

- **합치면(왜 부비트랩인가):** 코드 의도는 "가입자에게 보낸다"인데, from이 샌드박스라서 *결과적으로* Resend가 가입자 배달을 거부하고 **계정 소유자(=창업자) 본인에게만** 통과시킨다. 그래서 GTM 렌즈 처방("창업자가 직접 seal+settle 해서 시동을 걸어라")을 곧이곧대로 하면 **거짓 양성 검증**이 된다: 창업자는 리마인더를 받고 settle하고 0→1을 보고 "루프 작동!"이라 결론 내리지만, 인프라는 구조적으로 *다른 누구에게도* 그 리마인더를 못 보낸다(게다가 H3로 익명 seal은 서버에 아예 안 닿는다). 테스트하라고 지정된 그 한 사람이, 깨진 파이프가 안 깨지는 유일한 사람이다.
- **수정(1줄):** `checkin-due/route.ts:99`의 from을 `email/send`와 동일하게 인증 도메인으로 바꾼다 — 예 `from: 'Argus <hello@${process.env.EMAIL_FROM_DOMAIN || "argus.voyage"}>'`. 그러면 *진짜로 가입자에게* 배달된다. 그 뒤 **비창업자 주소로 실제 1통 보내 배달을 눈으로 확인한 다음에야** cron을 믿어라. (전체 surface에서 최고 레버리지)
- 참고: `daily-report:546`의 샌드박스 from도 같이 인증 도메인으로 통일해두면 좋다(지금은 무해하지만 일관성).

**H2. 100% 이탈은 seal *위에서* 일어난다 — seal UI 실패가 아니라 time-to-value/활성화 실패.**
라이브 퍼널: 669 세션 → 51 submit → 20 voyage 영속 → 0이 SealMoment 도달. ~92%가 제출조차 안 하고, 제출한 사람은 6–9 LLM콜·수 분짜리 관문(assembling→analyzing→Q&A→crew→mix→DM→falsification→seal)을 통과해야 해자 충전 순간에 닿는다. **활성화 직전 절벽에 다분짜리 관문을 세워두면 거의 0명이 도달한다.** seal 재설계는 먼저 가치 도달 경로를 줄이지 않으면 증상만 치료하는 것.

**H3. 익명 seal은 구조적으로 정산 불가 — 유일한 진짜 seal이 설계상 막다른 길.**
사용자 ~99%가 익명. 성공한 seal이 localStorage에만 쓰이고 동기화 안 됨(db가 userId 없으면 early return). 결과: (1) 서버 카운터 `projects_sealed`가 진짜 로컬 seal에도 0을 읽어 팀이 메커니즘 작동 여부에 부분 실명, (2) "이 결정은 당신에게 돌아옵니다" 약속이 캐시 클리어/기기 변경에 조용히 깨짐. 통산 단 1건의 `decision_sealed`(2026-06-24, 익명=true)가 정확히 이 막다른 길에 빠졌다.

**H4. settle 절반이 구조적으로 발화 불가 — 작동하는 return trigger가 없음.**
"seal→generate→settle"이 사용자가 자발적으로 맞는 날 돌아오는 데 전적으로 의존. 제품은 대놓고 "제가 알림을 보내진 않아요"라고 말하고 클라이언트 생성 .ics 파일만 제공(가능한 가장 약한 implementation-intention). 익명(다수) 케이스용 return cron이 안 연결됨. **0 settled는 전환 실패가 아니라 아웃바운드 채널 부재로 보장된 결과.** SEALED 확인의 "[날짜]에 물어볼게요" 약속을 중간값 사용자에게 지킬 수 없다. (H1과 합쳐지면 창업자에게만 지켜진다)

**H5. God-file들.** `ProgressiveFlow.tsx` 3377줄, `useProgressiveStore.ts` 1887줄, `types.ts` 1503줄/99 인터페이스, `workspace/page.tsx` 1278줄. 필드 하나 추가에 7단계 수동 체크리스트가 필요한 이유가 바로 이것. 메모리가 반복적으로 "활성 세션이 소유" "collision-safe halves로 착륙"이라 적은 것 = 파일 크기가 이제 작업 머지 방식을 *지배*한다. 높은 인지부하, 머지 충돌 자석, 렌더 아래 레벨 테스트 난망.

**H6. 가치 제안이 한 문장으로 안 읽힌다 — 팀조차 못 말한다.**
라이브 사이트가 최소 3개의 서로 설명 안 되는 메타포 시스템을 동시 가동 — Bind/Listen/Land, Voyage/Current Bearing/recast, Siren/seal/settle — 그리고 라이브 페이지는 *어느 내부 정본과도* 안 맞는다. 가장 싼 수정(평문 hero 한 문장)이 수개월 걸렸다. 화해 안 된 다중 메타포 = 한 문장으로 무엇을 파는지 말 못 하는 팀의 서명.

**H7. 창업자가 고른 어휘가 자산이 아니라 세금 — 게다가 제품 자신의 작명 규칙 위반.**
Bearing/Bind/Siren/seal/settle/recast는 검색 수요 0(coined term). 철학 문서 자신이 "단어가 곧 기능이어야 한다 — 메타포를 배워야 쓸 수 있으면 메타포는 실패다"라고 명령하고, 버려진 오케스트라 메타포가 왜 죽었는지("아무도 왜 반대자가 트럼펫인지 배우고 싶어하지 않는다")까지 쓴다. Bind/Siren/Bearing이 그 테스트를 정확히 실패. 메타포 증식은 stranger 이해가 아니라 창업자 미학을 위한 설계.

### 🟡 MEDIUM

**M1. 반쯤 은퇴한 두 번째 제품(멀티에이전트 오케스트레이션)이 여전히 출하 중.** 21개 lib(agent-*, orchestrator*, worker-engine, debate-engine) + 35KB useAgentStore + /agents·/boss 페이지. 창업자 본인 테제는 "멀티에이전트 말고 압축된 한 화면을 팔아라". Header가 이 라우트를 "워크스페이스 안에서만 도달, 더 이상 최상위 문 아님"으로 강등. 죽진 않았지만(아직 import됨) 팀이 *안 가기로 한* 방향을 위해 유지보수·타입·드리프트 무게를 지는 부착된 평행 제품. **반쯤 은퇴한 코드가 가장 비싸다.**

**M2. ~3,000줄 손-유지 평행 데모데이터 2개 언어.** `demo-data.ts`(1514) + `demo-data-en.ts`(1522)가 거의 동일한 하드코딩 시나리오 트리, 손으로 lockstep 유지해야 함, 둘을 잇는 가드 테스트 없음. 시나리오 하나 고치면 두 번 적용해야 하는 copy-paste-drift 위험.

**M3. 디자인 언어 둘이 화해 안 됨.** 자체제작 logbook/blueprint 시스템(bp-*)이 100% 랜딩 한정 — 워크스페이스 파일엔 0개 등장. 인앱은 옛 "콘서트홀" 언어(rounded-2xl 따뜻한 카드, 골드 그라디언트). hero에서 진짜 voyage로 넘어가면 "각인된 선장의 차트" → "예쁘게 테마 입힌 따뜻한 SaaS 카드"로 체감 품질 하락. 자기 문서가 이걸 진단하고 통합 LogbookCard를 스펙했지만 아직 안 지음.

**M4. 인앱 아이콘이 프로젝트 자신의 anti-generic 룰 위반.** soft-skill이 "표준 굵은 Lucide"를 generic-AI 티로 *금지*하는데, 워크스페이스가 37개 파일에서 lucide-react 사용(Compass/AlertTriangle/GitFork/Anchor...). 랜딩은 헤어라인 항해 글리프(⚓↻⚠⚑)를 발명해 차별을 벌었는데 앱은 기성품으로 후퇴.

**M5. seal 메트릭이 실제 commit 행동을 과소계수.** `bind_resolved committed:true`가 5건(authed 3 + anon 2)인데 `decision_sealed`는 1건뿐. decision_sealed는 bind_open 경로 + 분석 *성공 후*에만 발화 → 31건의 workspace_start_error + 5 llm_error가 bind-commit을 seal-persist에서 절단. 창업자가 "0→1로 끌어라"라고 듣는 그 한 숫자를 믿을 수 없다(실제 의도 ~5, 대시보드 표시 1).

**M6. daily-report 완주 퍼널이 거의 죽은 이벤트명에 키잉됨.** 완주 셋 = flow_done/progressive_draft_promoted/loop_converged인데 라이브: loop_converged=0(통산 미발화), progressive_draft_promoted=1. 실제 완주 신호는 progressive phase=complete(=2). 리포트의 '완주' 단계와 소스별 전환이 실제 완주에도 ~0을 읽는다 — 계측 어휘가 앱 발화와 드리프트.

**M7. seal이 사용자가 이미 가져간 보상 *아래에* 묻힘.** complete 씬에서 SealMoment가 *마지막* 렌더 — FinalCard("가져가실 것")와 CurrentBearingCard 다음. 유일한 계약 작성 surface에 닿을 때쯤 사용자는 이미 문서와 한 페이지 bearing을 받아서, seal이 긴 페이지 맨 아래 선택적 에필로그("마지막으로")로 읽힘. 가장 중요한 활성화 액션이 주의가 가장 낮고 이탈 의도가 가장 높은 곳에 배치.

**M8. 한 콘텐츠, 여덟 surface — 진행이 헛바퀴로 읽힘.** 핵심 한 줄("진짜 질문")이 최소 8곳(분석 스트림/AnalysisCard/UpdateSummaryChip/QuestionDiff/VoyagePrepSummary/MixPreview/CurrentBearingCard/SealMoment)에서 새 초점 요소로 재렌더, 각각 *다른 소스*에서 재도출(snapshot vs mix vs final_mix vs predicate vs bearing)해서 갈라질 수 있고 실제로 갈라진다. 첫 사용자에겐 정련과 멈춤이 구별 안 됨 = "뭐가 흐르는지 모르겠다"의 뿌리. (정본 객체 부재 = 풍부한 산출물이 증발하는 해자 손실과 *같은* 뿌리)

**M9. 워크스페이스 page.tsx가 두 완성 제품을 한 파일에.** progressive voyage + 완전 별개 레거시 4탭 도구(reframe/recast/rehearse/synthesize, ?step=)가 각자 탑바·모바일 내비·스텝 컴포넌트로 공존. 유지보수/드리프트 부채이자 잠재 혼란원(?step= 착륙 사용자는 voyage로 가는 다리 없이 전혀 다른 멘탈모델). 이미 죽은 스텝('refine' 빈 화면) 하나를 패치한 전력.

**M10. 플러그인 프로즈 무게 = 중심 실존 리스크(자기인정).** sail/clarify SKILL.md ~700줄씩. `/argus:sail` 한 번이 모델에게 수천 줄 조건 로직 + R번호 패치(R12~R58)를 내재화·분기시킴. 자기 데이터가 프로즈 강제 25–44% 실패라는데, 기계 게이트는 수십 불변식 중 ~3개만 커버 → 나머지는 전부 *희망*. 사용자向 SKILL 본문에 박힌 R번호 고고학("(R36...)")은 build-log 잔재로 매 실행 토큰만 먹고 사용자 가치 0.

**M11. 플러그인 eval 하버스트에 spine-올바른 출력을 벌하는 내부 모순.** `static-gate.mjs:110-117`이 `status:"fork"`인데 `road_not_taken` 빈 것을 실패 처리하는데, `sail/SKILL.md:546-553`의 *기본* fork 동작이 "폴은 사용자가 쓰게"(모델이 폴 쓰지 말라) → spine-올바른 fork가 static gate에서 `passed:false`를 받고 flagged 카운트를 거짓 양성으로 부풀림. 하버스트의 실제 버그.

**M12. 플러그인 영문 로케일이 구조적으로 약함.** boss-types.yaml에 한국어 example_dialogue/speech_patterns만 있고 영문 없음. M2 personality 게이트가 한국어 문자열 멤버십을 체크 → 마켓플레이스 영문 설치자에겐 (이미 가장 약한) 페르소나 레이어가 더 degrade. 플러그인 전체가 한국어-우선이라 글로벌 리스팅에 진짜 채택 세금.

### 🟢 LOW
- **L1. 플러그인 17 페르소나 에이전트 = 가장 약한 기둥, 부분 장식.** 대부분 진짜 서브에이전트로 안 돎(subagent_type 커스텀 id 바인딩 불가 → general-purpose에 페르소나 텍스트 인라인 주입). 페르소나가 `agents/*.md`와 `data/agents.yaml`에 *이중 정의*(프로젝트 자신의 single-source 룰 위반). 자기 테스트(R42)가 "MBTI 타입에 귀속된 가치 0/5, 글자는 코스튬, Barnum"이라 인정. 가치는 *역할(seat)*에서 오지 페르소나에서 안 옴. 17 → ~6으로 줄이고 한 소스로 통합 권장.
- **L2. Slack OAuth가 Supabase 토큰을 URL 쿼리 파라미터로 전달** → no-referrer가 못 막는 서버/프록시/CDN 로그·브라우저 히스토리 유출면. 헤더 POST로 바꿔야.
- **L3. checkin-due가 매 실행 모든 계약을 메모리로 로드**(JSONB 안 필드라 인덱스 없음 → 무제한 풀스캔). 지금은 괜찮지만 테이블 커지면 cron 타임아웃 절벽.
- **L4. Telegram 웹훅 secret 비교가 non-constant-time**(`!==`, 다른 경로는 timingSafeEqual). 실익은 낮지만 일관성 깨짐.
- **L5. 플러그인 eval 코퍼스 14건·얇음**, `requiresSource:true` 케이스가 0개 → code-native 차별점("evidence feel")이 하버스트에 의해 *전혀 측정 안 됨*. `report.json` 커밋본은 stale로 썩는다.
- **L6. Pretendard가 본문 주 폰트로 선언됐는데 로드 안 됨**(layout.tsx는 Noto Serif/JetBrains/Nanum만 로드). 설치 안 된 머신에서 본문이 조용히 시스템 폰트로 폴백 → 공들인 타입 시스템을 거의 0비용으로 갉아먹음.
- **L7. 죽은 계측·굶주린 학습 파이프.** judgment_records(75행, 4유저, 2026-03-30 멈춤) = 죽은 4R 테이블. quality_signals 18행뿐(SealMoment에 연결됐는데도) = patterns가 의존하는 학습 신호가 사실상 굶주림.

---

## 3. 적대적 검증이 *죽인* 주장 (오해·재작업 방지용)

리더 에이전트가 제기했지만 실파일 대조에서 **틀렸거나 과장**으로 판명 → 손대지 말 것:

- ❌ **"stop_reason 미노출 / 토큰 키스톤 여전히 열림"** — **거짓.** 현재 `feat/3phase-integration` 브랜치는 이미 구현됨: `route.ts:176-186`(스트리밍) + `:224`(논스트리밍)이 stop_reason 포워딩, 클라이언트가 `llm.ts:848-873`에서 읽고 max_tokens에 재시도(`llm.ts:934`). 리더가 *계획 문서*(WORKSPACE-VOYAGE-REDESIGN)를 코드보다 우선해서 본 오류. (메모리의 "stop_reason 미노출"도 이제 옛 사실 — 업데이트 필요)
- ❌ **"silent truncation이 voyage를 깨뜨린다"** — 같은 이유로 거짓. 라우트가 message_delta를 *안* 버리고 truncation-retry가 이미 있음.
- ❌ **"비정본 model id `claude-sonnet-4-6`가 프로덕션에서 조용히 404"** — 과장/미검증. "날짜 접미사 없음 = 비정본"이라는 추론이 틀림(날짜 없는 alias는 유효). 이 문자열이 404한다는 증거 없음. **다만 진짜 작은 사실은 살아남음**: strong 티어가 doc상 Opus인데 실제론 sonnet에 매핑(`route.ts:153-154`) → 죽은/오도하는 설정. (이건 고칠 가치 O, S)
- ⬇️ **"101개 테스트가 진짜 단위테스트"** — 사실이지만 저자도 table-stakes로 표기. 안심용이지 추천 자랑거리는 아님 → 격하.
- ⬇️ **"AnalysisCard가 round 0에 공동저자 과주장(우리가 잡은 항로)"** — 진짜지만 nitpick(단일 카피, 영향 작음, 수정 후에도 출하되는지 미확인) → load-bearing 아님.

**방법론 교훈:** 세 렌즈가 2026-06-25 재설계 *문서*의 진단된 결함(stop_reason 드롭, truncation 마스킹)을 *라이브*인 것처럼 앵커링했는데 작업 브랜치는 이미 키스톤을 고쳤다. → **계획 문서를 ground truth로 믿기 전에 브랜치를 diff하라.**

---

## 4. guru라면 이렇게 한다 — 우선순위 보완 계획

**대원칙:** *엔진은 병목이 아니다(GTM·품질 감사 둘 다 그렇게 말한다). 시동이 안 걸린 루프 위에 계속 짓는 건 정교한 회피다.* 활성화 1건이 날 때까지 새 엔진/기능 빌딩(eval 확장, 에이전트 추가, MBTI/saju, synthesize, dual-surface 패리티)을 **동결**하라.

### 지금/이번 주 (S, 코드 거의 0 — 부비트랩부터 해체)
1. **[CHANGE/S] `checkin-due` 발신자를 `argus.voyage`로** (H1). 그리고 **비창업자 주소로 리마인더 1통 실제 배달 확인 후**에야 cron을 믿어라. 이게 안 되면 창업자 dogfood는 거짓 양성을 만든다. — *전체에서 최고 레버리지 1줄.*
2. **[CHANGE/S] 익명 seal 막다른 길 인지**(H3/C2): anon seal을 session_id 키 서버 행으로 영속(로그인 시 claim) 하거나, settle/reminder 경로가 "anon 계약은 클라이언트에만 산다"를 명시적으로 알게. 안 고치면 modal 사용자에게 루프는 수학적으로 닫힐 수 없음.
3. **[CHANGE/S] seal 메트릭 통합**(M5): committed bind마다 decision_sealed 발화(또는 bind_resolved committed:true 계수), 분석 성공과 디커플. 창업자가 보는 0→1 숫자가 31개 에러에 절단당하면 안 됨.
4. **[CHANGE/S] daily-report 완주 어휘를 실제 발화 이벤트로**(M6): progressive phase=complete / progressive_phase_change, decision_sealed/graded를 명시 퍼널 단계로.
5. **[CHANGE/S] /admin 'Sealed'에 코호트 주석**: 47 중 46개가 contract 기능(2026-06-25) 이전 생성 → 구조적 near-zero를 수요 평결로 오독 금지.
6. **[CHANGE/S] 정직한 카피로**: 아웃바운드 채널 생기기 전까지 "[날짜]에 물어볼게요"를 "잠겼어요 — 돌아오시면 현실 옆에 둘게요"로. privacy-vs-moat 카피 1줄 화해(원문 폐기 / 구조화 기록은 소유).
7. **[CHANGE/S] strong 티어**: Opus로 라우팅하거나 티어 삭제 + doc 정정(죽은 설정 제거).
8. **[FIX/S] 플러그인 static-gate fork 모순**(M11): 중립 crux + user-authored poles면 빈 road_not_taken 허용.
9. **[ADD/S] Pretendard 실제 로드**(L6) — 또는 선언을 로드하는 폰트로.
10. **[ADD/S] demo-data 구조 패리티 가드 테스트**(M2): 한쪽만 고치면 CI 실패.

### 다음 (M — 활성화 절벽을 직접 공격)
11. **[CHANGE/M] time-to-first-value 단축**(H2): 버퍼링된 분석 결과가 resolve되는 *즉시* 보이게(Bind 닫힐 때 이미 와 있다), crew/mix/DM/falsification 전체 관문은 *opt-in("더 깊이")*으로. 첫 보상이 6–9 콜 뒤가 아니라 <40초에 착륙.
12. **[CHANGE/M] Bind를 랜딩 ?q= 진입자에게 non-blocking으로**(H2): AI 첫 읽기와 Bind 요청을 나란히(또는 Bind를 떼어낼 수 있는 스트립). 버퍼 포착 메커니즘은 유지, 보상 대비 *위치*만 바꿈.
13. **[CHANGE/M] seal을 앞으로 + 영속 객체로**(M7/M8): OPEN에서 Bind 밧줄로 계약 시드, Listen 내내 "당신이 봉인한 콜"을 상존 요소로, complete에서 settle("내 콜 vs 현실")을 긴 문서 *위에*. 정본 객체(Bearing Ledger) 하나를 모든 surface가 *읽게* 하고 그걸 seal — 8 재렌더를 사용자가 날카로워지는 걸 지켜보는 한 줄로 collapse. (legibility + 해자 증발 동시 해결)
14. **[ADD/M] 최소 return trigger 연결**(H4): checkin-due cron은 이미 존재 — anon 케이스(device-id 연속성 최소)까지 닿게.

### 정리 (L — 활성화 1건 난 *후에*)
15. **[CUT/L] 멀티에이전트/boss 서브시스템 결정**(M1): 정식 아카이브(/legacy, 라우트 제거, 타입 체크리스트에서 제외) 또는 재투자. "도달은 되는데 문은 아닌" 연옥에 21 lib + 35KB 스토어 + 2 페이지를 두지 마라.
16. **[CHANGE/L] types.ts(99 인터페이스)를 도메인 모듈로 분할 + ProgressiveFlow.tsx를 서브스텝 컴포넌트로 carve**(H5): 메가파일이 머지 전략을 지시하고 필드 추가에 수동 체크리스트를 강요하는 상태 종료.
17. **[CHANGE/L] 인앱에 LogbookCard 채택 + bp-* 잉크플레이트 언어 이식**(M3/M4): 랜딩↔앱 이음매 봉합(브랜드 인상 절반을 깎는 곳). 이미 스펙·문서화됨 = 발명 아닌 실행. lucide → 자체 헤어라인 글리프.

### 메타포·전략 (병행)
18. **[CUT/S] 메타포 하나로 collapse(또는 0개)**(H6/H7): Bind/Listen/Land *또는* Voyage/Bearing 중 하나만. 평문 선언 한 문장을 라이브 사이트와 repo에 *동일하게*. 활성화 전엔 항해 어휘는 세금 — 루프가 작동함이 증명된 *후에야* 자산이 될 수 있다.
19. **[CHANGE/S] 살아남는 단 하나의 차별점으로 재포지셔닝**(C3): 날짜 박힌 falsifiable predicate를 현실로 채점. settle UI를 정직하게(이긴 것만 말고 깨진 베팅/터진 위험도 표시 — 트로피 케이스 X, 캘리브레이션 O).
20. **[CUT/S] 가격/구독 기획 동결**(활성화>0 전까지): episodic 사용(연 몇 회)에 구독은 구조적으로 틀린 primitive. 굳이 테스트하면 코딩 코파일럿($10-20)이 아니라 저널링 앱(~$5)에 모델링.
21. **[CHANGE/M] 플러그인은 해자로 리드하고 덜 출하**: sail→settle을 dogfood 척추로, 17 에이전트는 ~6으로(L1), R번호 고고학은 내부 DESIGN-NOTES로 이동(M10), 영문 경로를 넓히기 전에 벌어라(M12).

### 단 하나만 한다면
> **창업자가 이번 주에 진짜 결정 3개를 seal하고 1개를 — 인증 로그인 상태로, H1 수정 후 — settle해서 0→1을 만들어라.** 단, 창업자 본인 메일이 아닌 경로로 리마인더 배달이 확인된 뒤에. 이게 통과 못 하면 어떤 인수·카피·가격 작업도 시기상조다. 코드 비용 0, 모든 것의 게이트.

---

*생성: 8-에이전트 멀티렌즈 워크플로우(7 recon + 1 적대적 검증) + 플러그인 렌즈 재실행, 라이브 overture-db 대조, 2026-06-25.*
