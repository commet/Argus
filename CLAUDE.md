# Argus — Development Guidelines

## 시작하기 전에 — 정본은 여섯이고 이 파일은 그중 하나다

[`docs/ARGUS-CANON.md`](docs/ARGUS-CANON.md) 가 전체 지도다. 이 파일(CLAUDE.md)은
**코드를 어떻게 짜는가**만 다룬다. **무엇을 짓는가**는 다른 세 문서가 정한다:

| 문서 | 여기서 답을 찾아야 하는 것 |
|---|---|
| [`CONTEXT.md`](CONTEXT.md) | 도메인 낱말 11개 (Decision Case · Next Move · **Return Contract** · Observation · Lesson …) |
| [`PRODUCT.md`](PRODUCT.md) | 제품 약속 · 필수 능력 · **제약** · 원칙 10 |
| [`DESIGN.md`](DESIGN.md) | 색 · 활자 · 레이아웃 · 컴포넌트 |

**새 개념을 만들기 전에 `CONTEXT.md`의 낱말 11개를 먼저 읽는다.** 거기 있으면
그 이름을 쓰고, 없으면 왜 없는지 적고 만든다. 이 규칙이 없어서 2026-08-18에
`Return Contract`를 `watch`라는 이름으로 다시 설계하는 데 하루를 썼다
(같은 개념의 여섯 번째 어휘였다 — [FINDINGS](docs/FINDINGS-2026-08-18.md) §2).

**PRODUCT.md의 제약은 코드 규율보다 위다.** 특히:
- 명시적 채택 행위 없이 사용자 결정을 추론하거나 저장하지 않는다
- AI 제안을 사용자의 원래 믿음으로 제시하지 않는다
- 사람·결정 품질·예측 정확도를 채점하지 않는다

## 새 제품(결정 장부) 시공 중이라면 — 먼저 읽을 것

정본: **`docs/ARGUS-PLAN-2026-08-21-V5.md`**(무엇을 짓나 — 머리 `adopted` 서명
전까지 시공 0줄) · **`docs/ARGUS-BUILD-2026-08-21.md`**(어떻게 짓나). 시공
작업을 시작하기 전에 **BUILD §0 시공 세션 규약**을 따른다 — §9 일지 마지막
5줄을 읽고, 단계의 "됐다" 정의를 확인하고, 닫을 때 일부러 한 번 깨뜨려 검사가
빨간불을 낼 수 있는지 본 뒤, 일지에 한 줄 남긴다. **계획과 코드가 어긋나면
멈추고 일지에 먼저 적는다** — 조용한 이탈 금지. 화면에 나가는 문장은 아래
"화면에 나가는 글" 절을 따른다.

## Commands

```bash
npm test                  # vitest run (전체) · npm test -- <경로>로 좁힌다
npx tsc --noEmit          # 타입 체크 (CI의 check 잡이 돌리는 것과 동일)
npm run lint              # eslint src --max-warnings=145 (임계 초과 시 실패)
npm run dev               # next dev — predev가 argus-mcp를 먼저 빌드한다
npm run build             # next build (prebuild도 kernel:build 경유)
```

게이트·검증 (2026-08-05 전부 실행 확인):

```bash
npm run preflight:dogfood       # 배포 전 전체 관문 (build+test+lint+gates+eval+plugin)
npm run dogfood                 # 커널 도그푸드 (모델 없이 300+ 스텝)
npm run experience:web:selftest # 브라우저 엔진 자체검사 — 로컬 서버, 네트워크 무관
ARGUS_BASE_URL=http://localhost:3000 npm run e2e:loop   # 결정 루프 E2E
```

PR을 막는 것은 CI의 **check** 잡이고, 위 셋보다 훨씬 넓다 — argus-mcp(빌드·
타르볼 E2E·호스트 적합성)와 argus-plugin-v2 게이트 20여 개까지 돈다. 함정 넷:

- **커버리지 ratchet.** CI는 `vitest run --coverage`로 돌고 `vitest.config.ts`에
  floor(lines 30/stmts 29/funcs 24/branches 22)가 있다. `npm test`는 커버리지를
  안 재므로 **로컬 초록 → CI 빨강**이 가능하다. 테스트 없는 큰 파일을 추가했으면
  `npx vitest run --coverage`로 먼저 확인한다. (lint는 반대로 로컬이 더 엄하다.)
