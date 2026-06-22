# R40 — Crew resolved (no surviving edge); campaign's two core questions CLOSED

> 2026-06-20. Final crew-resolution round + routing certification. A''' = a
> VERIFY-FIRST single pass (reads the real `src/` before any current-state claim)
> vs crew B on 3 repo-grounded decisions with REAL ground truth in this codebase;
> + 4 overkill + 4 heavy controls on a fixed single-judge harness. ~39 agents.

## Crew: no surviving architectural edge (safe to retire as default)

- **`crew_still_has_groundtruth_edge = 0/3`** — in zero cases did the crew B win
  via anything UNIQUE to a multi-agent architecture. rgt-1: B's "extra" was
  correcting its OWN workers' miscounts (errors A''' never made) — zero gap-fill.
  rgt-3: B's enrichment wasn't a correction, and A''' uniquely live-verified the
  0-row premise B admitted it couldn't. rgt-2: B won, but its win is a DISCIPLINE
  property (quarantine unverifiable external state) that verify-first is *defined*
  to perform — not an architecture.
- **A''' verified-ok 2/3, confabulated 1/3** (rgt-2: asserted a Supabase dashboard
  provider-switch as settled fact). The residual collapses to ONE nameable,
  prompt-fixable class: **asserting unverifiable EXTERNAL state (runtime / dashboard
  / live-provider / third-party-config) as fact.** The crew has no edge a hardened
  single pass can't hold.

## Routing: over-fire 0/4, false-skip 0/4, 8/8 correct (certified by repetition)

The fixed single-judge harness (R39's dual-scoring inconsistency removed) returned
0 over-fire and 0 false-skip. But per-bucket n=4 is under-powered (rule-of-three
95% upper bound on 0/4 ≈ 75%): the gate is **certified to ship by the cumulative
record** (Nth consecutive clean round across ~190+ stress cases), NOT by this
round's power. **Only live traffic can bound the rate tightly** — crafted fixtures
have hit their ceiling here.

## Shipped (both surfaces, prose) — the one durable lesson

**Generalized the honesty guard from "invented current state" to "asserted
unverifiable external state."** Runtime/dashboard/live-provider/third-party-config
settings are NOT knowable from the problem text or a static repo read → tag as
inference (`unverifiable-external`), NEVER assert as settled fact, build no verdict
resting on it. Plus, for the plugin (which HAS repo access): **verify-first** —
read the relevant code before asserting current state (the one place a single pass
matches a crew). Guard `breadth-checklist.test.ts` → 10 (pins the
unverifiable-external class on both surfaces, adjacent to the R39 Stripe-DPA pin).
Full suite green (91 files / 1369). tsc clean.

## Founder decision — teed up with strong evidence (not executed)

**Retire the crew from the DEFAULT path; keep its code dormant/opt-in.**
- Make verify-first single pass the default (it reads `src/` before current-state
  claims — where 2/3 of the value lives and the crew added nothing). This is a
  routing/orchestration change = your call.
- Keep `team` code as opt-in escalation for the narrow class where A''' confabulated
  (external-state-dependent decisions) — reversible belt-and-suspenders. **Do NOT
  hard-delete yet** (n=3 residual is too thin to make retirement irreversible);
  delete after one real-data cycle confirms the single pass's confabulation rate at
  volume. Confidence: HIGH that the crew is not NEEDED; MEDIUM on the exact residual
  confab rate (1/3 at n=3 is a wide estimate).

## Campaign milestone — the two core questions are CLOSED

This campaign (R28–R40) was built to answer two questions; both are now resolved:
- **(A) Architecture** — crew vs single pass: the crew has no surviving unique edge.
- **(B) Fire-or-not gate** — over-fire ~0, false-skip ~0 (directionally, across
  rounds 5–8 + R40).

**Crafted-fixture simulation has hit its ceiling on both.** Self-scored sim in one
model family structurally CANNOT (i) bound a low error rate to a tight CI,
(ii) test seal→settle across real elapsed time vs a real outcome, or (iii) measure
whether real users PERCEIVE the bare-crux question as a verdict (the irreducible
`value∝leverage∝tilt` residual is a human-perception question). Three rounds (R33,
R38, R40) now independently hit this ceiling. The binding constraint is no longer
the engine (GREEN) but the front door (RED — 0 sealed contracts; per the
finish-line probe).

## Next — R41

The ONE behavioral surface crafted fixtures can still illuminate that the campaign
never touched: **longitudinal seal→settle correctness with synthetic time
advancement** — does a wrong sealed premise actually get CAUGHT against reality at
settlement, or does the loop rubber-stamp it? After that, crafted-fixture sim is
genuinely exhausted; the remaining levers (rate/perception/time, real confab rate,
the crew hard-delete) are all gated on real-user data + the front door.
