# Worker Stage Redesign — 항로 명부 (The Voyage Register)

> Status: design spec, ready to build. READ-ONLY decisions captured from a verified
> source trace. Premium over clever. Keep the one-at-a-time review stepper and the
> deploy gate.

---

## 0. The problem, in one breath

Two surfaces already read the **same** `session.workers` array:

- the right rail `<AgentSidebar/>` (`workspace/page.tsx:125`, stacked under `<Logbook/>`
  inside one sticky `overflow-y-auto` column, `page.tsx:120`), and
- the in-body one-at-a-time review stepper (`ProgressiveFlow.tsx:2086-2157`).

They are connected in **data** but disconnected in **focus**. `reviewCursor` is local
to `ProgressiveFlow` (`ProgressiveFlow.tsx:965`) and never reaches the rail; a rail row
click only toggles its own `expandedId` (`AgentSidebar.tsx:530`). The only cross-surface
channel, `useAgentAttentionStore.hovered`, is done-only draft↔agent attribution
(`AgentSidebar.tsx:150`), not review focus. And pending crew is **filtered out**
(`AgentSidebar.tsx:433` `visibleWorkers = workers.filter(w => !isPending(w))`), so
"assigned vs actually-working" never reads at all.

Result: "which agent's card am I reading" and "that agent in the rail" are two
independent highlights, and half the crew's lifecycle is invisible.

---

## 1. Chosen direction

**A hybrid — "항로 명부 / The Voyage Register" — built from the highest-confidence,
lowest-risk grafts of the four studied concepts.** Every lens agreed on the same three
load-bearing moves regardless of which visual metaphor won, so we ship those and reject
the parts that depend on geometry the real DOM forbids.

What we take, and why:

1. **One shared `focusedWorkerId` channel** (every concept's strongest, most graftable
   element — and the only actual cure for the disconnect). The rail row you click and
   the body card you read become one selection.

2. **Delete the pending filter** (`AgentSidebar.tsx:433`) and show the full crew from
   the moment of casting, with a quiet "standby" treatment for un-deployed agents. This
   single deletion is most of the "assigned vs working" legibility fix.

3. **A single vertical gold spine** as the rail's organizing object (from 단일 항로 /
   해도 크루): progress is *how far the gold has climbed the route*, not a floating bar.
   Each agent is a **station** on that spine with one calm status node. This is the
   editorial, "one drawn object, not a dashboard of cards" move that makes it feel
   expensive.

4. **The connection is shown as a shared gold spine on BOTH ends + a one-shot drawn
   thread**, NOT a framer-motion `layoutId` element flying across the gap. Verified
   reason: the rail is a separate `sticky overflow-y-auto` container stacked under a
   variable-height `<Logbook/>` (`page.tsx:120-126`) and is `hidden lg:block`. A
   `layoutId` shared element cannot reliably tween across that clip/scroll boundary; it
   would mis-measure or pop, which reads as broken — the opposite of premium. The
   robust premium version is a **gold left-spine on the focused station mirrored by a
   gold left-line on the focused card**, joined by **one short gold thread drawn on
   focus-change then faded** (a transient `getBoundingClientRect` SVG, never a
   persistent tracked line).

What we explicitly **reject** (verified against source, do NOT do these):

- ❌ **Do not relabel the CTA to "출항 / Set sail."** `TeamDeployBanner.tsx:429-430`
  carries a deliberate owner decision: *"was '출항'; the set-sail wording is reserved
  for nautical companion features now."* The CTA stays **`팀 투입 / Start`**
  (`TeamDeployBanner.tsx:437`). We stage the ceremony *around* the existing label.
