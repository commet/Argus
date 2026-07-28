# Handoff — bounded deep judgment and one logical user dataset

Date: 2026-07-27  
Branch at handoff: `codex/deep-judgment-ledger-foundation`  
Foundation commit: `6ad0ece5`  
Status: **foundation implemented and locally verified; migration, sync, and production rollout are not complete.**

This is the continuation document for the founder-approved internal track. It
exists so another session or machine can continue without reconstructing intent
from chat history or guessing which apparent ledgers are authoritative.

Related canonical decisions:

- `docs/ADR-2026-07-27-one-user-judgment-dataset.md` — target data architecture.
- `docs/ARGUS-BLUEPRINT.md` — internal-track registration; this does not reopen
  an O4-gated public recall surface.
- `docs/ADR-2026-07-14-dkk-v6-p6-web-canonical-ledger.md` — narrowed to the
  web aggregate only; it is superseded for cross-surface design by the new ADR.

---

## 1. Founder intent — do not dilute this

### 1.1 Web app

The web app should be a **judgment harness by default**, not a disguised,
always-on multi-agent theatre.

1. Standard judgment organizes the user's problem, assumptions, questions, and
   one synthesis. It must not silently build or deploy an agent team.
2. Deep judgment is a visible, optional path. Argus may recommend it when the
   task has high stakes, irreversibility, or several load-bearing assumptions;
   the user may also select it directly.
3. Deep judgment must be high quality but bounded: normally at most two AI
   specialist perspectives; one additional critic only for critical or
   irreversible decisions; then one strong synthesis.
4. A user without a connected personal model API gets one complete
   platform-funded deep session per rolling 24 hours. The same started session
   may resume rather than consuming another pass.
5. A personal API is not a cosmetic setting. It must make a real provider call,
   and a BYOK-started deep session must never silently become an Argus-funded
   run if the user later switches providers or disables the key.
6. This can feel premium internally, but must not be marketed or publicly named
   as a premium tier at this stage.

### 1.2 One user, one logical dataset

The user has one logical judgment dataset. It may have two physical replicas:

- Local-first: MCP/plugin use an append-only local event ledger and can work
  offline without an account.
- Account: the web app uses the account database, populated from local only
  after explicit connection/sync consent.

This does **not** mean forcing cloud upload, deleting local history, or putting
everything into one mutable table. It means all surfaces exchange the same
versioned domain events, and UI tables are projections rather than competing
truth writers.

Memory/reuse remains separately governed by JCR grants and InfluenceTrace. A
larger shared dataset must not turn into silent prompt recall or a stale
"self-improving" scar. External facts need provenance, re-check history, and
explicit watch/monitor consent.

---

## 2. What is implemented in `6ad0ece5`

### 2.1 Standard vs deep execution

Implemented files:

- `src/lib/judgment-depth.ts`
- `src/lib/progressive-engine.ts`
- `src/stores/useProgressiveStore.ts`
- `src/components/workspace/progressive/ProgressiveFlow.tsx`

Behavior now:

- New progressive sessions start with `judgment_mode: 'standard'`.
- Standard mode does not request an execution plan and `initWorkers()` returns
  no workers. It therefore cannot auto-deploy a team.
- Deep mode creates the plan in a separate, best-effort model call from the
  narrative call. The split prevents a large plan from truncating the user
  visible analysis JSON.
- Deep plans are bounded structurally by `boundDeepExecutionPlan()`; dropped
  dependency indexes are remapped so no dangling dependency remains.
- Deep final `runMix()` uses the `strong` model tier. Proxy and Anthropic direct
  routes now map that tier to `claude-opus-4-8`, matching the settings copy.
- The UI displays `DeepJudgmentEntry` during an open decision. Recommendation is
  deterministic: `critical` stakes, `irreversible`, or at least three hidden
  assumptions.

Important design detail: `agentCount` alone was not a reliable enforcement
mechanism because downstream orchestration could still broaden the team. The
bounded step list is applied before worker planning.

