# Fable5 Context Brief: Argus MCP 공개 전 문제의식과 다음 진단 요청

작성일: 2026-07-07  
용도: Fable5가 Argus의 MCP 공개 준비를 더 똑똑하게 검토할 수 있도록, 최근 우리가 어떤 문제의식으로 움직였고, 어떤 문제를 어떻게 풀었으며, 아직 어디에 근본 문제가 남아 있을 수 있는지 전달한다.  
중요 전제: 이번 공개 대상은 **Claude Code plugin이 아니라 MCP**다. `argus-plugin-v2/`는 이번 공개 범위에 넣지 말고, 필요할 때 개념/데이터/voice drift를 확인하는 참고물로만 보라.

## Fable5에게 기대하는 역할

Fable5에게 원하는 것은 "문서에 적힌 P0 목록을 검수하는 것"이 아니다. 지금 Argus에는 이미 많은 감사, 설계, 패치, 반박, 재패치가 쌓여 있다. 그래서 또 하나의 체크리스트를 추가하면 오히려 문제를 놓칠 가능성이 있다.

이번에는 더 넓은 자유도를 갖고 봐 줬으면 한다. 단, 아무 방향 없이 자유롭게 보라는 뜻은 아니다. 아래의 최근 문제의식과 해결 흐름을 맥락으로 삼고, 거기서 빠진 근본 문제를 찾아 달라.

질문은 대략 이렇다.

- MCP를 공개 제품으로 놓았을 때, Argus가 약속하는 "AI가 판단하지 않고, 사용자가 현실에 다시 묶이는 판단 영수증"이 실제 구조로 강제되는가?
- 웹앱은 MCP 공개를 받쳐 주는 landing/account/dashboard/return-loop 표면으로 충분한가, 아니면 MCP의 약속을 흐리거나 배신하는가?
- 최근에 고친 문제들이 정말 근본을 건드렸는가, 아니면 증상만 줄였는가?
- 아직 우리가 못 본 문제는 어디에 숨어 있을 가능성이 큰가?
- 더 큰 개선은 기능 추가가 아니라 어떤 구조적 단순화/통합/삭제에서 나와야 하는가?

구현 코드는 쓰지 말고, 진단과 설계, 실행계획까지만 작성하라. 다만 실행계획은 싸게 일할 수 있는 모델이 그대로 따라 할 만큼 구체적이어야 한다.

## 제품의 현재 중심축

지금 공개 중심은 `argus-mcp/`다. npm package name은 `argus-decision-mcp`이고, README의 약속은 명확하다.

> Your AI gives you an answer. Argus gives you a receipt, and checks it against reality on the date you set.

이 말이 중요하다. Argus는 "더 좋은 답변"을 주는 제품이 아니다. 사용자가 어떤 판단을 했는지, 그 판단이 어떤 검증 가능한 예측에 기대고 있는지, 언제 현실과 대조할 것인지를 묶어 두는 제품이다.

그래서 핵심 spine은 다음과 같다.

- AI verdict는 없어야 한다.
- seal 없이 settle할 수 없어야 한다.
- 예측은 falsifiable해야 한다.
- check-by date 이후 현실과 대조해야 한다.
- receipt는 점수표가 아니라 사용자의 판단과 현실의 차이를 보존하는 기록이어야 한다.
- return loop는 engagement nagging이 아니라 사용자가 직접 남긴 약속으로 돌아오게 하는 장치여야 한다.

웹앱 `src/`는 이번 공개에서 독립 제품이라기보다 MCP를 지지하는 표면으로 봐야 한다. 랜딩, 계정 토큰, MCP account bridge, web dashboard, email/Telegram/cron return loop가 있다. 웹앱이 중요하지 않다는 뜻은 아니다. 오히려 MCP가 stdio 서버라 스스로 깨어날 수 없기 때문에, 웹앱은 "돌아오게 하는 약속"을 실제로 완성하는 데 중요하다.

`argus-plugin-v2/`는 이번에 공개하지 않는다. 다만 오래 누적된 agent/persona/classification/voice/design 지식이 있고, 일부 개념은 MCP와 웹앱에 흘러 들어왔다. 그러므로 plugin은 launch surface가 아니라 drift를 확인하는 고고학적 참고물로만 다루면 된다.

## 최근 우리가 갖고 있던 문제의식

최근의 문제의식은 대략 네 갈래였다.

첫째, Argus가 너무 쉽게 "판단하는 AI"처럼 보일 수 있다는 문제였다.

