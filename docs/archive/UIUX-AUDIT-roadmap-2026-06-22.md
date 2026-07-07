# Argus UI/UX & Product Audit — Implementation Roadmap (2026-06-22)

> **For the session implementing this.** Two adversarially-verified, multi-agent audits
> (44 subagents total) produced this. It is split into a **PRODUCT/UX layer (lead — the
> things that decide whether the product works)** and a **VISUAL/design layer (downstream)**.
> Every finding cites a concrete file (and line where known) and a fix that **preserves
> Argus's identity and spine**. Read §0 first — the guardrails are non-negotiable.

- **Method:** 2 workflows. (1) Whole-app visual/design audit → 116 verified findings.
  (2) Whole-app product/UX *journey* audit → 62 verified findings. Each: map → audit per
  area/journey → adversarial verify (open files, confirm real, confirm identity/spine-safe)
  → synthesize. Findings here survived the verify pass.
- **One honest correction baked in:** some sub-findings claimed `/project` has no auth wall
  for anon and renders from `localStorage`. **The code contradicts that** — `AuthGuard`
  intercepts in `LayoutShell` before the page mounts. The loop is **BLOCKED, not merely
  undiscoverable** (the more severe reading). Trust the corrected version below.

---

## 0. Guardrails (apply to ALL work in this doc)

### 0.1 Identity — Argus is NOT a generic SaaS
Two **intentional** design registers:
- **Logbook (marketing/landing):** parchment `--bp-paper`, ink `--bp-ink*`, gold spent
  rarely, **Noto Serif KR serif headlines (serif is CORRECT — never "ban serif")**,
  "ink physics" (NO drop shadows / NO screen glass), `PaperGrain` noise.
- **App (product):** modern tokens `--accent` / `--surface` / `--bg` / `--text-*`, the
  workspace flow.

Translate any "premium" technique **into** the identity:
- Depth = **opaque paper/ink layering + 1px hairlines + inset highlights**, NOT
  glassmorphism / heavy shadows.
- Motion = **weighty house cubic-bezier scroll-reveals** `cubic-bezier(0.22,0.61,0.36,1)`
  (entrances) / `cubic-bezier(0.32,0.72,0,1)` (the house ease), NOT bouncy spring / bento.
- **Reject** any change that imposes generic SaaS aesthetics (Geist/zinc, neon, purple-AI,
  bento) onto Argus.

### 0.2 Spine — "maximum generation, zero judgment" (CLAUDE.md)
- **No user-facing verdict/score/tier about who the user is.** No "Workplace Master".
- **Never manufacture a fork on a flat decision.** Firing form = a bare neutral crux
  *question* or silence — never a directional statement, never a disclaimed lean.
- **Restraint over engagement.** Over-firing (judging *whether* to intervene) is also a
  violation.
- **Mirror clause (forward-looking, critical for the retention work below):** the
  return-loop fixes MUST NOT become engagement hacks. A due strip / badge / single email
  may fire ONLY because the user personally set the date and consented — never a
  manufactured nudge, streak, digest, or urgency. The calibration record stays
  **counts-only** (held / broke / marked-as-luck), never a tier or score.

### 0.3 Concurrent-work collision map — DO NOT TOUCH these (other sessions are editing them)
- **Share / email / telegram feature (active):** `src/app/api/email/**`,
  `src/app/api/telegram/**`, `src/lib/email-html.ts`, `src/lib/share-guard.ts`,
  `src/lib/telegram-format.ts`, `src/lib/telegram-state.ts`,
  `supabase/migrations/20260622_share_hub.sql`, and **`src/components/ui/ShareBar.tsx`**.
- **i18n message/locale string files** (active). For copy changes, use **inline bilingual
  `L()` strings** in the component (as `SealMoment` already does) — do NOT edit the locale
  message files. Defer any change that must amend locale strings (e.g. the "no emails"
  copy) until the i18n work lands.
- The app moved to `/[locale]/` routing — all routes are under `src/app/[locale]/`.

---

## 1. THE HEADLINE (read this even if you read nothing else)

**Argus's retention loop — the seal → return → settle loop, which IS the product and the
moat — is structurally under-built, and for the anonymous cold-start cohort (exactly who
the funnel acquires) it cannot close at all.** The seal makes a dated cross-time promise to
a surface the sealer is then walled out of, so the calibration ledger — the one thing
separating Argus from a chatbot — accrues for ~no one.

