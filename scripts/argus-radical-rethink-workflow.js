export const meta = {
  name: 'argus-radical-rethink',
  description: 'Fourth directional workflow — challenge Argus\'s core DNA and generate/judge several FUNDAMENTALLY different product shapes (radical alternatives), as the orthogonal counterweight to the incremental target-state design',
  whenToUse: 'Run as the 4th lens after diagnosis (A), blindspot (B), and incremental target-state (C); it deliberately questions the current architecture/product form instead of extending it',
  phases: [
    { title: 'Provocations', detail: '6 fundamentally different product shapes generated in parallel — each a distinct radical thesis' },
    { title: 'Judge', detail: 'each radical alternative scored by 3 lenses (user value / feasibility / philosophy-or-betrayal)' },
    { title: 'Tournament', detail: 'synthesize the strongest radical direction(s) into one concrete reinvention + migration sketch' },
    { title: 'RedTeam', detail: 'devil\'s advocate defends incrementalism, names what must be preserved' },
  ],
}

const REPO = String.raw`C:\Users\SAMSUNG\documents\github\commet\Argus`

const SOURCES = {
  deepPlan: `${REPO}\\docs\\argus-deep-plan-result.json`,
  blindspot: `${REPO}\\docs\\argus-blindspot-result.json`,
  targetState: `${REPO}\\docs\\argus-target-state-result.json`,
}

const CONTEXT = `
You are running the RADICAL RE-THINK lens for ARGUS (Next.js 16 + TS + Zustand + Supabase; repo ${REPO}).

THREE prior workflows already ran (their outputs are saved as JSON in docs/):
  A) DEEP-PLAN — domain problem audit + research + sequenced improvement plan (+ a self-critique admitting it inherited some FABRICATED/STALE numbers). ${SOURCES.deepPlan}
  B) BLINDSPOT-SWEEP — persona journeys, product-thesis premortem, competitive teardown, under-audited surfaces, and a meta-critique whose headline is: the deepest gap is "what the code SAYS vs what PRODUCTION does", plus P0s like NO execution instrumentation and output-artifacts-don't-drive-retention. ${SOURCES.blindspot}
  C) TARGET-STATE — a generative design studio that EXTENDED the existing voyage DNA into a polished incremental north-star (onboarding ceremony, focused-linear flow, editorial design system, "Mirror" retention). ${SOURCES.targetState}

YOUR JOB IS DELIBERATELY ORTHOGONAL TO C. C was told "extend the DNA, don't reinvent." You are the opposite: QUESTION THE DNA. Assume incrementalism might be a local maximum. Generate and pressure-test FUNDAMENTALLY DIFFERENT shapes Argus could take — different enough that they'd change what the product fundamentally IS, not just how it looks. Then judge honestly whether any radical departure beats the incremental target C proposed, and what each would cost.

WHAT ARGUS IS TODAY: a standalone web "decision harness" sitting BEFORE AI execution. Tagline "Think before you recast." Voyage metaphor reframe→recast→rehearse→refine→이타카(4 markdown outputs). Also ships Claude Code skills (reframe/recast/rehearse/blindspot) + a plugin. Target user: NON-developer strategists deciding WHAT to have AI do. Their own stated real competitor: "just asking ChatGPT directly."

GROUND TRUTH (verified by prior runs — build on it, don't re-derive): Tests 1004 pass, build OK. The ENGINE (src/lib/llm.ts, ~789 lines: backoff + circuit breaker + multi-fallback JSON) and the CONTENT INTELLIGENCE (Phase 1 adaptive decompose + Phase 2 multi-lens recast, with working eval engines) are genuinely strong — any radical reshape should consider SALVAGING these. The chassis is weak: ProgressiveFlow.tsx ~2670 lines + useProgressiveStore ~1786 lines; Phase 0 context pipeline unpersisted/no provenance; outputs are orphaned static markdown; learning loop is one-way (signals collected, never acted on); no execution instrumentation; retention thesis empirically unvalidated.

RULES: READ-ONLY (design on paper, touch no source). Be concrete and buildable-on-this-stack where relevant (cite real files/components a shape would keep, kill, or repurpose). Radical ≠ vague — each alternative must be a specific, describable product you could build. Honesty over novelty: if a radical shape is worse than incremental, say so.`

const CONCEPT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['name', 'one_line', 'thesis', 'what_fundamentally_changes', 'what_it_kills', 'what_it_salvages', 'why_better_for_the_real_user', 'biggest_risk', 'cheapest_proof'],
  properties: {
    name: { type: 'string' },
    one_line: { type: 'string', description: 'the pitch in one sentence' },
    thesis: { type: 'string', description: 'the core bet about why the CURRENT shape is a local maximum and this is better' },
    what_fundamentally_changes: { type: 'string', description: 'what the product fundamentally IS now vs today' },
    what_it_kills: { type: 'array', items: { type: 'string' }, description: 'concrete things removed (cite files/features/metaphors)' },
    what_it_salvages: { type: 'array', items: { type: 'string' }, description: 'strong existing assets it reuses (llm.ts, Phase1/2, etc.)' },
    why_better_for_the_real_user: { type: 'string', description: 'why a non-developer strategist wins vs "just ask ChatGPT"' },
    biggest_risk: { type: 'string' },
    cheapest_proof: { type: 'string', description: 'the smallest experiment that would validate/kill this bet' },
  },
}

