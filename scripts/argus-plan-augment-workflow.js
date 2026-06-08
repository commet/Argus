export const meta = {
  name: 'argus-plan-augment',
  description: 'Exhaustive verify-and-supplement pass over MASTER-DIRECTION: re-verify every layer claim against source, run a granular basic-UX confusion sweep per screen, catch non-UX gaps, and synthesize a supplemented plan (v3) with a sequenced UX track woven in',
  whenToUse: 'After the 4-workflow synthesis, when the owner wants the master plan torn apart piece-by-piece, re-grounded in real code, and supplemented — especially with granular first-time-user UX fixes',
  phases: [
    { title: 'Verify', detail: 'one agent per plan layer/section re-checks every load-bearing claim against actual source (file:line)' },
    { title: 'UX-Sweep', detail: 'one agent per screen walks it as a confused first-time user — orientation / affordance / feedback / recovery' },
    { title: 'UX-Critic', detail: 'completeness critic finds the basic confusions the sweep missed' },
    { title: 'Gaps', detail: 'non-UX supplementation lenses — correctness, data/reliability, dropped findings, accessibility' },
    { title: 'Synthesize', detail: 'integrate corrections + granular UX track + gaps into a supplemented MASTER-DIRECTION v3' },
    { title: 'Critique', detail: 'adversarial completeness + sequencing pass on the supplemented plan' },
  ],
}

const REPO = String.raw`C:\Users\SAMSUNG\documents\github\commet\Argus`
const PLAN = `${REPO}\\docs\\MASTER-DIRECTION.md`

const CONTEXT = `
You are augmenting the ARGUS master plan (Next.js 16 + TS + Tailwind v4 + Zustand + Supabase). Repo root: ${REPO}.
The current plan is at ${PLAN} (READ IT FIRST — it is the single source of truth, synthesizing four prior workflows A/B/C/D). The chosen direction is HYBRID: extend the voyage DNA (C) + one radical graft (the Decision Contract closed loop, §0), foundation-fixes-first (L0), heavy/irreversible bets gated behind cheap kill-tests (§4).

WHAT ARGUS IS: a "decision harness" you run BEFORE handing work to an AI. Tagline "Think before you recast." Voyage metaphor: 항로 재설정(reframe) → 선원 배치(recast) → 리허설(rehearse) → 항로 수정(refine) → 이타카(4 outputs: Project Brief / Prompt Chain / Agent Spec / Execution Checklist). Target user: a NON-developer strategist deciding WHAT to have AI do; their real competitor is "just ask ChatGPT." Design DNA "동틀 녘의 항구": warm ivory/navy/gold, editorial typography, generous whitespace, slow spring motion; avoid generic AI-dashboard, cold tech-blue.

VERIFIED GROUND TRUTH (do not re-derive, build on it): 1004 tests pass, build OK. Strong: llm.ts engine, Phase 1/2 content intelligence, eval engines, the .argus/ on-disk ledger. Weak chassis: ProgressiveFlow.tsx ~2670 lines + useProgressiveStore.ts ~1786 lines; Phase 0 context pipeline unpersisted; outputs are orphaned static markdown; learning loop never grades a prediction-vs-outcome; no execution instrumentation. The plan's §7 lists fabricated/stale claims that must NOT be re-inherited.

KEY SURFACES / FILES (Glob/Grep to confirm exact paths, then Read the real components — never assume):
- Landing & first impression: src/app/page.tsx ; InteractiveDemo.tsx ; Act*OnDeck / landing components
- Workspace entry / first-run: src/app/workspace/page.tsx (HeroFlow) ; empty/idle states
- Main voyage flow: src/components/workspace/progressive/ProgressiveFlow.tsx + progressive/* ; RehearseStep.tsx ; recast/worker UI ; reframe UI
- Outputs / 이타카: FinalCard.tsx ; OutputSelector.tsx ; lib/export.ts / agent-spec.ts / prompt-chain.ts / checklist.ts
- Navigation / IA / logbook: Logbook.tsx ; NavigatorStrip ; BranchMap.tsx ; VoyageChart.tsx
- Design tokens: src/app/globals.css ; progressive/shared/constants.ts (EASE)

RULES: READ-ONLY (analysis on paper). Every claim MUST cite a real file:line you actually read. Severity: P0 blocks/breaks real use; P1 serious; P2 polish; P3 minor.`