### 2.2 Deep authorization and billing integrity

Implemented files:

- `supabase/migrations/20260727150000_deep_judgment_usage.sql`
- `src/app/api/deep-judgment/authorize/route.ts`
- `src/lib/deep-judgment-client.ts`
- `src/lib/llm.ts`
- `src/app/[locale]/settings/page.tsx`
- `src/stores/types.ts`

Behavior now:

- `reserve_deep_judgment()` uses an atomic service-role RPC and advisory lock.
  It protects both account id and a privacy-preserving SHA-256 network
  principal; same session resumes, a different session within 24 hours gets
  `daily_used`.
- Browser clients never read/write quota tables directly. Both quota tables are
  RLS enabled with no browser policy.
- Settings offers **Test live connection**. It makes a tiny real model request
  using the same provider/key/model routing as product calls; it is not merely
  key-format validation.
- Enabling BYOK deep judgment performs that same real check before entering deep
  mode.
- Sessions persist `deep_funding: 'platform' | 'byok'`. If a BYOK session later
  loses its own API configuration, new deep answers, worker deployment,
  auto-resume, additional questions, and synthesis are blocked. It cannot spend
  Argus infrastructure accidentally.
- A pre-existing defect was fixed: an explicitly saved Anthropic `proxy` choice
  used to flip back to `direct` after reload whenever a key existed. Only legacy
  storage without an `llm_mode` field may infer direct mode now.

### 2.3 Premise semantics needed for convergence

Implemented files:

- `argus-mcp/src/lib/premises-core.ts`
- `src/lib/premises-core.ts` (byte-parity guarded with MCP)
- `argus-mcp/src/lib/ledger-append.ts`
- `argus-mcp/src/lib/ledger-replay.ts`
- `argus-mcp/src/tools/premises.ts`
- `argus-mcp/src/tools/public-tools.ts`

The premise model now separates:

| Field | Meaning | Must not be confused with |
|---|---|---|
| `load_bearing` | The decision materially changes if this is wrong | whether to notify |
| `external` | Reality can be re-checked | whether it is important |
| `monitoring_enabled` | User currently wants re-check/nudge behavior | truth or importance |
| `auto_watch` | User consents to external automated research | ordinary manual monitoring |
| cadence fields | When it becomes due | whether it remains active |

`monitoring_enabled=false` now disables monitoring without rewriting the
premise as unimportant or unverifiable. Public MCP `argus_capture` has
`action='amend_context'` to make that change without exposing an old internal
tool name.

### 2.4 Documentation and erasure coverage

- The new ADR inventories the real persisted representations and defines the
  event-envelope target, migration rules, conflict principles, and export
  posture.
- The Blueprint records this as a founder-approved internal track.
- `deep_judgment_usage` was added to account erasure/export coverage. The
  anonymous network abuse-control row has no account id and is intentionally
  not a user data export record.

---

## 3. The real ledger inventory — more than four

The earlier "four ledgers" count was a useful warning, but incomplete. These
are the persisted representations currently relevant to decisions/premises:

| Representation | Current role | Required future role |
|---|---|---|
| `.argus/ledger/ledger.jsonl` | MCP local decision + premise events | local canonical replica |
| `.argus/items.jsonl` | old plugin tracked items | legacy import source only, then read-only/retired |
| `project_semantic_events` | web semantic decision events | account canonical aggregate |
| `decision_items` | web voyage item storage | projection, not independent writer |
| `review_receipts.data.tracked_premises` | synced review/MCP payload | receipt projection |
| `plugin_decisions`, `plugin_events`, `plugin_bearings` | plugin bridge | compatibility/inbox projections |
| `progressive_sessions`, `projects.decision_contract` | mutable web workflow | workflow/read models, rebuildable where practical |
| `judgment_records` and `epistemic_*` | governed JCR/reuse plane | separate authority plane; never premise writers |

Also inspect any new writer before adding a feature. A new JSON file, direct
table write, or receipt payload that claims domain truth is a new ledger unless
it is explicitly a projection of the canonical event.

