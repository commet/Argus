export const meta = {
  name: 'argus-synthesis',
  description: 'Fourth/meta workflow — integrate the three prior directional workflows (deep-plan diagnosis, blindspot sweep, target-state design) into ONE coherent, sequenced master direction for Argus',
  whenToUse: 'Run AFTER the three diagnostic/design workflows finish; it consumes their saved JSON outputs and reconciles them into a single north-star + delivery sequence',
  phases: [
    { title: 'Ingest', detail: '3 parallel readers distill each prior workflow output into a tight structured digest' },
    { title: 'Reconcile', detail: '3 orthogonal cross-cuts: conflicts/tensions, dependency & sequencing spine, coverage gaps' },
    { title: 'Synthesize', detail: 'one integrator fuses everything into a single sequenced master direction' },
    { title: 'Critique', detail: 'adversarial completeness + internal-consistency pass on the master direction' },
  ],
}

const REPO = String.raw`C:\Users\SAMSUNG\documents\github\commet\Argus`

// The three prior workflow outputs, saved as JSON next to this plan.
// (deep-plan exists; blindspot/target-state are written on their completion.)
const SOURCES = {
  deepPlan: `${REPO}\\docs\\argus-deep-plan-result.json`,       // {audits[8], research[3], plan(str), critique{}}
  blindspot: `${REPO}\\docs\\argus-blindspot-result.json`,      // {journeys, adversary, surface, addendum, metaCritique}
  targetState: `${REPO}\\docs\\argus-target-state-result.json`, // {designed, vision}
}

const CONTEXT = `
You are doing the META-SYNTHESIS for ARGUS (Next.js 16 + TS + Zustand + Supabase; repo ${REPO}).

THREE prior workflows already ran and produced read-only outputs:
  A) DEEP-PLAN  — domain-sliced problem audit + external research + a sequenced improvement plan + adversarial critique. (the "what's broken, in order" diagnosis)
  B) BLINDSPOT-SWEEP — orthogonal lens: persona journeys, product-thesis premortem/competitive teardown/prompt-quality, under-audited surfaces, and a meta-critique of what is STILL invisible. (the "what a domain audit structurally misses" diagnosis)
  C) TARGET-STATE — generative design studio: per-surface should-be concepts, judged and synthesized into a concrete forward north-star vision + design-system spine + build mapping. (the "what it should BECOME" forward design)

YOUR JOB: fuse A+B+C into ONE coherent master direction — not a concatenation. Diagnosis (A,B) says what's wrong and in what order; design (C) says where we're going. The master direction must make those agree: every forward target must rest on the foundation fixes its dependencies require, every P0 crash/risk must be honored before polish, and conflicts between "fix the sand first" and "ship the beautiful target" must be explicitly resolved with a sequencing decision.

WHAT ARGUS IS (for grounding): a "decision harness" sitting BEFORE AI execution. Tagline "Think before you recast." Voyage metaphor reframe→recast→rehearse→refine→이타카(4 outputs). Target user: non-developer strategists deciding WHAT to have AI do. Design DNA: "동틀 녘의 항구" — warm ivory/navy/gold, editorial typography, generous whitespace, slow spring motion; avoid generic AI-dashboard.

GROUND TRUTH already established by the prior runs (do not re-derive): Tests 1004 pass, build OK. Engine (llm.ts) and Phase 1/2 content intelligence are strong. The chassis is the problem: ProgressiveFlow.tsx ~2670 lines + useProgressiveStore ~1786 lines conflate everything; Phase 0 context pipeline unpersisted/no provenance; outputs are orphaned static markdown; learning loop is one-way; onboarding reactive-only; design drifts from intent (tech-blue leak). P0 = no request-level LLM timeout (infinite spinner) + 3 confirmed null-deref crashes.

RULES: READ-ONLY. Be concrete (cite file:line and the specific prior finding you're integrating). When sources conflict or one is stale/fabricated (the deep-plan critique already flagged some fabricated quantities), say so and pick the verified version. Prefer a sequenced, dependency-respecting plan over a wish list.`