// ---------- Phase 1: VERIFY every layer/section claim against source ----------
const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['section', 'claims', 'newly_found_in_section'],
  properties: {
    section: { type: 'string' },
    claims: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['claim', 'verdict', 'evidence', 'correction'],
        properties: {
          claim: { type: 'string', description: 'the specific claim/item from the plan being checked' },
          verdict: { type: 'string', enum: ['confirmed', 'wrong', 'stale', 'imprecise', 'unverifiable'] },
          evidence: { type: 'string', description: 'file:line actually read + what it says' },
          correction: { type: 'string', description: 'the precise fix if not confirmed; empty if confirmed' },
        },
      },
    },
    newly_found_in_section: { type: 'array', items: { type: 'string' }, description: 'real issues in this area the plan does NOT mention' },
  },
}

const PLAN_SECTIONS = [
  { key: 'L0', focus: 'L0 stop-the-bleeding: the stream-hang watchdog (llm.ts:627-757), the 2 null-derefs (project-brief.ts:130, eval-engine.ts:183), worker silent auto-accept (worker-engine.ts:267-269), storage quota swallow (storage.ts:41-43). Re-read each line; confirm the bug is real, the mechanism, and the proposed fix is correct.' },
  { key: 'L1+L1b', focus: 'L1 artifact persistence (agent-spec.ts/OutputSelector.tsx:121 copy-only), retention reflection tab (navigator.ts/NavigatorStrip/getUserPatterns), and L1b userContext injection (progressive-prompts.ts:23, user-context.ts:57-58). Confirm scope and feasibility.' },
  { key: 'L2', focus: 'L2 chassis decomposition: verify ProgressiveFlow.tsx + useProgressiveStore.ts sizes and what they couple; verify the named tests (orchestrator-journey/voyage-branch/workflow-review-integration) exist and what they cover.' },
  { key: 'L3a+L3b', focus: 'L3a Phase-0 persistence slice (context-chain.ts:119-525 typed?, no useContextChainStore?, substring linkers at agent-spec.ts:104 / prompt-chain.ts:151-152) and L3b heavy migration (HiddenAssumption types.ts:11-18 / KeyAssumption :136-141 — confirm no id/created_at/status; the 20260409 atomic RPC).' },
  { key: 'L4', focus: 'L4 forward surfaces: Decision Contract source data (recast AI/human assignments, blindspot classified_risks, governing_idea — confirm these are actually computed & available), return-to-grade (useAccuracyStore/OUTCOME_RECORDS/context-builder.ts:61-63), onboarding (workspace/page.tsx:690, InteractiveDemo), core-flow reskin hooks (phaseIdx, BranchMap edgePath/getActivePath), attributable outputs (export.ts voyageLogToMarkdown).' },
  { key: 'L5', focus: 'L5 deferred: silent loop (judgment-vitality.ts/observation-engine.ts), mergeByTimestamp clock-skew + deleted_at awareness (db.ts:57-78), session-blob durability (progressive_sessions JSONB caps).' },
  { key: 'section-5-design', focus: '§5 design-system spine: verify tokens exist in globals.css (--accent #96782e, --font-display, --radius-md, 8pt scale), the EASE constant value in progressive/shared/constants.ts vs --ease-spring vs --ease-wave, Card.tsx forwardRef/variant API.' },
  { key: 'section-7-donotinherit', focus: '§7 do-not-inherit table: re-verify EACH row against source (parseJSON counts, llm-validation.ts, decision-quality.ts:146 guard, VoyageChart SVG-not-three, navigator one-way claim, useAccuracyStore rates personas). Flag any row that is itself wrong now.' },
]

// ---------- Phase 2: GRANULAR BASIC-UX SWEEP per screen (the centerpiece) ----------
const UX_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['surface', 'confusions'],
  properties: {
    surface: { type: 'string' },
    confusions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['moment', 'user_thought', 'heuristic', 'severity', 'evidence', 'concrete_fix', 'effort'],
        properties: {
          moment: { type: 'string', description: 'the exact point in the screen/flow where confusion happens' },
          user_thought: { type: 'string', description: 'the literal thought a first-timer has: "뭐지?" / "어떻게 하라는거지?" / "뭐가 진행 중이지?" / "어디를 봐야 하지?" / "이거 눌러도 되나?" / "내가 한 게 먹혔나?"' },
          heuristic: { type: 'string', description: 'which basic principle is violated: orientation / affordance / feedback / progress-visibility / error-recovery / wording-clarity / next-action-obviousness / consistency' },
          severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          evidence: { type: 'string', description: 'the actual component + file:line that produces this experience' },
          concrete_fix: { type: 'string', description: 'a specific, buildable fix — copy text, a label, a spinner+status, a "you are here" marker, a disabled-state, a tooltip, etc.' },
          effort: { type: 'string', enum: ['S', 'M', 'L'] },
        },
      },
    },
  },
}

