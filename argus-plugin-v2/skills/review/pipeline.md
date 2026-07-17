<!-- Supporting file of /argus:review — NOT a skill. This is the full pipeline
     orchestrator (formerly the /argus:sail skill body). It runs ONLY when the
     user explicitly invoked /argus:review or its legacy alias /argus:sail;
     the old "trigger on natural language, even without the slash command"
     behavior is retired (O3 방2 activation contract — 자동 deep review 0).
     Handles repo decisions (PR, design doc, architecture) and non-code ones
     (market entry, hiring, vendor, pricing, a PPT/report). Targets may be named
     in plain prose; office files extracted per clarify.md §Document Extraction.
     Output is one practical read, not a multi-agent report. -->

# /argus:review — pipeline

## Product Contract

Argus must not feel like a complex multi-agent machine. Internally it may run
clarify, team, verify, boss, and revise. Externally it gives the user their
current coordinates in a decision:

> "I know the current course, why that course is justified, what remains unclear,
> what path I am not taking, what to do next, and what future claim could be
> checked against reality."

The default user-facing output is either:

- a MinimalScaffold for low-density reversible decisions, or
- a current call for medium/high decisions.

Do not expose worker counts, ledger counts, schemas, model names, or phase names
in the default read. Those details live in `.argus/sessions/` and
`/argus:versions`.

## Question Budget — at most 2 `AskUserQuestion` per run (HARD CAP)

Friction-to-first-value is the #1 bounce risk: a busy user leaves at the second
prompt, long before the track-record payoff. So the ENTIRE run (sail plus the
clarify / team / verify / boss it chains) surfaces **at most 2** `AskUserQuestion`
prompts. Every other decision point **infers a default and surfaces it in the
card for correction — it does not ask.** This governs every sub-skill; a
sub-skill's local "ask" is permitted only if a budget slot remains.

**Fill the ≤2 slots in this priority order, then stop asking:**
1. **Disambiguation** — only when a named artifact genuinely fails to resolve
   (clarify §Ambiguity: a number matches no PR, a path doesn't exist, several
   branches match). A real "which one?" earns a slot; a guess never.
2. **The one load-bearing crux / weakness** — only when clarify's under-fire gate
   fires (`frame_status == "load_bearing"` AND `framing_confidence < 70`): ONE
   neutral question on the weakest load-bearing assumption. On a `flat` frame,
   ask nothing (manufacturing a question on a flat case is the mirror-clause
   violation — CLAUDE.md).
3. **Stakes / check-back** — only when `stakes_confidence < 75` (Step 6b).

**Never a question — infer and surface instead:**
- **The BIND lean (clarify Step 3.4)** is NOT a pre-ask. Capture a lean ONLY if
  the user volunteers one in their own words; never prompt "where are you
  leaning". No volunteered lean → no rope, no manufactured moment.
