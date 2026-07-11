# Argus Driver — thin Claude Code plugin for `argus-decision-mcp`

설치 2줄 (Claude Code 안에서):

```
/plugin marketplace add commet/Argus
/plugin install argus-driver@argus
```

설치가 하는 일 전부:

1. **MCP 자동 배선** — 번들된 [`.mcp.json`](./.mcp.json)이 `argus-decision-mcp`
   stdio 서버를 등록한다 (`npx -y argus-decision-mcp`). 별도 설정 없음.
   `argus_harvest` / `argus_seal` / `argus_settle` / `argus_check_in` 등이
   바로 쓸 수 있게 된다.
2. **statusline 동봉 (선택)** — [`statusline/index.js`](./statusline/index.js)는
   내구 v2 원장(`~/.argus/projects/{repository_id}/`)과 레거시 워크트리 원장을
   모두 읽는 zero-dependency 스크립트다. 켜려면 `~/.claude/settings.json`에 1줄:

   ```json
   "statusLine": { "type": "command", "command": "node ${CLAUDE_PLUGIN_ROOT}/statusline/index.js" }
   ```

## 이 플러그인이 하지 않는 일

- 원장을 만들거나 지우지 않는다. 결정 기록의 정본은 `~/.argus`(사용자 자산)이며,
  **플러그인 제거가 절대 삭제하지 않는다** (정본 규칙 3 — 저장 3분할).
- 판정하지 않는다. 봉인한 예측은 정산일의 현실만이 채점한다 (`AI VERDICT: NONE`).

## 각주 (사람이 나중에 고칠 때)

- `statusline/index.js`는 `argus-plugin-v2/statusline/index.js`의 **바이트 동일
  사본**이다 — 정본은 argus-plugin-v2 쪽이고, 드리프트는 CI가 막는다
  (`argus-mcp/src/v2/driver-plugin.test.ts`). 수정은 정본에서 하고 여기로 복사.
- `argus-decision-mcp`는 npm에 출시되어 있어(2026-07-03 v1.0.0~) npx 배선이
  바로 작동한다. 단 리포의 최신 시공분(v2 내구 원장 포함)은 npm 재출시 전까지
  설치본에 반영되지 않는다 — 재출시는 `argus-mcp/`에서 `npm publish`.
- 마켓플레이스 항목은 리포 루트 `.claude-plugin/marketplace.json`에 있다.
