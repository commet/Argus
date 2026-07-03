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
## Argus — decision orientation for Claude Code

Give Argus a decision; it checks the weak claims behind the scenes and returns
one screen: current course, why, open risk, set-aside option, next step.

Start here — just say it (quotes optional); if you name a PR, file, or
document (pdf/pptx/docx/hwpx included), Argus reads it:
  /argus:sail Should we migrate from Firestore to Supabase?
  /argus:sail Is PR 123 safe to merge?
  /argus:sail 보고서.pptx 이대로 임원회의 가져가도 되나?
No command needed either — "review this plan before I send it" triggers Argus.

Flags: --quick (framing only) · --full (force full pipeline) · --resume <id> · --no-boss

Commands, individually (sail chains these for you):
  /argus:clarify   sharpen the real question before any work
  /argus:team      worker agents work the artifact in parallel
  /argus:verify    split claims: supported / challenged / human-required
  /argus:boss      stakeholder pressure-check (MBTI persona from .argus/config.yaml)
  /argus:revise    apply the feedback into a new child draft, re-verify
  /argus:chart     see one decision's version tree, promote, branch, resume
  /argus:log       decision log across ALL sessions + your prediction record
  /argus:settle    check past predictions against reality (the contract loop)
  /argus:helm      (experimental) silent pre-approval scan of an agent plan
  /argus:configure set the language + your Boss persona (writes .argus/config.yaml)

Where things live:
  .argus/config.yaml      locale + boss persona (auto-created, or set via /argus:configure)
  .argus/sessions/<id>/   the full decision trail (git-ignored by default)

Lost in a run? /argus:chart shows where you are and names the next command.
```

**Situational routing** — if the user described a situation instead of asking
for the list, answer with the ONE command that fits, plus one sentence why:

- has a fuzzy/important decision → `/argus:sail "<it>"`
- wants only sharper framing, no pipeline → `/argus:sail --quick`
- got a course and wants to act on concerns → `/argus:revise`
- wants to dig into the current decision trail → `/argus:chart`
- asks "what have I decided here" / "my track record" → `/argus:log`
- a contract reminder fired / "how did that bet go?" → `/argus:settle`
- about to approve a generated plan → `/argus:helm`
- wants to change the language or set up the Boss persona → `/argus:configure`
- result felt thin / wants the full agent pass → `/argus:sail --full`

## Forbidden patterns

- Creating or mutating any file (including `.argus/config.yaml`).
- Printing more than ~30 lines or re-explaining the internal pipeline
  (workers, ledgers, schemas) — orientation, not machinery.
