# Judgment Checkpoints - Product Design Draft

Date: 2026-07-06

Status: Starting document

## 0. One-line Thesis

Argus should not merely produce a better answer. It should help the user return to a past judgment, compare it against a meaningful signal, and feel that their judgment has become sharper.

```diff
- Argus gives a strong recommendation.
+ Argus helps the user revisit a judgment and see more clearly than before.
```

This is the product role of **Judgment Checkpoints**.

They replace the user-facing language of "Decision Contract." The internal system can still keep compatibility with older contract/settlement code, but the user should not feel like they are signing a legalistic agreement. They should feel like they are leaving a small marker that will help them see better later.

## 1. Naming

### User-facing term

Use:

> **판단 체크포인트**

Secondary phrases:

- "나중에 다시 볼 기준"
- "이 판단을 다시 볼 손잡이"
- "다시 확인할 신호"

Avoid:

- "계약"
- "서약"
- "정산"
- "채점"
- "예측 점수"

"현실 체크" is useful, but it should not be the umbrella term. It is too outcome-centered. Argus does not always compare a judgment only with reality. It can compare it with stakeholder reaction, new evidence, the original standard, or the user's own shift in framing.

### Recommended copy

During finalization:

> 이 판단은 나중에 무엇과 대조해볼까요?

When saving:

> 나중에 다시 볼 기준을 하나 남깁니다.

When returning:

> 지난 판단을 다시 볼 시간이 됐습니다.

After recording:

> 기록됐습니다. 이번 체크로 판단의 시야가 조금 더 선명해졌습니다.

## 2. Product Purpose

The checkpoint is not a retention gimmick. It is the mechanism that turns Argus from a one-time decision assistant into a judgment-development tool.

The user should return not because Argus nags them, but because returning creates value:

- They see what they noticed correctly.
- They see what they missed.
- They notice when the basis of judgment changed.
- They learn what kind of assumptions they repeatedly over-trust.
- They feel their judgment becoming deeper and more precise.

The emotional target:

```diff
- "I have homework to settle."
+ "I can see my judgment more clearly now."
```

## 3. Core Object

Internal model name:

```ts
type JudgmentCheckpoint = {
  id: string;
  decision_id: string;
  source_session_id?: string;
  type: CheckpointType;
  title: string;
  original_judgment: string;
  core_assumption: string;
  check_prompt: string;
  signal: CheckSignal;
  interpretation_frame?: string;
  consequence_hint?: string;
  status: CheckpointStatus;
  result?: CheckpointResult;
  ambiguity?: AmbiguityRecord;
  growth_note?: GrowthNote;
  created_at: string;
  due_hint?: DueHint;
  checked_at?: string;
};
```

This object should be treated as first-class product state, not a line appended to the bottom of a report.

The checkpoint answers one question:

> What later signal would make this judgment clearer?

## 4. Checkpoint Types

The earlier "reality-only" framing is too narrow. The better type system has five checkpoint types.

```ts
type CheckpointType =
  | 'outcome'
  | 'reaction'
  | 'evidence'
  | 'standard'
  | 'drift';
```

### 4.1 Outcome Check

Use when the judgment can be compared against a concrete result.

Good for:

- DAU or usage targets
- conversion rates
- incident count
- PR merged or blocked
- launch result
- revenue or cost signal

Example:

> 30일 안에 플러그인 DAU가 전체 활성 사용자의 60%를 넘지 못하면, 웹앱 흡수는 보류한다.

Strength:

- High clarity.
- Easy to revisit.
- Good for calibration history.

Risk:

- Can become fake precision if Argus forces every decision into a metric.

Rule:

Do not invent a number just to make the checkpoint look rigorous.

### 4.2 Reaction Check

Use when the important signal is how a person or group responds.

Good for:

- boss review
- CFO/CEO/manager reaction
- customer interviews
- team pushback
- stakeholder approval
- user confusion

Example:

> CFO는 기능 가치보다 비용 통제 부재를 먼저 물을 것이다.

