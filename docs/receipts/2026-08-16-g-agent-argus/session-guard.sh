#!/usr/bin/env bash
# 판별 실험 G — 세션 시작 시 하중 가정 검사 (브리프 §4 G의 "훅이 귀환을 강제한다")
#
# SessionStart 훅으로 붙이면 이 스크립트의 stdout이 세션 문맥에 들어간다.
# 세션을 죽이지 않는 이유: 죽이면 사람이 훅을 끈다. 시끄럽되 치명적이지 않게,
# 위반을 문맥 맨 앞에 놓아 에이전트가 못 본 척할 수 없게 만든다.
#
# 설치 (.claude/settings.json):
#   "hooks": { "SessionStart": [ { "hooks": [
#      { "type": "command",
#        "command": "bash docs/receipts/2026-08-16-g-agent-argus/session-guard.sh" } ] } ] }
set -uo pipefail
cd "$(dirname "$0")/../../.." || exit 0

LEDGER="docs/receipts/2026-08-16-g-agent-argus/ledger/session-guard.jsonl"
[ -f "$LEDGER" ] || exit 0
command -v node >/dev/null 2>&1 || exit 0

OUT=$(node docs/receipts/2026-08-16-g-agent-argus/argus-agent.mjs check "$LEDGER" 2>&1)
CODE=$?

if [ $CODE -eq 1 ]; then
  echo "════════════════════════════════════════════════════════════"
  echo "  하중 가정 위반 — 진행 전에 이것부터 처리한다"
  echo "════════════════════════════════════════════════════════════"
  echo "$OUT" | sed -n '/^위반/,/^$/p'
  echo "전체: node docs/receipts/2026-08-16-g-agent-argus/argus-agent.mjs check $LEDGER"
  echo "════════════════════════════════════════════════════════════"
fi
exit 0
