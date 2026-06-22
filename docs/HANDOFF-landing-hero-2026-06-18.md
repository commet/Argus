# Handoff — Argus Landing / Hero Overhaul (2026-06-18)

Self-contained guide so a future session can **continue improving** the landing page
without re-deriving the context. Read this top to bottom, then look at the renders in
`docs/landing-renders/`, then `npm run dev` and iterate.

---

## 0. TL;DR — current status

The landing page (`/`) was overhauled from first principles (research-backed), shipped, and
deployed to **https://argus.voyage**. Highlights:

- **Hero diagram replaced entirely**: the shabby `ForkPath` (trunk → 3 routes) → **"Bearing Fan"
  (침로 부채꼴)**: one plan, read by four eyes that *agree cheaply* (hug) then *fan open* at one
  gold pivot (= the judgment you left blank), with a dashed **return** arc to the date you set.
- **Input rebuilt** as a logbook **chart-field** (corner ticks + ruled baseline, persistent
  `LOG ENTRY` label), **pen-meets-paper focus** (ink baseline inks in from the left — the old
  cheap **gold focus box is gone**), and a **gold-ignite CTA** when there's text.
- **Copy** rewritten where it was weak/translationese; Korean **line breaks hand-set** so no
  word dangles.
- **Voyage (below the fold)** retimed and trimmed: visible **"sounding line"** scroll cue,
  smaller/clearer Act 1, faster + shorter Act 2, **Act 3 "방위" demoted** (it was redundant with
  Act 2's "현재 방위" card) to a closing CTA band.

Shipped commits: `f80ec45` (copy + ForkPath first pass) and `cae2edf` (the big overhaul).
Lint + browser console are clean. **Biggest open gap: the Bearing Fan is cramped on mobile**
(see §6).

---

## 1. How to render & verify (do this FIRST every time)

The owner's hard rule: **render and look — never ship hero copy/layout unrendered.**

```bash
cd /c/Users/admin/documents/github/Argus
npm run dev            # Next.js dev → http://localhost:3000  (landing = "/")
```

Screenshot recipe (Playwright is already a dependency; the script must live INSIDE the repo so
`import 'playwright'` resolves). Example used throughout this work:

```js
// _shot.mjs  (delete after use)
import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.waitForTimeout(2800);                 // let the bearing-fan one-shot anim finish
await p.screenshot({ path: 'C:/Users/admin/AppData/Local/Temp/argus.png' });
await b.close();
```

Useful variations: focus the input (`await p.locator('textarea').first().click()` then `.type(...)`)
to see the focus state + gold CTA; tight-crop the diagram with `await p.$('svg[role="img"]')` →
`el.screenshot()`; mobile with `viewport:{width:390,height:844}`; full page with
`fullPage:true` after scrolling to trigger Act 2's reveal. Capture console errors with
`p.on('console', m => ...)` — we keep this at **0**.

Reference renders (committed): `docs/landing-renders/` —
`hero-bearing-fan.png`, `hero-incontext-desktop.png`, `input-focus-state.png`,
`full-page-desktop.png`, `mobile-hero.png`.

---

## 2. File map (what lives where)

- `src/app/page.tsx` — composition: `<SirenHero/> <Act1Voyage/> <Act2DecisionVoyage/> <Act3OnDeck/> <Footer/>`.
- `src/components/landing/SirenHero.tsx` — **the hero / first screen**: kicker → headline
  `"그래서, 어떻게 됐어요?"` → problem pitch → **Bearing Fan** → resolving line → **chart-field input**
  → how-it-works line → demo link → **sounding-line scroll cue**.
- `src/components/landing/voyage/illustrations/ForkPath.tsx` — **the Bearing Fan SVG**. NOTE: the
  exported component is still named `ForkPath` (the concept changed; the name was kept to avoid
  churn in SirenHero's import). Consider renaming to `BearingFan` later.
- `src/components/landing/voyage/Act1Voyage.tsx` — "항해 / The Voyage": SailingShip + headline +
  "what it does".
- `src/components/landing/voyage/Act2DecisionVoyage.tsx` — "항적 / The Trail": one worked decision
  (3 beats) + the "현재 방위 / Current Heading" Arrival card (4 fields) + inline input.
- `src/components/landing/voyage/Act3OnDeck.tsx` — closing band: HelmScene (gold dawn) + final CTA.
- `src/app/globals.css` — design tokens + the bp-* component classes. Key blocks I touched:
  `*:focus-visible` (gold ring, line ~205), `.bp-input-frame`/`.bp-hero-input` (~2680+), and the
  **new** `.bp-hero-input:focus{outline:none}` + **`.bp-sounding-line`** scroll-cue keyframes.

**Design language** (do not break it): an 18th-c. nautical **logbook / blueprint**.
Tokens: `--bp-paper #f4ede0`, `--bp-paper-deep`, `--bp-ink #1a2a3a`, `--bp-ink-soft`, `--bp-ink-faint`,
`--bp-gold #96782e` / `--bp-gold-deep`. Serif display headlines (`--font-display`), mono marginalia.
**Gold is spent exactly once per screen** (the value moment). Korean `word-break:keep-all`, warm 해요체.

**Voice / spine (non-negotiable):** "maximum generation, zero judgment" — Argus *surfaces*, never
judges/decides for you. The two emotional axes (`docs/FRAMEWORK-decision-navigation.md` §7) are
**알아봄** (being truly *read* — rare, vs the cheap "좋아 보여요") and **귀환** (the return). No
score/verdict/판정 vocabulary on the surface. Never write "we don't judge"; show it.

---

## 3. What changed this session (the overhaul)

### Hero diagram → "Bearing Fan" (`ForkPath.tsx`, full rewrite)
- viewBox `0 0 1000 400`; container in SirenHero breaks out of the text column to
  `width:min(840px,92vw)` (centered via `marginLeft:50% / translateX(-50%)`).
- Layers (3+ stroke-weight hierarchy is what fixes "cheap"): faint grid `@7%` < reader hairlines
  1.6px ink-soft < the plan **3px ink** < the **gold wedge wash + one gold node**.
- One plan line (left → gold pivot at ~40%); four reader lines **hug** then **fan wide** into a
  gold wedge (open circles = unsettled readings); dashed **return** arc to a `6.30` date buoy
  ("정한 날, 먼저 물어와요"); navy annotation "여기서 길이 갈려요 / 아직 비워둔 판단입니다"; marginalia plate.
- Motion: one-shot on view (IntersectionObserver, ~2.2s), **opacity / stroke-dashoffset only**
  (CSS `transform` on SVG groups is fragile — see §7); `prefers-reduced-motion` → final state.

### Input → logbook chart-field (`SirenHero.tsx` + `globals.css`)
- Persistent label `LOG ENTRY · 들고 계신 결정` (purpose no longer depends on the placeholder).
- Corner ticks + a ruled baseline. **Focus** = ticks darken/lengthen + an ink baseline **inks in
  from the left** (`scaleX(0→1)`); **no gold ring** (added `.bp-hero-input:focus{outline:none}` to
  suppress the global `*:focus-visible` gold).
- CTA "읽어봐 주세요" — quiet ink-soft outline when empty → **gold fill ignites** when there's text.
- Footer microcopy folds the Enter hint + privacy into one line (removed the separate full-bleed
  privacy hairline, which read as a "false bottom").
- Placeholder: heavier first-person examples, `예) …`, italic.

### Copy + line breaks (`SirenHero.tsx`)
- Resolving line tail rewritten (antithesis callback): `…그저 당신의 계획을 진짜로 읽어요 — "좋아 보여요"는
  읽지 않고도 할 수 있는 말이니까요.` (replaced the weak `동의는 흔하고, 알아봄은 드무니까요`).
- Hand-set `<br/>` so no word dangles in the problem pitch / resolving line / how-it-works.
- CTA `진짜로 읽혀보기` → `읽어봐 주세요`; `관점이 다른 AI` → `여러 AI가 저마다 다른 눈으로`;
  `갈리는 자리가 있으면` → `길이 갈리는 곳이 있다면` (keeps the honest null-fork case); de-emphasized `정한 날짜`.

### Below the fold
- Scroll cue → **sounding line** (`.bp-sounding-line`): ink rule + a weight that bobs, **clickable**
  (`<a href="#voyage-heading">`). Hero `minHeight 100svh→92svh`; Act1 top padding cut to reduce the dead gap.
- Act1: headline `clamp(32,3.8vw,60)` → `clamp(27,3.2vw,40)`; dropped the "old-hero" italic line;
  headline + "what it does" rewritten clear (`긴 항해` / `"왜"를 적어두기` = the logbook; `항해처럼 기록해요`).
- Act2: reveal **900ms → 260ms** between beats; **6 beats → 3** (decision → it split = blind spot →
  the one thing only you can check); Arrival card **6 fields → 4**.
- Act3: removed the "방위 · The Heading" plate label (+ its unused import) and shrank the headline;
  it's now a closing CTA band (HelmScene + "지금 출항").

---

## 4. The design spec (research-backed — the source of truth to continue from)

Produced by a multi-agent research pass (NN/g, Unbounce, Toss UX writing, Linear/Stripe/Vercel/
Raycast teardowns, Korean keep-all typography). Use it to keep going.

**Bearing Fan (if iterating the diagram):** the picture must say "agree cheaply → fan open at ONE
gold point → return", never "pick 1 of 3" (a verdict). Keep ≥3 stroke weights, gold exactly once,
labels in `word-break:keep-all` with no orphaned word.

**Input:** chart-field (not a box); focus reads as ink/paper weight increase, never a colored glow;
gold = the commit moment (CTA ignite), not focus chrome; placeholder examples must be real, heavy,
first-person; keep the submit affordance visible in all states.

**Pacing:** entrance animations 300–450ms ease-out; **never** a >500ms gate; stagger siblings 60–120ms;
defeat false bottoms by letting the next section *peek* and removing full-bleed dividers; section
headlines must step DOWN from the hero (a 60px section headline reads as a second hero).

**Korean copy:** density = concreteness, not maxims; never use the internal axis noun (`알아봄`) as
surface copy — show it with a verb (읽다/적어두다); quoted phrases are atomic (glue with U+00A0);
every visual line is a complete clause; hand-set breaks for the hero (keep-all alone still rags).

**Key sources:** nngroup.com/articles/{animation-duration, illusion-of-completeness, glanceable-fonts,
form-design-placeholders}; unbounce.com attention-ratio; toss.tech/article/8-writing-principles-of-toss;
poesius.com strategy-consulting-slide-design; m3.material.io motion; the repo's own
`docs/FRAMEWORK-decision-navigation.md` §7 (the voice).

---

## 5. Gotchas (read before editing)

- **Global gold focus ring**: `*:focus-visible{outline:2px solid var(--accent)}` in `globals.css`
  is the source of the "gold box on focus." It's only suppressed for `.bp-hero-input`. Any *new*
  input on the landing will show the gold ring unless you scope it the same way.
- **SVG group CSS transforms are fragile** (`transform-box`/origin differ across browsers). The
  Bearing Fan reveals use opacity + `stroke-dashoffset` only — keep it that way; don't add
  `transform: scaleX()` to `<g>` for reveals.
- **`ForkPath` name** is legacy (the concept is now the Bearing Fan). Rename to `BearingFan` only if
  you also fix the import in `SirenHero.tsx`.
- **Korean line breaks**: don't trust `word-break:keep-all` to look good on its own for hero copy —
  it still orphans short 어절. Hand-set `<br/>` and re-render at ~600px.
- **Renders need the repo as cwd** for `import 'playwright'`; delete any `_shot.mjs` before committing.
- This repo is multi-machine: `git fetch` and check ahead/behind before pushing.

---

## 6. Known limitations / prioritized next steps

1. **[HIGH] Mobile Bearing Fan is cramped** (`docs/landing-renders/mobile-hero.png`). The wide
   1000×400 viewBox scales to ~143px tall at 390px → labels unreadable. Build a **mobile-vertical
   variant** (`<600px`): rotate the logic (plan flows top→bottom), drop readers 4→3, shorten labels
   (`읽는 눈, 넷`→`읽는 눈 셋`), keep the single gold node + wedge, height ~360–420px. (Spec already
   called for this; not implemented to keep the desktop pass focused.)
2. **[MED] Bearing Fan polish**: the return arc → date-buoy connection and the arrow-back-to-origin
   can be refined; consider a subtle gold-node ignite pulse (currently a single scale-in). Iterate
   visually.
3. **[MED] Act 2 reveal**: currently a fast timer on section-entry. Truer to the spec would be a
   per-beat `IntersectionObserver` one-shot (scroll sets the pace). Lower priority now that it's snappy.
4. **[LOW] Input**: optional auto-grow textarea (currently `rows={2}` fixed) + example "starter chips";
   `aria` review of the chart-field.
5. **[LOW] Owner taste calls still open**: the kicker wording and the CTA label ("읽어봐 주세요") are
   provisional — easy to swap.
6. **Verify the live deploy** (argus.voyage) reflects `cae2edf` before further work.

---

## 7. Commit trail (landing)

- `cae2edf` — the overhaul (Bearing Fan, chart-field input, copy/line-breaks, voyage restructure).
- `f80ec45` — copy de-translationese + ForkPath first redraw.
- `e5f52a6`, `5d88a13`, `c291ec1`, `b6d62d4` — earlier hero/bearing passes (context only).
