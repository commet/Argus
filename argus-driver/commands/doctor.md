---
description: Argus 설치·배선 자가진단 — 내구 원장, 바인딩, LOGBOOK 커서, 락 상태를 읽기 전용으로 점검
allowed-tools: Bash(node:*)
---

다음을 실행하고 출력을 **그대로** 사용자에게 전달하라 (요약·재해석·평가 금지 —
진단은 스크립트가 결정론적으로 끝냈고, 각 줄에 수리 손잡이가 이미 적혀 있다):

```
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.js"
```

출력 후, ⚠ 줄이 있으면 그 줄에 적힌 도구(예: `argus_settings` 재실행,
`argus_check_in`)를 실행할지 사용자에게 물어라 — 대신 실행하지 말 것.
⚠가 없으면 "정상"이라고 덧붙이지 말고 출력만 전달하라 (스크립트가 이미 말했다).
