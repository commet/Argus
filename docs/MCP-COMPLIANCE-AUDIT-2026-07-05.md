# argus-mcp MCP 규격 준수 감사 (2026-07-05)

## 정식 감사 + 수정 (2026-07-06, commit `70056a8` 기준 — premise-watcher 반영 후)

> 사용자 요청: "우리 검수 문서 토대로 MCP 감수 제대로 한번 쭉 + 문제 있으면 수정." 이 워크트리를 최신 main(`70056a8`, judgment-checkpoint·clarify·premise-watcher 반영분)으로 ff한 뒤 전 표면을 정독하고, 아래 2건을 **실제로 수정**했다. 나머지는 상태 갱신.

**수정 완료 (커밋됨, 테스트 포함):**

| 항목 | 무엇을 | 어떻게 |
|---|---|---|
| **G3** `argus_premises op=add`가 retired 전제 재추가를 조용히 삼킴 | 스파인 위반(침묵 누락 + "already recorded" 거짓 문구) | `tools/premises.ts` opAdd dedup을 Set→Map으로 바꿔 3-케이스 분리: active 동일=idempotent skip(기존 유지) / **retired·resolved 동일=정직하게 표면화**(`skipped_retired` 데이터 + "retired earlier, add with different wording" 문구) / 회귀테스트 1건 |
| **G4** premise_id 32비트 djb2 해시 충돌 시 다른 사실을 dup으로 침묵 삭제 | 침묵 누락(극히 드묾이나 원칙 위반) | 같은 블록에서 **id는 같은데 정규화 텍스트가 다르면** `PREMISE_ID_COLLISION` 에러로 loud fail(reword 안내). 조용히 버리지 않음 |

검증: `npm run typecheck` 0, `npm test` **378/378 통과**(27파일, 빌드 + 실서버 stdio 프로토콜 왕복 포함). 새 회귀테스트 2건(active-dup은 retired로 오분류 안 됨 / retired 재추가는 `skipped_retired`로 표면화).

**상태 갱신 (수정 불요 / 상향):**

| 항목 | 이전 | 지금 |
|---|---|---|
| **F4** Inspector-in-CI | 📋 백로그 | ✅ **사실상 해결** — `tools/__tests__/protocol-roundtrip.test.ts`가 빌드된 `dist/index.js`를 SDK 클라이언트로 stdio 스폰해 initialize→tools/list→tools/call→resources/read→prompts/get 왕복을 CI에서 검증. Inspector가 수동으로 하던 걸 자동화한 것. 별도 Inspector CI 스텝은 이제 잉여 |
| **G2** review 파싱 zip-bomb 방어 | ⚠️ 백로그 | ⚠️ 유지(수정 안 함) — 입력 파일 `MAX_DOC_BYTES=400KB` 상한이 압축원본을 제한하므로 증폭 상한이 실질적으로 묶임(400KB 압축 → 최악 수백MB, Node 처리가능). 로컬 단일사용자 stdio라 위협모델 약함. defense-in-depth로만 남김 |
| **F1b** Streamable HTTP + OAuth | ⏸ 창업자 결정 | ⏸ 유지 — 원격 호스트 지원 여부는 여전히 제품 결정. 미착수 |
| **F5** 페이지네이션 · **F6** logging capability | 📋 백로그 | 📋 유지 — 현 규모 무해, 스펙 위반 아님 |
| **F1a/F2/F3/F7/G1** | ✅ | ✅ 리그레션 0 재확인(grep) |

premise-watcher 관련: MCP 서버 표면엔 여전히 `premises-core.ts`의 타입 필드(`auto_watch`/`watch_query`/`PremiseRecheck.auto`) +10줄뿐 — 실제 감시·조사·네트워크는 전부 웹앱(cron)이고 **MCP는 이 필드를 읽지도 쓰지도 않음**(주석 "the MCP ignores it" 확인). 새 도구/리소스/capability 추가 0건. 즉 "특별 파트"의 위험(외부 네트워크·프라이버시)은 MCP 서버 밖에 있어 이 감사 범위에서 클린.

---

## 재감사 (2026-07-06, commit `e08aa6a` 기준 — 다른 세션의 "대공사" 진행 중 스냅샷)

