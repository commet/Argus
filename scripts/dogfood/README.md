# DKK v6 Dogfood Runner

Automated lifecycle exerciser for the Decision Knowledge Kernel v6 across all
three surfaces (web / Telegram / plugin), with non-sensitive evidence
recording, invariant checking, a model-based fuzzer, and an analyzer that
turns runs into a triage report plus the **synthetic arm** of the P5 gate
input.

## What this is — and is not

**Is:** the same code paths production runs — `semantic-web.ts` command
builder → `semantic-ledger-gateway.ts` → RPC semantics, the shared
`telegram-semantic.ts` brain (the webhook delegates to it), the real
settlement callback codecs, the real `semantic-plugin.ts` builders and the
verbatim outbox→pull loop — executed at volume against a **line-by-line
TypeScript port of the production RPC**
(`harness/supabase-emulator.ts` ⇄ `supabase/migrations/20260714_project_semantic_events.sql`).

**Is not:** proof of any production Definition-of-done box. A green local run
proves structural/command-level conformance. It is NOT the live web/Telegram/
plugin lifecycle, NOT export/erasure verification, NOT P5 baseline/dkk_v6
evidence, and it must never be reported as those (handoff:
`docs/DKK-v6-CONTINUATION-HANDOFF-2026-07-14.md` §Read this first).

## Run

```bash
npm run dogfood                     # scripted corpus + 300-move fuzz
npm run dogfood -- --fuzz 2000      # heavier fuzz
npm run dogfood:heavy               # 3 seeds × (corpus + 2000 moves)
npm run dogfood -- --only W5,T1     # focus on scenarios
npm run dogfood -- --seed 777       # reproduce a finding's seed
npm run dogfood:analyze scripts/dogfood/evidence/<run-id>
```

Exit code 0 = every step matched its scripted expectation and every invariant
held. Anything else = findings; run the analyzer.

## Production mode (founder's machine)

```bash
ARGUS_BASE_URL=https://argus.voyage \
NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
DOGFOOD_EMAIL=... DOGFOOD_PASSWORD=... DOGFOOD_PROJECT_ID=<uuid> \
npm run dogfood:prod
```

Drives the handoff's ten P6 web-lifecycle steps over real HTTPS with a
**disposable** signed-in account and an **empty** project (it refuses a
project that already has events). Records event ids, receipts, HTTP codes,
invariant results, and content **hashes only**. This run — inspected — is
what checks the P6 box.

Telegram (P7) and plugin (P7) production runs need a human tapping a real
bot / running a real `/argus:pull`; follow the handoff's step lists and use
`GET /api/semantic/projects/<id>/events` between steps to verify the stream
(the same invariant checks apply — `harness/invariants.ts` is importable).

## Layout

```
harness/supabase-emulator.ts  RPC port (MUST change with the SQL, same commit)
harness/surfaces.ts           web / telegram / plugin drivers (real modules)
harness/invariants.ts         I1–I10 semantic invariants
harness/world.ts              step executor: snapshot → run → check → record
scenarios/web.ts              W1–W21 (P6 + adversarial edges)
scenarios/telegram.ts         T1–T9 (shared-brain settlement/close)
scenarios/plugin.ts           P1–P9 (reforge/answer/close/outbox/pull)
scenarios/cross.ts            X1–X3 (one history across surfaces, as-of reads)
scenarios/fuzz.ts             model-based random walk (seeded, reproducible)
production.ts                 P6 over real HTTPS
analyze.ts                    report.md + p5-synthetic.json + triage
evidence/<run-id>/            steps.jsonl, meta.json (gitignored)
```

## The invariants (a red here is a product defect)

| id | statement |
|----|-----------|
| I1 | an admitted stream never folds to INVALID_EVENT / MISSING_AUTHORITY / idempotency anomalies |
| I2 | append-only: admitted events are byte-stable, the stream never shrinks |
| I3 | close requires its exact resolution; a resolution never closes |
| I4 | defer / pending are non-terminal (asserted per-scenario) |
| I5 | an exact retry is a duplicate receipt, never a second write (per-scenario) |
| I6 | contradictory acts end as refusal codes or preserved visible conflicts (per-scenario) |
| I7 | one history projects identically on every read path |
| I8 | fold is replay-deterministic across JSON round-trips |
| I9 | every admitted authorial event carries recorded human authorization |
| I10 | as-of reads never leak later knowledge into the past |

ILLEGAL_TRANSITION / UNKNOWN_REFERENCE anomalies in a fold are **conflict
markers** — the sanctioned representation of a genuinely-concurrent
contradictory act — and are only legal in scenarios that actually raced.

## How to read a run

1. `report.md` — scenario table, refusal-code distribution, fuzz funnel, and
   per-finding triage (what / where / do / repro command with seed).
2. Every finding names its layer: kernel reducer, RPC/SQL contract, gateway,
   a surface adapter, or the harness itself. Fix at that layer — never by
   weakening an invariant or an expectation.
3. Kernel-layer fixes land WITH a case in
   `argus-mcp/src/v3/fixtures/dkk-corpus.ts`; RPC-layer fixes change the
   migration AND the emulator port in the same commit.
4. Re-run the same seed to green, then 3 fresh seeds before closing the class.
5. `p5-synthetic.json` is the synthetic block of the P5 gate input. Baseline /
   dkk_v6 cycle blocks are intentionally absent — they may only come from real
   dogfood, and `evaluateP5` holds on their absence by design.

## Findings log

- **2026-07-14 (first run, 25 reds → 1 root cause):** seal batches read back
  from the ledger table in `(created_at, event_id)` order put
  `…:return` before `…:sealed` (same `created_at`, lexicographic tiebreak),
  so every fold after a reload dropped the return contract → resolve / defer /
  Telegram answers all failed with UNKNOWN_REFERENCE. Production table had 0
  rows, so no user had hit it yet. Fixed by ordinal event-id suffixes in
  multi-event batches (`1-sealed`/`2-return`, `1-observation`/`2-resolution`)
  in `semantic-web.ts`; regression-guarded in
  `src/lib/__tests__/semantic-web.test.ts` ("folds correctly in table
  read-back order"). Unit tests had missed it because they fold events in
  build order — the seam only appears through the storage round-trip.
