# Decision Knowledge Kernel v6: continuation handoff

Date: 2026-07-14
Audience: a new implementation session with no prior conversation context
Repository: `C:\Users\SAMSUNG\Documents\GitHub\commet\Argus`
Branch: `main`
Current code baseline: `c1ad530c` (`feat: harden DKK v6 dogfood path`)

## Read this first

DKK v6 is **structurally implemented, migrated, deployed, and ready for
controlled dogfood**. It is **not finished** in the sense defined by the
normative design. Production lifecycle evidence, cross-surface dogfood, and
the P5 user-value comparison are still absent.

Do not turn “the code and infrastructure are ready” into any of these claims:

- P5 passed;
- user value was demonstrated;
- the web, Telegram, or plugin lifecycle was proven end to end;
- DKK v6 is generally available;
- the product may market the kernel as validated.

At the time of this handoff, the production
`public.project_semantic_events` table exists and is secured, but its exact
row count is **0**. That is the clearest current boundary between deployment
and proof.

## One-paragraph product and philosophy summary

Argus is a judgment ledger, not a machine that decides for the user. It
preserves what a person adopted, the premises and provenance it rested on,
when it was recorded, what question they promised to revisit, what was later
observed, how the person interpreted that observation, and whether they
separately closed the judgment. AI may propose, structure, and execute an
explicit command; it may not fabricate human adoption, observation,
resolution, or closure. Past sealed meaning is append-only. Later knowledge
must not be mixed into the contemporaneous record. “Keeping Judgment Human”
is the product shorthand for this authority boundary.

## Normative authority and reading order

Read these in order. Repository-relative paths are intentional so the list is
portable across machines.

1. `docs/DESIGN-decision-knowledge-kernel-v6-final-2026-07-14.md`
   - Normative design authority.
   - Read sections 1, 4–6, 8–12, and 15 before changing semantics.
   - Defines the authority model, temporal honesty, event grammar, fourteen
     constitutional articles, proof strategy, go/kill rules, and completion.
2. `docs/DKK-v6-IMPLEMENTATION-HANDOFF-2026-07-14.md`
   - Original implementation handoff and commit history.
   - Its statements that migration/deployment/webhook rollout are pending are
     now stale; use this continuation handoff for current operational facts.
3. `docs/ADR-2026-07-14-dkk-v6-p0-operating-contract.md`
4. `docs/ADR-2026-07-14-dkk-v6-p2-semantic-scope.md`
5. `docs/ADR-2026-07-14-dkk-v6-p3-legacy-adapter.md`
6. `docs/ADR-2026-07-14-dkk-v6-p4-mcp-vertical-slice.md`
7. `docs/ADR-2026-07-14-dkk-v6-p5-value-gate.md`
   - Current decision remains **HOLD**.
8. `docs/ADR-2026-07-14-dkk-v6-continuation-after-p5-hold.md`
   - Permits structural P6/P7 dogfood readiness without pretending P5 passed.
9. `docs/ADR-2026-07-14-dkk-v6-p6-web-canonical-ledger.md`
10. `docs/ADR-2026-07-14-dkk-v6-p7-surface-convergence.md`

`docs/ARGUS-BLUEPRINT.md` is not the normative authority for this workstream.
Do not silently reconcile it into DKK v6. A later reconciliation requires an
explicit decision after P5.

## Non-negotiable semantic invariants

Any implementation, migration, repair, or dogfood interpretation must preserve
all of the following:

1. A system or AI proposal cannot become a human judgment without recorded
   human authorization.
2. Judgment statement and return question are different fields and acts.
3. Observation, resolution assertion, and closure are separate event types.
4. A resolution is non-terminal until a separate authorized close.
5. `return_deferred` is non-terminal.
6. A later outcome cannot rewrite a sealed statement.
7. An observation is a sourced assertion, not automatically verified reality.
8. Concurrent or contradictory authorial acts are preserved or rejected as a
   visible conflict; they are never timestamp-overwritten.