MCP의 차별점은 "판단하지 않음"인데, UI나 문구가 score, grade, tier, improvement, recommendation, stronger case 같은 방향으로 흘러가면 제품의 심장이 깨진다. 그래서 MCP에는 verdict/grade/score tool을 두지 않고, `NEXT_ACTIONS`를 닫힌 enum으로 관리하고, receipt에는 `AI VERDICT ... NONE`을 노출하는 방향으로 갔다. `argus-mcp/src/lib/spine.ts`, `argus-mcp/src/lib/__tests__/spine-drift.test.ts`가 이 문제의식의 결과다.

둘째, "봉인"은 쉬운데 "돌아오기"가 약하다는 문제였다.

MCP는 자체적으로 살아 있는 서비스가 아니다. 사용자가 MCP host를 열지 않으면 아무것도 깨우지 못한다. 그래서 `ARGUS_TOKEN`을 설정한 경우 MCP가 sealed prediction을 웹 계정으로 push하고, 웹앱의 cron/email/Companion Brief/dashboard가 check-by date 이후 다시 보여 주는 구조를 만들었다. `argus-mcp/src/lib/push-account.ts`, `src/app/api/mcp/seal/route.ts`, `src/app/api/mcp/receipts/route.ts`, `src/app/api/cron/checkin-due/route.ts`, `src/app/api/cron/companion-brief/route.ts`가 관련된다.

셋째, MCP local ledger와 web account mirror 사이의 id/state mismatch가 실제 사용자 경험을 망칠 수 있다는 문제였다.

과거에는 `mcp_` prefix가 붙은 account id와 local ledger id가 엇갈려서, sync가 "이걸 settle하라"고 알려 줘도 `argus_settle`이 `NO_PRIOR_SEAL`을 내는 식의 문제가 있었다. 최근에는 `argus_sync`가 `local_id`, `settle_path`, `settled_in_account`를 반환하도록 바뀌었다. 즉 web-sealed 판단은 web dashboard에서 settle하고, terminal-sealed 판단은 local_id로 settle하라는 분기를 드러내는 방향이다. 하지만 이것이 실제 host에서 충분히 명확한지는 아직 검증 대상이다.

넷째, living premises가 receipt의 가장 중요한 줄을 죽은 텍스트가 아니라 살아 있는 추적 대상으로 만들 수 있다는 문제의식이었다.

`THE UNVERIFIED ASSUMPTION`은 Argus receipt의 핵심이다. 예전에는 seal 시점의 한 줄로 끝났다면, 지금 MCP에는 `argus_premises`와 `argus_recheck`가 들어와 있다. 전제를 add/amend/resolve하고, 외부 사실을 recheck하며, check-by 이전에 전제가 변했는지 볼 수 있게 하려는 방향이다. 관련 파일은 `argus-mcp/src/tools/premises.ts`, `argus-mcp/src/tools/recheck.ts`, `argus-mcp/src/lib/premises.ts`, `argus-mcp/src/lib/numeric-drift.ts`다.

## 최근에 풀었다고 보는 것들

아래는 "완전히 보증됨"이 아니라 "최근 코드상 해결 또는 완화된 흔적이 있다"는 의미다. Fable5는 이 항목을 그대로 믿지 말고, 제대로 해결됐는지 검증해 달라.

- MCP는 이제 6개 툴 초안 상태가 아니다. 현재 `argus-mcp/src/tools/index.ts`에는 13개 툴이 등록되어 있다: `open_decision`, `review`, `premises`, `seal`, `recheck`, `settle`, `check_in`, `recall`, `sync`, `amend`, `dismiss`, `init`, `config`.
- `server.ts`는 tools/resources/prompts handler를 모두 갖고 있고, Zod schema에서 JSON Schema를 만든다. 예전 문서의 "resources/prompts는 나중" 전제는 낡았을 수 있다.
- `argus_sync`는 `mcp_` prefix 문제를 의식해 `local_id`와 `settle_path`를 반환한다.
- web bridge는 MCP seal/settle을 `review_receipts`에 mirror하는 경로를 갖고 있다.
- account deletion/export 누락 문제는 `src/lib/user-data-tables.ts`의 `USER_DATA_TABLES` SSOT로 보완된 흔적이 있다.
- MCP package rename과 stale dist 방지 커밋이 최근 들어갔다.
- 방금 현재 환경에서 `argus-mcp` 기준 `npm run typecheck`, `npm test`, `npm run build`는 통과했다. 이건 기계적 검증 통과일 뿐, 실제 MCP host와 web account까지 포함한 end-to-end 보증은 아니다.

## 아직 의심하는 지점

### 1. 공개 제품의 canonical object가 아직 흐릴 수 있다

가장 큰 의심은 "Judgment가 무엇인가"가 표면마다 다를 수 있다는 점이다.

