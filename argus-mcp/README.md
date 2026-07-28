# Argus Decision MCP

Argus preserves consequential judgments, the assumptions behind them, and what
reality later did. It does not score people or give verdicts.

## Install

### Codex (CLI or app)

```bash
codex mcp add argus-decision -- npx -y argus-decision-mcp@2.0.5
codex mcp list        # argus-decision should be listed and enabled
```

Argus confirms a prediction with a one-tap form before saving it. Codex shows
that form under its default approval policy. If yours is set to `never`, or
`approval_policy.granular.mcp_elicitations = false`, Codex answers the form
itself without showing it — Argus will tell you so and offer to save from chat
instead, rather than pretend you declined.

### Claude Code

```bash
/plugin marketplace add commet/Argus
/plugin install argus@argus
```

### Any other MCP host

```json
{
  "mcpServers": {
    "argus-decision": {
      "command": "npx",
      "args": ["-y", "argus-decision-mcp@2.0.5"],
      "env": {
        "ARGUS_DIR": "/absolute/path/to/your/project/.argus"
      }
    }
  }
}
```

Pin an exact version, not a range: `npx` reuses a cached install for a range
spec, so `@latest` or `@^2` can silently keep running a build from weeks ago.

`ARGUS_DIR` is optional when the MCP host starts the server in the project
directory. The default is `<current-project>/.argus`. A per-call absolute
`argus_dir` overrides both.

Argus never scans other projects. Existing home-level ledgers are not migrated
or merged silently; point `ARGUS_DIR` at one explicitly if you need to inspect
it.

## Tools

The complete callable surface is six tools:

| Tool | Purpose |
|---|---|
| `argus_capture` | Capture a decision and its user-owned context. |
| `argus_predict` | Record one falsifiable claim and its check date. |
| `argus_check_in` | Read records that need attention now. |
| `argus_resolve` | Append an outcome the user explicitly stated. |
| `argus_patterns` | Read decisions, receipts, timelines, and patterns. |
| `argus_settings` | Read or update language, reminders, and explicit sync. |

Names from pre-2.0 releases are not callable aliases. A cached call to one of
them returns `UNKNOWN_TOOL`, so hosts cannot accidentally keep using obsolete
contracts.

## Design boundaries

- Local-first, append-only records.
- Project isolation by default.
- User wording and AI-surfaced wording retain distinct provenance.
- Recorded text is treated as untrusted data.
- No verdict, grade, accuracy score, streak, or leaderboard.
- Network sync is explicit; anonymous telemetry is off unless
  `ARGUS_TELEMETRY=1`.
- Unexpected errors are logged server-side and returned as a generic message,
  avoiding path or stack disclosure to the model.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

The published package contains one bundled runtime entrypoint. Internal
implementation and experimental modules are not shipped as separate callable
or importable files.

See [SECURITY.md](SECURITY.md) for reporting and trust-boundary details.
