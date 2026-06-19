# design-sync NOTES — Argus

Argus is a **Next.js app, not a packaged design system**. This is an off-script
(`shape: package`, synth-entry) sync. Read this before any re-sync.

## How the build works (off-script)

1. **styles.css is generated, not scraped.** There is no `dist/` CSS — styling is
   Tailwind v4 JIT + CSS-variable tokens in `src/app/globals.css`. Regenerate with:
   ```
   node .design-sync/build-css.mjs
   ```
   It compiles `globals.css` with the repo's `@tailwindcss/postcss` over the full
   source tree (faithful superset) and prepends the 3 remote brand-font `@import`s
   (Pretendard / Noto Serif KR / JetBrains Mono — loaded via `<link>` in
   `src/app/layout.tsx`, not in CSS). `cfg.cssEntry` points at the output.
   **Re-run this whenever `globals.css` changes, before the converter.**

2. **The converter needs `--entry ./.design-sync/_bundle-entry.tsx`.** That file
   re-exports all 24 scoped components. Two reasons it's required:
   - Without `--entry`, `PKG_DIR = node_modules/argus`, which doesn't exist
     (a repo never self-installs) → `ENOENT package.json`.
   - With `--entry <single component>`, the bundle contains ONLY that component
     (`window.ArgusDS` had just `Button`). The all-24 re-export entry both bundles
     everything AND lets `PKG_DIR` walk up to the repo root.
   Regenerate `_bundle-entry.tsx` if the component scope changes (keep it in sync
   with `componentSrcMap`).

   Full build command:
   ```
   node .ds-sync/package-build.mjs --config .design-sync/config.json \
     --node-modules ./node_modules --entry ./.design-sync/_bundle-entry.tsx --out ./ds-bundle
   node .ds-sync/package-validate.mjs ./ds-bundle
   ```

## Known render warns (triaged — not new on re-sync)

- `[RENDER_THIN]` **SailingShip** — false positive: a sparse, textless line
  illustration that paints a full 46 KB ship. Recorded; not new.
- `[RENDER_THIN]` **BranchMap** — false positive: a narrow (≤320px) version-tree
  SVG. The authored preview adds a `bp-mono` caption so it clears the check.
- **ForkPath was rewritten (2026-06-19) into the "Bearing Fan"** (a wide
  viewBox-1000x400 diagram: one plan → a gold divergence pivot → four reader
  lines fanning into a gold wedge → a dashed return arc to a date buoy). It now
  has real content (no longer `[RENDER_THIN]`). Its entrance animation classes
  changed from `bp-stroke-draw`/`bp-fade-up` to **`.bf-draw` / `.bf-soft` /
  `.bf-glow`** (a one-shot IntersectionObserver-gated self-draw). Because a
  static capture lands mid-draw, BOTH `previews/ForkPath.tsx` AND
  `previews/SirenHero.tsx` (SirenHero embeds the Bearing Fan) inject a `<style>`
  that freezes those classes to their end-state (`animation:none`,
  `stroke-dashoffset:0`, `opacity:1`, `transform:none`). **If ForkPath's
  animation classes change again, update the freeze rule in both previews** or
  the cards capture blank/half-drawn.
- **SeaRipples** preview overrides the component's default `position:absolute`
  className so it renders inline on a parchment panel (waves are deliberately faint).
- 2 components ship the **floor card** (fully importable, no authored preview):
  `ForkLimitToast`, `StorageErrorToast` (event-driven toasts — render null without
  a runtime event). `SyncStatus` renders its real default ("동기화됨" pill).
- **RateLimitBadge** reads a shared `window` `argus:ratelimit` CustomEvent, so
  multiple instances on one page converge to the same value → a multi-cell variant
  sweep trips `variants render identically`. Preview is intentionally **single-cell**
  (the near-limit "low" state). Don't "fix" it back into a 3-state sweep.


- `[FONT_REMOTE]` Pretendard / Noto Serif KR / JetBrains Mono / Cambria — fonts are
  served remotely by design (no `@font-face` to ship). No action.
- `[TOKENS_MISSING]` ~11 vars: `--space-md/sm`, `--measure-normal`,
  `--accent-border-subtle`, `--border-strong`, `--accent-bg-subtle`,
  `--bg-secondary`, `--warning`, … — referenced by some components but undefined in
  `globals.css`. This is a **latent app bug** (those components fall back to
  initial values in production too), not a sync artifact. Some may be runtime-set.
  See Re-sync risks.

## Provider + browser shims (2026-06-18 — landing sections + ui added)

The original 24 were self-contained (`useLocale` = localStorage+useState defaulting
`'en'`; static data). The **18 added on 2026-06-18** (5 landing sections, 10 ui, 3
chart illustrations from `VoyageElements.tsx`) pulled in three standalone-render
blockers. All are solved WITHOUT touching production code, via two design-sync-only
files re-exported from `_bundle-entry.tsx`:

