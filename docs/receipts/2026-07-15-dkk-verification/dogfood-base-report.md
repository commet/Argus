# DKK v6 dogfood report — local-2026-07-15T16-51-03-482Z-seed20260714

- mode: **local** · started 2026-07-15T16:51:03.482Z · finished 2026-07-15T16:51:03.837Z
- steps: **300** · expectation mismatches: **0** · steps with invariant failures: **0**
- seed: 20260714 · fuzz moves: 300 · repeat: 1

> **Scope honesty:** this is the SYNTHETIC/structural arm. A green run here
> proves command-level conformance at volume against a faithful RPC port.
> It does NOT check any production Definition-of-done box, does not prove
> user value, and is not P5 evidence for the baseline/dkk_v6 conditions.

## Scenario results

| scenario | steps | mismatches | invariant failures |
|---|---:|---:|---:|
| FUZZ | 202 | — | — |
| P1 | 1 | — | — |
| P2 | 1 | — | — |
| P3 | 1 | — | — |
| P4 | 1 | — | — |
| P5 | 1 | — | — |
| P6 | 1 | — | — |
| P7 | 1 | — | — |
| P8 | 1 | — | — |
| P9 | 1 | — | — |
| T1 | 2 | — | — |
| T2 | 3 | — | — |
| T3 | 3 | — | — |
| T4 | 2 | — | — |
| T5 | 2 | — | — |
| T6 | 2 | — | — |
| T7 | 2 | — | — |
| T8 | 1 | — | — |
| T9 | 3 | — | — |
| W1 | 5 | — | — |
| W10 | 2 | — | — |
| W11 | 2 | — | — |
| W12 | 2 | — | — |
| W13 | 1 | — | — |
| W14 | 2 | — | — |
| W15 | 2 | — | — |
| W16 | 2 | — | — |
| W17 | 6 | — | — |
| W18 | 5 | — | — |
| W19 | 2 | — | — |
| W2 | 2 | — | — |
| W20 | 3 | — | — |
| W21 | 2 | — | — |
| W2b | 2 | — | — |
| W3 | 2 | — | — |
| W4 | 2 | — | — |
| W5 | 4 | — | — |
| W6 | 2 | — | — |
| W7 | 2 | — | — |
| W8 | 4 | — | — |
| W9 | 4 | — | — |
| X1 | 2 | — | — |
| X2 | 4 | — | — |
| X3 | 3 | — | — |

## Refusal-code distribution (each refusal is a named, visible outcome)

- `UNKNOWN_REFERENCE` × 52
- `ILLEGAL_TRANSITION` × 21
- `IDEMPOTENCY_CONFLICT` × 15
- `INVALID_EVENT` × 9
- `FORBIDDEN` × 8
- `SEMANTIC_JUDGMENT_CONFLICT` × 7
- `BAD_REQUEST` × 5
- `SPACE_MISMATCH` × 1
- `EVENT_ID_CONFLICT` × 1
- `READ_FAILED` × 1
- `APPEND_FAILED` × 1
- `OWNERSHIP_REFUSED` × 1

## Fuzz funnel

projects=17 sealed=14 resolved=8 closed=4

## Findings and triage

None. Every step matched its scripted expectation and every invariant held.
## How to apply this to improvement (the loop)

1. Every finding above names a layer. Fix at that layer; never "fix" by weakening the invariant or the expectation.
2. A kernel-layer fix must land WITH a new case in `argus-mcp/src/v3/fixtures/dkk-corpus.ts` (the constitutional corpus), so the dogfood finding becomes a permanent CI guard.
3. An RPC/SQL-layer fix must change the migration AND `scripts/dogfood/harness/supabase-emulator.ts` in the same commit (the port is a declared copy).
4. Re-run with the SAME seed until green, then run 3 fresh seeds (`--seed`) before considering the class closed.
5. When the founder runs `--mode production`, compare that report to this one: any code that refuses locally but succeeds in production (or vice versa) is an emulator-fidelity bug — file it against the port, not the product.
