# Security

## Data & privacy

- **All data is local by default.** Argus writes only under the `.argus/`
  directory you point it at: an append-only `ledger/ledger.jsonl`,
  per-decision `sessions/{id}/` files, and a `config.yaml`. Nothing leaves the
  machine unless you explicitly set `ARGUS_TOKEN` for account sync (or opt in to
  anonymous telemetry with `ARGUS_TELEMETRY=1`; see below).
- **No telemetry by default.** With no `ARGUS_TOKEN` and no `ARGUS_TELEMETRY=1`,
  the server makes no network calls. Telemetry is strictly **opt-in**: set
  `ARGUS_TELEMETRY=1` and it sends an anonymous, content-free ping — a random,
  machine-local install id (`~/.argus/.telemetry-id`, not tied to your account
  or token, regenerable by deleting the file), which of the built-in tools ran
  and whether it succeeded, plus the package version, coarse OS platform, and
  Node major. It **never** sends decision content, titles, predicates, file
  paths, `argus_dir`, or the account token. `DO_NOT_TRACK=1` disables it even if
  the flag is set, and the sink stores no `user_id` (nothing to identify).
  Telemetry rows are **deleted automatically after 90 days** (a daily database
  job — retention is enforced by the database itself, not by policy prose). The
  runtime dependency surface is intentionally small and visible in
  `package.json`: MCP SDK, schema/config helpers, and document parsers.
  `npm audit --omit=dev` should stay clean before publishing.
- **Private by default.** On first use Argus adds `sessions/`, `ledger/`,
  `config.yaml`, and `.bound` to `.argus/.gitignore` so your decisions and
  local settings are never committed accidentally.

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