- ❌ **Do not reuse `ai_preliminary` for the pre-scout.** That field is occupied: it
  holds the full AI-assist result for self/human tasks (`ProgressiveFlow.tsx:1219`),
  renders as primary `WorkerCard` content (`WorkerCard.tsx:454, 648`), feeds the
  human-agent email/Slack body (`ProgressiveFlow.tsx:1280, 1283`), and is injected
  into the mix as a `type:'preliminary'` contribution (`useProgressiveStore.ts:1732-1733`).
  Overloading it would corrupt four live consumers. The pre-scout gets its **own**
  nullable field, `scout_angle`, per the CLAUDE.md add-a-field checklist.
- ❌ **Do not draw a literal continuous line across the two scroll containers.**
  See #4 above.

> Why this hybrid and not the #1-ranked 해도 크루 verbatim: 해도 크루's signature "lit
> leg" already conceded (in its own risk section) that it cannot span the two
> containers and degrades to a shore-stub — i.e. it lands on exactly the dual-spine +
> stub mechanic we adopt here. We keep its best ideas (spine-as-progress, the voyage
> node vocabulary) and drop the over-promise. We also fold in CREW MANIFEST's editorial
> serif roster restraint and 로스터's one-shot transient thread, which is the safest
> way to make the link *visible* without geometry that breaks.

---

## 2. The sidebar ↔ body connection mechanic

### 2.1 Source of truth — one new channel

Extend `useAgentAttentionStore` (`useAgentAttentionStore.ts:35-51`) with an orthogonal
focus channel — separate from `hovered` (draft↔agent attribution) and `sticky` so the
two never fight:

```ts
// useAgentAttentionStore.ts — add to AgentAttentionState
focusedWorkerId: string | null;
setFocusedWorker: (id: string | null) => void;
// in create():
focusedWorkerId: null,
setFocusedWorker: (id) => set({ focusedWorkerId: id }),
```

### 2.2 Bidirectional wiring — `reviewCursor` becomes a projection of focus

The body stepper keeps `reviewCursor` (`ProgressiveFlow.tsx:965`) as the local cursor
and the one-at-a-time stepper stays exactly as is (`2086-2157`), but it now **mirrors**
focus both ways:

- **Body → rail.** Inside the stepper IIFE, after `current` is computed (`:2091`), a
  `useEffect` keyed on `current?.id` calls `setFocusedWorker(current.id)`. Because the
  dots (`:2111`), Prev (`:2143`), and Later (`:2149`) already move `reviewCursor`, they
  now also move rail focus for free.
- **Rail → body.** `AgentSidebar` receives an `onFocus?: (workerId: string) => void`
  prop. A station's `onClick` calls both `setFocusedWorker(w.id)` AND `onFocus(w.id)`.
  In `ProgressiveFlow`, `onFocus` runs
  `setReviewCursor(ordered.findIndex(x => x.id === id))` (where `ordered` is the same
  `[...workers].sort((a,b)=>a.step_index-b.step_index)` already at `:2087`). Rows are
  clickable for any *reviewable* status (`done | waiting_input | error`); pending/
  running stations are not focus targets pre-review (they have nothing to dock yet),
  so clicking them is a no-op — keeping the "one card per focus" promise honest.

No loop: body writes `focusedWorkerId` from `current.id`; rail writes `reviewCursor`
from the clicked id. Each surface only *reads* the value the other surface owns; the
`useEffect` guard (`keyed on current.id`) means re-renders don't thrash.

> The existing `hovered` channel is untouched — done-only draft↔agent attribution
> (`AgentSidebar.tsx:150`) keeps working independently. Focus is click-driven and
> persistent; hover is transient. They are different concerns on different keys.

### 2.3 The visible link — dual gold spine + one-shot thread

There is exactly **one** focused station and **one** focused card at a time, joined by
a single gold path:

1. **Focused station** (rail): its left spine segment promotes from persona color /
   `--border-subtle` to `--gradient-gold`, and the station gains the existing highlight
   treatment already proven in code — `ring-2 ring-[var(--accent)]/60` plus
   `shadow-[0_0_22px_-4px_rgba(180,160,100,0.35)]` (verbatim from `AgentSidebar.tsx:164`,
   so it matches house polish), scaling to `1.015` (matching `:146`).

