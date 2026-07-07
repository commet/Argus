# Argus docs

This folder holds design notes, architecture records, and product thinking
accumulated while building Argus. It is **provenance, not polished
documentation** — most files are dated and capture the reasoning at a moment in
time. This index points you at the parts still worth reading.

## Start here

- **[`/README.md`](../README.md)** — what Argus is and how to run it.
- **[`/CONTRIBUTING.md`](../CONTRIBUTING.md)** — repo layout, local setup, and the
  conventions reviewers check.
- **[`/CLAUDE.md`](../CLAUDE.md)** — the working development guidelines
  (schema-sync, prompt single-source-of-truth, the "fail loud, never fabricate"
  invariant). Required reading before a non-trivial change.

## Architecture & design (current)

These describe how the system is meant to work, not a specific past session:

- `AGENT_SYSTEM.md` — the agent/crew model.
- `AGENT-ARCHITECTURE-FOUNDATIONAL-2026-07-05.md` — the foundational
  agent-architecture audit that `CLAUDE.md`'s LLM-glue invariant is drawn from.
- `ARGUS-FINAL-DIRECTION.md` — the zero-judgment product direction.
- `FRAMEWORK-decision-navigation.md` — the decision-navigation framework.
- `VERIFICATION-PROTOCOL.md` — how claims get verified against reality.
- `ARGUS-REPO-MAP.md` — a repo map (may lag the tree; treat `CONTRIBUTING.md` as
  authoritative for layout).
- `CONTEXT.md`, `CONTEXT_v2.md`, `Argus_Product_Philosophy_v2.md` — longer-form
  product context and philosophy.

## Historical records

Everything dated (`*-2026-*`), plus the `STRESS-*`, `ESSAY-*`, `MASTER-DIRECTION-*`,
and `EXECUTION-PLAN-*` families, and the `archive/` subfolder, are **kept for
provenance**. They record how a decision was reached and are not maintained as
current documentation. Read them for the "why", not the "how it works today".
