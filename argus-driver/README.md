# Argus Driver — thin Claude Code plugin for `argus-decision-mcp`

설치 2줄 (Claude Code 안에서):

```
/plugin marketplace add commet/Argus
/plugin install argus-driver@argus
```

설치가 하는 일 전부:

1. **MCP 자동 배선** — 번들된 [`.mcp.json`](./.mcp.json)이 `argus-decision-mcp`
   stdio 서버를 등록한다 (`npx -y argus-decision-mcp`). 별도 설정 없음.
   결정을 포착하고, 예측을 저장하고, 확인할 것을 보고, 실제 결과를 기록하는
   6개의 목적형 도구(`argus_capture` / `argus_predict` / `argus_resolve` /
   `argus_check_in` / `argus_patterns` / `argus_settings`)를 바로 쓸 수 있다.
   별도 초기화 명령이나 의식을 배울 필요는 없다.
2. **statusline 동봉 (선택)** — [`statusline/index.js`](./statusline/index.js)는
   내구 v2 원장(`~/.argus/projects/{repository_id}/`)과 레거시 워크트리 원장을
   모두 읽는 zero-dependency 스크립트다. 켜려면 `~/.claude/settings.json`에 1줄:

   ```json
   "statusLine": { "type": "command", "command": "node ${CLAUDE_PLUGIN_ROOT}/statusline/index.js" }
   ```
3. **ambient 방아쇠 동봉** — [`hooks/ambient-nudge.js`](./hooks/ambient-nudge.js)는
   프롬프트 제출 시 due **건수만** 확인하고, 있으면 "사용자의 요청을 전부 처리한
   뒤 응답 끝에 due 항목 하나를 물어라"는 지침을 모델에 주입한다 — 기다리던
   턴의 끝이 판단 확인 시간이 된다. 발사 게이트가 먼저다: due 0건, stale
   LOGBOOK, 쿨다운(세션당 1회 + 세션 밖 4시간) 미충족이면 완전 침묵. 결정/전제
   본문은 절대 주입하지 않으며(건수뿐), 내용은 모델이 `argus_check_in`으로
   서버에서 받는다 (호출 경로가 어긋나지 않게 워크스페이스의 `.argus` 절대경로를
   지침에 명시). MCP 미연결이면 지침 전체를 조용히 무시하게 열화 규칙이 박혀
   있고, 전제·열린 질문은 자유 텍스트로만 묻게 강제된다(선택지 금지).
   끄기: `~/.argus/config.json`에 `{ "ambient": { "opt_out": true } }`.

## 이 플러그인이 하지 않는 일

- 원장을 만들거나 지우지 않는다. 결정 기록의 정본은 `~/.argus`(사용자 자산)이며,
  **플러그인 제거가 절대 삭제하지 않는다** (정본 규칙 3 — 저장 3분할).
- 판정하지 않는다. 저장한 예측에는 확인일이 오면 실제 결과만 기록한다 (`AI VERDICT: NONE`).

## 각주 (사람이 나중에 고칠 때)

- `statusline/index.js`는 `argus-plugin-v2/statusline/index.js`의 **바이트 동일
  사본**이다 — 정본은 argus-plugin-v2 쪽이고, 드리프트는 CI가 막는다
  (`argus-mcp/src/v2/driver-plugin.test.ts`). 수정은 정본에서 하고 여기로 복사.
- `argus-decision-mcp`는 npm에 출시되어 있어(2026-07-03 v1.0.0~) npx 배선이
  바로 작동한다. 단 리포의 최신 시공분(v2 내구 원장 포함)은 npm 재출시 전까지
  설치본에 반영되지 않는다 — 재출시는 `argus-mcp/`에서 `npm publish`.
- 마켓플레이스 항목은 리포 루트 `.claude-plugin/marketplace.json`에 있다.
