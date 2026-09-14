---
name: Argus
description: A calm editorial decision desk that carries one decision from next move to reality and the next judgment.
colors:
  ink: "#16140f"
  ink-secondary: "#494339"
  ink-tertiary: "#5c564b"
  paper: "#f6f4f0"
  paper-surface: "#ffffff"
  paper-hover: "#efece6"
  brass: "#96782e"
  brass-light: "#b8963e"
  brass-ink: "#3a2a10"
  border: "#d2ccc0"
  border-subtle: "#ddd6cb"
  ledger-paper: "#f4ede0"
  ledger-paper-deep: "#ebe2d0"
  ledger-ink: "#1a2a3a"
  ledger-ink-soft: "#4a6180"
  dark-paper: "#1c1917"
  dark-surface: "#292524"
  dark-ink: "#fafaf9"
  dark-ink-secondary: "#a8a29e"
  dark-brass: "#d4b968"
typography:
  display:
    fontFamily: "Noto Serif KR, Georgia, Times New Roman, serif"
    fontSize: "clamp(31px, 4.45vw, 46px)"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Pretendard Variable, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  label:
    fontFamily: "JetBrains Mono, Menlo, SF Mono, ui-monospace, Pretendard Variable, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.08em"
rounded:
  pressed: "2px"
  ledger: "4px"
  control: "8px"
  field: "12px"
  panel: "16px"
  proof: "18px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "10px 20px"
    height: "44px"
  button-accent:
    backgroundColor: "{colors.brass}"
    textColor: "{colors.brass-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "10px 20px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "10px 20px"
    height: "44px"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "12px 16px"
  card:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "16px"
---

# Design System: Argus

## Overview

**Creative North Star: "The Quiet Decision Desk"**

Argus is built as a paper-and-ink place for consequential judgment, not an AI dashboard. Its product thesis is visible in one continuous loop: **decision → next move → reality returns → next judgment**. The interface helps the user act, preserves what they chose, and reopens the record only when reality can add something. Argus contributes actively but never looks like an oracle, evaluator, or owner of the decision.

Two coordinated registers express this world. The application is warm paper, dark ink, restrained brass, softly lifted sheets, and humane editorial type. The landing page uses a more explicit ledger register: aged paper, navy ink, fine rules, mono labels, and a dark proof plate. Brass marks commitment, sequence, or a real signal; it is not ambient decoration.

### Surface roles

- **Landing:** make the loop understandable in the first viewport. One-line input is the sole primary action; the adjacent ledger is explicitly a product example, never implied user data or performance proof.
- **Workspace / Decide:** turn one stuck decision into one observable next move and a return contract. It is a focused work surface, not a collection of tool cards.
- **Decision Desk / Decisions:** hold the small active portfolio: what moves now, what waits on reality, and what has returned. Due returns outrank history.
- **Return dialog:** collect the user's observation before showing the old wording on the first return. Append reality; never rewrite the baseline.

**Key characteristics:**

- Calm, editorial, material, and low-noise.
- One primary action and one new cognitive demand per screen.
- Sequence bands and ledger rows show continuity without becoming dashboards.
- Examples, AI drafts, provenance, disconnected state, and monitoring limits are labeled plainly.
- Motion communicates presence, acknowledgement, or return—not excitement or machine busyness.

## Colors

The palette is warm neutral paper with near-black ink and rare brass. The landing ledger adds navy ink, while dark mode remaps the same semantic roles to warm charcoal and pale brass.

### Primary

- **Warm Ink** (`ink`): body text, everyday primary actions, and strong structural contrast.
- **Matte Brass** (`brass`): user commit moments, active sequence cues, focus, and selected state. Use the gradient built from brass tokens only when a committed action needs more weight.

### Secondary

- **Ledger Navy** (`ledger-ink`): the landing proof plate, blueprint lines, and square ledger focus. It belongs to the ledger register, not generic app chrome.
- **Soft Ledger Ink** (`ledger-ink-soft`): explanatory text and fine labels on ledger paper.

### Neutral

- **Warm Paper** (`paper`) is the app canvas; **White Sheet** (`paper-surface`) is the lifted working surface.
- **Aged Ledger Paper** (`ledger-paper`) and its deeper companion are limited to the landing register and sanctioned paper moments.
- Primary, secondary, and tertiary ink tokens establish hierarchy without lowering small text below readable contrast.
- Borders place sheets on the desk. Subtle borders divide related content; the stronger border defines controls and interactive choices.

### Dark mode

Use the semantic token remaps; do not hardcode light values into components. Dark mode is warm charcoal, not blue-black. Brass becomes lighter and therefore uses dark ink (`#3a2a10`) on brass-filled controls. Brand illustrations remain on a warm field-note plate when their detail would disappear into the dark canvas.

