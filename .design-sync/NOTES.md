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
- 3 components ship the **floor card** (fully importable, no authored preview):
  `ForkLimitToast`, `StorageErrorToast` (event-driven toasts — render null without
  a runtime event), and `SyncStatus` renders its real default ("동기화됨" pill).


- `[FONT_REMOTE]` Pretendard / Noto Serif KR / JetBrains Mono / Cambria — fonts are
  served remotely by design (no `@font-face` to ship). No action.
- `[TOKENS_MISSING]` ~11 vars: `--space-md/sm`, `--measure-normal`,
  `--accent-border-subtle`, `--border-strong`, `--accent-bg-subtle`,
  `--bg-secondary`, `--warning`, … — referenced by some components but undefined in
  `globals.css`. This is a **latent app bug** (those components fall back to
  initial values in production too), not a sync artifact. Some may be runtime-set.
  See Re-sync risks.

## Provider

None needed. `useLocale` is a self-contained hook (localStorage + useState,
defaults to `'en'`); `@/data/voyage-crew` is static data. Components render
standalone — no `cfg.provider`.

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
