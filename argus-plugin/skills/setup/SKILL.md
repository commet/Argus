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
Claude Code version: [from conversation context]
```

### Step 1: Check for ghost installations

Look for Argus files in multiple possible locations:

1. `~/.claude/skills/` — standard install location (global)
2. `~/.claude/agents/` — agent location (global)
3. Current project's `.claude/skills/` — project-level install
4. Check if multiple copies exist (ghost installs)

If ghost installations found:

> ⚠ Found Argus installed in multiple locations:
> - ~/.claude/skills/ (global)
> - ./.claude/skills/ (project)
>
> This can cause conflicts. Want me to clean up and keep only [recommended location]?

### Step 2: Verify core skills

Check each required skill file exists and is readable:

**Argus · Setup**

Checking installation...

**Skills (10):**
- ✓ /reframe — `~/.claude/skills/reframe/SKILL.md`
- ✓ /recast — `~/.claude/skills/recast/SKILL.md`
- ✓ /rehearse — `~/.claude/skills/rehearse/SKILL.md`
- ✓ /refine — `~/.claude/skills/refine/SKILL.md`
- ✓ /argus — `~/.claude/skills/argus/SKILL.md`
- ✓ /argus-help — `~/.claude/skills/help/SKILL.md`
- ✓ /argus:setup — `~/.claude/skills/setup/SKILL.md`
- ✓ /argus:doctor — `~/.claude/skills/doctor/SKILL.md`
- ✓ /argus:configure — `~/.claude/skills/configure/SKILL.md`
- ✓ /argus:patterns — `~/.claude/skills/patterns/SKILL.md`

**Agents (18):**

*Research chain:*
- ✓ hayoon (하윤) 📝 — `~/.claude/agents/hayoon.md`
- ✓ sujin (다은) 🔍 — `~/.claude/agents/sujin.md`
- ✓ research_director (도윤) 🧠 — `~/.claude/agents/research_director.md`

*Strategy chain:*
- ✓ strategy_jr (정민) 🗺️ — `~/.claude/agents/strategy_jr.md`
- ✓ hyunwoo (현우) 🎯 — `~/.claude/agents/hyunwoo.md`
- ✓ chief_strategist (승현) 🏛️ — `~/.claude/agents/chief_strategist.md`

*Production:*
- ✓ seoyeon (서연) ✍️ — `~/.claude/agents/seoyeon.md`
- ✓ minjae (규민) 📊 — `~/.claude/agents/minjae.md`
- ✓ hyeyeon (혜연) 💰 — `~/.claude/agents/hyeyeon.md`
- ✓ sujin_hr (수진) 🤝 — `~/.claude/agents/sujin_hr.md`
- ✓ minseo (민서) 📣 — `~/.claude/agents/minseo.md`
- ✓ junseo (준서) ⚙️ — `~/.claude/agents/junseo.md`
- ✓ yerin (예린) 📋 — `~/.claude/agents/yerin.md`

*Validation:*
- ✓ donghyuk (동혁) ⚠️ — `~/.claude/agents/donghyuk.md`
- ✓ jieun (지은) 🎨 — `~/.claude/agents/jieun.md`
- ✓ taejun (윤석) ⚖️ — `~/.claude/agents/taejun.md`

*Special:*
- ✓ concertmaster (악장) 🎻 — `~/.claude/agents/concertmaster.md`
- ✓ devils-advocate — `~/.claude/agents/devils-advocate.md`

**References (6):**
- ✓ reframing-strategies.md
- ✓ execution-design.md
- ✓ persona-design.md
- ✓ risk-classification.md
- ✓ convergence.md
- ✓ decision-quality.md

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
2. Copy missing skills to `~/.claude/skills/`
3. Copy missing agents to `~/.claude/agents/`
4. Clean up temp directory

### Step 6: Version check

Read the installed `plugin.json` version and compare with the repo version. If outdated:

> ⚠ Argus v0.4.0 installed, v0.5.0 available.
> Run the install script to update, then run /argus:setup again.

### Step 7: Summary

**✓ Argus v0.5.0 · Ready**

10 skills · 18 agents · 6 references · journal ready

**Quick start:**
- `/reframe "your problem"` — sharpen your question
- `/argus "your problem"` — full pipeline
- `/argus:configure` — set preferences
- `/argus-help` — all commands

**What's new in v0.5:**
- Framing confidence (0-100) tracks question quality
- Expanded actor types (🧑→🤖, 🤖→🧑)
- Storyline (S/C/R) for plans
- Structured synthesis across personas
- Convergence tracking in /refine
- DQ Score with anti-sycophancy checks

> Restart Claude Code if this is a fresh install.

## Error Recovery

If any step fails, don't stop — continue checking and collect all issues. Present a summary at the end:

Setup completed with warnings:

✓ 8/10 skills installed
✗ Missing: /argus:configure, /argus:patterns
✗ Cannot write to .argus/ — check permissions

Run /argus:doctor for detailed diagnostics.