1. **`_process-shim.ts`** (imported on the entry's FIRST line, before anything else):
   - Next's `app-router-context.shared-runtime.js` reads `process.env.NODE_ENV` at
     module-eval with no guard → `ReferenceError: process is not defined` → whole
     bundle crashes → every preview blank. Shim defines `globalThis.process.env`.
   - `src/lib/supabase.ts` runs `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, …)`
     at module-eval (stores import it) → `Error: supabaseUrl is required.` Shim sets
     dummy `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` (inert — previews never fetch).
   - **Import order is load-bearing**: the shim MUST be the entry's first statement.
2. **`_design-providers.tsx`** → `DesignRouterProvider`, wired via
   `cfg.provider`. It nests TWO contexts, both needed by added components:
   - **App Router** (`AppRouterContext`): `Act2DecisionVoyage` and `SirenHero` call
     `useRouter()` at render; outside Next it throws. The stub supplies a no-op
     router (both only `router.push()` in click handlers, never at render).
   - **AuthProvider** (`../src/lib/auth`): `LandingHeader` calls `useAuth()` which
     throws outside the provider. AuthProvider's only mount side-effect is
     `supabase.auth.getSession()` → with the dummy env it rejects → `{loading:false,
     user:null}` = signed-out state. Imports `_process-shim` on its FIRST line so
     gotrue's `process.nextTick`/`process.env` refs are defined before it evaluates.
   `cfg.provider` wraps EVERY preview — harmless for components that don't read either.
   **Gotcha that cost two rebuilds:** gotrue (via getSession) needs `process.nextTick`
   too, not just `process.env` — the shim now stubs nextTick/version/platform as well.

Zustand stores (`ExecutionReadiness`, `OutputSelector`, `ShareBar`, `SlackChannelPicker`)
need NO provider — they're module singletons; an empty store just renders empty, so
those previews pass realistic data via props instead.

## Authored-preview patterns for the added set

- **Scroll-reveal sections** (`Act2DecisionVoyage`, and any Act* / SirenHero that
  reveal on `IntersectionObserver`): a static capture never scrolls. These components
  short-circuit to "reveal everything at once" under `prefers-reduced-motion`, so the
  preview overrides `window.matchMedia` to report reduced-motion (+ neutralizes the
  `bp-fade-up` entrance). See `previews/Act2DecisionVoyage.tsx` — copy that header.
- **`position:absolute` illustrations** (`Graticule`, like `SeaRipples`): wrap in a
  sized `position:relative` box or they collapse to nothing.
- Sections are no-props + `cfg.overrides.<Name>.cardMode = "column"` (full-width).
  `SlackChannelPicker` is an overlay → `{cardMode:"single", viewport:"440x520"}` + `open:true`.
- **localStorage-seeding for store components** (ExecutionReadiness, OutputSelector): the
  stores hydrate synchronously from `localStorage` via the literal `STORAGE_KEYS` strings
  (`sot_reframe_list`, `sot_recast_list`, `sot_personas`, `sot_feedback_history`,
  `sot_judgments`, `sot_settings`). Seed them at preview module scope (guarded by
  `typeof window`) and the store's mount effect picks them up — no store export needed.
- **`bp-fade-up` entrance** (Act1/Act3/SirenHero): 800ms opacity:0→1, NO IntersectionObserver
  — neutralize per-preview with `.<name>-preview .bp-fade-up{animation:none;opacity:1}`.
  Only `Act2DecisionVoyage` actually reveals on scroll (needs the matchMedia override).
- **`Graticule`/`ChartEdge`** are background/inline chart fragments — only visible inside a
  sized `position:relative` `var(--bp-paper)` panel (SeaRipples pattern).
- **`GuidedInput`/`InterviewInput`** render nav/submit labels in the bundle's default locale
  (Korean) even on English cells — component-internal i18n, only `submitLabel` is overridable.
  Not a defect.

## 2026-06-19 — workspace/app expansion (42 → 117 components)

Added ~75 workspace/boss/agents/tools/projects/layout surfaces. Excluded pure infra
(`Providers`, `AuthGuard`, `Analytics`, `LayoutShell`). Big stateful orchestrators are
**accepted floor cards** (importable, no authored preview): `ProgressiveFlow`,
`InteractiveDemo`, the Step files, `BossChat`/`BossSetup`, `PersonaForm`, `AgentSidebar`,
`AgentHub`, `WorkerPanel`/`WorkerDrawer`, `Logbook`/`LogbookDrawer`, `VoyageChart`,
`PersonaPoolModal`, `NavigatorStrip`, `FeedbackResult`/`FeedbackRequest`,
`PersonaRefinementSection`, `VersionHistoryDrawer`, `SealMoment`, `TrialSail`, `QuickChatBar`.

**Two load-bearing findings (independently hit by most batches):**

1. **framer-motion entrances capture BLANK.** `package-capture`/validate pin a fixed clock
   (`page.clock.setFixedTime`), which freezes framer-motion's JS tween at its
   `initial={{opacity:0}}` frame → the root screenshots blank. The repo bundles its OWN
   framer-motion copy, so `MotionGlobalConfig.skipAnimations` from a preview's import does
   NOT reach it (React is externalized/shared; framer-motion is not). The reliable fix is a
   **module-scope `<style>` injected in the preview**: `[style*="opacity"]{opacity:1!important}`
   `[style*="transform"]{transform:none!important}` — `!important` overrides framer's inline
   styles and the attribute-selectors touch only animating elements. ~30 previews carry this;
   any new `motion.*`-rooted component needs it. For a `position:fixed` overlay inside a cell,
   contain with `contain:paint` (a `transform` wrapper collides with the un-freeze style).
   Also: the clock is pinned to a FIXED DATE — author date-gated states relative to it.

2. **Store-sharing wall.** The bundle ships its own Zustand store instances. A preview that
   re-imports `useXStore` gets a SEPARATE instance — `setState` never reaches the bundled
   component. Two patterns that work: (a) **seed localStorage at preview module scope** via the
   literal `STORAGE_KEYS` (`sot_reframe_list`/`sot_recast_list`/`sot_personas`/
   `sot_feedback_history`/`sot_judgments`/`sot_settings`/`sot_agents`/`sot_boss_collection`) for
   stores that hydrate on mount; (b) for non-persisted stores, render a HIDDEN bundle component
   whose mount effect populates the shared store (e.g. an off-screen `AgentHub` calls
   `loadAgents`→`checkUnlocks` so `UnlockToast`/`PastVerdictRecap` see the data).

**Provider now also supplies** `PathnameContext`/`SearchParamsContext`/`PathParamsContext`
(Sidebar/Header `usePathname`). **cardMode overrides** added: column for `FinalCard`,
`MixPreview`, `TeamDeployBanner`, `DMFeedback`, `AttributedSection`; single for `SettlementModal`
(480x640). **`Sidebar` is floored** — it renders only an empty shell without seeded
`projects`/`personas`; to author it later, seed those stores. **`BranchMap` trips `[RENDER_THIN]`**
but is a sparse SVG branch diagram (benign, like `SailingShip`/`ForkPath`). `InnerMonologueCard`
shows only its in-verdict-context cell (the bare locked state renders empty without a loaded boss agent).

## Design context

Token contrast/weight pass applied to `globals.css` on 2026-06-18 (text tiers,
borders, shadows, `--gradient-gold`) — see git. Target-state design vision lives
in `docs/PLAN_design_vision.md` (editorial "Logbook" / dawn-harbour system).

## Re-sync risks (watch-list)

- `_bundle-entry.tsx` and `componentSrcMap` must stay in sync with each other and
  with the actual files. A renamed/moved component breaks the entry's relative path.
- `[TOKENS_MISSING]` vars: if Argus later DEFINES them in `globals.css`, the warn
  clears on its own; if it starts USING more undefined vars, a new name appears —
  check it's not a real broken style.
- `build-css.mjs` depends on the repo's `@tailwindcss/postcss` being installed
  (it is, via the app's own deps) — on a fresh clone run `npm ci` first.
- styles.css is a full-app superset (~239 KB). If size becomes a problem, scope
  Tailwind content to the scoped component dirs + `.design-sync/previews/`.
- **The 3 design-sync-only files are load-bearing and NOT shipped to the app:**
  `_process-shim.ts`, `_design-providers.tsx`, and their first-line import order.
  If a re-sync regresses to blank previews with `process is not defined` /
  `supabaseUrl is required` / `useAuth must be used within AuthProvider`, the shim
  or provider import order broke — check `_bundle-entry.tsx` imports `_process-shim`
  on line 1 and `_design-providers` imports it first too.
- **`SlackChannelPicker` / `ShareBar` Slack button** show only the DISCONNECTED state.
  `useSlackStore` is Supabase/`fetch('/api/slack/channels')`-backed (not localStorage),
  inert in capture, and not exported from `_bundle-entry.tsx`. To show a populated
  channel list later, export `useSlackStore` from the entry and `setState` it in the
  preview, or add a fetch/auth shim. Low priority — disconnected is a real, polished state.
- If a landing section is renamed/restructured in `src/components/landing/`, its preview's
  `matchMedia`/`bp-fade-up` neutralizer may need updating (re-check the captured trail).
- **`[BUNDLE_EXPORT] N/N not a component on window.ArgusDS` is a FALSE NEGATIVE on this
  large bundle (~3.8 MB, 117 components).** validate's smoke check loads react+react-dom+bundle
  via `page.setContent` and reads `window.ArgusDS`; on the big bundle it reads empty (passed at
  42 components / 1.9 MB, fails at 117). It is NOT real: the bundle ends with
  `window.ArgusDS = …` and the per-preview render check renders 99 non-floor components with real
  content — each imports `window.ArgusDS.<Name>`, which is dispositive proof the exports resolve.
  claude.ai/design loads the bundle exactly like the preview HTML (react→react-dom→_ds_bundle.js
  script tags), which works. **Verdict gate:** trust `render check: N/N clean` + all-graded; the
  `[BUNDLE_EXPORT]` exit-1 from this check alone is safe to upload over (bumping its 10s timeout
  did NOT help — it's the setContent smoke path, not a timeout). If the bundle ever shrinks back
  under the threshold this clears on its own.