Return prompt:

> 실제로 CFO가 먼저 문제 삼은 것은 무엇이었나요?

Strength:

- Matches Argus's boss/persona simulation.
- Handles decisions where "the meeting reaction" is more real than a metric.

Risk:

- User memory and interpretation can distort the record.

Rule:

Ask for the user's observed signal, not a final verdict on the person.

### 4.3 Evidence Check

Use when the final outcome is not available yet, but the core assumption can become more or less supported.

Good for:

- early product direction
- research-backed decisions
- migration feasibility
- "should we continue exploring this?"
- assumptions that need more examples

Example:

> 다음 10개 실제 사용 세션에서 플러그인만으로도 깊은 작업이 가능한 사례가 나오는지 본다.

Strength:

- Lets Argus improve judgment before the final outcome arrives.
- Prevents "we need to wait months" from killing the loop.

Risk:

- Evidence can be cherry-picked.

Rule:

Store the evidence source and ask what evidence was missing, not only what evidence appeared.

### 4.4 Standard Check

Use when the main danger is changing the evaluation standard after the fact.

Good for:

- decisions under pressure
- reversible vs irreversible threshold decisions
- "we said we would only proceed if X"
- avoiding post-hoc rationalization

Example:

> 우리는 DAU 60%를 통합 기준으로 잡았다. 지금도 그 기준으로 판단하고 있는가, 아니면 비용 압박 때문에 기준을 바꾸고 있는가?

Strength:

- Catches standard-shifting.
- Very Argus-native.

Risk:

- Can feel accusatory if phrased badly.

Rule:

Changing the standard is allowed. Hiding that it changed is the problem.

Recommended copy:

> 기준이 바뀐 건 나쁜 게 아닙니다. 바뀐 이유를 남겨두면 다음 판단이 더 선명해집니다.

### 4.5 Drift Check

Use when the key question is whether the user's framing has changed.

Good for:

- ambiguous strategy decisions
- early-stage product direction
- personal career decisions
- design direction
- "we thought this was about X, but maybe it is about Y"

Example:

> 처음엔 비용 절감 문제로 봤다. 지금도 그렇게 보는가, 아니면 사용자 경험/운영 부담 문제가 더 커졌는가?

Strength:

- Creates the strongest feeling of judgment growth.
- Captures "my view is deeper now" even when no outcome is available.

Risk:

- Too vague if no original frame is stored clearly.

Rule:

Always show the original frame before asking whether it drifted.

## 5. Type Selection Heuristic

Argus should not ask the user to choose from five abstract types. It should infer a type and, when useful, show one sentence explaining the choice.

Selection order:

1. If a concrete result will soon exist, use `outcome`.
2. If the strongest uncertainty is a stakeholder/user reaction, use `reaction`.
3. If the outcome is distant but assumptions can be tested, use `evidence`.
4. If the user set a threshold or condition, use `standard`.
5. If the frame itself is likely to change, use `drift`.

Fallback:

If none is clearly right, create an `evidence` or `drift` checkpoint. Do not force an outcome prediction.

Example internal routing:

```ts
function chooseCheckpointType(context: DecisionContext): CheckpointType {
  if (context.hasNearTermObservableOutcome) return 'outcome';
  if (context.primaryRiskIsStakeholderResponse) return 'reaction';
  if (context.hasTestableAssumptionBeforeOutcome) return 'evidence';
  if (context.hasExplicitDecisionStandard) return 'standard';
  return 'drift';
}
```

## 6. What Makes a Good Checkpoint

A good checkpoint is not "specific date plus number." That would make Argus mechanical.

A good checkpoint has five properties:

1. **A handle for returning**: there is some future signal, event, reaction, evidence, or framing change to revisit.
2. **Connection to the judgment**: the signal actually matters to the current decision.
3. **Honest answerability**: the user can answer without pretending to know more than they know.
4. **Room for ambiguity**: "mixed," "unknown," and "changed context" are valid states.
5. **Growth payoff**: checking it should reveal one thing the user now sees more clearly.

