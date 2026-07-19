# Changelog

> Published on npm as **`argus-decision-mcp`**. The package was renamed from
> `argus-mcp` (that name was already taken by an unrelated tool) and its version
> **reset to 1.0.0** for the first release under the new name on **2026-07-03**.
> The `1.3.0` / `1.2.1` entries at the bottom are pre-rename `argus-mcp` history,
> kept for reference — all of that work shipped inside the new-name 1.0.0.

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
