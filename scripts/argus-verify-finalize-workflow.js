export const meta = {
  name: 'argus-verify-finalize',
  description: 'Enforce the Claim Verification Protocol on MASTER-DIRECTION-v3: re-verify every load-bearing claim against full source, sweep the whole plan for each of the 7 error classes (catch hidden same-class errors), fold the critique fixes + resolve sequencing, and emit a fully claim-tagged v4',
  whenToUse: 'After the augment pass, when the owner wants the plan made meticulous and provably accurate — every claim re-grounded, error classes swept, sequencing resolved',
  phases: [
    { title: 'ReVerify', detail: 'one agent per plan section re-checks every claim under the protocol (full-block reads, quoted source, claim tags)' },
    { title: 'ClassSweep', detail: 'one agent per error class (E3 reuse / E4 attribution / E5 counts&sets / E6 mechanism / E7 intent-vs-fact) sweeps the WHOLE plan to catch hidden same-class errors' },
    { title: 'Finalize', detail: 'integrate all corrections + critique fixes + sequencing resolution → write the fully tagged MASTER-DIRECTION-v4.md' },
    { title: 'Audit', detail: 'final adversarial pass against the protocol acceptance bar — no un-evidenced load-bearing claim may remain' },
  ],
}

const REPO = String.raw`C:\Users\SAMSUNG\documents\github\commet\Argus`
const V3 = `${REPO}\\docs\\MASTER-DIRECTION-v3.md`
const PROTOCOL = `${REPO}\\docs\\VERIFICATION-PROTOCOL.md`

const CONTEXT = `
You are FINALIZING the ARGUS master plan to a provably-accurate state (Next.js 16 + TS + Tailwind v4 + Zustand + Supabase). Repo: ${REPO}.

READ FIRST, both fully:
- The plan to verify: ${V3}
- The LAW you enforce: ${PROTOCOL} — the Claim Verification Protocol (7 error classes E1-E7, claim tags [VERIFIED]/[INTENT]/[ASSUMPTION], the per-claim checklist, process rules). You MUST obey it and reject any load-bearing claim that violates it.

WHY THIS EXISTS: the prior synthesis made 26 precision errors (16 imprecise / 5 unverifiable / 4 wrong / 1 stale) by asserting file:line, counts, locations, "already exists", and fix mechanisms at a distance from source. Your job is to make EVERY load-bearing claim either [VERIFIED] with quoted source or explicitly tagged, and to catch the hidden same-class errors the augment pass did not reach.

WHAT ARGUS IS (grounding, do not re-derive): a "decision harness" run before handing work to AI. Voyage reframe→recast→rehearse→refine→이타카(4 outputs). Direction is HYBRID (extend voyage DNA + one radical graft = the Decision Contract closed loop), foundation-fixes-first (L0), heavy bets gated behind kill-tests (§4). Strong assets: llm.ts, Phase 1/2, eval engines, .argus ledger, 1004 tests. The §0 KICK is the Decision Contract (pre-flight) + earned return-to-grade.

ABSOLUTE RULES (from the protocol): quote the exact lines you read (E1); read the whole block + name the production branch (E2); prove BOTH producer and consumer for any reuse claim (E3); grep the definition site for any attribution (E4); run a FRESH exhaustive grep for any count/set and show it (E5); verify the API/ownership contract for any mechanism (E6); tag intent vs fact (E7). Inherited claims are [ASSUMPTION] until re-opened this turn. READ-ONLY repo.`

const VERDICT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['section', 'claims', 'newly_found'],
  properties: {
    section: { type: 'string' },
    claims: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['claim', 'tag', 'verdict', 'evidence', 'correction'],
        properties: {
          claim: { type: 'string' },
          tag: { type: 'string', enum: ['VERIFIED', 'INTENT', 'ASSUMPTION'] },
          verdict: { type: 'string', enum: ['confirmed', 'wrong', 'stale', 'imprecise', 'unverifiable'] },
          evidence: { type: 'string', description: 'the EXACT quoted source (file:line + the code text) read this turn; for counts, the grep run + result' },
          correction: { type: 'string', description: 'precise fix if not confirmed; empty if confirmed' },
        },
      },
    },
    newly_found: { type: 'array', items: { type: 'string' }, description: 'same-class hidden errors in this section the augment pass missed' },
  },
}

