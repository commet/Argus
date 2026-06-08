export const meta = {
  name: 'argus-worker-stage-redesign',
  description: 'Generative design studio for the worker (agent) stage — competing redesigns for the sidebar↔review connection, per-agent status system, the deploy "set sail" ceremony, and the light pre-scout surfacing; judged and synthesized into one concrete buildable spec',
  whenToUse: 'After agreeing the direction (keep deploy gate + one-at-a-time review; add pre-scout, rich sidebar states, and a professional sidebar↔body connection)',
  phases: [
    { title: 'Survey', detail: 'one agent reads the real worker-stage code + design tokens → a tight ground-truth digest' },
    { title: 'Concepts', detail: '5 divergent, professional, buildable design concepts generated in parallel' },
    { title: 'Judge', detail: 'each concept scored by 3 lenses (craft / connectedness-clarity / DNA+buildability)' },
    { title: 'Synthesize', detail: 'integrate the winner + best grafts into ONE concrete redesign spec (tokens, components, states, motion, file:line)' },
    { title: 'Critique', detail: 'adversarial — is it actually professional (not crude), buildable, and does the connection read as one team?' },
  ],
}

const REPO = String.raw`C:\Users\SAMSUNG\documents\github\commet\Argus`

const CONTEXT = `
You are in a DESIGN STUDIO redesigning the WORKER (agent) STAGE of ARGUS (Next.js 16 + TS + Tailwind v4 + Zustand + framer-motion). Repo: ${REPO}. READ the real components before proposing — never assume (VERIFICATION-PROTOCOL: cite file:line you actually read).

WHAT ARGUS IS: a "decision harness" before AI execution. Voyage metaphor reframe→recast→rehearse→refine→이타카. Design DNA "동틀 녘의 항구": warm ivory/cream bg, deep navy/charcoal text, gold/amber accent, editorial/serif display type, generous whitespace, slow elegant spring motion. MUST look professional, expensive, intentional — explicitly NOT crude, NOT dumb-simple, NOT a generic AI dashboard. Tokens live in src/app/globals.css (e.g. --accent #96782e, --bp-ink navy, --font-display, --gradient-gold, --ease-spring/--ease-wave, shadow tokens); motion uses EASE from progressive/shared/constants.ts.

VERIFIED CURRENT FLOW (traced from source — build on this, don't re-derive):
  1. HeroFlow (workspace/page.tsx): idle→assembling→analyzing → runInitialAnalysis (ONE LLM call) → reframe + skeleton + first question. No agents yet.
  2. ProgressiveFlow "conversing" Q&A: as the user answers, an execution_plan emerges. When execution_plan.steps appear, ProgressiveFlow.tsx:~1386 calls store.initWorkers(steps) → orchestrator.planWorkers() ASSIGNS a persona/agent per step → workers created with status 'pending', worker_deploy_phase 'ready'. The sidebar (AgentSidebar, rendered prop-less at workspace/page.tsx:125 — reads session.workers from the store) now shows the assigned crew as pending/standby.
  3. DEPLOY GATE: the user clicks "팀 투입 / Skip & start" → onDeployWorkers (ProgressiveFlow.tsx:~1259) → store.deployWorkers() (status pending→running) → runAllAIWorkers/runPipeline (ProgressiveFlow.tsx:~1249) → each agent ACTUALLY executes its task now and streams a draft. Sidebar shows pending→running→done.
  4. REVIEW: deployPhase 'deployed' → an in-column ONE-AT-A-TIME stepper (ProgressiveFlow.tsx:~2086): clickable progress dots, "N명 남음", per-agent finding-first WorkerReportBlock with approve/reject/reassign/retry, slide transitions. This one-at-a-time design is intentional (replaced a 3-drafts-in-one-scroll burden) — KEEP it.
  5. mix → FinalCard.

KEY VERIFIED FACT: the sidebar (AgentSidebar) and the body review stepper read the SAME session.workers array — they are ALREADY connected in data; the problem is the connection is INVISIBLE/under-designed in the UI, and "assigned vs actually-working" is not legible.

AGREED DESIGN DECISIONS (the owner already chose — design WITHIN these):
  - Q1 PRE-SCOUT: after agents are assigned during Q&A, run a LIGHT preliminary pass (a short angle/sketch per agent — cheap, NOT the full task) so by deploy time each agent already shows a direction. Full execution happens AFTER deploy. "Light" is the whole point (token-frugal). Design how this surfaces in the sidebar.
  - Q2 DEPLOY GATE: KEEP it — the owner likes the "gather the crew and set sail (출항)" ceremony. Make it a genuine, beautiful moment, not a speed bump.
  - Q3 CONNECTION (the core ask): the sidebar should carry rich per-agent STATUS, and the physical sidebar↔body connection must be shown in a PROFESSIONAL, beautiful way — clicking an agent in the sidebar focuses its review card; the focused agent ↔ its card visually link; "one team, status↔action" must be unmistakable. NOT crude.
  - Q4 REVIEW: the one-at-a-time finding-first stepper stays.

THE PER-AGENT JOURNEY to express: assigned → (light) pre-scouting → ready/standby → [set sail] → working → done → awaiting-review → reviewed(approved/excluded). Map this to the real WorkerTask.status values (pending/ai_preparing/running/waiting_input/done/error + approved flag) — read AgentSidebar.tsx for the current status→label logic.

REAL FILES TO READ: src/components/workspace/progressive/ProgressiveFlow.tsx (worker stage ~1900-2200, deploy ~1259, AgentSidebar render), AgentSidebar.tsx, WorkerReportBlock (find it), WorkerPanel.tsx, WorkerCard.tsx, src/stores/useProgressiveStore.ts (initWorkers ~872, deployWorkers ~1000, worker lifecycle), src/app/globals.css (tokens), progressive/shared/constants.ts (EASE).

RULES: READ-ONLY design-on-paper. Proposals MUST be concrete and buildable on this exact stack, reuse existing components/tokens where possible (cite them), and be faithful to the voyage DNA. Prefer specific layout structure, token values, component APIs, motion specs, and textual/ASCII mockups over vague principles. Severity of polish matters: this must feel premium.`