**The Brass Is Earned Rule.** Gold is for the user's commitment, the current sequence, focus, or a real returned signal. It must not make every icon, heading, or AI output look important.

**The Two-Register Rule.** App surfaces may borrow paper and ink materiality. Landing-only ceremony colors and ornament do not migrate into routine working chrome.

## Typography

**Display Font:** Noto Serif KR with Georgia and Times New Roman fallbacks

**Body Font:** Pretendard Variable with native system fallbacks

**Label Font:** JetBrains Mono, with Pretendard handling Korean glyphs

**Chart/engraving font:** Cormorant Garamond and Nanum Myeongjo only where an established cartographic or quotation treatment already calls for them

The serif voice carries decisions, promises, and major orientation; the sans voice carries actions and explanation. Mono is metadata—dates, sequence labels, example flags, and compact status—not a body voice.

### Hierarchy

- **Hero display:** bold serif, tightly tracked, responsive from 31px to 46px. Keep Korean line-height looser (about 1.2) than Latin (about 1.08).
- **Page title:** 22–27px, bold, tight; use serif when the title is reflective or orienting and sans where it is primarily navigational.
- **Section heading:** 18–23px, semibold or bold, usually serif for a decision-bearing statement.
- **Body:** 13–16px depending on density; the global reading default is 15px/1.7. Explanatory copy should usually stay within 65–75 characters per line.
- **Label:** 10–12px, semibold, often uppercase with 0.08–0.18em tracking. Never use wide tracking for paragraphs.

**The Decision Before Metadata Rule.** The user's decision and next move get the serif or strongest sans hierarchy. System labels, timestamps, and provenance stay smaller and quieter.

## Layout

Argus uses a centered reading column for decision work and a wider split canvas only when a second region proves the loop. The landing is capped at a wide `max-w-6xl` frame and becomes a two-column promise/proof layout at the large breakpoint. Workspace begins in a focused `max-w-2xl` column; detailed work may expand to `max-w-4xl` or `max-w-5xl`. Global navigation is capped at `max-w-7xl`.

The spacing rhythm is 4, 8, 12, 16, 24, and 32px, with 40–64px reserved for major section separation. Internal component spacing stays denser than the distance between narrative beats. Prefer one continuous sequence, ruled list, or divided sheet over a grid of equal-weight cards.

### Responsive hierarchy

- **Below 640px:** stack actions and content; keep the primary action visible and at least 44px tall. Modals become bottom sheets. Put the active decision or due return before history and navigation.
- **From 768px:** introduce multi-column sequence summaries and optional supporting imagery. The Decision Desk example becomes three columns; its companion mascot may appear.
- **From 1024px:** show full desktop navigation and the landing proof plate. On smaller screens, replace that plate with the compact inline loop rather than shrinking it.
- Preserve safe-area space for fixed mobile controls. Never let bottom navigation cover the current task.

**The One Work Surface Rule.** The input or current decision is the composition's center of gravity. Supporting explanation must orient toward it, not compete as another card.

## Elevation & Depth

The app is layered paper on a desk: a warm canvas, white or tinted sheets, hairline borders, warm shadows, and occasional inset highlights. Default cards use low layered depth; the current input, menus, dialogs, and hoverable records may rise one level. The landing proof is a deliberately dark ink plate with stronger depth, but the surrounding page remains quiet.

### Shadow vocabulary

- **Hairline / XS:** `0 1px 2px rgba(26,26,26,.08), 0 0 1px rgba(26,26,26,.05)` for compact controls and placed details.
- **Resting sheet / SM:** `0 2px 8px rgba(26,26,26,.11), 0 0 1px rgba(26,26,26,.06)` for normal cards.
- **Working surface / MD:** `0 4px 16px rgba(26,26,26,.14), 0 2px 4px rgba(26,26,26,.08)` for the active input and menus.
- **Raised / LG–XL:** reserved for hoverable records, dialogs, and overlays. Dark mode uses the tokenized stronger black shadows.

Avoid glass panels, decorative blur, neon glow, and shadows on every divider. The modal backdrop may use a slight blur; routine surfaces may not.

### Motion

Controls respond in roughly 150–200ms with small lift, brightness, border, or shadow changes; active buttons compress to 0.96 scale. Narrative stage changes may take 300–400ms using the established spring or smooth easing. Animate only transform and opacity for layout entrances where possible.

Mascot motion is semantic: slow breathing for patient presence, one acknowledgement after a user seal, one arrival for a promised return, and one perk for a real signal. No bouncing, tail-wagging, generic hover animation, or looping arrival. `prefers-reduced-motion` disables nonessential motion and smooth scrolling.

