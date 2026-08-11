---
antefact: 0.1
id: 018f0000-0000-7000-8000-000000000004
authors: [{h: "Seojin Kim"}, {ai: "argus"}]
state: recorded
---

# Decision — switch to subscription pricing in September

## Statement
- P1 (h) [assumption·low] Churn is driven mainly by upfront cost
  tripwires: [exit survey shows >50% non-price reasons]
- P2 (h←ai) [inference·moderate] Three comparable products grew after switching
  sources: [report R-2026-031]

## Stake
claim:      New-signup conversion exceeds 8% within 60 days of the switch
p:          { granularity: 0.05, canonical: 0.65, raw: "0.65", mode: direct }
confidence: moderate
settle_by:  2099-11-10T00:00Z
settled_by: [h:Dana Park]
criteria:   { edge: "annul on repricing within 60d", threshold: "8%", source: "weekly dashboard, snapshot w45" }

## Settlement