// ── Phase 1: Survey ──
phase('Survey')
const SURVEY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['current_worker_stage', 'sidebar_today', 'review_today', 'status_states', 'available_design_tokens', 'connection_gap', 'reusable_assets'],
  properties: {
    current_worker_stage: { type: 'string', description: 'how the worker stage renders today, with file:line' },
    sidebar_today: { type: 'string', description: 'AgentSidebar: what it shows, its status→label logic, file:line' },
    review_today: { type: 'string', description: 'the one-at-a-time stepper: structure, dots, WorkerReportBlock, file:line' },
    status_states: { type: 'array', items: { type: 'string' }, description: 'the real WorkerTask.status values + approved flag, and what each means' },
    available_design_tokens: { type: 'array', items: { type: 'string' }, description: 'concrete tokens/motion to build with (color/type/space/shadow/ease), from globals.css/constants' },
    connection_gap: { type: 'string', description: 'precisely why the sidebar↔body connection is invisible today' },
    reusable_assets: { type: 'array', items: { type: 'string' }, description: 'existing components/utilities a redesign should reuse (cite)' },
  },
}
const survey = await agent(
  `${CONTEXT}\n\nSURVEY the current worker stage. Read the real files and return a tight ground-truth digest as PLAIN MARKDOWN (no fixed schema), under ~600 words, covering: (1) how the worker stage renders today (file:line); (2) AgentSidebar — what it shows + its status→label logic (file:line); (3) the one-at-a-time review stepper structure + WorkerReportBlock (file:line); (4) the real WorkerTask.status values + the approved flag, and what each means; (5) concrete design tokens/motion to build with (globals.css/constants); (6) exactly why the sidebar↔body connection is invisible today; (7) existing components/utilities a redesign should reuse. Be precise and concrete — everyone else builds on this.`,
  { label: 'survey', phase: 'Survey' }
)
const surveyBlock = String(survey)