Bad checkpoint:

> 30일 뒤 제품 방향이 맞는지 확인한다.

Why bad:

- Too broad.
- "맞다" is undefined.
- No signal.
- No next action.
- Invites self-justification.

Better checkpoint:

> 첫 10명 사용자가 설명 없이 핵심 행동을 완료하지 못하면, 방향 문제가 아니라 온보딩 문제로 먼저 다룬다.

Why better:

- It has a signal.
- It separates product direction from onboarding.
- It gives the user a way to be honest if results are mixed.

## 7. Quality Gate

The quality gate should not be a blocker that shames the user or forces fake rigor. It should be a quiet sharpening mechanism.

Do not implement it as:

```text
date missing -> fail
metric missing -> fail
threshold missing -> fail
```

Implement it as:

```text
This checkpoint is useful, but too broad.
Here is the smallest change that would make it easier to revisit later.
```

### 7.1 Quality States

```ts
type CheckpointQuality =
  | 'ready'
  | 'needs_sharpening'
  | 'too_ambiguous'
  | 'not_worth_tracking';
```

### 7.2 Quality Dimensions

```ts
type CheckpointQualityReview = {
  quality: CheckpointQuality;
  observability: 'clear' | 'partial' | 'weak';
  judgment_connection: 'strong' | 'medium' | 'weak';
  discrimination: 'changes_next_action' | 'interesting_only' | 'unclear';
  honesty: 'safe_to_answer' | 'may_pressure_user' | 'likely_distorts';
  burden: 'under_30s' | 'requires_notes' | 'too_heavy';
  issue?: string;
  suggested_revision?: string;
};
```

### 7.3 Practical Quality Questions

The gate should ask internally:

1. Can the user observe something later?
2. Does that thing actually test the current judgment?
3. Would different answers lead to different action or understanding?
4. Can the user say "I don't know yet" without penalty?
5. Can the user complete the check in under 30 seconds?

If the answer to 1 or 2 is no, revise the checkpoint.

If the answer to 3 is no, consider not tracking it.

If the answer to 4 is no, add ambiguity states.

If the answer to 5 is no, simplify the settle experience.

### 7.4 Gate Output Examples

Weak checkpoint:

> 2주 뒤 반응이 좋은지 본다.

Argus should respond:

> 이 체크포인트는 아직 넓습니다. "반응이 좋다"보다, 어떤 반응이 나오면 판단을 바꿀지 하나만 좁히겠습니다.

Suggested revision:

> 첫 고객 5명 중 3명 이상이 설명 없이 핵심 행동을 완료하지 못하면, 기능 가치보다 온보딩을 먼저 고친다.

Weak checkpoint:

> 다음 회의에서 CFO가 뭐라고 하는지 본다.

Argus should respond:

> 볼 손잡이는 있습니다. 다만 회의 반응 전체가 아니라, 우리가 예상한 한 가지 우려가 실제로 나왔는지를 보겠습니다.

Suggested revision:

> CFO가 ROI보다 실행 리스크를 먼저 물으면, 예산안보다 리스크 통제안을 먼저 보강한다.

## 8. Settle Experience

The return experience should not feel like homework, confession, or scoring. It should feel like a short judgment review.

### 8.1 First Screen

```text
판단 체크포인트

그때의 판단:
웹앱 통합은 보류하고, 플러그인 사용 깊이를 먼저 본다.

다시 볼 기준:
다음 10개 실제 사용 세션에서 플러그인만으로 깊은 작업이 가능한지 확인한다.

지금 보기엔 어땠나요?

[대체로 맞았다]
[빗나갔다]
[섞여 있었다]
[아직 판단하기 어렵다]
```

Labels should avoid overclaiming. Prefer:

- "대체로 맞았다"
- "빗나갔다"
- "섞여 있었다"
- "아직 판단하기 어렵다"

Avoid:

- "성공"
- "실패"
- "정답"
- "오답"
- "승리"
- "패배"

