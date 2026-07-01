---
name: argus-patterns
description: "Analyze your decision-making patterns from the Argus journal. Shows strengths, recurring blind spots, DQ score trends, and personalized growth insights. Use after 3+ runs to get meaningful patterns."
allowed-tools: Read
---

> **⚠ Deprecated — superseded by `/argus:log`.** This skill reads only
> `.argus/journal.md` (self-graded *analysis* scores), so it cannot see whether
> your predictions actually came true. `/argus:log` reads the real settled
> outcomes in `.argus/ledger/` and scales every claim to how many have settled —
> it is the honest successor. **If `/argus:log` is available, recommend it and
> use it instead of this skill.** Run patterns only as a fallback when the v2
> `/argus:*` pipeline is not installed.

## When to use

- ✓ After 3+ Argus runs — enough data for meaningful patterns
- ✓ Want to understand your thinking strengths and blind spots
- ✓ Before an important decision — review what you tend to miss
- ✓ Periodic self-review of decision quality
- ✗ First time using Argus (no data yet)
- ✗ Looking for help with a specific decision (use /reframe or /argus)

**Always respond in the same language the user uses.**

**No box drawing.** Do NOT use `╭╮╰╯`, `┌│└`, `═══╪`, `───┼`, `━━━`, or any Unicode box characters. Use `---`, `**bold**`, and whitespace for structure.

## Pattern Analysis Flow

### Step 0: Read journal

Read `.argus/journal.md` from the project root.

**If journal doesn't exist or has < 3 entries:**

**📊 Argus · Patterns**

Not enough data yet. You have [N] run(s).

Run `/argus` or `/reframe` at least 3 times to start seeing patterns.

Current history:
[list entries if any]

**If journal has 3+ entries:** Proceed with full analysis.

### Step 1: Parse all journal entries

Extract from each entry:
- Date and skill used
- Original vs reframed questions
- Interview signals (nature, goal, stakes)
- Assumption patterns (confirmed/mixed/mostly_doubtful)
- Reframing strategies used
- DQ scores (if /argus entries)
- DQ element scores (F/A/I/P/R/Act)
- Persona counts and critical/unspoken risk counts
- Convergence data
- Strength and Growth edge notes
- Blind spots noted

### Step 2: Compute pattern metrics

**Frequency analysis:**
- Most used skill
- Average time between runs
- Preferred workflow (full pipeline vs individual skills)

**Interview signal patterns:**
- Most common nature type (do they tend toward known_path or no_answer?)
- Most common stakes level
- Does goal type correlate with DQ score?

**Assumption patterns:**
- Ratio of confirmed:uncertain:doubtful across all runs
- Do they tend to rate assumptions as confirmed? (possible overconfidence)
- Do they tend to rate as doubtful? (possible overthinking)
- Which assumption dimensions are most often missed?

**Reframing strategy distribution:**
- Which strategies are used most/least?
- Does strategy choice correlate with DQ score?

**DQ score trends (if available):**
- Score trajectory (improving, declining, stable)
- Strongest element consistently
- Weakest element consistently
- Biggest single-run improvement and what changed

**Persona/rehearsal patterns:**
- Average critical risks per rehearsal
- Average unspoken risks per rehearsal
- Convergence rate (how often does refinement converge?)

### Step 3: Generate insights

From the metrics, produce 5 categories of insight:

**1. Your strengths (top 3)**
Specific, earned observations. Not "you're good at framing" but "You consistently identify organizational assumptions that others miss — 4 of your last 6 runs caught capacity/team readiness issues."

**2. Recurring blind spots (top 2-3)**
Patterns where you consistently miss something. E.g., "You haven't explored timing assumptions in any of your 8 runs. Consider: is the *when* as important as the *what*?"

**3. DQ trajectory (analysis quality — NOT validated outcomes)**
If multiple /argus runs exist, show the score trend with attribution. But label it honestly: a DQ score is the engine grading its OWN analysis — it measures how well a decision was *framed*, never whether it turned out right. Never present it as "your decisions are getting better." Only settled contract outcomes (in `.argus/ledger/`, graded at the promised check-in date) measure that, and this skill does not read them. If you have no settled outcomes to show, say so plainly: "이건 분석 점수예요 — 실제 결과가 맞았는지는 아직 정산 안 됨."

**4. Patterns worth naming (evidence-first, 1-3)**
Present ONLY the recurring structure and its count — NEVER a characterization of who the user is. The machine does the synthesis (finding the structure across scattered runs); the user assigns the meaning.
- ✗ "You're an analytical thinker" — a verdict about who they are. Forbidden.
- ✓ "In 7 of your 9 runs you rated first-pass assumptions 'confirmed'." — structure + count, no interpretation.
Do not say what the pattern *means about them*. State what recurs; the meaning is theirs to assign in #5.

