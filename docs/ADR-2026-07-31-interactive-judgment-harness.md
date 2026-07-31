# ADR — Interactive judgment harness: from conversation to living judgment state

Date: 2026-07-31  
Status: Proposed implementation contract; founder direction confirmed  
Relates to:

- `ADR-2026-07-27-one-user-judgment-dataset.md`
- `ADR-2026-07-14-dkk-v6-p6-web-canonical-ledger.md`
- `HANDOFF-2026-07-27-deep-judgment-and-one-dataset.md`

## Decision

The web app's primary artifact is a **living judgment state**, not an analysis
document. The interaction is:

```text
user utterance
  -> grounded mirror
  -> at most one decision-shaping question
  -> visible state delta
  -> user-authored or explicitly adopted judgment
  -> return contract
  -> observation from reality
```

An LLM never writes the living state directly. It proposes a typed patch.
Deterministic code validates provenance and transition rules, then folds accepted
changes into a projection. User-authored acts and explicit adoptions append to
the canonical judgment event stream.

The absence of a premise, option, question, reality check, or action is valid.
No output field has a minimum count.

## What the user should experience

### 1. Say it

The first surface asks for the situation in the user's own words. A document can
be attached, but document claims remain source material rather than user facts.

### 2. See what Argus heard

Argus shows one compact mirror:

- the question as currently understood;
- zero to two AI-surfaced premise candidates only when grounded;
- one correction affordance.

The surface labels AI interpretation as AI interpretation. Continuing does not
silently convert it into a user-authored statement.

### 3. Answer one useful question

A question is asked only when two plausible answers would change the living
state. It targets one known gap, carries a purpose, and defaults to free text.
Options appear only when the user has already named the branches.

### 4. See the delta, not another report

After an answer, the main feedback is:

- **changed** — what this answer revised, resolved, or added;
- **still holds** — only when stability is useful to notice;
- **still unknown** — the one remaining load-bearing gap, if any.

Previous analysis must not reappear as if it were newly generated from the
latest answer.

### 5. Keep a judgment

Argus may propose wording, but the canonical judgment statement is either:

- written directly by the user; or
- explicitly adopted or edited by the user.

AI synthesis, a specialist review, or a majority of agents cannot seal a
judgment.

### 6. Let reality answer

The return interaction brings back:

- the exact judgment the user kept;
- the premise or condition they chose to re-check;
- the promised date or event;
- a neutral request for what actually happened.

It does not grade the user. Resolution preserves the old statement and the new
observation as separate facts.

## Proposed model output

The model proposes a turn. It does not emit a replacement snapshot.

```json
{
  "route": "open",
  "mirror": {
    "text": "8월 안에 내보내고 싶은 마음과 더 고쳐야 한다는 생각 사이에 있어요.",
    "anchors": [
      {
        "utterance_id": "u_01",
        "quote": "8월 안에 사람들에게 배포하고 홍보하고 싶은데"
      }
    ]
  },
  "proposed_changes": [
    {
      "operation": "add",
      "entity_type": "premise",
      "entity_id": "premise_01",
      "text": "8월 안의 배포가 홍보 계획을 지키는 데 필요하다는 전제",
      "anchors": [
        {
          "utterance_id": "u_01",
          "quote": "8월 안에 사람들에게 배포하고 홍보하고 싶은데"
        }
      ],
      "if_false_changes": "배포일과 개선 범위를 다시 비교해야 한다",
      "authority": "ai_surfaced"
    }
  ],
  "next_question": {
    "question_id": "q_01",
    "text": "8월 안에 내보내지 못하면 실제로 놓치는 약속이나 기회가 있나요?",
    "answer_mode": "short",
    "target_entity_id": "premise_01",
    "purpose": "배포 시한이 실제 제약인지 바람인지 구분한다"
  },
  "stop_reason": null
}
```

On later turns the model emits only changes caused by the latest answer:

```json
{
  "proposed_changes": [
    {
      "operation": "revise",
      "entity_type": "premise",
      "entity_id": "premise_01",
      "previous_version": 1,
      "text": "8월 15일 홍보 약속을 지키려면 그 전에 배포해야 한다는 전제",
      "anchors": [
        {
          "utterance_id": "u_02",
          "quote": "8월 15일에 소개하기로 약속했어요"
        }
      ],
      "reason": "막연한 희망이 아니라 사용자가 말한 외부 약속으로 구체화됐다",
      "if_false_changes": "약속 변경 가능성을 먼저 확인해야 한다",
      "authority": "ai_surfaced"
    }
  ],
  "next_question": null,
  "stop_reason": "no_grounded_load_bearing_gap"
}
```

## Living projection

The UI reads a folded projection, not raw model prose:

