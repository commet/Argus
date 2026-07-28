# Argus Decision MCP

Argus preserves consequential judgments, the assumptions behind them, and what
reality later did. It does not score people or give verdicts.

## Install

### Codex (CLI or app)

```bash
codex mcp add argus-decision -- npm exec --yes --package=argus-decision-mcp@2.0.8 -- argus-decision-mcp
codex mcp list
```

Argus uses standard MCP elicitation for one-tap confirmation. Codex can show
that form when MCP elicitations are allowed. If your approval policy blocks
them, Codex returns a protocol-level decline without a server-visible policy
reason; enable MCP elicitations to use the form.

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
      "command": "npm",
      "args": ["exec", "--yes", "--package=argus-decision-mcp@2.0.8", "--", "argus-decision-mcp"],
      "env": {
        "ARGUS_DIR": "/absolute/path/to/your/project/.argus"
      }
    }
  }
}
```

Pin an exact version, not a range, so the host cannot silently reuse an older
cached package.

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
