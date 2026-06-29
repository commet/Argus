# Argus Final Direction

Date: 2026-06-10

## One Sentence

Important decisions should not end as answers. Argus keeps them alive as courses
until reality can answer.

It is not a multi-agent showcase, a generic risk machine, or a prettier ChatGPT
answer. The product is a decision voyage: clarify the destination, gather crew
work, preserve forks, verify claims, choose the current direction, and leave behind
an auditable log that can later be checked against reality.

## What Argus Sells

Argus sells the feeling of:

> "I know where this decision currently stands, why that bearing is justified,
> what remains foggy, what path I am not taking, and what must happen next."

That is broader than "make my decision less risky" and broader than "find my
hidden assumptions." Risk reduction and assumption-finding are effects. The more
complete promise is that a decision becomes a living course: a durable state with
forks, checked claims, current direction, and a future reality check. A good Argus
run should give the user current coordinates inside a decision that might
otherwise blur into analysis, advice, and second thoughts.

## Product Identity

Argus is a navigation harness for judgment.

- **The user is the captain.** Argus never pretends to decide for them.
- **Agents are crew, not the product.** They do work in the background, but the
  user should not have to admire the machinery.
- **The voyage is the artifact.** The process matters because it records how the
  conclusion was reached, which alternatives were abandoned, and which claims
  were verified.
- **Verification is a compass, not a scoreboard.** The point is not to produce a
  claim count. The point is to stop unsupported fluency from becoming a false
  bearing.
- **The decision contract closes the loop.** When a decision reaches anchor, it
  should leave behind falsifiable predicates that can later be graded against
  reality.

### The Zero-Judgment Invariant (internal engine, not signboard)

`maximum generation, zero judgment.` Argus uses AI's generative power maximally
and its *judging* power at zero. Every new surface must pass one gate:

> **Does this feature generate, or does it judge? If it judges the user's
> decision — or narrates ownership in the user's stead — it violates the spine.**

This is the load-bearing form of three findings (see
`docs/ESSAY-IMPLICATIONS-judgment-ownership-2026-06-15.md`):

- **Verification is not a chat.** A reviewer who verifies inside the same window
  becomes the model's second persuasion target. Argus's answer is structural and
  already shipped — it runs *before* you hand work to an AI, `watch` reads *past*
  transcripts, and `settle` lets *reality* judge later. No conclusion is verified
  by debating the model in-frame.
- **Never mint ownership the user did not author.** A machine-surfaced sentence
  must never silently inherit a user-owned label (`real_bet`, `governing_idea`).
  The invariant is *"never lie about who authored it,"* **not** *"never let them
  leave without typing."* Friction escapes stay; provenance must be honest.
- **Do not surface an uncalibrated verdict about who the user is.** No AI-authored
  sentence may grade the user's vitality, rigidity, or judgment quality to their
  face. Meaning is shown as the user's own re-said words and the settled record —
  never a score standing in for felt ownership.

Keep this as an **engine** (a builder-facing gate), not a **signboard** (landing
copy that lectures users about epistemics). Demonstrate orientation; do not
narrate the theory.

## The Surface Principle

The default surface must be compressed, but not shallow.

The user should not see "4 agents finished, 7 claims verified, boss review
complete" as the main product. That reads like a complex multi-agent system.

The user should see a **Current Bearing**:

```text
## Argus - Current Bearing - v0.1

Current course: proceed with a 4-hour migration spike, not full consolidation.

Why this course:
- The product-identity upside is real, but cost savings alone do not justify the move.
- The plugin/webapp depth gap is still unproven from current usage data.

Fog / reef: "plugin Boss can match webapp depth in 6 months" has no evidence yet.

Road not taken: full consolidation now. It would spend migration cost before proving surface demand.

Next helm: pull DAU split by surface, then run the spike.

Contract seed: if plugin DAU is below X after 30 days, do not absorb the webapp path.

Details: .argus/sessions/.../versions/v0.1/
```

This is different from a normal ChatGPT answer because it is not just advice.
It is tied to session artifacts, source references, verified and challenged
claims, fork history, and a future check.

## Webapp And Plugin Roles

The webapp owns the rich voyage experience:

- visual progress through origin, briefing, crew, review, mix, and anchor,
- branch/fork/switch/anchor interactions,
- ship's log and exportable history,
- decision contract sealing and later grading,
- a guided UX for users who want to stay inside Argus.

The plugin owns the work-environment experience:

- reads files, PRs, branches, repo state, and local documents from the user's
  actual workspace,
- runs crew work where the user already works,
- uses terminal-native choice gates only when the choice is meaningful,
- writes `.argus/sessions/` artifacts that can travel with git,
- returns one Current Bearing instead of a workflow transcript.

They do not need identical UI. They need identical product truth: Argus is a
decision voyage with memory, verification, forks, and eventual reality checks.

## Plugin Direction

The plugin should be optimized for people who ask from inside a working folder:

```text
/argus:sail @PR#123
/argus:sail @docs/strategy.md
/argus:sail "Should this feature live in the plugin or webapp?"
```

For low-density decisions, it can return a minimal scaffold and stop.

For important decisions, the plugin should:

1. Clarify the destination and decision weight.
2. Use crew agents as workers on the actual artifact or decision.
3. Verify supported, challenged, unresolved, and human-required claims.
4. Optionally run stakeholder review.
5. Render a Current Bearing.
6. Preserve the full voyage in `.argus/sessions/`.
7. Offer revision, branch, promote, or contract-seed next steps without making
   those controls feel mandatory.

## Quality Bar

Argus is good when:

- the user can act from the first screen,
- the user can tell it read their actual material,
- uncertainty is small and named, not spread everywhere,
- the next action is concrete,
- abandoned alternatives are remembered,
- the result can be revisited later without reconstructing the whole argument,
- the product feels calm, exact, and useful rather than impressive.

Argus is failing when:

- it sells "multi-agent orchestration" as the visible value,
- it returns a long report that the user has to summarize again,
- it gives a recommendation without a road-not-taken,
- it hides a human-required check inside polished language,
- it treats verification as a score instead of a navigation aid,
- it produces advice that cannot later be checked.

## Naming Contract

Use these names consistently:

- **Voyage**: the whole decision journey.
- **Crew**: agents doing real work.
- **Navigator**: the synthesizer that turns crew work into a bearing.
- **Current Bearing**: the one-screen default output.
- **Fork / Branch**: an alternate course.
- **Anchor**: the moment a draft is promoted or sealed.
- **Decision Contract**: falsifiable predicates left behind for later grading.
- **Ship's Log**: the durable record of what happened and why.

Do not center these names:

- SurfaceCard
- agent panel
- boss verdict
- risk reducer
- claim scoreboard
- workflow report

They can exist internally, but they should not be the product's visible center.

