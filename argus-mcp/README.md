# Argus Decision MCP

Argus preserves consequential judgments, the assumptions behind them, and what
reality later did. It does not score people or give verdicts.

Part of [Argus](https://github.com/commet/Argus) · web app at
[argus.voyage](https://argus.voyage) · MIT licensed.

## Install

**Requirements:** **Node.js 18 or newer** (`node --version`); install from
[nodejs.org](https://nodejs.org) if that prints nothing. No API key and no
account — records are local files from the first call.

Pick the section for your host. Every path below installs the same server.

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

The plugin wires this server for you, and adds the decision commands on top:

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
```

Restart Claude Code, then `/argus:settings doctor` confirms the wiring. Prefer
the server alone, without the commands? Add it directly instead:

```bash
claude mcp add argus -- npx -y argus-decision-mcp        # this project only
claude mcp add -s user argus -- npx -y argus-decision-mcp # every project
```

`claude mcp add` defaults to the current project. Use `-s user` if you want
Argus available everywhere.

### Claude Desktop

Settings → Developer → **Edit Config** opens the file directly. It lives at:

- **macOS** — `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows** — `%APPDATA%\Claude\claude_desktop_config.json`

Add Argus to it, then **quit Claude Desktop completely and reopen it** (a window
close is not enough):

```json
{
  "mcpServers": {
    "argus-decision": {
      "command": "npx",
      "args": ["-y", "argus-decision-mcp"],
      "env": {
        "ARGUS_DIR": "/absolute/path/to/where/records/should/live/.argus"
      }
    }
  }
}
```

`ARGUS_DIR` matters more here than in a terminal host: a desktop app has no
"current project", so without it the server has no obvious place to write. Give
it an absolute path. On Windows, escape the backslashes
(`"C:\\Users\\you\\decisions\\.argus"`).

<details>
<summary>Windows: server does not appear</summary>

- Run the command by hand first — `npx -y argus-decision-mcp` should start and
  wait silently. An error here is the real error.
- `npx` failing while it works in your terminal usually means npm is not
  installed globally. Check that `%APPDATA%\npm` exists; if not, run
  `npm install -g npm`.
- If the log mentions an unexpanded `${APPDATA}`, add
  `"APPDATA": "C:\\Users\\you\\AppData\\Roaming\\"` to the `env` block above.
- Logs: `%APPDATA%\Claude\logs\mcp*.log` (macOS: `~/Library/Logs/Claude`).

</details>

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

## Where your records live

One ledger per project, on your disk, from the first call — nothing to set up.

`ARGUS_DIR` is optional when the MCP host starts the server in the project
directory. The default is `<current-project>/.argus`. A per-call absolute
`argus_dir` overrides both.

Argus never scans other projects. Existing home-level ledgers are not migrated
or merged silently; point `ARGUS_DIR` at one explicitly if you need to inspect
it.

## Optional: account sync

Off until you turn it on. Nothing leaves the machine before you approve it in a
browser:

```bash
npx argus-decision-mcp connect       # one browser approval, credential stored locally
npx argus-decision-mcp disconnect    # revoke it here
```

Add `--headless` on a machine with no browser to get a device-code flow. For CI,
set `ARGUS_TOKEN` to a sync token from the web app's settings page instead of
running `connect`. With no credential, sync is a silent no-op — the local record
is unaffected.

## Your data

The records are plain append-only files under `.argus/`. They are yours:
**copy that folder to back it up, delete it to remove it.** Uninstalling the
server never touches it.

For the durable home that survives moves and worktrees, the CLI also has
`archive-export`, `archive-restore`, and `local-purge`. Each one requires
explicit arguments — `--repository-id`, an absolute `--archive-dir`, and a
verbatim `--confirm-repository` before anything is deleted. That is deliberate:
erasing judgment records should never be a one-word command. Run one without
arguments and it names the argument it wants.

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