> 이 워크트리(`suspicious-lovelace-bf59f2`)를 `origin/main`으로 fast-forward한 직후 재확인. 이 시점에 별도 워크트리 `objective-shaw-1b5fbf`(브랜치 `claude/objective-shaw-1b5fbf`)에서 premise-watcher(자동 감시) 기능을 계속 얹는 중 — 이 감사는 **그 공사가 본격화되기 전의 베이스라인**이다. 약 3시간 뒤 그 브랜치를 기준으로 다시 감사해서 이 표와 diff할 것.

| 항목 | 상태 | 비고 |
|---|---|---|
| F1a/F2/F3/F7 | ✅ 유지 | 리그레션 없음. https 강제·top-level title·README 문구·패키지명 전부 그대로 |
| F1b/F4/F5/F6 | 📋 백로그 유지 | 코드 재확인 — grep 0건, 착수 안 됨 |
| **G1 (신규, 긍정)** MCP 레지스트리 `server.json` 매니페스트 추가 | ✅ | `2025-12-11` 스키마, `package.json`/`server.json`/`mcpName` 버전 전부 1.1.0으로 일치. 이전 감사 시점엔 없던 항목 — 규격 준수 수준이 오히려 더 올라감 |
| **G2 (신규 발견)** `argus_review` 문서 파싱의 압축률 공격(zip bomb) 방어 없음 | ⚠️ 낮은 우선순위 | `review.ts`의 `MAX_DOC_BYTES=400_000`은 **원본 파일 크기**만 제한. docx/pptx는 zip 포맷(jszip)이라 이론상 작은 파일이 압축해제 시 과도한 메모리를 쓸 수 있음(고전적 zip-bomb). `MAX_UNITS` 캡은 파싱 *이후* 결과물 개수만 자름 — jszip/pdfjs가 먼저 압축해제를 시도하는 건 못 막음. 로컬 단일사용자 stdio 도구라 위협모델은 약함(공격자가 이미 tool-call 인자를 통제해야 함) — defense-in-depth 백로그로 남김 |
| **G3 (미수정 확인)** `argus_premises op=add`가 retired 전제와 같은 문구를 조용히 무시 | ⚠️ 낮은 우선순위 | 이전 감사(F1과 별개로 발견)에서 지적한 것과 동일한 코드가 `tools/premises.ts:134-135`에 그대로 있음(`known` 셋이 status 안 가림). premise 로직이 `premises-core.ts`로 리팩터(웹앱과 drift-pin 공유)됐지만 이 dedup 자체는 손 안 댐 |
| **G4 (미수정 확인)** premise_id 32비트 해시 충돌 가능성 | ⚠️ 낮은 우선순위 | `premises-core.ts:153`의 djb2 해시 그대로. 이전 감사와 동일 |

이번 재감사에서 argus-mcp 도구 수는 여전히 13개(`tools/index.ts`), 리그레션 0건. 다음 재감사(3시간 뒤)는 `objective-shaw-1b5fbf` 브랜치에서 실행해 이 표를 기준선으로 diff할 것 — 특히 새 도구/리소스가 추가됐다면 annotations·outputSchema·structuredContent·capabilities 선언이 신규 표면에도 다 따라붙었는지 확인.

## 재감사 (2026-07-06, `claude/objective-shaw-1b5fbf` 기준 — 사용자가 3시간 대기 없이 즉시 실행 요청)

바로 위 베이스라인 직후, 예약(3시간 뒤) 대신 **지금 바로** `objective-shaw-1b5fbf` 워크트리를 대상으로 재확인. `git log --oneline e08aa6a..HEAD -- argus-mcp` 결과 **커밋 1개**(`18e90e2` "autonomous premise watcher — Argus checks reality for you (E1-E4)")뿐이고, 그중 argus-mcp를 건드린 파일은 **`src/lib/premises-core.ts` 1개, +10줄**뿐.

diff 내용: `PremiseRecheck`에 `auto?: boolean`(서버 워처가 대신 기록했음을 표시), `PremiseState`에 `auto_watch?: boolean` / `watch_query?: string`(사용자가 이 전제를 웹에서 자동 감시하도록 옵트인했는지) 추가. 주석에 명시적으로 **"jsonb-nested, no migration; the MCP ignores it"** — 즉 이 필드들은 웹앱의 cron 워처가 쓰는 것이고 **MCP 서버 자체는 읽지도 쓰지도 않음**(webapp과 drift-pin 공유하는 타입 정의만 넓힌 것).

