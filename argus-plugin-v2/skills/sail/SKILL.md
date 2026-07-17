---
name: sail
description: Legacy alias of /argus:review — the deep decision pressure-test under its original name, kept because README, webapp, and CLI surfaces taught it. Explicit opt-in only. Invoked as `/argus:sail`.
argument-hint: "[your decision — may mention a PR, issue, file, branch, or document] [--full | --quick | --no-boss | --resume <id>]"
disable-model-invocation: true
---

# /argus:sail → /argus:review

`/argus:sail` is the legacy name of the deep review door. Behave exactly as
`/argus:review`: read [../review/pipeline.md](../review/pipeline.md) and follow
it end to end with the arguments the user passed (same flags: `--full`,
`--quick`, `--no-boss`, `--resume <id>`).

The first time this alias is used in a session, add one short parenthetical —
e.g. "(`/argus:sail`은 `/argus:review`의 예전 이름입니다)" in the user's
language — then just do the work. Never nag about the rename beyond that.
