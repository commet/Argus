export const meta = {
  name: 'argus-synthesis-v2',
  description: 'Final meta-synthesis over ALL FOUR prior workflows (diagnosis A, blindspot B, incremental target C, radical re-think D) → one master direction that resolves the incremental-vs-radical decision and sequences the path',
  whenToUse: 'Run LAST, after all four directional workflows finish; supersedes the 3-input argus-synthesis script',
  phases: [
    { title: 'Ingest', detail: '4 parallel readers distill each prior workflow output into a tight structured digest' },
    { title: 'Reconcile', detail: '3 cross-cuts: incremental-vs-radical decision, dependency/sequencing spine, conflicts & dropped items' },
    { title: 'Synthesize', detail: 'one integrator writes the single master direction (north-star + sequenced plan + the C-vs-D verdict)' },
    { title: 'Critique', detail: 'adversarial completeness + internal-consistency pass' },
  ],
}

const REPO = String.raw`C:\Users\SAMSUNG\documents\github\commet\Argus`

const SOURCES = {
  A_deepPlan: `${REPO}\\docs\\argus-deep-plan-result.json`,        // {audits[8], research[3], plan, critique}
  B_blindspot: `${REPO}\\docs\\argus-blindspot-result.json`,       // {journeys, adversary, surface, addendum, metaCritique}
  C_targetState: `${REPO}\\docs\\argus-target-state-result.json`,  // {designed[5], vision}
  D_radical: `${REPO}\\docs\\argus-radical-rethink-result.json`,   // {concepts, judged, ranking, radicalDirection, redteam}
}

const CONTEXT = `
You are the FINAL meta-synthesis for ARGUS (Next.js 16 + TS + Zustand + Supabase; repo ${REPO}).

FOUR prior workflows ran; outputs saved as JSON in docs/:
  A) DEEP-PLAN — domain problem audit + research + sequenced improvement plan + self-critique (admits some inherited numbers are FABRICATED/STALE). ${SOURCES.A_deepPlan}
  B) BLINDSPOT — persona journeys, premortem, competitive teardown, under-audited surfaces, meta-critique ("code SAYS vs PRODUCTION does" gap; P0 no execution instrumentation; output→retention unproven). ${SOURCES.B_blindspot}
  C) TARGET-STATE — INCREMENTAL forward design that EXTENDS the voyage DNA (onboarding ceremony, focused-linear flow, editorial design system, "Mirror" retention). ${SOURCES.C_targetState}
  D) RADICAL-RETHINK — RADICAL alternatives that QUESTION the DNA (e.g. process-as-product, execution-bound harness, compounding judgment model, radical simplification, multiplayer room, agent-native) + a judged tournament + an incrementalism red-team with a pure/hybrid/radical recommendation. ${SOURCES.D_radical}

THE CENTRAL JOB: A and B say what's broken and in what order. C and D are TWO COMPETING FORWARD DIRECTIONS — incremental polish vs radical reshape. Your master direction must (1) resolve the C-vs-D decision honestly (pure-incremental / hybrid / radical, and exactly which radical grafts to take), (2) rest every forward move on the foundation fixes its dependencies require (P0 timeout + null-derefs, chassis decomposition, Phase 0 typed/persisted pipeline), and (3) refuse to inherit the fabricated/stale claims A flagged. Not a concatenation — a single sequenced decision.

WHAT ARGUS IS: a "decision harness" before AI execution. Tagline "Think before you recast." Target user: non-developer strategists deciding WHAT to have AI do; real competitor "just ask ChatGPT". Strong assets to preserve: llm.ts engine, Phase 1/2 content intelligence, the 1004-test net. Weak: chassis (ProgressiveFlow 2670 / store 1786), Phase 0 pipeline, orphaned markdown outputs, one-way learning loop, no execution instrumentation.

RULES: READ-ONLY. Concrete (file:line / artifact / which prior finding). When sources conflict or one is stale, name it and pick the verified version. Sequenced, dependency-respecting plan over a wish list.`

const DIGEST_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['source', 'thesis', 'must_carry', 'forward_posture', 'weak_or_unverified'],
  properties: {
    source: { type: 'string' },
    thesis: { type: 'string' },
    must_carry: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['item', 'weight', 'evidence'],
        properties: { item: { type: 'string' }, weight: { type: 'string' }, evidence: { type: 'string' } },
      },
    },
    forward_posture: { type: 'string', description: 'for C/D: what future it argues for; for A/B: "diagnosis only" or any forward implication' },
    weak_or_unverified: { type: 'array', items: { type: 'string' } },
  },
}

const RECONCILE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['lens', 'findings'],
  properties: {
    lens: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'detail', 'decision'],
        properties: {
          title: { type: 'string' },
          detail: { type: 'string', description: 'cite which of A/B/C/D it spans + evidence' },
          decision: { type: 'string', description: 'the concrete call the master direction should make' },
        },
      },
    },
  },
}

const CRITIQUE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['overall_verdict', 'internal_contradictions', 'sequencing_problems', 'dropped_on_the_floor', 'inherited_stale_claims', 'concrete_additions'],
  properties: {
    overall_verdict: { type: 'string' },
    internal_contradictions: { type: 'array', items: { type: 'string' } },
    sequencing_problems: { type: 'array', items: { type: 'string' } },
    dropped_on_the_floor: { type: 'array', items: { type: 'string' } },
    inherited_stale_claims: { type: 'array', items: { type: 'string' } },
    concrete_additions: { type: 'array', items: { type: 'string' } },
  },
}

