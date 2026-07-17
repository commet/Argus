---
name: scan
user-invocable: false
description: "Recover decision candidates from past Claude Code conversations in this project. This is the ambient-capture entry point: it finds decisions that happened outside `/argus:sail`, writes them as local candidate ledger events, and does not seal anything automatically. Use when the user asks to scan past chats, recover decisions, harvest decisions, or asks what argus-watch scan used to do. Invoked as `/argus:scan`."
argument-hint: "[--since days] [--all-projects] [--list] [--status] [--purge <id|all>]"
---

# /argus:scan

**What this skill does:** Scans past Claude Code transcripts for human decision
moments and writes only `candidate` events to `.argus/ledger/ledger.jsonl`.

This is an entry point, like `/argus:sail`:

- `/argus:sail` = start from a decision the user is making now.
- `/argus:scan` = recover decisions already made in past Claude Code chats.

It never seals automatically. The user must choose which candidates are worth
turning into later-checkable contracts with `/argus:predict <id>`.

---

## Inputs

- No args: scan this project for fresh transcript turns.
- `--since <days>`: scan only recent transcript files.
- `--all-projects`: scan all Claude Code project transcripts.
- `--concurrency <n>`: bounded parallel detector calls; default `3`.
- `--list`: list current unsealed candidates without scanning.
- `--status`: show content-free background capture queue lifecycle status.
- `--purge <id|all>`: explicitly remove local transcript/session coordinates
  from one or all non-leased queue receipts.

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
   - next command: `/argus:predict <id>`.

---

## Relationship To argus-watch

`argus-watch scan` was the prototype. `/argus:scan` is now the normal plugin
path. Foreground scan and opt-in background capture use the same deterministic
extractor port, exact-source byte verification, stable identity, and canonical
writer. No separate detector prompt, webapp login, or API key is involved.

---

## Forbidden Patterns

- Do not tell the user that scan creates a judgment record. It creates
  candidates only.
- Do not seal all scan results automatically.
- Do not ask users to install `argus-watch` for normal scanning.