2. **Focused card** (body): the `WorkerReportBlock` already renders a `w-px self-stretch`
   left "Color line" in persona color (`WorkerCard.tsx:481-482`). When
   `worker.id === focusedWorkerId`, widen it to `2px` and set
   `background: var(--gradient-gold)` (it already animates `transition-colors
   duration-500`, so the gold promotion is a free crossfade). One conditional className,
   no new element.

3. **The thread** (the one assertive gesture): a fixed-position SVG overlay,
   `<FocusThread/>`. On focus-change it reads `getBoundingClientRect()` of the focused
   station (carrying `data-roster-id={w.id}`) and the focused card wrapper (carrying
   `data-focus-card`), draws a thin **1.5px** gold path
   (`stroke: url(#gradient-gold-stroke)`) from the station's right edge to the card's
   left edge, animates `pathLength: 0 → 1` over **0.5s** on `EASE`
   `[0.32,0.72,0,1]`, holds **~700ms**, then fades `opacity → 0` over **0.3s**.
   It is **one-shot, never tracked** — it recomputes rects once at draw time and fades;
   it never follows scroll (a persistent line would jitter and look cheap — see Risk).
   If `lg` is not active (rail hidden, `page.tsx:120` `hidden lg:block`) or either
   anchor is off-screen, the thread simply does not draw — the dual gold spine alone
   still reads the link. On mobile (`WorkerDrawer`, `page.tsx:133`) there is no rail;
   focus sync still works, the thread is just absent.

### 2.4 Motion + tokens (connection)

| Event | Spec | Token |
|---|---|---|
| Focus ring lands | `ring-2 ring-[var(--accent)]/60`, scale `1→1.015`, 0.3s | `--accent #96782e`, reuse `AgentSidebar.tsx:164` |
| Station spine → gold | crossfade 0.3s | `--gradient-gold` (`globals.css:43`) |
| Card color-line → gold | `transition-colors duration-500` (already present) | `--gradient-gold` |
| Thread draw | `pathLength 0→1`, 0.5s `EASE`; hold 700ms; fade 0.3s | `EASE = [0.32,0.72,0,1]` (`constants.ts:3`) |
| Card slide on step | keep existing `AnimatePresence mode="wait"`, x:±14, 0.26s | `ProgressiveFlow.tsx:2124-2127` |

---

## 3. Sidebar status system — the station as the status language

Today's logic to build on:
- `isPending` = `pending | ai_preparing` (`AgentSidebar.tsx:21`)
- `isWorkingStatus` = `running | sent | waiting_response` (`AgentSidebar.tsx:27`)
- `StatusBadge` (`AgentSidebar.tsx:31-60`): working → spinning `live` pill;
  `done` → emerald check; `waiting_input` → gold "입력 필요"; `error` → "오류";
  else → "standby".
- pending filtered out at `:433` (we delete this).

The rail's **left spine** carries a per-station **node** + a one-line status. The node
*is* the status vocabulary, shared identically on the card's left line. Mapping to the
real `WorkerStatus` union (`types.ts:737`) + `approved` flag (`types.ts:785`):