const UX_SURFACES = [
  { key: 'landing-first-impression', walk: 'A first-time non-dev lands on the home page knowing nothing. Walk page.tsx + InteractiveDemo. Do they understand WHAT this is, WHY it helps, and WHAT to do in the first 10 seconds? Is the primary action obvious? Does the demo clarify or confuse?' },
  { key: 'workspace-entry-empty-state', walk: 'User clicks in and reaches the workspace/HeroFlow for the first time (empty, no projects). workspace/page.tsx. Is it obvious what to type, where, and why? Is the empty state inviting or barren? Any "now what?" dead-end?' },
  { key: 'reframe-stage', walk: 'The reframe stage runs. Does the user understand what is being asked, what the system produced, and what to DO with the reframed question? Is the "this is different from what you asked" moment visible or buried?' },
  { key: 'recast-worker-stage', walk: 'The recast/worker stage with persona agents. Walk the worker/agent UI. Does the user understand why there are personas, what each is doing, whether it is progressing, how long it will take, and what the result means? (Note B S3: avatars imply a multi-agent team but it may be one LLM call — is that honest/clear?)' },
  { key: 'rehearse-stage', walk: 'RehearseStep.tsx. Does the user understand what is being simulated, who these reactions are from, and what action to take on them? Is the value legible?' },
  { key: 'refine-convergence', walk: 'The refine stage + convergence_score. Does the user know what changed, whether they are converging, and when/why they are "done"? Is convergence_score surfaced and explained or hidden?' },
  { key: 'outputs-ithaca', walk: 'FinalCard.tsx + OutputSelector.tsx. At voyage end: does the user understand the 4 outputs, which to use, what to DO with each, and where it goes next? Is "the decision log" discoverable or a footnote? Is the hand-off to actual execution clear?' },
  { key: 'navigation-ia-logbook', walk: 'Global navigation, the Logbook aside, BranchMap. Can the user always answer "where am I, how did I get here, how do I go back, where is my past work, what is this panel for"? Are versions/branches comprehensible?' },
  { key: 'system-states-feedback', walk: 'Cross-cutting: loading/streaming feedback, progress indication, empty states, error states, disabled states. While the LLM streams (30-40s), does the user know something is happening and roughly how long? Are errors actionable? Is every async action acknowledged?' },
  { key: 'mobile-end-to-end', walk: 'Do the WHOLE voyage on a ~375px mobile viewport. Bottom-bar collisions, safe-area, tap targets, horizontal overflow, unreadable/no-wrap streaming output, modals. Cite the responsive code. (B flagged P1 mobile issues the plan currently ignores entirely.)' },
  { key: 'wording-microcopy', walk: 'Audit the actual on-screen copy (labels, buttons, placeholders, empty/error messages, the nautical metaphor terms reframe/recast/이타카). Is any term jargon a non-dev would not understand? Does the metaphor help orientation or obscure the literal action? Cite real strings (i18n/ko.ts, component literals).' },
]

// ---------- Phase 4: non-UX GAPS ----------
const GAP_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['lens', 'gaps'],
  properties: {
    lens: { type: 'string' },
    gaps: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['gap', 'evidence', 'severity', 'proposed_layer', 'fix'],
        properties: {
          gap: { type: 'string' },
          evidence: { type: 'string', description: 'file:line or plan-section reference' },
          severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
          proposed_layer: { type: 'string', description: 'which plan layer (L0..L5) this belongs in' },
          fix: { type: 'string' },
        },
      },
    },
  },
}