// ---- Phase 1: ReVerify by section under the protocol ----
phase('ReVerify')
const SECTIONS = [
  '§0 THE KICK (pre-flight + return-to-grade; the OUTCOME_RECORDS/useAccuracyStore producer-vs-consumer claims — apply E3 hard)',
  '§1 North-Star + §2 verdict (the verified-asset claims: llm.ts validateShape wiring, context-chain typed, .argus ledger, types.ts id/created_at/status absence — E1/E2)',
  '§3 L0 stop-the-bleeding (every bug: llm.ts watchdog mechanism E6, project-brief.ts:130 crash expr E2, eval-engine.ts:183/184 both branches E2, worker-engine.ts:267-269/281-285 production branch E2, storage.ts:41-43 E1)',
  '§3 L1 + L1b (artifact persistence orphan claim, reflection-tab attribution E4: getUserPatterns/getPersonaAccuracySummary real homes + which component hosts it, userContext injection progressive-prompts.ts:23)',
  '§3 L2 (decomposition: useProgressiveStore coupling SET via fresh grep E5, IntersectionObserver presence E5, which named tests exercise the chassis E2, the "maintainability not value gate" claim E7)',
  '§3 L3a + L3b (context-chain typed builders, useContextChainStore absence, substring linkers agent-spec.ts:104/prompt-chain.ts:151-152 E1, types.ts:11-18/:136-141 field absence E2, the 20260409 atomic RPC)',
  '§3 L4 (Decision Contract source-data availability E3, return-to-grade producer/consumer E3, onboarding argus.has_onboarded key existence E1, BranchMap edgePath/getActivePath attribution E4, export.ts voyageLogToMarkdown)',
  '§3 L5 (silent loop stores, db.ts:57-78 mergeByTimestamp + deleted_at semantics E6, progressive_sessions blob caps E1)',
  '§4 probes + §5 design-system (token existence per-token E5/E7: brass-shine/8pt scale net-new?, EASE constant value vs --ease-spring vs --ease-wave E1, Card.tsx variant API + --accent-light E4)',
  '§6 NOT-doing + §7 do-not-inherit (re-verify EACH §7 row; counts must be FRESH-grepped E5: parseJSON/JSON.parse exact numbers, llm-validation.ts, decision-quality.ts:146 guard, VoyageChart SVG, dead @react-three usage E5)',
  '§UX + §UX-MOBILE (spot-verify the file:line anchors on the P0/P1 items: workspace/page.tsx:502-532 no AbortController/timer, Act1Voyage.tsx hero, FinalCard.tsx/OutputSelector.tsx labels, ProgressiveFlow.tsx:842 convergence, Header.tsx nav — E1)',
]
const reverify = (await parallel(SECTIONS.map((s, i) => () =>
  agent(`${CONTEXT}\n\nRE-VERIFY plan section: ${s}\n\nFor EVERY load-bearing claim in this section of ${V3}, run the per-claim checklist, open the FULL source block (not just the cited line), and return: the claim, its tag ([VERIFIED]/[INTENT]/[ASSUMPTION]), a verdict, the EXACT quoted source you read (or the fresh grep + result for any count/set), and the precise correction if not confirmed. Also list any same-class hidden error in this area the augment pass missed.`,
    { label: `reverify:${i}`, phase: 'ReVerify', schema: VERDICT_SCHEMA })
))).filter(Boolean)

