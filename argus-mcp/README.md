# Argus Decision MCP

Argus preserves consequential judgments, the assumptions behind them, and what
reality later did. It does not score people or give verdicts.

## Install

### Codex (CLI or app)

```bash
codex mcp add argus-decision -- npx -y argus-decision-mcp
codex mcp list        # argus-decision should be listed and enabled
```

Restart Codex after adding the server. Conversations opened before `mcp add`
do not gain newly registered tools; quit and reopen the app or start a new CLI
session.

Argus confirms a prediction with a one-tap form before saving it. Codex shows
that form under its default approval policy. If yours is set to `never`, or
`approval_policy.granular.mcp_elicitations = false`, Codex may return a protocol
`decline` without rendering the form. MCP currently supplies no marker that
distinguishes that policy response from a fast intentional decline, so Argus
must respect it as a decline. Enable MCP elicitations and retry if you need the
confirmation form.

An AI-drafted **premise** works the same way but has a chat path: when the
confirm window cannot reach the user (the host closes it unanswered), the draft
comes back in the response, and once the user approves it in conversation the
assistant records it by calling again with `chat_confirmed: true` — provenance
stays `ai_surfaced`.

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
      "args": ["-y", "argus-decision-mcp"],
      "env": {
        "ARGUS_DIR": "/absolute/path/to/your/project/.argus"
      }
    }
  }
}
```

Install once; there is nothing to update by hand. Leave the version off, as
above — `npx` re-resolves a bare package name on every launch, so each session
starts the current build.

Do **not** add a range like `@^2`. A range is satisfied by whatever is already
in the npx cache, so it never consults the registry again. Measured on
2026-07-29, same spec string both times, with the cache holding an older version
that the range still allowed:

| spec | launched |
|---|---|
| `argus-decision-mcp` | the current release |
| `argus-decision-mcp@^2.0.0` | the stale cached build |

An exact pin (`@2.0.12`) is correct but freezes there until someone edits it.

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