- **MIT 존을 건드렸으면 로컬 `npm test`는 아무것도 검증하지 않는다** — 자체
  하네스를 갖고 CI에서만 돈다.
- **`e2e:loop`·`e2e:surfaces`의 기본 대상은 프로덕션**(`https://argus.voyage`).
  `ARGUS_BASE_URL` 없이 돌리면 로컬 변경분이 아니라 배포본을 검사하고, 클라우드
  세션에서는 `ERR_TUNNEL_CONNECTION_FAILED`로 죽는다 (앱 결함 아님).
- **Supabase 키 없이 로컬 기동하면 `/[locale]`이 500이다.** 그 환경에서 뜨는
  화면은 localStorage-only인 `/method-pilot`뿐 — 코드 결함으로 오진 금지.

새 Playwright 스크립트는 `chromium.launch({ executablePath:
playwrightExecutablePath() })`로 띄운다(`scripts/lib/playwright-executable.mjs`).
빠뜨리면 샌드박스에서만 죽어 창업자 기기에서는 재현되지 않는다.

## 저장소 지도

| 경로 | 무엇 | 라이선스 존 |
|---|---|---|
| `src/` | Next.js 16 앱 (App Router, `[locale]` 라우팅은 `src/proxy.ts`가 처리) | 앱 |
| `src/lib/__tests__/` | **가드 테스트** — 아래 원칙 대부분을 기계로 강제 (개수는 계속 는다; 세지 말고 `ls`) | 앱 |
| `method-harness/` | Track R 오프라인 하네스. `src/`와 상호 import 금지 (테스트가 차단; 승인 예외 2채널: `src/app/method-pilot/`·`src/app/api/mcp/v2/`) | 앱 |
| `docs/` | `ARGUS-CANON.md`(정본 지도) · `ARGUS-METHOD-V1.0.md`(방법 정본) · `FINDINGS-*`(확인 기록). 나머지는 역사, `archive/`는 은퇴 | — |
| `argus-mcp/`, `argus-plugin-v2/` | MIT 존 — **PR은 앱 존과 섞지 않는다** | MIT |

## 무엇을 지을 것인가 — 정본은 PRODUCT.md다 (2026-08-18 개정)

`docs/ARGUS-BLUEPRINT.md`는 **은퇴했다**(`docs/archive/`). 2026-07-26 판이었고
`PRODUCT.md`(2026-08-10)와 "무엇을 지을 것인가"를 두고 충돌했다. 창업자 판정:
**지금 정하는 것이 과거 공정표보다 우선한다.**

함께 폐기한 것: `blueprint-exit-evidence.test.ts`(431줄). BLUEPRINT 본문에
특정 문자열이 있는지 검사하던 **문서 모양 고정 테스트**였고 코드 동작은 0이었다.
문서를 고치는 값만 비싸게 만들었다.

무엇을 지을지는 이제 이렇게 정한다:

1. **`PRODUCT.md`** — 약속·필수 능력·제약·원칙. 여기와 충돌하면 그쪽이 틀렸다.
2. **`CONTEXT.md`** — 낱말. 새 개념 만들기 전에 먼저 읽는다.
3. **창업자와 그 세션에서 정한 것** — 정하면 `docs/FINDINGS-<날짜>.md`에 기록.

PR 본문 첫 줄의 `공정 N · 겨냥 퍼널 단계 X→Y` 규약도 함께 폐기한다.
(그 번호를 검사하는 장치가 없어 2026-08-18에 커밋 8개가 존재하지 않는
"공정 12"를 달고 통과했다. 지키지 않는 형식은 지킨다는 착각만 만든다.)

**대신 PR 본문에 적는 것**: 이 변경이 `PRODUCT.md`의 어느 필수 능력·제약과
닿는지 한 줄.

## Checklist: Adding a New Field to a Type

When adding a field to any TypeScript interface (e.g., `Persona`, `RecastStep`), check ALL of these:

1. **타입 정의** (`src/stores/types.ts`) → **store creator**(`createPersona()` 등에서
   명시적으로 매핑) → **store defaults**(`DEFAULT_PERSONAS` 등에 현실적인 값)
2. **Supabase 컬럼** — `apply_migration` (아래 Schema Sync 규약)
3. **그 타입을 쓰는 모든 프롬프트** — 위치는 리팩터링으로 계속 움직이니 파일명을
   외우지 말고 찾는다:
   `grep -rn "SYSTEM_PROMPT\|SystemPrompt\|<user-data>" src/lib src/components`