// ---- Phase 1: Ingest ----
phase('Ingest')
const ingestSpecs = [
  { key: 'A', label: 'ingest:deep-plan', file: SOURCES.A_deepPlan, note: 'Diagnosis. must_carry = real P0/P1 fixes + foundation keystones. weak_or_unverified = the fabricated/stale numbers its own critique flagged.' },
  { key: 'B', label: 'ingest:blindspot', file: SOURCES.B_blindspot, note: 'Orthogonal diagnosis. must_carry = cross-cutting P0s (instrumentation, retention gap, 5 moments invisible) + the cheap high-signal probes.' },
  { key: 'C', label: 'ingest:target-state', file: SOURCES.C_targetState, note: 'INCREMENTAL forward design. forward_posture = the incremental north-star; must_carry = the committed per-surface target states + design-system spine.' },
  { key: 'D', label: 'ingest:radical', file: SOURCES.D_radical, note: 'RADICAL forward options. forward_posture = the winning radical bet + the red-team recommendation (pure/hybrid/radical). must_carry = the radical grafts worth taking regardless.' },
]

const digests = (await parallel(ingestSpecs.map(s => () =>
  agent(
    `${CONTEXT}\n\nRead ${s.file} (Read tool; large — read fully). ${s.note}\n\nReturn a tight structured digest, ruthless about genuine must-carry vs nice-to-have, with concrete evidence. Source label "${s.key}".`,
    { label: s.label, phase: 'Ingest', schema: DIGEST_SCHEMA }
  )
))).filter(Boolean)

const digestBlock = JSON.stringify(digests, null, 2)

// ---- Phase 2: Reconcile ----
phase('Reconcile')
const lenses = [
  { lens: 'incremental-vs-radical-decision', ask: 'THE key call. Weigh C (incremental, extends DNA, low risk, builds on a working 1004-test product) against D (radical reshape + its own red-team). For a "go slowly, do it right" owner: pure-incremental, hybrid, or radical? Decide, and list EXACTLY which radical grafts from D to fold into the path now and which to defer/reject — each with the bar it must clear.' },
  { lens: 'dependency-and-sequencing-spine', ask: 'Build the dependency spine: the foundation fixes (request timeout, null-derefs, ProgressiveFlow/store decomposition, Phase 0 typed+persisted pipeline, execution instrumentation) that ANY forward direction (C or D or hybrid) must rest on. Produce the correct delivery order so nothing is built on sand; each layer = what it unlocks.' },
  { lens: 'conflicts-gaps-and-orphans', ask: 'Where do the four conflict or drop things? Which A/B P0s does C ignore? Which D ambitions has the diagnosis no path to? What falls between all four? Flag anything that would be silently lost in a naive merge, and any stale/fabricated claim that must NOT be inherited.' },
]

const reconciled = (await parallel(lenses.map(l => () =>
  agent(
    `${CONTEXT}\n\nFour distilled digests (A=deep-plan, B=blindspot, C=incremental target, D=radical):\n\n${digestBlock}\n\nLENS: ${l.lens}.\n${l.ask}\n\nConcrete, cite which sources each finding spans. Every finding ends in a concrete decision.`,
    { label: `reconcile:${l.lens}`, phase: 'Reconcile', schema: RECONCILE_SCHEMA }
  )
))).filter(Boolean)

const reconcileBlock = JSON.stringify(reconciled, null, 2)

// ---- Phase 3: Synthesize ----
phase('Synthesize')
const masterDirection = await agent(
  `${CONTEXT}\n\nFour digests + three reconciliation cross-cuts:\n\n=== DIGESTS ===\n${digestBlock}\n\n=== RECONCILIATION ===\n${reconcileBlock}\n\nWrite THE MASTER DIRECTION (Markdown), the single source of truth that supersedes docs/PLAN.md:\n1. **North-star** (2-3 paragraphs) — where Argus is going, fusing the forward verdict (the C-vs-D decision) with the reality of the diagnosis.\n2. **The incremental-vs-radical verdict** — explicit: pure-incremental / hybrid / radical, WHY, and the exact list of radical grafts taken now vs deferred vs rejected.\n3. **The sequenced master plan** — layered delivery respecting the dependency spine: stop-the-bleeding (P0/P1) → chassis decomposition + Phase 0 typed/persisted pipeline + instrumentation → forward surfaces (the chosen blend of C and D). Each layer: goal, the A/B/C/D findings it integrates (cite + file:line), acceptance criteria.\n4. **Cheap validation probes first** — the B probes (telemetry reconciliation, 5-user test, retention cohort) to run before betting big.\n5. **Design-system spine** — shared tokens from C (with the EASE/ease-spring fix noted).\n6. **What we deliberately are NOT doing.**\n7. **Do-not-inherit list** — stale/fabricated claims this plan refuses to carry.\nSpecific and buildable; concrete file/component/token refs over principles.`,
  { label: 'master-direction', phase: 'Synthesize' }
)

// ---- Phase 4: Critique ----
phase('Critique')
const critique = await agent(
  `${CONTEXT}\n\nProposed MASTER DIRECTION:\n${masterDirection}\n\nSource digests' must_carry:\n${digestBlock}\n\nAdversarially audit: (a) internal contradictions / building on sand, (b) any must_carry from A/B/C/D silently dropped, (c) forward targets with no foundation path, (d) the C-vs-D verdict — is it actually justified or hand-wavy, (e) any stale/fabricated claim re-inherited, (f) altitude — actionable enough? Structured findings + concrete additions.`,
  { label: 'synthesis-critic', phase: 'Critique', schema: CRITIQUE_SCHEMA }
)

return { digests, reconciled, masterDirection, critique }
