---
antefact: 0.1
id: 018f0000-0000-7000-8000-0000000000c6
authors: [{h: "Seojin Kim"}, {ai: "argus"}]
state: sealed
---

# Valid — sealed under projection recipe v1 (backward-compatibility anchor)

## Statement
- P1 (h) [assumption·low] Churn is driven mainly by upfront cost
  tripwires: [exit survey shows >50% non-price reasons]
- P2 (h←ai) [inference·moderate] Three comparable products grew after switching
  sources: [report R-2026-031]

## Stake
claim:      New-signup conversion exceeds 8% within 60 days of the switch
p:          { raw: "0.65", mode: direct, canonical: 0.65, granularity: 0.05 }
confidence: moderate
settle_by:  2099-11-10T00:00Z
settled_by: [h:Dana Park]
criteria:   { source: "weekly dashboard, snapshot w45", threshold: "8%", edge: "annul on repricing within 60d" }

seal:       { level: L0, proj: v1, hash: "sha256:2bce48bc26e6bf407ec0aa40bef4102e5f8a7210851ea495b747a6264c85d516", statement_rev: "sha256:3bf7e7d430d4ddbe3cdea2e0d0d0cd928f41c70452901d7953964a73a10ea1ec", nonce: "1d940ab22d57" }

## Settlement