**This is more important than every visual finding combined.** Sequence the product/UX
work (§2) ahead of the visual work (§3). Do not polish a loop that doesn't close.

---

## 2. PRODUCT / UX ROADMAP (lead) — 62 verified findings

### 2.1 North-Star changes (the 2–4 that most move the product)

**A. Make the promised return REACHABLE (not just discoverable).** *Journey: anon
seal→return→settle. Highest leverage, low spine risk, no protected files.*
- **Problem (verified):** `SealMoment` promises "come to the project page on {date} and
  I'll ask first" (`SealMoment.tsx` ~L188–194, L313–314), links to `/project` (L198), and
  the `.ics` reminder `DESCRIPTION = origin+'/project'` (L152). But `/project` is **absent
  from `PUBLIC_PATHS`** (`src/lib/public-paths.ts` L8–19) → `LayoutShell` (L23/L45) wraps it
  in `AuthGuard` → anon sees a "Projects need an account" sign-in card (`AuthGuard` L77–108);
  the `localStorage` contract + auto-opening `SettlementModal` never mount. The due badge is
  independently dead for anon (`Header.tsx` L39 gates `loadProjects` with `if (user)` →
  `dueCount` always 0).
- **Fix:**
  1. A **public return/settlement surface** that reads the `localStorage` contract — add
     `/project` behind a *local-contract check* (render the settlement view if a local
     contract exists, else the sign-in card), **or** a minimal public `/s/<id>` deep-link.
  2. Compute `dueCount` from `localStorage` for anon (drop the `if (user)` guard on
     `loadProjects`) and surface a quiet **"so, how did it go? — N"** strip on the PUBLIC
     `/workspace` idle landing (the page anon + returning users actually re-enter), reusing
     `dueProjects` / `contractStatus`.
  3. Repoint the seal link (`SealMoment` L198) and the `.ics DESCRIPTION` (L152) at the
     reachable surface.
- **Spine:** the strip fires only on dates the user set; counts-only. No nudge invented.

**B. Move the mirror to the FRONT of the voyage.** *Journey: cold-start + core flow
(time-to-first-value). Pure reorder of existing beats — no new step, no spine cost.*
- **Problem (verified):** the active recognition beat (`Falsification`) renders only at
  phase `'testing'` — after analyzing → Q&A → `CrewAtWork` → mixing → `dm_feedback`. The
  early passive `hidden_assumptions` card is collapsed behind the `기록` toggle in default
  focus mode. So the value moment (recognition of the blank judgment) is gated behind
  minutes of LLM waits + crew theater; many first-timers bounce before seeing the mirror.
  `topAssumption` is **already computed** at `ProgressiveFlow.tsx` ~L745.
