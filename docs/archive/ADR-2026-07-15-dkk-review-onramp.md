# ADR — Document review as a DKK onramp

Date: 2026-07-15
Status: Accepted
Relates to: `docs/ADR-2026-07-14-dkk-v6-p6-web-canonical-ledger.md`,
`docs/ADR-2026-07-14-dkk-v6-p7-surface-convergence.md`

## Context

The document-review surface (`src/lib/review/*`, `ReviewFlow`) was a separate
engine from the DKK v6 semantic ledger. Its two user actions — "이 판단을 내가
소유하기" (owned toggle) and "후속 예측 봉인하기" (local seal) — wrote to the
review-only `review_receipts` store, never to the canonical
`project_semantic_events` ledger. A judgment adopted from a reviewed document
therefore lived outside DKK: no cross-surface lifecycle, no authority
invariants, no settlement through the shared kernel.

## Decision

The document review is a **DKK onramp**. It analyses a document into candidate
judgment obligations (AI proposals); the human's single **own = seal** action
commits one obligation into the canonical project ledger.

1. **Space (1a).** A reviewed document is promoted to a **project**
   (`account-project:<id>`, reusing the existing web ledger, RPC, and
   `SemanticDecisionCard`). The project row is committed to Supabase before the
   seal, because the seal RPC requires it.

2. **Proposal recording (2b), adopted-only.** The adopted proposal is recorded
   **in the seal batch**, not at review time. One `seal` web command expands to
   an atomic 3-event batch:
   - `proposal_created` — `originated_by: ai`, `recorded_by: system`, **no
     human authorization** (non-authorial), `provenance.source_ref = review:<receipt>`.
   - `judgment_sealed` — human-authorized, `source_proposal_id` → the proposal.
   - `return_promised` — human-authorized return contract from the seal modal.

   Event ids carry ordinals `0-proposal / 1-sealed / 2-return` so every reader
   (which sorts by `event_id`) folds the proposal before the seal and marks it
   adopted. Proposals the user never adopts are NOT written — no project or
   ledger row is created for an abandoned review.

3. **Unified action.** "이 판단을 내가 소유하기" opens the seal modal (judgment =
   the obligation, return contract = the modal's prediction/date/conditions).
   The former separate owned-toggle and follow-up-seal are merged. Settlement
   (observe/resolve/close) flows through DKK, not the review store.

## Invariants preserved

- AI may **propose** (non-authorial `proposal_created`) but cannot fabricate a
  human seal — only the human `own = seal` emits the authorial `judgment_sealed`
  (DKK constitution, Article on authorial authority).
- The sealed statement and its return question stay separate fields.
- Sign-in is required to seal (the ledger is per-account). Anonymous review
  still produces a local analysis receipt; it just cannot reach the ledger.

## Consequences

- No reducer/kernel change: the existing soft `source_proposal_id` link and the
  RPC's scan-for-`judgment_sealed` pointer stamp already support the batch. A
  hard link (guarded referent + `source_proposal_id` projected on the judgment)
  is deferred to a later ADR if provenance queries need it.
- No migration: `sealed_judgment_id` (obligation) and `project_id` (receipt) ride
  in the `review_receipts.data` jsonb; the ledger uses the deployed
  `project_semantic_events` table.
- Contract change: `SemanticWebCommand.seal` gains optional `proposal_id`,
  `proposal_text`, `source_ref`. A direct human seal (no proposal) stays a
  2-event batch — backward compatible.

## Verification

- Unit: `src/lib/__tests__/semantic-web.test.ts` (3-event batch, ordinals,
  non-authorial proposal, fold marks it adopted) and
  `src/lib/__tests__/review-seal.test.ts` (obligation → command mapping).
- Pending (needs a signed-in account against the deployed ledger): a real
  own = seal creates the project, appends the batch, stamps
  `decision_contract.semantic_judgment_id`, and settles through
  `SemanticDecisionCard`.
