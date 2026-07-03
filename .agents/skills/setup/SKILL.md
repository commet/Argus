---
name: argus-setup
description: "Set up Argus — validate installation, detect platform, verify all skills and agents are in place. Use when first installing Argus, after updates, or when something isn't working."
allowed-tools: Read, Write, Bash, Glob, AskUserQuestion
---

## When to use

- ✓ First time installing Argus
- ✓ After updating Argus to a new version
- ✓ When a skill isn't being recognized
- ✓ When you want to verify everything is properly installed
- ✗ When you want to change settings (use /argus:configure)
- ✗ When diagnosing a specific issue (use /argus:doctor)

**Always respond in the same language the user uses.**

**No box drawing.** Do NOT use `╭╮╰╯`, `┌│└`, `═══╪`, `───┼`, `━━━`, or any Unicode box characters. Use `---`, `**bold**`, and whitespace for structure.

## Setup Flow

### Step 0: Detect environment

Detect the user's platform and shell:

```
Platform: [win32 / darwin / linux]
Shell: [bash / zsh / powershell / cmd]
Codex version: [from conversation context]
```

### Step 1: Check for ghost installations

Look for Argus files in multiple possible locations:

1. `~/.Codex/skills/` — standard install location
2. `~/.Codex/agents/` — agent location
3. Current project's `.Codex/skills/` — project-level install
4. Check if multiple copies exist (ghost installs)

If ghost installations found:

> ⚠ Found Argus installed in multiple locations:
> - ~/.Codex/skills/ (global)
> - ./.Codex/skills/ (project)
>
> This can cause conflicts. Want me to clean up and keep only [recommended location]?

### Step 2: Verify core skills

Check each required skill file exists and is readable:

**Argus · Setup**

Checking installation...

**Skills:**
- ✓ /reframe — `~/.Codex/skills/reframe/SKILL.md`
- ✓ /recast — `~/.Codex/skills/recast/SKILL.md`
- ✓ /rehearse — `~/.Codex/skills/rehearse/SKILL.md`
- ✓ /refine — `~/.Codex/skills/refine/SKILL.md`
- ✓ /argus — `~/.Codex/skills/argus/SKILL.md`
- ✓ /argus-help — `~/.Codex/skills/help/SKILL.md`
- ✓ /argus:setup — `~/.Codex/skills/setup/SKILL.md`
- ✓ /argus:doctor — `~/.Codex/skills/doctor/SKILL.md`
- ✓ /argus:configure — `~/.Codex/skills/configure/SKILL.md`
- ✓ /argus:patterns — `~/.Codex/skills/patterns/SKILL.md`

**Agents:**
- ✓ devils-advocate — `~/.Codex/agents/devils-advocate.md`

**Data:**
- [✓/✗] .argus/ directory
- [✓/✗] .argus/journal.md

Use `✓` for found, `✗` for missing, `⚠` for found but possibly outdated.

### Step 3: Create data directory

If `.argus/` doesn't exist in the project root, create it:

```bash
mkdir -p .argus
```

### Step 4: Verify write permissions

Test that the journal and output files can be written:

```bash
touch .argus/.setup-test && rm .argus/.setup-test
```

If this fails, report the permission issue.

### Step 5: Install missing components

If any skills or agents are missing, offer to install them:

> Missing components found. Install now?
> - [list of missing items]

For installation, use the same method as `install.sh`:
1. Clone the repo to a temp directory
2. Copy missing skills to `~/.Codex/skills/`
3. Copy missing agents to `~/.Codex/agents/`
4. Clean up temp directory

### Step 6: Version check

Read the installed `plugin.json` version and compare with the repo version. If outdated:

> ⚠ Argus v0.2.0 installed, v0.3.0 available.
> Run /argus:setup again after updating to get the latest skills.

### Step 7: Summary

**✓ Argus · Ready**

10 skills · 1 agent · journal ready

**Quick start:**
- `/reframe "your problem"` — sharpen your question
- `/argus "your problem"` — full pipeline
- `/argus:configure` — set preferences
- `/argus-help` — all commands

> Restart Codex if this is a fresh install.

## Error Recovery

If any step fails, don't stop — continue checking and collect all issues. Present a summary at the end:

```
  Setup completed with warnings:

  ✓ 8/10 skills installed
  ✗ Missing: /argus:configure, /argus:patterns
  ✗ Cannot write to .argus/ — check permissions

  Run /argus:doctor for detailed diagnostics.
```