- **Fix:** surface one load-bearing hidden premise as a short interactive recognition beat
  **right after the streamed analysis, before crew/mix/DM-feedback** — reorder existing
  beats. At minimum, un-hide the `hidden_assumptions` card early in default focus mode.
  Pose it as a **question** ("this is the premise you didn't state — is it actually
  true?"), not a passive analysis field.
- **Spine:** a neutral crux question, not a directional statement; `ai_surfaced` shading.

**C. Arm the loop at the terminus of EVERY complete journey** (today they end on
generation or a verdict). *Journeys: boss + tools (the side funnels with their own
acquisition surfaces). Reuses `lib/decision-contract.ts`; keep changes in the contract
layer, NOT the share-card files.*
- **Problem (verified):** `grep` finds **zero** `decision_contract`/`SealMoment` across the
  four tool steps; `SynthesizeStep` captures the user's committed `user_judgment` (L553)
  then evaporates it into a Share button. The boss ends on the character's
  approved/rejected/conditional stamp + a **collect-16-MBTI Pokedex**. The loudest
  acquisition funnels deliver Argus as something it is NOT (verdict toy / doc generator).
- **Fix:**
  1. Hand `SynthesizeStep`'s committed `user_judgment` to a `SealMoment` that writes
     `project.decision_contract`, so a tools-chain project enters `dueProjects`/
     `SettlementModal` like the voyage.
  2. After the boss verdict, convert the rehearsal into the user's **own seal** ("you're
     going to actually say this — what are you betting happens, and when will you know?")
     via `lib/decision-contract.ts`.
- **Spine:** removes two violations at once (boss verdict-as-payoff; collect-em-all
  gamification). Adds no engagement surface. Depends on §A's reachable surface existing.

**D. Make the calibration record VISIBLE to the default user; stop the loop silently
failing to arm.** *Journey: returning user — seeing the moat accrue (trust).*
- **Problem (verified):** the "Your judgment patterns" card derives from `judgmentStore`,
  which **only the legacy 4-tool flow writes** — so the DEFAULT progressive voyage shows
  the user no track record at all. The `crossRecord` strip is a 12px tertiary-gray line,
  list-view only, behind login. And `SealMoment` renders `null` on zero predicates (L173)
  in BOTH the "correctly silent on a flat decision" case AND the "engine produced nothing"
  case — restraint and a hole look identical.
- **Fix:**
  1. Derive the patterns card from `decision_contract` data
     (`summarizeRecord`/`summarizeGrades` already exist in `lib/decision-contract.ts`); add
     a **"forming" state at N=1**; raise `crossRecord` salience.
  2. **Instrument seal-eligibility** so "correctly silent" is distinguishable from "engine
     produced zero predicates" (internal telemetry, not user-facing).
- **Spine:** `summarizeRecord` is already counts-only (held/broke/marked-as-luck) — no
  score/tier introduced.

### 2.2 🚨 URGENT — safety + spine, shipping in production NOW
**Port `crisis-gate.ts` into the boss entry.** The boss simulator forces a directional
verdict (approved/rejected/conditional) on **every** input — **including the burnout /
"thinking of quitting" prompts the UI itself seeds** — with no flat/vent/crisis
short-circuit. A roleplayed authority "rejecting" a vulnerable user is a **duty-of-care gap
+ spine violation**. `crisis-gate.ts` already exists and is wired into the progressive
engine but **NOT into boss**. When the situation reads as vent/identity/crisis rather than
a pitch, the boss must **not** issue a verdict — short-circuit to an off-ramp + the
human-resource banner. *Independent of the retention work; do not let it wait.*

### 2.3 Themes (counts = verified findings)
1. **Return loop fundamentally under-built, acutely for anon cold-start** — 19, *critical*.
   (anon `/project` auth-walled; due badge dead for anon; ZERO outbound trigger — seal copy
   L314 deliberately promises "no emails, no notifications", only cron is owner analytics;
   anon contracts in `localStorage` with no durability warning; `.ics` → walled page; due
   cue on `/project` not the `/workspace` users re-enter; post-auth lands on a cold
   new-decision canvas; Continue list sorts by recency, blind to due state; mobile hides the
   only return signal in the hamburger; calibration record invisible to default users.)
2. **Complete journeys end on generation/verdict instead of arming the loop** — 9,
   *critical*. (boss verdict + Pokedex; tools never seal, orphaned, dual host `/tools/*` vs
   in-page `?step=` legacy, dead `refine` branch.)
3. **Value/recognition moment arrives too late & mis-framed (activation)** — 8, *high*.
   (mirror gated behind the pipeline; default first-aha is a heavy over-claim ladder the
   component's own comments admit half of novices misread as the AI's real forecast; the two
   cold-start front doors disagree — landing = mirror, `/workspace` body copy still
   tool/document-framed; mobile input below the fold; boss's named "hidden layer" is
   astrology.)
4. **Spine drift — surfaces that judge / fork / gamify** — 8, *critical* (see §2.4).
5. **Trust durability & honest provenance — promises it can't keep** — 6, *high*. (anon
   seals only in volatile `localStorage`, no durability warning; the "no emails" stance
   converts the core differentiator into a memory test a busy decision-maker fails; the
   `.ics` fires onto a login wall for the anon user most likely to need it; the boss "may
   differ from reality" caveat absent at the emotional peak.)
6. **Mechanic legibility & orphaned/duplicated surfaces (clarity)** — 7, *medium*.
   (`Synthesize` is "이타카" in the intro and "조율" in the body; three nautical metaphors
   stacked on English tool names; tools are islands with no shared stepper; dual host risks
   one path silently rotting; two cold-start front doors compete.)
7. **Mobile — the primary device has the weakest return & activation path** — 5, *medium*.
   (only global due indicator buried in the hamburger; desktop Sidebar `/project` link is
   `lg`-only; Header badge dead for anon; landing pushes the input below an animation.)

### 2.4 Spine risks (zero-judgment violations in default paths)
1. **Boss forces a directional verdict on every input incl. seeded burnout/quitting
   prompts; no crisis short-circuit.** Most urgent (= §2.2). `crisis-gate.ts` exists, not
   wired to boss.
2. **`Falsification` believe-all (no-flinch) asserts a directional statement** — "the
   belief I see as riskiest is this" / "whether this holds is where the plan succeeds or
   fails" — in the DEFAULT path. Convert to a neutral crux question or surface nothing
   (CLAUDE.md rounds 5–8: a disclaimed/engine-weighted lean still tests as a violation).
3. **`ReframeStep` renders `reframed_question` as a bold, authoritative, primary-colored
   verdict about what the problem "really" is, with NO `user`/`ai_surfaced` provenance tag,
   plus a 2–3-way fork picker** — the confident-reframe → agree → lock-in trap. Restraint
   default: one neutral crux question, `ai_surfaced` shading, drop the weighted fork.
4. **Boss retention surface = collect-all-16-MBTI Pokedex** with milestone badges + a
   "Workplace Master" completion; "try another type" resets to a RANDOM personality. The
   canonical gamification the thesis forbids. Replace with the calibration ledger.
5. **Boss post-verdict calibration frames the sim as PREDICTIVE** ("how close is this to
   your ACTUAL boss?" with a "소름 / Eerie" top rating) and omits the "may differ from
   reality" caveat at the emotional peak. Re-assert the rehearsal frame; drop the predictive
   framing.
6. **Boss verdict trajectory = client-side keyword counting + a round-7 auto-flip to
   "convinced" regardless of content.** A hidden rules engine tilting the conclusion on the
   user's first run — the un-launderable engine-weighted lean the stress tests flagged.
   Remove the auto-flip.
7. **Mirror clause** (§0.2) — the return-loop fixes must not themselves drift into
   engagement hacks.
8. **Restraint observability** (blind spot, not a violation): instrument `SealMoment`'s
   null-render so principled silence is distinguishable from a broken loop (= §D.2).

### 2.5 Sequencing (the audit's recommended order)
1. **Frame it:** this is NOT a visual pass — the loop (moat) and activation are
   under-built; the visual roadmap (§3) is downstream and must not be sequenced ahead.
2. **Make the return reachable** (North-Star A). Touches `Header.tsx`, `LayoutShell.tsx`,
   `public-paths.ts`, `src/app/[locale]/workspace/page.tsx`, `SealMoment.tsx` — **NOT**
   email/share/i18n. Highest leverage, unblocks everything downstream.
3. **Reorder the voyage so the mirror comes first** (North-Star B). Pure reorder in
   `ProgressiveFlow.tsx` (+ `Falsification`/`hidden_assumptions`). No protected files.
4. **Port `crisis-gate.ts` into boss NOW** (§2.2). Urgent safety; independent; parallelizable.
5. **Arm the loop at every terminus** (North-Star C). `SynthesizeStep`, boss verdict →
   `lib/decision-contract.ts`. Keep in the contract layer. Depends on step 2.
6. **Remaining spine remediations** (parallelizable): §2.4 items 2,3,4,5,6.
7. **Make the moat felt** (North-Star D). Derive patterns from `decision_contract`;
   "forming" state; instrument seal-eligibility. Counts-only.
8. **Durability honesty + the ONE consented settlement-day email — COORDINATE, do LAST.**
   Touches `api/email/*` (concurrently edited) AND requires amending the L314 "no emails,
   no notifications" copy in the same change → sequence AFTER the concurrent email/i18n
   work lands. Until then the public due strip (§A) + `.ics` carry the return.
9. **Legibility cleanup** (lowest, coordinate with §3): decide the tools' fate (retire the
   orphaned `/tools` tree + dual host, or give one front door + shared stepper); one name
   per step (kill Ithaca-vs-조율); align the two cold-start front-door copies.

---

## 3. VISUAL / DESIGN ROADMAP (downstream) — 116 verified findings

### 3.1 Cross-cutting roots (fix the root, not each symptom)
- **TOKEN DUALITY IS THE ROOT.** `--bp-*` (logbook) and `--accent/--surface` (app) are the
  two sanctioned registers, but (a) gold has **5+ overlapping defs** with no canonical ramp
  (`--accent #96782e == --bp-gold`, `--accent-light #b8963e == --gold`); (b) an
  **un-sanctioned third register** (purple-AI "이면") is hardcoded as ~48 raw `rgb()`s
  leaking out of its one locked card into generic chrome (`.pr-*` refine buttons,
  `.bc-recap`, step navigator `#9b5de5`). Fix = one `--gold-1..5` ramp aliased to both
  registers + one **contained** `--ime/--boss` token set kept to the deliberate reveal,
  never UI furniture.
- **UNDEFINED-TOKEN INVISIBILITY.** `--warning` and `--bg-hover` are referenced but never
  defined → resolve to transparent → a verdict dot + section chrome silently vanish. Add a
  lint guard: every `var()` used must have a `:root` definition.
- **DARK-MODE DECOUPLED AT THE ROOT.** `globals.css` has **no `@custom-variant dark`** → in
  Tailwind v4 every `dark:` utility tracks `prefers-color-scheme`, not the real
  `[data-theme="dark"]` toggle `Header.tsx` drives. Compounded by `@theme inline` baking
  light shadow literals into `shadow-*` (53 tsx files) + ~50 hardcoded hexes. **Token
  discipline IS the dark-mode fix** — any literal re-introduces the bug.
- **APP-WIDE MISSING `:focus-visible`.** Workspace tree has 0 focus-visible; 12 surfaces
  strip the ring to nothing → unusable by keyboard/switch users. One global rule (gold ring
  + `--bg` offset); the blueprint register needs its own **SQUARE ink focus** (radius:0,
  `--bp-ink`) so the rounded gold ring doesn't break the ink-plate vocabulary.
- **APP-WIDE GLASSMORPHISM.** `backdrop-blur` recurs on both registers (`LandingHeader`
  scrolled, ProgressiveFlow sticky status bar, modal scrims, `VoyageChart`, `PingToast`,
  `InteractiveDemo`, `AgentProfile`) — the exact "screen glass" the logbook is defined
  against. Translate: opaque `--bg/--surface` (or `color-mix` parchment) + 1px hairline +
  optional inset highlight.
- **reduced-motion gaps:** only landing selectors are gated; boss + workspace infinite
  loops and global `scroll-behavior:smooth` are ungated.
- **No spacing scale:** radius is tokenized, spacing is raw 8/10/12/14/16/18/20/24 literals.
  Introduce `--space-1..8` (8pt) for the app register; leave the bp 24px ink-grid alone.
- **No missing-state convention:** `alert()` in one place, infinite skeleton with no error
  branch in another. Establish one inline ink-toned "unavailable — retry" component.

### 3.2 Quick wins (high impact / low risk / mostly one-liners)
- Add `@custom-variant dark ([data-theme="dark"] &);` to `globals.css` — **one line
  reconnects every workspace `dark:` utility to the real toggle. Highest-leverage line in
  the visual audit.**
- Swap `CollectionProgress`'s `var(--warning)` → `var(--risk-manageable)` — the
  silently-invisible verdict dot appears.
- Define `--bg-hover` once (`:root` ~`#efece6` / dark `#363330`) — restores agent badge +
  level-pill fill.
- `html { scroll-padding-top: clamp(56px,8vh,72px) }` — fixes all landing anchor jumps
  tucking under the fixed header.
- Gate global `scroll-behavior:smooth` behind `@media (prefers-reduced-motion:no-preference)`.
- Remove the two inline opacity overrides on locked `AgentCard` (name was ~0.2 effective);
  lower the container to ~0.7 — restores legibility while still dimmed.
- Scope blueprint focus: `.bp-root :focus-visible { border-radius:0;
  outline-color:var(--bp-ink); outline-offset:2px }`.
- Replace `RehearseStep` `alert()` with the existing inline `--danger` banner + retry
  (CLAUDE.md forbids OS dialogs).
- `AgentCard`: handle `Space` as well as `Enter` (ARIA button contract).
- `PaperGrain`: `useId()` for the SVG pattern id (kills duplicate IDs across 5 sections).
- `aria-hidden="true"` on both film roots (stops SR crawling mid-animation typed text).
- `AgentProfile` observations: `[...observations].sort()` (stop in-render store mutation).
- Footer: drop stale "recast" copy; move onto `--bp-paper/--bp-ink` + hairline.

### 3.3 Batches (each notes risk + identity guard + collision-safety)
1. **Token foundation** (`globals.css` token defs only): `@custom-variant dark`; define
   `--bg-hover`, fix `--warning`, add `--skeleton-sheen`; collapse gold to one `--gold-1..5`
   ramp aliased to both registers; drop the shadow remap from `@theme inline` (standardize
   `var(--shadow-*)`); add `--space-1..8` (def only); `scroll-padding-top` + gate smooth
   scroll. *Risk: medium (shared spine — needs a dark-mode smoke pass), but token defs only.*
2. **App-register a11y:** one global `:focus-visible` (gold ring + `--bg` offset); square
   ink focus for `.bp-root`; `AgentProfile` modal (`role=dialog`/`aria-modal`/labelledby/
   Esc/focus-trap/return-focus, `max-h-[85dvh]`); `AgentCard` Space; films `aria-hidden`;
   touch targets ≥40px. *Risk: low.*
3. **De-glass (ink-physics depth):** `LandingHeader` scrolled, ProgressiveFlow sticky bar +
   pill, modal scrims, `VoyageChart`/`PingToast`/`InteractiveDemo` → opaque + hairline +
   inset, no blur; stop animating `max-width` on phase change. *Risk: low–med; review both
   themes.*
4. **Scroll-reveal & motion:** gate `bp-fade-up` entrances on intersection via the
   already-shipped `useScrollReveal` (same translate/ease — only the trigger moves from
   mount → viewport); `Act2` trail: observe the SHORT `<ol>` at `threshold 0` +
   `rootMargin -60px` (not the tall section) so the deliverable reveals on mobile;
   `UnlockToast` spring → tween `ease:[0.32,0.72,0,1]`; boss reduced-motion gating;
   `BossChat` auto-scroll only when near bottom. *Risk: low.*
5. **Contain the purple-AI "이면" third register:** extract `--ime/--boss` tokens, route the
   ~48 purple literals through them; keep purple ONLY on the locked inner-monologue reveal;
   pull purple OUT of `.pr-mini-btn-refine`, `.pr-proposal`, `.bc-recap`, `.bs-persona-meta`,
   the rainbow step navigator → app `--accent`/neutral; rename duplicate `.bs-birth`.
   *Risk: medium; review the reveal in dark.* **Preserves the deliberate reveal as a named
   token — does not delete it.**
6. **Semantic color tokenization:** landing alert pair `--bp-alert #a14b3b/--bp-alert-tint`
   (restrained ink-red, NOT SaaS error-red); role text tokens for `#2d4a7c`/`#2d6b2d`;
   verdict/mood/event hues → `var(--success)/--danger/--accent` + `color-mix` (drop purple
   mood onto ink/gold); `CurrentBearingCard` caution-chip text → AA-safe `--accent` (gold
   reserved for fills, never <12px text); **Convergence meter recolored on restraint**
   (neutral → gold → success, **never red/--danger** — that's a "you're failing" verdict).
   *Risk: medium; literal→token, dark improves. Does NOT touch `ShareBar`.*
7. **Missing states & code hygiene:** `AgentHub` skeleton uses the real `.agent-grid` +
   matching height + empty/error branch (no infinite `aria-busy`); `RehearseStep`
   `alert()`→banner; `PaperGrain` `useId()`; clone-before-sort; dead `.boss-message`→`.bm`;
   one reusable inline empty/error component. *Risk: low.*
8. **Spine/content & typography — COORDINATE (copy may live in i18n):** reframe
   `CollectionProgress` milestones (skill tier → neutral coverage facts); locked
   `AgentCard` "Unlocks after N tasks" → "joins the crew after N voyages"; `SirenHero` CTA
   stays navy ink (protect the Act3 gold climax); MBTI codes/counters → mono + tabular-nums;
   `agent-hub-title` → `var(--font-display)`; structural glyphs emoji→lucide (keep per-crew
   character emoji). *Risk: medium — SEQUENCING: strings likely live in locale files the
   i18n agent edits → do the CSS/structural half now, hand the string half to that agent or
   do it last.* **Note overlap with §2.4 (CollectionProgress skill-tier = a spine
   violation, not just a copy nit).**

---

## 4. Status & provenance
- Both audits are **adversarially verified** (each finding re-confirmed against the code by
  a second agent; identity/spine-violating "fixes" rejected).
- `/project` auth-wall correction (§0) is the one place the raw findings were wrong and
  were corrected here.
- Generated 2026-06-22 by two `/ultracode` workflows (44 subagents). The landing redesign
  that prompted this (films-in-hero, trust section, mobile scale-to-fit) is already merged
  to `main` (PR #17).
