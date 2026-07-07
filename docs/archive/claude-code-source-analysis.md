# Claude Code Source Analysis: Plugin/Skill System Patterns

**Date**: 2026-04-01  
**Source**: https://github.com/anthropics/claude-code (anthropics/claude-code)  
**Purpose**: Extract architecture patterns applicable to Argus's skill/plugin system

---

## 1. Repository Overview

The `anthropics/claude-code` repository is primarily a distribution/installer repo (Shell 47%, Python 29%, TypeScript 18%). The core runtime is not open-source, but the **plugin system** is fully documented and contains 13 official plugins that reveal the complete architecture.

**Key directories:**
- `plugins/` — 13 official plugins (code-review, feature-dev, plugin-dev, hookify, etc.)
- `.claude/commands/` — 3 project-level slash commands
- `examples/hooks/` — Hook implementation examples
- `examples/settings/` — Permission/security configuration examples

---

## 2. Plugin Architecture — The "Everything is Markdown" Pattern

### 2.1 Plugin Structure (Auto-Discovery)

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # Manifest (only "name" required)
├── commands/                 # Slash commands (.md files)
├── agents/                   # Subagent definitions (.md files)
├── skills/                   # Agent skills (subdirectories)
│   └── skill-name/
│       ├── SKILL.md          # Required entry point
│       ├── references/       # Loaded on-demand
│       ├── examples/         # Working code samples
│       └── scripts/          # Utility scripts
├── hooks/
│   └── hooks.json            # Event handler configuration
├── .mcp.json                 # External tool integration
└── scripts/                  # Shared utilities
```

**Key insight**: Claude Code uses **convention-over-configuration**. Drop a `.md` file in `commands/` and it becomes a slash command. Drop one in `agents/` and it becomes a subagent. No registry, no build step.

### 2.2 Plugin Manifest (Minimal)

```json
{
  "name": "code-review",
  "description": "Automated code review...",
  "version": "1.0.0",
  "author": { "name": "Boris Cherny", "email": "boris@anthropic.com" }
}
```

Only `name` is required. Everything else is optional metadata.

---

## 3. Command System — Markdown as Executable Instructions

### 3.1 Command Format

Commands are markdown files with YAML frontmatter:

```markdown
---
allowed-tools: Bash(git checkout --branch:*), Bash(git add:*), Bash(git status:*)
description: Commit, push, and open a PR
argument-hint: [branch-name]
model: sonnet
---

## Context

- Current git status: !`git status`
- Current git diff: !`git diff HEAD`
- Current branch: !`git branch --show-current`

## Your task

Based on the above changes:
1. Create a new branch if on main
2. Create a single commit with an appropriate message
3. Push the branch to origin
4. Create a pull request using `gh pr create`
```

### 3.2 Dynamic Features in Commands

| Feature | Syntax | Purpose |
|---------|--------|---------|
| Arguments | `$ARGUMENTS`, `$1`, `$2` | User input injection |
| File refs | `@path/to/file` | Include file contents |
| Bash exec | `` !`command` `` | Gather dynamic context before LLM processes |
| Plugin root | `${CLAUDE_PLUGIN_ROOT}` | Portable path resolution |

### 3.3 Frontmatter Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `description` | Shown in `/help` | `"Review code for issues"` |
| `allowed-tools` | Restrict tool access | `Read, Bash(git:*)` |
| `model` | Specify model | `sonnet`, `opus`, `haiku` |
| `argument-hint` | Document args | `[pr-number] [priority]` |
| `disable-model-invocation` | Manual-only | `true` |

**Applicability to Argus**: This pattern maps directly to our skill system. Each Argus skill could be a `.md` file with frontmatter defining metadata and the body containing the LLM instructions.

---

## 4. Agent System — Subagent Definitions as Markdown

### 4.1 Agent Format

```markdown
---
name: code-explorer
description: Deeply analyzes existing codebase features by tracing execution paths...
tools: Glob, Grep, LS, Read, NotebookRead, WebFetch, TodoWrite, WebSearch
model: sonnet
color: yellow
---

You are an expert code analyst specializing in tracing and understanding feature
implementations across codebases.

## Core Mission
[Detailed instructions...]

## Analysis Approach
[Step-by-step methodology...]

