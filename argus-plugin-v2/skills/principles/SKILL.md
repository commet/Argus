---
name: principles
description: Turn a recurring structure in your OWN settled decisions into a principle you author. Argus surfaces the pattern from `.argus/ledger/` (the hard synthesis across scattered voyages) and asks "is this yours?"; if you ratify it, it is recorded in YOUR words in `.argus/principles.md` — tagged authored:user, never a machine verdict. This is the ratify half of the learning loop (settle records outcomes; principles lets you codify what recurs). Use when the user says "내 원칙 정리", "이 패턴 원칙으로 남겨줘", "codify this", "what have I learned across these decisions", or after /argus:journal --insights surfaces something worth keeping. Requires ≥3 settled contracts. Invoked as `/argus:principles`.
---

# /argus:principles

**What this skill does:** Reads the settled contracts in `.argus/ledger/`, surfaces
the recurring *structure* across them as evidence, and — only if the user ratifies
it — records it as a principle **in the user's own words** in `.argus/principles.md`.

**Why this matters:** `/argus:journal` shows the record honestly but is read-only —
it never lets you *keep* what you learned. This skill closes Dalio's loop
("structure repeated experience into a rule") with one hard rule that the old
`patterns` skill broke: **the machine does the synthesis (finding the structure
across scattered voyages — the part a person can't easily do); the user does the
authorship (deciding it is a principle and how it is phrased).** A machine that
writes the principle *for* you is a verdict adopted without being tested — the
exact failure Argus exists to fight. So Argus surfaces and asks; it never
declares.

**Default behavior:** read-only until the user explicitly ratifies. Writes ONLY
on an explicit "맞아요 / yes". Locale from `.argus/config.yaml` (`config.locale`);
English templates below, render naturally in ko.

---

## When to run

- The user says "내 원칙 정리 / 이 패턴 원칙으로 / codify this / what have I
  learned here".
- `/argus:journal --insights` surfaced an observation the user wants to keep.

Refuse (always say what to do next, never a bare halt):

- No `.argus/ledger/ledger.jsonl`, or **fewer than 3 settled contracts** → there
  is not enough settled reality to draw a principle from yet. Say exactly that
  and point to `/argus:resolve` (to settle what's due) or `/argus:sail` (to start
  a decision): "정산된 결정이 아직 {{T}}건이에요 — 원칙을 세우기엔 일러요 (3건부터).
  정산할 게 있으면 /argus:resolve."

---

## Step 1 — Gather settled reality (mechanical, no LLM)

1. Replay `.argus/ledger/ledger.jsonl` by `id` (`seal` opens, `amend` updates,
   `settle`/`dismiss` closes; skip unparsable lines — defensive-parse, never
   crash). Keep only **settled** contracts (status `settled`, with an `outcome`).
2. For each settled contract keep VERBATIM: `predicate`, `outcome`
   (happened/avoided/partial), `basis` (reasoned/luck/external, if present),
   `author` (user / absent=AI-surfaced), and any fog/reef tag. **Do not re-infer
   or relabel a tag** — the ledger tag is ground truth (a `luck` win is not a
   skill win; an AI-surfaced seed is not the user's bet).
3. Read the existing `.argus/principles.md` if present → the user's current
   principles, so you never propose one they already hold (dedupe by meaning).

## Step 2 — Compute claim strength (mechanical — gate BEFORE any LLM)

Mirror `/argus:journal` exactly so the two surfaces can't disagree. `T` = settled
count; `domains` = distinct decision domains they span.

- `T < 3` → **refuse** (Step "When to run"). Never manufacture a principle.
- `3 ≤ T ≤ 5` → `counts_only`
- `6 ≤ T ≤ 10` → `tendency`
- `T ≥ 11` → `rule`

Then **downgrade one level (never above `counts_only`) when the settles are
scattered** — `domains` high relative to `T`. Scattered settles are a thin
record, not a pattern. This number, not the model's judgment, caps how strong a
candidate Step 3 may raise.

## Step 3 — Surface candidates as EVIDENCE (not verdicts)

Produce **at most 2** candidate structures, each grounded in SPECIFIC settled
entries, phrased at the strength Step 2 allows:

- ✓ "3 of your 4 held bets were ones where you named the risk before sealing —
  [entry A], [entry B], [entry C]." — structure + citations, no interpretation.
- ✗ "You're a disciplined risk-namer." — a verdict about who they are. Forbidden.
- ✗ "So you should always name risks first." — a prescription. Forbidden.

Quarantine, never drop: if a candidate has a counterexample or a `luck` /
AI-surfaced entry among its support, keep it visible ("4건 중 1건은 본인이 운으로
표시"). A cleaner claim bought by hiding an entry is the over-claim a skeptic breaks.

**If nothing genuinely recurs** (every settle is a one-off, or Step 2 downgraded
for scatter): say so in one line and stop — "아직 원칙으로 삼을 만큼 반복되는 건
안 보여요 (정산 {{T}}건 · {{domains}} 영역) — 더 쌓이면 같이 봐요." Manufacturing a
principle on a thin record is a spine violation, not thoroughness.

## Step 4 — Ratify (the authorship stays with the user)

For each candidate (max 2), one `AskUserQuestion` — neutral, a question never a
nudge:

- Title: `Your principle?` (ko: `당신의 원칙?`)
- Question: present the one-line evidence, then ask:
  `이런 게 반복돼요: "{{evidence}}". 이걸 당신 원칙으로 삼을까요?`
- Options:
  - `맞아요 — 원칙으로 기록` → ratified
  - `맞는데 내 말로 다듬을게요` → ratified, but the user supplies the wording
  - `아니에요` → discard; note the read was off (this calibrates the *tool*)
  - `잘 모르겠어요` → leave open; resurface after more settles

**On `맞아요`:** the recorded text is the neutral structure the user confirmed —
NOT a machine-authored imperative. **On `다듬을게요`:** take the user's wording
verbatim as the principle text (this is the purest authorship — prefer it when
offered). Either way the record is tagged `authored: user`.

## Step 5 — Record (write ONLY what was ratified)

Append each ratified principle to `.argus/principles.md` (create it with the
header below if absent). Never rewrite or delete an existing entry — the file is
the user's; revising a principle is the user editing their own file (Dalio's
"principles get revised too"). Format:

```markdown
# Principles — {{project dir name}}

_My own rules, drawn from my settled decisions. I wrote these; Argus surfaced the
pattern and I ratified it. I edit this file freely — a principle that stops
matching reality gets changed._

---

- {{date}} · {{principle text — user's wording, or the confirmed structure}}
  - drawn from: {{cited settled entries}} · settled {{T}} · strength {{counts_only/tendency/rule}}
  - authored: user
```

Then print one quiet confirmation line (locale): "기록했어요 — 당신 원칙이에요,
언제든 이 파일을 직접 고치면 돼요 (.argus/principles.md)." Nothing else.

---

## Meta-check gates

- **Machine surfaces, user authors.** Argus may state the recurring structure; it
  may NOT write the principle as its own conclusion. The imperative wording, if
  any, comes from the user.
- **Ratify before write.** Nothing is recorded without an explicit `맞아요` /
  wording from the user. No silent writes.
- **Strength bound to settled count.** A 3-5-settle candidate is counts-only —
  no "rule", no "always", no mechanism, no direction.
- **Reality is the source.** Principles draw only from *settled* contracts, never
  from unsettled predictions or self-graded DQ scores.

## Forbidden patterns

- Declaring who the user is ("you are an X decider") — even as a "profile".
- Prescribing the next move ("always do X") in Argus's own voice.
- Manufacturing a principle from fewer than 3 settled contracts, or from a
  scattered/one-off record.
- Dropping a counterexample, `luck`, or AI-surfaced entry to state a cleaner rule.
- Writing anything before the user ratifies.