### 8.2 Type-specific Prompts

Outcome:

> 예상했던 결과가 실제로 나타났나요?

Reaction:

> 예상했던 반응과 실제 반응은 어떻게 달랐나요?

Evidence:

> 핵심 가정을 더 지지하는 증거가 쌓였나요, 아니면 약해졌나요?

Standard:

> 처음 정한 기준으로 보면, 이 판단은 아직 유효한가요?

Drift:

> 지금도 이 문제를 같은 방식으로 보고 있나요?

### 8.3 If the User Selects "아직 판단하기 어렵다"

Ask one follow-up only:

```text
무엇이 아직 부족한가요?

[데이터가 부족함]
[결과가 섞여 있음]
[내 해석에 자신 없음]
[상황이 바뀌었음]
```

Then close lightly:

```text
좋습니다. 이 판단은 아직 열어둡니다.
다음에 다시 볼 손잡이:
사용 세션 5개가 더 쌓인 뒤
```

The user should not feel punished for uncertainty. If uncertainty is real, recording it honestly is a win.

## 9. Helping Users Record Ambiguous Reality Honestly

This may be the most important design problem.

Argus is not an objective oracle. Many decisions are settled through partial signals, memory, meeting dynamics, and interpretation. If Argus forces a clean verdict, users will distort the record.

The goal:

```diff
- Force the user to say whether Argus was right.
+ Help the user record what became clearer, what stayed ambiguous, and what changed.
```

### 9.1 Common Distortion Patterns

1. **Ambiguous result becomes a win**
   - The user wants closure, so "mixed" becomes "mostly right."

2. **Standard shifts after the fact**
   - The original criterion was DAU, but the user now judges by team bandwidth.

3. **Externalization**
   - Everything is explained as "the market changed" or "the team failed," with no review of the original assumption.

4. **Original assumption disappears**
   - The user talks about a new issue and forgets the old judgment being checked.

5. **AI-suggested risk becomes user-owned memory**
   - A risk surfaced by Argus later feels like something the user had already seen.

### 9.2 Argus Response Style

Argus should be active, but not heavy-handed.

Good pattern:

```text
이건 "맞았다"라기보다 "섞여 있음"에 가까워 보입니다.
초기 수요 가정은 맞았지만, 운영 부담 가정은 빗나갔습니다.
```

Good pattern:

```text
처음 기준은 DAU였는데, 지금 평가는 팀 리소스 기준으로 이동했습니다.
기준이 바뀐 건 나쁜 게 아니지만, 바뀐 이유를 남겨두는 게 좋습니다.
```

The tone should be:

- concise
- concrete
- non-accusatory
- focused on clarity

Do not say:

> 당신은 기준을 바꿨습니다.

Say:

> 기준이 이동했습니다. 이동한 이유를 남기면 다음 판단이 더 선명해집니다.

### 9.3 Ambiguity Should Be Structured

```ts
type AmbiguityReason =
  | 'insufficient_data'
  | 'mixed_signals'
  | 'low_confidence_interpretation'
  | 'changed_context'
  | 'wrong_checkpoint'
  | 'not_enough_time';

type AmbiguityRecord = {
  reason: AmbiguityReason;
  note?: string;
  next_handle?: string;
  revisit_after?: string;
};
```

"Unknown" should not be a dead end. It should become a lighter next checkpoint.

Example:

```text
아직 판단하기 어렵다
이유: 결과가 섞여 있음
다음 손잡이: 고객 반응 5건이 더 쌓인 뒤
```

## 10. Active Feedback After Recording

This is where the user feels efficacy.

After the user records a result, Argus should not merely say "saved." It should give one small reflection that makes the judgment clearer.

The feedback must be grounded in what was just checked. It should not invent a grand personality profile from one event.

### 10.1 Feedback Shape

```text
기록됐습니다.

이번 체크에서 넓어진 시야:
[one concrete contrast between original judgment and observed signal]

다음 비슷한 판단에서 Argus가 먼저 볼 것:
[one future attention point]
```

