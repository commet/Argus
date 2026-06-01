---
name: argus-doctor
description: "Diagnose Argus installation issues. Checks skills, agents, data directories, journal integrity, and configuration. Use when something isn't working or after /argus:setup reports warnings."
allowed-tools: Read, Bash, Glob, Grep
---

## When to use

- ✓ A skill isn't being recognized or producing errors
- ✓ After /argus:setup reports warnings
- ✓ Journal data seems corrupted or missing
- ✓ Output files aren't being saved properly
- ✗ First installation (use /argus:setup)
- ✗ Changing preferences (use /argus:configure)

**Always respond in the same language the user uses.**

**No box drawing.** Do NOT use `╭╮╰╯`, `┌│└`, `═══╪`, `───┼`, `━━━`, or any Unicode box characters. Use `---`, `**bold**`, and whitespace for structure.

## Diagnostic Flow

Run ALL checks, collect all results, then present a unified report. Never stop at the first issue.

### Check 1: Skill files

For each expected skill, verify:
1. File exists at the expected path
2. File has valid YAML frontmatter (starts with `---`)
3. Frontmatter contains required fields: `name`, `description`

Expected skills (10):
- `reframe`, `recast`, `rehearse`, `refine`, `argus`, `help` (core)
- `setup`, `doctor`, `configure`, `patterns` (utility)

Search in BOTH locations:
- `~/.claude/skills/{name}/SKILL.md` (global)
- `.claude/skills/{name}/SKILL.md` (project)

### Check 2: Agent files

Verify:
- `~/.claude/agents/devils-advocate.md` exists
- OR `.claude/agents/devils-advocate.md` exists (project)
- File contains valid agent definition

### Check 3: Data directory

Check `.argus/` in project root:
1. Directory exists and is writable
2. `journal.md` — exists, parse entry count, check last entry date
3. `reframe.md` — exists (from last /reframe run)
4. `recast.md` — exists (from last /recast run)
5. `rehearse.md` — exists (from last /rehearse run)
6. `refine.md` — exists (from last /refine run)
7. `last-run.md` — exists (from last /argus run)
8. `config.json` — exists (from /argus:configure)

### Check 4: Journal integrity

If `journal.md` exists:
1. Count total entries (lines starting with `## `)
2. Check for malformed entries (missing required fields)
3. Report date range (oldest → newest)
4. Check for duplicate dates
5. Report entry breakdown: reframe/recast/rehearse/refine/argus

### Check 5: Configuration

If `config.json` exists in `.argus/`:
1. Parse JSON — report any syntax errors
2. Validate known fields have valid values
3. Report current settings

### Check 6: Context contract chain

If output files exist, verify the contract chain is intact:
1. `reframe.md` has `## Context Contract` section
2. `recast.md` references data from reframe contract
3. `rehearse.md` references data from recast contract
4. `refine.md` references data from rehearse contract

Report any broken links in the chain.

### Check 7: Reference files

Check if reference/support files exist in the skill directories:
- `reframe/references/reframing-strategies.md`
- `recast/references/execution-design.md`
- `rehearse/references/persona-design.md`
- `rehearse/references/risk-classification.md`

## Output

Present a unified diagnostic report:

**🔍 Argus · Doctor**

| Check | Status | Detail |
|-------|--------|--------|
| Skills | 10/10 ✓ | |
| Agents | 1/1 ✓ | |
| Data dir | ✓ | .argus/ |
| Journal | ✓ | [N] entries ([date] → [date]) |
| Config | [✓/✗] | .argus/config.json |
| Contract chain | [✓/⚠/✗] | [status] |
| References | [N]/4 | [✓/⚠] |

---

**Journal breakdown:**
- /reframe — [N] runs
- /recast — [N] runs
- /rehearse — [N] runs
- /refine — [N] runs
- /argus — [N] runs

---

[Issues found / All clear]

### If issues found:

For each issue, provide:
1. What's wrong (specific)
2. Why it matters
3. How to fix it (actionable command or instruction)

```
  Issues:

  ✗ Missing: /argus:patterns skill
    Impact: Cannot analyze journal patterns
    Fix: Run /argus:setup to reinstall

  ⚠ Journal has 52 entries (recommended: archive after 50)
    Impact: Slower startup reads
    Fix: Move older entries to .argus/journal-archive.md

  ✗ Contract chain broken: rehearse.md missing
    Impact: /refine won't have full context
    Fix: Re-run /rehearse to regenerate
```

### If all clear:

```
  ✓ All systems healthy. Argus is ready.

  Last activity: [date] /[skill]
  Total runs: [N]

  Tip: Run /argus:patterns to see your thinking patterns.
```
