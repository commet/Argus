# R48 — pipeline-coherence: route boss concerns to an owner; retire a dead field

Findings pipeline-coherence#1 (leverage 7) + pipeline-coherence#4 (leverage 2).
Both are cross-skill schema coherence: boss → revise → team.

## #1 — boss concerns could be silently lost in revision

The routing contract was inconsistent across three files:
- `dm-feedback.json` (boss output) concerns have only `[text, severity,
  fix_suggestion]` — **no `owner_agent_id`**, and boss never assigns one (boss
  reviews the scaffold, not a worker).
- `revise` Step 2 gathered them as `{… owner_agent_id?, …}` (optional `?`).
- `team --revise` routes each item by injecting it "into its `owner_agent_id`
  worker."

So a boss concern with no owner reached team --revise and had nowhere to go — it
was silently dropped. The whole point of revise (apply the boss's concerns) failed
exactly on the concerns the boss cared about.

**Fix (owner is resolved at the aggregator, never blank):** `revise` Step 2 now
resolves `owner_agent_id` for every applied boss concern via a §Resolving-the-owner
ladder:
1. **Section → worker** (match the concern's targeted section to the worker who
   produced it, via `mix.json` section attribution).
2. **Cross-cutting → `navigator`** (synthesis / overall-frame / between-worker
   contradiction has no single owner → the synthesis pass owns it).
3. **Not worker-addressable → `human_required_checkpoints[]`** with
   `reason: "boss_concern_unrouted"` (e.g. "needs real legal sign-off") — surfaced
   into the bearing, not added to `items[]`.

Invariant stated: every applied boss concern ends as exactly one of an owned
`items[]` entry or a human checkpoint — none disappears. `owner_agent_id` is now
required (no `?`) on the items revise emits.

**Defensive backstop in team --revise:** if an item's `owner_agent_id` matches no
worker in the revision plan (stale id, or that worker isn't being re-run), inject
into the `navigator` synthesis pass, else append to
`human_required_checkpoints[]` with `reason: "revision_item_unrouted"`. A revision
item must always land somewhere a human can see.

## #4 — the dead `claim_ids` field

`worker-result.json` declared `claim_ids` ("Claims in verification-ledger.json that
cite this worker"), but `grep -rn claim_ids skills/ data/schemas/` showed **no
skill writes it and no skill reads it** — a schema that lies about what the data
carries. Removed it (CLAUDE.md → Clean Removal; zero references confirmed before
deleting). If reverse worker→claim traceability is ever wanted, it should be added
when a consumer exists; note that R49's verify fix adds the useful *forward*
direction (claims carrying `worker_id`), which is the one that's actually needed.

## Verification

`worker-result.json` re-parses as valid JSON; `node scripts/validate-plugin.js`
→ passed.

## Next

R49 (verify): define "cross-agent support" as active endorsement (not
absence-of-opposition) + worker traceability on extracted claims + corrupt-JSON
error modes.