const DIGEST_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['source', 'thesis', 'must_carry', 'strongest_claims', 'weak_or_unverified'],
  properties: {
    source: { type: 'string' },
    thesis: { type: 'string', description: 'the one-paragraph core of what this workflow concluded' },
    must_carry: {
      type: 'array', description: 'the non-negotiable items this source contributes to the master direction',
      items: {
        type: 'object', additionalProperties: false,
        required: ['item', 'severity_or_priority', 'evidence'],
        properties: {
          item: { type: 'string' },
          severity_or_priority: { type: 'string' },
          evidence: { type: 'string', description: 'file:line, URL, or concrete artifact' },
        },
      },
    },
    strongest_claims: { type: 'array', items: { type: 'string' } },
    weak_or_unverified: { type: 'array', items: { type: 'string' }, description: 'claims this source makes that are stale/fabricated/unproven — flagged so synthesis does not inherit them' },
  },
}

const RECONCILE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['lens', 'findings'],
  properties: {
    lens: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['title', 'detail', 'resolution'],
        properties: {
          title: { type: 'string' },
          detail: { type: 'string', description: 'the conflict / dependency / gap, citing which sources it spans' },
          resolution: { type: 'string', description: 'the concrete decision the master direction should take' },
        },
      },
    },
  },
}

const CRITIQUE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['overall_verdict', 'internal_contradictions', 'sequencing_problems', 'dropped_on_the_floor', 'concrete_additions'],
  properties: {
    overall_verdict: { type: 'string' },
    internal_contradictions: { type: 'array', items: { type: 'string' } },
    sequencing_problems: { type: 'array', items: { type: 'string' } },
    dropped_on_the_floor: { type: 'array', items: { type: 'string' }, description: 'must_carry items from any source that the master direction silently lost' },
    concrete_additions: { type: 'array', items: { type: 'string' } },
  },
}

// ---- Phase 1: Ingest — distill each prior output (agents Read the saved JSON) ----
phase('Ingest')
const ingestSpecs = [
  { key: 'A', label: 'ingest:deep-plan', file: SOURCES.deepPlan,
    note: 'Distill the DOMAIN AUDIT + research + plan + critique. The critique field already flags fabricated/stale quantities — surface those in weak_or_unverified so we do not inherit them.' },
  { key: 'B', label: 'ingest:blindspot', file: SOURCES.blindspot,
    note: 'Distill the ORTHOGONAL sweep: journeys, adversary (premortem/competitive/prompt-quality), surfaces, and the meta-critique of what is still invisible.' },
  { key: 'C', label: 'ingest:target-state', file: SOURCES.targetState,
    note: 'Distill the FORWARD design: per-surface chosen directions, the design-system spine, the vision, and the build mapping. must_carry = the target states we are committing to.' },
]

const digests = (await parallel(ingestSpecs.map(s => () =>
  agent(
    `${CONTEXT}\n\nRead the file ${s.file} (use the Read tool; it is large — read it fully, in chunks if needed). ${s.note}\n\nReturn a tight structured digest. Be ruthless about what is genuinely MUST-CARRY vs nice-to-have. Cite concrete evidence (file:line / URL / artifact name) for each must_carry item. Source label: "${s.key}".`,
    { label: s.label, phase: 'Ingest', schema: DIGEST_SCHEMA }
  )
))).filter(Boolean)

const digestBlock = JSON.stringify(digests, null, 2)

