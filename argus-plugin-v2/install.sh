#!/bin/bash
# Argus plugin-v2 installer — installs skills, agents, data, and statusline.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/commet/Argus/main/argus-plugin-v2/install.sh | bash
#
# Developer mode (symlinks — edit once, reflected everywhere):
#   cd /path/to/Argus && ./argus-plugin-v2/install.sh --link

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
    echo "  Install Claude Code first: https://claude.com/claude-code"
    exit 1
  fi
fi

echo ""
echo -e "${BOLD}  Argus v2${NC} — judgment harness for AI. Decide inside your codebase."
echo ""

# ── Determine source ──
if [ "$LINK_MODE" = true ]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  SOURCE_DIR="$SCRIPT_DIR"

  if [ ! -f "$SOURCE_DIR/skills/sail/SKILL.md" ]; then
    fail "Run from repo root: ./argus-plugin-v2/install.sh --link"
    exit 1
  fi

  info "Developer mode — creating symlinks to local repo"
else
  TEMP_DIR=$(mktemp -d)
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

# ── Install skills ──
mkdir -p "$CLAUDE_DIR/skills" "$CLAUDE_DIR/agents"

SKILL_COUNT=0
for skill_dir in "$SOURCE_DIR/skills/"*/; do
  skill_name=$(basename "$skill_dir")
  rm -rf "$CLAUDE_DIR/skills/$skill_name"

  if [ "$LINK_MODE" = true ]; then
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

# ── Install data (read-only reference) ──
# Skills reference data via relative paths within the plugin directory, but
# when installed to ~/.claude, the data/ lives alongside skills/ for relative resolution.
if [ -d "$SOURCE_DIR/data" ]; then
  if [ "$LINK_MODE" = true ]; then
    ln -sfn "$SOURCE_DIR/data" "$CLAUDE_DIR/argus-data"
  else
    rm -rf "$CLAUDE_DIR/argus-data"
    cp -r "$SOURCE_DIR/data" "$CLAUDE_DIR/argus-data"
  fi
  ok "Data (agents, boss-types, schemas) installed to ~/.claude/argus-data"
fi

# ── Install lib (session docs) ──
if [ -d "$SOURCE_DIR/lib" ]; then
  if [ "$LINK_MODE" = true ]; then
    ln -sfn "$SOURCE_DIR/lib" "$CLAUDE_DIR/argus-lib"
  else
    rm -rf "$CLAUDE_DIR/argus-lib"
    cp -r "$SOURCE_DIR/lib" "$CLAUDE_DIR/argus-lib"
  fi
  ok "Lib (session layout, version numbering) installed"
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

# ── Create data directory in cwd ──
mkdir -p .argus
ok "Data directory ready (.argus/)"

# ── Cleanup (user mode only) ──
if [ "$LINK_MODE" = false ] && [ -n "$TEMP_DIR" ]; then
  rm -rf "$TEMP_DIR"
fi

# ── Verify ──
ERRORS=0
for required in sail clarify team boss chart; do
  if [ ! -f "$CLAUDE_DIR/skills/$required/SKILL.md" ] && [ ! -L "$CLAUDE_DIR/skills/$required" ]; then
    fail "Missing: $required"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""

if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}${BOLD}  Installed successfully (v2.0.0)${NC}"
  if [ "$LINK_MODE" = true ]; then
    echo -e "  ${DIM}Mode: symlink — file edits reflect on next Claude Code restart (skill bodies cache at session start)${NC}"
  fi
  echo ""
  echo -e "  ${BOLD}Restart Claude Code${NC}, then try:"
  echo ""
  echo -e "    ${BOLD}/argus:sail${NC} \"A technical decision I'm stuck on\""
  echo -e "    ${BOLD}/argus:sail${NC} @PR#123     ${DIM}# Work through a specific PR${NC}"
  echo -e "    ${BOLD}/argus:sail${NC} @src/auth.ts  ${DIM}# Think about a file${NC}"
  echo ""
  echo -e "  ${DIM}First run auto-creates .argus/config.yaml (ISTJ default boss). No setup dialog.${NC}"
  echo -e "  ${DIM}Each session writes to .argus/sessions/ in your repo. Commit it to share with team.${NC}"
  if [ "$LINK_MODE" = true ]; then
    echo ""
    echo -e "  ${YELLOW}Dev note:${NC} ${DIM}If you edit skill .md files mid-session, restart Claude Code to apply.${NC}"
    echo -e "  ${DIM}Symlinks update files instantly, but Claude caches skill bodies on session start.${NC}"
  fi
else
  fail "Installation incomplete."
fi

echo ""
