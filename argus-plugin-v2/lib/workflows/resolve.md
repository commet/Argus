---
name: resolve
description: Return to saved Argus records whose check date has arrived, show the original before controls, and append the user's answer without scoring it. Invoked through /argus:check.
---

# Internal resolve workflow

Argus returns the user's earlier sentence at a useful time. It does not decide
whether the user was right, good, successful, or improving.

## 0. Prefer the live wire, and never hide which one answered

If the Argus MCP tools are present in this session, call `argus_check_in` FIRST
(read-only) and use its `data.due` as the due list — the server replays the same
ledger plus bearing seeds, so a file-only read can silently disagree with what
the running build sees. Two facts from that response matter to the user and are
NOT visible anywhere else in this command:

- `data.server_version` — the build actually running. If it differs from the
  version the plugin pins, say so in ONE line and point at clearing the npx
  cache plus a session restart (this is the 12-silent-days failure class:
  the repo, npm, and the live wire disagreeing with nobody able to see it).
- `data.picker` — `card` (an MCP Apps settlement card renders), `one_tap`
  (a confirm form), or `text_fallback` (asks in chat). Mention it only when the
  user asks what they will see, or when a settlement is about to happen on a
  host that can only do `text_fallback`.

If the tools are NOT present, fall back to the file replay below and say so in
ONE short line ("MCP 미연결 — 파일 기록만 읽었습니다"), so a user never mistakes
an offline read for the live wire. Never fail the command over this; the file
path is a real answer, just a narrower one.

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

Sort oldest first and handle at most three. If MORE than three are due, say so
before starting — e.g. `{{n}} records are due; taking the three oldest first,
{{n-3}} remain for the next /argus:check.` — and repeat the remaining count in
the §6 report. Handling three of ten while sounding finished is a silent cap;
the user walks away believing settlement is done. (premises.md's "note if more"
is the same rule.)

If none are due, say:

`No records are due. Next check: {{date or "none"}}.`

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

Use the question and exact answer labels for the record kind:

- prediction — `같은 조건이 다시 와도 같은 판단을 하시겠어요? / Would
  you make the same call under the same conditions today?`
  - `같은 조건이라면 지금도 같은 판단을 하겠어요 / I would make the same
    call under the same conditions` → `same`
  - `지금이라면 판단 기준을 바꾸겠어요 / I would use a different standard
    now` → `changed`
  - `이 판단 기준은 더는 쓰지 않겠어요 / I would no longer use this
    standard` → `withdrawn`
  - `지금은 내 기준이 달라졌는지 모르겠어요 / I am not sure how my
    standard has changed` → `skipped`
- commitment — `같은 조건이 다시 와도 같은 약속을 하시겠어요? / Would you make the
  same commitment today?`
  - `지금도 같은 약속을 하겠어요 / I would make the same commitment today`
    → `same`
  - `지금이라면 약속의 조건을 바꾸겠어요 / I would change the terms of the
    commitment` → `changed`
  - `지금은 그 약속을 하지 않겠어요 / I would not make that commitment now`
    → `withdrawn`
  - `지금은 같은 약속을 할지 모르겠어요 / I am not sure whether I would
    make it again` → `skipped`
- declaration — `지금도 같은 기준을 따르시겠어요? / Would you follow the
  same standard today?`
  - `지금도 같은 기준을 따르겠어요 / I would still follow the same standard`
    → `same`
  - `지금이라면 기준을 바꾸겠어요 / I would use a different standard now`
    → `changed`
  - `그 기준은 더는 따르지 않겠어요 / I would no longer follow that
    standard` → `withdrawn`
  - `지금은 내 기준이 달라졌는지 모르겠어요 / I am not sure how my
    standard has changed` → `skipped`

Do not ask a third question. Free text is optional and only when the user
volunteers it.

## 5. Append the answer

Use the single writer. Choose `--reality` or `--commitment` from the first
answer's fixed mapping; never invent it from prose. The writer preserves that
first answer verbatim. If the follow-up is `same`, `changed`, or `withdrawn`,
the writer projects that explicit answer onto axis ②
(`maintained`/`revised`/`withdrawn`). If it is `skipped`, the first-answer
projection remains. This is deliberate: the later explicit standard is
authoritative, while the first selected sentence remains recoverable.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" settle <id> \
  --option "<canonical option id>" \
  --response "<selected label verbatim>" \
  --reality met|not_met|partial|unknown|not_observable \
  --question-validity valid|narrowed|reframed|moot|indeterminate \
  --present-standard same|changed|withdrawn|skipped \
  --present-standard-response "<selected follow-up label verbatim>" \
  --observation-source-kind user_report \
  --authorization-ref "plugin:resolve:<id>:confirmation"
```

For commitment/declaration, replace `--reality` with:

```bash
--commitment enacted|maintained|revised|withdrawn|superseded
```

If the user says the answer is not available yet and wants another date, record
an honest deferral (NOT an amend — a due record's date move is a deferral, and
the ledger must remember it so the eventual receipt can say "originally due X ·
deferred N×", exactly like the MCP surface's still_pending path):

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/decision-ledger.js" defer <id> \
  --to "<new YYYY-MM-DD>" \
  --authorization-ref "plugin:resolve:<id>:defer"
```

Never amend the sealed sentence or falsification condition. `amend` remains for
correcting a typo'd date BEFORE the record comes due; once due, the CLI refuses
it and points here.

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