9. Legacy unknown authority is never upgraded to human authority.
10. Imported v2 data remains v2 unless the user explicitly reforges it.
11. Plugin semantic events are delivered verbatim; synchronization must not
    reinterpret them.
12. Erasure and ownership boundaries must survive replicas and exports.

Do not repair a semantic mistake by editing or deleting events. Use an
authorized new command or an additive migration with an ADR and fixtures.

## Current implementation map

### Shared kernel and proof fixtures

- `argus-mcp/src/v3/types.ts` — versioned events, commands, and projections.
- `argus-mcp/src/v3/reducer.ts` — deterministic semantic fold and guards.
- `argus-mcp/src/v3/store.ts` — append/store behavior.
- `argus-mcp/src/v3/legacy-v2.ts` — declared-loss v2 adapter.
- `argus-mcp/src/v3/fixtures/dkk-corpus.ts` — adversarial corpus.
- `argus-mcp/src/v3/constitution.test.ts` — constitutional enforcement.
- `argus-mcp/src/v3/corpus-golden.test.ts` — corpus conformance.
- `argus-mcp/src/v3/p5-gate.ts` — deterministic GO/HOLD/NO-GO gate.
- `argus-mcp/src/v3/fixtures/p5-measurement-plan.ts` — preregistered metrics.
- `src/lib/decision-kernel.ts` — web import boundary to the compiled shared
  kernel; do not copy the reducer into the web app.

### Web project ledger

- `supabase/migrations/20260714_project_semantic_events.sql`
- `src/lib/semantic-web.ts`
- `src/lib/semantic-web-client.ts`
- `src/lib/semantic-ledger-gateway.ts`
- `src/app/api/semantic/projects/[projectId]/events/route.ts`
- `src/components/projects/SemanticDecisionCard.tsx`
- `src/lib/__tests__/semantic-web.test.ts`
- `src/lib/__tests__/semantic-ledger-gateway.test.ts`
- `src/lib/__tests__/semantic-migration.test.ts`

`public.project_semantic_events` is canonical for an account project space.
`projects.decision_contract` is a legacy/read projection and may only point to
`semantic_judgment_id`; it is not the v3 source of truth.

### Telegram

- `src/app/api/telegram/webhook/route.ts`
- `src/lib/telegram-api.ts`
- `src/lib/telegram-settlement.ts`
- `src/app/api/telegram/webhook/__tests__/route.test.ts`

An answer must append an observation plus resolution assertion, then offer a
separate close callback. Telegram update/message/callback IDs are authorization
evidence. Mute changes delivery only. Pending means defer, not settle.

### Plugin

- `src/lib/semantic-plugin.ts`
- `src/lib/plugin-import.ts`
- `src/stores/usePluginStore.ts`
- `src/app/[locale]/import/page.tsx`
- `src/app/api/plugin/events/route.ts`
- `argus-plugin-v2/scripts/push-webapp.js`
- `src/lib/__tests__/semantic-plugin.test.ts`

The explicit sequence is v2 import → user reforge → answer → separate close →
outbox delivery → `/argus:pull` or `/argus:sync` →
`.argus/ledger/semantic-v3.jsonl`.

## Current production and environment facts

These identifiers are not secrets:

- Supabase project: `overture-db`
- Supabase project ref: `sckixrzwqntynsisgcdx`
- Vercel scope/project: `sayus-projects-4298ff2f/overture`
- Production domain: `https://argus.voyage`
- Telegram bot: `@Argus00bot`
- Telegram webhook: `https://argus.voyage/api/telegram/webhook`

Completed operational work:

- Supabase project linked locally.
- `20260714_project_semantic_events.sql` applied manually through the approved
  Supabase SQL editor.
- Table, RLS, read policy, function, and role ACL verified.
- Expected RPC execution privileges:
  - `anon`: false
  - `authenticated`: false
  - `service_role`: true
