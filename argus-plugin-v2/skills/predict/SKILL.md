---
name: predict
description: "Seal a chosen Argus decision candidate or sail seed into a later-checkable contract. This is the common state transition after either entry point: `/argus:sail` can produce a seed, `/argus:scan` can produce candidates, and `/argus:predict` turns the selected item into a sealed ledger contract. Use when the user says seal this, commit this for later, remember this decision, or chooses a scan candidate id. Invoked as `/argus:predict`."
argument-hint: "[<id>] [--latest-seed] [--list]"
---

# /argus:predict

**What this skill does:** Turns one selected item into a sealed, falsifiable
contract in `.argus/ledger/ledger.jsonl`.

This is a shared state transition, not a separate entry point:

- `/argus:sail` produces a current decision and may leave a `contract_seed`.
- `/argus:scan` produces past-decision `candidate`s.
- `/argus:predict` seals one chosen seed or candidate.
- `/argus:resolve` later settles all sealed contracts, regardless of source.

---

## Inputs

- No args or `--list`: show sealable sail seeds and scan candidates.
- `<id>`: seal that exact candidate or seed id.
- `--latest-seed`: seal the latest unsealed `/argus:sail` contract seed.
- Optional overrides:
  - `--predicate "..."`
  - `--falsified-if "..."`
  - `--check-by YYYY-MM-DD`
  - `--model sonnet|haiku|opus`

Use `--latest-seed` when the user says "seal this" immediately after a sail
run and there is an obvious latest Current Heading seed. Use `<id>` when the
user is choosing from scan results.

---

## Steps

1. Resolve `${CLAUDE_PLUGIN_ROOT}` per sail Path Resolution. The canonical script
   is `${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js`.
2. If the target is unclear, run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" seal --list
```

Then ask the user to pick an id only if there is more than one plausible target.

3. If the user named an id:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" seal "<id>"
```

4. If the user clearly means the latest sail seed:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" seal --latest-seed
```

5. Relay the compact result: id, predicate clipped if long, and check-by date.
Do not over-explain the ledger internals.

---

## Product Model

Keep the mental model clear:

- `sail` / `scan` answer: where did this decision come from?
- `seal` / `settle` answer: what state is this decision in?

`seal` is not scan-only. It also seals a sail seed. `settle` is not sail-only or
scan-only; it settles any sealed item whose check-by date has arrived.

---

## Relationship To argus-watch

`argus-watch seal` was the prototype for scan candidates. `/argus:predict` is the
normal plugin path and covers both recovered candidates and new sail seeds.

---

## Forbidden Patterns

- Sealing every candidate from a scan.
- Sealing without a clear user-selected target when multiple targets exist.
- Calling a candidate a track record before it is sealed.
- Calling a sealed contract settled before reality is checked by `/argus:resolve`.
