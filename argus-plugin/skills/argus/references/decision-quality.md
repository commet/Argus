# Decision Quality Framework

Based on Spetzler, Winter & Meyer (2016): "A good decision is not the same as a good outcome."

DQ measures the quality of the thinking PROCESS, independent of results. A well-structured decision can still fail (bad luck), and a sloppy decision can succeed (good luck). Over time, better process → better outcomes.

## 6 Elements (0-5 each)

### 1. Framing (Did we ask the right question?)

| Score | Criteria |
|-------|----------|
| 0 | Original question unchanged |
| 1 | Minor rewording |
| 2 | Assumptions found but not incorporated into reframe |
| 3 | Meaningful reframe based on assumption analysis |
| 4 | Reframe synthesizes multiple dimensions (purpose, timing, boundaries, problem type) |
| 5 | Genuinely surprising reframe — "I never thought about it that way" |

### 2. Alternatives (Did we explore options?)

| Score | Criteria |
|-------|----------|
| 0 | Single path, no alternatives |
| 1 | One alternative mentioned |
| 2 | Multiple alternatives without comparison |
| 3 | 3+ hidden questions pointing in different directions |
| 4 | Explicit tradeoffs between alternatives |
| 5 | Creative alternative that breaks the original frame |

### 3. Information (Do we know what we need to know?)

| Score | Criteria |
|-------|----------|
| 0 | No assumptions identified |
| 1 | Few assumptions, single dimension |
| 2 | Assumptions from 2+ dimensions but no risk-if-wrong |
| 3 | Assumptions across multiple dimensions with risk-if-wrong |
| 4 | Importance + confidence rated, validation plan exists |
| 5 | AI limitations identified, information gaps explicitly acknowledged |

### 4. Perspectives (Did we hear different voices?)

| Score | Criteria |
|-------|----------|
| 0 | No stakeholder input |
| 1 | Single perspective |
| 2 | Multiple but similar perspectives |
| 3 | 3+ diverse personas with different styles and risk profiles |
| 4 | Specific approval conditions from each stakeholder |
| 5 | Stakeholder conflicts identified with resolution approach |

### 5. Reasoning (Is the logic sound?)

| Score | Criteria |
|-------|----------|
| 0 | No iteration, feedback ignored |
| 1 | Feedback received but not addressed |
| 2 | Some feedback addressed, critical issues remain |
| 3 | Converged (0 critical issues after refinement) |
| 4 | Converged within 3 rounds, issues trending down |
| 5 | Fast convergence, minimal new issues introduced by changes |

### 6. Actionability (Can we actually execute this?)

| Score | Criteria |
|-------|----------|
| 0 | Direction only, no plan |
| 1 | Rough steps listed |
| 2 | Steps with owners assigned |
| 3 | Specific deliverables per step |
| 4 | Checkpoints + key assumptions + critical path |
| 5 | Above + design rationale + time estimates |

## Anti-Sycophancy Indicators

Measured separately from DQ score:

| Indicator | What it means |
|-----------|--------------|
| **Framing challenged** | Reframed question is qualitatively different from original |
| **Blind spots found** | At least 1 [unspoken] risk surfaced |
| **Plan revised** | The plan actually changed after stakeholder rehearsal |

### Calibration

- Standalone `/reframe` without further stages: expect 25-45
- Partial chain (reframe + rehearse): expect 45-65
- Full `/argus` pipeline: expect 65-85
- Above 85 requires genuine surprises — a reframe the user didn't expect, risks they hadn't considered

The full pipeline structurally guarantees a floor (~60) because it covers all dimensions. The value is in the **per-element breakdown** (which dimension is weak?) and the **anti-sycophancy indicators** (was there real pushback?), not the aggregate number.

### Warning condition

DQ ≥ 80 AND zero anti-sycophancy indicators = **suspicious**. High process score with no pushback suggests the analysis validated existing thinking rather than challenging it. Flag this explicitly.