- RPC ACL was hardened beyond `PUBLIC` revoke because this Supabase project
  had explicit default grants for `anon` and `authenticated`.
- Migration atomically writes the first seal and the project
  `semantic_judgment_id` pointer and refuses a different existing pointer.
- Production build deployed and `argus.voyage` returned HTTP 200.
- Unauthenticated semantic API returned HTTP 401.
- Telegram webhook was registered for `message`, `edited_message`, and
  `callback_query`; secretless POST returned 401 and a correctly authenticated
  inert update returned 200.
- Telegram reported zero pending updates and no webhook error at handoff.
- Resend sending key authenticated via a non-delivering validation request.
- `npm run preflight:deploy` passed. Optional warnings remained for Turnstile
  and inbound email replies; neither is a DKK v6 exit criterion.

### Important migration warning

Remote Supabase migration history and this repository's historical migration
filenames do not match. A linked `supabase db push --dry-run` exposed the
mismatch. Do **not** run migration repair, force a full `db push`, or rewrite
remote history merely to make the lists align. The DKK migration was applied
as one reviewed transaction. Any follow-up must be additive and scoped.

### Secret hygiene

- `.env.local` is ignored and contains local operational credentials.
- Never print, commit, paste into a handoff, or echo secret values.
- Required variable names are documented in `.env.example` and
  `scripts/check-deploy-env.mjs`.
- The Telegram bot token was pasted into a prior conversation. Rotate it with
  BotFather before treating the bot as securely production-ready, then update
  local, Vercel Production/Preview, redeploy, and call `setWebhook` again.
- Vercel sensitive values cannot be safely reconstructed with `vercel env
  pull`; it may write empty quoted values. Do not overwrite a working local
  `.env.local` casually.

## Validation already completed

The following passed against `c1ad530c`:

- `npm run preflight:dogfood`
- Next.js production build
- 327 test files, 3,898 tests passed, 10 skipped
- lint: 0 errors, 139 warnings under the threshold of 145
- MCP build and protocol tests
- plugin gates, signal tests, static eval, and plugin validation
- `git diff --check`

The deployment-specific preflight also passed after environment setup:

```text
npm run preflight:deploy
```

These checks prove structural and command-level conformance. They do not prove
user value or an end-to-end production lifecycle.

## Exact remaining work

### 0. Rotate the exposed Telegram token

1. Use BotFather to revoke/regenerate the token for `@Argus00bot`.
2. Put the new token in local `.env.local`; do not paste it into chat or docs.
3. Update `TELEGRAM_BOT_TOKEN` in Vercel Production and Preview.
4. Redeploy production so the runtime sees the new token and existing webhook
   secret.
5. Re-register the webhook and verify URL, allowed updates, pending count, and
   last error.

### 1. Web P6 production lifecycle

Use a disposable, signed-in test account and one project.

1. Seal a judgment with a distinct return question.
2. Verify the project pointer and append-only events in Supabase.
3. Record an observation without resolving it.
4. Assert an answer with an evidence reference; verify it remains open.
5. Defer once; verify defer is non-terminal.
6. Close separately with an explicit human action.
7. Retry an identical command and verify an exact duplicate receipt.
8. Retry with the same idempotency key but altered content and verify refusal.
9. Exercise concurrent/conflicting defer/close commands and verify no silent
   overwrite.
10. Record event IDs, receipts, HTTP outcomes, and user-facing recovery text;
    do not copy private judgment content into committed evidence.

Exit evidence: a complete event sequence and failure review, not merely a
successful UI render.

### 2. Telegram P7 production lifecycle

1. In the web app, use Settings → Telegram connect so `/start` carries the
   one-time connection code.
2. Create or use a project that already has a v3 semantic judgment.
3. Send a real answer from Telegram.
4. Verify one atomic `observation_recorded` + `resolution_asserted` batch with
   exact Telegram receipt references.
