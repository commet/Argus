# Antefact 0.1.5-draft — the judgment record format

> A judgment record is a claim about the future, **sealed** before the outcome,
> owned by named **authors**, and settled against named **reality**.

2026-08-11 (r6) · Requirement terms per RFC 2119 (MUST/SHOULD/MAY) ·
License: prose CC BY 4.0, schema/tooling MIT · English is the normative text;
a Korean translation is maintained alongside.

This standard does not judge the quality of anyone's judgment. It preserves
exactly two things — **sequence** (what existed before what) and **authorship**
(who owns which words). That alone makes dishonesty structurally expensive:
hindsight is blocked by the seal, ownership-dodging by the authorship map,
settlement-dodging by the settlement date, and silent revision by the revision
history. Antefact records the **predictive face** of a judgment — the part
exposed to verification — not the whole deliberation (considered alternatives
MAY be recorded via Annex A).

## 1. The record

- One judgment is one file: **Markdown + YAML frontmatter**. File convention
  `name.antefact.md`. Required frontmatter keys (MUST): `antefact` (spec
  version) · `id` · `authors` · `state`.
- `id` is a UUIDv7 or content-derived identifier (MUST). Duplicate ids within a
  store invalidate both records for verification (MUST).
- **Canonical projection** (MUST): frontmatter parses under the YAML 1.2 core
  schema with per-key types fixed by the official JSON Schema (no implicit
  typing). The projection includes every normative field, canonicalized per JCS
  (RFC 8785); precision-bearing numerics (`observed`, monetary amounts, `p.raw`)
  are string-encoded (MUST). Hashing, sealing, and verification are defined over
  this projection only, and a seal MUST name its projection recipe version
  (`proj`) — a hash whose recipe is unknown proves nothing.
- **Recipe versions are additive** (MUST): a conforming verifier keeps every
  published recipe. Recipes are `v1` (Stake fields + `nonce` + `statement_rev`)
  and `v2` (`v1` + `ts`, the seal time). Dropping a recipe would turn every
  record sealed under it into an unverifiable file, so recipes are never
  removed — only added. New seals SHOULD use the newest recipe.

## 2. States

| state | meaning | norm |
|---|---|---|
| `recorded` | No Stake — valid, carries no judgment credit | Excluded from scoring aggregates (MUST) |
| `sealed` | Stake sealed | Stake immutable thereafter (MUST) |
| `settled` | Settlement exists | Settlement is append-only (MUST) |
| `disputed` | Named settlers appended conflicting outcomes | Every conflicting entry is preserved; the record is unscored and counted in the denominator (MUST) |
| `withdrawn` | Tombstoned | Reason ∈ {error, retracted} (MUST) |

- **Denominator-line norm**: conforming tools MUST display, next to any scored
  view, the counts of **every unscored post-seal exit** — withdrawals of any
  reason, `ambiguous`, `annulled`, `disputed`, and lapsed records. Whatever door
  a losing stake leaves through, the denominator shows it.
- **Tombstones** retain `id`, timestamps, `state`, and withdrawal reason (MUST).
  Author references MAY be replaced by anonymous tokens on the author's request
  (erasure procedure): the record's existence survives, the identity does not.
- **Lapsed**: tools MUST conspicuously flag unsettled records past `settle_by`.

## 3. Blocks

### 3.1 Statement — amendable, history public

- `premises[]`: `{ pid, text, author, confidence }` plus optional
  `{ kind, sources[], tripwires[] }`. `pid` is a stable in-record identifier
  (MUST); `confidence ∈ {high, moderate, low}`; `kind ∈ {fact, assumption,
  inference}` (MAY); `tripwires[]` (MAY) are observations that would refute the
  premise, written at seal time.
- Amendments are an append-only revision list; every revision carries authorship
  (MUST). A revision's identifier is the hash of its canonical projection (MUST)
  — a commitment, not a pointer.

### 3.2 Stake — immutable once sealed

- `claim` — the prediction. `p` — the probability: **the raw input is the
  original** (MUST): `p { raw (the gesture: band id · chip vector · typed
  number · interval), mode ∈ {direct, band, frequency, slider, ai_suggested},
  canonical (derived scoring number, marked as derived), granularity }`. A tool
  silently converting verbal input into a number is prohibited. "I can't say" is
  never stored as 50 (MUST NOT): if no probability can be given, the honest
  record stays `recorded`, unsealed. `confidence` (MAY) is confidence in the
  evidence — a separate axis from likelihood.
