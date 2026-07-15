#!/usr/bin/env bash
# Argus plugin-v2 installer. Installs skills, agents, data, lib, and statusline.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/commet/Argus/main/argus-plugin-v2/install.sh | bash
#
# Developer mode:
#   cd /path/to/Argus && ./argus-plugin-v2/install.sh --link

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
DIM='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m'

info() { echo -e "${DIM}  $1${NC}"; }
ok() { echo -e "${GREEN}  OK${NC} $1"; }
warn() { echo -e "${YELLOW}  !${NC} $1"; }
fail() { echo -e "${RED}  X${NC} $1"; }

LINK_MODE=false
if [ "${1:-}" = "--link" ] || [ "${1:-}" = "--dev" ]; then
  LINK_MODE=true
fi

CLAUDE_DIR="${HOME:-}/.claude"
if [ ! -d "$CLAUDE_DIR" ]; then
  if [ -n "${USERPROFILE:-}" ] && [ -d "$USERPROFILE/.claude" ]; then
    CLAUDE_DIR="$USERPROFILE/.claude"
  else
    fail "Claude Code directory not found."
    echo "  Install Claude Code first: https://claude.com/claude-code"
    exit 1
  fi
fi

echo ""
echo -e "${BOLD}  Argus v2.4${NC} - decision harness for Claude Code."
echo ""

