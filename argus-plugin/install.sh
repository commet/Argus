#!/bin/bash
# Argus installer — installs skills, agents, and statusline to Claude Code
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/commet/Argus/main/argus-plugin/install.sh | bash
#
# Developer mode (symlinks — edit once, reflected everywhere):
#   cd /path/to/Argus && ./argus-plugin/install.sh --link

set -e

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
DIM='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m'

info()  { echo -e "${DIM}  $1${NC}"; }
ok()    { echo -e "${GREEN}  ✓${NC} $1"; }
warn()  { echo -e "${YELLOW}  !${NC} $1"; }
fail()  { echo -e "${RED}  ✗${NC} $1"; }

# ── Mode detection ──
LINK_MODE=false
if [ "$1" = "--link" ] || [ "$1" = "--dev" ]; then
  LINK_MODE=true
fi

# ── Platform detection ──
CLAUDE_DIR="$HOME/.claude"
if [ ! -d "$CLAUDE_DIR" ]; then
  if [ -d "$USERPROFILE/.claude" ]; then
    CLAUDE_DIR="$USERPROFILE/.claude"
  else
    fail "Claude Code directory not found."
    echo "  Install Claude Code first: https://claude.ai/code"
    exit 1
  fi
fi

echo ""
echo -e "${BOLD}  Argus${NC} — structured thinking for decisions and plans"
echo ""

# ── Determine source ──
if [ "$LINK_MODE" = true ]; then
  # Developer mode: use local repo
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  SOURCE_DIR="$SCRIPT_DIR"

  if [ ! -f "$SOURCE_DIR/skills/argus/SKILL.md" ]; then
    fail "Run from repo root: ./argus-plugin/install.sh --link"
    exit 1
  fi

  info "Developer mode — creating symlinks to local repo"
else
  # User mode: clone to temp
  TEMP_DIR=$(mktemp -d)
  REPO="https://github.com/commet/Argus.git"

  info "Downloading latest version..."
  if ! git clone --depth 1 --quiet "$REPO" "$TEMP_DIR" 2>/dev/null; then
    fail "Failed to download. Check your internet connection."
    rm -rf "$TEMP_DIR"
    exit 1
  fi

  SOURCE_DIR="$TEMP_DIR/argus-plugin"

  if [ ! -f "$SOURCE_DIR/skills/argus/SKILL.md" ]; then
    fail "Downloaded package is incomplete. Try again."
    rm -rf "$TEMP_DIR"
    exit 1
  fi
fi

# ── Install skills ──
mkdir -p "$CLAUDE_DIR/skills" "$CLAUDE_DIR/agents"

SKILL_COUNT=0
for skill_dir in "$SOURCE_DIR/skills/"*/; do
  skill_name=$(basename "$skill_dir")

  # Remove existing (copy or old symlink)
  rm -rf "$CLAUDE_DIR/skills/$skill_name"

  if [ "$LINK_MODE" = true ]; then
    # Use PowerShell junctions on Windows (works without admin), ln -sf on Unix
    if command -v powershell.exe &>/dev/null; then
      SKILL_WIN=$(cygpath -w "$skill_dir" 2>/dev/null || echo "$skill_dir")
      LINK_WIN=$(cygpath -w "$CLAUDE_DIR/skills/$skill_name" 2>/dev/null || echo "$CLAUDE_DIR/skills/$skill_name")
      powershell.exe -Command "New-Item -ItemType Junction -Path '$LINK_WIN' -Target '$SKILL_WIN'" >/dev/null 2>&1
    else
      ln -sfn "$skill_dir" "$CLAUDE_DIR/skills/$skill_name"
    fi
  else
    cp -r "$skill_dir" "$CLAUDE_DIR/skills/$skill_name"
  fi
  SKILL_COUNT=$((SKILL_COUNT + 1))
done

if [ "$LINK_MODE" = true ]; then
  ok "$SKILL_COUNT skills linked"
else
  ok "$SKILL_COUNT skills installed"
fi

# ── Install agents ──
AGENT_COUNT=0
for agent_file in "$SOURCE_DIR/agents/"*.md; do
  [ -f "$agent_file" ] || continue
  agent_name=$(basename "$agent_file")

  if [ "$LINK_MODE" = true ]; then
    ln -sf "$agent_file" "$CLAUDE_DIR/agents/$agent_name"
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

# ── Install output styles ──
if [ -d "$SOURCE_DIR/output-styles" ]; then
  mkdir -p "$CLAUDE_DIR/output-styles"
  for style_file in "$SOURCE_DIR/output-styles/"*.md; do
    [ -f "$style_file" ] || continue
    style_name=$(basename "$style_file")

    if [ "$LINK_MODE" = true ]; then
      ln -sf "$style_file" "$CLAUDE_DIR/output-styles/$style_name"
    else
      cp "$style_file" "$CLAUDE_DIR/output-styles/"
    fi
  done
  ok "Output styles installed"
fi

# ── Install statusline (optional) ──
if [ -f "$SOURCE_DIR/statusline/index.js" ]; then
  mkdir -p "$CLAUDE_DIR/statusline"
  if [ "$LINK_MODE" = true ]; then
    ln -sf "$SOURCE_DIR/statusline/index.js" "$CLAUDE_DIR/statusline/argus.js"
  else
    cp "$SOURCE_DIR/statusline/index.js" "$CLAUDE_DIR/statusline/argus.js"
  fi
  ok "Statusline installed"
fi

# ── Create data directory ──
mkdir -p .argus
ok "Data directory ready (.argus/)"

# ── Cleanup (user mode only) ──
if [ "$LINK_MODE" = false ] && [ -n "$TEMP_DIR" ]; then
  rm -rf "$TEMP_DIR"
fi

# ── Verify ──
ERRORS=0
for required in argus reframe recast rehearse refine; do
  if [ ! -f "$CLAUDE_DIR/skills/$required/SKILL.md" ] && [ ! -L "$CLAUDE_DIR/skills/$required" ]; then
    fail "Missing: $required"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}${BOLD}  Installed successfully (v0.4.0)${NC}"
  if [ "$LINK_MODE" = true ]; then
    echo -e "  ${DIM}Mode: symlink (edit argus-plugin/ → changes reflect immediately)${NC}"
  fi
  echo ""
  echo "  Restart Claude Code, then try:"
  echo ""
  echo -e "    ${BOLD}/argus${NC} \"기획안 써야 하는데 막막해\""
  echo ""
  echo -e "  ${DIM}30초 안에 초안이 나옵니다.${NC}"
  echo -e "  ${DIM}질문 2-3개에 답하면 바로 제출 가능한 문서가 완성됩니다.${NC}"
  echo ""
  echo -e "  ${DIM}더 알아보기: /argus:help${NC}"
else
  fail "Installation incomplete. Run /argus:doctor for diagnostics."
fi

echo ""
