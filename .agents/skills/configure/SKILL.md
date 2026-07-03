---
name: argus-configure
description: "Set up Argus preferences — language, output format, journal settings, and presets. Interactive configuration with presets for quick onboarding. Saves to .argus/config.json."
allowed-tools: Read, Write, AskUserQuestion
---

## When to use

- ✓ First time using Argus and want to set preferences
- ✓ Want to change language, output format, or journal settings
- ✓ Switching between Quick/Standard/Learning modes
- ✗ First installation (use /argus:setup first)
- ✗ Diagnosing issues (use /argus:doctor)

**Always respond in the same language the user uses.**

**No box drawing.** Do NOT use `╭╮╰╯`, `┌│└`, `═══╪`, `───┼`, `━━━`, or any Unicode box characters. Use `---`, `**bold**`, and whitespace for structure.

## Configuration Flow

### Step 0: Detect existing configuration

Check if `.argus/config.json` exists.

**New user (no config):** Run the full setup flow (5 questions).
**Returning user (config exists):** Show current settings and ask what to change.

### For new users: Full setup

Show the header:

**⚙ Argus · Configure**

Let's set up your preferences. 5 quick questions.

**Q1: Preset**

```
  ■ Preset                           1 / 5

  How do you want to use Argus?

    1 · Quick — /reframe only, minimal output
        Best for: fast thinkers who want one sharp reframe

    2 · Standard — full pipeline, clean output
        Best for: regular use, team sharing

    3 · Learning — full pipeline + journal + pattern tracking
        Best for: improving your thinking over time (recommended)

  ▸
```

Preset mappings:
- **Quick**: auto_save=false, journal=false, full_pipeline=false, output_format=compact
- **Standard**: auto_save=true, journal=true, full_pipeline=true, output_format=standard
- **Learning**: auto_save=true, journal=true, full_pipeline=true, output_format=detailed, patterns=true

**Q2: Language**

```
  ■ Language                          2 / 5

  Preferred language for output?

    1 · Auto-detect (match your input language)
    2 · English
    3 · 한국어
    4 · 日本語
    5 · Other (type it)

  ▸
```

**Q3: Output location**

```
  ■ Output                           3 / 5

  Where to save results?

    1 · .argus/ in project root (default)
    2 · Custom path (type it)
    3 · Don't save files

  ▸
```

**Q4: Journal**

Only shown if preset is Standard or Learning:

```
  ■ Journal                          4 / 5

  Track your decision patterns over time?

    1 · Yes — append to .argus/journal.md (recommended)
    2 · No — skip journaling

  ▸
```

**Q5: Persona defaults**

Only shown if preset is Standard or Learning:

```
  ■ Personas                         5 / 5

  Default persona count for /rehearse?

    1 · 2 personas (faster, less thorough)
    2 · 3 personas (balanced, recommended)
    3 · 4 personas (thorough, takes longer)

  ▸
```

### For returning users: Quick update

**⚙ Argus · Configure**

**Current settings:**
- Preset: [Learning]
- Language: [auto-detect]
- Output: [.argus/]
- Journal: [enabled]
- Personas: [3]

What would you like to change?

```
  1 · Switch preset
  2 · Change language
  3 · Change output location
  4 · Toggle journal
  5 · Change persona count
  6 · Reset to defaults
  7 · Done — keep current settings

  ▸
```

Allow multiple changes before saving.

### Save configuration

Save to `.argus/config.json`:

```json
{
  "version": "0.3.0",
  "preset": "learning",
  "language": "auto-detect",
  "output_path": ".argus/",
  "auto_save": true,
  "journal": {
    "enabled": true,
    "path": ".argus/journal.md",
    "max_entries_before_archive_hint": 50
  },
  "rehearse": {
    "default_persona_count": 3
  },
  "pipeline": {
    "full_pipeline_enabled": true,
    "max_refine_rounds": 3,
    "output_format": "detailed"
  },
  "updated_at": "[ISO date]"
}
```

### Confirmation

**✓ Argus · Configured**

- Preset: [Learning]
- Language: [auto-detect]
- Output: [.argus/]
- Journal: [enabled]
- Personas: [3]

Saved to `.argus/config.json`

> Try: `/reframe "your problem"` or `/argus "important decision"`

## How other skills read the config

All Argus skills should check for `.argus/config.json` at startup:

1. If config exists → use settings (language preference, persona count, etc.)
2. If config doesn't exist → use defaults (auto-detect language, 3 personas, save to .argus/)
3. Config is OPTIONAL — Argus works fine without it

Skills should NEVER require configuration to run. Config is a convenience layer.
