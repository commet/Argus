---
name: block-claude-process-kill
enabled: true
event: all
action: block
conditions:
  - field: command
    operator: regex_match
    pattern: (?i)(stop-process[^\n|]*claude|get-process[^\n]*claude[^\n]*(stop-process|kill)|taskkill[^\n]*claude|pkill[^\n]*claude|killall[^\n]*claude)
---

🚫 **claude 프로세스 킬 명령은 영구 차단입니다 (2026-07-27 터미널 사고 재발 방지).**

이름 기반 프로세스 종료(`Stop-Process -Name claude`, `taskkill /IM claude*`, `pkill claude`)는:

1. **모든 Claude Code 세션을 동시에 죽입니다** — 다른 워크트리에서 일하던 세션 전부 포함. 실제로 2026-07-27 이 명령 하나가 창업자의 모든 세션을 날렸습니다.
2. **터미널을 오염시킵니다** — 강제 종료된 CLI는 마우스 추적 모드를 복원하지 못하고 죽어서, 이후 그 터미널에 `[555;1;25M` 같은 이스케이프 시퀀스가 쏟아집니다.

**대안:**
- 특정 세션 재시작이 필요하면 → 사용자에게 해당 창에서 직접 재시작을 요청
- 자신이 `run_in_background`로 직접 띄운 프로세스라면 → 그 **PID만** 종료 (`Stop-Process -Id <pid>`)
- 실기기 검증은 관찰-우선 — 기존 세션 창에 입력을 보내거나 프로세스를 건드리지 않는다