// ---- Phase 2: Reconcile — 3 orthogonal cross-cuts over the digests ----
phase('Reconcile')
const lenses = [
  { lens: 'conflicts-and-tensions',
    ask: 'Where do the three sources CONFLICT or pull in different directions? (e.g. target-state wants a beautiful new onboarding ceremony while the diagnosis says the chassis under it is sand; or A and B disagree on severity; or a forward design depends on a Phase that the audit says is unfinished.) For each, give the resolution the master direction should adopt.' },
  { lens: 'dependency-and-sequencing-spine',
    ask: 'Build the DEPENDENCY SPINE. What are the true foundation fixes (request timeout, null-deref crashes, ProgressiveFlow/store decomposition, Phase 0 typed+persisted pipeline) that everything else — every target-state surface, every learning/output feature — must rest on? Produce the correct delivery ORDER so nothing is built on sand. Each finding = a layer with what unlocks once it lands.' },
  { lens: 'coverage-gaps-and-orphans',
    ask: 'What does each source MISS that another catches, and what falls between all three? Specifically: which P0/P1 diagnosis items does the target-state vision ignore, and which target-state ambitions has the diagnosis given no path to? Flag anything that would be silently dropped if we just merged the plans.' },
]

const reconciled = (await parallel(lenses.map(l => () =>
  agent(
    `${CONTEXT}\n\nHere are the three distilled digests (A=deep-plan, B=blindspot, C=target-state):\n\n${digestBlock}\n\nLENS: ${l.lens}.\n${l.ask}\n\nBe concrete, cite which sources each finding spans and the specific items/evidence. Every finding MUST end in a concrete resolution/decision.`,
    { label: `reconcile:${l.lens}`, phase: 'Reconcile', schema: RECONCILE_SCHEMA }
  )
))).filter(Boolean)

const reconcileBlock = JSON.stringify(reconciled, null, 2)

// ---- Phase 3: Synthesize — one integrator writes the master direction ----
phase('Synthesize')
const masterDirection = await agent(
  `${CONTEXT}\n\nYou have (1) three digests and (2) three reconciliation cross-cuts:\n\n=== DIGESTS ===\n${digestBlock}\n\n=== RECONCILIATION ===\n${reconcileBlock}\n\nWrite THE MASTER DIRECTION for Argus as a single coherent document (Markdown). It must:\n1. **One honest north-star** — where Argus is going, in 2-3 paragraphs, fusing the forward vision (C) with the reality of the diagnosis (A,B).\n2. **The sequenced master plan** — phased/layered delivery order that respects the dependency spine: stop-the-bleeding P0/P1 → chassis decomposition + Phase 0 typed/persisted pipeline → then the target-state surfaces (onboarding ceremony, output revolution, learning loop, design-system unification), each explicitly resting on the foundation it needs. For each layer: goal, the prior findings it integrates (cite A/B/C + file:line), and acceptance criteria.\n3. **Conflicts resolved** — the explicit decisions taken where sources disagreed.\n4. **Design-system spine** — the shared tokens (color/type/spacing/motion) all surfaces inherit, from C.\n5. **What we are deliberately NOT doing** — scope discipline for a "go slowly, do it right" owner.\n6. **Do-not-inherit list** — the stale/fabricated claims flagged in weak_or_unverified that this plan refuses to carry.\n\nThis supersedes/extends docs/PLAN.md as the single source of truth. Be specific and buildable; prefer concrete file/component/token references over principles.`,
  { label: 'master-direction', phase: 'Synthesize' }
)

// ---- Phase 4: Critique — adversarial completeness + consistency ----
phase('Critique')
const critique = await agent(
  `${CONTEXT}\n\nHere is the proposed MASTER DIRECTION:\n\n${masterDirection}\n\nFor reference, the source digests' must_carry items:\n${digestBlock}\n\nAdversarially audit the master direction. Check: (a) internal contradictions or sequencing that builds on sand, (b) any must_carry item from A/B/C silently dropped, (c) forward targets with no foundation path, (d) any stale/fabricated claim it accidentally re-inherited, (e) altitude — is it specific enough to act on? Return structured findings with concrete additions.`,
  { label: 'synthesis-critic', phase: 'Critique', schema: CRITIQUE_SCHEMA }
)

return { digests, reconciled, masterDirection, critique }