결론: **MCP 표면(도구/리소스/프롬프트/capabilities/네트워크 호출)에 실질적 변화 0건.** 새 도구·리소스 없음. F1a/F2/F3/F7/G1 재확인 결과도 grep으로 전부 동일(https 강제·top-level title·13개 도구 annotations·버전 1.1.0 일치 유지). G2/G3/G4는 손 안 댄 코드라 그대로. 예약해둔 `argus-mcp-reaudit-objective-shaw` 3시간 후 실행 작업은 지금 이 결과로 갈음 — 사용자에게 취소 여부 확인 필요(이 시점 이후 추가 변화가 있다면 여전히 유효한 재확인이 될 수 있음).

---

## 실행 결과 (2026-07-05, pensive-almeida 세션 — 컴패니언 메커니즘 M1~M4 완료 후)

| 항목 | 상태 | 조치 |
|---|---|---|
| **F2** https 강제 | ✅ **RESOLVED** | `push-account.ts`에 `resolveApiBase()` 추가 — 비-https `ARGUS_API_URL` override는 토큰 전송 거부(`insecure_api_url`), localhost만 예외. 회귀 테스트 `compliance.test.ts` 3건. |
| **F3** Tool top-level `title` | ✅ **RESOLVED** | `server.ts` ListTools 매핑에 `title: t.annotations?.title` 추가 → 13개 도구 전부 top-level title (dist stdio `tools/list`로 확인). |
| **F1a** README 문구 정직화 | ✅ **RESOLVED** | "any host/ChatGPT/Gemini" → "로컬 stdio 지원 호스트(Claude Desktop/Code)"로 좁힘. 원격 HTTP 커넥터 미지원 명시. |
| **F7** 패키지명 통일 | ✅ **RESOLVED** (선행 세션) | `argus-mcp` → `argus-decision-mcp`로 개명·npm 발행 완료(1.0.0). 사용자향 옛이름 0건. |
| **F1b** Streamable HTTP + OAuth 전송 | ⏸ **창업자 결정 대기** | 원격 ChatGPT/Gemini 지원을 실제로 원하는지부터 결정 — 대형 아키텍처 투자. 미착수. |
| **F4** Inspector CI · **F5** 페이지네이션 · **F6** logging capability | 📋 **백로그** | 현 규모에 무해. 우선순위 낮음. |

원 감사 스냅샷은 아래 그대로 보존.

---

> **왜 지금 고치지 않고 문서로만 남기나:** 이 감사를 시작한 시점에 **다른 세션이 argus-mcp를 전방위적으로 손대고 있음**(파일/도구/스키마가 시시각각 바뀌는 중). 지금 고치면 그 세션과 정면충돌하거나, 그 세션이 이미 고치는 중인 걸 중복 작업할 위험이 크다. 그래서 이 문서는 **"지금 스냅샷 기준 발견사항 + 재확인 절차"**만 남기고, 실제 수정은 그 세션이 병합된 뒤 별도 세션에서 진행한다.
>
> 대상 저장소: `argus-mcp/` (커밋 시점 미확인 — 재작업 전 반드시 `git log -1`로 이 감사 이후 변경분을 먼저 diff할 것).
> 참고 문서: [`MCP-REDESIGN-BLUEPRINT-2026-06-30.md`](MCP-REDESIGN-BLUEPRINT-2026-06-30.md), [`MCP-REDESIGN-ADDENDUM-v1.1-2026-06-30.md`](MCP-REDESIGN-ADDENDUM-v1.1-2026-06-30.md) — 이 감사는 그 문서들의 **후속 스팟체크**다. addendum의 A~N 항목 상당수(annotations 완비, outputSchema+structuredContent, capabilities 지연선언, `instructions` 필드, stderr-only 로깅)가 **이미 코드에 반영된 것을 2026-07-05 시점 직접 읽어 확인**했다 — addendum이 작성된 뒤 실제로 시공됐다는 뜻. 아래는 그 위에서 발견한 **잔여 gap**이다.

---

## 재검토 절차 (다른 세션 병합 후, 여기부터 시작)

