---
name: help
description: Explain Argus and route the user to the right command. Use when the user asks what Argus is, what commands exist, how to start, which command fits their situation, or where session files live. Read-only, no LLM pipeline, no session mutation. Invoked as `/argus:help`.
---

# /argus:help

**What this skill does:** Orient the user in Argus itself — one screen, in
`config.locale` (if `.argus/config.yaml` doesn't exist yet, detect locale per
sail Step 0 but do NOT create any files — help must stay read-only).

Render this (translate naturally for ko; keep the command names verbatim):

```text
## Argus — decision loop

Argus helps you make a decision, save what would prove it right or wrong later,
and come back later to compare it with reality.

Start here — just say it (quotes optional). If you name a PR, file, or document
(pdf/pptx/docx/hwpx included), Argus reads it:
  /argus:sail Should we migrate from Firestore to Supabase?
  /argus:sail Is PR 123 safe to merge?
  /argus:sail Can Claude Code execute this billing refactor plan as-is?
  /argus:sail 보고서.pptx 이대로 임원회의 가져가도 되나?
No command needed either — "review this plan before I send it" triggers Argus.

Flags: --quick (framing only) · --full (force full pipeline) · --resume <id> · --no-boss

The crew, individually (sail chains these for you):
  /argus:scan      recover decision candidates from past Claude Code chats
  /argus:seal      seal one sail seed or scan candidate for later checking
  /argus:clarify   sharpen the real question before any work
  /argus:team      crew agents work the artifact in parallel
  /argus:verify    split claims: supported / challenged / human-required
  /argus:boss      stakeholder pressure-check (MBTI persona from .argus/config.yaml)
  /argus:revise    apply the feedback into a new child draft, re-verify
  /argus:chart     see one voyage's version tree, promote, branch, resume
  /argus:log       voyage log across ALL sessions + your prediction record
  /argus:settle    check past predictions against reality (the contract loop)
  /argus:principles codify a recurring pattern in your settled record as your own rule
  /argus:connect   pair this project with your webapp account using a push token
  /argus:push      send local Argus records to the paired webapp account
  /argus:pull      bring webapp settle/defer actions back into the local ledger
  /argus:sync      pull webapp actions, then push the updated local records
  /argus:helm      (experimental) silent pre-approval scan of an agent plan

Where things live:
  .argus/config.yaml      locale + boss persona (auto-created, edit freely)
  .argus/sessions/<id>/   the full voyage (git-ignored by default)
  .argus/ledger/          prediction ledger + webapp push token (git-ignored)

Lost mid-voyage? /argus:chart shows where you are and names the next command.

Simple model:
  sail   = work the decision you are making now
  scan   = recover decision candidates from past Claude Code chats
  seal   = save one sail seed or scan candidate for later
  settle = answer what actually happened

Background:
  Argus may show one local reminder when something is ready to check.
  It does not judge, settle, or sync automatically.

Developer standard:
  A good code decision names the file/PR/test, the failure mode, and the smallest
  next patch or check. Generic review prose is not enough.
```

**Situational routing** — if the user described a situation instead of asking
for the list, answer with the ONE command that fits, plus one sentence why:

- has a fuzzy/important decision → `/argus:sail "<it>"`
- asks whether an AI/Claude Code plan should be executed as-is → `/argus:sail "<plan question>"`
- wants to recover past Claude Code decisions → `/argus:scan`
- wants to remember one seed/candidate for later checking → `/argus:seal <id>`
- wants only sharper framing, no pipeline → `/argus:sail --quick`
- got a bearing and wants to act on concerns → `/argus:revise`
- wants to dig into the current voyage → `/argus:chart`
- asks "what have I decided here" / "my track record" → `/argus:log`
- a contract reminder fired / "how did that bet go?" → `/argus:settle`
- wants to keep a repeated lesson as their own rule → `/argus:principles`
- wants plugin results in the webapp → `/argus:connect <token>` once, then `/argus:sync`
- settled/deferred plugin records in the webapp → `/argus:pull`
- wants a silent pre-approval scan of a generated plan → `/argus:helm`
- result felt thin / wants the full crew → `/argus:sail --full`

## Forbidden patterns

- Creating or mutating any file (including `.argus/config.yaml`).
- Printing more than ~30 lines or re-explaining the internal pipeline
  (workers, ledgers, schemas) — orientation, not machinery.
