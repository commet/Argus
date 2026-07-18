# Argus Brand Canon

Status: canonical product identity
Updated: 2026-07-18

## One Sentence

**Argus does not decide for you. It sees through the smooth surface, remembers
what you believed when you decided, keeps watch on the signals you chose, and
returns first when reality has an answer.**

Korean product voice:

> Argus는 답을 대신 내리는 개가 아니다. 겉모습 아래의 진짜 질문을 알아보고,
> 당신이 무엇을 믿고 결정했는지 잊지 않으며, 현실이 답할 때까지 곁을 지키고
> 약속한 날 먼저 돌아오는 나만의 충견이다.

## Meaning

The dog is not a decorative mascot and not an oracle. Its source is the loyal
hound who recognized Odysseus beneath a disguise after twenty years: memory,
recognition, and fidelity outlast appearances. The name also carries vigilance,
but Argus must never imply that it sees every fact or already knows the truth.

Argus embodies five existing product promises:

1. **Remember exactly.** Preserve the user's words, premises, prediction, and
   provenance without polishing the past.
2. **Notice beneath the surface.** Surface the hidden premise or real question,
   without choosing a side for the user.
3. **Keep watch honestly.** Track only the signals the user selected; disclose
   when monitoring, connection, or evidence is limited.
4. **Return first.** Come back on the promised date or when a watched premise
   materially changes.
5. **Stay without judging.** Reality answers, the user records, and Argus keeps
   the receipt. `AI VERDICT` remains `NONE`.

## Product States

Every mascot appearance must represent one of these states. Asset filenames,
poses, animation, and copy are implementation details of the state, not the API.

| State | Product meaning | Pose | Motion | Primary surfaces |
|---|---|---|---|---|
| `companion` | You can begin imperfectly; Argus will stay beside the work. | seated, relaxed, attentive | slow breathing only | first input, onboarding, true empty state |
| `witness` | Argus heard and will remember the user's promise. | upright, still, three-quarter gaze | one quiet acknowledgement | seal completion |
| `watching` | A long task or selected premise is being watched. | lying down, head raised, ears alert | slow breathing; one perk on a real signal | long wait, premise watch |
| `returning` | Argus kept the date and came back first. | direct recognition portrait | one arrival, never a loop | due notice, check-in, return email |
| `settled` | The loop is closed without grading the person. | warm direct gaze or seated rest | one soft settle | settlement, judgment receipt |

## Visual System

### Character anchors

- Charcoal, warm-white, and muted-copper coat
- Upright ears and amber-gold eyes
- Deep blue-gray collar
- Matte-brass shield tag
- Natural canine anatomy and restrained expression
- Editorial gouache and colored-pencil observation drawing, not cartoon rendering
- Sparse bearing lines that connect the character to the voyage register

### Palette

- `Ink` `#242321`
- `Field paper` `#E9E3D8`
- `Matte brass` `#A8842F`
- `Sea gray` `#667572`
- `Signal green` `#6E8261`

### Mark and illustration hierarchy

- Below `64px`, use typography or a conventional functional icon, never a
  shrunken illustration or a miniature dog face.
- Use a full illustration only when the state carries emotional or temporal
  meaning. One full Argus per viewport is the default maximum.
- Persistent chrome uses the Argus wordmark and collar-tag sigil. The sigil is
  the one small-format identity: no face and no letterform. Due and watch states
  use conventional functional icons; the sigil never doubles as status UI.
- The full dog never replaces a spinner for ordinary loading and never decorates
  a dense analysis result.
- Paper-blend treatment is light-register only. In dark mode, preserve the warm
  field-note plate so coat detail and amber eyes do not disappear into the page.
- The landing hero remains about the user's judgment. Argus may first appear in
  the return story immediately after the hero, where the name earns its meaning.

## Motion Grammar

- Breathing means patient presence, not machine progress.
- Perking up means a real new signal appeared.
- Arrival means a promised return and plays once.
- Acknowledgement means the user's seal was heard and plays once.
- Tail-wagging, bouncing, and generic hover animation are not global behavior.
- All motion respects `prefers-reduced-motion`.

## Voice

Argus may use first person only when the product has made or kept a concrete
promise: "제가 먼저 물어볼게요" and "다시 왔어요." Elsewhere, interface copy
describes what the system is doing without role-play.

Argus never says it knows what the user should choose. It asks a neutral crux,
states what changed with provenance, and names its own limits plainly.

## Do Not

- Do not make Argus a judge, oracle, coach persona, or all-seeing authority.
- Do not use police, military, chain, spike, armor, or aggression cues.
- Do not turn product functions into dog puns.
- Do not use celebratory cuteness for loss, error, or a broken prediction.
- Do not add a full mascot to navigation, every empty card, or routine loading.
- Do not create pose variants without assigning them a canonical product state.

## Canonical Assets

- `public/images/brand/argus-v2/argus-canon.jpg`
- `public/images/brand/argus-v2/argus-companion.jpg`
- `public/images/brand/argus-v2/argus-watching.jpg`
- `public/images/brand/argus-v2/argus-returning.jpg`
- `src/components/brand/ArgusSigil.tsx`
- `src/components/brand/ArgusMascot.tsx`