// ── Phase 2: Concepts ──
phase('Concepts')
const CONCEPT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['name', 'one_line', 'big_idea', 'sidebar_design', 'connection_mechanic', 'deploy_ceremony', 'prescout_surfacing', 'status_system', 'mockup', 'motion', 'tokens_components', 'buildability', 'risk'],
  properties: {
    name: { type: 'string' },
    one_line: { type: 'string' },
    big_idea: { type: 'string', description: 'the organizing design idea + why it feels premium and makes the connection obvious' },
    sidebar_design: { type: 'string', description: 'what the sidebar becomes — layout, per-agent row, the rich status it carries' },
    connection_mechanic: { type: 'string', description: 'the EXACT mechanic linking sidebar↔body review (selection sync, focus thread, shared dots, docking rail, etc.) — be concrete and professional' },
    deploy_ceremony: { type: 'string', description: 'the "set sail (출항)" moment — kept as a gate, designed as a real scene' },
    prescout_surfacing: { type: 'string', description: 'how the light pre-scout shows per agent in the sidebar before deploy' },
    status_system: { type: 'string', description: 'the per-agent state visual language mapped to real WorkerTask.status values' },
    mockup: { type: 'string', description: 'an ASCII/text mockup of the worker stage (sidebar + body) in the working+review states' },
    motion: { type: 'string', description: 'specific motion (what animates on select/deploy/complete; which EASE/tokens)' },
    tokens_components: { type: 'array', items: { type: 'string' }, description: 'concrete tokens + existing components reused + net-new components, cited' },
    buildability: { type: 'string', description: 'honest build cost on the current stack; what it touches (file:line); what is reuse vs net-new' },
    risk: { type: 'string' },
  },
}
const SEEDS = [
  { key: 'crew-manifest', seed: 'CREW MANIFEST / SHIP\'S LOG — the sidebar is an editorial crew roster where each agent is a log entry advancing through voyage stages; selecting one "opens that crew member\'s report" in the body, and a single gold thread/ligature visually carries the selected roster row INTO the body card so it reads as one continuous object. Calm, editorial, expensive.' },
  { key: 'command-bridge', seed: 'COMMAND BRIDGE — the sidebar is a live console of "stations" (one per agent) with a status light + micro-progress; the body is the focused station\'s full panel; clicking a station docks it in with a sliding rail and a persistent connector; selection is always two-way synced (hover/active mirror both directions). Instrument-precise but warm, not cold-tech.' },
  { key: 'star-chart', seed: 'STAR CHART — reuse the existing VoyageChart aesthetic: agents are points/legs on a small chart; the review focuses one point and the chart highlights the lit path to it; the chart IS the navigator (replaces or absorbs the sidebar), the body is the detail. Deeply on-DNA (nautical).' },
  { key: 'single-spine', seed: 'SINGLE SPINE — collapse the two surfaces into ONE vertical spine: each agent is a node on the spine, pre-scout shows as a faint preview under its node, deploy "lights up" the spine and work flows down it, and the review expands the current node inline. Removes the two-surface split entirely — the connection is the structure itself.' },
  { key: 'roster-focus', seed: 'ROSTER + FOCUS (minimal-premium) — keep the two surfaces but make the connection impeccable: the body\'s progress dots ARE the sidebar agents (one shared component/source of truth); selecting/hovering an agent mirrors a focus ring + a brief connecting motion between the two; pre-scout = a one-line "scouting: <angle>" under each agent. Lowest-risk, highest-polish refinement of today.' },
]
const concepts = (await parallel(SEEDS.map((s, i) => () =>
  agent(
    `${CONTEXT}\n\nGROUND-TRUTH DIGEST (build on it):\n${surveyBlock}\n\nDESIGN SEED #${i + 1} — "${s.key}":\n${s.seed}\n\nDevelop this into ONE concrete, premium, buildable design for the worker stage covering ALL of: rich sidebar status, the professional sidebar↔body connection mechanic, the kept "set sail" deploy ceremony, the light pre-scout surfacing, and the per-agent status system mapped to real WorkerTask.status. Include a text/ASCII mockup and specific motion + tokens + component touchpoints (file:line). Push it to a polished, intentional, expensive feel — never crude. Read the real components to keep it buildable.`,
    { label: `concept:${s.key}`, phase: 'Concepts', schema: CONCEPT_SCHEMA }
  )
))).filter(Boolean)

// ── Phase 3: Judge (pipeline: each concept judged by 3 lenses as it lands) ──
phase('Judge')
const JUDGE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['concept', 'lens', 'scores', 'verdict', 'strongest_element', 'fatal_flaw'],
  properties: {
    concept: { type: 'string' }, lens: { type: 'string' },
    scores: {
      type: 'object', additionalProperties: false,
      required: ['craft_premium', 'connectedness_clarity', 'dna_fidelity', 'buildability'],
      properties: {
        craft_premium: { type: 'integer', minimum: 1, maximum: 5 },
        connectedness_clarity: { type: 'integer', minimum: 1, maximum: 5 },
        dna_fidelity: { type: 'integer', minimum: 1, maximum: 5 },
        buildability: { type: 'integer', minimum: 1, maximum: 5 },
      },
    },
    verdict: { type: 'string' },
    strongest_element: { type: 'string', description: 'the one move worth grafting even if this concept loses' },
    fatal_flaw: { type: 'string' },
  },
}
const LENSES = [
  { lens: 'craft-premium', ask: 'Judge ONLY craft: does it look expensive, intentional, restrained — NOT crude, NOT a generic dashboard? Hierarchy, whitespace, motion, the dawn-harbor DNA. Be harsh on anything that would read as cheap or busy.' },
  { lens: 'connectedness-clarity', ask: 'Judge ONLY whether it makes "one team, status↔action" UNMISTAKABLE and kills the confusion: can a first-timer tell the sidebar and the body are the same crew, see each agent\'s state (assigned/pre-scouting/working/done/reviewed), and know what to do now? Is the deploy moment legible?' },
  { lens: 'dna-and-buildability', ask: 'Judge fidelity to the voyage DNA + honest buildability on the current stack (Zustand/framer/tailwind, reusing AgentSidebar/WorkerReportBlock/VoyageChart/tokens). Penalize anything needing a ground-up rebuild or that betrays the metaphor. Is the pre-scout genuinely LIGHT (token-frugal)?' },
]
const judged = await pipeline(
  concepts,
  (c) => Promise.resolve(c),
  (c, _o, i) => parallel(LENSES.map(l => () =>
    agent(
      `${CONTEXT}\n\nCONCEPT under judgment (#${i + 1}):\n${JSON.stringify(c, null, 2)}\n\nLENS: ${l.lens}. ${l.ask}\n\nScore 1-5 on each axis, give an honest verdict, the strongest graftable element, and the fatal flaw.`,
      { label: `judge:${c.name?.slice(0, 20) || i}:${l.lens}`, phase: 'Judge', schema: JUDGE_SCHEMA }
    )
  )).then(v => ({ concept: c, votes: v.filter(Boolean) }))
)
const judgedClean = judged.filter(Boolean)
function mean(e) { const a = e.votes.flatMap(v => Object.values(v.scores)); return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0 }
const ranked = judgedClean.map(e => ({ name: e.concept.name, mean: mean(e) })).sort((a, b) => b.mean - a.mean)
log(`Concepts ranked: ${ranked.map(r => `${r.name} (${r.mean.toFixed(2)})`).join(' | ')}`)
const judgedBlock = JSON.stringify(judgedClean.map(e => ({ concept: e.concept, judgments: e.votes })), null, 2)

