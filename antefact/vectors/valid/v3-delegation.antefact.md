---
antefact: 0.1
id: 018f0000-0000-7000-8000-000000000003
authors: [{h: "Seojin Kim"}]
state: recorded
policy_ref: policies/refund-auto-approve-v2.md
---

# Delegated — refunds under ₩30,000 auto-approved

## Statement
- P1 (ai←h) [inference·moderate] This request matches the auto-approval policy conditions

## Stake
claim:      Weekly refund complaint rate stays under 1% while the policy runs
p:          { raw: "0.7", mode: direct, canonical: 0.7, granularity: 0.1 }
settle_by:  2099-12-01T00:00Z
settled_by: [h:Seojin Kim]
criteria:   { source: "CS dashboard weekly export", threshold: "1%", edge: "annul if policy is revoked mid-week" }

## Settlement
