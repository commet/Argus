---
description: 프롬프트 아래 상태줄(기한 지난 확인·오늘 마감·항로) 켜기·끄기·상태 확인
allowed-tools: Bash(node:*)
---

인자에 따라 아래 **한 줄만** 실행하고, 출력을 그대로 사용자에게 전달하라
(사용자 언어로 옮겨 말하는 것은 좋다 — 사실을 바꾸거나 평가를 얹지는 말 것).
판단은 스크립트가 결정론적으로 끝냈다.

| 인자 | 실행 |
|---|---|
| (없음) 또는 `status` | `node "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-wire.mjs" status` |
| `on` | `node "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-wire.mjs" on` |
| `on --replace` | `node "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-wire.mjs" on --replace` |
| `off` | `node "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-wire.mjs" off` |
| `off --force` | `node "${CLAUDE_PLUGIN_ROOT}/scripts/statusline-wire.mjs" off --force` |

이 명령이 하는 일은 사용자의 `~/.claude/settings.json`에 `statusLine` 키를 쓰는
것이다. 플러그인이 그 키를 대신 실을 수 없기 때문에 존재한다 — Claude Code가
플러그인 설정에서 받아주는 키는 `agent`와 `subagentStatusLine` 둘뿐이라, 상태줄
파일은 설치된 모든 사용자에게 내려가고도 아무에게서도 켜지지 않는다.

전달할 때의 규칙:

- **거부(exit 1)를 실패로 각색하지 마라.** 남의 상태줄을 덮지 않고 멈춘 것은
  설계된 동작이다. 출력이 `--replace`를 가리키면 그 선택지를 사용자에게 넘기고,
  대신 결정하지 마라 — 남이 쓰던 설정을 인수할지는 사용자의 판단이다.
- **`--replace` / `--force`를 사용자가 말하지 않았는데 붙이지 마라.**
- 켠 뒤에 아무 줄도 안 보인다고 해서 고장이 아니다. 상태줄은 **보여줄 것이
  있을 때만** 둘째 줄을 쓴다 (기한 지난 확인 → 오늘 마감 → 진행 중 세션 →
  7일 내 마감 → 최근 항로 → 침묵). 이 리포에 봉인된 확인이 없으면 침묵이 정답이다.
  그 사실을 그대로 말하고, 없는 데이터를 만들어 보여주려 하지 마라.
- 상태줄은 **다음 상호작용부터** 나타난다. 재시작을 요구하지 마라.
- 이 표면은 터미널 CLI 전용이다. Claude 데스크탑 앱은 `statusLine` 키를 무시하고,
  Codex는 정해진 항목 목록에서만 고르므로 외부 스크립트를 실행하지 않는다.
  사용자가 그 환경을 쓰고 있다면 그 사실을 한 줄로 말하라 — 되는 척하지 말 것.
