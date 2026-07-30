---
name: predict
user-invocable: false
description: "Save one user-confirmed candidate as a prediction, commitment, declaration, or witness. Invoked through /argus:check <id>."
argument-hint: "[<id>] [--latest-seed] [--list]"
---

# Internal predict workflow

Turn one selected candidate or sail seed into an append-only record. An AI
draft is never a seal. The user confirms both the sentence and what kind of
return, if any, it should create.

## 1. Find the target

Resolve `${CLAUDE_PLUGIN_ROOT}` per the sail path rules. If the target is not
unambiguous, list candidates:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" seal --list
```

Ask the user to choose only when more than one target remains plausible.

## 2. Produce a draft without writing

Run exactly one:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" seal "<id>"
```

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" seal --latest-seed
```

For an AI seed or generated contract the command prints `Draft only — nothing
was recorded.` This is expected. Do not claim that anything was sealed.

## 3. Confirm in one native question

Show the draft sentence verbatim, plus its check-by date when present. Use one
`AskUserQuestion`:

- `현실에서 확인` / `Check against reality` → `prediction`
- `내가 했는지 확인` / `Check what I did` → `commitment`
- `나중에 다시 생각` / `Revisit this standard` → `declaration`
- `기록만 남기기` / `Keep as a record` → `witness`
- cancel/skip → write nothing

These are not personality labels. They describe what the sentence asks Argus
to do. If the user edits the sentence, use their edited wording and keep the
draft as the proposal reference. Never preselect a kind with confidence
language.

For `prediction`, `commitment`, or `declaration`, keep the displayed date unless
the user changes it. `witness` has no date, reminder, event trigger, or
settlement.

## 4. Seal the confirmed record

Rerun with the exact confirmed fields. The authorization ref is an opaque host
confirmation receipt; never put user content in it.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" seal "<id>" \
  --predicate "<confirmed sentence>" \
  --falsified-if "<draft condition; omit for witness>" \
  --check-by "<YYYY-MM-DD; omit for witness>" \
  --kind prediction|commitment|declaration|witness \
  --origin-utterance "<first user utterance when available; otherwise confirmed sentence>" \
  --review-condition-status not_asked \
  --proposal-ref "<candidate/seed id>" --adopted-as wording \
  --author user \
  --confirmed --authorization-ref "plugin:predict:<id>:confirmation"
```

For a candidate whose fields came directly from the user, use the same command;
`--proposal-ref` is omitted when there was no AI proposal.

`--author user` is correct here ONLY because the native confirmation just
happened — the user affirmed this exact sentence in the `AskUserQuestion` above.
On any path without that explicit confirmation, omit `--author` entirely
(absence is the honest unknown/AI-path signal; never default to `user`).

Relay only:

- the confirmed sentence;
- the user-language kind label;
- the return date/event, or “알림 없이 기록만 남겼어요 / Saved with no reminder.”

Then run the existing optional account sync:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/push-webapp.js" push --ensure-connect
```

Do not print credentials. A sync failure never undoes the local append.

## Invariants

- Never seal multiple candidates at once.
- Never turn a draft into a seal without the native confirmation.
- Never infer that the user authored AI wording; store proposal lineage.
- Never add a date to `witness`.
- Never call the accumulated record a score, win rate, accuracy, or track
  record.