---

## 4. Work remaining — implementation backlog in required order

Do not mark the overall initiative complete until every item in sections 4.1
through 4.7 has acceptance evidence.

### 4.1 Deploy and prove the deep-quota foundation

Status (updated 2026-07-28): **steps 1–4 done and verified against production,
step 5 verified at the API layer only, step 6 BLOCKED on real provider keys.**
Platform-funded deep judgment is live and enforcing its 24-hour quota. The
migration was applied with founder approval after the gap surfaced a live defect
in account deletion — see the note at the end of this subsection.

1. ~~Identify the intended Supabase project and take a schema snapshot / verify
   migration ordering.~~ **DONE 2026-07-28** — project `sckixrzwqntynsisgcdx`
   (`overture-db`, ap-northeast-2). Live schema read directly; ordering confirmed
   (this migration landed after `20260727120000_foundation_integrity_v2`).
2. ~~Apply `20260727150000_deep_judgment_usage.sql` through the normal reviewed
   migration workflow.~~ **DONE 2026-07-28** — applied verbatim from the file (no
   partial hand-run), registered as migration `deep_judgment_usage`.
3. ~~Verify in the database.~~ **DONE 2026-07-28**, all five checks green:
   - both tables exist ✓
   - RLS enabled on both ✓
   - `anon` / `authenticated` hold no grant on either table (only `service_role`) ✓
   - only `service_role` (plus the `postgres` owner) may execute
     `reserve_deep_judgment`; it is `SECURITY DEFINER` ✓
   - RPC returned `granted` → `resumed` → `daily_used` in that order, exercised
     inside a transaction and rolled back (0 rows left in either table) ✓
4. ~~Deploy the web route with all three required server values:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY`.~~ **DONE / verified live 2026-07-28** — all three
   are present in production. Proven positively rather than by inspection: the
   route returns `granted`, and it can only do so after a successful service-role
   RPC (any missing value short-circuits to 503 before the RPC is reached).
5. **PARTIALLY DONE 2026-07-28 — API layer verified live against production
   (`https://argus.voyage`), browser UI not driven.** Against the deployed route:

   | Call | Result |
   |---|---|
   | first reservation, anonymous | `200 {"allowed":true,"status":"granted"}` |
   | same `session_id` again | `200 … "status":"resumed"` (no second quota spend) |
   | different `session_id`, same network principal | `429 … "status":"daily_used"` |
   | `session_id: ""` | `400 {"error":"Invalid request."}` |
   | response headers | `Cache-Control: no-store` |

   Database after the run: exactly ONE row in `anon_deep_judgment_usage`, still
   holding the FIRST session id (so `resumed`/`daily_used` neither duplicated nor
   overwrote it), `principal_hash` 64 chars — the IP is hashed, never stored raw.
   The signed-in branch was exercised separately against a real `auth.users` id
   inside a transaction (`granted` → `resumed` → `daily_used`, 1 account row +
   1 anon row) and rolled back. **All smoke rows were then deleted; both tables
   are back to 0 rows.**

   Still open in this step: driving the actual browser UI, and the 24-hour expiry
   (needs a time-controlled fixture — not exercised).

   Note on "failed DB behavior": now structurally satisfied rather than tested by
   outage injection. `authorizePlatformDeepJudgment` returns `unavailable` on any
   non-OK response or throw, and `ProgressiveFlow` returns early WITHOUT calling
   `setJudgmentMode('deep', …)` — so a failure cannot leave the session in deep
   mode, and the standard path continues. That is the §4.7 outage row.
6. **BLOCKED — not done.** Test real Anthropic, OpenAI, and Gemini BYOK
   credentials in a safe test account. Confirm the settings check and deep-entry
   check call the selected provider and fail honestly for revoked/no-credit keys.
   Requires real provider keys, which were not available in this environment.
   Do NOT mark the initiative complete on the strength of steps 1–5.