// ---- Phase 2: Whole-plan sweeps per error class (catch HIDDEN same-class errors) ----
phase('ClassSweep')
const CLASS_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['error_class', 'instances'],
  properties: {
    error_class: { type: 'string' },
    instances: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['plan_claim', 'status', 'evidence', 'fix'],
        properties: {
          plan_claim: { type: 'string' },
          status: { type: 'string', enum: ['holds', 'violates', 'needs_tag'] },
          evidence: { type: 'string', description: 'fresh grep/read result proving the verdict' },
          fix: { type: 'string' },
        },
      },
    },
  },
}
const CLASSES = [
  { key: 'E3-reuse', ask: 'Sweep the ENTIRE plan for every "already exists / half-built / reuse / just repoint / already wired" claim. For each, grep and name BOTH the producer (writer) and consumer (reader) and confirm a production path. Flag any that is actually net-new. (The OUTCOME_RECORDS producer-less bug is the archetype — find its siblings.)' },
  { key: 'E4-attribution', ask: 'Sweep the ENTIRE plan for every claim that a symbol/function/store lives in a specific file. grep each definition site; flag every mis-attribution. (getUserPatterns→useJudgmentStore was one — find the rest.)' },
  { key: 'E5-counts-sets', ask: 'Sweep the ENTIRE plan for every count and every member-set (callsite counts, store imports, coupled concerns, token lists, "all X"). Re-run a FRESH exhaustive grep for each and show the command+result; flag every count/set that is stale, inflated, or asserted without enumeration. (The persona/reframe/recast/project import set and IntersectionObserver were wrong — find the rest.)' },
  { key: 'E6-mechanism', ask: 'Sweep the ENTIRE plan for every proposed FIX mechanism (the watchdog abort, the merge fix, the toast dispatch, the predicate join-key, etc.). For each, verify the API/ownership contract it relies on (signal ownership, nullability, soft-deletability, event names). Flag any mechanism that would not work as written. (abort-via-options.signal was wrong — find the rest.)' },
  { key: 'E7-intent-vs-fact', ask: 'Sweep the ENTIRE plan for statements written as verified fact that are actually design intent or unverified assumption ("is a maintainability gate", "all tokens exist", "leaves ProgressiveFlow untouched", effort estimates). Flag each that must be re-tagged [INTENT]/[ASSUMPTION].' },
]
const sweeps = (await parallel(CLASSES.map(c => () =>
  agent(`${CONTEXT}\n\nWHOLE-PLAN SWEEP for error class ${c.key}. ${c.ask}\n\nGo claim by claim across ALL sections of ${V3}. This is how we catch the HIDDEN errors the section pass missed — be exhaustive within this one class. Show the fresh grep/read evidence for each instance.`,
    { label: `sweep:${c.key}`, phase: 'ClassSweep', schema: CLASS_SCHEMA })
))).filter(Boolean)

// ---- Phase 3: Finalize → write v4 ----
phase('Finalize')
const reverifyBlock = JSON.stringify(reverify, null, 2)
const sweepBlock = JSON.stringify(sweeps, null, 2)

const MUST_FOLD = `
CRITIQUE FIXES + SEQUENCING (from the augment-pass critic — fold ALL of these):
SEQUENCING (resolve, don't restate in 3 places):
 1. db.ts merge fix currently has THREE homes (L0 P2 / L5 / L4-prereq) → consolidate to ONE: "L4 PREREQUISITE — tombstone-aware merge + empty-stamp tie-break (db.ts:113-119 re-upsert exclusion + sanitizeItem:32-40)". Remove the other two mentions.
 2. L3a stable-id is referenced as both "after L1" and "before the Decision Contract/return-to-grade" → split explicitly: "L3a-0: predicate/assumption stable-id at generation, ships at L1 timing, BEFORE Decision Contract + return-to-grade"; keep persistence/_source/traceProvenance in L3a proper.
 3. L1 reflection tab is a poor "first visible win" (buildNavigatorInsights needs tier>=2/sessionCount>=2 → near-empty on runs 1-2) → DEMOTE reflection tab to "run-3+ payoff"; PROMOTE the convergence gauge to the L1 headline win, with an acceptance line that it renders meaningful output on run 1.
CONCRETE ADDITIONS:
 4. L0: add a SECOND infinite-spinner guard — "stream completed but parsePartialAnalysis (workspace/page.tsx:503) yielded no real_question AND no skeleton" → visible error + retry (covers malformed-JSON first interaction).
 5. L0 acceptance: add a per-fix regression-test requirement (brief export on analysis.steps=undefined returns a string and does not throw; record* eval on missing steps; worker no-callback path blocks not accepts) — because the plan admits these paths are under-covered by the 1004 tests.
 6. L0: add an "observable async-write" shared helper and route all three swallowed-insert paths through it (analytics.ts:176 .then-no-catch, db.ts insertToSupabase, loadAndMerge:119), each bumping a per-session sync-failure counter (same class as the storage.ts toast).
 7. MOBILE: pull the first-30-seconds mobile items (landing/entry orientation, analyze screen) into L0/L1 — currently gated to L4, but they ship in the rage-quit window (§4 Probe 3). Keep the deep mobile reskin in L4.
 8. Header.tsx GLOBAL CHROME (UX-critic blind spot): add a §UX-GLOBAL sub-track for the persistent Header (6 nav items incl. 3 lock-gated, KO/EN toggle, theme toggle) — first-run "what are all these / can I click them" + the double-CTA problem where the hero CTA coexists with Header nav. Fold the UX-critic's +10 additional confusions.
 9. Test-1 backfill gap: note that §4 Test-1 Wizard-of-Oz on ~15 existing voyages predates any predicate id — state how historical predicates are graded (manual tag) so the kill-test is runnable.`