- **Scoring scope in 0.1**: scoreable stakes are binary claims with point `p`
  (MUST). Interval `p` and quantitative stakes are recorded and settled but
  unscored (CRPS deferred to 0.2).
- `settle_by` — settlement date, UTC (MUST). `settled_by` — the named
  settler(s), as author-key references (MUST): the seal names its judge.
  `criteria { source, threshold, edge }` (SHOULD; Annex B lint). `annul_if`
  (MAY).
- `seal` — `{ level, proj, hash, statement_rev, nonce }`, all five required on a
  sealed record (MUST); `hash` and `statement_rev` are complete SHA-256 digests
  (64 lowercase hex characters) — verification never accepts an abbreviation,
  however a display may shorten it. The hash covers the
  Stake's canonical projection plus the content hash of the Statement revision
  current at seal time (MUST). `nonce` is a random value inside the sealed
  projection (MUST) — public log entries must not be dictionary-attackable.
- `seal.ts` — seal time, minute-precision UTC; REQUIRED under recipe `v2` and
  absent under `v1`. It sits **inside** the hashed projection (MUST): a format
  whose whole claim is "this was written before the outcome" cannot carry a
  freely rewritable date, so editing or stripping `ts` breaks verification.
  **Honest limit**: at L0 the clock is the author's own and `ts` proves only
  self-consistency; what a reader weighs is the seal level (L1 git ref, L2
  external anchor), not this field.
- `seal.stream` — `{ stream_id, seq, prev_hash }` (MAY): a seal chain grounding
  public calibration claims (§8). Content stays private — the chain proves only
  count and order.

### 3.3 Settlement — append-only

- **Literal-text rule**: settlement follows the literal sealed text — the words
  win over the intent (MUST).
- Only settlers named in `settled_by` may append an outcome (MUST), and each
  settlement entry records which of them appended it (`by`, MUST) —
  authorization that is checked and then discarded cannot be audited later.
  Conflicting outcomes from named settlers render the record `disputed` —
  unscored, both entries preserved (MUST).
- Corrections are **reversing entries**: append with a reason, never edit (MUST).
- `outcome ∈ {yes, no, ambiguous, annulled}`; `ambiguous` and `annulled` are
  unscored (MUST). Quantitative stakes record `observed` (SHOULD). A settlement
  that departs from the sealed text is flagged `deviated` (MUST) — deviation is
  not a sin; unlabeled deviation is.
- `outcome`/`observed` are the factual layer; `note` is the interpretive layer.
  Contested interpretation never corrupts the outcome record.

## 4. Authorship

| value | meaning |
|---|---|
| `h` | Human-authored, human-owned |
| `ai` | AI output, no human uptake |
| `h←ai` | **Adoption** — AI-proposed, human took ownership |
| `ai←h` | **Delegation** — AI acting under a human-authored policy; `policy_ref` required (MUST) |
| `u` | Unknown — imports and legacy only |

- **Non-ranking clause**: conforming tools MUST NOT rank, score, or visually
  demote records or authors by authorship value. Lints mandated by this
  specification (e.g., warning on `u` in sealed records) are exempt.
- The five values are a deliberate lossy compression of edit round-trips;
  final ownership and first origin are preserved; full chains reconstruct from
  revision history.
- **Expressing an override**: when a human rejects an AI proposal and decides
  otherwise, the adopted content is tagged `h` and the rejected proposal is
  recorded in `alternatives` (Annex A) tagged `(ai)` — an override is evidenced
  by this contrast, not by a new value.

## 5. Seal levels

| level | evidence | warrant |
|---|---|---|
| L0 | Self-declared timestamp | None — an honesty device toward oneself |
| L1 | History-log entry (e.g., a git commit) | Tamper *evidence* — real warrant only with an external observer |
| L2 | Signed attestation (e.g., Sigstore, RFC 3161) | Public, independent verification |

`sealed` is valid at every level; the level is recorded (MUST). Cryptography is
not the price of admission.

## 6. Premise treatments

`holds | narrowed | questioned | retired`. Treatments are assigned by later
records citing a premise by `pid`. **Binding condition**: a treatment binds only
when the citing record's authors overlap the premise's author; otherwise it
remains a suggestion (MUST) — no one retires another person's belief. Tools may
suggest; only authors assign (MUST). A flag is a summons to look, never a
verdict.