4. **표시 UI**(카드·폼·상세) 와 **handoff/변환 함수**(`autoPersonaToFull()`,
   `buildDecomposeContext()` 등)

## Principle: The Zero-Judgment Gate (every new user-facing surface)

> **Track R 수정조항 (2026-08-03, 창업자 지시):** 아래 규칙은 현행 제품에
> 유효하되 **R0–R3 방법 연구는 구속하지 않는다.** 방법 정본은
> `docs/ARGUS-METHOD-V1.0.md`(STABLE, `honest agency`).
> **R3 증거 게이트 전에는 라이브 표면에 구현하지 않는다.**

Argus's spine is `maximum generation, zero judgment`. Before shipping any new
surface, pass it through one gate:

> **Does this feature generate, or does it judge the user's decision / narrate
> ownership in their stead? If it judges, it violates the spine.**

1. **저자성에 거짓말하지 않는다.** 기계가 낸 문장이 사용자 소유 필드(`real_bet`,
   `governing_idea`)를 조용히 물려받으면 안 된다. provenance(`user` vs
   `ai_surfaced`)를 태그하고 음영으로 구분하되, **마찰 탈출구는 전부 남긴다**
   (skip / believe-all / use-as-is). 불변식은 정직한 출처지 강제 타이핑이 아니다
   — 강제하면 가장 지친 사용자가 이탈해 소유권이 0이 된다.