Acceptance: no successful platform deep run can begin without a successful
server reservation; no BYOK success is claimed without a real response; an
outage leaves standard judgment usable.

**Why step 2 could not stay deferred (2026-07-28).** Leaving the migration
unapplied was not cost-free, and the cost landed somewhere unrelated. Because
`deep_judgment_usage` was listed in `src/lib/user-data-tables.ts` from the same
commit, `/api/account/delete` iterated a table that did not exist, PostgREST
returned "relation does not exist", the route's all-or-nothing `hadError` gate
tripped, and **auth-identity deletion was skipped for every account deletion** —
which also silences the `ON DELETE CASCADE` that is the only erasure path for
tables outside that list. Account deletion returned HTTP 500 and left the account
standing. Both CI guards stayed green throughout, because both compare two
hand-written lists to each other and neither can see the live database.

The lasting fix is not the migration; it is that the gap is now visible:
- `src/lib/__tests__/erasure-coverage.test.ts` derives user-scoped tables from
  `supabase/migrations/*.sql` (offline, machine-checked) and requires every
  non-`user_id` reference to `auth.users` to carry a written waiver;
- `node scripts/check-erasure-coverage.mjs <sql-result.json>` compares the list
  to the live DB and is the only thing that can catch "listed but not applied".
Run the script after every migration. See also the corrected comments in
`user-data-tables.ts` and `api/account/delete/route.ts`: the long-standing claim
that no table cascades on `auth.users` delete was false (49 of 51 FKs cascade).

### 4.2 Define and implement the shared event envelope

Status: ADR specifies it; no exchange implementation yet.

Create one shared, versioned domain-event contract used by local and account
replicas. At minimum it needs:

```text
event_id, schema_version, aggregate_id, entity_id,
event_type, payload, origin_surface, origin_instance,
occurred_at, recorded_at, authority/provenance,
predecessor/version, account_id when connected
```

Requirements:

- UUID/event identity must make upload/download idempotent.
- Append operations must preserve incompatible concurrent amendments as visible
  fold conflicts; do not use silent last-write-wins for terminal outcomes.
- Delete is a tombstone event, not a destructive overwrite.
- Event schemas must validate at write, ingest, and projection boundaries.
- The envelope must preserve exact user wording, AI-original wording, provenance,
  monitoring state, cadence, re-check result/source, and amendment history.
- Add fixtures for every event type and a parity test that folds the same fixture
  identically in MCP/local and web/account code.

Likely implementation location: a deliberately small shared contract module,
not a copy-pasted JSON shape in plugin, MCP, and web routes. If build topology
prevents a package, generate artifacts from one source and add a drift test.

### 4.3 Build the legacy plugin importer before retiring its writer

Status: **not started**. This is the most important unfinished ledger item.

The old plugin still writes `.argus/items.jsonl` through
`argus-plugin-v2/scripts/decision-ledger.js`; its skill, reminders, and tests
still depend on that file. Do not delete or redirect it blindly.

Implement an idempotent importer that:

1. Reads malformed JSONL defensively and records an import report without
   deleting any legacy bytes.
2. Uses stable legacy-event fingerprints / source offsets so re-running it does
   not duplicate events.
3. Maps legacy event meanings explicitly:

| Legacy form | Canonical target / migration rule |
|---|---|
| `extract` | premise/open question with `ai_surfaced`, exact `ai_original` |
| `add` | user-stated premise/open question |
| `edit accept/refine/replace/reject` | premise amendment / retirement, preserving wording and history |
| `alert off` | `monitoring_enabled=false` |
| `alert on_change` | monitoring enabled, default re-check cadence |
| `alert weekly/monthly` | monitoring enabled plus 7/30-day cadence |
| `recheck` | canonical premise re-check with an honest migration source marker |
| `dismiss` | explicit dismissal/backoff event or a separately defined projection rule; do not silently discard it |

