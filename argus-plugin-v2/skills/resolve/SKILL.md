---
name: resolve
description: Return to sealed Argus records whose fallback date has arrived, show the original sentence before any controls, ask one kind-appropriate question, and append the user's answer without scoring it. Invoked as /argus:resolve.
---

# /argus:resolve

Argus returns the user's earlier sentence at a useful time. It does not decide
whether the user was right, good, successful, or improving.

## 1. Collect due records mechanically

Replay `.argus/ledger/ledger.jsonl` by id:

- `seal` opens a record and supplies `kind`, `origin_utterance`,
  `review_condition`, `return_event`, and fallback `check_by`;
- `amend` changes only the active fallback date and preserves the earlier date;
- `settle` appends an answer;
- `dismiss` closes the active return.

Keep sealed, non-`witness` records whose ISO `check_by` is today or earlier.
Do not auto-import an unsealed `current_bearing.json` seed. A seed is an AI
proposal, not a human-authorized record.

Sort oldest first and handle at most three. If none are due, say:

`No records are due. Next return: {{date or "none"}}.`

## 2. Show the original before controls

For each due record show, in this order:

1. the seal date;
2. `origin_utterance` (fallback: `predicate`) verbatim;
3. `review_condition`, if answered;
4. the kind-appropriate question below.

Never lead with an AI summary or a verdict.

## 3. Ask one kind-appropriate question

Use one native `AskUserQuestion`. Record the selected option label verbatim.
Each list has no more than five choices and includes a moot exit.

### prediction — “실제로는 어떻게 되었나요?”

- `확인하려던 일이 일어났어요` → option `condition_met`, reality `met`, question `valid`
- `일어나지 않았어요` → `condition_not_met`, reality `not_met`, question `valid`
- `일부만 맞았어요` → `mixed`, reality `partial`, question `valid`
- `지금 자료로는 확인할 수 없어요` → `not_observable`, reality `not_observable`, question `indeterminate`
- `이 질문 자체가 더는 중요하지 않아요` → `moot`, reality `unknown`, question `moot`

### commitment — “그 약속은 지금 어떻게 되었나요?”

- `약속한 대로 실행했어요` → `enacted`, commitment `enacted`, question `valid`
- `아직 실행 전이지만 약속은 유지해요` → `maintained`, commitment `maintained`, question `valid`
- `상황을 보고 약속을 고쳤어요` → `revised`, commitment `revised`, question `reframed`
- `이 약속은 철회했어요` → `withdrawn`, commitment `withdrawn`, question `valid`
- `약속할 이유 자체가 사라졌어요` → `moot`, commitment `superseded`, question `moot`

### declaration — “그 기준을 지금은 어떻게 보고 있나요?”

- `지금도 이 기준을 유지해요` → `maintained`, commitment `maintained`, question `valid`
- `기준을 조금 바꿨어요` → `revised`, commitment `revised`, question `reframed`
- `이 기준은 더는 따르지 않아요` → `withdrawn`, commitment `withdrawn`, question `valid`
- `더 나은 기준으로 바뀌었어요` → `superseded`, commitment `superseded`, question `narrowed`
- `이 기준이 필요한 상황이 끝났어요` → `moot`, commitment `superseded`, question `moot`

Skip/cancel writes nothing.

## 4. Ask exactly one follow-up

Ask: `그때 세운 기준을 지금도 유지하나요? / Do you still hold the standard
you used then?`

- `그대로예요 / It is the same` → `same`
- `달라졌어요 / It has changed` → `changed`
- `그 기준은 거뒀어요 / I withdrew it` → `withdrawn`
- `지금은 답하지 않을래요 / Skip for now` → `skipped`

Do not ask a third question. Free text is optional and only when the user
volunteers it.

## 5. Append the answer

Use the single writer. Choose `--reality` or `--commitment` from the mapping
above; never invent the mapping from prose.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" settle <id> \
  --option "<canonical option id>" \
  --response "<selected label verbatim>" \
  --reality met|not_met|partial|unknown|not_observable \
  --question-validity valid|narrowed|reframed|moot|indeterminate \
  --present-standard same|changed|withdrawn|skipped \
  --observation-source-kind user_report
```

For commitment/declaration, replace `--reality` with:

```bash
--commitment enacted|maintained|revised|withdrawn|superseded
```

If the user says the answer is not available yet and wants another date, append
only a date change:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" amend <id> --check-by "<new YYYY-MM-DD>"
```

Never amend the sealed sentence or falsification condition.

## 6. Report without aggregation

For each completed return show:

```text
{{seal date}} · 그때 남긴 문장
“{{origin_utterance}}”

{{return date}} · 내 답
{{selected response}}
{{present-standard sentence}}
```

Say that the earlier sentence remains intact and another future answer would be
appended. Do not show held/missed totals, accuracy, hit rate, a score, a streak,
or a celebratory animation.

## Invariants

- The user supplies the authorial answer; Argus never infers it.
- `moot` and `not_observable` are honest first-class exits.
- An answer appends; it never rewrites the seal.
- A return does not automatically reopen the decision.
- Human, AI, and system observation sources remain explicit.
