<!-- Supporting file for /argus:review. Not a standalone skill. -->

# Revise

Create a child version; never overwrite its parent.

## Inputs

- the active scaffold and verification ledger;
- explicit user or stakeholder feedback;
- challenged claims and their originating reviewer ids.

## Routing

- Route a narrow correction to its originating bounded reviewer.
- Route cross-cutting wording or synthesis to `synthesizer`.
- If the prior reviewer no longer exists, route to `synthesizer` and preserve
  the stale id in the revision note.
- Never add reviewers beyond the bounds in [team.md](team.md).

## Apply

1. Write a short directive naming the exact concern.
2. Produce the smallest coherent patch.
3. Preserve source attribution, contradictions, and human-required checks.
4. Set `reviewing_agent_id` to `"synthesizer"` for the child draft.
5. Mark substantive changes `requires_reverification: true`.
6. Run [verify.md](verify.md) once on changed claims.

Pure formatting changes may skip re-verification. A changed claim, action,
assumption, trade-off, or checkpoint may not.

Never invent evidence, silently erase a challenged claim, or loop revisions
without a new user directive.
