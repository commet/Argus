# ADR 2026-07-14 · Total architecture direction (MCP / plugin / surfaces)

Status: direction agreed with founder. Captures the target shape and the
orchestration-vs-spine decision. Not a build plan — a compass.

## The question that forced this

The plugin and MCP drifted (nautical jargon vs plain verbs) because they are
separate implementations, not one core with thin adapters. Fixing the words is
a surface patch; the real question is the target architecture — and a deeper
one the founder raised: **should "smart orchestration" be pushed into the MCP's
host instructions so it reaches every app (desktop/mobile/Codex), or does that
violate Argus's own spine?**

## Target shape (the stable total system)

Four layers, top rule: **discipline is deterministic and universal; smart
generation is LLM and degrades gracefully.**

```
L1 · CORE (the discipline) — DETERMINISTIC, no LLM
     ledger, seal/settle rules, the over-fire (restraint) gate as a function of
     declared stakes/reversibility, honest receipt, validation. This IS the
     spine made mechanical. Today: argus-mcp is exactly this (verified: it calls
     no LLM; it is pure data+rules).

L2 · MCP ADAPTER — universal
     exposes L1 as tools to ANY MCP host + carries the spine bias in the
     `instructions` field. Works in Claude Code, Claude desktop, Claude mobile,
     Codex — everywhere.

L3 · SURFACE ADAPTERS — thin, over L1/L2
     web app, Telegram bot, Claude Code plugin. Should all read/write the ONE
     core, not reimplement it. Today: they share the ledger FILE
     (.argus/ledger/ledger.jsonl) but the plugin has its own separate CODE —
     that is the drift source.

L4 · ORCHESTRATION — premium, host-varying
     the multi-step flow (clarify → review → one crux) and the parallel
     multi-agent crew. Best in Claude Code (that is what the plugin's `sail` is).
     Multi-AGENT is a Claude Code capability; it cannot be fully replicated in
     desktop/mobile.
```

## The decision: does orchestration-via-instructions fit the spine?

**Split the question by what is load-bearing.**

- **Discipline (seal must be falsifiable, settle can't fabricate an outcome, a
  resolution never auto-closes, restraint on flat/reversible cases, no verdict):
  this must NEVER depend on a host obeying prose.** Per the Honest-Structure
  rule ("don't put the LLM on the hot path as orchestrator; wiring must be
  deterministic and testable"), the discipline stays as **deterministic guards
  in the L1 tools**. A dumb host that just calls the tools still gets the
  discipline. This is already true and must stay true.

- **Smart generation (reframing the question, surfacing one crux, drafting a
  prediction): this is "maximum generation, zero judgment" — fine to be
  host-orchestrated and instruction-guided**, BECAUSE the L1 tools still block
  the dangerous moves (no fabricated seal/settle/verdict). The instructions can
  bias any host toward restraint and the crux; safety does not rest on them.

So the answer: **instructions help — but only for generation/reach, never as the
carrier of the discipline.** Concretely:
- YES, invest in the MCP `instructions` so desktop/mobile/Codex orchestrate the
  Argus flow decently. That extends reach and fits "zero judgment."
- NO, do not move any load-bearing guard into instructions. The over-fire gate,
  falsifiability check, no-auto-close, provenance — stay deterministic in L1.
- WATCH over-fire: prose telling every host "surface a crux / run a review" will
  over-fire on flat cases (a mirror-clause violation) on hosts that apply it
  bluntly. So the *restraint gate* in particular must stay a deterministic
  function of declared stakes/reversibility (it already is in
  `argus_open_decision`), and instructions should say "call the gate," not
  "decide whether to intervene yourself."

## Service-direction implication (the important part)

**Argus's moat is the discipline, not the orchestration.** The falsifiable
prediction → seal → settle-against-reality → zero judgment → honest receipt is
what no fresh prompt can replicate, and it is deterministic and universal (L1).
The multi-agent orchestration is a Claude-Code nicety.

Therefore: **bet the product on the discipline being everywhere (L1 via the MCP),
and treat rich orchestration as a premium layer that is best in Claude Code and
degrades gracefully elsewhere.** Do not make the core value depend on a
Claude-Code-only capability.

## Current state vs target (honest)

- L1 core: **argus-mcp already is a clean deterministic core** (no LLM). Closest
  to target. ✓
- Shared data: MCP + plugin write the **same** `.argus/ledger/ledger.jsonl`. ✓ (data)
- Gap: the **plugin reimplements** L1 in its own code + jargon instead of calling
  it; the **web app** keeps its own (Supabase) ledger. So "one core, thin
  adapters" is only half-real.

## Path (incremental, no big-bang)

1. **Now — stop the bleeding:** unify the plugin's user-facing vocabulary to the
   MCP's plain canon (predict/resolve/premise/patterns/decision/crux…). Surface
   fix, immediate clarity. (Spec: `argus-plugin-v2/DEJARGON-AND-FRICTION-PLAN.md`.)
2. **Next — pull the plugin onto the core:** the plugin bundles argus-mcp and its
   skills call the MCP tools for seal/settle/ledger instead of hand-writing them.
   Terminology then can't drift by construction. `sail` stays as L4 orchestration
   but orchestrates by calling L1 tools.
3. **Then — invest the MCP `instructions`** so non-Claude-Code hosts orchestrate
   the flow decently, keeping every load-bearing guard deterministic in L1.
4. Keep the multi-agent crew as the Claude-Code premium; don't pretend it is
   universal.

The through-line: **one deterministic disciplined core, many thin adapters, smart
orchestration as a graceful premium — and the spine (discipline) never rides on a
host obeying instructions.**