5. Verify the judgment is still open.
6. Tap the separate close callback.
7. Verify a distinct human-authorized `judgment_closed` event.
8. Test pending/defer and mute independently.
9. Review Telegram delivery errors and recovery language.

### 3. Plugin P7 production lifecycle

Use a disposable user repository rather than this repository's real ledger.

1. Import a real v2 plugin decision and confirm it remains readable v2.
2. Explicitly reforge it into a retrospective v3 seal.
3. Record an answer and verify no implicit close.
4. Close separately.
5. Deliver/sync the `semantic_v3` outbox.
6. Pull into `.argus/ledger/semantic-v3.jsonl`.
7. Byte/JSON-compare event IDs and semantic content with the outbox.
8. Exercise an invalid batch and confirm a visible error rather than coercion.

### 4. Lifecycle ownership and erasure

With the disposable test account:

1. Export the account and confirm semantic events and provenance are included.
2. Delete the account through the real deletion path.
3. Confirm project semantic events are erased and cannot reappear through an
   old replica or sync.
4. Preserve only non-content evidence such as counts, IDs hashed for the test,
   and pass/fail observations.

### 5. Cross-surface operational review

Review and record:

- reducer/gateway failures;
- duplicate receipts;
- event-ID and idempotency conflicts;
- Telegram delivery errors;
- plugin delivery and pull errors;
- whether every recovery message preserves user agency and avoids fabricated
  verification or closure;
- whether the same event history projects identically on each surface.

### 6. Run P5 for real

Current factual status remains HOLD. The ADR requires:

- at least 10 completed v6 lifecycles;
- a matched baseline cohort of at least 10 completed lifecycles;
- reconstruction scoring, blinded to condition when practical;
- cycle-level time and confirmation cost;
- authority/fabrication and silent-false-seal measures;
- separate synthetic and real-dogfood evidence.

Run the deterministic gate only with real result data:

```text
npm --prefix argus-mcp run eval:p5 -- <p5-results.json>
```

Do not fill absent measurements with zero. The result must be one of GO,
narrowed continuation, or NO-GO/stop, and must be recorded in an ADR. Until
then, HOLD is not a pass.

### 7. Update operational documentation

After the evidence above exists:

1. Update `docs/DKK-v6-IMPLEMENTATION-HANDOFF-2026-07-14.md` so its rollout
   statements match reality.
2. Add a dated dogfood evidence document that references non-sensitive event
   IDs/receipts and failure observations.
3. Record the P5 decision and any scope change in an ADR.
4. If semantics changed, update the normative design, executable fixture, and
   migration impact together.

## Definition of done

Do not call DKK v6 complete until all of these are true:

- [x] Shared v3 kernel and constitutional fixtures exist.
- [x] Web, Telegram, and plugin adapters use the shared semantics.
- [x] Production database migration and secure RPC are present.
- [x] Web application and Telegram webhook are deployed.
- [ ] A real signed-in web lifecycle completed and was inspected.
- [ ] A real Telegram answer and separate close completed and was inspected.
- [ ] A real plugin reforge/answer/close/pull completed and was inspected.
- [ ] Conflict, duplicate, failure, and recovery behavior was reviewed live.
- [ ] Export and deletion were verified with a disposable account.
- [ ] P5 received real matched evidence and produced an explicit decision.
- [ ] Operational evidence and current status were committed without secrets.

The final success criterion is not “more judgments were recorded.” It is that
after time, model changes, and surface changes, the user can reconstruct what
they did and did not authorize, what was known then versus later, and how they
separately interpreted and closed the judgment without machine invention.

## Addendum 2026-07-14 (later session): dogfood runner + one pre-production defect fixed

Status of the Definition of done is UNCHANGED — every unchecked box above is
still unchecked. What changed:

