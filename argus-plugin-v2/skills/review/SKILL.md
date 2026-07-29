---
name: review
description: Deep pressure-test of a decision or artifact (PR, file, branch, document) — the full Argus reviewer pipeline. Sharpens the question, deploys reviewer agents on the real artifact in parallel, splits claims into supported/challenged/human-required, optionally runs a stakeholder pass, and returns one consolidated card. Explicit opt-in only. Invoked as `/argus:review`.
argument-hint: "[your decision — may mention a PR, issue, file, branch, or document] [--full | --quick | --no-boss | --resume <id>]"
disable-model-invocation: true
---

# /argus:review — the deep review door

This command is the ONLY entry to the multi-agent deep review, and it opens only
by the user's explicit hand: the model cannot auto-invoke it
(`disable-model-invocation: true` keeps even this description out of ambient
context), and no hook or other skill chains into it. If the user did not type
`/argus:review`, this pipeline must not run.
The quiet default — capture a decision, save a check, get reminded, settle
against reality — lives outside this door and never needs it.

## How to run

Read [pipeline.md](pipeline.md) and follow it end to end with the arguments the
user passed (flags: `--full`, `--quick`, `--no-boss`, `--resume <id>`). It is
the full orchestrator.

## Conventions inside this directory

The step files are the former individual skills, moved here as supporting files
(they are not commands anymore):

- [pipeline.md](pipeline.md) — orchestrator
- [clarify.md](clarify.md) — sharpen the real question (formerly `/argus:clarify`)
- [team.md](team.md) — reviewer agents work the artifact in parallel (formerly `/argus:team`)
- [verify.md](verify.md) — split claims: supported / challenged / human-required (formerly `/argus:verify`)
- [boss.md](boss.md) — stakeholder pressure-check (formerly `/argus:boss`)
- [revise.md](revise.md) — apply feedback into a child draft + re-verify (formerly `/argus:revise`)

When a step file says `` `team.md --revise` `` (or similar), that means: read
that file and follow it in that mode — the file-reference form of the old
`/argus:team --revise` skill invocation. The internal `--invoked-via-sail` flag
keeps its wire-compatible name and means "running as a chained step: suppress your own
verbose print; the pipeline renders the consolidated card".

## Activation contract (spine)

- Fire-or-not was decided by the user's explicit command before this text
  loaded — never re-decide it, and never suggest re-running this door as
  engagement. Everything quiet stays available without it.