| # | Journey state | Real status | Node glyph | Spine | Row | Status line / badge |
|---|---|---|---|---|---|---|
| 1 | **Assigned** | `pending`, no `scout_angle` | hollow ring, `--border-subtle` | grey segment | opacity `0.55` | task name (reuse `:233-235`) · badge "대기 / standby" (reuse `:59`) |
| 2 | **Pre-scouting** | `pending`, scout running | hollow ring + `TypingDots` | grey | `0.6` | "정찰 중 / scouting" |
| 3 | **Scouted / ready** | `pending` + `scout_angle` set | hollow ring with a **half-gold tick** | faint gold tick | `0.7` | italic angle line w/ `Compass` icon (see §5) · badge "정찰 / scouted" |
| 4 | **Preparing** | `ai_preparing` | pulsing ring | grey-pulse | `0.7` | "준비 / prep" (reuse existing `ai_preparing` handling) |
| 5 | **Working** | `running`/`sent`/`waiting_response` (`isWorkingStatus`) | **filled** persona-color node + `AvatarRipple` + `ShimmerBar` | gold fills *down* to this node | `1.0` | live ticker (reuse `tickersFor`/`stream_text` tail `:109-121`) · spinning **live** pill (`:35-39`) |
| 6 | **Needs you** | `waiting_input` | filled gold node, slow pulse-ring | gold | `1.0` | "입력 필요 / Input" (reuse `:48-54`); **auto-pulls focus** (captain must steer) |
| 7 | **Awaiting review** | `done`, `approved == null` | emerald-filled node + a thin **gold pulse-ring** (slow 2.4s breathe via `useAttentionPulse`) | gold above node | `1.0` | `completion_note` (reuse `:222`) · tag "검토 대기 / Review" |
| 8 | **Reviewed — applied** | `done`, `approved === true` | solid emerald check (`:41-46`) | gold locked | `1.0` | tag "반영 / Applied" (mirror `WorkerCard.tsx:494`) |
| 9 | **Reviewed — excluded** | `done`, `approved === false` | emerald node dimmed `0.5` + thin strike | spine → `--border-subtle` | row `0.5` | tag "제외 / Excluded" (mirror `WorkerCard.tsx:495`) |
| 10 | **Error** | `error` | red ring | red | — | red error line + inline **Retry** (reuse `:238-247`) |
| 11 | **Validation failed** | `validation_failed` | amber ring | amber | `1.0` | "품질 확인 / check" |

New richness vs today: states **1-3 (assigned/scouting/scouted)** were entirely
invisible (filtered out), and **7-9 (awaiting-review / applied / excluded)** were
flattened into a single emerald check. The rail now shows the full per-agent journey
`assigned → scouting → ready → [팀 투입] → working → done → awaiting-review →
reviewed`, and it **agrees** with the body: states #7 are exactly the
`remainingToReview` set (`ProgressiveFlow.tsx:2096`). Add a header twin — a gold
"검토 N / Review N" pill when `doneCount > handledCount` — so the rail tells the captain
there is reading to do, mirroring the body's "N명 남음" (`:2105`).

Multi-stage grouping (`groupedByStage`, `AgentSidebar.tsx:437`) survives: `StageDivider`
(`:343`) becomes a labelled tick on the spine ("Stage Ⅱ — 검증") with the gold line
passing through it. `StageTransitionBanner` (`:293-339`) is unchanged.

---

## 4. Deploy "팀 투입" ceremony — the route lights up

**Kept as a hard gate.** Pre-deploy (`deployPhase === 'ready'`): `TeamDeployBanner`
(`ProgressiveFlow.tsx:1976-1989`) stays as the editable crew manifest with swap / add /
remove and the **`팀 투입 / Start`** CTA (`TeamDeployBanner.tsx:437`, label UNCHANGED).
In the rail, the spine is drawn but **unlit** — `--border-subtle` line, every station a
hollow/scouted node at `0.55-0.7` opacity, each already showing its scouting angle (§5).
The route is *charted but not sailing*.

**The moment** — staged as a real scene, ~1.1s, on click of `onDeployWorkers`
(`ProgressiveFlow.tsx:1259`). The store already fires `recordCheckpoint('crew_set')`
(`:1265`), `deployWorkers()` (`:1266`), and `ping('deploy')` (`:1267`). We hook a
ceremony off that single ping (`lastPingSource === 'deploy'`,
`useAgentAttentionStore.ts:56`) with a `useEffect` in `AgentSidebar` that latches a
~1.1s `igniting` flag, and a `<CastOff/>` overlay scoped to the worker column:

1. **The spine draws itself top→bottom** — a gold overlay masks `scaleY: 0 → 1` from
   `origin-top`, ~0.9s `--ease-wave` (`globals.css:75`). The voyage line is "charted."
2. **Stations ignite in sequence** as the line reaches them — node `scale 0.9 → 1`,
   hollow→filled, persona color saturating `35% → 100%`, staggered by `step_index`
   at **0.07s** (the banner's existing cadence, `TeamDeployBanner.tsx:70`). Each fires
   one `AvatarRipple` in persona color (reuse `AgentVisuals`).
3. **One gold sweep** crosses the rail once — reuse the `StageTransitionBanner` sweep
   technique (`AgentSidebar.tsx:308-314`), rotated vertical, ~1.0s `easeOut`.
4. The `TeamDeployBanner` does its existing `whileTap scale:0.98` (`:431`) then
   `layout`-collapses upward as the first stations flip `pending → running` — the crew
   visibly "boards" the now-lit route.

**Copy** (keep the verified label; the ceremony adds an *eyebrow*, not a relabel):
- CTA stays: `팀 투입` / `Start` (UNCHANGED, `TeamDeployBanner.tsx:437`).
- One-time rail eyebrow during ignition (auto-hides ~2.5s, reuse the 4s banner timer
  pattern `AgentSidebar.tsx:415-417`):
  - KO: **「 항로 확정 · {n}명 출발 」**
  - EN: **「 Course set · {n} underway 」**
  - (출발/underway, not 출항/set-sail — respects the reserved-wording decision.)

**Honesty:** pure motion, **zero extra LLM calls**. The actual
`runAllAIWorkers`/`runPipeline` (`ProgressiveFlow.tsx:1247-1249`) fires immediately
under the overlay — the ceremony never blocks work. Respect `prefers-reduced-motion`:
fall back to a 300ms opacity fade-in of the lit route, no `scaleY` draw.

---

## 5. Pre-scout (Q1) — the scouting angle

**Surfacing.** After agents are assigned during Q&A (`initWorkers`,
`ProgressiveFlow.tsx:~1386` → `store.initWorkers`, `useProgressiveStore.ts:872`), each
agent shows a **one-line angle** under its name on the rail (state #3 in §3): 11px,
`text-[var(--text-tertiary)]`, italic, prefixed by a small `Compass` glyph (lucide,
already imported in `TeamDeployBanner.tsx:5` for the assignment-reason rhyme), e.g.:

- KO: *정찰: 가격 민감도부터 본다*
- EN: *Scouting: starting from price sensitivity*

It is intentionally quieter than the working ticker — no color, no dots — so "scouting
(a sketch)" and "working (live)" read differently. By 팀 투입 time every station already
shows a direction, and the `dashed/half-gold → filled` transition at deploy is the
visual promise being kept. The same line surfaces under the existing `assignment_reason`
row in `TeamDeployBanner` (`:154-159`) so the manifest reads: *who · why-assigned · their
angle*.

**Field (NOT `ai_preliminary` — that is occupied, see §1).** Add a dedicated nullable
field per the CLAUDE.md "Adding a New Field" checklist:

```ts
// types.ts (near :812, next to assignment_reason)
scout_angle?: string | null;   // light Q&A pre-scout: a 1-line angle, ≤90 chars. Reference-only, not the task.
```

Checklist touchpoints: `types.ts` (field) → `createWorker`/init maps in
`useProgressiveStore.ts` (default `scout_angle: null`, alongside the existing
`ai_preliminary: null` at `:940, 1157, 1244, 1311`) → Supabase `workers` column
(nullable text, via `apply_migration`) → defensive read in UI (`worker.scout_angle ||
null`, omit the line if absent — never a spinner-in-place).

**Graceful fallback (zero-token).** If `scout_angle` is null (scout not back, or the
engineering task below is descoped), surface the **existing** `assignment_reason`
(`types.ts:812`, already populated for auto-assigned AI agents and already shown in
`TeamDeployBanner.tsx:154-159`) as the angle line. The rail is then *never empty* and
costs nothing. This means the entire visual design ships **before** any LLM work.

### Architecture hook — flag as a SEPARATE engineering task

> The light pre-scout LLM pass is its own task, gated behind the visual design. The UI
> degrades to `assignment_reason` until it lands.

- **Where to trigger:** a fire-and-forget pass right after `initWorkers` populates the
  crew during Q&A (`ProgressiveFlow.tsx:~1386`). It must **not** block the 팀 투입 gate.
- **What "light" means / token budget:** ONE short sentence per agent — **≤90 chars
  output**, an *angle/heading*, NOT the task and NOT analysis. Prefer a **single batched
  call** (one prompt → N short lines out, one line per agent) over N separate calls to
  cap input-context cost; inject only the framing + each agent's task line. Fire **once
  per worker**, guarded on `!worker.scout_angle`.
- **Honesty (CLAUDE.md LLM-injection rules):** the angle is reference-only ("참고:"),
  never a fabricated action the agent won't take. If the model can't produce a faithful
  angle, write nothing and let `assignment_reason` stand. Never let `scout_angle` flow
  into the mix pipeline (it is purely a rail label — unlike `ai_preliminary`, it has no
  consumers beyond display).

---

## 6. Build map — small, safe, sequenced steps

Each step is independently shippable and must land `tsc` clean + lint clean + 1004
(localization) green. **Reuse ≈ 75%.** The one-at-a-time review stepper and the deploy
gate are preserved throughout.

### Step 1 — Focus channel (store only) · ~6 lines · pure reuse pattern
- `useAgentAttentionStore.ts:35-51`: add `focusedWorkerId: string | null` +
  `setFocusedWorker(id)`.
- No UI change yet. tsc/lint green trivially.

### Step 2 — Show the full crew (delete the filter) · ~1 line + quiet treatment
- `AgentSidebar.tsx:433`: remove `visibleWorkers = workers.filter(w => !isPending(w))`;
  render all workers. Keep `groupedByStage` (`:437`) sourcing from the full list.
- Give pending rows a quiet treatment: opacity `0.55-0.7`, no ticker, compact. (This
  alone fixes most "assigned vs working" illegibility and is safe on its own.)

### Step 3 — Bidirectional focus sync · ~25 lines · the core wire
- `ProgressiveFlow.tsx` stepper (`~2091`): `useEffect` keyed on `current?.id` →
  `setFocusedWorker(current.id)`.
- Pass `onFocus={(id) => setReviewCursor(ordered.findIndex(x => x.id === id))}` to
  `<AgentSidebar/>` (prop add at `page.tsx:125` or lift the rail render — see note).
- `AgentSidebar` `AgentRow` `onClick` (replacing the `expandedId` toggle path at `:530`
  for reviewable rows): call `setFocusedWorker(w.id)` + `onFocus?.(w.id)`. Read
  `focusedWorkerId` to apply the existing highlight ring (`:164`).
- Note: the rail is rendered prop-less at `page.tsx:125`. To pass `onFocus`, either
  thread the callback through `page.tsx` or (cleaner) have `AgentSidebar` read
  `reviewCursor`/`setReviewCursor` via a small shared selector. Keep `reviewCursor` as
  the body's source of truth; `focusedWorkerId` is the projection.

### Step 4 — Card-side gold link · ~5 lines
- `WorkerCard.tsx:481-482`: when `worker.id === focusedWorkerId`, widen the color line
  to `2px` and set `background: var(--gradient-gold)`. Add `data-focus-card` to the
  `WorkerReportBlock` wrapper (`ProgressiveFlow.tsx:2125`).

### Step 5 — Station node + spine (rail re-skin) · ~120 lines net-new geometry
- Rewrite `AgentRow` → station row: left spine + `<VoyageNode>` (the 11-state glyph in
  §3, ~50 lines), name in `--font-display`, Lv pill (reuse `agent-lv`), one status line.
- Replace the floating progress bar (`AgentSidebar.tsx:474-482`) with the spine's gold
  fill (progress = fill height). Add `data-roster-id={w.id}` to each row.
- Reuse verbatim: `WorkerAvatar`, `AgentVisuals` (`TypingDots`/`AvatarRipple`/
  `ShimmerBar`/`AttentionFlash`/`tickersFor`/`useAttentionPulse`), `StatusBadge` logic,
  `StageDivider`. Keep `groupedByStage`.

### Step 6 — `<FocusThread/>` one-shot SVG · ~40 lines net-new · framer-motion only
- Fixed-position overlay; on `focusedWorkerId` change, read `data-roster-id` +
  `data-focus-card` rects once, draw `pathLength 0→1` 0.5s `EASE`, hold 700ms, fade.
- Gate: only when `lg` active and both anchors on-screen; otherwise no-op (dual spine
  carries the link). Respect `prefers-reduced-motion` (skip the draw, no thread).

### Step 7 — `<CastOff/>` deploy ceremony · ~50 lines net-new · pure motion, reuse sweeps
- `useEffect` on `lastPingSource === 'deploy'` (`AgentSidebar`) latches `igniting` ~1.1s.
- Spine self-draw (`scaleY 0→1`, `--ease-wave`), staggered node ignition (0.07s),
  vertical gold sweep (reuse `:308-314`), rail eyebrow "항로 확정 · {n}명 출발 /
  Course set · {n} underway" (auto-hide 2.5s). CTA label UNCHANGED. reduced-motion fade.

### Step 8 — Pre-scout field + fallback surfacing · ~15 lines (no LLM yet)
- `types.ts`: add `scout_angle?: string | null` (§5). Map defaults in
  `useProgressiveStore.ts` (`:940, 1157, 1244, 1311`). Add Supabase column.
- Rail: render the scouting line from `worker.scout_angle || worker.assignment_reason`
  with the `Compass` glyph. Ships fully on `assignment_reason` (zero tokens) until Step 9.

### Step 9 — (SEPARATE ENGINEERING TASK) light pre-scout LLM pass
- Fire-and-forget after `initWorkers` (`ProgressiveFlow.tsx:~1386`), batched, ≤90
  chars/agent, guarded on `!scout_angle`, never blocks the gate, never enters the mix.
  See §5 architecture hook. Until this lands, Step 8's fallback stands.

---

## 7. Final design — ASCII mockups

```
ASSIGNED / PRE-DEPLOY  (deployPhase 'ready' — spine unlit, every station scouted, the gate below)
┌─ 항로 명부 · REGISTER ──────────────┐        BODY (center column)
│ ░░░░░░░░░░░░░░░░░░  0%   (unlit)    │        ┌──────────────────────────────────┐
│                                     │        │ 투입할 팀 · 3명 준비됨            │
│  ○  윤서리 · 전략가   Lv.3          │        │  [팀 행 · 교체 / 추가 / 빼기 …]   │
│  ┊  🧭 정찰: 전환 마찰부터 본다     │        │                                  │
│  ○  하람 · 분석가     Lv.2          │        │  ╔════════════════════════════╗  │
│  ┊  🧭 정찰: CAC vs LTV 먼저        │        │  ║   팀 투입            ›      ║  │  ← CTA label UNCHANGED
│  ○  미르 · 리서처                   │        │  ╚════════════════════════════╝  │
│  ┊  🧭 정찰: 경쟁사 3곳 비교        │        └──────────────────────────────────┘
│     (spine grey · nodes hollow)     │   click 팀 투입 → spine draws top→bottom,
└─────────────────────────────────────┘   nodes ignite (stagger 0.07s), eyebrow:
                                           「 항로 확정 · 3명 출발 / Course set · 3 underway 」

WORKING  (post-deploy — gold has climbed to the live node)
┌─ 항로 명부 · REGISTER ───── ● 2 분석중 ┐
│ ▓▓▓▓▓▓▓▓░░░░░░░  spine fill = progress │
│                                        │
│  ●  윤서리 · 전략가   Lv.3   live ◌    │   ● filled persona node + ripple/shimmer
│  ┃  …전환율보다 결제 마찰이…  ⠿        │   ┃ gold spine has reached this station
│                                        │
│  ●  하람 · 분석가     Lv.2   live ◌    │
│  ┃  …CAC가 LTV의 0.4배…      ⠿        │
│                                        │
│  ◐  미르 · 리서처            검토 대기  │   ◐ emerald node + gold pulse-ring
│  ┊  "경쟁사 3곳 비교 완료"             │     (done, approved == null)
└────────────────────────────────────────┘

REVIEW  (focus = 미르 — dual gold spine + one-shot thread to the docked card)
┌─ 항로 명부 · REGISTER ─── 검토 2 ──┐                 ┌─ 에이전트 검토 · 2명 남음   ●●○  2/3 ─┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░                  │                 │                                      │
│  ●  윤서리        반영 ✓           │                 │ ┃▌(gold)  미르 · 리서처   Lv.2        │
│  ┃                                 │                 │ ┃  Task · 경쟁사 가격 구조 비교        │
│  ◉  미르  ◀ FOCUS · 검토 대기      │═══ thread ═════▶│ ┃  ── 핵심 발견 / KEY FINDING ──      │
│  ┃  (ring-2 accent · gold spine)   │  (0.5s draw,    │ ┃  중간 가격대 전환율 2.1배…           │
│  │                                 │   hold, fade)   │ ┃  [ 전체 초안 보기 ]                  │
│  ○  하람          검토 대기        │                 │ ┃  [ 제외 ]      [ 반영 → 다음 ]       │
│  ┊  "CAC 회수 18개월"              │                 │ ┃← 이전              나중에 보기 →     │
└────────────────────────────────────┘                 └──────────────────────────────────────┘
  one focused station ································ one focused card  (same crew member, one object)

LEGEND  ◉ focused   ● working   ◐ awaiting-review   ○ scouted/standby/handled
        ┃ gold spine reached   ▌ card gold color-line   ═══▶ one-shot gold thread (draw→hold→fade)
        🧭 scout angle (state #3)   ⠿ live ticker   ◌ status pill
```

---

## 8. Risks & mitigations (verified)

1. **Cross-container thread geometry.** The rail is a separate `sticky overflow-y-auto`
   column stacked under a variable-height `<Logbook/>` (`page.tsx:120-126`). Mitigation:
   the thread is **one-shot** (draw → hold → fade), recomputes rects once, never tracks
   scroll; the dual gold spine carries the link even when the thread can't draw. No
   `layoutId` across containers.
2. **Long rail when un-hiding pending crew.** Mitigation: quiet standby treatment
   (opacity `0.55-0.7`, compact, no ticker) + existing `groupedByStage` collapsing, so
   pending reads as quiet backdrop, not noise.
3. **Focus loop / fight with `hovered`.** Mitigation: `focusedWorkerId` is a separate
   channel; body writes from `current.id`, rail writes `reviewCursor`; the `useEffect`
   is keyed on `current.id`. `hovered` (done-only attribution) is untouched.
4. **Pre-scout cost / field collision.** Mitigation: dedicated `scout_angle` field
   (never `ai_preliminary`), batched ≤90-char pass, fire-once-per-worker, fire-and-forget,
   never enters the mix; full visual ships on the zero-token `assignment_reason` fallback.
5. **Wording governance.** CTA stays `팀 투입 / Start` (`TeamDeployBanner.tsx:437`);
   ceremony uses 출발/underway, never 출항/set-sail (reserved, `:429-430`).
```