const JUDGE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['concept', 'lens', 'scores', 'verdict', 'strongest_element', 'fatal_flaw'],
  properties: {
    concept: { type: 'string' },
    lens: { type: 'string' },
    scores: {
      type: 'object', additionalProperties: false,
      required: ['user_value_vs_chatgpt', 'feasibility_on_stack', 'philosophy_fidelity', 'moat_durability'],
      properties: {
        user_value_vs_chatgpt: { type: 'integer', minimum: 1, maximum: 5 },
        feasibility_on_stack: { type: 'integer', minimum: 1, maximum: 5 },
        philosophy_fidelity: { type: 'integer', minimum: 1, maximum: 5, description: 'fidelity to the deepest intent (NOT to current implementation) — a radical shape can betray the metaphor yet honor the mission' },
        moat_durability: { type: 'integer', minimum: 1, maximum: 5 },
      },
    },
    verdict: { type: 'string' },
    strongest_element: { type: 'string', description: 'the one idea worth grafting even if the whole concept loses' },
    fatal_flaw: { type: 'string' },
  },
}

const REDTEAM_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['case_for_incrementalism', 'what_must_be_preserved', 'where_radical_actually_wins', 'recommendation'],
  properties: {
    case_for_incrementalism: { type: 'string', description: 'the strongest honest argument that the incremental target-state C beats any radical reshape right now' },
    what_must_be_preserved: { type: 'array', items: { type: 'string' }, description: 'assets/decisions no reshape should throw away' },
    where_radical_actually_wins: { type: 'array', items: { type: 'string' }, description: 'the specific places a radical move genuinely beats incremental, with the bar it must clear' },
    recommendation: { type: 'string', description: 'pure/incremental/hybrid + the single highest-leverage radical graft worth taking now' },
  },
}

// ---- Phase 1: Provocations — 6 fundamentally different shapes ----
phase('Provocations')
const PROVOCATIONS = [
  { key: 'process-as-product', seed: 'Kill the artifact. The deliverable is NOT 4 markdown docs — it is a LIVING, replayable decision record / reasoning session that stays alive, gets revisited, and accrues. Attack blindspot finding "static markdown artifacts don\'t drive retention". What does the product become when the process IS the product and there is no "export"?' },
  { key: 'execution-bound-harness', seed: 'Stop being a standalone PRE-tool. Embed Argus AT the execution boundary (Claude Code / Cursor / agent runtime). It watches execution happen and closes the loop blindspot flagged as P0 ("no execution instrumentation", "static outputs block execution binding"). Argus becomes the judgment layer wrapped around real execution, not a doc generator beside it.' },
  { key: 'compounding-judgment-model', seed: 'The product is not a flow, it is a MODEL. PersonaBehaviorModel / the user\'s judgment fingerprint becomes the core noun (today it is an absent side-feature). Every voyage trains it; the UI is secondary; the moat is the accumulated personal/team judgment model that makes the NEXT decision faster. "Smarter every use" taken literally.' },
  { key: 'radical-simplification', seed: 'Drop the elaborate voyage metaphor and multi-phase choreography entirely. One screen, one provocation, instant sharpening — beat "just ask ChatGPT" on SPEED and a single sharp move, not ceremony. The 5-stage voyage is the thing blindspot said "obscures rather than clarifies". What is the 10-second Argus?' },
  { key: 'multiplayer-judgment-room', seed: 'Reframe from single-user to TEAMS. The recurring real pain across journeys is stakeholder misalignment; rehearse/convergence already model multiple personas. Argus becomes the shared room where a team\'s judgment visibly converges, and convergence_score is the product. B2B wedge vs a personal-productivity toy.' },
  { key: 'agent-native-no-webapp', seed: 'The Next.js web app is demoware; the real surface is where the user already works with AI. Double down on the Claude Code skills + plugin (reframe/recast/rehearse) as THE product, make the web app a thin landing/demo, and meet the user inside the terminal/agent. Kill the standalone webapp as the center of gravity.' },
]

const concepts = (await parallel(PROVOCATIONS.map((p, i) => () =>
  agent(
    `${CONTEXT}\n\nBefore designing, READ the three prior outputs as grounding (use the Read tool): ${SOURCES.deepPlan} , ${SOURCES.blindspot} , ${SOURCES.targetState}. Read enough to ground your bet in the verified diagnosis and to know what incremental-C already proposed (so you go genuinely beyond it).\n\nRADICAL SEED #${i + 1} — "${p.key}":\n${p.seed}\n\nDevelop this into ONE specific, describable, buildable radical product shape for Argus. It must be a real product someone could build on (or by deliberately replacing) the current stack — name the files/features/metaphors it keeps, kills, or repurposes. Push it to its honest conclusion; do not soften it back into the current product.`,
    { label: `radical:${p.key}`, phase: 'Provocations', schema: CONCEPT_SCHEMA }
  )
))).filter(Boolean)

