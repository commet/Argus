# DKK v6 dogfood report — local-2026-07-15T16-52-32-289Z-seed20260714

- mode: **local** · started 2026-07-15T16:52:32.289Z · finished 2026-07-15T16:52:34.969Z
- steps: **4308** · expectation mismatches: **0** · steps with invariant failures: **0**
- seed: 20260714 · fuzz moves: 2000 · repeat: 3

> **Scope honesty:** this is the SYNTHETIC/structural arm. A green run here
> proves command-level conformance at volume against a faithful RPC port.
> It does NOT check any production Definition-of-done box, does not prove
> user value, and is not P5 evidence for the baseline/dkk_v6 conditions.

## Scenario results

| scenario | steps | mismatches | invariant failures |
|---|---:|---:|---:|
| FUZZ | 4014 | — | — |
| P1 | 3 | — | — |
| P2 | 3 | — | — |
| P3 | 3 | — | — |
| P4 | 3 | — | — |
| P5 | 3 | — | — |
| P6 | 3 | — | — |
| P7 | 3 | — | — |
| P8 | 3 | — | — |
| P9 | 3 | — | — |
| T1 | 6 | — | — |
| T2 | 9 | — | — |
| T3 | 9 | — | — |
| T4 | 6 | — | — |
| T5 | 6 | — | — |
| T6 | 6 | — | — |
| T7 | 6 | — | — |
| T8 | 3 | — | — |
| T9 | 9 | — | — |
| W1 | 15 | — | — |
| W10 | 6 | — | — |
| W11 | 6 | — | — |
| W12 | 6 | — | — |
| W13 | 3 | — | — |
| W14 | 6 | — | — |
| W15 | 6 | — | — |
| W16 | 6 | — | — |
| W17 | 18 | — | — |
| W18 | 15 | — | — |
| W19 | 6 | — | — |
| W2 | 6 | — | — |
| W20 | 9 | — | — |
| W21 | 6 | — | — |
| W2b | 6 | — | — |
| W3 | 6 | — | — |
| W4 | 6 | — | — |
| W5 | 12 | — | — |
| W6 | 6 | — | — |
| W7 | 6 | — | — |
| W8 | 12 | — | — |
| W9 | 12 | — | — |
| X1 | 6 | — | — |
| X2 | 12 | — | — |
| X3 | 9 | — | — |

## Refusal-code distribution (each refusal is a named, visible outcome)

- `UNKNOWN_REFERENCE` × 694
- `ILLEGAL_TRANSITION` × 614
- `IDEMPOTENCY_CONFLICT` × 235
- `INVALID_EVENT` × 186
- `FORBIDDEN` × 161
- `SEMANTIC_JUDGMENT_CONFLICT` × 132
- `BAD_REQUEST` × 15
- `SPACE_MISMATCH` × 3
- `EVENT_ID_CONFLICT` × 3
- `READ_FAILED` × 3
- `APPEND_FAILED` × 3
- `OWNERSHIP_REFUSED` × 3

## Fuzz funnel

projects=88 sealed=77 resolved=53 closed=38

## Findings and triage

None. Every step matched its scripted expectation and every invariant held.
## How to apply this to improvement (the loop)

1. Every finding above names a layer. Fix at that layer; never "fix" by weakening the invariant or the expectation.
2. A kernel-layer fix must land WITH a new case in `argus-mcp/src/v3/fixtures/dkk-corpus.ts` (the constitutional corpus), so the dogfood finding becomes a permanent CI guard.
3. An RPC/SQL-layer fix must change the migration AND `scripts/dogfood/harness/supabase-emulator.ts` in the same commit (the port is a declared copy).
4. Re-run with the SAME seed until green, then run 3 fresh seeds (`--seed`) before considering the class closed.
5. When the founder runs `--mode production`, compare that report to this one: any code that refuses locally but succeeds in production (or vice versa) is an emulator-fidelity bug — file it against the port, not the product.