## Output Guidance
[Formatting requirements...]
```

### 4.2 Agent Frontmatter Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `name` | Identifier (kebab-case) | `code-explorer` |
| `description` | Trigger phrases + purpose | `"Deeply analyzes..."` |
| `tools` | Allowed tool list | `Glob, Grep, Read` |
| `model` | LLM model | `sonnet`, `haiku`, `inherit` |
| `color` | Terminal display color | `yellow`, `green`, `red` |

### 4.3 Agent Orchestration Pattern (feature-dev)

The `feature-dev` plugin demonstrates **multi-agent workflow orchestration**:

```
Phase 1 (Discovery)    → Human dialogue
Phase 2 (Exploration)  → Parallel code-explorer agents
Phase 3 (Questions)    → Consolidated questions to user
Phase 4 (Architecture) → code-architect agents, user selects approach
Phase 5 (Implementation) → Code generation after explicit approval
Phase 6 (Review)       → Parallel code-reviewer agents
Phase 7 (Summary)      → Documentation of outcomes
```

**Key patterns:**
- **Parallel agent dispatch**: Multiple agents run simultaneously in review phases
- **Human-in-the-loop gates**: Phases 3 and 4 require explicit user approval
- **Progressive disclosure**: Each phase builds on previous output
- **Confidence scoring**: code-reviewer uses 0-100 confidence, only reports >= 80

**Applicability to Argus**: This maps directly to our Recast → Persona Feedback → Refinement pipeline. Each step could be an agent with explicit handoff points.

---

## 5. Skill System — Progressive Disclosure Architecture

### 5.1 Three-Level Loading

This is the most important architectural pattern for context management:

| Level | What loads | When | Size |
|-------|-----------|------|------|
| **L1: Metadata** | name + description from YAML frontmatter | Always in context | ~100 words |
| **L2: SKILL.md body** | Core instructions | When skill triggers | 1,500-2,000 words |
| **L3: Bundled resources** | references/, scripts/, examples/ | On-demand by agent | Unlimited |

### 5.2 SKILL.md Format

```markdown
---
name: Hook Development
description: This skill should be used when the user asks to "create a hook",
  "add a PreToolUse hook", "validate tool use", or mentions hook events.
version: 0.1.0
---

# Hook Development for Claude Code Plugins

## Overview
[Core concepts — always loaded when triggered]

## Key Patterns
[Essential procedures]

## Quick Reference
[Tables, checklists]

## Additional Resources

### Reference Files
- **`references/patterns.md`** — Common patterns
- **`references/advanced.md`** — Advanced techniques

### Scripts
- **`scripts/validate-hook-schema.sh`** — Validate hooks.json
```

### 5.3 Trigger Mechanism

Skills trigger based on **description matching** against user queries. The description must contain specific trigger phrases:

```yaml
# GOOD — specific triggers
description: This skill should be used when the user asks to "create a hook",
  "add a PreToolUse hook", "validate tool use", "implement prompt-based hooks"

# BAD — vague
description: Provides hook guidance.
```

### 5.4 Resource Organization

```
skill-name/
├── SKILL.md           # Core (1,500-2,000 words, imperative form)
├── references/        # Detailed docs (loaded when Claude needs them)
│   ├── patterns.md    # 2,000-5,000+ words each
│   └── advanced.md
├── examples/          # Working code (copyable)
│   └── working-example.sh
└── scripts/           # Utilities (executable, may not need context loading)
    └── validate.sh