const GAP_LENSES = [
  { key: 'correctness-reliability', ask: 'Beyond L0/L5, scan for correctness/reliability issues the plan misses: unguarded derefs, fire-and-forget writes, race conditions, hydration mismatches, error paths that fail silently. Cite file:line.' },
  { key: 'data-provenance-learning', ask: 'Data lifecycle & learning-loop gaps: schema-evolution risks, localStorage/Supabase sync edge cases, what the prediction-vs-outcome grading actually needs to be trustworthy, telemetry trust (analytics.ts). Cite file:line.' },
  { key: 'dropped-from-prior-workflows', ask: 'Re-read the four prior result JSONs in docs/ (argus-deep-plan-result.json, argus-blindspot-result.json, argus-target-state-result.json, argus-radical-rethink-result.json) and list must_carry / P0-P1 findings that the current MASTER-DIRECTION silently dropped (the critique already flagged the 5 Moments signposting, convergence visibility, mobile, one-model-in-costume — confirm and find others).' },
  { key: 'accessibility-i18n-perf', ask: 'Accessibility (keyboard nav, focus management, aria, contrast on the ivory/gold palette), i18n completeness (ko/en parity), and real perf costs (the ~200KB @react-three/fiber landing illustrations, bundle). Cite file:line.' },
]

// ===== RUN =====
log('Reading plan + fanning out: verify (8) + UX sweep (11) + gaps (4) in parallel')
phase('Verify')

const [verifyResults, uxResults, gapResults] = await Promise.all([
  parallel(PLAN_SECTIONS.map(s => () =>
    agent(
      `${CONTEXT}\n\nRE-VERIFY plan section "${s.key}". ${s.focus}\n\nFor EVERY load-bearing claim in that section of ${PLAN}, open the cited code and return a verdict (confirmed/wrong/stale/imprecise/unverifiable) with the file:line you actually read and the precise correction. Also list real issues in this area the plan omits.`,
      { label: `verify:${s.key}`, phase: 'Verify', schema: VERIFY_SCHEMA }
    )
  )),
  parallel(UX_SURFACES.map(s => () =>
    agent(
      `${CONTEXT}\n\nGRANULAR BASIC-UX WALKTHROUGH of surface "${s.key}". ${s.walk}\n\nBe a NON-technical first-time user who is easily confused. Catalogue EVERY concrete moment of "뭐지? / 어떻게 하라는거지? / 뭐가 진행 중이지? / 어디를 봐야 하지? / 이거 눌러도 되나? / 내가 한 게 먹혔나?" — the most BASIC level of unfriendliness, not just visual polish. For each: the literal user thought, the violated heuristic, the actual component+file:line, and a specific buildable fix (exact label/copy/spinner/marker/state). Read the real components — do not assume. Be exhaustive; small confusions count.`,
      { label: `ux:${s.key}`, phase: 'UX-Sweep', schema: UX_SCHEMA }
    )
  )),
  parallel(GAP_LENSES.map(g => () =>
    agent(
      `${CONTEXT}\n\nNON-UX GAP lens "${g.key}". ${g.ask}\n\nReturn concrete gaps the current plan does not cover, each with evidence (file:line), severity, the plan layer it belongs in, and a fix.`,
      { label: `gap:${g.key}`, phase: 'Gaps', schema: GAP_SCHEMA }
    )
  )),
])

const verify = verifyResults.filter(Boolean)
const ux = uxResults.filter(Boolean)
const gaps = gapResults.filter(Boolean)

// ---------- Phase 3: UX completeness critic ----------
phase('UX-Critic')
const allConfusions = ux.flatMap(u => (u.confusions || []).map(c => ({ surface: u.surface, ...c })))
const uxCritic = await agent(
  `${CONTEXT}\n\nHere is the full basic-UX confusion catalogue gathered across all surfaces:\n${JSON.stringify(allConfusions, null, 2)}\n\nYou are a completeness critic for BASIC usability. What obvious first-time-user confusions did this catalogue MISS? Think about: the very first 5 seconds; what a user does when they're stuck; whether they ever feel lost about "where am I / what just happened / what do I do next"; whether any action lacks acknowledgement; whether the metaphor ever blocks comprehension; cross-screen consistency. Read components as needed to ground new findings. Return additional confusions in the SAME shape, plus a short note on the catalogue's blind spots.`,
  { label: 'ux-completeness-critic', phase: 'UX-Critic', schema: {
    type: 'object', additionalProperties: false,
    required: ['blind_spots', 'additional_confusions'],
    properties: {
      blind_spots: { type: 'string' },
      additional_confusions: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['surface', 'moment', 'user_thought', 'heuristic', 'severity', 'evidence', 'concrete_fix', 'effort'],
          properties: {
            surface: { type: 'string' }, moment: { type: 'string' }, user_thought: { type: 'string' },
            heuristic: { type: 'string' }, severity: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3'] },
            evidence: { type: 'string' }, concrete_fix: { type: 'string' }, effort: { type: 'string', enum: ['S', 'M', 'L'] },
          },
        },
      },
    },
  } }
)

