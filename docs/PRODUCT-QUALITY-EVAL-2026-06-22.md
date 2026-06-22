# Product-Quality Eval — does Argus genuinely help users decide & sharpen judgment?

> Date: 2026-06-22 · Method: 43-agent adversarial multi-agent workflow (7 dimensions →
> per-finding adversarial verification → synthesis). Target: origin/main @ `5d409f4`
> (includes R57/R58). Cost: ~2.9M tokens, 25 findings confirmed (each survived a
> refutation pass), 21 anchored positives.
>
> **Anti-self-play discipline** (why this isn't the invalid self-play R9 flagged):
> findings count ONLY if (a) a reproducible bad OUTPUT, (b) a violation of a STATED
> rule in CLAUDE.md / the product contract, or (c) a code/UX defect checkable at a
> file:line. "Looks good" scores were rejected. Each finding was adversarially
> re-verified (try to refute; default skeptic).
>
> **This is a handoff doc** — meant to be picked up by another session/device.
> Canonical is origin/main. See §Continuation at the end.

---

## Honest verdict (synthesis)

**As built, Argus does NOT yet deliver its stated purpose** (hand a tired user their
own judgment, sharper). The spine is mostly right; the failure is that **stated rules
are not enforced at render time in the webapp**, so the product does the opposite of
what its design says — through three mechanisms, plus a safety gap:

1. **Over-fire on flat decisions** — the probe / TrialSail / team deploy run
   unconditionally; the `frame_status='flat'` gate exists in the prompt and
   `judgment-gates.ts` but is **not wired into `ProgressiveFlow.tsx` / `TrialSail.tsx`**.
   So it manufactures forks on decisions where every branch lands the same (~60%
   over-fire per the stress test). This trains users to see false leverage → atrophies
   judgment.
2. **Machinery leak** — the Navigator agent is explicitly named & explained to the
   user; worker counts ("Agents 2/3 done") and role names ("Lead is synthesizing") are
   shown. Violates "agents are invisible crew." User judges the machinery instead of
   their decision.
3. **Flattering-only record** — `betsBroke` / `risksHappened` are computed but never
   displayed; `betsHeldAiSurfaced` (R57/R58) counts as a user win with no UI surface.
   The calibration record shows only wins → "a trophy case, not calibration" →
   atrophies the muscle the product claims to build.
4. **Safety gap (crisis)** — `crisis-gate` screens only the round-0 `problem_text`;
   self-harm / crisis signals introduced in the **framing-rejection text** or **Q&A
   answers** are undetected.

**Good news:** the three core CRITICALs are all *small* fixes — wiring gaps, not
philosophy errors.

**Single highest-leverage fix:** wire the `frame_status='flat'` gate into render-time
team + probe deployment in the webapp (`ProgressiveFlow.tsx` `shouldMix` logic +
`TrialSail` render guard). The R5–R8 stress test showed the under-fire default cut flat
over-fire 60%→0% and halved total harm.

---

## Findings (25 confirmed, by dimension)

Severity = post-verification adjusted. Basis: `output` = reproducible output ·
`rule` = stated-rule violation · `defect` = code/UX defect.

### Recognition — does it understand THIS decision, or generic/Barnum?

- **F1 · important · defect** — Next-question options drift to generic admin patterns
  (`src/lib/progressive-prompts.ts:87-106`). "Should we migrate to Kubernetes?" yields
  options like "What are your constraints? / What timeline? / Who approves?" — applies to
  any decision. User feels seen; steering is generic. → *Fix:* post-gen gate — each
  option must lead to a DIFFERENT skeleton on a dummy rerun, else regenerate.
- **F2 · important · defect** — Hidden assumptions generic across domains
  (`progressive-prompts.ts:74-78,124-126`). Same assumptions ("timeline is firm",
  "budget fixed") fit a hiring decision and a DB migration (Barnum). → *Fix:* require
  each assumption to cite the user's specific phrase; if removing the phrase doesn't make
  it irrelevant, regenerate.
- **F3 · important · rule** — `frame_status` flat-vs-load_bearing test stated but not
  mechanically enforced (`clarify/SKILL.md:380-384`, `CLAUDE.md:42-68`). → *Fix:*
  synthesize two execution plans (answer=YES vs NO); identical structure ⇒ MUST be flat.

### Leverage — does it surface the ONE load-bearing thing (flip test)?

- **F4 · CRITICAL · defect** — Probe is a leverage-GENERATOR that manufactures forks on
  flat decisions (`probe-engine.ts:206-286 runDivergenceProbe`, `fork-to-question.ts:91-140`).
  On "well-running stack, everyone happy" it invents a "learning/fun motivation" fork the
  user never raised; flip test fails. Architectural (per R4). → *Fix:* aggressive
  flat-detection before surfacing, or shrink to NAME the crux without manufacturing a
  fork question.
- **F5 · important · defect** — Flat-detection uses brittle word-overlap/Jaccard
  (`judgment-gates.ts:56-72 assessFrameStatus`). A reframe with high word overlap but
  injected directional steering slips. (Self-undermining scenario — treat as
  "make the gate conservative: when in doubt, assume flat.") → *Fix:* structural/semantic
  similarity, or conservative default.
- **F6 · important · defect** — `forksToQuestions` caps at 2 q/session and ranks by
  mechanical variant count, not leverage (`fork-to-question.ts:52-69`; P1-1 in R5-8 noted
  missing). The wrong (higher-variant but lower-leverage) question gets asked first. →
  *Fix:* real leverage-ranking — score each fork by "does flipping change the action?",
  surface top-1.
- **F7 · important · defect** — Mechanical `flipped_user_claim` gate checks presence, not
  validity (`probe-engine.ts:129-151 enforceForks`, `fork-to-question.ts:102-111`). A
  plausible-but-false claim passes. → *Fix:* validation pass — "if this flipped, would the
  decision change?" given the brief.

### Returns judgment vs takes it (atrophy) — strengthen or replace?

- **F8 · important · rule** — Webapp ignores `frame_status='flat'` for team deployment
  (`ProgressiveFlow.tsx`, `shouldMix` ~line 1340). Clarify marks flat correctly; the
  webapp only checks `request_type`, never `frame_status` → team deploys on a flat
  decision. → *Fix:* `shouldMix = ... && latest?.frame_status !== 'flat'`.
- **F9 · minor · defect** — Falsification "skip" path label disguises a decision as a
  convenience (`Falsification.tsx:232-240`). `real_bet_authored='ai_surfaced'` is tagged
  internally (R57) but the user later sees the predicate as "their bet". → *Fix:* relabel
  "Accept this assumption & finish" (not "just give me the document"), or confirm step.
- **F10 · important · rule** — `CurrentBearingCard` doesn't warn when workers failed
  (`CurrentBearingCard.tsx`). sail Step 7 requires a coverage-gap warning; webapp renders
  the bearing silently from survivors → user decides on incomplete evidence unknowingly.
  → *Fix:* pass workers.json; if any `status='error'`, prepend a warning banner.

### Honest calibration — no false confidence; honest record

- **F11 · CRITICAL · rule** — Settlement record OMITS losses (`betsBroke`,
  `risksHappened`) (`project/page.tsx:415-421`, `SettlementModal.tsx:242-252`;
  spec at `decision-contract.ts:497-506` literally says "losses are part of the record").
  Record shows only wins → inflated self-confidence, atrophied calibration. → *Fix:*
  display "X held · Y broke", "X avoided · Y happened".
- **F12 · important · defect** — AI-surfaced held bets counted as judgment wins, not
  separated in UI (`DecisionContractCard.tsx:290-298`, `SettlementModal.tsx:241-252`;
  `betsHeldAiSurfaced` from R57/R58 computed at `decision-contract.ts:441-445` but never
  rendered). → *Fix:* render "X held (Y AI-surfaced)". **This is the missing UI half of
  R57/R58.**
- **F13 · minor · defect** — Luck-attribution referent ambiguous ("그중 X개" /
  "you marked X as luck") (`project/page.tsx:417`, `SettlementModal.tsx:250-251`). →
  *Fix:* "of those, X were luck" or explicit per-dimension breakdown.

### Restraint — knows when to stay quiet (over-fire / mirror clause)

- **F14 · CRITICAL · rule** — TrialSail probe runs unconditionally, manufactures forks on
  flat decisions (`ProgressiveFlow.tsx:2506, 2784-2786`, `TrialSail.tsx:89-100`,
  `clarify/SKILL.md:430-436`). No `frame_status` check before rendering → 3 LLM calls
  invent sample forks not in the problem. → *Fix:* render-time guard
  `frame_status !== 'flat' && decision_density !== 'low'` (must be render-time — the LLM is
  still CALLED even if nothing renders, so a future render change re-exposes it).
- **F15 · minor · defect** — `applyRouteContract` is render-suppression, not
  pre-manufacture prevention (`progressive-engine.ts:91-102, 396-402`). A misclassified
  non-open input still has prose generated as if open; only the skeleton is blanked. Root
  cause (model misclassification ~44% mid-tier per R29) unfixed. → *Fix:* working fallback;
  document as fallback tier + log coercion for tuning.
- **F16 · important · defect** — Parity test checks the word "flat" appears, not that the
  gate is enforced at render (`decision-states-parity.test.ts:38-79`). False confidence;
  a refactor could delete the real check without failing the test. → *Fix:* add a
  behavioral test: `frame_status:'flat'` snapshot ⇒ no crew/probe.

### Crisis red-team — vulnerable / high-stakes (SAFETY)

- **F17 · CRITICAL · defect** — Crisis content in framing-REJECTION text is not screened
  (`progressive-engine.ts refineInitialFraming`). Safe start, then rejection reason "I want
  to drive somewhere far and not come back" → `classifyCrisis` never runs on it. → *Fix:*
  `classifyCrisis(rejectionReason)` before the LLM call; early-return crisis snapshot.
- **F18 · important · defect** — Q&A answers not screened
  (`progressive-engine.ts runDeepening ~line 527`). Crisis introduced in a round-1+ answer
  ("nothing matters anymore") undetected (banner reads round-0 flag only). → *Fix:* scan
  answers in `runDeepening`; early-return crisis snapshot.
- **F19 · important · defect** — Minor-at-risk regex misses phrasings
  (`crisis-gate.ts:91-93`). Requires "meet…up…with"/"I met…online" in a specific order;
  "this guy wants to meet me" / "come over" slip. → *Fix:* variant patterns; or run crisis
  check on any message containing online/meet/guy keywords, not just round 0.
- **F20 · important · defect** — Financial-ruin regex too narrow (`crisis-gate.ts:82-86`).
  Matches "401k/entire…100x" but misses "life savings…50x", "all savings…coin". → *Fix:*
  broaden to `(all|entire|my|life)\s+savings.*(50x|100x|guaranteed)` without requiring a
  specific asset type; add test.

### UX coherence — the tired user

- **F21 · important · defect** — Worker counts shown ("Agents 2/3 done")
  (`ProgressiveFlow.tsx` PhaseStatusBar ~359, 382). Machinery as primary status →
  user admires the machine. → *Fix:* decision-centered language ("Analyzing from multiple
  angles") or silent progress.
- **F22 · important · defect** — Agent role names shown ("Lead is synthesizing" / "리드가…")
  (`ProgressiveFlow.tsx:361`). → *Fix:* "Synthesizing findings"; remove agent names from
  user-facing strings.
- **F23 · CRITICAL · rule** — Navigator agent explicitly NAMED & explained to the user
  (`MixPreview.tsx:71-76`, "항해장의 한마디 / the navigator reviews the team's work"). User
  must now trust a named agent → new doubt point, machinery as protagonist. → *Fix:* remove
  the label/attribution; present synthesis directly ("The analysis finds…").
- **F24 · important · defect** — Validation badge color driven by uncalibrated numeric
  score (`WorkerCard.tsx:500-510`, `>=80/>=60`). The comment admits scores are verdict
  language; the color (green/amber/red) IS a verdict. Violates Zero-Judgment P1. → *Fix:*
  binary pass/fail or remove from display (internal-routing only).
- **F25 · important · defect** — Worker orchestration error → dead-end, no recovery path
  (`ProgressiveFlow.tsx:1471-1475`). Error shown, phase reverts to conversing, no
  Retry/Different-team/Go-back affordance. → *Fix:* inline error card with explicit recovery
  options.

---

## Prioritized action plan (leverage-ordered, two axes)

| # | Fix | Findings | Axis | Effort |
|---|---|---|---|---|
| P0-safety | Crisis screening on ALL input paths (rejection + Q&A) | F17, F18 | safety | small |
| P0-quality | Wire `frame_status='flat'` gate into render-time team + probe | F8, F14, (F3, F16) | judgment | small |
| P0-honesty | Show losses (betsBroke/risksHappened) + ai_surfaced in record | F11, F12, (F13) | moat | small |
| P0-identity | Remove Navigator name + worker counts + role names | F23, F21, F22 | trust | small |
| P1 | Crisis regex breadth (minor, financial) | F19, F20 | safety | small |
| P1 | Leverage-ranking; validity gate on flipped_user_claim; conservative flat gate | F6, F7, F5 | judgment | medium |
| P1 | Worker-fail bearing warning; worker-error recovery path | F10, F25 | honesty/UX | small |
| P1 | Recognition anchoring (phrase-grounded assumptions/questions) | F1, F2 | recognition | medium |
| P2 | Validation badge de-verdict; route-contract prose debt; relabel skip; parity behavioral test | F24, F15, F9, F16 | mixed | small |

---

## What this eval could NOT determine (self-play limits — honest)

This is a code+spine evaluation. It found STRUCTURAL failures that *should* harm decision
quality, but cannot determine: (1) whether real users actually decide/judge worse (needs
pre/post observation); (2) retention — users may quit before discovering the hidden losses;
(3) whether the moat compounds — needs "do repeat users' decisions improve?" data;
(4) market desirability; (5) whether the proposed fixes actually build reasoning skill vs
merely reduce false confidence. These remain real-user-only questions. Also: not all 25 are
equal weight — the four P0 themes + safety are code-confirmed and robust; a few (F5, F9,
F15) are softer/contextual.

---

## Continuation (for another session / device)

- **Canonical = `origin/main`.** This doc + R50–R58 are there. Pull before starting:
  `git fetch origin && git checkout main && git pull --ff-only` (or work in a worktree:
  `git worktree add ../argus-main main`).
- **Webapp code rounds need `node_modules`** — a worktree has none; either `npm ci` there or
  junction the main checkout's `node_modules` (`mklink /J node_modules ..\argus\node_modules`).
  Run a single test with `node node_modules/vitest/vitest.mjs run <file>`.
- **One branch / one session at a time** — main is actively pushed to by multiple sessions;
  rebase before push (`git pull --rebase origin main`). Conflicts have been clean so far
  (different files).
- **Recommended order:** start with the four P0 small-effort fixes (safety, flat-gate,
  record honesty, machinery). Each is a self-contained round: fix → test → STRESS doc →
  commit → push. Reference findings by ID (F1–F25).
- **Note on R57/R58:** they made the authorship/calibration DATA honest; F11/F12 are the
  missing UI half (display losses + ai_surfaced). Finishing them closes that thread.
