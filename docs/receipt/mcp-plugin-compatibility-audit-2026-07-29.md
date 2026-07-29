# MCP / plugin compatibility audit — 2026-07-29

This receipt exists so a parallel session does not reconstruct the release
history from a stale worktree.

## Verdict

- `argus-decision-mcp@2.0.12` contains the committed Sayu track through
  `077b4a20`, the protocol-faithful cleanup in PR #336, and the immediately
  preceding webapp authorship fix `e5654009`.
- Plugin 3.0.14 pins MCP 2.0.12 exactly. It changes discovery and packaging,
  not the MCP runtime.
- The packaged plugin exposes exactly five skills:
  `review`, `check`, `history`, `settings`, and `help`.
- The repository no longer adds a second, legacy `.claude/skills`,
  `.claude/commands`, or `.claude/agents` surface beside the plugin.

## Why “six” and “five” were both reported

The five-axis reduction began in `32f9f92f` (2026-07-17). It reduced twenty
product skills to five routers, but retained `commands/doctor.md`. Claude Code
auto-discovered both:

1. five `skills/*/SKILL.md` entries; and
2. the separate `/argus:doctor` command.

The intended product map therefore said five while the installed slash-command
inventory was actually six. Plugin 3.0.13 moved doctor to
`lib/workflows/doctor.md` and routed it through `/argus:settings doctor`.
Plugin 3.0.14 removes the older repository-local skills that could still add
`argus-doctor`, `argus-help`, `argus-setup`, `watch`, and other commands when
Claude Code was opened inside this repository.

No diagnosis behavior was deleted. Only its extra public entrances were
removed.

## Parallel-session reconciliation

These ancestry checks returned success:

```text
git merge-base --is-ancestor commet/argus-claude-sayu origin/main
git merge-base --is-ancestor work/e2e-ci origin/main
```

PR #337 was merged as `e5d915fc` with parents:

```text
e5654009  immediately preceding webapp/authorship fix
ff24bd9e  five-command plugin cleanup and cross-platform guards
```

The six files changed by `e5654009` and the fourteen files changed by the
plugin cleanup had an empty intersection. The plugin work did not overwrite
that webapp work.

One separate worktree, `argus-claude-time22`, had an untracked
`src/lib/premise-shape.ts` created after the merge audit began. It is active
webapp work and was deliberately not read as released code, moved, staged, or
deleted.

The `argus-claude-admin` worktree is based on MCP/plugin 2.0.1/3.0.1 and holds
uncommitted experiments from 2026-07-28. In particular, it tries to restore
commitment/declaration/witness semantics directly to the public prediction MCP
path. The accepted cleanup plan explicitly records that those shapes remain in
the on-demand plugin workflow while the public MCP is prediction-focused.
Do not merge that old worktree wholesale into 2.0.12.

## Verification

Local:

- production build: pass
- app tests: 3,994 passed, 10 skipped
- lint: 0 errors (known warnings remain under the repository cap)
- gates: 29/29
- decision signals: 64/64
- static gates: 16/16
- plugin install lifecycle: five skills, plugin 3.0.14, MCP 2.0.12
- `/argus:doctor`: unknown command
- `/argus-doctor`: unknown command
- `/argus:help`: the five-command map
- `/argus:settings doctor`: diagnosis workflow

The validator now fails if repository-local Claude skills, commands, or agents
reappear and bypass the five-command plugin surface.

## Host evidence and one remaining observation limit

- Codex Desktop: permission, native elicitation, accept, disk write, and reread
  were directly observed.
- Codex CLI: fresh-process record and reread passed.
- Claude Code: fresh-process record and reread, plugin install lifecycle, help,
  and doctor routing passed.
- Claude Code's interactive elicitation pixels were not directly captured:
  Windows refused focus to the isolated terminal even with one safe restore
  attempt. The real Claude binary form contract and live non-interactive loop
  pass; do not rewrite that as a direct visual observation.