// ── Phase 4: Synthesize → write the spec ──
phase('Synthesize')
const spec = await agent(
  `${CONTEXT}\n\nGround truth:\n${surveyBlock}\n\nAll concepts + multi-lens judgments:\n${judgedBlock}\n\nRanking: ${ranked.map(r => `${r.name} (${r.mean.toFixed(2)})`).join(', ')}.\n\nWRITE the worker-stage redesign spec to ${REPO}\\docs\\WORKER-STAGE-REDESIGN.md using the Write tool. It MUST:\n1. **Chosen direction** — the winning concept (or a coherent hybrid grafting the best elements), and WHY, in plain terms.\n2. **The sidebar↔body connection mechanic** — the exact, premium interaction (selection sync, the visual link, shared dots/source-of-truth) with motion specs and tokens.\n3. **Sidebar status system** — the per-agent state visual language mapped to real WorkerTask.status values (cite AgentSidebar current logic), incl. the new pre-scout state.\n4. **Deploy "set sail" ceremony** — kept as a gate, designed as a real scene; exact copy + motion.\n5. **Pre-scout (Q1)** — how it surfaces; and a short note on the ARCHITECTURE hook (where to trigger the light pass, what "light" means/token budget) — flag the engineering as a separate task.\n6. **Build map** — concrete component/file:line touchpoints, what is reuse vs net-new, sequenced into small safe steps (each tsc+lint+1004-green). Keep the one-at-a-time review + the deploy gate.\n7. An ASCII mockup of the final design (assigned, working, and review states).\nBe specific and buildable; premium over clever. Write the COMPLETE document in a single pass — do not stop early or summarize instead of writing. After writing the file, return a short text summary: the chosen direction, the connection mechanic in 3 lines, and the first 3 build steps.`,
  { label: 'synthesize-spec', phase: 'Synthesize' }
)

// ── Phase 5: Critique ──
phase('Critique')
const critique = await agent(
  `${CONTEXT}\n\nThe spec is at ${REPO}\\docs\\WORKER-STAGE-REDESIGN.md. Read it. Adversarially audit: (a) does it actually read as PREMIUM/intentional, or would any part look crude/busy/cheap? (b) does the connection genuinely make "one team, status↔action" unmistakable? (c) is it buildable on the real stack reusing real components (spot-check the cited file:line)? (d) is the pre-scout genuinely LIGHT (token-frugal) and is its architecture hook real? (e) does it preserve the deploy gate + one-at-a-time review? (f) any state-machine gap vs the real WorkerTask.status values? If the spec file is missing or truncated, return REWORK and say it was not written. Return verdict + concrete fixes.`,
  { label: 'redesign-critic', phase: 'Critique', schema: {
    type: 'object', additionalProperties: false,
    required: ['verdict', 'premium_check', 'connection_check', 'buildability_check', 'gaps', 'concrete_fixes'],
    properties: {
      verdict: { type: 'string', enum: ['SHIP', 'SHIP_WITH_FIXES', 'REWORK'] },
      premium_check: { type: 'string' },
      connection_check: { type: 'string' },
      buildability_check: { type: 'string' },
      gaps: { type: 'array', items: { type: 'string' } },
      concrete_fixes: { type: 'array', items: { type: 'string' } },
    },
  } }
)

return { survey, concepts, judged: judgedClean, ranking: ranked, spec, critique }
