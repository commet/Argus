# Argus Design System — conventions

Argus is an **editorial "logbook / dawn-harbour" system**: warm parchment surfaces,
deep charcoal ink, a single emphatic gold accent, serif display headings, and a
nautical voyage motif. Build on-brand by reusing the components below and styling
your own layout glue with the token vocabulary here.

## Setup — no provider needed

Components are plain React; they need **no context provider**. The only requirement
is that **`styles.css` is loaded** — it defines every `--*` token, the brand fonts
(Pretendard / Noto Serif KR / JetBrains Mono, loaded remotely), and the component
styles. Without it components render unstyled. Dark mode: set `data-theme="dark"`
on a root ancestor (`<html data-theme="dark">`); all tokens have dark values.

## Styling idiom — Tailwind v4 + CSS-variable tokens

This is a **Tailwind v4** system whose design language lives in **CSS variables**.
Components are already styled. For your own layout, use Tailwind utilities that
reference the tokens via arbitrary values — never hardcode hex. Examples:
`bg-[var(--surface)]`, `text-[var(--text-secondary)]`, `border-[var(--border)]`,
`shadow-[var(--shadow-md)]`, `rounded-[var(--radius-lg)]`.

Token families (all defined in `styles.css`):

| Role | Tokens |
|---|---|
| Surfaces | `--bg` (parchment page), `--surface` (white card), `--ai`, `--human`, `--collab`, `--checkpoint` (semantic tints) |
| Text | `--text-primary`, `--text-secondary`, `--text-tertiary` (high→low emphasis) |
| Borders | `--border`, `--border-subtle` |
| Accent (gold — the ONE emphatic color) | `--accent`, `--accent-light`, gradient `--gradient-gold` |
| Shadows | `--shadow-xs` `--shadow-sm` `--shadow-md` `--shadow-lg` `--shadow-xl` |
| Risk triad | `--risk-critical`, `--risk-manageable`, `--risk-unspoken` |
| Radii | `--radius-sm` (8) `--radius-md` (12) `--radius-lg` (16) `--radius-xl` (20) `--radius-2xl` (24) |
| Fonts | `--font-display` (Noto Serif KR serif — headings), body sans (Pretendard, default), `--font-mono` (JetBrains Mono — numbers/labels) |
| Voyage / blueprint (for `voyage` + `illustrations` components) | `--bp-paper`, `--bp-paper-deep`, `--bp-ink`, `--bp-ink-soft`, `--bp-gold` |

Helper classes in `styles.css`: `.text-display-xl/-lg/-md` (serif hero type),
`.text-section-label` (uppercase eyebrow), `.text-gold-gradient` (gold display
text), `.chart-bg` (graticule grid texture).

**Rules of the look:** gold is spent sparingly — one emphatic affordance per view
(primary CTA, the active fork node). Serif (`--font-display`) for display/heading
moments, sans for body, **mono for all numbers**. Prefer `Card`/`Badge`/`Button`
over hand-rolled boxes.

## Where the truth lives

Read `styles.css` for the full token + utility set. Each component has
`components/<group>/<Name>/<Name>.d.ts` (the props API) and `<Name>.prompt.md`
(usage). Groups (117 components):
- `general` — primitives + form/output controls + chart SVGs (`Graticule`, `ChartEdge`, `VoyageShip`)
- `illustrations` (`Compass`, `ForkPath`, `SailingShip`, `ShipCutaway`, `HelmScene`), `voyage` + `atmosphere` — brand chrome
- `landing` — full landing sections
- `progressive` + `workspace` + `shared` — the **decision-voyage flow** surfaces (the live run): worker cards, agent visuals, the Logbook, branch map, current-bearing card, verification gate, attribution sections, falsification, etc.
- `boss` — stakeholder pressure-check (MBTI verdicts, inner-monologue, chat)
- `agents` — crew/persona cards & profiles
- `tools` — persona feedback (cards, messages, discussion threads)
- `projects` — decision contract + settlement modal

The biggest flow orchestrators (`ProgressiveFlow`, `InteractiveDemo`, the Step screens,
`PersonaForm`, `BossChat`, `AgentSidebar`, drawers) ship as **importable floor cards** — fully
usable in code, but state-heavy enough that their preview is the typographic placeholder; compose
them from their `.d.ts`, or build from the smaller graded pieces above.

## Full landing sections (compose, don't rebuild)

The whole marketing voyage ships as ready-made, no-prop sections — reach for these
before assembling a landing from primitives:
- **`SirenHero`** — the hero ("그래서, 어떻게 됐어요?") with the ruled chart-field input.
- **`Act1Voyage`** (§ I, the problem), **`Act2DecisionVoyage`** (§ II · The Trail —
  one decision unrolled as a ship's-log of waypoints), **`Act3OnDeck`** (§ III, the
  gold Ithaca payoff). `Act2DecisionVoyage` reveals its trail on scroll; design it as
  the slow continuous "one decision being navigated" beat.
- **`LandingHeader`** — the wordmark + locale/auth bar.
These are full-bleed; place them in a single column, not a grid. They carry the dawn-
harbour canvas (parchment, `PaperGrain`, gold accent reserved for Act 3 / the CTA).

## Idiomatic snippet

```tsx
import { Card, Badge, Button } from 'argus';

<Card variant="elevated" className="max-w-md flex flex-col gap-[var(--radius-md)]">
  <div className="flex items-center justify-between">
    <h3 className="text-[15px] font-bold text-[var(--text-primary)]"
        style={{ fontFamily: 'var(--font-display)' }}>이 결정을 봉인할까요?</h3>
    <Badge variant="gold">현재 방위</Badge>
  </div>
  <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
    정한 날짜에 Argus가 먼저 돌아와 결과를 묻습니다.
  </p>
  <div className="flex justify-end gap-2">
    <Button variant="ghost">취소</Button>
    <Button variant="accent">봉인하기</Button>
  </div>
</Card>
```
