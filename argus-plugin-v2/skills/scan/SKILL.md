---
name: scan
description: "Recover decision candidates from past Claude Code conversations in this project. This is the ambient-capture entry point: it finds decisions that happened outside `/argus:sail`, writes them as local candidate ledger events, and does not seal anything automatically. Use when the user asks to scan past chats, recover decisions, harvest decisions, or asks what argus-watch scan used to do. Invoked as `/argus:scan`."
argument-hint: "[--since days] [--all-projects] [--list]"
---

# /argus:scan

**What this skill does:** Scans past Claude Code transcripts for human decision
moments and writes only `candidate` events to `.argus/ledger/ledger.jsonl`.

This is an entry point, like `/argus:sail`:

- `/argus:sail` = start from a decision the user is making now.
- `/argus:scan` = recover decisions already made in past Claude Code chats.

It never seals automatically. The user must choose which candidates are worth
turning into later-checkable contracts with `/argus:seal <id>`.

---

## Inputs

- No args: scan this project for fresh transcript turns.
- `--since <days>`: scan only recent transcript files.
- `--all-projects`: scan all Claude Code project transcripts.
- `--model sonnet|haiku|opus`: model for the detector; default `sonnet`.
- `--concurrency <n>`: bounded parallel detector calls; default `3`.
- `--list`: list current unsealed candidates without scanning.

---

## Steps

1. Resolve `${CLAUDE_PLUGIN_ROOT}` per sail Path Resolution. The canonical script
   is `${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js`.
2. Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" scan [flags]
```

For listing only:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" scan --list
```

3. Relay the compact result:
   - how many conversation segments were scanned,
   - candidate ids found,
   - next command: `/argus:seal <id>`.

---

## Relationship To argus-watch

`argus-watch scan` was the prototype. `/argus:scan` is now the normal plugin
path. It uses the user's existing Claude Code auth via headless `claude -p`; no
webapp login and no API key are required.

---

## Forbidden Patterns

- Do not tell the user that scan creates a judgment record. It creates
  candidates only.
- Do not seal all scan results automatically.
- Do not ask users to install `argus-watch` for normal scanning.