```

**Applicability to Argus**: This progressive disclosure pattern solves our context window management problem. Argus skills should use the same 3-level loading:
- L1: Always show skill name + description in system prompt
- L2: Load full skill instructions only when activated
- L3: Load reference files only when the skill explicitly calls for them

---

## 6. Hook System — Event-Driven Lifecycle

### 6.1 Hook Events

| Event | When | Use For |
|-------|------|---------|
| **PreToolUse** | Before any tool runs | Validation, modification, blocking |
| **PostToolUse** | After tool completes | Feedback, logging |
| **UserPromptSubmit** | User sends prompt | Context injection, validation |
| **Stop** | Agent considers stopping | Completeness verification |
| **SubagentStop** | Subagent finishing | Task validation |
| **SessionStart** | Session begins | Context loading, env setup |
| **SessionEnd** | Session ends | Cleanup, logging |
| **PreCompact** | Before context compaction | Preserve critical info |
| **Notification** | User notification | Reactions |

### 6.2 Hook Types

**Prompt-based hooks** (recommended) — use LLM for context-aware decisions:
```json
{
  "type": "prompt",
  "prompt": "Evaluate if this tool use is appropriate: $TOOL_INPUT"
}
```

**Command hooks** — execute scripts for deterministic checks:
```json
{
  "type": "command",
  "command": "python3 ${CLAUDE_PLUGIN_ROOT}/hooks/security_reminder_hook.py"
}
```

### 6.3 Hook Output Contract

```json
{
  "continue": true,
  "suppressOutput": false,
  "systemMessage": "Message injected into Claude's context",
  "hookSpecificOutput": {
    "permissionDecision": "allow|deny|ask",
    "updatedInput": {"field": "modified_value"}
  }
}
```

**Exit codes:**
- `0` — Success (stdout shown in transcript)
- `2` — Blocking error (stderr fed to Claude)
- Other — Non-blocking error

### 6.4 Matchers

```json
"matcher": "Write|Edit"           // Exact match (pipe-separated)
"matcher": "*"                    // Wildcard
"matcher": "mcp__.*__delete.*"    // Regex
```

### 6.5 Security Hook Example (security-guidance plugin)

The security hook monitors Write/Edit/MultiEdit operations for dangerous patterns:
- GitHub Actions command injection
- `child_process.exec()` usage
- `eval()` / `new Function()` dynamic code
- `dangerouslySetInnerHTML` XSS vectors
- `pickle` unsafe deserialization
- `os.system()` command injection

Uses session-scoped deduplication (JSON files in `~/.claude/`) to avoid warning fatigue.

**Applicability to Argus**: This hook system maps to our quality signals and refinement triggers. We could implement:
- `PreAnalysis` hooks for input validation
- `PostPersonaFeedback` hooks for quality scoring
- `PreOutput` hooks for formatting consistency

---

## 7. Permission & Security Model

### 7.1 Tool Restriction in Commands

Commands restrict tool access via `allowed-tools` frontmatter:
```yaml
allowed-tools: Bash(git checkout --branch:*), Bash(git add:*), Bash(git status:*)
```

Pattern matching supports wildcards: `Bash(git:*)` allows all git subcommands.

### 7.2 Settings Hierarchy

Three strictness levels observed:

**Lax**: Disables permission bypass, blocks plugin marketplaces
**Strict**: Above + blocks user-defined permissions/hooks, denies web tools, requires bash approval
**Sandbox**: Bash must run inside sandbox with network restrictions

### 7.3 Agent Tool Scoping

Agents declare their required tools, creating least-privilege boundaries:
```yaml
tools: Glob, Grep, LS, Read, NotebookRead  # Read-only explorer
tools: ["Write", "Read"]                     # Creator with limited scope
```

---

## 8. Context Management Patterns

### 8.1 Dynamic Context Injection in Commands

Commands use inline bash execution to gather context before the LLM processes:
```markdown
## Context
- Current git status: !`git status`
- Current git diff: !`git diff HEAD`
- Current branch: !`git branch --show-current`
```

This pattern evaluates at invocation time, not definition time.

### 8.2 SessionStart Context Loading

Plugins inject persistent context via SessionStart hooks:
```bash
#!/bin/bash
# Persist environment variables for the session
echo "export PROJECT_TYPE=nodejs" >> "$CLAUDE_ENV_FILE"
```

The `explanatory-output-style` plugin uses this to inject output formatting instructions into every session — essentially a "style override" pattern.

### 8.3 PreCompact Hook — Context Preservation

Before the context window is compacted, hooks can inject critical information that must survive:
```json
{
  "PreCompact": [{
    "matcher": "*",
    "hooks": [{
      "type": "prompt",
      "prompt": "Preserve: current task status, key decisions, pending items"
    }]
  }]
}
```

**Applicability to Argus**: This is directly relevant to our context chain (decompose → recast → persona-feedback → refinement). We need a similar mechanism to ensure critical analysis results survive context compaction.

---

## 9. Skill Chaining Patterns

### 9.1 Command → Agent → Skill Chain

The `feature-dev` plugin demonstrates the full chain:

1. **Command** (`/feature-dev`) — entry point, gathers initial context
2. **Agents** — dispatched in parallel for exploration/review
3. **Skills** — loaded on-demand when agents need specialized knowledge
4. **Hooks** — validate quality at each transition

### 9.2 Cross-Component Data Flow

- Commands pass data via **file references** (`@file`) and **bash context** (`` !`cmd` ``)
- Agents produce **structured output** (file paths, analysis, recommendations)
- The orchestrating command reads agent output and routes to next phase
- Skills provide **knowledge injection** — they don't produce persistent data

### 9.3 The Ralph Loop Pattern (Iterative Self-Correction)

The `ralph-wiggum` plugin implements an autonomous iteration loop:

1. User provides task + completion criteria + max iterations
2. Stop hook intercepts exit attempts and re-feeds the prompt
3. Previous work persists in files and git history
4. Loop breaks only when completion promise is truly satisfied

**Key constraint**: "The completion promise may ONLY be output when the statement is completely and unequivocally TRUE"

**Applicability to Argus**: This maps to our refinement loop. The persona feedback → revision cycle could use a similar stop-hook pattern where the loop continues until quality criteria are met.

---

## 10. Output Formatting Patterns

### 10.1 Output Style as SessionStart Hook

The `explanatory-output-style` plugin injects formatting instructions at session start:
```
★ Insight ─────────────────────────────────────
[2-3 key educational points]
─────────────────────────────────────────────────
```

**Important distinction from docs**: "Output styles that involve tasks besides software development are better expressed as subagents, not as SessionStart hooks. Subagents change the system prompt while SessionStart hooks add to the default system prompt."

### 10.2 Confidence-Based Filtering

The `code-review` plugin uses confidence scoring to filter output quality:
- 0-25: False positive / not confident
- 50: Moderate, might be nitpick
- 75: High confidence, double-checked
- 100: Absolute certainty

**Only report >= 80 confidence.** This prevents noise in output.

### 10.3 Agent Output Structure

Agents follow structured output patterns:
```
## Agent: code-reviewer
### Configuration
- Confidence threshold: >= 80
- Scope: unstaged changes

