---
description: Argus 설치·배선 자가진단 — 판단 기록, 바인딩, LOGBOOK 최신 상태, 잠금 상태를 읽기 전용으로 점검
allowed-tools: Bash(node:*)
---

다음을 실행하고 출력을 **그대로** 사용자에게 전달하라 (요약·재해석·평가 금지 —
진단은 스크립트가 결정론적으로 끝냈고, 각 줄에 수리 손잡이가 이미 적혀 있다):

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js"
```

출력 후, 스크립트가 원리상 볼 수 없는 **발사 사슬 두 가지**만 네가 직접 확인해
한 줄씩 덧붙여라 (이 둘은 호스트 세션 안에서만 보인다):

1. **MCP 연결**: 네 툴 목록에 `argus_predict`/`argus_capture`/`argus_resolve`가
   있는가? 없으면 — "⚠ Argus MCP 서버 미연결 — 감지가 도구를 잃었다. `/mcp`로
   연결 상태를 확인하라." 한 줄을 출력하라.
2. **픽커(원탭 확인) 지원**: 툴이 있으면 `argus_check_in`을 호출하고(읽기 전용)
   `data.picker`를 전달하라 — `one_tap`이면 "픽커 OK — AI 초안 예측은
   Keep/Reword/Skip 원탭으로 확인받는다", `text_fallback`이면 "⚠ 이 호스트는
   elicitation 미지원 — 확인은 대화 텍스트로 폴백된다(기능은 동작)".

그 외에는, ⚠ 줄이 있으면 그 줄에 적힌 공개 복구 도구(예: `argus_settings`,
`argus_check_in`)를 실행할지 사용자에게 물어라 — 대신 실행하지 말 것.
⚠가 없으면 "정상"이라고 덧붙이지 말고 출력만 전달하라 (스크립트가 이미 말했다).