### 10.2 Good Examples

Example 1:

```text
기록됐습니다.

이번 체크에서 넓어진 시야:
처음엔 수요가 핵심이라고 봤지만, 실제 병목은 반복 운영 비용에서 나타났습니다.

다음 비슷한 판단에서 Argus가 먼저 볼 것:
도입 의향보다 운영 부담과 유지 비용.
```

Example 2:

```text
기록됐습니다.

이번 체크에서 넓어진 시야:
우려했던 CFO 반응은 맞았지만, 실제 질문은 비용 총액보다 통제 가능성에 가까웠습니다.

다음 비슷한 판단에서 Argus가 먼저 볼 것:
예산 규모보다 리스크 통제 장치.
```

Example 3:

```text
기록됐습니다.

이번 체크에서 넓어진 시야:
처음 기준은 DAU였지만, 판단의 중심이 팀 리소스로 이동했습니다.

다음 비슷한 판단에서 Argus가 먼저 볼 것:
사용량 지표와 운영 여력 기준이 서로 충돌하는 지점.
```

### 10.3 What to Avoid

Avoid overfitted identity claims:

```text
당신은 항상 운영 리스크를 과소평가합니다.
```

Prefer frequency-bounded pattern language:

```text
최근 몇 번의 판단에서는 운영 부담이 뒤늦게 커진 경우가 있었습니다.
```

Avoid fake certainty:

```text
이제 당신의 판단력은 향상됐습니다.
```

Prefer observed improvement:

```text
이번 기록은 다음 판단에서 운영 부담을 더 일찍 보게 만드는 근거가 됩니다.
```

## 11. Growth Feedback

The user should feel their judgment muscle developing, but Argus must not force a growth narrative where the evidence is thin.

### 11.1 Levels of Feedback

For 1 settled checkpoint:

> 이번 체크에서 새로 보인 것: [single concrete insight].

For 2-4 settled checkpoints:

> 최근 기록에서 반복되는 신호: [one cautious pattern].

For 5+ settled checkpoints:

> 지금까지의 판단 패턴: [strength] / [watch area] / [next focus].

### 11.2 Growth Note Model

```ts
type GrowthNote = {
  scope: 'single_check' | 'emerging_pattern' | 'established_pattern';
  widened_view: string;
  future_attention: string;
  confidence: 'low' | 'medium' | 'high';
  evidence_count: number;
};
```

### 11.3 Confidence Rules

- One checkpoint can produce an insight, not a trait.
- Two to four checkpoints can produce an emerging pattern.
- Five or more checkpoints can produce a more stable pattern, but still with humility.

Good:

> 이번 기록에서는 "수요"보다 "운영 부담"이 더 중요한 변수로 드러났습니다.

Good:

> 최근 3개 기록에서는 이해관계자 반응이 예상보다 늦게 드러나는 경향이 있습니다.

Bad:

> 당신은 이해관계자 리스크에 약합니다.

## 12. UI Placement

### 12.1 At the End of Current Course

Show the checkpoint as a distinct card, not a footnote.

```text
판단 체크포인트

나중에 다시 볼 기준:
첫 고객 5명 중 3명 이상이 설명 없이 핵심 행동을 완료하지 못하면,
방향 문제가 아니라 온보딩 문제로 먼저 다룬다.

왜 이 기준인가:
이번 판단은 "기능 가치가 충분한가"와 "사용자가 그 가치를 이해하는가"를 분리해야 하기 때문.

[이 기준으로 남기기] [수정] [이번엔 남기지 않기]
```

### 12.2 Return Inbox

There should be a "today's due checkpoint" surface. A command alone is too weak.

```text
다시 볼 판단 1개

그때의 판단:
...

다시 볼 기준:
...

[지금 확인] [나중에] [더 이상 볼 필요 없음]
```

### 12.3 After Check

```text
기록됐습니다.

이번 체크에서 넓어진 시야:
...

다음 비슷한 판단에서 Argus가 먼저 볼 것:
...
```