```ts
interface JudgmentStateProjection {
  judgment_id: string;
  route: 'open' | 'flat' | 'vent' | 'validation' | 'info'
    | 'resistance' | 'self_profiling' | 'crisis';
  frame: {
    text: string;
    authority: 'user_stated' | 'ai_surfaced' | 'user_adopted';
    anchors: SourceAnchor[];
    version: number;
  } | null;
  premises: PremiseState[];
  paths: DecisionPath[];
  reality_checks: RealityCheck[];
  open_threads: OpenThread[];
  current_judgment: {
    text: string;
    authority: 'user_stated' | 'user_adopted';
    recorded_at: string;
  } | null;
  last_delta: StateDelta;
  active_return_contract_id: string | null;
}
```

Each premise has a stable id, version, status, authorship, exact source anchors,
counterfactual impact, and amendment history. `load_bearing`,
`external`, `monitoring_enabled`, and `auto_watch` remain separate fields as
required by the one-dataset ADR.

## Question selection

Question count is not a success metric. Candidate questions are ranked by:

1. groundedness in existing user material;
2. expected change to the judgment state;
3. novelty relative to asked and skipped questions;
4. answerability by the user now;
5. cognitive cost.

The runtime asks the highest-value candidate only when it clears a threshold.
Otherwise it stops. A skipped question is recorded as skipped and is not asked
again unless the user explicitly reopens it.

## Persistence and replay

The target account canonical replica remains the append-only semantic event
stream described by the one-dataset ADR. Do not create another independent
judgment ledger.

- User utterance is appended before model processing.
- A failed model call appends/records processing failure; it does not erase the
  user's answer.
- AI proposals carry `authority=ai_surfaced` and have no user authority.
- Confirmation, correction, rejection, adoption, sealing, deferral,
  observation, resolution, and closure are distinct events.
- Event identity and predecessor/version make retries idempotent and concurrent
  amendments visible.
- `progressive_sessions` becomes a workflow/projection cache.
- `decision_items`, `projects.decision_contract`, receipts, and voyage views
  remain projections, not independent premise writers.

For local-first MCP/plugin use, the same event envelope is written to the local
ledger and synchronized only with explicit account connection and the existing
privacy grant.

## Prompt context

Each turn receives:

- the latest folded projection;
- the latest user utterance;
- the small set of source anchors needed to understand active entities;
- asked/skipped question identities;
- explicit permissions for any governed memory.

It does not receive every historical analysis paragraph by default. Old model
prose is not evidence. Cross-decision memory remains behind the existing JCR
grant and InfluenceTrace path.

## Bounded model architecture

Standard judgment:

```text
one proposer model -> deterministic contract/reducer -> user-visible delta
```

Critical or irreversible judgment:

```text
one proposer -> one dissent/weakness review -> grounded patch -> reducer
```

Deep judgment with genuinely separable work:

```text
up to two specialists -> optional critic -> one synthesis proposal -> reducer
```

Specialists produce sourced claims or questions. They do not mutate the
judgment state and do not vote. The 17 historical capabilities can remain a
routing library; they are not 17 runtime identities.

## Validation ladder

No single LLM judge is sufficient.

1. **Schema and reducer tests** — malformed, ungrounded, duplicate, stale, and
   conflicting patches cannot mutate state.
2. **Replay tests** — the same event fixture folds identically across web and
   local replicas; retries are idempotent.
3. **Metamorphic tests** — paraphrases and irrelevant added detail do not create
   new premises or plans.
4. **Adversarial journeys** — insufficient information, skipped questions,
   corrections, validation, venting, info, crisis, and high-stakes cases.
5. **Repeated model runs** — multiple seeds/providers; report distributions and
   worst cases, not one successful transcript.
6. **Rendered journey tests** — desktop and mobile; verify question visibility,
   delta comprehension, correction, failure recovery, sealing, and return.
7. **Shadow production measures** — premise correction/rejection, repeated
   question rate, answer-to-visible-delta latency, abandonment before judgment,
   explicit adoption rate, and return response rate.
8. **Blinded human review** — fidelity to user wording, usefulness of the next
   question, and whether a reviewer can point to the source of every state item.

## Migration sequence

1. Introduce typed premise candidates and premise deltas behind the existing
   `AnalysisSnapshot.hidden_assumptions` compatibility projection.
2. Add stable source-anchor and state-delta types plus deterministic reducers.
3. Render the delta after each answer; keep the old synthesis below it during
   transition.
4. Append web turn/adoption events through the existing canonical semantic
   gateway; keep `progressive_sessions` as a read/workflow model.
5. Project final premises and return conditions from canonical events instead
   of re-extracting them from `final_mix`.
6. Retire replacement snapshots and legacy prompt paths after replay parity,
   mobile journeys, and production shadow measures pass.

## Explicit non-goals

- No automatic verdict, score, personality inference, or majority vote.
- No forced premise, option, plan, or question count.
- No silent promotion of AI wording into user judgment.
- No silent cross-decision memory injection.
- No permanent dual-write or new independent premise store.
- No public rollout of the new state format before replay and downgrade paths
  are proven.