MCP에는 local append-only ledger가 있다. 웹앱에는 `review_receipts`가 있다. 프로젝트 화면에는 `projects.decision_contract`와 logbook/fleet chart 같은 누적 표면이 있다. Telegram/email/check-in에도 각자의 row와 상태가 있다. 이들이 모두 같은 lifecycle을 공유하는지, 아니면 운 좋게 이어 붙은 것인지 봐야 한다.

특히 `review_receipts`를 MCP account mirror로 쓰는 결정은 빠르고 실용적이지만, review artifact의 schema와 judgment receipt의 schema가 의미적으로 같은지는 의심스럽다. `reviewability.score: 0`, `profile.stakes: medium`, `root_mode: review` 같은 placeholder가 MCP receipt의 의미를 오염시키고 있지 않은지 확인해 달라.

### 2. local-only privacy default와 return loop 가치가 충돌할 수 있다

`ARGUS_TOKEN`이 없으면 MCP는 네트워크를 쓰지 않고 local-only로 남는다. 이건 강점이다. 하지만 Argus의 가치는 check-by date에 돌아오는 데 있는데, local-only 사용자는 스스로 MCP를 다시 열지 않으면 돌아오지 않는다.

이 한계를 README는 "honest limit"으로 설명한다. 그 설명이 충분한지, 아니면 첫 사용자에게는 "봉인하고 잊는 도구"로 느껴질지 봐야 한다. optional calendar export, explicit check-in ritual, host prompt, web token onboarding 중 무엇이 최소 개선인지 판단해 달라.

### 3. `argus_sync`의 분기 설명이 실제 host에서 충분히 전달될지 불확실하다

`local_id`와 `settle_path`는 구조적으로 좋은 완화다. 하지만 MCP host의 실제 응답 렌더링에서 사용자가 이 차이를 이해할지는 별개다.

검증해야 할 질문:

- web-sealed receipt가 sync에 나타날 때 terminal에서 settle하려고 하지 않게 충분히 막는가?
- terminal-sealed receipt가 web에서 settled 되었을 때 local ledger는 계속 sealed로 남는데, 사용자가 이 상태를 "중복"이 아니라 "local record를 직접 닫아야 함"으로 이해하는가?
- `next_actions: ['argus_settle']`가 web-only receipt와 같이 나올 때 host가 잘못 유도하지 않는가?

### 4. "AI verdict none"은 MCP 안에서는 강하지만 웹앱 전체에서는 다시 샐 수 있다

MCP 내부에는 꽤 강한 guard가 있다. 하지만 웹앱의 navigator, project, record, fleet chart, logbook, boss, review 화면이 score/tier/progress/quality language를 다시 가져오면 사용자는 Argus가 자신을 평가한다고 느낄 수 있다.

확인할 파일:

- `src/lib/navigator.ts`
- `src/lib/judgment-vitality.ts`
- `src/components/projects/*`
- `src/components/workspace/progressive/*`
- `src/lib/i18n/ko.ts`, `src/lib/i18n/en.ts`
- `argus-mcp/src/lib/surfaces.ts`

특히 "improving/declining", "score", "tier", "mastery", "recommend", "right call" 같은 문구가 사용자의 판단을 평가하는 것처럼 보이지 않는지 보라.

### 5. living premises가 제품을 날카롭게 만들 수도, 너무 복잡하게 만들 수도 있다

전제를 살아 있는 객체로 만든 것은 좋은 방향일 수 있다. 하지만 첫 공개 MCP에서 `open -> premises -> seal -> recheck -> settle`의 흐름이 너무 무거우면 사용자는 핵심 loop도 못 끝낼 수 있다.

확인할 질문:

- `argus_premises`는 필수처럼 느껴지는가, 선택적 깊이처럼 느껴지는가?
- 전제를 추적하지 않아도 seal/settle의 핵심 가치는 살아 있는가?
- `argus_recheck`는 실제 host가 외부 사실을 조사해 넣어야 하는데, 그 책임 경계가 명확한가?
- `apply_to_matching` 같은 고급 기능이 첫 공개에서 너무 앞서 나간 것은 아닌가?

### 6. Korean voice와 encoding 문제가 신뢰를 깎을 수 있다

로컬 PowerShell 출력에서는 루트 README와 일부 문서/댓글/문구가 mojibake처럼 보였다. 이것이 terminal encoding 문제인지 실제 파일 인코딩 문제인지는 확인이 필요하다.

MCP 공개에서 한국어 사용자를 고려한다면, 깨진 한글이나 어색한 번역은 단순 polish가 아니라 신뢰 문제다. 특히 receipt, sync, error recovery, token setup, privacy 안내 문구는 한 번이라도 깨져 보이면 제품이 허술해 보인다.