const v4 = await agent(
  `${CONTEXT}\n\nProduce the FINAL, fully claim-tagged plan. Inputs:\n\n=== SECTION RE-VERIFICATION (corrections + tags + hidden findings) ===\n${reverifyBlock}\n\n=== WHOLE-PLAN ERROR-CLASS SWEEPS (hidden same-class errors) ===\n${sweepBlock}\n\n${MUST_FOLD}\n\nWRITE ${REPO}\\docs\\MASTER-DIRECTION-v4.md using the Write tool. Requirements:\n1. Start from ${V3}; preserve its structure (§0..§7 + §UX + §UX-MOBILE) and the HYBRID direction + risk discipline.\n2. Apply EVERY re-verification correction and EVERY ClassSweep "violates"/"needs_tag" fix inline, marked "(corrected: …)".\n3. Per the protocol, give every load-bearing claim a tag: [VERIFIED: quoted file:line] / [INTENT] / [ASSUMPTION: how to verify]. Counts/sets must show they were freshly grepped. Reuse claims must name producer+consumer. Mechanisms must name their contract.\n4. Fold all 9 MUST-FOLD items (resolve the 3 sequencing problems to a single home each; add the new guards/tracks).\n5. Add a top "Changelog vs v3" section listing every correction and addition.\n6. Add a short "Verification status" line per major section: how many claims VERIFIED vs INTENT vs ASSUMPTION.\nThis v4 is the meticulous, accurate master plan. Be exhaustive and precise. After writing, return: the changelog, the verified/intent/assumption counts, and any claim you could NOT verify (must remain [ASSUMPTION]).`,
  { label: 'finalize-v4', phase: 'Finalize' }
)

// ---- Phase 4: Final adversarial audit against the protocol acceptance bar ----
phase('Audit')
const audit = await agent(
  `${CONTEXT}\n\nThe final plan is at ${REPO}\\docs\\MASTER-DIRECTION-v4.md. Read it AND ${PROTOCOL}. Audit against §4 acceptance: is EVERY load-bearing claim either [VERIFIED] with quoted source or explicitly [INTENT]/[ASSUMPTION]? Spot-check 8-10 of the highest-risk claims (counts, reuse, mechanisms, attributions) by opening source yourself — do they hold? Did any of the 3 sequencing problems survive in multiple homes? Is any P0 still placed too late? Return the acceptance verdict + every remaining violation.`,
  { label: 'protocol-audit', phase: 'Audit', schema: {
    type: 'object', additionalProperties: false,
    required: ['acceptance_verdict', 'spotchecks', 'remaining_violations', 'sequencing_resolved', 'concrete_fixes'],
    properties: {
      acceptance_verdict: { type: 'string', enum: ['PASS', 'PASS_WITH_NITS', 'FAIL'] },
      spotchecks: { type: 'array', items: { type: 'string' }, description: 'each: claim + source opened + holds/fails' },
      remaining_violations: { type: 'array', items: { type: 'string' } },
      sequencing_resolved: { type: 'string' },
      concrete_fixes: { type: 'array', items: { type: 'string' } },
    },
  } }
)

return { reverify, sweeps, v4, audit }
