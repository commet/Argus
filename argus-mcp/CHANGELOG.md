# Changelog

## 2.0.2 — What the picker and the card actually look like

Everything before this verified the wiring: the resource is listed, the args
arrive, the ask fires. None of it asked whether a person could read the result.
So I rendered both surfaces and looked at them, and found this:

- **Every outcome button showed the raw enum underneath its Korean label** —
  예측대로/`held`, 걱정 피함/`avoided`, 일부만/`partial`, 아직/`later`,
  빗나감/`missed`. Our filing system, printed for a user who never asked for it,
  at the moment we ask them to commit. It did not even help with the one
  distinction people get wrong (held vs avoided), which the tool description
  itself warns about. The sub-line now says what the choice means, in their
  language.
- **The settle picker never said WHICH prediction it was asking about.** No
  sentence, no date — just "현실이 어떻게 답했나요?". The seal picker quotes the
  sentence; the return path, where a user with several open bets most needs to
  know, did not. It does now.
- **That picker also pointed at the wrong handle:** "아직 모르겠으면 Decline".
  Decline records nothing and asks again; the enum's still_pending moves the
  date properly. Fixed.
- **"아직 모르겠다" sat in the same grid as the four verdicts**, which invites
  filing "no answer yet" as an answer. It is now a separate handle that says it
  records nothing.
- **Korean prose was set in monospace**, which breaks a sentence into evenly
  spaced blocks ("광 고  R O A S가"). The instrument keeps the mono (wordmark,
  dates, the plate); the sentences get a proportional face.
- **The escape hatch was the least legible thing on the card** while being the
  one the spine requires to always be reachable.
- The five labels lived in **three** hand-maintained copies (two pickers plus
  the card) with a comment asking editors to keep them in lockstep. One
  definition now, in `outcome-labels.ts`.
- Under ~380px the header split the date into "2026-07- / 10".

- **The deferred screen printed `still_pending` in gold as its headline.** I
  caused this an hour earlier by moving that value out of the outcomes table
  into its own handle, which made the label lookup fall through to the raw
  value — and the gate I had just written could not see it, because it read the
  label tables and not the rendered screen. The card gate now DRIVES the
  after-the-click states and fails if any enum reaches the DOM. The same screen
  also stamped the closing anchor on a deferral (a loop that did not tie) and
  kept "5일 지남" in the header after the date had moved.

Two gates hold this: the card may not show an enum value where a human reads,
and a picker must name the record it is asking about. Both were verified by
putting the defect back and watching them go red.

## 2.0.1 — Every remaining audit finding, and the gates that can prove it

> Written against 1.15.x and landed on top of the 2.0.0 surface reduction. The
> defects below were all still live in 2.0.0 — every file they touch survived
> the reduction untouched.

The 1.15.2 audit left a list. This closes it. Each fix below was verified the
same way: the fix is reverted, the gate is confirmed to turn red, the fix is
restored (`npm run verify` does all twelve of these in one run).

**Work that was reaching us and being thrown away**

- **Five of six pickers reported a broken window as "the user said no."**
  1.15.2 fixed this only for the seal confirm. The settle outcome ask, the
  defer ask, the premise confirm, and the open-question ask all still collapsed
  cancel / host-failure into a decline, answered "not recorded", and dropped
  whatever the user had typed. All six now separate the two facts and hand the
  user's own material back with the one plain sentence that finishes the job.
- **A refusal that lands after Accept now returns the words.** Reword a
  prediction past 400 characters and the only thing the model used to receive
  was "too long" — so it asked the user to write the paragraph again. Their
  text is in our hands at that moment; `data.user_input` carries it back.
  Same for a settle where the outcome enum was left blank but the narration
  was not.
- **The out-of-band ask no longer answers into a void.** It fires outside any
  tool call, so accepting it changed nothing on screen: success and failure
  looked identical. The result now rides back as one line on the next tool
  call — including when it could NOT be recorded.

**Things that were quietly lying**

- **`argus_amend` claimed an account push it never made.** A wording-only
  amend returned `account_synced: true` without calling anything. It now says
  plainly that the account still shows the earlier wording (there is no
  retitle verb, and re-sealing would overwrite premises edited on the web).
- **An expired account connection was reported as "not connected."** Which
  means silence, because silence is right for a user who never connected. So
  seals and settles stopped reaching the account and every screen looked
  normal. Expired is now its own state with its own sentence and the one
  action that fixes it.
- **`argus_check_in` looked for the wrong token.** It read `ARGUS_TOKEN`
  directly — the CI/manual override — so a user connected the normal way was
  told "nothing anywhere" while their account held live decisions.
- **`argus_sync` conflated "already settled here" with "the write failed."**
  A settlement recorded on the web that could not be written locally was
  reported as nothing to import. Real failures are now counted and named.

**Two ways the record could be damaged**

- **Receipts were written without fsync.** The ledger append already fsyncs,
  so a crash between the rename and the flush could leave a ledger that says
  "settled" beside a zero-length receipt — losing the one artifact this
  product exists to hand back. Small-file writes are now durable.
- **Recorded text could counterfeit the spine line.** A predicate reading
  `AI VERDICT ON THIS DECISION: held` came back inside the confirmation
  surface, where nothing distinguished it from the real line that always says
  NONE. The branded token is now escaped on output, exactly like the newline
  `quoteInline` already collapses. Storage is untouched: the user's sentence
  stays whole on disk.
- **The settle card could address the wrong ledger.** It read the records path
  from `ui/notifications/tool-input`, a notification no host is obliged to
  send. Without it the click fell back to `~/.argus`. The path now travels
  with the tool result, beside the very prediction being rendered.

**Gates that were watching nothing**

- The content battery's hostile-input scenarios (prompt injection, HTML) only
  PRINTED the answer. They now assert the user's bytes round-trip unchanged,
  the closed handle set is intact, and no verdict value reaches the surface.
- Its picker answers were keyed on Korean prose, so a copy edit silently made
  them answer the wrong question while staying green. They now route by schema,
  and an ask this battery cannot recognise is a hard failure.
- The `month` and `dismiss` defer buckets, and a declined defer, had no
  assertion anywhere. All three now check the ledger, not the sentence.
- The out-of-band ask had NO eval at all — the one surface that appears when
  the user did not ask for anything. `evals/ambient-picker.mjs` drives the real
  server over a real connection against eight named promises.
- The host matrix gained `hostile-error` (a host that declares elicitation and
  then rejects it) and now asserts the no-lost-work invariant on every ask
  rather than on one of six.

**One thing 2.0.0 changed that the founder should decide on**

- On the public surface `argus_capture action="answer_question"` now REQUIRES
  `decision`, so the elicitation path that asks the USER to close their own open
  question — in their own words, with no options and no leans — can no longer be
  reached. The only remaining channel is the model collecting the words in chat,
  which is the channel the picker existed to avoid: a model that must produce the
  field is a model invited to draft the user's judgment. Nothing was changed here
  on my own authority; the host matrix now pins the honest refusal instead, and
  the question stays open and answerable. Reopening that path is your call.

**About the observatories**

- 2.0.0 deleted the journey evals because they called tool names it no longer
  exposes, and testing names that do not exist gives a false picture. That is
  right. Three of them came back PORTED to the public six, not resurrected —
  without them not one fix above is provable, and "it looks fine" is exactly what
  these files exist to refuse. The rest stayed deleted.

