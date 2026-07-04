# argus-mcp MCP 규격 준수 감사 (2026-07-05)

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
> 대상 저장소: `C:\Users\admin\Documents\GitHub\Argus-align-3phase-main\argus-mcp` (커밋 시점 미확인 — 재작업 전 반드시 `git log -1`로 이 감사 이후 변경분을 먼저 diff할 것).
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