### 7. 테스트는 많지만 cross-surface e2e가 부족할 수 있다

`argus-mcp`의 typecheck/test/build는 통과했다. 하지만 이건 MCP package 내부 검증이다. 공개 리스크는 cross-surface에 있다.

꼭 확인해야 할 e2e:

- MCP local-only: init -> open -> seal -> check_in -> settle -> recall receipt.
- MCP with account token: seal -> web `/api/mcp/seal` -> receipt appears in web account -> due cron/brief -> sync -> settle.
- web-sealed receipt -> `argus_sync` -> `local_id: null` -> terminal에서 잘못 settle하지 않음.
- terminal-sealed receipt -> web에서 settled -> `argus_sync`가 `settled_in_account`를 보여 주고 local auto-settle하지 않음.
- account deletion/export가 MCP mirrored receipts까지 포함함.

## Fable5가 자유롭게 판단해도 되는 영역

아래는 내가 결론을 정하지 않는다. Fable5가 코드와 제품 감각을 보고 독립 판단해 달라.

- `review_receipts`를 MCP mirror로 계속 써도 되는가, 아니면 별도 `judgment_receipts`가 필요한가?
- MCP tool 수 13개가 공개 제품으로 적절한가, 아니면 첫 공개 표면은 더 작게 보여야 하는가?
- living premises는 launch headline이어야 하는가, advanced capability로 뒤로 빠져야 하는가?
- local-only return loop의 한계는 honest disclosure로 충분한가, 아니면 최소한의 calendar/export/check-in UX가 필요하가?
- 웹앱은 MCP dashboard로 더 단순해져야 하는가, 아니면 현재 voyage/project/logbook/fleet chart 방향이 MCP의 가치를 강화하는가?
- Korean/English voice를 하나의 policy로 묶어야 하는가, 아니면 MCP만 먼저 단단히 하고 웹 voice는 나중에 정리해도 되는가?

## Fable5에게 원하는 산출물

답변은 꼭 하나의 거대한 감사 보고서일 필요는 없다. 더 중요한 것은 판단의 질이다. 다만 아래 구조를 따르면 다음 실행자가 덜 헤맨다.

1. **가장 강한 thesis**
   지금 Argus MCP 공개를 막거나 좌우할 가장 중요한 구조적 문제를 1-3문장으로 써라.

2. **최근 해결 흐름에 대한 판정**
   위에서 말한 최근 해결들이 근본 해결인지, 임시 완화인지, 오히려 새 복잡성을 만든 것인지 판단하라.

3. **Top findings**
   각 finding마다 severity, 관련 표면(MCP/web bridge/webapp/docs/tests), 근거 파일, 왜 문제인지, 가장 싼 반증 테스트, 해결 방향을 포함하라.

4. **못 봤을 가능성이 큰 blind spots**
   팀 문서에 없거나 약하게 다뤄진 문제를 최소 5개 제시하라. "어디를 보면 확인되는지"를 붙여라.

5. **근본 설계 제안**
   필요하다면 canonical Judgment object, lifecycle reducer, sync policy, receipt schema, voice invariant, adapter boundary를 제안하라. 단, 과설계하지 말고 첫 공개에 필요한 만큼만 자르라.

6. **실행계획**
   Wave 0/1/2 식으로 나눠라.
   - Wave 0: 결론을 확정할 검증과 e2e
   - Wave 1: 공개 전에 반드시 고쳐야 할 것
   - Wave 2: 공개 직후 개선
   - Wave 3: 보류하거나 버릴 것

7. **사람이 결정해야 할 것**
   코드가 아니라 제품 판단이 필요한 질문을 분리하라.

## Fable5에게 그대로 줄 수 있는 프롬프트

```text
You are Fable5. You are not here to implement code or repeat old audit checklists.

Argus is about to publicly ship MCP, not the Claude Code plugin. Treat `argus-mcp/` as the public product. Treat `src/` as the web/account/dashboard/return-loop surface that supports MCP. Treat `argus-plugin-v2/` as private reference material only.

First read:
docs/FABLE5-ARGUS-WEBAPP-MCP-DIAGNOSTIC-BRIEF-2026-07-07.md

Then inspect the current code. Be careful: some older P0s appear to have been mitigated, but that does not mean the system is correct end-to-end.

I want your independent diagnosis:
- what recent problem-awareness has been valid;
- which fixes are real and which are only local patches;
- where hidden problems likely remain;
- what root design would make MCP + web return loop coherent;
- what to do before public MCP release, and what to defer.

Write in Korean. Lead with judgment. Do not write production code.
```