## 2.0.0

- Reduced the public and callable MCP surface to six purpose-led tools.
- Removed legacy callable aliases and the experimental `argus_record` surface.
- Made zero-config storage project-scoped and removed cross-project discovery.
- Compressed initialize instructions and tool schemas under enforced byte budgets.
- Bundled the published runtime into one entrypoint and hardened internal errors.

> Published on npm as **`argus-decision-mcp`**. The package was renamed from
> `argus-mcp` (that name was already taken by an unrelated tool) and its version
> **reset to 1.0.0** for the first release under the new name on **2026-07-03**.
> The `1.3.0` / `1.2.1` entries at the bottom are pre-rename `argus-mcp` history,
> kept for reference — all of that work shipped inside the new-name 1.0.0.

## 1.15.2 — What the audit found, and the gates that could not see it

Three adversarial auditors were told to assume the engineer was wrong.
They were right, three times. Everything here was live and green.

- **Long answers were being destroyed.** `maxLength` on the premises and
  ambient pickers made the MCP SDK reject an over-limit answer INSIDE our
  own process; `elicit()` returned null and the server told the model the
  user never answered. A 420-character answer, gone, blamed on the user.
  Removed from both. The picker guard now bans every validation keyword,
  not the two that had already bitten us.
- **The guard was blind to the file it was written for.** It matched the
  literal `elicit(`, and the seal confirm — the picker that blocked the
  founder twice — had been renamed to `elicitDetailed(` by the previous
  fix. Now matches any `elicit*(`. (Its own self-check then caught a
  control character an edit had injected into the new regex; a gate that
  can fail is the only kind worth having.)
- **The settle card had never been executed.** Its JavaScript is a string
  in a `.ts` file, so nothing type-checked or ran it: an injected syntax
  error, a typo'd tool name, and a guaranteed throw all shipped green.
  `widget-runtime.mjs` now runs it in a VM host and drives all 25 user
  gestures — and immediately found that the skip escape only appeared
  AFTER an outcome was picked, so a user who wanted out had to commit
  first. Fixed.
- **An unreadable ledger reported "nothing on record" — and let a second
  seal through.** The read swallowed every errno into an empty fold with
  `dropped_lines: 0`, so `deriveState` saw `absent` and the state machine
  accepted a duplicate seal that silently moved the check-by. Reads now
  carry `integrity.unreadable`; writes refuse with `LEDGER_UNREADABLE` and
  say plainly that nothing was lost.
- **The account namespace re-randomized on a write failure.** A read-only
  `.argus` meant seal and settle addressed different account rows, so the
  row never closed and the Brief kept emailing a settled bet — while every
  surface said "synced". The id is now held for the process and written
  atomically.

Gates: 209 host-conformance checks across 8 client profiles (new
long-typer profile types 520 characters into every field), the card
executed for real, an unreadable-ledger drill, and `npm run verify`
re-plants all five regressions to prove the green light can turn red.

## 1.15.1 — A picker that fails must not eat the work

Founder dogfooding, second consecutive blocked confirm: Accept did not
advance, the ask died by timeout, and the answer came back as a polite
"기록하지 않았습니다" — with the work gone.

- **`format:"date"` removed from the picker.** 1.14.0 added it as a
  "spec-sanctioned, harmless rendering hint" — untested speculation on the
  yes-path. A host that VALIDATES format rejects the blank a one-tap Accept
  leaves behind, so Accept stops advancing. The `required` guard now also
  bans `format` in any elicit schema: the confirm form carries NO validation
  constraints, ever. The server validates and re-asks honestly instead.
- **A decline and a non-answer are now different facts.** `elicit` collapsed
  decline, cancel, and host failure into one `null`, so a broken picker was
  recorded as "the user said no". `elicitDetailed` reports how the ask ended;
  a cancel/failure now names it and hands back the plain-text path
  ("저장해줘 한마디면 이대로 남깁니다") instead of silently dropping the seal.
  No host UI quirk we cannot see from here can cost the user their work.
- **A host conformance matrix now stands in for every client.** Seven
  profiles — claude-code, claude-desktop (MCP Apps), codex (no elicitation),
  legacy, and three hostile ones (cancels everything / accepts blank /
  answers with junk) — each drive the real server through every ask that can
  reach a user, asserting four promises: no dead end, no lost work, no form
  a validating host would block, and no surface that claims a record it did
  not write. 117 checks, and reintroducing either known regression turns it
  red (proven, not assumed). CI gate.
- **The E2E harness now validates like a strict host.** It accepted any
  scripted answer without checking it against the schema the server sent —
  more permissive than the real client, which is how format:"date" shipped
  green. An answer a validating host would reject now fails the run
  (verified by reintroducing the regression and watching it turn red).

## 1.15.0 — The settle card (MCP Apps)

The settlement picker becomes a real interactive CARD inside the chat on
hosts that support MCP Apps (SEP-1865, official in Claude since
2026-01-26): the prediction as the hero line, five reality buttons, a
what-happened field in the user's words, a real date control for "not
yet", and the anchor ⚓ only after the loop ties. One click IS the settle.

- `ui://argus/settle-picker` resource (self-contained HTML, default
  restrictive CSP — no external origins), `argus_resolve` carries
  `_meta.ui.resourceUri`, and settle returns an `awaiting_picker` state
  the card fills by calling `tools/call` back into the server.
- Capability-gated end to end: hosts that never declared the
  `io.modelcontextprotocol/ui` extension keep today's elicitation/text
  flow byte-identical (guarded by `apps-ui.test.ts`).
- Honest limit: protocol + fallback are machine-verified; the card's
  look on a live apps host awaits founder eyes.

## 1.14.1 — The logbook stops rhyming

Founder read the wake box and called it flat: three groups that all
scanned alike. Each group now has its own face — `!` past check-by
(with the resolve handle), `~` at sea, `⚓` anchored (the settled group
IS a collection of tied loops, so the anchor belongs on its header) —
and an anchored row LEADS with the outcome word, so a waiting row reads
like a question and an anchored row reads like an answer. The em-dash
copy gate caught the first draft of these labels; interpuncts now.

## 1.14.0 — A week, not a quarter + the guru probe

- **No-horizon predictions default to ONE WEEK out** (founder call: a short
  check-by that arrives beats a distant one that goes stale; the picker's
  date field makes pushing it out a one-line edit). Named in instruction #1.
- **Picker date fields carry `format: "date"`** — a spec-sanctioned
  elicitation hint hosts MAY render as a date control; plain text otherwise.
- **12-case senior-engineer blind probe, 12/12 in-class**: fsync removal →
  "replicas can reconstruct acked-but-unflushed writes"; Redis→JWT → "nothing
  needs to kill a session before its token expires"; retry removal → "the
  duplicate becomes a missed payment". The untouched-side instruction holds
  at guru depth in both languages.
- CI now runs the self-drive loop AND the 46-scenario content battery on
  every PR — standing sensors, merge-blocking.

## 1.13.1 — Release alignment after the concurrent content pass

- Includes the hidden-assumption drafting improvement that landed on main
  immediately after the `1.13.0` tag: Argus now looks for the UNTOUCHED side,
  what a decision quietly assumes will keep behaving because the plan leaves it
  alone.