## 7. Supersession and the duty to settle

`superseded_by` does not void the original Stake (MUST) — it still meets
reality on its settlement date; the only exception is an explicit annulment
with a reason. Each sealed stake in a supersession chain scores independently,
and aggregate displays MUST group chains — updating one belief five times is
not five track records.

## 8. Conformance — three classes

- **Validator**: exact schema, canonical projection, and hash verification.
- **Display tool**: non-ranking clause · visibility norms (recorded /
  retractions / lapsed / **self-settled**) · treatment binding rules.
- **Scorer**: scoring scope (binary + point p) · ambiguous/annulled/disputed
  unscored · chain grouping · resolution-matched feedback (SHOULD: score on
  `canonical`, display at the user's input `granularity`; tail calls ≤5%/≥95%
  warrant precision) · the score clause below.
- **Score clause**: person-level aggregates are permitted as self-feedback
  visible to that author. What is banned is exposure to others without consent,
  and ranking of authors (MUST NOT). Because question sets are self-authored,
  absolute scores are not statistically comparable across authors — the
  non-ranking clause is ethics and statistics at once.
- **Public calibration claim**: rendered only over a gap-free seal chain
  (`seal.stream`), with the denominator line (N sealed · M settled · K unscored
  exits), a histogram of stake probabilities, item count, and chain-group count
  (MUST). Default shared form is a binned calibration curve, not a single score
  (SHOULD). **Honest residual limit**: multi-identity laundering cannot be
  prevented without an identity layer — a public calibration claim is a
  statement about *this stream*, not a proof about *this person*.

## 9. Non-goals

No identity layer · no blockchain · no mandatory cryptography · no publicly
exposed person scores · no quality judgment · no transport protocol or
registry. The file is the whole interface.

## 10. Versioning and privacy

- Records are interpreted under their own `antefact` version. Pre-1.0 honesty:
  interpretation of 0.x records is best-effort; 1.0 freezes the required blocks
  and ships with a migration tool (MUST). Records outlive specifications.
- Records are private files by default. Public logs carry nonce-protected
  hashes only.

## 11. Example

See `vectors/valid/v2-unsealed.antefact.md` (English) and
`vectors/valid/v5-korean.antefact.md` (Korean) — the golden vectors are the
living examples; the test suite keeps them honest.

## 12. Annexes (carried in the published spec)

A optional fields (`context` · `alternatives[]` · `shown[]` · `otel_trace_ref` ·
`policy_ref` · counterfactual re-expansion) · B settleability lint rules ·
C probability bands (tail-dense, dual-label) and input-UI guidance · D the
`JUDGMENTS.md` repository convention · E interop mappings (PROV-O JSON-LD ·
schema.org ClaimReview · PredictionBook/Fatebook import) · F distinguishing
notes (Toulmin · OMG DMN · GSN/SACM) · G regional conformance profiles (EU ·
KR · UK · US-MRM · FDA · SG — parameters over one core; the core never forks) ·
H (announced) the one-line embed: `Antefact: <id> sealed <date> sha256:<8>`.

---

**Name policy** — the content is freely copyable, implementable, and
translatable under CC BY 4.0. The name may be used freely to claim
compatibility; modified specifications must be published under a different
name. Governance follows adoption.

**r5 changelog** — names the format **Antefact** (OED 1623: a record before the
fact, the opposite of *postfact*); the earlier working name was retired over a
namespace collision (decision ledger D14). Adds `proj` (projection recipe
version) to the seal, the self-settled visibility norm (adversarial review
2026-08-10), file convention `name.antefact.md`, and announces Annex H.
r2–r4 history lives in the decision ledger with full rationale.

**r6 changelog** — adds projection recipe **`v2`**, which brings `seal.ts` (seal
time) inside the hashed projection. r5 announced Annex H's one-line embed
`Antefact: <id> sealed <date> sha256:<8>` while the format recorded no seal
time at all, so that line could not be produced from a conforming record
without inventing the date — the gap was found by trying to build it. Placing
`ts` inside the projection rather than beside it is the point: an unsealed date
is the one field a back-dating author would edit. Recipes are additive and `v1`
records keep verifying (golden vector `v6-sealed-v1`).
