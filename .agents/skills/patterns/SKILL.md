---
name: argus-patterns
description: "Analyze your decision-making patterns from the Argus journal. Shows strengths, recurring blind spots, DQ score trends, and personalized growth insights. Use after 3+ runs to get meaningful patterns."
allowed-tools: Read
---

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

**3. DQ trajectory**
If multiple /argus runs exist, show the score trend with attribution. What's improving and why.

**4. Thinking profile**
A one-paragraph characterization of their decision-making style based on signal patterns, assumption ratings, and strategy preferences. E.g., "You're an analytical thinker who prefers structured approaches (nature=needs_analysis in 70% of runs). You tend to be cautious with assumptions (60% rated uncertain) which gives you thorough analysis but may slow decision speed."

**5. Growth recommendation**
One specific, actionable suggestion for their next run. Not generic advice but tailored to their pattern data.

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

**Your thinking profile**

[one paragraph characterization]

---

**Next run**

> 💡 [specific, actionable recommendation]

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
| 3-5 | 초기 인상 | "~로 보인다", "초기 패턴" | Frequency counts only. No trends. No profile. |
| 6-10 | 패턴 형성 | "~하는 경향", "반복 확인" | Trends visible. Blind spots if 3+ occurrences. Profile tentative. |
| 11-20 | 패턴 확인 | "일관된 패턴", "강점 확인" | Full analysis. DQ trajectory meaningful. Profile confident. |
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
- **The thinking profile is descriptive, not prescriptive.** Don't tell them to change their style — describe it and note its trade-offs.