- Moves the exact package, server manifest, plugin wire, and registry version
  together so main and the published artifact identify the same source.

## 1.13.0 — Judgment foundations, without a human score

- Added the public `argus_record` semantic writer for four answerable record
  shapes: a claim reality can answer, a commitment, a chosen standard, or a
  moment preserved without a future return.
- A model proposal can no longer become the user's judgment silently. Human
  authorization and AI-adoption lineage are explicit ledger facts.
- Preserved the first utterance, kind derivation evidence, review-condition
  status, observation source, event trigger plus fallback date, and append-only
  statement/kind corrections.
- Return answers now keep reality, commitment, and question validity separate.
  Event detection may invite one return, but never writes the answer.
- Removed result aggregates from recall and continuity projections. Legacy
  fields remain readable; Argus stores and shows no score for the person.

## 1.12.0 — Content sharpening + the logbook

Validated by a 34-scenario real-server content battery, a revived 75-day
life simulation, and an 18-case blind content probe (six independent host
models given the real instructions; 18/18 correct fire/silence decisions).
What the probes changed:

- **Instructions define falsifiable and ban the double-ask.** Hosts kept
  vague predicates ("the launch won't flop") and asked in chat while the
  confirm picker was already asking. The instructions now define
  falsifiable (a stranger could mark it true/false from observable facts,
  with a sharpening rule) and state that the chat line beside a picker
  states, never asks. Re-probed after the change: vague verbs got anchored
  to the nearest observable comparison, prose asks disappeared.
- **Locale sense reads nested premises[].text** — a Korean add-premises
  call no longer gets its first error in English.
- **Identity, restrained:** the wake box is now the LOGBOOK / 항해일지
  ("<date>부터 항해 중"), keepsake cards are exempt from the one-line
  length lint, and two stray casual registers moved to 합쇼체 (copy gate
  widened so the class stays fixed).

## 1.11.0 — The picker stops blocking the door

Founder dogfooding (2026-07-27) hit the settlement picker dead-end live: pick an
outcome, press Accept, and the form blocks with a red "This field is required".
Root cause: `required` in the elicitation schemas — hosts render a required enum
collapsed (one extra key to expand) and hard-block an empty Accept inside the
form. The very dead-end R34 removed server-side had moved into the client, on
the return (settlement) path.

- **No elicit schema declares `required` anymore** — settle outcome picker,
  still_pending re-check-date picker, premises open-question resolve, and both
  ambient asks. An empty Accept flows into the same honest path as Decline:
  the server re-asks (OUTCOME_REQUIRED / RESOLVE_NEEDS_DECISION) or writes
  nothing. Spine untouched — nothing is inferred from an empty answer.
- **CI guard** (`picker-no-required-field.test.ts`): reintroducing `required:`
  into any `elicit(...)` schema turns the build red, with a self-check fixture
  proving the guard can see.