1. **A dogfood runner now exists** (`scripts/dogfood/`, see its README).
   `npm run dogfood` drives the real kernel/gateway/telegram-brain/plugin
   builders through 43 scripted scenarios plus a seeded model-based fuzzer,
   against a line-by-line TS port of the production RPC, recording
   non-sensitive JSONL evidence; `npm run dogfood:analyze <dir>` produces a
   triage report and the SYNTHETIC arm of the P5 input (baseline/dkk_v6
   blocks intentionally absent). `npm run dogfood:prod` automates the ten P6
   web-lifecycle steps over real HTTPS from a machine with production access
   and a disposable account — that run, inspected, is what may check the P6
   box. Local greens check no boxes.
2. **Real defect found and fixed before any production row existed:** seal
   batches read back from `project_semantic_events` in
   `(created_at, event_id)` order folded `return_promised` before
   `judgment_sealed` (same-transaction `created_at`, lexicographic tiebreak
   `…:return` < `…:sealed`), so after any reload the return contract was
   dropped as an unknown reference and resolve/defer/Telegram answers failed.
   Fix: ordinal event-id suffixes for multi-event batches in
   `src/lib/semantic-web.ts` (`1-sealed`/`2-return`,
   `1-observation`/`2-resolution`); regression test in
   `src/lib/__tests__/semantic-web.test.ts`. No schema change; the table had
   0 rows, so no legacy ids exist. Note for the production run: any event
   sealed BEFORE this deploy (there are none) would have carried the old ids.
3. **Telegram semantic brain extracted** verbatim from the webhook route into
   `src/lib/telegram-semantic.ts` (deps-injected admin/send/now/id). The
   webhook delegates to it; the runner drives the same functions. Logic is
   single-sourced — do not fork it back into the route.

## Addendum 2026-07-15: P5 second run (agent cohort) + four engine repairs

Definition-of-done boxes are UNCHANGED — every production-gated box remains
unchecked, deliberately (this session had, and should have had, no production
credentials). What changed:

1. **The P5 gate ran on real matched evidence for the first time** —
   an honestly-labeled AGENT-DRIVEN dogfood cohort (12 completed lifecycles
   per arm through the real builders/gateway, blind record-only
   reconstruction, preregistered scoring; a first pilot was DISCARDED for
   experimenter leakage and rerun). Verdict: **HOLD**, but of a new kind —
   every no-go trap passed (silent false seal 0, fabrication 0, cost within
   preregistered limits, conformance 1.0); the sole reason is baseline
   hindsight leakage of 0, making the preregistered relative-reduction claim
   unmeasurable against a best-case diligent journal. Claims are narrowed
   accordingly; the decisive-cohort requirements are preregistered. See
   `ADR-2026-07-15-dkk-v6-p5-agent-cohort-rerun.md` and
   `docs/receipts/2026-07-15-dkk-verification/evidence.md`.
2. **Four engine defects found by the verification runs, fixed with
   regression guards**: review-core web↔MCP drift (red on main), seal
   authorship laundering (originated_by hardcoded human — 제2조), the web
   surface's missing premise_adopted write path (§6.2 — measured as 0
   premise recovery in the first blind run), and pull()'s wrong-file report
   (제13조). Evidence doc §4.
3. **The real push-webapp.js pull ran end-to-end** (child process, wire-
   faithful local server): byte-identical append, idempotent re-pull,
   invalid-batch visible error, no-token refusal (`scripts/dogfood/p7-real-pull.ts`).
4. The remaining production-only work is packaged as a 30-minute founder
   protocol: `docs/receipts/2026-07-15-dkk-verification/founder-production-protocol.md`.

## Suggested opening message for the next context-free session

Copy only this prompt into the new session:

```text
Continue DKK v6 from
docs/DKK-v6-CONTINUATION-HANDOFF-2026-07-14.md.

Read that file completely, then read the normative and ADR files in its stated
order. Verify git status and current production state before changing anything.
Do not claim P5 passed. Do not run Supabase migration repair or a full db push.
Do not print or commit secrets. Start with the first unchecked item in the
Definition of done, preserve append-only authority semantics, and record
non-sensitive evidence as you go.
```