Legacy `phenomenon`, `conclusion`, and `prediction` do not map one-to-one to a
premise. Decide their canonical event types before import. Do not pretend they
are premises merely to simplify a migration. A predicted future claim may map to
the existing decision/prediction event stream; a phenomenon/conclusion may need
a distinct observed-note event or remain a read-only legacy projection until a
valid semantic home exists.

Before changing plugin skills, add fixtures covering every old event type,
duplicate import, partial import/retry, corrupt line, alert mode mapping, and
round-trip replay.

Only after importer parity is proven:

1. Change `skills/premises/SKILL.md` and `skills/review/clarify.md` to use the
   public MCP path (`argus_capture`, `argus_patterns`) rather than writing the
   old store.
2. Keep legacy reader fallback for imported history during a published
   compatibility window.
3. Update `check-contracts.js`, validation scripts, and statusline logic to
   read the canonical local fold or a defined projection.
4. Remove the old writer last, never the historical file.

Acceptance: a user with legacy data sees the same tracked items and reminders
after import; repeated imports produce no new canonical events; new plugin
writes do not create `.argus/items.jsonl` records.

### 4.4 Implement local ↔ account event sync

Status: existing MCP/account receipt sync exists, but it is not the new
shared-dataset transport.

Build explicit sync around the envelope, not around copies of full JSON files:

1. Local outbox stores successfully appended events pending account transfer.
2. Account ingest validates the event, authenticates binding/account ownership,
   deduplicates by `event_id`, appends once, and returns a receipt/cursor.
3. Download returns events since a durable cursor, not a mutable state snapshot.
4. Local folding is idempotent; failed transfer leaves pending outbox visible.
5. First local save may invite account connection, but nothing uploads before
   explicit connection and the existing premise/privacy grant.
6. Sync status must distinguish: local only, connected/no pending changes,
   pending upload, pending download, conflict needing review, and failed.
7. Pulling account events must not overwrite local history. Fold both by event
   identity and expose unresolved conflicts.

Privacy requirements:

- Premise text and `auto_watch` are distinct consent paths.
- No account ID is added to a local event before connection.
- Do not send premise text to external search merely because it is external or
  monitored; only `auto_watch=true` authorizes that egress.

Acceptance: offline creation, reconnect, duplicate retry, two-device changes,
and denied consent are all covered by integration tests.

### 4.5 Project account projections and web convergence

Status: not started. `project_semantic_events` is the current web aggregate,
but several web tables can still behave as writers.

Implement account-side projection in phases:

1. Project canonical synced/local events into web history, premise views, due
   surfaces, review receipts, and voyage/decision UI.
2. Make projection handlers idempotent and rebuildable from events.
3. Audit every write to `decision_items`, `review_receipts`,
   `plugin_decisions`, `plugin_events`, `plugin_bearings`,
   `progressive_sessions`, `projects.decision_contract`, and
   `project_semantic_events`.
4. Classify each as canonical event append, workflow state, read model, or
   compatibility projection. Eliminate unclassified independent domain writes.
5. Move web domain acts to append account events first; then let projections
   update screen tables. Do this one event family at a time with dual-read
   comparison, not a blanket rewrite.

`progressive_sessions` may remain mutable workflow state. It should reference
the stable judgment aggregate/event ids rather than becoming a second premise
authority.

Acceptance: rebuild a disposable projection from canonical events and compare
the result to live UI data; differences must be explained fixtures, never silent
data loss.

### 4.6 Portable user export and erasure

Status: account table listing was updated for deep quota; unified export is not
implemented.

Add an export format containing:

- canonical JSONL events;
- a manifest with schema versions, export time, aggregate counts, and integrity
  hashes;
- optional projection snapshots clearly labelled derived;
- import/readme guidance for personal agents or a personal database.

Exports must preserve authorship, provenance, corrections, validity/re-check
windows, and retirement/tombstone history. They must not manufacture a final
behavioral verdict or silently grant prompt recall.

Update account deletion and export tests whenever a new user-scoped table or
event projection is added. Review whether anonymous anti-abuse hashes have a
separate retention policy; they are not ordinary account data.