- Picker prompts now state the two exits explicitly ("고르고 Accept · 아직
  모르겠으면 Decline").

## 1.10.0 — The wire says which build it is (the twelve silent days)

The deepest failure found so far was not in any prompt or picker — it was in one
version spec. The plugin wired the server as `npx -y argus-decision-mcp@^1`, and
**npx reuses a cached install whenever the spec is a range**: once 1.2.0 landed
in the founder's npx cache on 2026-07-13, the wire froze there while 1.3.0
through 1.9.0 were published. For twelve days every improvement — the detection
sharpening, the settlement rider, the sensitivity dial, and the picker redesign
that dogfooding itself had asked for — shipped to npm and never reached the
session that reported the problem. Repo CI was green the whole time, because the
repo *was* consistent with itself. **The one number nobody could see was the one
the user was touching.**

- **`argus_check_in` reports `data.server_version`** on all three return paths
  (first run / nothing due / something due), from the same `packageMeta()` single
  source the server advertises at `initialize`. A session can now answer "which
  build am I actually talking to" instead of leaving staleness to be *felt* as
  behavior that mysteriously isn't there.
- **The wire is pinned to an exact version, and the pin is guarded.** The bundled
  `.mcp.json` pins `argus-decision-mcp@1.10.0`; `one-install.test.ts` now refuses
  a range spec (`^`, `~`, `latest`, `*`) and asserts pin == this package's
  version == `server.json`'s registry version. Bumping the server without moving
  the wire in the same commit turns CI red — the stale-pin failure mode that an
  exact pin would otherwise introduce.
- **E2E covers the path a user installs.** `evals/e2e-picker.mjs` gained the
  settle-picker round-trip (the 1.9.0 self-sufficiency fix was unit-only, the same
  blind spot class) and a `server_version` assertion; CI now runs the whole suite
  a second time against the **packed tarball installed as a dependency**, not just
  the repo's `dist/`.
- The hand-copied install command on the web (`/import`) asks for `@latest`
  explicitly — the mirror case: a bundled wire wants determinism, a copy-paste
  command must never inherit a stale cache. Guarded by a render test.

## 1.9.0 — The picker stops fighting the user (native Accept/Decline)

Dogfooding exposed the confirm picker as clunky: it used a REQUIRED three-way
`choice` enum, so a host rendered it as an unset field the user had to expand,
pick, then Accept — 3-4 keystrokes for what is a yes. Redesigned to the host's
native Accept/Decline plus optional edit fields, verified end-to-end against a
real stdio server (`evals/e2e-picker.mjs`, now a CI gate) and against the
published tarball installed as a user would.

- **Predict confirm → one keystroke.** Accept with both fields blank keeps the
  draft (recorded as the user's); Accept with `reword` saves their wording;
  **Accept with `check_by` adjusts the horizon inline** (the "that date feels
  off" escape — keep the statement, fix only the date); Decline records nothing.
  No required enum to hunt for.
- **Premise confirm → same native shape.** Accept keeps (provenance ai_surfaced
  intact), Accept + reword saves the user's words (draft kept as ai_original),
  Decline drops just that draft.
- **Settle picker is self-sufficient.** The outcome picker now also carries an
  optional what-happened field, so a settle that reaches the picker no longer
  dead-ends on WHAT_HAPPENED_REQUIRED after the user already answered — it
  completes in one round. Model-supplied words still win; the picker text only
  fills the gap. What the user types is their own words (spine-safe).
- Tool/prompt descriptions updated to describe the Accept/Decline picker, so the
  model narrates the real interaction instead of a Keep/Reword/Skip menu.

## 1.8.0 — The ask becomes structural: premise picker, honest wire, one dial

The founder's activation invariant — an AI draft must be SHOWN to the user
before it lands, via a real picker, not narrated past them — extended from
predictions to every surfaced draft, plus honest surfacing of the two silent
failure modes dogfooding exposed.

- **Premise one-tap confirm.** An `ai_surfaced` load-bearing premise (single
  draft, `argus_capture add_context`) now fires the same Keep / Reword / Skip
  picker `argus_predict` drafts get. Keep records it with provenance
  `ai_surfaced` unchanged (a tap approves the recording; it does not transfer
  authorship — predictions differ deliberately: a bet must become the user's).
  Reword typed in the form is saved verbatim as `user_stated` with the draft
  preserved as `ai_original`. Skip / declined / no-elicitation host → the
  friction escape stays.
- **Picker availability is visible.** `argus_check_in` now returns
  `data.picker: "one_tap" | "text_fallback"` so a session (and `/doctor`) can
  distinguish "host shows real pickers" from "asks fall back to text" — the gap
  that made a working install look broken.
- **Plan+work turns un-suppressed for raw MCP.** The standing-sense refresh
  (re-injected with every tool result) repeated "stay silent on task turns"
  without the plan-handed-as-work exception, re-suppressing R28's fix on every
  call — the diagnosed reason raw MCP lagged the plugin on hard cases. The
  refresh now carries the exception; a drift test pins it.
- **Sensitivity dial, MCP half.** The refresh now reads the SAME
  `~/.argus/config.json` `ambient.sensitivity` / `ambient.opt_out` the plugin
  dial writes, appending an enum-gated one-line bias (low / high / off).
  Off never silences outcome bookkeeping the user states. Values are never
  interpolated raw into instructions.

## 1.7.0 — Sharper firing boundary: stack, ask-vs-commit, stale, plan+work

Four rounds of the self-evolution loop tightened *when* and *how* the senses
fire, cutting over-fire without losing recall. Spine invariants unchanged
(single clause, `ai_surfaced` provenance, no verdict / fork / lean).

- **No stacking (R17).** Predict and capture each surface exactly one call —
  never two premises fused as "A and B" / "A so B" in a single output. Measured
  spine-stacking violations −57%.
- **Ask ≠ commit (R19).** A question the user puts to *you* (which is better,
  will this work, write me X) is soliciting help, not a prediction — answer it
  and stay out. A positive restraint gate fires only when the user is COMMITTING
  to a consequential call, not asking for advice, a fact, or a task. Frozen-bench
  over-fire 1/8 → 0/8.
- **Current-turn only (R21).** A new prediction/premise must come from the user's
  latest message; never reach back to re-surface a past turn's claim mid-new-topic.
- **Plan handed as work still counts (R28).** "Here is the plan, start with X" is
  still a plan — the execution request does not cancel the load-bearing call
  underneath it. Restores hard-case capture that the R19/R21 restraint had
  over-suppressed, with no over-fire regression.

## 1.6.1 — Load-bearing assumption, aimed at the specific unstated premise

The self-evolution loop's new hidden-extraction gate (does Argus surface the
*right* unstated premise, not merely fire?) measured the flagship sense at 2/6.
Root cause: it captured the surface reason the user already stated instead of the
deeper premise the decision actually reverses on.

- **Sense #3 sharpened (SERVER_INSTRUCTIONS).** The load-bearing assumption is
  usually NOT the reason said out loud; it is the specific, often-unstated fact
  the decision REVERSES on if false — named concretely, never a restatement of
  the stated rationale. Spine invariants unchanged (single clause, ai_surfaced
  provenance, no verdict / fork / lean); precision only. Frozen-bench extraction
  2/6 → 11/14, judge validated at recall/specificity 1.0 across 28 probes.

## 1.6.0 — Settlement by structure, restraint by measurement

The overnight self-evolution loop (synthetic multi-turn conversations, real API,
adversarial judges — see `argus-plugin-v2/evals/detection/EVOLUTION-LOG.md`)
surfaced two real defects and this release fixes both:

- **Settlement recall was structurally capped.** Raw-MCP sessions missed
  settlements (13/38 in the first mass run) because the model only held the
  open-predictions list if it had called `check_in`. Now EVERY public tool
  result carries the open predictions (top 10) plus the standing sense line —
  any Argus call re-arms the background sense. Structure first; the prompt is
  the assist. (Rider in `runPublic`; failures degrade silently, never breaking
  the primary result.)
- **Over-fire in dense conversations.** In realistic work sessions the model
  fired on task requests, scheduling, and chitchat (58% of no-signal turns).
  `SERVER_INSTRUCTIONS` restraint now names the non-decision turn types
  explicitly (do a task / logistics / small talk → record nothing; unsure → do
  nothing) — measured effect: 58% → 43% over-fire with recall unchanged, and
  the loop keeps grinding it down. Restraint also moved from per-session to
  per-decision: offer once per distinct decision, a skip is final for it.

Ledger, seal, and settle behavior is unchanged.

## 1.5.0 — Standing sense: the always-on detection channel

The MCP server can never see the raw conversation (JSON-RPC carries only
structured tool arguments), and Claude does not support server-driven sampling —
so "the model will notice a passing prediction / a surfacing outcome / an
unstated assumption" was a goodwill dependency. This release strengthens the two
channels that DO reach the model every session, without overclaiming a per-turn
trigger the protocol does not provide.

- **Tool descriptions carry a standing sense.** A tool's description is the only
  server text that is ALWAYS in context after connect (instructions load once at
  initialize; results only on a call). `argus_predict` / `argus_resolve` /
  `argus_capture` / `argus_check_in` now each carry one line of the sense they
  serve — a working claim with a horizon IS a prediction; an outcome surfacing by
  pronoun ("그거 결국 잘 됐어") should be resolved THEN; the load-bearing
  assumption a decision rests on is usually UNSTATED (surface at most one, as an
  ai_surfaced draft).
- **`argus_resolve` description corrected.** It no longer implies waiting for the
  check-by date — when reality answers in the conversation, record it then.
- **`check_in` re-injects the sense with open predictions.** When it returns open
  predictions, it now carries `standing_sense` (single source: `spine.ts`
  `STANDING_SENSE_REFRESH`) so the background sense is refreshed on each call —
  the tool-result channel, since the protocol has no every-turn trigger.

Measured (see `argus-plugin-v2/evals/detection`): with server instructions + tool
definitions and NO hook, the model fired the correct tool on 18/23 warranting
turns and over-fired on 0/8 chitchat turns — raw MCP detection is not a coin flip.
Behavior of the ledger, seal, and settle loop is unchanged.

## 1.4.7 — Re-diagnosis pass: the accumulated backlog, closed

Re-ran the full 1.4.6 verification battery (misuse / fuzz / guru / surface-content
harnesses: all 0 flags), then fixed everything the four rounds had deferred plus
what the surface re-read found.

Advertised-then-rejected contracts (the worst class: the schema promises what the
validator refuses)
- **`dismiss_reason` enum divergence**: the public façade advertised
  `superseded` / `user_declined`, but the internal validator only accepted the
  legacy set — a model following the advertised contract got INVALID_INPUT. The
  internal enum is now the superset; the settle picker's "no longer matters"
  path also writes the canonical `became_irrelevant` instead of free English
  prose that leaked raw into `argus_patterns` payloads.
- **`include_upcoming_days` > 30 hard-errored** even though the handler clamps
  the window to 30. The schema now accepts up to 365 and documents the clamp.

Over-fire and lost detail
- **NOT_FALSIFIABLE over-fire**: a single "아마도" hard-blocked predicates that
  carry a number, date, or threshold ("아마도 2월엔 매출 1억을 넘는다"). An
  observable-anchor bypass now limits the vibe heuristic to PURE feelings; the
  plugin's SEED-gate copy is hand-synced.
- **INTERNAL_ERROR lost its diagnostic detail in Korean**: the ko localization
  overwrote handler-authored Korean messages (e.g. `내부 오류: EACCES …`) with
  the generic line. Handler-authored Korean is now preserved (quoted user text
  doesn't count as "authored Korean"), and English `Internal error: <detail>`
  carries its detail across the language switch.

Calibration integrity + erasure coverage
- **Replay stats are now state-derived, not event-counted**: a duplicated or
  reordered seal/settle line in a hand-edited/merged ledger can no longer
  inflate the calibration record. Invariant total_settled == sum(buckets) holds.
- **`local-purge` now covers the v1 workspace store**: `--argus-dir <abs>` +
  `--confirm-argus-dir <abs>` removes `ledger/`, `calendar/`, `sessions/`
  (receipts) under a v1 `.argus/` dir — dry-run first, confirm-verbatim, never
  the directory itself or config.yaml. Purging only the v2 home had left v1
  decision data behind.

Surface re-read fixes (the "실제 내용" pass)
- **Wake header "예측 저장 0" misread**: after settling, the count dropped to 0
  and read as "nothing was ever saved". The slot now says what it means:
  `확인 대기 N` / `awaiting check N`.
- **Data-minimal receipts were mostly placeholders**: three "(없음)" section
  rows collapse into one neutral line when nothing optional was recorded.
- **Em-dash cadence swept from every inline user-facing string** outside the
  SURFACES tree (elicit pickers, error recoveries, telemetry notices, review
  surfaces, numeric-drift reasons…) — the ban was CI-enforced only on SURFACES
  leaves, so a new gate (`surface-no-em-dash-inline.test.ts`) now scans inline
  literals too.
- **capture ↔ predict cross-reference** in both tool descriptions (the
  "capture-vs-predict" confusion: predict works with a fresh id, no prior
  capture needed; capture alone sets no check date).
- The over-fire gate's `lean_disclosure` is now a localized SURFACES leaf (it
  was a fixed English sentence in Korean sessions), and the "기대-" phrasings
  the founder flagged are gone from user-visible copy (딛고 선 / 위에 서 있는지).
- EN pluralization: "premise(s)" / "decision(s)" render as real singular/plural.

Deferred (with reasons, unchanged): argus_watch reminder path (needs a public
surface design), LOGBOOK/candidates monorepo sibling-workspace scoping (repo
boundary decision), v2 outbox wiring, legacy/pilot surface enums (low exposure).

## 1.4.6 — Real-user-mistake pass: the errors a fumbling user actually hits

Found by triggering ~45 misuse cases in a Korean session and reading every
message a confused user (or the model acting for them) sees, plus two source
reviews of error-UX and first-run ergonomics. The guiding question: does each
error name what went wrong, why, and the exact fix — in the user's language?

The worst two (both hit a Korean user constantly)
- **A Korean id was rejected with a "use YYYY-MM-DD date" hint.** A model naming
  a decision `이직-결정` (Korean) got `id: 형식이 올바르지 않습니다 (예: 날짜는
  YYYY-MM-DD)` — a date hint on an id field. Now: `id: 영문·숫자와 . _ - 만 쓸 수
  있습니다 (한글·공백·특수문자 불가 — 예: "career-move")`.
- **A bad argus_dir (relative / unexpanded `${VAR}`) surfaced as a raw
  INTERNAL_ERROR** with no recovery — the #1 setup mistake. Root cause: after the
  handler produced a proper error, the dispatch re-resolved argus_dir for
  locale-learning and re-threw, clobbering it. It now returns a localized message
  naming the fix (absolute path, or drop ARGUS_DIR for the ~/.argus default).

Wrong-value errors now teach
- Enum mistakes (`stakes:"medium"`, `outcome:"success"`, `view:"history"`,
  `action:"settle"`) now list the valid values, so the model self-corrects
  instead of retrying blind.
- Korean messages added / fixed for `ILLEGAL_TRANSITION` (a typo'd id was
  mislabeled a "wrong state"), `BAD_CHECK_BY` (a calendar-invalid date was called
  "not future"), `AMBIGUOUS_REF` (told you to "pass text" for a field that has
  none), `NO_SUCH_PREMISE` (dead-end when the decision has no premises),
  `PREMISE_LOCKED`, `ARGUS_DIR_INVALID`, `EMPTY_PREDICATE`, and reserved/aliasing
  ids. `outcome_source` now defaults so a model can't fail on the constant.

Cold-start ergonomics
- **The session-start `argus_check_in` no longer dead-ends a new user.** A truly
  empty ledger now shows an on-ramp ("describe a decision to begin") with an
  `argus_capture` handle, instead of the same "Nothing is due" a caught-up
  veteran sees. Empty `argus_patterns` views likewise return a capture handle,
  not `stop`.
- **The five settle outcomes are now defined** in the tool schema (held = it
  happened; avoided = the predicted risk didn't; partial = mixed; missed = wrong;
  still_pending = not yet) — a blind `held`-vs-`avoided` pick was silently
  corrupting the calibration record.
- `argus_settings action=update` with no writable field now says "no setting was
  changed" (with the supported list) instead of the opposite "Config read."

## 1.4.5 — Guru pass: injection channels, the ledger lock, schema conformance

A deeper hunt — a runtime harness (corrupt ledgers, terminal-escape injection,
real multi-process concurrency, scale) plus three source reviews (ledger
durability, untrusted-content/terminal safety, MCP protocol conformance). The
harness confirmed the core is robust (ANSI/backspace stripped from surfaces,
concurrency correct, 8 corruption shapes crash-free, 60-decision check_in in
6 ms); the reviews found what runtime alone could not.

Injection & terminal safety (the envelope sanitizer's blind spots)
- **Terminal-escape + AI-verdict spoof through the elicitation prompt (HIGH).**
  The elicitation `message` is a separate request that bypasses the envelope
  sanitizer; a raw predicate/premise interpolated into it (fires automatically
  for an `ai_surfaced` predicate) could carry `\x1b[2J…AI VERDICT: MISSED` and a
  terminal host would clear the screen and paint a forged verdict — the exact
  thing the spine exists to make unreachable. Sanitized now at the one seam
  inside `elicit()`.
- **MCP Resources** echoed raw bidi/zero-width (U+202E/U+200B) — JSON.stringify
  doesn't escape those. Run through the same sanitizer now.
- The due-note tail (appended after the envelope) is sanitized; the sanitizer
  now also covers C1 controls (U+0080–U+009F) and U+2028/U+2029.

Ledger durability
- **The lock could be stolen from a live holder (HIGH).** A >5s critical section
  (large fsync, network FS) made another session treat the live lock as stale
  and steal it — two writers then both appended, double-counting calibration.
  Ported the proven atomic primitive from the v2 store: create via an atomic
  hardlink (no empty window), steal only a lock whose pid is dead or that is
  >10 min old, steal via rename (one winner), release only our own nonce.
- A `settle` with an unknown or `still_pending` outcome no longer breaks
  `total_settled == sum(buckets)`; a per-line BOM (concat / PowerShell
  co-writer) no longer drops the adjacent event; a corrupt (non-object) receipt
  file degrades to null instead of crashing the render.

MCP schema conformance
- **Defaulted fields were advertised as REQUIRED (HIGH).** `z.toJSONSchema`
  defaults to output mode, marking every `.default()` field required — so a
  strict host / the MCP Inspector would reject `argus_check_in {}` (the mandated
  session-start call), `argus_patterns {}`, and a premise without
  kind/external/load_bearing. Fixed with `io:'input'`.
- `argus_check_in` / `argus_patterns` now declare `readOnlyHint:false` (they
  auto-initialize `.argus/` on first use — the hint must not lie); the envelope
  output schema now declares the `recovery` / `invalid_fields` that error
  results carry.

Deferred (noted): v1 replay counters are per-event not state-derived, so a
hand-edited/merged ledger with duplicate or out-of-order events can inflate
counts (external-file only); the LOGBOOK/candidates repo-scoped projection
(monorepo sibling-workspace exposure); `local-purge` v1-store coverage.

## 1.4.4 — Relentless bug hunt: record integrity, dates, paths, calendar

Found by a multi-angle hunt — an aggressive runtime fuzz (concurrency, unicode
ids, boundary dates, illegal sequences) plus four adversarial source reviews
(state machine, input safety, i18n, data lifecycle). All confirmed by executing
the real handlers.

Record integrity
- **The settled receipt could show a STALE prediction.** After
  `change_prediction`, the receipt kept the pre-amend predicate while every list
  showed the amended one — the keepsake contradicted the ledger. The receipt now
  takes its prediction/date from the ledger fold.
- **Goalpost hole via defer closed.** `due → still_pending(defer) → sealed`
  re-armed a contract so the state machine treated it as never-due, letting the
  **prediction be rewritten after its original check-by had passed**. Re-dating
  via defer stays allowed; rewriting the claim is now refused.
- **Duplicate premise ordinals under concurrency.** The premise-add path
  assigned ordinals outside any lock, so two sessions could both create "P5"
  (the second unreferenceable). Ordinals are now derived under the ledger lock.

Dates
- **Receipts no longer show "yesterday".** seal/settle stamped the date in raw
  UTC while every comparison uses the tz-aware `today`, so a Korea-time morning
  seal was dated to the previous day. The stored date now matches `today`.
- **Calendar-invalid dates refused.** `2026-13-01` / `2026-09-31` passed
  validation (only lexical "is it future" was checked) and sealed a malformed
  `.ics`; a real calendar check now rejects them.

Calendar (.ics) — the only account-free return channel
- **`change_prediction` now rewrites the `.ics`** so the reminder rings on the
  amended date, not the stale one.
- **Fold on UTF-8 octets, never mid-codepoint** (emoji were corrupted to U+FFFD;
  Korean lines blew the RFC 75-octet limit); **a lone CR / control char** is now
  neutralized instead of written raw; the Korean reminder is **host-neutral**
  (was hardcoded to "Claude").

Paths & input
- **Windows reserved names (CON, NUL, COM1…) and trailing-dot/space ids are
  refused** — they aliased to one file or the null device (silent data loss).
- `id` now advertises its 1–128 bound everywhere (was unbounded on
  predict/amend); `numeric_value` must be finite (was stored as `null`).

Korean voice
- Localized the `source` enum in recheck surfaces (was raw `host_reported`);
  unified `partial`→부분 / `still_pending`→대기 across the flow; removed the last
  banned 갈림길 from a legacy tool description; reworded the EN crux description
  off fork framing.

Deferred (noted, not silently dropped): the numeric-materiality reason strings
still surface Korean in an English recheck (needs a reason-code layer); the
LOGBOOK/candidates repo-scoped projection can expose a sibling workspace's
decisions when two workspaces share one git root; `local-purge` erases only the
v2 durable store, not the v1 workspace ledger/receipts; the v2 durable outbox is
unwired; legacy/pilot surfaces (candidates, watch, semantic-record) and EN
pluralization polish.

## 1.4.3 — Surface content pass: the receipt, the Korean voice, the calendar

Found by reading every surface of the published package out loud (not just
running tests). All user-facing content, no behavior change.

- **The wake tally added up wrong.** `results recorded (2): held 1 · avoided 0 ·
  partial 0` sat above a visibly `missed` row — the `missed` count was dropped
  from the summary and the row printed the raw enum (`missed`/`held`) instead of
  the localized word. Both fixed; the counts now include 빗나감/missed.
- **The keepsake's frame didn't close.** Receipt / seal / wake box borders were
  built from `String.length`, which counts each Korean character as one column
  while a terminal renders it as two — so top and bottom edges disagreed by
  several columns. All three now derive both edges from one display width.
- **The .ics calendar reminder — the only return channel without an account —
  was English-only** and told the user to "run argus_check_in" (a tool name). It
  now speaks the language the prediction was sealed in.
- **Korean voice:** removed the banned 갈림길/가르는 family from live copy;
  stopped the gate surface leaking a model-directed imperative to the user;
  unified 정산 → 결과 기록; fixed the detached 부터 particle; smoothed the
  receipt basis line (`…판단한 내용 판단` → `…돌아보니 판단이 컸다`); dropped the
  `(predicate_owner: …)` machine tag off the prose; unified the seal register.
- **The settle picker** ("그렇게 됐다 (held) …") was a bilingual mishmash shown
  to every user; it now localizes like every other elicitation, as does the
  open-question closing prompt.
- **Korean errors no longer get overwritten:** a hand-written Korean message
  (e.g. the not-falsifiable refusal) is preserved instead of replaced by a
  generic line. The `argus_patterns` view glossary survives in tools/list.
- Removed the raw `%%` / `stakes와 reversibility` tokens from user-facing lines.

Deferred (noted, not silently dropped): the numeric-materiality reason strings
still mix locales (needs a reason-code layer); the webapp-guarded review lenses
keep 가른다 until fixed webapp-side; receipt empty-row condensing.

## 1.4.2 — Closing-loop anchor identity

- `argus_resolve` now advertises the canonical Argus closing-loop anchor through
  the MCP tool `icons` field. Supporting clients render the same mark used when
  a web decision returns to reality; older clients safely ignore the metadata.
- The icon URLs point to production assets and are covered by the public
  tool-surface test.

## 1.4.1 — update_fact actually fixed

- The 1.4.0 handler-level `source` default ran AFTER schema validation, so the
  concurrently-merged schema (which requires `source` on `update_fact`) still
  rejected every source-less call. The default now lives in the schema itself
  (`user_stated`), verified against the published artifact. One regression test
  pins the public path.

## 1.4.0 — Real-usage fixes: project isolation, Korean error parity, honest flows

Found by driving the published package like a real user (30+ scenarios, every
surface read end-to-end) plus an adversarial correctness review.

- **Project isolation: cross-project leak closed.** `argus_check_in`'s payload
  carried a machine-global `v2_brief` — decisions from OTHER projects (their
  full text) leaked into every project's tool output, and with it into the
  model's context. The v2 shadow diagnostics (`v2_brief`, `v2_divergence`,
  `capture_status`) are now emitted only under `ARGUS_V2_DEBUG=1`. This also
  shrinks an empty project's check_in from ~3.6 KB to a few hundred bytes.
- **Korean error parity.** `NO_PRIOR_SEAL`, `BAD_CHECK_BY`, `ILLEGAL_TRANSITION`,
  `ALREADY_SETTLED`, `DECISION_CLOSED`, `GOALPOST_MOVED`, `NO_SUCH_PREMISE` now
  have first-class Korean messages with the same actionable recovery the English
  ones always had (previously: a generic "요청을 처리하지 못했습니다").
  `PREMATURE_SETTLE` now includes the dates in Korean too (확인일 · 오늘).
- **Early still_pending now teaches the path instead of dead-ending.** Before
  the check-by date, `PREMATURE_SETTLE` explains exactly what to do on the day
  (`outcome="still_pending"` + `defer_to`), in both locales with the dates
  included. (Allowing pre-due deferral itself touches the state machine's
  goalpost guard and is deferred to a spine review.)
- **`update_fact` un-broken.** The public action failed every call with a
  baffling `source: 값을 확인해 주세요` (an internal required field the public
  schema never surfaced). It now defaults to `user_stated`.
- **No more instructions that don't exist.** Premise surfaces advertised
  `op=amend` — internal syntax a public caller cannot use. Reworded to plain
  language; corrections still land on the record.
- Schema copy: `reconsider_cadence_days` no longer describes itself as an alias
  of a misspelled internal field.

## 1.3.1 — Privacy-first telemetry invite + premise-recording fix

- **Fix: user premises are now recorded on *every* `argus_capture` open, not
  only high-stakes ones.** On a low-stakes / easily-reversible decision the
  over-fire gate does not fire, and premise persistence used to sit behind that
  gate — so a user-supplied premise was silently dropped (no error, nothing to
  re-check later). The record is now always written; the gate governs only the
  surface ceremony, never whether the user's own words are kept.
- **A single privacy-first line at startup** for users who have not enabled
  telemetry. It leads with the promise — *your decisions stay on your machine;
  this server makes no network calls by default* — and offers an optional
  opt-in (`ARGUS_TELEMETRY=1`) to share anonymous usage counts (a random install
  id + which tool ran + version, **never your decisions**). It is stderr-only,
  writes **no file** (an opted-out user's disk stays untouched), never touches
  the stdout JSON-RPC channel, and is **fully suppressed under `DO_NOT_TRACK`**
  so someone who globally opted out is never nudged. No default changed —
  telemetry stays OFF unless you explicitly opt in.

## 1.3.0 — One purpose-led surface: capture · predict · resolve

The tools are now named for the job you do, not the internal state machine. Six
tools replace the old sprawl, so you (and the model) never pick among
lookalike internal parts.

- **Six tools, named for their job.** `argus_capture` (capture a decision's
  premises and open questions in your own words), `argus_predict` (save a
  falsifiable prediction and its check-by date), `argus_resolve` (record what
  reality did, no score), `argus_check_in` (only what needs attention now),
  `argus_patterns` (read past decisions and how often your predictions held),
  `argus_settings`. The old public names (`argus_clarify_decision`,
  `argus_save_prediction`, `argus_record_result`, `argus_history`,
  `argus_review_document`) are gone from the surface. Your durable ledger is
  untouched — event names on disk are unchanged, so existing records keep
  working.
- **Capture captures; it does not interrogate.** `argus_capture` no longer
  poses a crux question. It records the one load-bearing assumption a decision
  rests on as an honest, one-tap draft for you to keep, reword, or skip — it
  never manufactures a fork or a lean. Restraint is the default.
- **A broken premise surfaces across every decision it touches.** When you
  record a result, Argus now names the other open decisions that rest on the
  same premise or the same external fact, mechanically (exact shared text /
  URL / date), never inferred. One re-check, not three.
- **One-tap drafts reach hosts that support them.** The Keep / Reword / Skip
  card (MCP elicitation) is now feature-probed, so on a host without
  elicitation the draft is shown inline instead of being silently dropped.

## 1.2.0 — Durable ledger (v2 groundwork), candidates tool, clearer language

Your decision records now also live in a durable home, and the words got plainer.

- **Durable ledger (dual-write).** Every write still lands in the project's
  `.argus/ledger/` (unchanged, still the source of truth), and is now also
  recorded in `~/.argus/projects/{repository_id}/ledger.jsonl` — a home that
  survives worktree deletion and follows the repository across checkouts.
  Nothing about existing behavior changes; this release lays the rails.
  `argus_check_in` reports `data.v2_brief` (what the durable ledger would say)
  and `data.v2_divergence` (whether the two ledgers agree) so the eventual
  read-switch happens on evidence, not hope.
- **`argus_candidates` (new tool, 15th).** Captured decision candidates —
  from opt-in harvest or manual capture — can be listed, linked to a sealed
  decision, dropped, or snoozed. Listing never recommends an action; left
  alone, a candidate expires after 14 days. Quotes render through a
  control-character sanitizer and are marked as data, never instructions.
- **Opt-in harvest pipeline (off by default).** With `harvest.opt_in: true`
  in `~/.argus/config.json`, session transcripts queue for a once-a-day sweep
  (max 2 candidates per week) that only records quotes byte-verified against
  the transcript. Without opt-in, no harvest file is ever created.
- **Plainer words everywhere.** One name for a sealed thing: *prediction*
  (was: contract / judgment / bet, depending on the screen). Korean screens
  no longer show untranslated tokens (`held 1` → `그렇게 됨 1`). Labels that
  needed decoding are now plain (`ARGUS · WAKE` → `ARGUS · YOUR DECISIONS`).
- **Data lifecycle + hardening.** Export/import (dry-run aware, refuses to
  overwrite a ledger that grew), purge (requires the repository id verbatim),
  pre-migration backup, control/ANSI/OSC sanitization at every render,
  10k/100k-event performance measurements in CI.

## 1.1.0 — Reconsider loop, drift materiality, localization, document parsing

Everything since the 1.0.0 first release.

**공정 M3 · 전제 개통 + 두 기기 안전 (2026-07-08, BLUEPRINT §9.5):**

- **BS-1 closed — per-ledger account namespace**: every ledger now carries a
  stable random install id (`.argus/.install`), and account rows are keyed
  `mcp_<install8>_<slug>`. Two machines (or two projects) sealing the same
  natural slug ("migrate-db") can no longer collide on one account row.
  Legacy un-namespaced rows still map home; another ledger's rows are
  honestly labeled "another terminal ledger" instead of being mis-claimed.
- **Ledger lock — concurrent sessions can't double-settle**: the settle write
  re-guards under a cross-process lockfile, so two simultaneous sessions
  record exactly ONE settlement (the second sees ALREADY_SETTLED). The
  calibration record never double-counts; a crashed lock is stolen after 5s
  so nothing ever bricks.
- **Premise opt-in sync (`premise_sync:true`)**: OFF by default — premise data
  never leaves the machine otherwise (the README privacy contract, now stated
  with the one exception). When the user opts in, a sealed decision's
  MONITORED premises ride the seal push, and the account's autonomous
  premise-watch re-checks them against reality — a material drift now reaches
  the T2 email gate for terminal-sealed decisions too (the intro's third
  routine, 돌아보기, finally covers the terminal).

**공정 M2 · 승격과 다리 (2026-07-08, BLUEPRINT §9.5) — the two loops connect:**

- **Promotion (`from_capture`)**: `argus_premises op=add` can promote a watch
  capture into a decision premise by its `wc-` id — the capture's VERBATIM
  text and provenance carry over, the capture stays on the watch log (a
  reference, never a move), and a captured question promotes as an
  open_question. Promotion stays the user's verb.
- **The web settlement comes home (`import_settlements`)**: `argus_sync` can
  now mirror a settlement the user already recorded on the web into the local
  ledger — their own outcome and words, verbatim (`source_detail:
  'web_settlement_import'` on the event). The flag-only cross-check meant a
  web-settled judgment stayed "due" in the terminal forever; the account API
  now returns the user's settlement words to make the mirror possible. A
  settled account row WITHOUT those words stays flag-only — never invented.
- **Fleet check-in (`fleet: true`)**: `argus_check_in` can sweep every project
  `argus_init` registered on this machine (~/.argus/.bound) and report due
  counts per project — a lighthouse sweep, not a merged ledger; each project
  settles in its own dir.

**공정 M1 · 당직 루프 (2026-07-08, BLUEPRINT §9.5) — the daily watch:**

- **New tool `argus_watch`** — the second, lighter orbit next to the decision
  voyage. `op=anchor` keeps today's one-line aim (the user's words, verbatim);
  `op=capture` notes a swallowed claim / unverified premise / deferred question
  mid-work without opening a decision; `op=list` reads the recent log. Spine
  rulings baked in (§9.2): an anchor is a **note, not a bet** — never
  evaluated, never counted in ids/stats/track_record (the fold keeps watch
  events outside contracts; a test pins it); capture provenance is never
  forged (`ai_surfaced` requires `ai_original`); there is deliberately NO
  separate stance field — the drift guard refuses fork-adjacent schema keys.
- **check_in mirrors the watch**: the most recent prior day's anchor comes
  back first — "'…' — so, how did it go?" — a question, never a completion
  check. And check_in's frame language now follows the LEDGER's own user text
  (anchor / oldest due predicate), so a Korean anchor no longer gets an
  English frame.
- **The restraint cliff has an exit**: a gated-off open_decision now offers
  `argus_watch` — "a note, not an opened decision."
- **Server instructions carry the watch choreography**, including the
  over-fire guard: captures are user-initiated; volunteering "should I record
  this?" on routine work is named as over-fire.
- **Host snippets ship in the package** (`snippets/claude-code-watch.md`): a
  CLAUDE.md block + a SessionStart hook so the host carries the daily rhythm a
  passive stdio server cannot.
- **어휘 1벌 (공정 3 상환)**: the recheck drift surface now returns the handle
  in the same vocabulary as the web T2 email — "결정을 다시 볼지는 당신의 몫" —
  and a vocabulary guard test covers the MCP surfaces.

**공정 M0 · 문과 언어 (2026-07-08, BLUEPRINT §9.5) — the first-day repairs:**

- **Zero-config default dir:** with no `argus_dir` and no `ARGUS_DIR`, every
  tool now lands in `~/.argus` instead of erroring — a brand-new Claude Desktop
  user seals on day one with an empty `env`. An unexpanded `${...}` /`%VAR%`
  config variable now gets an error that names the actual problem (the host
  didn't interpolate) instead of "must be an absolute path".
- **The receipt speaks your language (FC-2 closed):** `renderReceipt` joined
  the locale brain — a Korean journey now ends in a fully Korean Judgment
  Receipt (settle and recall). The `AI VERDICT … NONE` line stays English in
  every locale: it is brand DNA, not copy.
- **Bounded check_in:** `data.due` caps at the 20 oldest with a
  `due_truncated` disclosure; `due_count` keeps the true total. A three-week
  gap no longer floods the host's context.
- **`reconsider_cadence_days` alias:** the historically misspelled
  `reponder_cadence_days` field now accepts the spelling a model will
  naturally write. Either works; one is stored.
- **Human sync-failure sentences:** a failed account sync now says "the token
  was rejected (HTTP 401) — it may be expired…" instead of splicing the raw
  `http_401` token into the seal confirmation. The machine enum stays in
  `data.account_sync_reason`.
- **README doors:** Claude Desktop (no env interpolation → absolute path or
  zero-config), Windows (`cmd /c npx` form), and the timezone default corrected
  (unset = your machine's local zone, not UTC).

- **Reconsider loop (M1/M3):** an in-session ambient due-line and a formalized
  recheck cadence surface what's due without leaving the session; an
  `open_question` left unresolved is nudged back periodically — a fact + a
  handle, never a verdict, and leaving it open stays a valid answer.
- **Drift materiality (M2):** a 3-valued drift engine with canonical unit scales,
  so a re-checked number reports material / immaterial / unknown instead of a
  raw diff.
- **Localization (M4):** runtime language detection localizes the surface tools,
  so a Korean session no longer gets English surfaces.
- **MCP spec compliance:** https is enforced on any API-base override (the
  account token never travels in cleartext), the 2025-06-18 top-level tool
  `title` is emitted, and the README/description are narrowed to the hosts
  actually supported (local **stdio** — no false ChatGPT/Gemini claim).
- **`argus_review` document extraction:** `.pdf` / `.docx` / `.pptx` are now
  text-extracted with page/slide anchors (previously binaries were refused);
  two-column PDFs get gutter detection, tables keep their cells, and scanned or
  image-only input degrades honestly. The extractor links evidence → claim and
  claim → claim, so the review shows the argument's load-bearing structure.
  Response is bounded so a large document can't return a giant result.

## 1.0.0 — First release as `argus-decision-mcp` (2026-07-03)

Rename + version reset from `argus-mcp`. Bundles the full prior surface: the
seal → settle receipt loop whose Judgment Receipt carries `AI VERDICT … NONE`
(the model never grades you, reality does), living premises (`argus_premises` /
`argus_recheck`), the `argus_review` document reviewer (paste/text; binary
extraction landed in 1.1.0), and forward-compatible ledger replay. The
pre-rename entries below detail that work.

---

## Pre-rename history (`argus-mcp` — folded into 1.0.0 above)

## 1.3.0 — Living premises

The receipt's `THE UNVERIFIED ASSUMPTION` line becomes a tracked object.

- **New tools:** `argus_premises` (add / amend / resolve — user-authored,
  provenance-preserving, elicitation-only resolve) and `argus_recheck`
  (mechanical numeric drift on explicit numbers, provenance-tagged `changed`
  assertions for text facts, `apply_to_matching` cross-decision fan-out).
- **Extended:** `argus_recall view="premises"` (provenance + honest staleness),
  `argus_check_in` reports due premise facts (grouped — one fact, one re-check),
  `argus_settle` takes an optional user-attributed `broken_premise_ref` and the
  track record gains a premise-attribution frequency line,
  `argus_seal` promotes a named `unverified_assumption` into the premise set
  (the set is canonical; the receipt renders its summary from the fold).
- **Return loop (passive-server honest):** every successful tool response
  carries a quiet `due_note`; new `argus://premises/due` and
  `argus://premises/{id}` resources; the `/argus-settle` ritual includes the
  re-check choreography.
- **State machine:** premises never self-create, lock at check-by
  (`PREMISE_LOCKED` — no retroactive premise-planting, no retiring the premise
  about to be proven wrong), closed decisions refuse premise events.
- **Privacy:** premise data is never part of the account-sync payload.

## 1.2.1 — Forward-compatible ledger replay

- Unknown-but-versioned ledger events (written by a newer argus-decision-mcp) are now
  skipped silently (`integrity.skipped_unknown`) instead of being counted as
  corruption — an old install never raises a false integrity alarm on a new
  ledger. Ship this before adopting any release that writes new event types.