**The Depth Follows Attention Rule.** Elevation identifies the current work surface or a temporary layer; it does not decorate passive content.

## Shapes

The application register uses gently rounded fields and cards: 8px controls, 12px fields/cards/buttons, and 16px major panels. The landing ledger is squarer and more pressed: 2–4px corners on entry and action elements, fine ruled edges, and a single 18px dark proof plate. Do not mix square ledger controls and soft app cards within one component.

Borders are visible and warm, not hairline-gray decoration. Dashed borders mean a quiet/ghost action, an AI draft requiring explicit choice, or a true empty state—not general visual texture. Full illustrations keep their own natural silhouette and are never shrunk into status glyphs.

## Components

### Buttons

- **Primary:** ink-filled, high-contrast, softly dimensional; use for the everyday next action.
- **Accent:** brass-filled and tactile; reserve for explicit user commitment or confirmation. Always use the correct semantic foreground for the active theme.
- **Secondary:** white sheet with a warm border; use for supporting actions.
- **Ghost:** transparent with a dashed border and secondary ink; use sparingly for tertiary actions.
- **Danger:** isolated red tint and border. Never reuse brass or primary ink for destructive confirmation.
- All primary controls are at least 44px high on touch layouts. Hover lifts by about 1px; active compresses. Disabled controls keep their full shape and hit area, using desaturated surface/border/text rather than low opacity.

### Fields

Fields are warm, inset working areas with a 12px radius, visible border, 16px horizontal padding, and 15–16px input text. Focus moves border and ring to brass; the landing ledger uses navy/brass focus on paper. Labels name the decision in plain language; helper copy explicitly permits messy input. Errors use text plus border and an announced message, never color alone.

### Cards and sequence bands

Use cards for a real object with state: a Decision Case, current work surface, record, or return. Use divided sequence bands for `Next move → Reality returns → Next call`; arrows and order reinforce the relationship. Do not create a feature-card grid to explain the product. Empty states demonstrate what will accumulate and keep one primary action.

### Navigation

Use action- and domain-oriented labels: **Decide / New decision** and **Decisions / Decision Desk**, followed by Settings and Guide. Desktop navigation appears at the large breakpoint; mobile navigation preserves the current task and due-return priority. Active, hover, and focus states must remain distinct in both themes.

### Dialogs and returns

Dialogs are centered above 640px and bottom-aligned below it, with a 16px top radius on mobile, a brass top rule, trapped focus, Escape close, scroll lock, and focus restoration. On the first return, ask for the Observation before revealing the Baseline. AI-proposed options are visibly labeled as drafts and require the user's selection. Saving appends to the Decision Record.

### Brand character

Use one full Argus illustration per viewport at most, and only when a canonical product state carries emotional or temporal meaning: companion, witness, watching, returning, or settled. Persistent chrome uses the canonical face crop; functional status uses conventional icons. The dog is a witness and companion, never a judge, oracle, spinner, or decorative sticker.

### Copy vocabulary

Prefer **decision**, **next move**, **decision record**, **return contract**, **observation**, **return**, **lesson**, and **decisions/Decision Desk**. Explain the ordinary phrase before internal words such as seal, settlement, ledger, voyage, or playbook. Avoid **project**, **session**, **workflow**, **dashboard**, **AI recommendation**, **verdict**, **score**, **win rate**, and any wording that implies Argus chose for the user. “Not yet,” “stop,” and silence are valid states.

## Do's and Don'ts

### Do

- **Do** lead with the user's next move and make the loop visible as one sequence.
- **Do** preserve authorship and provenance; label examples as examples and AI drafts as drafts.
- **Do** collect observation before retrospective interpretation on a first return.
- **Do** keep one primary action, visible keyboard focus (2px outline with 2px offset), logical heading order, and 44×44px touch targets.
- **Do** verify light and dark themes, Korean and English wrapping, and reduced-motion behavior.
- **Do** use color together with label, icon, border, position, or copy to communicate state.

### Don't

- **Don't** redesign the product as a generic analytics dashboard, chat window, feature-card grid, or glassmorphic AI tool.
- **Don't** use brass everywhere, mix the landing ceremony register into routine app chrome, or hardcode light-theme colors.
- **Don't** reveal an old record before the first observation, infer adoption, rewrite history, or grade the user.
- **Don't** turn mythology or the mascot into the first explanation of utility.
- **Don't** use opacity alone for disabled controls or motion alone for status.

### Screenshot QA

For any changed core surface, capture a narrow mobile view (about 390px), the relevant medium state (768px), and desktop at or above 1024px. Check the landing first viewport, idle Workspace, empty Decision Desk, and first-return dialog as applicable.

