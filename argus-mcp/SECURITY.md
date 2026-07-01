# Security

## Data & privacy

- **All data is local.** Argus writes only under the `.argus/` directory you
  point it at: an append-only `ledger/ledger.jsonl`, per-decision
  `sessions/{id}/` files, and a `config.yaml`. Nothing leaves the machine.
- **No telemetry, no network.** The runtime dependency surface is two packages
  (`@modelcontextprotocol/sdk`, `js-yaml`). `npm ls --prod` should show no
  analytics or network client. CI fails if the production dependency tree grows.
- **Private by default.** `argus_init` adds `sessions/`, `ledger/`, and `.bound`
  to `.argus/.gitignore` so your decisions are never committed.

## Threat model

Argus runs as a local stdio MCP server. Tool arguments are produced by an LLM
and may be influenced by untrusted context, so:

- **Path traversal.** Every `id` / label flows through a single `safeSegment`
  validator (`[A-Za-z0-9._-]`, no `..`, no separators, no percent-encoding) and
  every built path is checked with `assertInside`, which resolves the deepest
  existing ancestor via `realpath` so a symlink/junction can't be used to escape
  `.argus/`. Covered by `safe-path.test.ts` (incl. Windows `..\`, `%2e`).
- **Ledger integrity.** The ledger is trusted local state; its integrity rests
  on filesystem permissions. v1 does **not** sign entries — a process with write
  access to `.argus/` could append a forged `settle`. Replay counts unparseable
  lines and surfaces `integrity.dropped_lines` rather than silently swallowing a
  torn record. If you need tamper-evidence, keep `.argus/` on a controlled path.
- **Diagnostics never touch stdout.** A stdio server must keep stdout clean for
  JSON-RPC framing; all logging goes to stderr (`ARGUS_DEBUG` for verbose).

## Reporting

Open a private security advisory on the repository, or email the maintainer.
Please don't file public issues for vulnerabilities.