- **The Wake (Step 7.5)** is a single neutral line in the card ("출발 때 당신은 X라
  했어요 — 지금도?"), surfaced for the user to react to, NOT an `AskUserQuestion`.
- **Session resume (Step 2)** defaults from git/session state; only ask if truly
  ambiguous AND a slot remains.
- clarify's second/skeleton fork probes fold into the single crux slot or are
  inferred.

`--no-prompt` / non-interactive: **0** questions — infer every default, surface
every one in the card.

---

## When To Run

The default entry point. The argument is plain prose — quotes are optional
(`/argus:review PR 12 머지해도 되나` works as-is), and when the text names a PR,
issue, file, branch, or document, clarify detects and reads that artifact
(see clarify §Inputs); the user never needs reference syntax. Claude may also
invoke this skill WITHOUT the slash command when the user's plain request
matches the description triggers — treat that invocation identically:

- `/argus:review "<problem description>"`
- `/argus:review "PR 12 머지해도 되나?"` (prose target — clarify expands it)
- `/argus:review "docs/strategy.md 방향이 맞나?"`
- `/argus:review @PR#123` / `@<file>` (explicit override when prose is ambiguous)
- `/argus:review` (no args — autodetect from git state)
- `/argus:review --full "<problem>"`
- `/argus:review --quick "<problem>"`
- `/argus:review --no-boss "<problem>"`
- `/argus:review --resume <session-id>`

---

## Path Resolution

When this skill (or any sub-skill it invokes) refers to
`${CLAUDE_PLUGIN_ROOT}/data/...` or `${CLAUDE_PLUGIN_ROOT}/lib/...`, resolve in
this order — **first hit wins** (this is the canonical order; every Argus skill
defers here):

1. **Plugin install (the documented path):** `${CLAUDE_PLUGIN_ROOT}/data/` and
   `${CLAUDE_PLUGIN_ROOT}/lib/` — Claude Code sets `${CLAUDE_PLUGIN_ROOT}` to the
   plugin's install directory when Argus is installed via the marketplace. All
   bundled files ship with the plugin; no extra install step is needed.
2. **Copy install (legacy `install.sh`):** `~/.claude/argus-data/` and
   `~/.claude/argus-lib/` (note: session docs live under `argus-lib/session/` —
   `install.sh` preserves the subdir; do NOT look for them flat).
3. **Developer mode (working inside the Argus repo):**
   `<repo>/argus-plugin-v2/data/` and `<repo>/argus-plugin-v2/lib/`.

Directory contents: `data/` = schemas, agents.yaml, boss-types.yaml,
classification.yaml, prompts/; `lib/` = locale-conventions.md,
config.example.yaml, rehearsal-prompt.md, session/ (session-layout.md,
version-numbering.md).

If ALL three locations are absent, stop with one line in the user's locale —
ko: `Argus 데이터 파일을 찾을 수 없어요 — 플러그인을 재설치해 주세요
(/plugin install argus@argus).` · en: `Argus data files not found — reinstall
the plugin (/plugin install argus@argus).` Never improvise schemas from memory.

Session artifacts live in:

- `<cwd>/.argus/sessions/`

---

## Step 0 - Load Config

**Zero-droppings rule for auto-invocation.** When sail was triggered from a
plain natural-language request (no explicit `/argus:review`), do NOT create
`.argus/` or any file yet. Hold all writes in memory through clarify's initial
analysis; create `.argus/` only once the decision is confirmed non-trivial
(`decision_density` medium/high, or the user engages with a question). If the
density turns out low, answer with the minimal card inline and write
NOTHING — a mistaken auto-trigger must leave the user's repo byte-identical.
Explicit `/argus:review` invocations create files as written below.

Read `.argus/config.yaml`.

**If missing, silently create from `${CLAUDE_PLUGIN_ROOT}/lib/config.example.yaml`** (resolve per §Path Resolution; no AskUserQuestion — first-run friction was the discoverability killer). First ensure the target dir exists: `mkdir -p .argus` (on a true first run in a fresh repo `.argus/` does not exist yet, so writing the config straight away would fail).

**Privacy default — write `.argus/.gitignore` on first create** (unless it already exists) so sessions stay local by default:
```
# Argus: decision sessions can contain code diffs + business context.
# Remove this line (and set archive.commit_sessions: true) to share with your team.
sessions/
# The ledger holds your personal predictions and settled outcomes verbatim.
ledger/
errors.log
```
If `config.archive.commit_sessions == true`, omit the `sessions/` line so the user's opt-in to team sharing is honored. The `ledger/` line stays even then — the calibration record is personal by default; the user can delete the line by hand to share it.

If `.argus/.gitignore` already exists but lacks the `ledger/` line (it predates the settlement loop), append the two ledger lines above — do not touch the rest of the file.

**Substitute the detected locale into the written config — do not leave the template's `locale: ko`.** The template defaults to Korean; if you write it verbatim, every downstream output is Korean regardless of the user. After detecting locale (below):
- Set `locale:` in the written config to the detected value.
- If detected locale is `en`, also replace the Korean boss persona with English defaults: `name: "Manager"`, `gender: male`, `role: "Manager"`, and translate the seat fields (`owns: "team roadmap & service reliability"`, `goals: "zero reliability incidents this quarter, ship on schedule"`, `authority: "approves merges/deploys and schedule changes; budget and hiring escalate"`; keep `tone: ISTJ`). If `ko`, keep the template's `박 팀장`.

Print ONE line in the detected locale:
- ko: "ℹ `.argus/config.yaml` 자동 생성 (ISTJ 박 팀장 기본). 다른 boss 원하면 그 파일 편집."
- en: "ℹ `.argus/config.yaml` auto-created (ISTJ default boss). Edit it if you want a different stakeholder."

Locale detection when no config exists yet (first match wins):
- If `LANG` / `LC_ALL` env starts with `ko` → ko
- On Windows (no `LANG`): if `Get-Culture` / system UI culture is Korean (`ko-*`) → ko
- Else if the user's `problem_text` is predominantly Korean (Hangul) → ko
- Else → en

(This default — en when nothing indicates Korean — is the one the rest of the plugin assumes; keep `lib/locale-conventions.md` consistent with it.)

All downstream skills inherit `locale` from the (now-existing) config.

Do not ask setup questions on first run.

---

## Step 1 - Parse Input

Determine:

- mode: new session, resume, or continue latest
- target: problem text, PR, file, branch, issue, or bare repo state
- flags: `--full`, `--quick`, `--no-boss`, `--resume`

If target is a file/PR/document, downstream skills must cite that artifact when
making claims. A generic answer after a user gives a file is a product failure.

---

## Step 2 - Resolve Session

1. If `--resume <id>`, load `.argus/sessions/<id>/session.json`.
   - **Not found** (no such dir): do not crash. List the 3 most recent session ids
     with their one-line problem text and ask one `AskUserQuestion` (resume one of
     these / start fresh). If none exist, say so in the detected locale and offer
     to start fresh.
   - **Found but unparseable** (corrupt `session.json`): quarantine it to
     `session.json.corrupt.<ts>` and treat the session as its last *valid* phase
     by re-deriving phase from the artifacts present on disk (Step 3's table reads
     `team_plan.json` / `workers.json` / `verification.json` / etc. directly), not
     from the unreadable record. If no artifacts are recoverable, report the
     quarantine and offer to start fresh. Never silently proceed on a malformed
     session.
2. If bare `/argus:review`, continue latest session when one is active.
3. If an existing session targets the same PR/file, ask one compact
   `AskUserQuestion`: continue existing or start fresh.
4. Otherwise create a new session and continue to clarify.

---

## Step 3 - Route By Phase

**Derive the phase from on-disk artifacts BEFORE reading the table** (session-layout
→ "Phase Is Derived From Artifacts, Not Declared"). `session.phase` is a hint a
mid-chain crash can leave stale — e.g. team wrote its artifacts but died before its
Step 10 phase update, so `phase` reads `conversing` while team is actually complete.
Read the "Current phase" column below as the **derived** phase (the furthest-along
complete artifact in the active version dir), not raw `session.phase`. The artifacts
always win; consult `session.phase` only to break a tie the artifacts leave
ambiguous. This is the same artifact-trust the corrupt-session path (Step 2) uses —
extended to a readable-but-stale phase, which is the more common crash shape.

**`conversing` tiebreaker (two rows below would both match):** read `versions/{label}/analysis.json`. If `execution_plan.steps.length >= 2` → treat as "ready" (route to team). Otherwise → "not ready" (route to clarify --continue). Decide by the execution_plan, never guess.

| Current phase | Next skill |
|---|---|
| new / no session | `clarify.md` |
| `analyzing` or `conversing` (execution_plan < 2 steps) | `clarify.md --continue` |
| `conversing` (execution_plan ready, ≥ 2 steps) | `team.md` |
| `team_deploying` (verify routed `revise_team`) | `team.md --revise` — re-run team with `verification.json` challenged_claims fed into the worker prompts |
| interrupted mid-team (`team_plan.json` exists AND `workers.json` is absent, **unparseable, or missing any worker named in `team_plan.json`**) | `team.md` — the prior run died or was killed mid-write before all workers finished; re-run is safe (team reuses the same version dir and overwrites partial output). A `workers.json` that exists but fails to parse or is short of the planned worker set counts as interrupted, not complete — never route a partial worker set to `verify.md` |
| `verifying` or team complete with no `verification.json` | `verify.md` |
| `dm_feedback` pending | `boss.md` |
| `refining` | `revise.md` (apply boss concerns / verify challenges → child draft + re-verify) |
| `complete` | show current call/version tree via `/argus:versions`; `revise.md` to iterate or `--promote` to finalize |

---

## Step 4 - Full Pipeline

For `--full`, run sequentially:

1. `clarify.md --no-minimal --invoked-via-sail` (until ready for mix, or max rounds). `--no-minimal` suppresses Step 6a auto-collapse (`--full` is an explicit user override); `--invoked-via-sail` makes clarify suppress its own scaffold print + "run team.md" hint and emit a one-line ack only — sail Step 7 renders the consolidated card. Without it, clarify double-renders under sail.
2. `team.md --invoked-via-sail` (on the snapshot's execution_plan). The `--invoked-via-sail` flag tells team to suppress its own verbose Step 11 print block; sail's Step 7 will render the consolidated card.
3. `verify.md --invoked-via-sail` (on the team output). This is the core gate: supported/challenged/human-check claims become visible before any stakeholder review.
4. `boss.md --invoked-via-sail` (unless `--no-boss` OR verify's `routing_decision` is `revise_team` / `stop_for_human_check` / **`ask_user`**). `ask_user` means verify could not resolve the route (e.g. a `critical` challenged claim under `--no-prompt`); boss must NOT run on an unresolved critical challenge. Same flag otherwise — suppresses boss's verbose narration; sail Step 7 surfaces the read only.
5. Step 7 current call (see below).

Transitions must describe value, not machinery:

- en: "Narrowed the decision. Checking evidence..."
- en: "Separating weak claims from usable evidence..."
- en: "Setting the current read..."
- ko: Translate the same meanings naturally.

Forbidden transition strings:

- "team deployed"
- "verify ledger complete"
- "boss review running"
- "7 agents finished"
- "multi-agent orchestration"

---

## Step 5 - Quick Mode

`--quick` runs `clarify.md --no-minimal` and stops.

Use this when the user wants problem framing, not a full read. Do not run
team, verify, or boss. Do not render current call.

**Droppings rule for `--quick`.** `--quick` is explicit, but if clarify resolves
to `decision_density: low` (an inline-only framing with no persisted scaffold),
it leaves NOTHING on disk — same discipline as the auto-invocation zero-droppings
rule (Step 0). A `--quick` that produces a real persisted scaffold (medium/high
density, or an `execution_plan` worth resuming) writes its session as usual. The
"explicit invocations create files" rule (Step 0) governs the full pipeline, not
a trivial inline framing — `/argus:review --quick "rename a tab?"` must not litter a
session dir for a one-line answer.

---

## Step 6 - Default Mode

Run `clarify.md --invoked-via-sail` first, then branch. The flag makes
clarify suppress its medium/high scaffold print (Step 5b) and emit a one-line ack
so sail Step 7 owns the surface — a low-density run still prints its MinimalScaffold
(clarify Step 5a is the terminal deliverable there and ignores the flag).

### Step 6·0 - Request-type gate (before density)

Read `request_type` from the snapshot (clarify Step 1.7). Only
`open_decision` flows the team/verify/boss pipeline. For any other type,
clarify has already given the user the right inline answer — sail must NOT
escalate:

- `validation` / `vent` / `info` → exit silently after clarify's inline answer.
  Do not run team, verify, or boss; do not render a current call. (Escalating
  a closed decision into the full reviewers is the precise harm Step 1.7 exists to
  stop.) A `validation` request that produced a `contract_seed` may still seal it
  via the normal settle loop — but that is the user's move, not an auto-escalation.
- `open_decision` with `readiness == "resistance"` → do not deploy the reviewers;
  surface clarify's resistance prompt and the settle-loop test. Continue only if
  the user explicitly asks to keep working the decision.
- `open_decision` + `ready` (or `request_type` absent — legacy) → continue to
  the flatness gate below.

### Step 6·0.5 - Flatness gate (under-fire default — port preapprove's P0.B weight-gate)

Validated finding (`internal design notes`): a find-the-leverage engine
over-fires on ~60% of FLAT decisions — it manufactures a fork where none is
load-bearing, runs reviewers ceremony on a reversible coin-flip, and emits a tilted
pole. `decision_density: low` (Step 6a) and the request-type gate (Step 6·0)
do NOT catch a **medium/high-stakes decision that is nonetheless flat** (no
load-bearing fork — e.g. an all-axes-satisfied choice where any branch lands the
same). `preapprove` already solves this with a silence-default weight-gate; sail must
inherit the discipline (copy the silence-default, NOT preapprove's irreversible-only
trigger — sail's orientation job is broader).

Read `frame_status` from the snapshot (clarify Step 2). The bar is on FIRING the
reviewers, not on staying flat:

- `frame_status == "flat"` → do **NOT** deploy team/verify/boss. The probe found
  no load-bearing fork. Render a **restraint read** directly (Step 7, FLAT
  course): name at most ONE assumption the user is resting on (or none), state
  plainly that the axes line up so any reasonable branch lands the same, and
  return the handle. No manufactured alternative, no manufactured unknown. This is
  the default, and it is a complete, honest answer — not a degraded one.
- `frame_status == "load_bearing"` (or absent — legacy) → a reframe/fork that
  actually changes the answer survived clarify's positive-threshold check.
  Continue to Step 6b/6c and deploy the reviewers.

Restraint here is not under-fire: the user still gets oriented (the one
assumption + the handle). Firing the full reviewers on a flat decision is the
over-fire the mirror clause forbids. When genuinely unsure between flat and
load-bearing, clarify defaults to load_bearing (it is the safe direction there —
see clarify Step 2); sail trusts that signal.

### Step 6a - Low Density

If `decision_density == "low"`, clarify has already rendered MinimalScaffold and
written `minimal_scaffold.json`.

Exit silently. Do not reprint. Do not ask another question.

### Step 6b - Uncertain Stakes

If `decision_density in {"medium", "high"}` and `stakes_confidence < 75`, ask
one `AskUserQuestion`.

Question:

- en: "How heavy is this decision?"
- ko: Translate naturally.

Options (each maps to a DIFFERENT path — the answer must change behavior, or the
question is theater):

- "Light framing only"
- "current call"
- "Treat as high-stakes"

After the user answers, persist `stakes_user_confirmed = true` and set
`stakes_confidence = 100` (the user just confirmed it — it is no longer
uncertain; without this reset Step 6c would re-see `< 75` and stall). Then
**branch on the chosen option** — the three are NOT the same path:

- **"Light framing only"** → the user chose restraint. Do **NOT** deploy
  team/verify/boss and do **NOT** render a current call. Treat exactly like
  `--quick`: clarify's framing (the MinimalScaffold / light analysis already
  produced) is the terminal deliverable. Persist `session.classification.stakes`
  as the lighter of the detected guesses (or `low`), mark the session `complete`,
  and exit. Running the full reviewers here after the user explicitly asked for "light"
  is the mirror-clause over-fire the spine forbids (see Forbidden Patterns).
- **"current call"** → set `session.classification.stakes = "important"` and
  continue to Step 6c (team/verify/boss → read).
- **"Treat as high-stakes"** → set `session.classification.stakes = "critical"`
  and continue to Step 6c (critical stakes raises agent budget + the critic
  mandate per team's classification rules).

Only the latter two reach Step 6c. The time preview in Step 6c is printed only on
that path — "Light framing only" returns immediately with no multi-minute run.

### Step 6c - Medium/High

When confidence is high enough, do not ask how to proceed. The user invoked
Argus to get orientation inside the decision, not to manage a workflow.

Print one line (include a rough time preview so a quick question never silently
becomes a multi-minute run — `~4-8 min` for important, `~8-12 min` for critical;
honest numbers from a measured run, not aspirations — and print it BEFORE any
probe/extraction work begins, not after the user has already waited):

- en: "Checking evidence and weak claims, then returning the current read (~{{time_range}}). (Ctrl-C to halt)"
- ko: Translate naturally.

Run:

1. `team.md --invoked-via-sail`
2. `verify.md --invoked-via-sail`
3. `boss.md --invoked-via-sail`, unless skipped or blocked
4. Step 7 current call

---

## Step 7 - current call

current call is the default consumable artifact. It hides the internal
pipeline but preserves the decision shape: course, evidence, unknown, alternative,
next step action, and an optional decision-contract seed.

**Coverage-gap guard:** read `workers.json` and count any `status: "error"` /
`verification_failed` entries. If any worker failed, the read MUST open with a
visible warning (ko: `⚠ 워커 {{M}}/{{N}} 실패 — 일부 도메인 분석 누락` · en:
`⚠ {{M}}/{{N}} workers failed — some domain analysis is missing`). Never present
a read assembled from survivors as if coverage were complete.

Read:

- `analysis.json`
- `scaffold.json`
- `verification.json`
- `workers.json` (for the coverage-gap guard above)
- optional `boss_feedback.json`
- optional `mix.json`

Write:

- `versions/{label}/current_bearing.json`, conforming to
  `${CLAUDE_PLUGIN_ROOT}/data/schemas/current-bearing.json` (include the required
  `generated_at` ISO-8601 timestamp — a read without it fails schema validation)
- `session.json`: set `phase: "complete"` after the read is rendered. Boss
  leaves the phase at `refining` and nothing else ever closes it — without
  this line no session in the default flow EVER reaches `complete`, and a
  later `--resume` misroutes a finished decision into `revise.md`.

### current call Mapping

Build:

- `label`: the active version label.
- `current_course.status`: one of `proceed`, `hold`, `fork`, `anchor`,
  `revise`, or `collect_evidence`. (Canonical set + meanings:
  `data/contracts/course-status.json` → `skills/_generated/course-status.md`;
  `scripts/generate-contracts.mjs` asserts the webapp `COURSE_STATUSES` and the
  read schema enum both match it.)
- `current_course.summary`: what the user should understand as the current
  read.
- `why_this_course[]`: 1-3 concrete reasons tied to the user's repo/file/PR/
  document/session evidence.
- `fog_or_reef`: the biggest unsupported claim, contradiction, blocker, or
  human-only check. Use `null` only when there is no meaningful remaining unknown.
- `road_not_taken[]`: up to 2 plausible alternatives and why they are not the
  current course.
- `next_helm`: one concrete next action.
- `contract_seed`: a falsifiable future predicate when the decision is close to
  anchor. Use `null` for early framing or missing evidence. When present it has
  FOUR required parts (all four, per the schema — a seed without pass/fail
  conditions cannot be graded later):
  - `predicate`: the future claim ("if X, then Y").
  - `check_by`: when reality gets consulted (date or event + offset).
  - `pass_condition`: the observable that confirms the predicate (≤180 chars).
  - `fail_condition`: the observable that falsifies it (≤180 chars). If you
    cannot name one, the seed is not falsifiable — write `null` instead.
  Do NOT include `author` in `current_bearing.contract_seed`: the schema rejects
  extra fields. When this AI-surfaced seed is later sealed, absence of `author`
  is the provenance signal; `author:"user"` is reserved for the user's own BIND
  lean from clarify Step 3.4. This keeps `log`'s calibration from counting an
  AI-surfaced held seed as the user's skill claim.
- `blocked`: true when verification routes to `revise_team` or
  `stop_for_human_check`.
- `detail_path`: `.argus/sessions/{id}/versions/{label}/`

If the user provided a file/PR/document and `why_this_course[]` contains no
source reference, treat the read as failed. Rebuild from artifacts or mark the
answer as not ready.

### Developer Decision Contract

When the target is a PR, file, branch, repo-wide code question, migration,
generated plan, or implementation decision, the current call must be useful to
a working developer, not merely "sensible." Apply this stricter contract before
rendering:

- `current_course.summary` names the actual action and scope: merge/hold/split,
  patch first, add a test, run a spike, or collect a named missing fact. Avoid
  vague summaries like "proceed carefully" or "review further."
- `why_this_course[]` must include concrete evidence. Prefer two source-backed
  reasons when a code artifact was provided; at least one source-backed reason
  is mandatory. Sources should be file paths, PR refs, test names, routes,
  migrations, config files, or verification ledger refs.
- `fog_or_reef`, when present, is a failure mode or missing fact a developer can
  test. Name the behavior that could break, not a generic category such as
  "auth risk" or "performance risk."
- `next_helm` is the smallest useful engineering move, ideally under 30 minutes:
  add/adjust a named test, inspect a named file/path, split a named PR surface,
  run a named command, or ask a named owner for the one fact AI cannot know.
- If Argus could not read the relevant code/PR/document, do not pretend. Set
  `status: "collect_evidence"` or `hold`, say which artifact was missing, and
  make `next_helm` the retrieval step.
- Strip generic review language. Phrases like "consider edge cases", "monitor
  closely", "ensure correctness", or "be careful with regressions" are not final
  output unless immediately followed by the exact file/test/check.

If the card fails this developer contract, do not render it as a completed
current call. Rebuild from `workers.json` / `verification.json`, route to
`revise`, or mark the course as `collect_evidence`.

### Assembly Priority

Use artifacts in this order:

1. **Route:** start from `verification.routing_decision`.
   - `revise_team` -> `current_course.status = "revise"`
   - `stop_for_human_check` -> `current_course.status = "collect_evidence"`
   - `ask_user` without a recorded user choice -> `current_course.status = "hold"`
   - `proceed_to_boss` -> choose `proceed`, `fork`, or `anchor` from scaffold
     confidence and remaining tensions
2. **Reasons:** take strongest source-specific supported claims first. Then add
   boss approval condition only when it changes the course.
3. **Unknown/Risk:** surface ONE item ONLY when it is genuinely load-bearing —
   it would change the course or block sign-off. In priority:
   - critical challenged claim
   - blocking human-required check
   - unresolved tension with no tie-breaker result
   - critical boss concern
   **If none of those exist, `fog_or_reef` is `null`.** Do NOT fall back to
   "the strongest remaining assumption" to fill the slot — every decision has a
   weakest-supported assumption, and surfacing it when it is not load-bearing
   manufactures unknown (over-fire, mirror clause). A clean, well-supported
   decision honestly has no risk.
4. **Alternative:** derive ONLY from real, evidence-backed alternatives —
   `scaffold.key_trade_offs[]`, `verification.unresolved_tensions[]`, or explicit
   boss concerns. **If no evidence-backed alternative exists, leave
   `road_not_taken` empty (`[]`) — do NOT fabricate one from "the rejected
   obvious alternative."** A flat decision legitimately has no alternative;
   inventing one to fill a medium/high slot is manufactured divergence
   (over-fire, the exact failure the validated stress test measured at ~60% on
   flat cases). When two real poles DO exist, render them at parity (see Read
   Rules — no engine-weighted pole).
5. **Next preapprove:** choose the smallest concrete action that moves the decision:
   repair, human check, source pull, spike, or promotion.
6. **Contract seed:** include only when the current course is `proceed`, `fork`,
   or `anchor` and the predicate can be checked later. For blocked or early
   evidence-collection courses, use `null`. **When the course proceeds/anchors AND
   a load-bearing `external` assumption remains** — an unconfirmed reality claim
   the user is proceeding past, or a `verification.json.root_crack` risk that was
   resolved and is now a bet on the world — **prefer it as the predicate.** It is
   exactly the external claim reality will settle (its `cheapest_check` /
   `why` give the pass/fail and check-by), so seeding it closes the
   seal→reality→settle loop. (A *gating* risk on a blocked course is surfaced as
   `fog_or_reef` instead, never seeded — a blocked decision is not yet a
   commitment, so there is nothing to seal.)

### Status Mapping

- `proceed`: evidence is sufficient for a reversible next move.
- `hold`: do not decide yet; a specific check comes first.
- `fork`: two **genuinely viable** paths remain and the next action is to choose
  or test one. Use ONLY when both poles are real — never to dramatize a flat
  decision. When `fork` is the status, render the two poles at parity and name
  the crux that decides them; do not pick for the user (see Read Rules).
- `anchor`: this draft can be promoted or sealed.
- `revise`: agent-owned claims need repair before the read is usable.
- `collect_evidence`: a human or external source must provide missing evidence.

**FLAT course (the restraint default — Step 6·0.5).** When the decision is flat
(no load-bearing fork), the read uses `proceed` or `anchor`, with
`road_not_taken: []` and usually `fog_or_reef: null`. `current_course.summary`
states plainly that the axes line up so any reasonable branch lands the same;
`why_this_course` names at most the ONE assumption the user is resting on (or a
single supporting reason); `next_helm` may be a **done-handle** — "nothing else
to decide here — go ahead" / "이 결정은 여기서 닫혀요 — 그대로 진행하세요" — which
is a first-class next action, not a failure to find work. Returning the handle on
a flat decision is the product working correctly, not under-delivering.

When `verification.routing_decision` is `revise_team`, set `status: "revise"`.
When it is `stop_for_human_check`, set `status: "collect_evidence"`.

### Render - Default

Render in the user's locale. Keep the labels natural, but preserve this
information order:

```text
## Argus - current call - {{label}}

Recommendation: {{current_course.summary}}

Why this course:
- {{why_this_course[0].point}}{{if source}} ({{source}}){{endif}}
{{if why_this_course[1]}}- ...{{endif}}
{{if why_this_course[2]}}- ...{{endif}}

{{if fog_or_reef}}Biggest open risk: {{fog_or_reef.issue}}
Why it matters: {{fog_or_reef.why_it_matters}}
{{if fog_or_reef.required_check}}Required check: {{fog_or_reef.required_check}}{{endif}}{{endif}}

{{if road_not_taken[0]}}Not chosen: {{road_not_taken[0].option}} - {{road_not_taken[0].why_not_now}}{{endif}}
{{if road_not_taken[1]}}Not chosen: {{road_not_taken[1].option}} - {{road_not_taken[1].why_not_now}}{{endif}}

Next action: {{next_helm}}

{{if contract_seed}}Contract seed: {{contract_seed.predicate}}
Check by: {{contract_seed.check_by}}{{endif}}

{{if blocked}}Status: do not execute/sign off yet. The repair or check above comes first.{{endif}}
Details: {{detail_path}}
```

Target length: 10-16 lines. Never exceed one terminal screen.

**First-decision hint:** if this is the project's FIRST session (exactly one
directory under `.argus/sessions/`), append one line after the read —
ko: `첫 결정이 기록됐어요. /argus:versions 로 언제든 돌아올 수 있고, /argus:help 가 안내예요.`
en: `Your first decision is logged. /argus:versions returns here anytime; /argus:help shows the map.`
Never print it again after the first session.

### Step 7.5 - Wake (1차 정산: 마음이 어디로 움직였나)

The webapp mirrors the pre-AI BIND lean back the moment the read is revealed and
asks "still holds?" (`WakeReturn` / `lean_after`). This is the SAME pass on the plugin
surface — the bind from clarify Step 3.4 finally pays off **in-session**, making the
reviewers' pull on the user's own read visible immediately, not weeks later at settle.
It is the on-ramp that sells the later reality settlement (`/argus:resolve`).

**Run ONLY when a real rope exists, and only in an interactive run.** Read
`.argus/ledger/ledger.jsonl`; find the `seal` with id `lean:<session-id>` and
`author:"user"` (the BIND lean from clarify Step 3.4).
- **No such seal** (the user skipped the lean at Step 3.4) → render nothing, skip
  this step. With no anchor there is nothing to weigh against — never manufacture
  the moment (mirror clause).
- **A `wake` event already exists for that id** → already settled once; skip (no re-ask).
- **`--no-prompt` / non-interactive** → skip (cannot ask); the next interactive
  decision or settle still has the rope.

When the rope exists, surface ONE neutral line in the card — **NOT an
`AskUserQuestion`** (Question Budget: the Wake never spends a slot; it is surfaced,
not asked). It is a mirror the user may react to in their own words, not a modal
that blocks:

- Line (locale-aware, neutral tone): `출발할 때 당신은 "{{lean predicate verbatim}}"
  이라고 했어요. 다 보고 난 지금도 그래요? (그대로면 넘어가도 돼요.)`
  (en: `When you set out you said "{{lean}}". Now that you've seen it all — does it
  still hold? (If it does, just carry on.)`)
- Record a `wake` event ONLY if the user reacts (their next free-text turn):
  - reply reads as "still holds" → `changed:false`, `lean_after` = the lean verbatim
  - reply gives a new line → `changed:true`, `lean_after` = the user's new line
  - no reaction / they move on → write nothing (lossless; the rope still settles
    later at `/argus:resolve`)

**Spine (do not regress):**
- `lean_after` is PURE user-authored — NEVER prefilled from the read or any model
  output (no borrowed rope; identical floor to BindCard / clarify Step 3.4).
- argus passes NO verdict on the move. Surface the two points the user wrote; the
  bare label (`단단함` held / `마음이 움직였어요` moved) is a FACT, never "wiser" /
  "the reviewers were right" / "you were wrong". The reviewers do not
  judge whether your read should have moved.
- Skip is one tap, lossless, never re-asked.

**Record** through the single-source ledger writer — do NOT hand-write the JSON
(the CLI owns the canonical wake shape, stamps `at`, and appends in `O_APPEND`, so
the after-reading can never drift from what settle/journal replay):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" wake "lean:<session-id>" \
  --lean-after "<held: the lean verbatim; moved: the user's new line>" [--changed]
```

- Pass `--changed` ONLY when the read moved; omit it when it held.
- `lean_after` is PURE user-authored — pass the user's own words verbatim, never a
  model line. `lean_before` is filled by the CLI from the sealed lean on the same
  `lean:<session-id>` rope, so you never retype it (pass `--lean-before` only if the
  seal isn't loadable). A second wake on the same id is refused by the CLI — the
  "already woken → skip" rule is mechanical, not something you re-judge.
- `wake` is unknown to statusline (its replay has no `default` branch) → safely
  ignored there; only the surfaces that opt in (settle Step 4, journal) read it.

**Render** after recording (user's locale), one line, no verdict:
- held: `단단함 — 들은 뒤에도 마음은 그대로예요.` (en: `It held — your read didn't move.`)
- moved: `출발: {{lean_before}} → 지금: {{lean_after}}` (en: `Set out: {{lean_before}} → now: {{lean_after}}`)

### Read Rules

- Do not render counts like "4 supported / 2 challenged" in the default
  read.
- Do not mention agent count, model names, schemas, or internal phase.
- Do not show both a unknown/risk item and a stakeholder concern if they are the
  same issue. Merge them.
- If evidence is thin, set the course to `hold` or `collect_evidence` instead
  of writing a longer report.
- **Alternative is load-bearing-gated, not mandatory.** Include 1-2 items
  ONLY when real, evidence-backed alternatives exist; on a flat decision leave it
  empty. Never fabricate an alternative to satisfy a slot (over-fire).
- **Default fork format = let the USER write the poles (R14 — the real tilt fix).**
  When a genuine two-pole fork exists, do NOT write the two sides yourself.
  Engine prose is the tilt medium: in the R14 blind A/B test, engine-written
  poles made users feel pushed in 5/8 cases; user-written poles, 2/8 — at the
  SAME crux and the SAME value. So instead: state ONLY the crux (the one thing
  the decision turns on) in a single neutral line, add at most one cheap
  reality-check, and ask the user to put each side in their own words ("write
  each side as you see it — if I word them I'll lean without meaning to").
  Author the crux + the question; never the pole content, never a
  characterization of a side, never a pick. **Frame the crux SYMMETRICALLY (R16
  — kills the residual lean):** name the axis as *which cost is larger*, both
  sides' cost in the same breath ("whether the cost of telling outweighs the
  cost of staying silent"), NEVER as one side's downside ("is your silence
  really free?"). A one-sided crux, or a reality-check that tests only one pole,
  IS the lean even when you refuse to word the poles — the R16 blind test cut the
  push rate from 8/10 to 1/10 (at higher value) purely by symmetrizing the crux.
  Where a case genuinely resists a symmetric crux (rare), say so plainly rather
  than force a lean. The parity rules below apply ONLY to the rare case where you
  must surface a pole yourself (e.g. a buried fact the user cannot see) — never
  as the default.
- **Never emit an engine-weighted pole.** When two poles are shown (status
  `fork`, or two alternative items), render them at PARITY: comparable depth
  and word-count, no caveat stacked on only one side, do not "melt" one pole's
  cost while loading the other's, no verdict tone ("X is right" vs "is Y even
  worth it"). Present the poles + the crux that decides them; the user picks.
  A tilting read is a disguised verdict (validated as the modal harm).
  **Swap-test before rendering:** if swapping the two poles' labels would change
  which one reads as favored, the asymmetry is engine tilt — flatten it. (Honest
  note: this lint is a floor; the stress test proved tilt can live below
  structural checks. Keep the poles factual and let the user weigh them.)
  Word-count parity is necessary but NOT sufficient — R12 found four tilt
  vectors that slip past it; block all four:
  1. **No editorializing prose against a pole** ("is Y even worth it", "the
     problem with X") — state each pole's case in its OWN terms.
  2. **No rigged diagnostic.** If you give branch logic ("if A… / if B…"), at
     least one realistic branch must land on EACH pole. A tree where every
     branch routes to one answer is a verdict — either the decision is actually
     flat (collapse to a FLAT course) or you tilted it; rebuild so both poles
     are reachable.
  3. **Status-quo / "wait" / "don't change" is a POLE, not a neutral baseline.**
     Give it the same scrutiny and word-count as the change pole; defaulting to
     "stay" untested is status-quo tilt.
  4. **Do not inject an option the user did not raise and rank it above their
     poles** ("the only reversible one", "the real answer is a third thing"). A
     genuinely material third option becomes a peer pole at parity, never the
     recommendation.
  The crux MUST still be surfaced — flattening tilt never means dropping the
  fork (this guards must-fire value).
- **Refuse identity/moral verdicts.** Do not render — or seal as a contract — a
  verdict about who the user is ("you're not selfish", "you're a bad partner if
  you don't"). A contract seed is a falsifiable claim about the WORLD, not a
  judgment of the user; if the decision was framed as "am I a [bad/selfish]
  person", convert it to a behavioral/world predicate or set `contract_seed:
  null`. Then **boomerang-scan the closing lines** (`current_course.summary`,
  `next_helm`): strip any soft re-issuance of a refused verdict (implicit
  absolution or condemnation). This is qualitative — hold the line by hand.
- Contract seed must be falsifiable. If it cannot be checked later, omit it.
- The detail path is a quiet escape hatch, not the main product.

**Verification routing override:** If `verification.routing_decision` is
`revise_team` or `stop_for_human_check`, Step 7 still renders the read but
MUST set the course to `revise` / `collect_evidence` and not imply completion.
Append a resume next-line:
- ko: `다음: {{routing_decision == "revise_team" ? "/argus:review --resume " + session.id + " (팀이 반박 항목을 반영해 재작업 후 재검증)" : "사람 확인 항목을 처리한 뒤 /argus:review --resume " + session.id}}`
- en: `Next: {{routing_decision == "revise_team" ? "/argus:review --resume " + session.id + " (team reworks the challenged claims, then re-verifies)" : "complete human checks, then /argus:review --resume " + session.id}}`

(On `revise_team`, verify has set `phase = team_deploying`; resuming routes to
`team.md --revise`, which re-runs the team with `verification.json`'s
challenged_claims injected — see Step 3.)

---

## Boss Skip Handling

`--no-boss`, `boss = null`, or user choice can skip stakeholder review. Still
render current call. Do not mention that boss was skipped in the read.

---

## Outputs

| Path | What user sees |
|---|---|
| Low density | MinimalScaffold |
| Quick | Clarify scaffold |
| Medium/high | current call |

No JSON dumps. No path-only summaries. No internal pipeline report unless the
user explicitly asks for `/argus:versions` or opens session files.

---

## Meta-Check Gates

- **Surface compression:** default output fits one screen and contains only
  current course, why, unknown/risk, alternative, next step, optional contract
  seed, and detail path.
- **Decision continuity:** output preserves at least one alternate course OR
  explicitly states the decision is flat (no real alternative). An empty
  `road_not_taken` with a one-line "the axes line up — any reasonable branch
  lands the same" SATISFIES this gate; it is not a failure to find an
  alternative. Do not manufacture a alternative to pass this check.
- **Under-fire default (the mirror clause):** the read must not over-fire —
  no manufactured fork on a flat decision, no fabricated unknown, no engine-weighted
  pole, no reflexive push to re-engage when "you're done" is the honest answer.
  Restraint (one assumption + handle) is the default; depth is user-pulled.
- **Evidence feel:** when user gave a file/PR/document, the read must prove
  it read that artifact through source-specific reasons.
- **No false completion:** blocked or challenged output must not sound approved.
- **Analysis primacy:** clarify always runs first.
- **No machinery selling:** do not make the user care how many agents ran.
- **Decision-contract readiness:** when near anchor, include a falsifiable seed
  that could later be graded.

---

## Error Modes

- **No args + no git state**: ask for the decision question via AskUserQuestion.
- **Session exists mid-phase**: resume by default; offer restart only if user asks.
- **Sub-skill fails**: log to `.argus/sessions/{id}/errors.log` (the canonical
  per-session log — keep this consistent across sail, team, and
  session-layout.md; gitignore `.argus/sessions/*/errors.log`), show the
  shortest actionable failure, and stop.

---

## Forbidden Patterns

- Running team before clarify.
- Skipping verify on medium/high paths.
- Printing worker/ledger/boss internals in the default read.
- Asking "how should we proceed?" when confidence is high.
- Letting sub-skills print their full reports when `--invoked-via-sail` is set.
- Calling the final output SurfaceCard.
- Escalating a `validation` / `vent` / `info` request (clarify Step 1.7
  `request_type`) into team/verify/boss, or re-opening a decision the user
  already made. Only `open_decision` flows the full pipeline.
- **Over-firing on a flat decision (the mirror clause — spine violation).**
  Manufacturing a fork / alternative / unknown where none is load-bearing,
  running the reviewers on a `frame_status: flat` decision, emitting an
  engine-weighted pole, or reflexively pushing `revise.md` / re-engagement
  when the honest answer is "you're done." Restraint is the default.
- **Running team/verify/boss after the user chose "Light framing only"** in the
  Step 6b stakes question. The three options must map to three paths; collapsing
  them into one full-pipeline run makes the question theater and over-fires on a
  user who explicitly asked for restraint.