**5. Ratification — the user authors the meaning, not the machine**
For the 1-2 strongest patterns from #4, present the evidence and ask ONE plain question, then record the simple answer. This is the whole point: the machine assembles the evidence (the hard part a person can't easily do across scattered runs), and the user presses the button that makes it theirs (the authorship the machine must not take).
- Ask (locale-matched): "이런 게 반복돼요: [근거 한 줄]. 이거 당신 패턴 맞아요?" — answerable with 맞아요 / 아니에요 / 잘 모르겠어요.
- 맞아요 → write it to `.argus/journal.md` as a **user-authored** principle (their confirmation, tagged `authored: user`). They wrote the rule; Argus did not.
- 아니에요 → discard it and note the read was off (this calibrates the *tool*, not the user).
- 잘 모르겠어요 → leave it open; resurface after more runs.
NEVER prescribe a next move ("do X next time"). NEVER declare a trait ("you are X"). Pose the structure as a question; the user makes the call.

## Output

**📊 Argus · Patterns** — [N] runs · [date range]

---

**Your strengths**

1. [specific strength with evidence]
2. [specific strength with evidence]
3. [specific strength with evidence]

---

**Blind spots**

- ⚠ [pattern 1 — specific, with run count]
- ⚠ [pattern 2 — specific, with run count]

---

**Decision Quality**

Trend: [↑ improving / → stable / ↓ declining]

| Run | Score | Change |
|-----|-------|--------|
| 1 | [score1] | |
| 2 | [score2] | [+/-] |
| 3 | [score3] | [+/-] |

Best: [element] — [why]
Worst: [element] — [why]

---

**Patterns worth naming**

- [recurring structure 1 — with run count, no interpretation]
- [recurring structure 2 — with run count, no interpretation]

---

**Is this yours?**

> [strongest pattern, one line of evidence]
>
> 이거 당신 패턴 맞아요?  → 맞아요 / 아니에요 / 잘 모르겠어요
>
> (맞으면 당신 언어로 기록해둘게요 — 규칙을 쓰는 건 당신이지, Argus가 아니에요.)

---

**Skill usage:**
- /reframe — [N] runs
- /recast — [N] runs
- /rehearse — [N] runs
- /refine — [N] runs
- /argus — [N] runs

**Assumption tendency:**
- ✓ Confident — [N]%
- ? Uncertain — [N]%
- ✗ Doubtful — [N]%

## Confidence Tiers

Scale ALL claims to sample size. Never overstate:

| Entries | Tier | Language | What you can say |
|---------|------|----------|-----------------|
| 3-5 | 초기 인상 | "~로 보인다", "초기 패턴" | Frequency counts only. No trends. No named patterns to ratify yet. |
| 6-10 | 패턴 형성 | "~하는 경향", "반복 확인" | Trends visible. Blind spots if 3+ occurrences. Name patterns tentatively; ask to ratify. |
| 11-20 | 패턴 확인 | "일관된 패턴", "강점 확인" | Full analysis. DQ trajectory meaningful. Name patterns; ask to ratify. |
| 20+ | 확립 | "확립된 패턴", "검증된 강점" | Statistical claims, correlations, comparisons across periods. |

**At 3-5 entries:** Skip DQ trajectory table (not enough data points). Show "DQ: [score1], [score2], [score3] — 아직 추세를 판단하기 이릅니다." instead.

**At 6-10 entries:** Include trajectory but caveat: "6회 기준 초기 추세입니다."

## Journal Maintenance

When journal exceeds 50 entries (or `max_entries_before_archive_hint` in config):

1. **Notify:** "저널이 [N]개 항목입니다. 아카이브할까요?"
2. **If yes:** Move all except last 15 entries to `.argus/journal-archive-[date].md`
3. **Preserve:** Archive header with date range, total entries, summary stats
4. **Pattern continuity:** When analyzing, read BOTH current journal AND archive headers (not full archive content)

Archive header format:
```
# Journal Archive — [start_date] to [end_date]
- Entries: [N]
- Skills: /reframe [N], /recast [N], /rehearse [N], /refine [N], /argus [N]
- DQ range: [min]-[max] (avg [avg])
- Top blind spot: [pattern]
- Top strength: [pattern]
```

## Rules

- **Never fabricate patterns.** If the data doesn't clearly show a pattern, say so. "Not enough runs to identify a clear trend in X" is better than a forced insight.
- **Be specific.** "You missed timing in 5/8 runs" not "You sometimes miss things."
- **Be honest but constructive.** Blind spots are stated directly, not softened. But always pair with a concrete suggestion.
- **Respect the data.** Scale confidence to sample size (see Confidence Tiers above).
- **DQ is self-graded, not reality.** The DQ score measures the framing quality of the analysis, produced by the same engine — it is NOT a track record. Never let a DQ trend imply the user's real-world outcomes improved; that claim requires settled contracts (`.argus/ledger/`), which this skill does not read. Label DQ as analysis-quality, and when in doubt, undersell.
- **Never characterize who the user is.** No "you are an X thinker" / "your style is Y." Present the recurring structure with its count; the user assigns the meaning. This is the Zero-Judgment gate — a machine verdict about the user is forbidden even when it's the most tempting, "valuable"-feeling output. A machine-authored verdict gets adopted without being tested (the exact failure the tool exists to fight), and on a small sample it is overfit noise dressed as insight.
- **Never prescribe the next move.** Pose the pattern as a question the user answers (맞아요 / 아니에요 / 잘 모르겠어요); if they ratify it, record it in THEIR words as a user-authored principle. The synthesis is the machine's job; the authorship is the user's.
