# R45 — helm: define what the keel scan fires on (evidence + 받치는 + irreversible)

**Cluster:** helm (R44-46). Depends on R44 (prompt now present to define precision
against). Findings helm#1 + helm#3, dual-skeptic survived, leverage 8.
**Spine-relevant** — this is the precision of the over/under-fire gate itself.

## The defect

helm fires when an unsupported load-bearing claim "touches" an irreversible op.
Two of the three words in that sentence were undefined:

- **`evidence_in_text`** (helm#1) — the probe drops a finding when the claim has
  no supporting evidence "in the text," but *evidence* was never defined. A single
  mention? a restatement? an external fact? Loose → under-fires (a restatement
  passes as support, real unsupported claims slip). Strict → over-fires.
- **`받치는` / "touches"** (helm#3) — a finding touches an irreversible op if the
  sentence "or the step it 받치는 (supports)" is irreversible. Unbounded:
  *everything* in a plan eventually supports a deploy, so a loose reading fires on
  reversible work merely upstream of an eventual irreversible step → the
  mirror-clause over-fire the spine forbids.

The irreversible-op list was also example-based (6 items) with no test, so novel
forms (a breaking API change, a permission-scope grant) fell outside it silently.

## The fix (3 parts, all in skills/helm/SKILL.md)

1. **`evidence_in_text` definition box** — positive list (number/measurement,
   stated precedent, named forcing constraint, explicit causal "A이므로 B", cited
   source — *in the plan text*) and negative list (restatement, confidence
   assertion, contentless authority, **anything outside the text**). Plus the
   **honesty clause** (spine): because the probe only sees the text, the spoken
   finding is always "근거가 *계획 안에* 없어요," never "근거가 없어요/위험해요."
   helm observes a textual absence; it does not judge whether the decision is sound.
2. **one-hop rule for `받치는`** — a finding touches an irreversible op only if
   `removed_sentence` is itself the irreversible act, or is the *direct*
   reason/precondition of an irreversible step named in the same plan. Exactly one
   hop. Mere co-occurrence or a reversible step with a downstream deploy does NOT
   fire. This is the concrete mechanism that blocks "everything leads to deploy"
   over-fire.
3. **irreversible = a test, not a list** — "cannot be cheaply undone within the
   same session/PR without external coordination or data loss." The canonical
   examples now serve the test, and the list gained breaking-API-change and
   permission/access-scope change (per the skeptic note). A reversible op is one a
   single commit rolls back.

Added a **worked supported-vs-unsupported example** (migration-without-rollback
fires; button-color-change stays silent) so the gate is demonstrated, not just
asserted.

## Verification

`node scripts/validate-plugin.js` → passed. Markdown-only. The over/under-fire
gate is now defined precisely enough that R46 can write a *measurable* graduate
gate against it (the next round), and R56 can run that gate on real plans.

## Next

R46 (helm): replace the subjective acceptance criteria (lines 107-111, "잔소리
없이 / 멀쩡한 계획") with three quantitative graduate gates — the guard that proves
the under-fire default actually holds (helm#5).
