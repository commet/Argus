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
seal:       { level: L0, hash: "sha256:88a8a6de5f425a6cda3501ccd059b2a3a940404f496a684d7cbf3e05e77e4eaa", statement_rev: "sha256:8031ca28d26b151812555e459e9f3f6d1837e1a563f2d0bd41eb43ca5911f357", nonce: "aaaaaaaaaaaa", proj: v1 }

## Settlement
- 2099-01-01T00:00Z  outcome: partial · by: h:Dana Park · observed: "half of it happened"