### Issues Found
[Grouped by severity: Critical → Important]

### Summary
[Brief confirmation or issue count]
```

---

## 11. Key Patterns Summary for Argus Plugin System

### Pattern 1: Markdown-as-Code
Everything is a `.md` file. Commands, agents, skills — all markdown with YAML frontmatter. No compilation, no registry. Drop file → auto-discovered.

### Pattern 2: Progressive Disclosure (3 Levels)
L1 metadata (always loaded) → L2 instructions (on trigger) → L3 resources (on demand). This is the key to managing context window budgets.

### Pattern 3: Convention-over-Configuration
`commands/` dir → slash commands. `agents/` dir → subagents. `skills/*/SKILL.md` → skills. No explicit registration needed.

### Pattern 4: Event-Driven Hooks
9 lifecycle events (PreToolUse, PostToolUse, Stop, SessionStart, etc.) with prompt-based or command-based handlers. Matchers use glob/regex patterns.

### Pattern 5: Parallel Agent Dispatch
Multiple agents run simultaneously for independent analysis tasks. Results are consolidated by the orchestrating command.

### Pattern 6: Human-in-the-Loop Gates
Multi-phase workflows have explicit pause points where human approval is required before proceeding.

### Pattern 7: Confidence-Based Output Filtering
Quality gate: only surface results above a confidence threshold. Prevents noise.

### Pattern 8: Portable Path Resolution
`${CLAUDE_PLUGIN_ROOT}` environment variable ensures plugins work regardless of installation location.

### Pattern 9: Tool Scoping (Least Privilege)
Each component declares its required tools. Commands use `allowed-tools`, agents use `tools` list. No component gets full access unless explicitly needed.

### Pattern 10: Iterative Self-Correction Loop
Stop hook intercepts completion → re-feeds prompt → loop continues until criteria met. Previous state persists in files.

---

## 12. Recommended Application to Argus

### Immediate Applicability

1. **Skill files as markdown**: Each Argus skill (reframe, recast, rehearse, refine) could be a SKILL.md with the same 3-level progressive disclosure
2. **Command frontmatter**: Adopt the YAML frontmatter pattern for skill metadata, tool permissions, and model selection
3. **Agent orchestration**: The feature-dev 7-phase pattern maps to our decompose → recast → persona → refinement pipeline
4. **Confidence scoring**: Apply to persona feedback quality — only surface insights above threshold
5. **Hook-based quality gates**: Implement PreOutput hooks for formatting consistency

### Architecture Decisions

| Claude Code Pattern | Argus Application |
|---------------------|---------------------|
| `commands/*.md` auto-discovery | `skills/*.md` auto-discovery in Argus |
| YAML frontmatter + markdown body | Same for Argus skill definitions |
| `${CLAUDE_PLUGIN_ROOT}` | `${ARGUS_SKILL_ROOT}` for portable paths |
| 3-level progressive disclosure | L1: skill list, L2: skill body, L3: references |
| Hook lifecycle events | Analysis lifecycle: PreAnalysis, PostPersona, PreOutput |
| Parallel agent dispatch | Parallel persona simulation |
| Stop hook loop | Refinement loop with quality threshold |
| Confidence filtering | DQ score threshold for output quality |
| `allowed-tools` scoping | Restrict each skill to its required store/API access |

### Gaps to Fill

Claude Code patterns that Argus needs but must build differently:

1. **State persistence between skills**: Claude Code uses files/git. Argus needs handoff store or context chain.
2. **User pattern learning**: Claude Code has no adaptive learning. Argus needs signal-recorder integration.
3. **Non-code output**: Claude Code optimizes for code. Argus must handle strategic analysis, presentation decks, etc.
4. **Quality measurement**: Claude Code uses binary pass/fail confidence. Argus needs multi-dimensional DQ scoring.