1. `cd argus-mcp && git log --oneline -20` — 이 문서 작성 이후 커밋 확인.
2. 아래 표의 각 항목을 **파일 경로 + 라인이 아직 유효한지** 먼저 확인(다른 세션이 이미 고쳤을 수 있음). 유효하지 않으면 항목에 `RESOLVED (다른 세션, commit <hash>)`로 갱신하고 넘어감.
3. 유효한 항목만 실제로 고친다. 순서는 "우선순위" 열 기준.
4. 고친 뒤 `npm test && npm run typecheck && npm run build`, 그리고 `npx @modelcontextprotocol/inspector node dist/index.js`로 수동 확인.

---

## 발견사항

### P0 — 사실 주장 정합성 (README가 실제로 못 하는 걸 약속)

**F1. Streamable HTTP 전송 미구현 — README의 "any MCP host" 주장이 과장됨**
- 현재: `src/index.ts`가 `StdioServerTransport`만 생성·연결. HTTP/SSE 전송 코드 없음.
- 문제: README.md 12행 `Works with any MCP host — Claude, ChatGPT, Gemini, or any MCP-compatible client.` — ChatGPT/Gemini 쪽 원격 커넥터 생태계는 대부분 **HTTP(+OAuth) 전송**을 요구한다(로컬 프로세스를 직접 스폰 못 하는 호스트가 있음). 지금 주장은 "로컬에서 stdio 프로세스 스폰이 가능한 호스트"에 한정된 사실.
- 조치안 (택1):
  - (a) 문구를 좁힌다 — "Claude Desktop/Code, 그리고 로컬 stdio MCP 설정을 지원하는 모든 호스트"로 정직화. 코드 변경 없음, 가장 빠름.
  - (b) `StreamableHTTPServerTransport`(SDK가 이미 제공)를 추가해 실제로 원격 배포를 지원. 이 경우 인증(F2 연계)이 필수 조건이 됨 — MCP Authorization 스펙(OAuth 2.1 기반)을 그때 가서 구현해야 함. **지금은 로컬 stdio 단일 유저 도구라 이 investment가 맞는지부터 판단 필요** — 스코프가 크므로 별도 세션/논의로 분리 권장.
- 참고: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports#streamable-http

**F2. Authorization 플로우 — 현재 스코프에선 "해당 없음"이 맞는 판단, 단 사이드채널 하나 확인 필요**
- MCP Authorization 스펙(OAuth 2.1)은 HTTP 전송에만 적용된다. stdio 전용인 지금 architecture에서는 미구현이 정상.
- 다만 `src/lib/push-account.ts`가 `ARGUS_TOKEN`(Bearer)으로 자체 웹앱 API(`https://argus.voyage`)에 붙는 **MCP 프로토콜 밖의 별도 채널**을 갖고 있음. 코드 자체(타임아웃 5s, 실패시 무해화, 토큰 형식 검사 `argus_pat_` prefix)는 양호하나:
  - `ARGUS_API_URL` env override 시 `http://`도 허용됨(자가호스팅용이지만 토큰 평문전송 가능) → `https://` 강제 검증 한 줄 추가 권장.
  - 파일: `push-account.ts` 63-65행(`fetchAccountReceipts`), 88행(`pushToAccount`) — 두 함수 모두 동일 패턴이라 같이 고쳐야 함.
- 참고: https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization#authorization-flow

### P1 — 스펙 정합성 (지금 작동은 하지만 최신 스펙 관행에서 벗어남)

**F3. Tool에 top-level `title` 필드 누락**
- 2025-06-18 스펙부터 Tool/Resource/Prompt는 `name`(프로그램용)과 별개로 사람이 읽는 top-level `title`을 가질 수 있고, 표시 우선순위는 `title(top-level) > annotations.title > name`이다.
- `src/prompts.ts`(`listPrompts`)는 이미 top-level `title`을 채우는데, `src/server.ts`의 `ListToolsRequestSchema` 핸들러(65-74행)는 `annotations.title`만 있고 top-level `title`을 안 채운다. 이미 `t.annotations?.title` 값이 있으니 그대로 매핑하면 됨.
- 수정 위치: `server.ts` 65-74행, `tools.map` 객체에 `title: t.annotations?.title` 한 줄 추가.