This is the payoff moment. It must be short.

## 13. Data Model Draft

```ts
type CheckpointStatus =
  | 'open'
  | 'due'
  | 'checked'
  | 'deferred'
  | 'void';

type CheckpointResult =
  | 'mostly_held'
  | 'missed'
  | 'mixed'
  | 'unclear';

type CheckSignal = {
  kind: 'date' | 'event' | 'metric' | 'reaction' | 'evidence' | 'reflection';
  label: string;
  source?: string;
  threshold?: string;
  examples?: string[];
};

type DueHint = {
  kind: 'date' | 'event' | 'after_more_evidence' | 'manual';
  value?: string;
  copy: string;
};
```

Important:

- `due_hint` should not always be a date.
- `threshold` should not always be numeric.
- `result` should not imply objective truth.
- Store whether the checkpoint was AI-suggested, user-edited, or user-authored.

```ts
type CheckpointAuthorship =
  | 'ai_suggested'
  | 'user_edited'
  | 'user_authored';
```

This matters because AI-surfaced risks should not later be mistaken for the user's original foresight.

## 14. Implementation Principles

1. **One primary checkpoint per decision**
   - Argus may detect many risks, but the return loop should focus on one.

2. **Do not force a checkpoint**
   - Some small decisions are not worth tracking.

3. **Prefer a handle over a date**
   - Dates are valid only when they are natural.

4. **Unknown is a valid state**
   - Make it easy to defer honestly.

5. **Feedback must be grounded**
   - Never inflate one check into a personality claim.

6. **Track ambiguity**
   - A mixed or unclear result is not failure. It is useful judgment data.

7. **Use checkpoint history as reference, not directive**
   - Future prompts may say "참고: ..." but must not overrule the current content.

8. **Keep settle under 30 seconds**
   - If it takes longer, users will avoid it or answer carelessly.

## 15. Anti-patterns

### Fake rigor

```text
Every checkpoint must have a date, metric, and threshold.
```

Why bad:

- Produces mechanical predictions.
- Encourages false precision.

### Moralized settling

```text
You failed to settle 3 decisions.
```

Why bad:

- Creates guilt.
- Reduces honest return.

### Over-personalized coaching

```text
You are bad at adoption forecasting.
```

Why bad:

- Feels accusatory.
- Usually not supported by enough data.

### Ambiguity collapse

```text
Partial result forced into held/missed.
```

Why bad:

- Pollutes the calibration record.
- Teaches the user to lie to the system.

## 16. Product Success Criteria

Do not measure this only by number of checkpoints created.

Better metrics:

- checkpoint creation rate after meaningful decisions
- checkpoint edit rate before saving
- due checkpoint return rate
- honest ambiguity rate
- defer-to-check completion rate
- second settled checkpoint rate
- number of future analyses using settled history as reference
- user-reported sense of "I saw the decision more clearly afterward"

Qualitative question:

> Did checking this judgment make you see something you had not seen at the time?

## 17. Open Questions

1. Should `standard` and `drift` be separate user-visible types, or only internal categories?
2. How much of the growth note should appear immediately versus in `/argus:log`?
3. When a user repeatedly chooses "unclear," when should Argus suggest voiding the checkpoint?
4. Should a checkpoint be editable after saving, and if so, how do we preserve the original standard?
5. What is the minimum schema change needed to support authorship, ambiguity, and growth notes without destabilizing existing settle code?

## 18. Recommended Next Step

Prototype this in one narrow path:

1. Rename user-facing "Decision Contract" copy to "판단 체크포인트."
2. Generate one checkpoint per Current Course.
3. Add type inference for the five checkpoint types.
4. Add a quality review that suggests revisions instead of blocking.
5. Add settle states: mostly held / missed / mixed / unclear.
6. Add one grounded growth note after recording.

The first version should prove one thing:

> Does returning to a past judgment make the user feel their judgment became clearer?

If yes, Argus has a real loop. If no, the checkpoint is just another artifact.

