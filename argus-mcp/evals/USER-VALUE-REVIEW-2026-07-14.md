# User-value review — MCP + plugin — 2026-07-14

Not "does it crash" (that's the fuzz/loop/elicit harnesses — all green). This is
"would a real, skeptical, busy founder find it actually usable and worth the
time." Method: drive a full real decision journey through the MCP and read every
surface from the user's chair; a separate skeptic pass over the plugin's
user-facing skills. Honest limit (the product's own rule): a machine can flag
usability problems but can't certify "it's good" — that's the founder's taste.

## Fixed here

### MCP · the receipt payoff was invisible (biggest MCP find)
Completing a decision loop — predict → wait → settle — and asking to see the
receipt returned a bare **"Receipt recalled."**, with the whole prediction-vs-
reality card (the product's core "aha": *"No grade: you predicted, reality
answered, not the model"*) buried in `data.receipt_text`, unseen on hosts that
don't render data. The aha moment showed nothing. **Fixed:** `view=receipt` now
puts the prediction-vs-reality line on the surface (locale-aware, clipped, no
verdict); the full card stays in data as the keepsake.

### Plugin · two stale/discoverability bugs
- `boss/SKILL.md` claimed *"there is no `/argus:configure` skill in this plugin"*
  — but it exists. Factually wrong; would route the model to the wrong fallback.
  Fixed to point at `/argus:configure`.
- `/argus:configure` was in neither `help` nor the README command list —
  undiscoverable. Added to the help command list.

## Founder's call (design decisions — NOT changed unilaterally)

These are real and important, but they are product-taste / spine decisions the
founder should make, not an unattended agent. Ranked by impact on "keep using
after week 1":

1. **Friction-to-first-value is the #1 bounce risk.** The help promises "just
   say it," but one medium/high `sail` run can fire **4–5** `AskUserQuestion`
   prompts (stakes, BIND lean + check-back date, up to 2 fork probes, the Wake
   re-ask) and preview **4–12 minutes**. A busy skeptic bounces at the second
   prompt, long before the track-record magic. Consider: collapse to ONE prompt
   per run by default.
2. **The compounding payoff is deferred weeks out.** The differentiator
   (seal→settle→track-record) only pays off on return, and `patterns`/insight is
   gated behind **≥3 settled contracts**. First session is mostly a promise on
   credit. Consider a smaller, sooner proof of value.
3. **Nautical jargon tax.** Current Heading / fog / reef / anchor / crew / Sirens
   add a decode step every read — so much that the **statusline literally
   translates the product's own enums to plain English** (`statusline/index.js`
   ≈429: "anchor='여기서 끝'을 처음 본 사람은 해독할 수 없다"). If your own
   statusline won't ship the word "anchor," the bearing card probably shouldn't.
4. **MBTI boss contradicts itself.** `boss/SKILL.md` says *"0/5 of the value was
   the MBTI type … Barnum … tone skin only"* (≈104) yet *"the MBTI-based review
   is literally the differentiator"* (≈318), and `configure` spends a setup
   question collecting the 4 letters. Reads as personality-test theater. Consider
   dropping MBTI from the user surface, keeping the seat/objective framing.
5. **Over-fire guards are prose-only, unenforced.** The anti-tilt/anti-fog
   machinery is prompt instruction ("hold the line by hand"), with no loud
   failure if the model tilts a fork — exactly the "plausible masquerades as
   correct" the spine warns against, turned on itself. Consider a deterministic
   post-check (the static eval gate exists — extend it) rather than trusting the
   prompt.
6. **`/argus:scan` has no cost/latency preview** (unlike `sail`'s honest ~min
   preview), yet `--all-projects` spawns headless model calls across every
   project. A blind `scan` will surprise. Consider a preview + confirm.
7. **settle-outcome elicitation has no free-text option** in the picker
   (held/avoided/partial/pending/missed); declining falls to a text re-ask. The
   user's words are captured in `what_happened`, so this is defensible, but a
   "let me explain" escape would be gentler.

## What is genuinely good (keep)
- First-run friction is actually low: config auto-creates silently, and a
  mistaken auto-trigger leaves the repo byte-identical (zero-droppings).
- SessionStart nudge is restrained: silent by default, one line, marker-before-
  print so a failure is silence not a repeating nag.
- Secret redaction before any diff reaches a prompt; zero-install doc extraction.
- The developer decision contract (name a file/test/failure-mode/next-patch,
  reject "consider edge cases") is the real differentiator vs commodity review —
  *if the model obeys it* (see finding 5).
- MCP: 24k-call fuzz clean, elicitation honest, locale consistent, receipt now
  visible. The MCP surface is in good shape; the plugin's issue is friction, not
  correctness.

## Blunt verdict (from the skeptic pass)
The core loop (decide → seal a falsifiable check → settle against reality) is
genuinely differentiated and the anti-judgment restraint is more principled than
the second-brain graveyard. But the product makes you *earn* the payoff, while
marketing "just say it." The single biggest thing in the way is the
friction-to-first-value ratio. Cut per-run prompts to one, ship plain-language
labels, drop the MBTI costume — and it has a real shot.