// ---- Phase 2: Judge — each concept scored by 3 lenses (pipeline; judge as each lands) ----
phase('Judge')
const JUDGE_LENSES = [
  { lens: 'real-user-value', ask: 'Judge ONLY through the non-developer strategist whose rival is "just ask ChatGPT". Does this radical shape give them something ChatGPT structurally cannot? Be harsh on novelty-for-its-own-sake.' },
  { lens: 'craft-and-feasibility', ask: 'Judge buildability on (or deliberate replacement of) the current stack. What is salvageable (llm.ts, Phase1/2, eval engines), what is a ground-up rebuild, and is the cost honest? A radical idea that needs a 6-month rebuild scores low on feasibility even if visionary.' },
  { lens: 'mission-fidelity', ask: 'Judge fidelity to the DEEPEST INTENT (help a human structure judgment before costly AI execution) — NOT fidelity to the current voyage implementation. A shape may betray the metaphor yet serve the mission better, or vice versa. Name which.' },
]

const judged = await pipeline(
  concepts,
  (c) => Promise.resolve(c), // pass-through; concepts already generated
  (c, _orig, i) => parallel(JUDGE_LENSES.map(jl => () =>
    agent(
      `${CONTEXT}\n\nRADICAL CONCEPT under judgment (#${i + 1}):\n${JSON.stringify(c, null, 2)}\n\nJUDGE LENS: ${jl.lens}. ${jl.ask}\n\nScore 1-5 on each axis and give an honest verdict. Identify the single strongest element worth grafting even if the concept loses, and its fatal flaw.`,
      { label: `judge:${c.name?.slice(0, 24) || i}:${jl.lens}`, phase: 'Judge', schema: JUDGE_SCHEMA }
    )
  )).then(votes => ({ concept: c, votes: votes.filter(Boolean) }))
)

const judgedClean = judged.filter(Boolean)
// rank by mean of all scores across lenses
function meanScore(entry) {
  const all = entry.votes.flatMap(v => Object.values(v.scores))
  return all.length ? all.reduce((a, b) => a + b, 0) / all.length : 0
}
const ranked = judgedClean
  .map(e => ({ name: e.concept.name, mean: meanScore(e), entry: e }))
  .sort((a, b) => b.mean - a.mean)
log(`Radical concepts ranked: ${ranked.map(r => `${r.name} (${r.mean.toFixed(2)})`).join(' | ')}`)

const tournamentBlock = JSON.stringify(judgedClean.map(e => ({
  concept: e.concept,
  judgments: e.votes,
})), null, 2)

// ---- Phase 3: Tournament — synthesize strongest radical direction(s) ----
phase('Tournament')
const radicalDirection = await agent(
  `${CONTEXT}\n\nAll radical concepts with their multi-lens judgments:\n${tournamentBlock}\n\nRanking by mean score: ${ranked.map(r => `${r.name} (${r.mean.toFixed(2)})`).join(', ')}.\n\nWrite THE RADICAL DIRECTION report (Markdown):\n1. **The winning radical bet** — the single strongest reshape (or a coherent hybrid grafting the best elements of runners-up). Make it concrete: what Argus BECOMES, the one-screen description, the noun that replaces "voyage" if any.\n2. **What it kills / keeps / rebuilds** — cite real files & assets (salvage llm.ts + Phase1/2 explicitly).\n3. **Why it beats the incremental target-state C** — head to head, for the real user vs ChatGPT.\n4. **Migration sketch** — could we get there FROM today without a full rewrite? The cheapest path, or an honest "this needs a rebuild" verdict.\n5. **The cheapest experiment** that would prove or kill this bet within ~1-2 weeks.\n6. **Grafts** — radical ideas worth stealing into the incremental plan even if we DON\'T go fully radical.\nBe specific and buildable; prefer concrete moves over manifestos.`,
  { label: 'radical-direction', phase: 'Tournament' }
)

// ---- Phase 4: RedTeam — defend incrementalism, name what to preserve ----
phase('RedTeam')
const redteam = await agent(
  `${CONTEXT}\n\nHere is the proposed RADICAL DIRECTION:\n${radicalDirection}\n\nAnd here was the incremental target-state C\'s posture (extend the DNA). Play devil\'s advocate FOR incrementalism. Make the strongest honest case that a "go slowly, do it right" owner should NOT take the radical path now — given a working 1004-test product, a strong engine, and unvalidated retention. Then concede where radical genuinely wins and what bar it must clear, and what must be preserved no matter what. End with a clear recommendation: pure-incremental / hybrid / radical, and the single highest-leverage radical graft to take now.`,
  { label: 'incrementalism-redteam', phase: 'RedTeam', schema: REDTEAM_SCHEMA }
)

return { concepts, judged: judgedClean, ranking: ranked.map(r => ({ name: r.name, mean: r.mean })), radicalDirection, redteam }
