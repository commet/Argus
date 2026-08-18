# ADR — Argus judgment experience value contract

Date: 2026-08-02  
Status: Proposed measurement contract; implementation in progress  
Relates to: `ADR-2026-07-31-interactive-judgment-harness.md`

## Product thesis

Argus is not valuable because it produces a longer analysis or simulates more
experts. General chat products can already do that. Argus earns a separate place
only when a person can:

1. leave their own view before hearing AI;
2. see one grounded premise or gap;
3. answer one question that can actually change the state;
4. see exactly what changed without losing what stayed true;
5. keep a judgment in their own words; and
6. return when reality can answer it.

The durable artifact is therefore a **user-owned judgment ledger with visible
deltas and a return loop**, not advice, a bias score, a report, or a panel of AI
personas.

## Why this is the wedge

- Outcome knowledge distorts later recollection of prior predictions and even
  confidence in them. Preserving the before-state is product value, not ceremony.
  See Fischhoff's original hindsight work and later longitudinal evidence:
  <https://qualitysafety.bmj.com/content/12/4/304> and
  <https://doi.org/10.1016/j.obhdp.2005.05.004>.
- Good clarification questions are valuable when their expected answer changes
  what follows, not when they merely gather more detail. This is the same
  expected-value-of-information principle used in clarification-question
  research: <https://arxiv.org/abs/1805.04655>.
- Human-AI systems should optimize for appropriate reliance, not maximum trust.
  Correction and user control are first-class interaction requirements:
  <https://www.microsoft.com/en-us/research/publication/guidelines-for-human-ai-interaction/>
  and <https://pair.withgoogle.com/guidebook-v2/chapter/feedback-controls/>.
- A future check works better when it is attached to a specific situation and
  action rather than a vague intention. Implementation-intention evidence
  supports event-shaped return contracts:
  <https://pubmed.ncbi.nlm.nih.gov/25639373/>.

These findings do not prove Argus will retain users. They define the behavior
worth testing and the failure modes that would falsify the product thesis.

## The first-three-minute contract

The first session must make the difference from ordinary chat visible without
an explanation page.

```text
their situation
  -> their pre-AI baseline (optional)
  -> one grounded mirror
  -> one decision-shaping question
  -> changed / still true / still unknown
  -> their wording to keep
```

Rules:

- A pre-review baseline is user evidence but not proof of a closed decision.
- The first question may not ask for a choice, condition, concern, or threshold
  already present in the baseline.
- One screen has one primary action. On mobile the active question appears before
  history, source detail, deep-review promotion, or journey decoration.
- An answer is acknowledged locally at once. Model work may refine the semantic
  delta afterward, but old analysis never masquerades as a new result.
- Empty premises, no next question, and no plan remain valid outcomes.

## Runtime boundary

Default:

```text
one proposer -> typed patch -> deterministic validation/reducer -> visible delta
```

Critical and hard to reverse:

```text
one proposer -> one dissent/weakness check -> typed patch -> reducer
```

Only genuinely separable research work may fan out to specialists. The 17
historical capabilities remain a routing/checklist library, not 17 identities or
17 mandatory calls. A model proposes meaning; code owns authorship, provenance,
versioning, idempotency, limits, and state transitions.

## Latency and cost budgets

Quality without responsiveness is not the intended experience. Report
distributions and worst cases, not a single good transcript.

| Moment | Target | Failure signal |
|---|---:|---:|
| local answer receipt | < 150 ms p95 | input appears lost |
| first meaningful mirror after baseline | < 8 s p50, < 20 s p95 | feels like report generation |
| semantic delta after an answer | < 8 s p50, < 20 s p95 | collaboration loses continuity |
| standard-path model calls before seal | median <= 2 | architecture is doing ceremony |
| questions before a useful state | median <= 1, p90 <= 2 | information gathering outruns value |

Measured 2026-08-02 on `heavy-10-launch-baseline` before prompt compression:

- gate: 4.6 s;
- initial judgment: 17.0 s, 7,374 cached-system creation tokens, 921 thinking tokens;
- deepening 1: 26.7 s, 6,946 input tokens, 1,509 thinking tokens;
- deepening 2: 18.3 s, 7,126 input tokens, 1,053 thinking tokens.

This passes the content rubric and fails the desired interaction budget. The
next optimization target is not shorter prose alone: deterministic contracts
must replace repeated prompt instruction, and each turn should receive only the
small active state.

## Product measures

### Activation

- baseline captured or explicitly skipped;
- one grounded question answered;
- user can identify the visible state change;
- judgment adopted or edited by the user.

### Trust and agency

- premise correction/rejection rate;
- baseline re-ask rate (target below 1%);
- repeated-question rate;
- AI wording edited before adoption;
- failures recovered without lost input.

### Return value

- return contract accepted;
- due reminder delivered;
- return opened and answered;
- prior statement and new observation both preserved;
- user records what should change next, without Argus grading the outcome.

The north-star candidate is **completed reality loops with a user-owned judgment
and observation**, not decisions created, tokens consumed, analysis length, or
AI agreement.

## Kill and rethink criteria

Revisit the thesis rather than adding more machinery if, after enough real
traffic to segment by route and device:

- users value the first answer but do not adopt/edit a judgment;
- return-contract acceptance is healthy but return responses remain negligible;
- users cannot explain the difference from asking a general chatbot;
- corrections do not improve subsequent turns in a way users can perceive; or
- latency targets require multiple expensive calls for ordinary decisions.

No engagement metric can compensate for repeated authorship violations,
fabricated premises, crisis mishandling, or a return screen that rewrites the
past.
