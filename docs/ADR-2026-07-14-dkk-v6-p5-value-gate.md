# ADR — Decision Knowledge Kernel v6 P5 Value Gate

Date: 2026-07-14
Status: **Hold — structural lane passed; real value evidence is absent**
Decision owner: Decision Knowledge Kernel implementation stream

## Decision

P5 does not promote the v6 pilot to web, Telegram, or plugin work today.
The correct decision is **HOLD**, not GO and not a fabricated NO-GO: all
structural checks passed, but the preregistered real dogfood threshold has no
submitted observations.

This preserves an important distinction:

| Lane | Evidence | Result |
|---|---|---|
| structural | 30-case corpus, semantic conformance, P4 authority/receipt/protocol regression | pass |
| user value | matched baseline and v6 completed lifecycles, reconstruction review, interaction cost | unmeasured |

Synthetic cases can disprove the implementation but cannot demonstrate that a
person accepts the confirmation cost for the reconstruction benefit. Therefore
P6 and P7 are blocked by the v6 plan's own gate.

## Executable gate

`argus-mcp/src/v3/p5-gate.ts` owns the deterministic gate. It accepts only
separate synthetic and real-dogfood data, and returns one of:

- `go`: every preregistered structural, reconstruction, authority, and cost
  criterion has passed with matched real cycles;
- `no_go`: a disqualifying failure is observed, including unnamed loss,
  fabrication, structural break, or a silent false seal;
- `hold`: evidence is missing or incomparable. Hold is deliberately not
  treated as a pass.

Run it with:

```text
cd argus-mcp
npm run eval:p5 -- <p5-results.json>
```

The input is validated at runtime. It needs synthetic corpus coverage plus,
for both baseline and v6, cycle-level completion/time/confirmation data and
the blinded reconstruction aggregates. Do not enter guessed zeros for missing
measurements: that converts an absence of evidence into a false claim.

## Current factual input

- P1 corpus: 30 cases; its executable tests and the P2/P4 conformance suite
  pass.
- P4: explicit authorization is required for seal/resolve/close, and protocol
  tests show the pilot is unavailable without opt-in.
- Real v6 pilot cycles submitted to this gate: **0**.
- Matched baseline cycles submitted to this gate: **0**.

Against the preregistered minimum of 10 completed cycles per condition, the
current output is therefore `hold` with no downstream authorization.

## Resumption protocol

1. Enable `ARGUS_DKK_V6_PILOT=1` only for an informed dogfood session.
2. Record 10 completed v6 lifecycles and a matched baseline cohort; retain
   opaque cycle ids, not decision contents, in the P5 input.
3. Have reconstruction scored without condition labels when practical.
4. Run the gate, commit the result data and decision, then only a `go` permits
   the separate Blueprint-reconciliation and P6 web-convergence work.

This is a deliberate stop condition, not abandoned work: expanding a system
whose claimed benefit has not been measured would violate the v6 contract.