TEMP_DIR=""
if [ "$LINK_MODE" = true ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  SOURCE_DIR="$SCRIPT_DIR"

  if [ ! -f "$SOURCE_DIR/skills/sail/SKILL.md" ]; then
    fail "Run from repo root: ./argus-plugin-v2/install.sh --link"
    exit 1
  fi

  info "Developer mode - linking to local repo"
else
  TEMP_DIR="$(mktemp -d)"
  REPO="https://github.com/commet/Argus.git"

  info "Downloading latest version..."
  if ! git clone --depth 1 --quiet "$REPO" "$TEMP_DIR" 2>/dev/null; then
    fail "Failed to download. Check your internet connection."
    rm -rf "$TEMP_DIR"
    exit 1
  fi

  SOURCE_DIR="$TEMP_DIR/argus-plugin-v2"
  if [ ! -f "$SOURCE_DIR/skills/sail/SKILL.md" ]; then
    fail "Downloaded package is incomplete. Try again."
    rm -rf "$TEMP_DIR"
    exit 1
  fi
fi

mkdir -p "$CLAUDE_DIR/skills" "$CLAUDE_DIR/agents"

link_dir_or_copy() {
  local source="$1"
  local target="$2"
  rm -rf "$target"

  if ln -sfn "$source" "$target" 2>/dev/null; then
    return 0
  fi

  if command -v powershell.exe >/dev/null 2>&1 && command -v cygpath >/dev/null 2>&1; then
    local source_win target_win
    source_win="$(cygpath -w "$source" 2>/dev/null || true)"
    target_win="$(cygpath -w "$target" 2>/dev/null || true)"
    if [ -n "$source_win" ] && [ -n "$target_win" ]; then
      if powershell.exe -NoProfile -Command "New-Item -ItemType Junction -Path '$target_win' -Target '$source_win' | Out-Null" >/dev/null 2>&1; then
        return 0
      fi
    fi
  fi

  warn "Could not create link for $target; copying instead."
  cp -r "$source" "$target"
}

link_file_or_copy() {
  local source="$1"
  local target="$2"
  rm -f "$target"

  if ln -sf "$source" "$target" 2>/dev/null; then
    return 0
  fi

  warn "Could not create link for $target; copying instead."
  cp "$source" "$target"
}

SKILL_COUNT=0
for skill_dir in "$SOURCE_DIR/skills/"*/; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"

  if [ "$LINK_MODE" = true ]; then
    link_dir_or_copy "$skill_dir" "$CLAUDE_DIR/skills/$skill_name"
  else
    rm -rf "$CLAUDE_DIR/skills/$skill_name"
    cp -r "$skill_dir" "$CLAUDE_DIR/skills/$skill_name"
  fi

  SKILL_COUNT=$((SKILL_COUNT + 1))
done

if [ "$LINK_MODE" = true ]; then
  ok "$SKILL_COUNT skills linked"
else
  ok "$SKILL_COUNT skills installed"
fi

AGENT_COUNT=0
for agent_file in "$SOURCE_DIR/agents/"*.md; do
  [ -f "$agent_file" ] || continue
  agent_name="$(basename "$agent_file")"

  if [ "$LINK_MODE" = true ]; then
    link_file_or_copy "$agent_file" "$CLAUDE_DIR/agents/$agent_name"
  else
    cp "$agent_file" "$CLAUDE_DIR/agents/"
  fi

  AGENT_COUNT=$((AGENT_COUNT + 1))
done

if [ "$LINK_MODE" = true ]; then
  ok "$AGENT_COUNT agents linked"
else
  ok "$AGENT_COUNT agents installed"
fi

if [ -d "$SOURCE_DIR/data" ]; then
  if [ "$LINK_MODE" = true ]; then
    link_dir_or_copy "$SOURCE_DIR/data" "$CLAUDE_DIR/argus-data"
  else
    rm -rf "$CLAUDE_DIR/argus-data"
    cp -r "$SOURCE_DIR/data" "$CLAUDE_DIR/argus-data"
  fi
  ok "Data installed to ~/.claude/argus-data"
fi

if [ -d "$SOURCE_DIR/lib" ]; then
  if [ "$LINK_MODE" = true ]; then
    link_dir_or_copy "$SOURCE_DIR/lib" "$CLAUDE_DIR/argus-lib"
  else
    rm -rf "$CLAUDE_DIR/argus-lib"
    cp -r "$SOURCE_DIR/lib" "$CLAUDE_DIR/argus-lib"
  fi
  ok "Lib installed to ~/.claude/argus-lib"
fi

if [ -f "$SOURCE_DIR/statusline/index.js" ]; then
  mkdir -p "$CLAUDE_DIR/statusline"
  if [ "$LINK_MODE" = true ]; then
    link_file_or_copy "$SOURCE_DIR/statusline/index.js" "$CLAUDE_DIR/statusline/argus.js"
  else
    cp "$SOURCE_DIR/statusline/index.js" "$CLAUDE_DIR/statusline/argus.js"
  fi
  if command -v node >/dev/null 2>&1; then
    warn "Statusline copied (optional). To enable it, add to ~/.claude/settings.json:"
    echo -e "      ${DIM}\"statusLine\": { \"type\": \"command\", \"command\": \"node ~/.claude/statusline/argus.js\" }${NC}"
  else
    warn "Statusline copied but Node.js was not found — it needs Node >= 16 to run. Skipping activation hint."
  fi
fi

# NOTE: do NOT create .argus/ here. It is project-scoped and is created in the
# user's repo on first /argus:sail (curl|bash runs from an arbitrary cwd, usually
# $HOME, so creating .argus/ here would just litter the home directory).

# The SessionStart contract-reminder hook (hooks/hooks.json + check-contracts.js)
# resolves its script via ${CLAUDE_PLUGIN_ROOT}, which only exists under a plugin
# install — a copy install cannot run it, so we don't copy it and say so instead.
warn "The overdue-contract session reminder ships with the PLUGIN install only."
info "Copy installs still get /resolve and /journal; only the automatic reminder is missing."

if [ "$LINK_MODE" = false ] && [ -n "$TEMP_DIR" ]; then
  rm -rf "$TEMP_DIR"
fi

ERRORS=0
for required in sail scan predict clarify team verify boss revise versions preapprove help resolve journal connect push pull sync; do
  if [ ! -f "$CLAUDE_DIR/skills/$required/SKILL.md" ]; then
    fail "Missing: $required"
    ERRORS=$((ERRORS + 1))
  fi
done

if [ ! -f "$CLAUDE_DIR/argus-data/schemas/verification-ledger.json" ]; then
  fail "Missing: verification-ledger.json"
  ERRORS=$((ERRORS + 1))
fi

if [ ! -f "$CLAUDE_DIR/argus-data/schemas/current-bearing.json" ]; then
  fail "Missing: current-bearing.json"
  ERRORS=$((ERRORS + 1))
fi

# L3.2 — agents.yaml post-install validation: present, readable, and shaped
# (reviewer assembly depends on it; a silent miss surfaces as a confusing /team run)
if [ ! -r "$CLAUDE_DIR/argus-data/agents.yaml" ]; then
  fail "Missing or unreadable: agents.yaml"
  ERRORS=$((ERRORS + 1))
elif ! grep -q "capabilities:" "$CLAUDE_DIR/argus-data/agents.yaml"; then
  fail "agents.yaml is present but malformed (no 'capabilities:' key)"
  ERRORS=$((ERRORS + 1))
fi

echo ""

if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}  Installed successfully (v2.6.0)${NC}"
  if [ "$LINK_MODE" = true ]; then
    echo -e "  ${DIM}Mode: linked to local repo. Restart Claude Code after editing skills.${NC}"
  fi
  echo ""
  warn "This copy-install exposes commands WITHOUT the argus: namespace."
  echo -e "  ${DIM}Flat-installed skills are invoked as ${NC}${BOLD}/sail${NC}${DIM}, ${NC}${BOLD}/team${NC}${DIM}, ${NC}${BOLD}/verify${NC}${DIM} … (no ${NC}${BOLD}/argus:${NC}${DIM} prefix), which can collide with your other skills.${NC}"
  echo -e "  ${DIM}For the documented ${NC}${BOLD}/argus:sail${NC}${DIM} experience, install as a plugin instead, inside Claude Code:${NC}"
  echo ""
  echo -e "    ${BOLD}/plugin marketplace add commet/Argus${NC}"
  echo -e "    ${BOLD}/plugin install argus@argus${NC}"
  echo ""
  echo -e "  ${BOLD}Restart Claude Code${NC}, then try (use ${BOLD}/argus:sail${NC} if plugin-installed, ${BOLD}/sail${NC} if copy-installed):"
  echo ""
  echo -e "    ${BOLD}/argus:sail${NC} \"A decision I'm stuck on\""
  echo ""
  echo -e "  ${DIM}Argus helps you make a decision, save the check for later, and come back to reality.${NC}"
  echo -e "  ${DIM}Webapp sync is optional: /argus:connect <token>, then /argus:sync.${NC}"
else
  fail "Installation incomplete."
  exit 1
fi
