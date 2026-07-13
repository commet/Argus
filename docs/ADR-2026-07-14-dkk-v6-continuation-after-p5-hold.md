# ADR — v6 continuation after the P5 value gate hold

Date: 2026-07-14
Status: Accepted

## Decision

The factual P5 result remains **HOLD**. There is still no completed real-pilot
or baseline comparison in the local evidence, so this ADR does not claim a P5
GO, value improvement, or permission to market the system as validated.

The user explicitly authorized the implementation of the remaining v6 work in
this task. We will therefore continue P6 and P7 as a structural, conformance,
and dogfood-readiness implementation. Each surface must continue to disclose
that real-value evidence is absent until P5 is actually rerun.

`docs/DESIGN-decision-knowledge-kernel-v6-final-2026-07-14.md` is the sole
normative implementation authority for this work. `docs/ARGUS-BLUEPRINT.md`
is explicitly excluded from this execution path and is not edited by it.

## Consequences

- P6/P7 may add canonical ledgers, command gateways, projections, fixtures,
  and migration paths.
- They may not convert a HOLD into a GO, fabricate a pilot, or infer external
  user authorization from a system event.
- A resolution remains non-terminal until its separate human-authorized close.
- Any discovered normative conflict is recorded in a follow-up ADR with its
  fixture and migration impact.