// ---------- Phase 5: Synthesize the supplemented plan (v3) ----------
phase('Synthesize')
const verifyBlock = JSON.stringify(verify, null, 2)
const uxBlock = JSON.stringify({ surfaces: ux, critic: uxCritic }, null, 2)
const gapBlock = JSON.stringify(gaps, null, 2)

const supplemented = await agent(
  `${CONTEXT}\n\nYou are producing the SUPPLEMENTED master plan (v3). Inputs:\n\n=== VERIFICATION (corrections to existing claims + omissions per section) ===\n${verifyBlock}\n\n=== BASIC-UX CONFUSION CATALOGUE (+ critic additions) ===\n${uxBlock}\n\n=== NON-UX GAPS ===\n${gapBlock}\n\nWRITE the supplemented plan to ${REPO}\\docs\\MASTER-DIRECTION-v3.md using the Write tool. It MUST:\n1. Preserve the existing structure (§0 KICK, §1 North-Star, §2 verdict, §3 layers L0-L5, §4 probes, §5 design, §6 NOT-doing, §7 do-not-inherit) and the HYBRID direction + risk discipline.\n2. Fold every VERIFICATION correction into the relevant claim (fix wrong file:lines, downgrade overstated bugs, re-scope from verified counts). Note each change inline as "(corrected: …)".\n3. Add a NEW first-class workstream **"UX — Basic Usability & Orientation"** that sequences the confusion catalogue into concrete, file:line-anchored fixes, grouped by surface, each with severity + effort. Weave the P0/P1 basic-UX fixes EARLY (into L0/L1 where they are cheap and high-impact — e.g. streaming progress feedback, "you are here" orientation, obvious next-action, error recovery), and the polish into L4. This track must be GRANULAR — every "뭐지?/어떻게?/어디?" moment becomes a checkable line item, not a vague principle. Add a dedicated MOBILE sub-track (currently absent).\n4. Fold the non-UX gaps into the right layers.\n5. Keep a "Changelog vs Rev 2" section at top listing what this v3 corrected/added.\nBe specific and buildable. After writing the file, return a concise summary: the changelog, the count of UX items by severity, and the top 10 highest-leverage basic-UX fixes to do first.`,
  { label: 'synthesize-v3', phase: 'Synthesize' }
)

// ---------- Phase 6: Critique ----------
phase('Critique')
const critique = await agent(
  `${CONTEXT}\n\nThe supplemented plan was written to ${REPO}\\docs\\MASTER-DIRECTION-v3.md. Read it. Adversarially audit: (a) did any verification correction get mis-applied or missed? (b) is the new UX track genuinely GRANULAR and sequenced, or did it collapse basic confusions back into vague principles? (c) is mobile actually addressed? (d) any basic first-time-user confusion still unaddressed? (e) any P0/P1 placed too late, or polish placed too early? (f) internal contradictions / building on sand? Return structured findings + concrete additions.`,
  { label: 'v3-critic', phase: 'Critique', schema: {
    type: 'object', additionalProperties: false,
    required: ['overall_verdict', 'misapplied_or_missed', 'ux_granularity_check', 'sequencing_problems', 'still_unaddressed', 'concrete_additions'],
    properties: {
      overall_verdict: { type: 'string' },
      misapplied_or_missed: { type: 'array', items: { type: 'string' } },
      ux_granularity_check: { type: 'string' },
      sequencing_problems: { type: 'array', items: { type: 'string' } },
      still_unaddressed: { type: 'array', items: { type: 'string' } },
      concrete_additions: { type: 'array', items: { type: 'string' } },
    },
  } }
)

return {
  verify, ux, uxCritic, gaps,
  ux_item_count: allConfusions.length + (uxCritic?.additional_confusions?.length || 0),
  supplemented, critique,
}
