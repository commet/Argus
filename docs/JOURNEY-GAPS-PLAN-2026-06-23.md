# User-Journey Gap Remediation Plan (2026-06-23)

> From a 9-agent `/ultracode` user-perspective audit of the new BIND→seal→settle voyage
> (24 question clusters + completeness critique). Full findings:
> `tasks/wu8oqwaax.output` (archived in session). Prioritized by **does the product keep
> its core promise** (the return loop actually closing), then legibility/payoff, then control.
> Deduped — several clusters surfaced the SAME root gap (date-only rope, the reminder void,
> the seal-unreachable leak).

---

## P0 — The return loop is BROKEN for most users (the promise silently fails)

**P0-1 · The padlock contradiction (most embarrassing).** The seal promises "come to the
project page and I'll bring it up," but the `Projects` nav shows a 🔒 lock (`requiresAuth:true`)
for logged-out users — alongside the due-count badge. Anon users read it as gated and never
click. `/project` is actually public + reads localStorage. Fix: drop the lock on `/project`
when the user has local data / `dueCount>0` (it's their own data, not a gated feature); fix the
stale `workspace/page.tsx:514-516` comment. → `Header.tsx`, `public-paths.ts`.

**P0-2 · Seal unreachable after you leave (the 47/0 terminal leak).** A completed-but-unsealed
voyage can't be sealed from `/project` — `DecisionContractCard` gets no `livePredicates` there
and the legacy `buildFresh` reads RECAST/FEEDBACK a voyage never writes, so the SEAL state never
renders. This is almost certainly WHY 47 projects → 0 sealed. Fix: derive predicates from the
project's progressive session on `/project` and pass as `livePredicates`. → `project/page.tsx`,
`DecisionContractCard.tsx`.

**P0-3 · Due decisions invisible where the user actually is.** The reminder strip + modal live
ONLY on `/project`; the user lands on `/workspace`. Fix: render a "so, how did it go?" due-strip
at the top of the `/workspace` idle screen (reuse `contractStatus().checkInDue`), reachable by
anon. → `workspace/page.tsx`.

**P0-4 · Date-only rope returns NOTHING on the promised day.** A BIND with a check-in window but
no lean (or any predicate-less contract) creates a contract that resurfaces on its date but
`SettlementModal` renders `null` (0 predicates). The user set a date, came back, and the product
no-ops in silence. Fix: (a) `SettlementModal` handles a predicate-less due contract with a single
free-text "그래서, 어떻게 됐어요?"; (b) when a lean is typed but no date chosen, BindCard nudges
"확인일을 고르면 그날 다시 물어볼게요". → `SettlementModal.tsx`, `BindCard.tsx`, `decision-contract.ts`.

**P0-5 · Bind effort discarded on quota/error.** If the buffered analysis fails after binding
(esp. anon `LOGIN_REQUIRED`), the typed lean + date are silently thrown away (no project created,
BindCard unmounted). Trains users never to bind. Fix: stash text+bind so a retry/login re-attaches
the rope; if the buffered analysis is already a quota error while still on BindCard, surface it
inline ("크루를 들으려면 로그인 — 적어둔 건 남겨둘게요"). → `workspace/page.tsx`, `BindCard.tsx`.

## P1 — The new structure isn't legible or rewarding (BIND has no payoff)

**P1-1 · Phase rail absent during BIND.** `VoyagePhaseRail` (1/3 묶기) renders only inside
ProgressiveFlow, which mounts AFTER bind. At the literal 묶기 moment there's no map. Fix: render
the rail (phase forced to bind) above BindCard. Also keep the Land segment lit at `complete`
(SealMoment). → `workspace/page.tsx`, `ProgressiveFlow.tsx`, `VoyagePhaseRail.tsx`.

**P1-2 · The lean vanishes during LISTEN + the AI never relates to it.** The user commits their
gut call, then it disappears until settlement weeks later. Fix: a persistent "내가 기운 쪽" chip
near the Me pill; pin the user_lean to the top of the seal list with "당신이 출항 때 적은 한 줄".
(Optional later: inject lean as reference-only context so the draft can address it; display-only
"you leaned X / the crew surfaced Y" juxtaposition — no verdict.) → `ProgressiveFlow.tsx`,
`SealMoment.tsx`.

**P1-3 · The late seal never shows the rope you tied.** `augmentContract` silently merges onto
the early contract; the ASK speaks as if sealing fresh. Fix: when a user_lean exists, "출항 때
당신은 \"{lean}\"이라고 적었죠 — 그날 맞았는지 같이 봐요" and pre-select the promised interval.
→ `SealMoment.tsx`.

**P1-4 · No custom check-in date.** Only 1w/2w/1m; real outcomes land on specific dates. Fix: a
"직접 고르기" date option in BindCard + SealMoment → `check_in_at`. Show the resolved date under
each BindCard chip (SealMoment already does). → `BindCard.tsx`, `SealMoment.tsx`.

**P1-5 · The lean can't be edited / goes stale on reframe.** Fix: editable lean (the chip from
P1-2, or in the seal drawer), rewriting the user_lean predicate (keep authored:'user'); on a
confirmed reframe, gently re-confirm the lean. → `SealMoment.tsx`, `ProgressiveFlow.tsx`.