1. The primary action and current decision are visible without competing cards.
2. The loop reads in the correct order; arrows, labels, and wrapping survive Korean and English.
3. Product examples and AI drafts cannot be mistaken for user data or validated outcomes.
4. Focus rings, disabled states, error text, selected state, and due-return priority remain legible without color alone.
5. Dark mode remaps paper, ink, brass foregrounds, borders, shadows, and illustration plates correctly.
6. At mobile widths, supporting proof or mascot content yields before the task, controls remain 44px tall, and no fixed bar covers content.
7. With reduced motion enabled, the page remains understandable and no essential state depends on animation.

---

## 화면에 나가는 글 — 한국어 문장 규율 (2026-08-21 창업자 지적으로 신설)

> 창업자 2026-08-21: *"AI스러운, 은어같은, 번역체스러운게 좀 보여서 그건
> 사용자들이 매우 불편해하고 싫어할거 같음. … 매번 말로 내가 바꿔줘야 되나?"*

**근원**: 설계를 논하는 글과 사용자가 읽는 글은 **다른 언어**인데 등록(register)을
안 바꿨다. 설계 문서에서 압축 낱말은 미덕이지만(한 단어가 문단 하나를 대신한다),
그 문체가 목업 안으로 들어오면 사용자는 사전 없이 못 읽는다. 다섯 갈래로 샌다:
①설계 낱말을 화면에 그대로 ②비유로 정보를 대체 ③동사를 추상화 ④피동·명사화
⑤목업 안에 설명이 섞임.

### 시험 둘 — 화면 문장을 쓸 때마다

1. **처음 켠 사람이 사전 없이 읽고 지금 뭘 눌러야 하는지 아는가?** 모르면 다시 쓴다.
2. **이 낱말, 우리 문서에서만 쓰는 말인가?** 그렇다면 화면에서 뺀다.

### 바꿔 쓰는 표 (설계 낱말 → 화면 문장)

| 설계 문서에서 | 화면에서는 |
|---|---|
| 주입한다 | (안 쓴다) *"세션을 열면 아래 규칙을 보여드립니다"* |
| 대조 / 대본다 / 되돌려 대보기 | *"지난 30일 기록에 대입해 봤습니다"* → 더 나은 것: *"지난 30일에 이 규칙이 있었다면 3번 걸렸습니다"* |
| 집행 / 구속 / 발화 | *"막습니다" · "알려드립니다" · "물어봅니다"* |
| 경보 / 감시 | (**금지**) *"알려드립니다"* — 기계·감시 비유는 제품 성격을 정반대로 만든다 |
| 표면이 열림 | *"웹 화면 작업을 시작했습니다"* |
| 후보 / 승격 | *"규칙으로 삼을까요?" · "함께 저장해 둡니다"* |
| 관할 / 범위(scope) | *"이 저장소에서만" · "어느 프로젝트에 적용할까요?"* |
| 정산 / 재확인 | *"아직 유효한가요?"* |
| 오탐 | *"잘못 잡았어요"* |
| 주입-전용 법 | *"읽기만 하는 규칙 — 어겨도 알려드리지 않습니다"* |
| 교환식 | (화면에 안 낸다) |

### 금지 · 대체

- **비유 금지**: 뜨거운·부딪힌·한 바퀴·열림·굶는다·이빨을 갖는다. 비유는 쓰는
  사람에겐 압축이고 읽는 사람에겐 해독이다.
- **피동 금지**: "어겨진 적" → **"안 지킨 적"** / "확인됨" → **"확인하셨습니다"**.
  한국어 제품 문장은 사람이 주어이고 동사로 끝난다.
- **추상 동사 금지**: "규칙을 좁힙니다" → **"문서 파일은 빼겠습니다"**. 같은
  길이에 사실을 담을 수 있으면 언제나 사실 쪽.
- **명사 나열 금지**: "제정 전 영향평가" → **"정하기 전에 미리 대봅니다"**.
- **목업 상자 안에는 사용자가 읽을 글자만.** 설계 설명은 상자 밖에 쓴다.
  ("화면이 직접 말합니다" 같은 문장이 상자 안에 있으면 안 된다.)

### 이미 있는 규약과의 관계

위 `Copy vocabulary` 절(영문)은 **어떤 개념어를 쓰는가**를 정하고, 이 절은
**그 개념어를 화면 문장으로 어떻게 옮기는가**를 정한다. 충돌하면 이 절이 화면
문장에 대해 우선한다 — `Copy vocabulary` 의 "Explain the ordinary phrase before
internal words" 가 그렇게 하라고 이미 지시하고 있다.
