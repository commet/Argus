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

- `[RENDER_THIN]` **ForkPath** and **SailingShip** — false positives. Both are
  sparse, textless line illustrations (SailingShip paints a full 46 KB ship;
  ForkPath a fork diagram). ForkPath's preview injects a `<style>` that disables
  its `bp-stroke-draw` / `bp-fade-up` entrance animations so the static capture
  shows the completed drawing (otherwise the staggered draw-in leaves it blank).
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

## ⛔ STALE-SUBSET HAZARD — do NOT run a full re-sync from this config (2026-06-25)

`config.json` `componentSrcMap` maps **43** components, but the live project
(`1d812d28-…`, "Argus Design System") indexes **117** (groups: agents, boss,
progressive, workspace, shared, tools, projects, layout, … — authored in other
sessions/elsewhere, NOT reproducible from this config). So this local config is a
**stale SUBSET of the remote**, and the standard re-sync path is DESTRUCTIVE:

- The atomic/incremental **reconciliation deletes** every remote `components/**`,
  `_preview/**`, etc. path not in the local build → would **delete ~74 live
  components**.
- It would also overwrite the shared `_ds_bundle.js` / `_ds_bundle.css` /
  `styles.css` / `_ds_manifest.json` with 43-component versions → the other ~74
  cards stop rendering (their `window.ArgusDS.<Name>` vanishes from the bundle).

**Until the FULL 117-component config is recovered** (find the larger config/entry
that built the remote — likely another branch/machine; it is NOT in this checkout),
treat re-sync as unsafe. Adding a single screen/component must go via the
**self-contained card** method used for `WorkspaceHome` on 2026-06-25:
- A `.design-sync/_screens/<Name>.tsx` composition + `_snippet-entry.tsx` built by
  `node .design-sync/_screens/build-snippet.mjs` (React external → `window.React`).
- Card HTML loads its OWN sibling `_bundle.js` + `_styles.css` (NOT shared
  `_ds_bundle.js`), so it touches zero shared assets.
- Push only the card folder + a **superset-merged** `_ds_manifest.json` (remote N + 1).
- Never put `_ds_bundle.js` / `styles.css` / shared files in the write plan, and
  never use the reconciliation-delete globs against this project.