**P1-6 · Two seal surfaces, contradictory voice.** `DecisionContractCard` SEAL state leaks
"예측으로 봉인 / N가지를 예측했어요"; SealMoment stays "물어봐 드릴까요?". Fix: rewrite the card's
seal copy to the soft voice (ideally route `/project` seal through SealMoment). → `DecisionContractCard.tsx`.

**P1-7 · /project speaks the OLD 4-step language.** Empty state + step labels narrate
재정의/설계/검증/종합 + a "30초 데모" to a user who just did 묶기/듣기/닿기. Fix: gate 4-tool
vocab behind `!currentHasVoyage`; speak the voyage language. → `project/page.tsx`.

**P1-8 · First-time orientation skipped on the `?q=` path.** Fix: a one-line first-timer header
inside BindCard ("AI가 읽는 동안, 먼저 당신 생각부터 — 1단계/총 3단계"). Also a faint "AI는 이미
읽는 중 — 다음 화면에서 보여드려요" so skip feels safe. → `BindCard.tsx`.

**P1-9 · Vocabulary drift** 묶다/봉인/약속/닿다 for one act; unify the user-facing verb chain.
Anon device-only honesty missing at SETTLE time + a login button missing at the seal warning.
→ copy + `SealMoment.tsx`, `SettlementModal.tsx`.

## P1b — Reminder channel (the structural void; bigger, higher-value)

**P1b · Nothing reaches the user on the date** (pull-only). The `.ics` is the only aid and it's a
post-seal afterthought with a generic body. Quick wins: offer the `.ics` on the ASK screen as the
answer to "no notifications", deep-link it to the specific project + put the lean in the body, add
a re-download on `/project`. Bigger: an **opt-in email reminder** for logged-in users — a
`/api/cron/checkin-due` (Resend + cron exist) + a denormalized `projects.check_in_at` column +
`reminder_sent_at` guard. Treat the cron as its own reviewed change. → `SealMoment.tsx`,
`DecisionContractCard.tsx`, new cron + migration.

## P2 — Control & edges (expected options that are simply absent)

- **P2-1 · No per-project delete** — `deleteProject` exists, wired to zero UI; only all-data
  reset. Add a per-project delete (confirm) in the detail header. → `project/page.tsx`.
- **P2-2 · No re-grade after VERIFIED** (fat-finger is permanent) + **change date before due**
  (amendCheckIn only at due). Add edit affordances to DecisionContractCard WAITING/VERIFIED.
- **P2-3 · Migration toast counts internal signal rows** ("23건" for 1 decision) → count
  projects/decisions. **SyncStatus flips to green "Synced" after 8s even on failure** → don't lie.
- **P2-4 · Plugin decisions excluded from the /project record** → fold in or a bridge card; an
  overdue imported plugin decision has no "settle in the plugin" hint.
- **P2-5 · Track-record strip hidden on the detail page + omits losses** (trophy-case risk) →
  show on detail; include betsBroke/risksHappened. Sample-size hedge under ~5 loops.
- **P2-6 · Settlement lacks context** ("what was this decision?") → show the situation excerpt +
  pin/label the user_lean row distinctly.
- **P2-7 · Many-decisions nav** — content search (not just name), a "Settled" filter, linkable
  `/project/[id]`.

---

## Execution order
Tiers in order P0 → P1 → P1b(.ics quick wins; email cron separate) → P2. Each tier: implement,
validate (`tsc` 0 + targeted `vitest` + `next build` where touched), commit per coherent group,
push. Work in an isolated worktree off `feat/3phase-integration` to avoid colliding with the
other live sessions, then merge. Spine on every fix: honest provenance, no forced gate, no
verdict, restraint.
