---
name: journal
description: Read the decision record across Argus sessions as a neutral chronology. Show original sentences, authorship, later answers, revisions, and what still has a return condition. Never aggregate outcomes into a score, calibration claim, hit rate, or performance label. Invoked as `/argus:journal`.
user-invocable: false
---

# Argus Journal

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" journal
```

The journal is read-only. Render the command output faithfully and compactly.

## What the user should see

For each record, prefer this order:

1. The user's original sentence.
2. When and through which path it was recorded.
3. Its current kind in ordinary language:
   - something reality can answer,
   - something I meant to do,
   - a standard I chose,
   - something I only wanted to preserve.
4. The return condition or event, when one exists.
5. Later answers in chronological order.
6. Corrections, challenges, and adoption lineage when present.

Always distinguish:

- the user's own words,
- an Argus suggestion the user adopted,
- an Argus suggestion that remains only a draft.

## Non-negotiable

- Never show or infer a hit rate, win rate, accuracy, grade, tier, streak, skill
  claim, maturity threshold, or "track record."
- Never aggregate `held`, `missed`, `luck`, or similar legacy fields. Old rows
  may be quoted on their individual receipt when the user asks, but they are
  not evidence about the person.
- Never silently turn an AI draft into the user's judgment.
- Never rewrite an earlier sentence. A correction or later answer is another
  dated entry.
- Do not ask for more information unless the user explicitly wants to edit,
  settle, or inspect one record.

If no record exists, say so plainly and offer `/argus:predict` as an optional
next step. Do not manufacture an insight from an empty or thin history.