2. **사용자가 누구인지에 대한 사용자향 판정 금지.** 미보정 점수·등급을 노출하지
   않는다. 그런 지표는 파이프라인 진단용일 뿐, 코칭을 라우팅하거나 프롬프트를
   개인화하거나 자기인식이 되면 안 된다. 사용자에 대한 의미 언어는 **다섯을
   전부** 갖춰야 한다: ①출처(어느 기록에서 나왔나) ②독립 사례(한 건이 아니다)
   ③범위(어디까지 참인가) ④반례(반대 기록을 찾아봤나) ⑤사용자 검토(본인이 봤나).
   표본 수만으로는 허가가 아니다.

   > **TWIN 수정조항 (2026-08-06, 창업자 "모든 권한을 다 승인한다. 기획을 더
   > 해나가도 돼"로 승인 — TWIN 기획서 §6).** 점수가 붙을 수 있는 대상은
   > **둘뿐**이다: (a) 분신의 봉인 예측, (b) 사용자가 스스로 사전등록한 예측.
   > 이것은 "사용자에 대한 판정"이 아니라 "예측에 대한 채점"이다. 조건 셋을
   > 전부 지킬 때만 노출한다 — 표본 임계 미달이면 숫자 대신 "아직 모릅니다",
   > 증거(근거 케이스 id) 동반, 그리고 **채점 대상이 분신임을 문장에서 밝힌다**.
   > **정체성 점수·등급의 금지는 그대로다** — "당신은 B+ 결정자입니다" 류의
   > 문장은 이 제품에 존재하지 않는다. 위임 정책의 성적도 같은 규율을 따른다
   > (채점 대상은 정책이지 사람이 아니다).
3. **검증은 채팅이 아니다.** 프레임 안에서 모델과 토론해 검증되는 결론은 없다 —
   검증은 단발의 커밋과 정산 시점의 현실뿐이다. 내부 설계 불변식이며 랜딩
   카피로 만들지 않는다.
4. **과발화도 스파인 위반 (거울 조항).** `zero judgment`은 "사용자를 판정하지
   말라"보다 넓다 — **개입할지 여부를 사용자 대신 판정하지 말라**는 뜻이기도
   하다. 평평한 결정에 fork를 제조하거나, 저위험·가역 결정에 의식을 돌리거나,
   사용자가 닫은 결정을 다시 열거나, "가만히 두기"가 정답인데 참여를 밀면
   과발화다.
   - **기본값 = 자제.** 하중 있는 가정 하나만 이름 붙이고 핸들을 돌려준다.
     엔진이 가중한 극을 사용자에게 내보내지 않는다.
   - **발화 형태 = 맨 중립 crux 질문.** 방향 문장도, 양극 fork도,
     **면책 딸린 기울기도 금지** ("X 쪽으로 기울지만 제 판정은 아닙니다"도 위반으로
     측정됐다 — 태그로 판정을 세탁할 수 없고, 출력마다 기울기를 태그하면 더
     나빠진다). 정직한 출처는 필요조건이지 충분조건이 아니다.
   - **fire-or-not 게이트가 형태보다 먼저 돈다.** crux 질문 템플릿을 기본값으로
     두면 평평한 사례에 질문을 제조한다.

   이 모두를 거치고도 남는 잔여 기울기는 비가역이다(`value ∝ leverage ∝ tilt`)
   — 그래서 `zero judgment`은 **접근하며 제품 수준에서 공개하는 점근선**이지
   주장할 수 있는 상태가 아니다. "우리는 판정하지 않는다"라고 쓰지 말고,
   "질문 하나를 드러내며, 희미한 기울기를 알려진 한계로 밝힌다"라고 쓴다.

## Principle: Honest Structure over Plausible Fabrication (the LLM-glue invariant, 2026-07-05 근원 분석)

**LLM은 구조적 버그를 조용한 품질 저하로 바꾼다.** 보통 프로그램은 전선이
끊기면 죽거나 null을 내지만, LLM 파이프라인은 **자신 있고 그럴듯하고 약간 틀린**
답을 낸다 — 모델이 모든 공백을 메우기 때문이다. 빠진 필드도, 없는 입력도 에러가
아니고, 정답을 모르면 "그럴듯함"과 "맞음"은 구분되지 않는다. (근원 분석:
`docs/AGENT-ARCHITECTURE-FOUNDATIONAL-2026-07-05.md`)

> **구조가 "그럴듯함"이 "맞음"으로 위장하지 못하게 만들어야 한다.**
> **모든 공백은 크게 실패하거나(compile/CI/crash) 사용자에게 정직하게
> 드러난다 — 모델이 조용히 메우는 일은 절대 없다.**

1. **조작보다 정직한 공백.** 없는 입력·안 맞음·답 없음은 *이름 붙여* 드러낸다
   (block, `unfilled`, "awaiting X", abstain). 모델이 부재한 사람 입력이나
   부재한 담당을 대신하는 것은 금지.
2. **명사만이 아니라 동사를 타입한다.** 컴파일러는 데이터 *모양*을 지키지만
   단계 간 인계는 템플릿 문자열이라 못 본다 — 생산된 필드는 기본이
   dead-on-arrival이다. *소비*를 가드한다: 모든 생산 필드는 소비되거나 명시적으로
   포기되고, 그것을 테스트가 강제한다.
3. **사람의 판단은 장식이 아니라 하중을 받는 부재다.** 사용자의 결정이
   결과물에 *그의 것으로* 도달해야 한다 (증명 가능하게, `authored:'user'`).
4. **라우팅·순서는 결정론 구조가 갖고, LLM은 셀 안의 창의 작업만 한다.**
   LLM을 라우터·오케스트레이터로 hot path에 두지 않는다. 배선은 명시적·결정론적·
   테스트 가능하게, 의존은 런타임 추론이 아니라 선언으로.
5. **그럴듯함 ≠ 검증됨.** 프레임 안의 LLM 동의는 검증이 아니다. 정산 시점의
   현실만이 검증이다.

출하 전 리트머스: *"여기 전선이 조용히 끊기면 뭐라도 빨간불이 되는가, 아니면
LLM이 그럴듯한 오답을 내고 모두가 넘어가는가?"* 후자면 큰 실패나 정직한 표면을
먼저 만든다.

## Principle: 결함이라 부르기 전에 값을 끝까지 따라간다 (2026-08-19 창업자 지적)

> **창업자, 2026-08-19:** *"제대로 확인 안 하고 너 맘대로 진단해서 나한테
> 설명하고 코드 바꾸고 하는게 지금 몇번째야. 그러니까 진도도 안 나가고 제품도
> 개쓰레기가 되지."*

같은 날 실제로 일어난 일: `stakes` 를 "필수 + 모델이 채움 + 발화 게이트를 돌림"
까지만 보고 `PRODUCT.md` 위반이라 부르고, FINDINGS 에 적고, 완성 계획에 결함
5건 중 하나로 넣고, 갈래 셋과 권고까지 만들어 올렸다. **창업자가 되묻자 그제서야
추적했고, 결함이 아니었다** — `gate_input` 메타 이벤트에만 들어가고 replay 가
안 읽고 화면에 안 나오고 사용자 판단이라 주장한 적이 없다.

이 저장소는 **읽고 아는 척하기 쉬운 코드베이스**다. 필드 하나가 여섯 파일을
지나고, 이름이 같은데 뜻이 다른 자리가 많다. 그래서 규율은 성실함이 아니라 절차다.

**어떤 값을 결함이라 부르기 전에 네 자리를 전부 확인한다:**

1. **생산** — 어디서 만들어지나 (스키마·핸들러)
2. **저장** — 원장의 어느 이벤트에 어떤 이름으로 들어가나. **메타 이벤트인가**
   (`gate_input` 처럼 replay 가 무시하는 것인가)
3. **소비** — fold 가 갖나, 그것을 **읽는 호출처가 실재하나** (`grep` 으로 확인,
   선언은 소비가 아니다)
4. **표면** — 사용자에게 무엇으로 보이나. **그것이 사용자의 것이라 주장하나**

네 자리를 다 못 봤으면 결함이 아니라 **의문**이다. 의문은 의문으로 적는다
("확인 필요: X") — FINDINGS·계획 문서에 결함으로 적지 않고, 그 위에 수리·갈래·
권고를 쌓지 않는다. **틀린 진단 위에 쌓은 설계는 그 자체가 폐기물이고, 창업자의
시간을 두 번 쓴다.**

같은 규율의 다른 얼굴 둘 (오늘 같은 날 실제로 걸린 것들):

- **빨간불이 나면 제품을 의심하기 전에 내 계측기·픽스처를 먼저 가른다.** 하루에
  세 번 걸렸다 — 드라이버가 `NODE_ENV=test` 를 안 켰고, 앱 존 빌드로 MIT 기능을
  찾았고, 픽스처의 `anchor_quote` 가 전제 문장과 같아 제품이 옳게 강등했다.
- **기제를 확인하지 않고 기대를 쓰지 않는다.** `seal.ts:312` 를 안 보고
  "자기생성 결정엔 결정 문장이 없다"를 기대해 테스트가 빨간불이 났다. 원장이
  권위다.

## Principle: Single Source of Truth for Prompts

Never copy-paste a system prompt to a second location. Extract it to a shared
function in a lib file so the two surfaces can't drift.

The positive pattern to copy: `reframeSystemPrompt()` (`src/lib/reframe-core.ts`)
is the single brain shared by the web ReframeStep AND the Telegram bot, so it
can't drift. `src/lib/persona-prompt.ts` (`buildFeedbackSystemPrompt`)는 같은
방식으로 중앙화된 페르소나 프롬프트다 — 현재 직접 소비자는 테스트뿐이므로,
페르소나 피드백 표면을 다시 열 때 새로 쓰지 말고 이것을 부른다.

**고치지 말 것 (의도된 비위반):** `recastSystemPrompt()`(`recast-core.ts`)와
`RecastStep.tsx`의 프롬프트는 중복처럼 보이지만 별도의 뇌다 — 봇은 채팅 크기의
3필드 `RecastStepLite`를, 웹은 풀 `RecastAnalysis`를 낸다. 공유하는 것은 출력
형태가 아니라 actor-split 논지다. 웹을 봇 프롬프트에 위임하면 웹 UI가 깨진다.

## Principle: Persistence Declaration (2026-06-13 근원 분석에서 추가)

localStorage-first 아키텍처에서 UI는 로컬만 읽는다 — 서버에 안 가는 데이터도
모든 화면과 모든 테스트(경계 mock)에서 멀쩡해 보인다. 그래서:

1. **새 사용자 입력/행동 데이터를 저장할 때는 거취를 선언한다** — 키를
   `STORAGE_KEYS`에 등록하고 `persistence-contract.test.ts`의 CONTRACT에
   synced(테이블) 또는 localOnly(사유)로 적는다. 사설 키 리터럴은 CI가 막는다.
2. **경로 이주(legacy→new flow) 때는 옆줄도 같이 옮긴다** — 옛 흐름의 부수
   호출(recordSignal, record*, track 류)을 grep해 각각 이식하거나 포기를 명시한다.
   (놓쳐서 2.5달간 신호 0건이었던 전례가 있다.)
3. **현실 접촉 후엔 행수도 본다** — 실주행 관찰에 "예상 테이블에 행이 늘었나"
   1줄을 포함한다. UI가 멀쩡한 것과 데이터가 도착한 것은 다른 사실이다.

## 실기기 검증 안전 규칙 (2026-07-27 터미널 사고 — 위반 금지)

1. **claude 프로세스를 절대 죽이지 않는다.** `pkill claude`, `taskkill /IM
   claude*`, `Stop-Process -Name claude` 등 **이름 기반 킬 전면 금지** — 다른
   워크트리의 세션까지 죽고 터미널 모드가 복원되지 않는다. 재시작이 필요하면
   사용자에게 요청하거나 **자신이 띄운 특정 PID만** 종료. (훅이 기계로도 차단하나,
   훅 없는 환경에서도 규칙은 동일.)
2. **기존 사용자 세션 창에 키 입력·클릭을 시뮬레이션하지 않는다.** 실기기
   검증은 새로 띄운 전용 창에서만; 기존 창은 관찰만.

## Agent Skills (참고 규칙집, 2026-08-07)

`docs/agent-skills/`에 선별된 외부 규칙집이 있다 — **Postgres/스키마/RLS/
마이그레이션을 만지기 전에 `supabase-postgres-best-practices/SKILL.md`를 먼저
읽는다.** React 성능 작업은 `vercel-react-best-practices/`.
`.claude/skills/`에 두지 않는다 — 플러그인 검증 게이트가 그 경로의 빈 디렉토리를
막기 때문이고, 지금 그 폴더는 아예 없다 (2026-08-18 확인).

## Principle: Defensive Data Access

세 출처는 반드시 옵셔널 체이닝 + fallback으로 읽는다 — **localStorage**(옛 데이터에
새 필드가 없다), **LLM 출력**(필드를 빼거나 타입이 틀린다), **Supabase 병합**(모양이
다르다). 배열·문자열은 `(data.field || fallback)`, 선택 접근은 `data?.field`.

## Principle: Clean Removal

기능 삭제 시: 컴포넌트/함수 삭제 → `grep -r "FeatureName" src/`로 **모든** 참조
확인 → import·상태·i18n 키·타입 필드 제거 → Supabase 컬럼 확인(정리는 선택).

## Principle: Schema Sync (2026-06-13 강화)

`sanitizeItem`(db.ts)은 `user_id/created_at/updated_at`만 빼고 **나머지를 전부
그대로 upsert한다.** 컬럼 없는 필드를 동기화 인터페이스에 추가하면 PostgREST가
PGRST204로 **행 전체를 거부**하고, 에러는 삼켜지므로, 그 사용자의 데이터가 조용히
서버에 안 닿는다. 네 가지 모두 실제로 겪은 조용한 실패다:

1. 필드 추가 = **같은 커밋에 마이그레이션 + `schema-drift.test.ts`의
   `TABLE_COLUMNS` 갱신.** 안 하면 가드 테스트가 PR을 막는다.
2. `deleted_at` 등 soft-delete 컬럼의 실재를 확인 — 없으면 삭제가 no-op이 되어
   지운 행이 reload 때 부활한다.
3. 새 `TableName`은 실DB에 **테이블이 있는지** 확인 — 없으면 조용히
   localStorage-only가 된다.
4. `user_id`가 있는 새 테이블 = `user-data-tables.ts` +
   `erasure-coverage.test.ts` **동시 갱신** — 안 하면 계정 삭제·내보내기가 그
   테이블을 영영 건너뛴다.

확인 SQL:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'TABLE_NAME';
```

## Architecture Notes

- **localStorage first, Supabase async** — 오프라인 동작, 연결되면 동기화.
  이것이 Persistence·Schema Sync 규약의 이유다: 로컬만 읽는 UI는 서버에 데이터가
  안 닿아도 멀쩡해 보인다.
- **Zustand stores** — 각 스토어에 loadData(local+remote 병합) + 변경 메서드
- **Context chain** — decompose → recast → persona-feedback → refinement
- **Handoff store** — 단계 간 임시 데이터, mount 시 `useEffect([], [])`로 소비
- **Quality signals** — `signal-recorder.ts`가 암묵적 사용자 행동을 기록
- **Track R (`method-harness/`)** — 이벤트 소싱 원장 + 결정론 validator.
  `src/`와 무접촉, 승인 예외는 `src/app/method-pilot/`과 `src/app/api/mcp/v2/` 2채널 (경계·예외 목록 모두 harness.test.ts가 강제).

## LLM Prompt Injection Guidelines

- 파생 패턴 데이터는 **기본 제외**. "참고"라 불러도 영향력은 중화되지 않으며,
  위 Zero-Judgment Gate 2항의 다섯 조건을 통과한 능동 스코프 승인이 필요하다.
  승인된 기억도 부차적이고
  `InfluenceTrace`를 남겨야 한다 (현재 작업 내용과 사용자 작성 제약이 1차).
- `src/lib/epistemic/control-plane.ts`가 파생 기억의 유일한 권위 — 승인은 grant가
  아니고, scope·만료·철회·반례·`ask_once` 재사용을 거기서 검사한다. trace를
  저장할 수 없으면 영향력은 0으로 fail-closed. 프롬프트 쪽 우회로를 새로 만들지 않는다.
- 주입은 통찰당 한 줄. 포괄적 행동 변경("보수적으로") 금지 — 항상 특정 맥락에 한정.
- 시스템 프롬프트의 사용자 데이터는 `<user-data>`로 감싸고 `sanitizeForPrompt()`를
  통과시킨다 (`persona-prompt.ts` 참조).

## 화면에 나가는 글 — 설계 어휘를 화면에 쓰지 않는다 (2026-08-21 창업자 지적)

**정본은 `DESIGN.md` 마지막 절**(바꿔 쓰는 표 + 금지 목록). 여기엔 재발 방지에
필요한 최소만 둔다.

> **근원**: 설계를 논하는 글과 사용자가 읽는 글은 **다른 언어**다. 설계 문서에서
> 압축 낱말(주입·대조·집행·표면·승격·관할·정산)은 미덕이지만, 그 문체가 목업
> 안으로 들어가면 사용자는 사전 없이 못 읽는다. **등록(register)을 바꿔야 한다.**

화면 문장·목업·카피를 쓸 때 **매번** 두 시험을 통과시킨다:

1. **처음 켠 사람이 사전 없이 읽고 지금 뭘 눌러야 하는지 아는가?**
2. **이 낱말, 우리 문서에서만 쓰는 말인가?** — 그렇다면 화면에서 뺀다.

특히 넷: **기계·감시 비유 금지**(경보·감시·집행 — 제품 성격을 정반대로 만든다) ·
**피동 금지**("어겨진 적"→"안 지킨 적") · **추상 동사 금지**("규칙을 좁힙니다"→
"문서 파일은 빼겠습니다") · **목업 상자 안에는 사용자가 읽을 글자만**(설계 설명은
상자 밖).

## Design: Banned Patterns (창업자 확정, 모든 세션 적용)

- **왼쪽 세로 악센트 바 금지** (2026-07-08): 텍스트 블록 왼쪽의 `border-l-[Npx]
  border-[var(--accent)]` 세로 바(인용 바, "손톱 모양") 영구 금지 — 화면마다
  반복되며 싸구려 장치가 됨. 인용/강조는 배경 틴트 블록(`rounded-lg
  bg-[var(--accent)]/[0.04] px-4 py-3`, 테두리 없음)이나 활자 위계로.
  `no-left-accent-bar.test.ts`가 CI에서 재등장을 막는다.

## XSS / User Input Security

- **JSX 자동 이스케이프가 실제 방어선** — `{variable}`은 안전하고, 그래서 지금
  XSS 이슈가 없다. **사용자 데이터에 `dangerouslySetInnerHTML` 금지**
  (`lib/sanitize.ts`의 `sanitizeHtml()`을 거치지 않는 한). 마크다운 렌더링을
  추가한다면 출력 HTML을 반드시 새니타이즈한다.
- **모든 텍스트 입력에 `maxLength`** — localStorage/Supabase 비대화 방지.
  팀에 보이는 데이터(댓글·리뷰·이름)가 최우선.
- **Supabase writes**는 `db.ts` 함수를 거친다 — 스토어에서 `supabase.from().insert()`
  직접 호출 금지. 단 **`sanitizeItem`을 보안 경계로 착각하지 말 것**: 그것은
  sync 정합성 게이트일 뿐 HTML 이스케이프도 `maxLength`도 하지 않는다. 실제
  XSS 방어는 렌더 층의 JSX 자동 이스케이프, 길이 제한은 입력의 `maxLength`다.
  (service role로 쓰는 서버 전용 테이블이 db.ts를 우회하는 것은 설계상 정상.)
