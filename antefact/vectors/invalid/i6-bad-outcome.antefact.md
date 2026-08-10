---
antefact: 0.1
id: 018f0000-0000-7000-8000-0000000000a6
authors: [{h: "Seojin Kim"}]
state: settled
---

# Broken — settlement uses an outcome outside the closed set

## Statement
- P1 (h) [assumption·low] Something

## Stake
claim:      A thing happens
p:          { raw: "0.5", mode: direct, canonical: 0.5, granularity: 0.1 }
settle_by:  2099-01-01T00:00Z
settled_by: [h:Dana Park]
criteria:   { source: "x", threshold: "y", edge: "z" }
seal:       { level: L0, hash: "sha256:deadbeefdeadbeef…", statement_rev: "sha256:deadbeefdeadbeef…", nonce: "aaaaaaaaaaaa" }

## Settlement
- 2099-01-01T00:00Z  outcome: partial · observed: "half of it happened"