### 4.7 End-to-end test and rollout gate

Do not merge the whole initiative because unit tests are green. Require a
staging/production-like test matrix:

| Scenario | Required proof |
|---|---|
| Standard web judgment | no workers, no execution-plan call, normal synthesis completes |
| Deep platform judgment | reserve once, bounded workers, strong synthesis, same-session resume |
| Deep BYOK | actual provider success; provider/key change cannot move billing silently |
| Invalid/expired BYOK | clear error, remains standard or blocks only deep, no hidden proxy fallback |
| Platform/DB outage | standard path remains usable, deep reports unavailability honestly |
| Legacy plugin migration | fixture parity and no duplicate events on rerun |
| First local save | connection invitation only; no unconsented cloud transfer |
| Offline then reconnect | outbox retry / idempotent sync / visible pending status |
| Two replicas amend same premise | both histories survive; explicit conflict surface when incompatible |
| Alert disabled | importance/external flags remain true; no re-check nudge |
| Export/delete | full user aggregate included; governed-memory boundaries retained |

Run at least:

```powershell
npm test
npm --prefix argus-mcp test
npm run lint
npm run build
git diff --check
```

Then run actual browser journeys with production-like Supabase and real test
provider credentials. Record the evidence in the appropriate O4/exit evidence
location without turning this internal feature into a public recall expansion.

---

## 5. Guardrails and common mistakes

1. Do not call the task a "self-improving agent." This is durable judgment
   evidence and re-checkable procedure, not changing model weights.
2. Do not let old failure notes become permanent prohibitions. External facts
   need source, timestamp, cadence, validity/re-check context, and a path to
   re-test them.
3. Do not keep permanent dual writes. During migration, import old → new and
   verify parity; do not write every new act to both forever.
4. Do not force a local user to upload at first save. Invite connection and ask
   for premise sync/privacy consent.
5. Do not infer `monitoring_enabled` from importance. Users may keep a premise
   essential while choosing not to be nudged.
6. Do not remove `.argus/items.jsonl` code before importer + reader parity.
7. Do not expose a public premium label or reopen O4-gated recall surfaces as a
   side effect of this work.
8. Do not claim live provider or database success merely from mocks, build, or
   an invalid-key browser test.
9. Preserve the unrelated untracked local file
   `.claude/hookify.block-claude-process-kill.local.md`; it was not created by
   this track and must not be committed.

---

## 6. Verification already performed

At foundation handoff:

- Targeted web tests: 19 passed, including deep quota route, deep plan split,
  judgment depth, erasure coverage, settings routing, and core parity.
- Targeted MCP tests: 26 passed, including public `amend_context` and premise
  monitoring behavior.
- `npx tsc --noEmit` passed.
- `npm run lint` had zero errors; pre-existing warnings remain under the
  repository warning threshold.
- `npm run build` passed after the final billing-path guard.
- Browser verification with a local dummy Supabase configuration confirmed:
  - deep recommendation is visible for a critical irreversible sample;
  - platform authorization failure leaves the standard path usable;
  - settings exposes an actual connection test and rejects an invalid key;
  - explicit Proxy mode survives reload after the routing fix.

Not verified because this workspace had no real runtime secrets or linked
production database:

- successful real-provider BYOK response;
- actual production Supabase RPC/migration behavior;
- real 24-hour platform quota;
- local/account event sync and legacy import (not implemented yet).

---

## 7. Suggested immediate continuation sequence

1. Push/merge the foundation only after review; deploy the migration to a
   staging Supabase project and run section 4.1 live tests.
2. Start section 4.3 with an importer design/fixture PR. It is the prerequisite
   for safely retiring the most divergent plugin ledger.
3. In parallel or immediately after, establish the shared event-envelope module
   and fold parity tests from section 4.2.
4. Implement local outbox/account ingest/download and explicit consent UX.
5. Convert plugin writers, then web projections, one event family at a time.

The correct handoff status is therefore: **foundation committed; full one-dataset
implementation remains an active migration program.**