**F4. Inspector가 문서화만 되어 있고 CI에 안 물려있음**
- README/CONTRIBUTING 둘 다 `npx @modelcontextprotocol/inspector node dist/index.js`를 수동 개발 명령으로만 안내.
- Inspector CLI 모드(`--cli` 플래그, `method=tools/list` 등)로 `tools/list` 출력을 스냅샷 검증하는 CI 스텝을 추가하면 스키마/annotations 회귀를 모델 없이 자동으로 잡을 수 있음. `npm test`(vitest, `schema-validation.test.ts`)가 이미 상당 부분 커버하고 있어서 **급하지 않음** — Inspector CI화는 "실제 프로토콜 핸드셰이크"까지 검증한다는 점에서 보완적 가치.
- 참고: https://modelcontextprotocol.io/docs/tools/inspector , https://github.com/modelcontextprotocol/inspector

**F5. 리스트 API에 페이지네이션(cursor) 없음**
- `tools/list`, `resources/list`, `prompts/list` 모두 커서 없이 전체 반환(`server.ts` 57-74행, `resources.ts` `listResources`/`listResourceTemplates`).
- 지금 규모(11개 도구, 4개 프롬프트, 3+1개 리소스)에서는 무해. 도구 수가 크게 늘 계획이 없다면 **낮은 우선순위** — 항목만 남겨둠.

**F6. `logging` capability 미선언**
- 현재 진단은 stderr 전용(`log.ts`) — 정상 동작하지만, `capabilities: { logging: {} }`를 선언하고 `notifications/message`로 보내면 Inspector 등 지원 클라이언트가 서버 로그를 실시간으로 볼 수 있다. 선택사항, 없어도 스펙 위반 아님.

### P2 — 스펙과 무관하지만 같이 정리하면 좋은 것

**F7. 패키지명 불일치**
- 메모리 기록상 `argus-mcp` → `argus-decision-mcp` 개명이 승인된 상태이나, `package.json`의 `name`/`bin`이 여전히 `argus-mcp`, 코드베이스 전체에 `argus-decision-mcp` 문자열 0건(grep 확인 완료). 다른 세션이 이미 진행 중일 수 있으니 **재검토 시 먼저 확인**.

---

## 이번 감사에서 "이미 잘 되어 있다"고 직접 확인한 것 (재작업 시 되돌리지 말 것)

- `content` + `structuredContent` 이중 반환 (`lib/envelope.ts`)
- stdout 무오염, stderr 전용 로깅 (`lib/log.ts`)
- Zod → JSON Schema 단일소스, `$schema` 노이즈 제거 (`tools/tool-types.ts`)
- 스키마 실패 시 프로토콜 크래시가 아닌 `isError:true` 정상 tool-result (`server.ts` 104-111행)
- 11개 도구 전부 annotations 완비 + 테스트로 강제 (`schema-validation.test.ts`)
- capabilities 지연 선언 (핸들러 있는 프리미티브만 `{tools:{}, resources:{}, prompts:{}}`)
- `instructions` 필드로 스파인 편향을 1회 전달 (복붙 시스템프롬프트의 규격상 정당한 대체지)
- 동시 호출 직렬화(`serialize` 체인)로 ledger read-replay-append 경합 방지
- elicitation을 클라이언트 capability로 정확히 이해(서버가 advertise하는 게 아니라 사용만) — `server.ts` 31-34행 주석이 정확
- verdict/score/grade 툴 부재를 CI가 강제(`spine-drift.test.ts`, CONTRIBUTING.md)

---

## 요약 우선순위

| 순위 | 항목 | 난이도 | 비고 |
|---|---|---|---|
| 1 | F2 https 강제 | 5분 | 보안, 바로 고칠 가치 |
| 2 | F3 top-level title | 5분 | 스펙 정합 |
| 3 | F1 README 문구 좁히기 (택a) | 5분 | 정직성, 코드 변경 없음 |
| 4 | F1 Streamable HTTP 추가 (택b) | 대형 | 별도 논의/세션 필요 — 원격 호스트 지원을 실제로 원하는지부터 결정 |
| 5 | F7 패키지명 통일 | 5분 | 다른 세션과 충돌 가능성 먼저 확인 |
| 6 | F4 Inspector CI화 | 중 | 보완적, 급하지 않음 |
| 7 | F5 페이지네이션, F6 logging capability | 낮음 | 지금 규모에서 무해, 백로그 |
