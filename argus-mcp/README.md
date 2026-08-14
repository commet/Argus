# Argus Decision MCP

[**English**](./README.md) | [한국어](./README.ko.md)

Argus carries a consequential decision across conversations: the user-adopted
prediction, what reality should show, when to return, and what actually happened.
The result becomes context for the next judgment. Argus never scores the person
or invents a verdict.

Part of [Argus](https://github.com/commet/Argus) · web app at
[argus.voyage](https://argus.voyage) · MIT licensed.

## What using it looks like

You talk normally. Argus offers to keep one testable thing, then brings it back
when reality can answer.

```text
2026-08-19
you    We're going with Postgres over DynamoDB — the join patterns kill us otherwise.

       ┌ Save this as a prediction?          (your host renders the form)
       │ "Postgres handles our join patterns without a read-replica through Q4"
       │ check by 2026-10-01
       └ accept as written · edit the wording or the date · decline

… six weeks later, in a different conversation …

2026-10-01
argus  One check is due — you saved this on 2026-08-19:
       "Postgres handles our join patterns without a read-replica through Q4"
       What actually happened?

you    We added a read replica in September. Analytics queries, not joins.

       Recorded. The original sentence stays exactly as you wrote it, your
       answer is appended next to it, and nothing is scored.
```

Nothing is saved without you accepting it, and Argus never fills in the outcome
for you.

## Install

**Requirements:** **Node.js 18 or newer** — Node 20 LTS is the tested version
(`node --version`; get it from [nodejs.org](https://nodejs.org)). No API key and
no account: records are local files from the first call.

Pick your host. Every path below installs the same server.

### Claude Code

The plugin wires this server for you and adds the decision commands on top:

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
```

Restart Claude Code, then `/argus:settings doctor` confirms the wiring.

Want the server alone, without the commands? Add it directly:

```bash
claude mcp add argus -- npx -y argus-decision-mcp          # this project only
claude mcp add -s user argus -- npx -y argus-decision-mcp  # every project
```

`claude mcp add` defaults to the current project — use `-s user` if you want
Argus everywhere.

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

`ARGUS_DIR` is optional here too — a desktop app has no "current project", so
records go to your personal home ledger (`~/.argus`) by default rather than
scattering. Set it when you want them somewhere specific. On Windows, escape the
backslashes (`"C:\\Users\\you\\decisions\\.argus"`).

<details>
<summary>Windows: server does not appear</summary>

- Run the command by hand first. `npx -y argus-decision-mcp` in a normal
  terminal prints a short help card and exits — that means the binary works
  (assistants launch it over a pipe, where it stays running as a server).
  A crash or error text instead of the card is the real problem.
- `npx` failing while it works in your terminal usually means npm is not
  installed globally. Check that `%APPDATA%\npm` exists; if not, run
  `npm install -g npm`.
- If the log mentions an unexpanded `${APPDATA}`, add
  `"APPDATA": "C:\\Users\\you\\AppData\\Roaming\\"` to the `env` block above.
- Logs: `%APPDATA%\Claude\logs\mcp*.log` (macOS: `~/Library/Logs/Claude`).

</details>

### Codex (CLI or app)

```bash
codex mcp add argus-decision -- npx -y argus-decision-mcp
codex mcp list        # argus-decision should be listed and enabled
```

Restart Codex afterwards. A conversation opened before `mcp add` does not gain
newly registered tools — quit and reopen the app, or start a new CLI session.

<details>
<summary>Codex: the confirmation form does not appear</summary>

Argus confirms a prediction with a one-tap form before saving it. Codex renders
that form under its default approval policy. If yours is `never`, or
`approval_policy.granular.mcp_elicitations = false`, Codex returns a protocol
`decline` without ever showing the form. MCP supplies no marker that separates
that policy response from a fast intentional decline, so Argus has to respect it
as a decline. Enable MCP elicitations and retry if you want the form.

An AI-drafted **premise** has a chat fallback: when the confirm window cannot
reach you, the draft comes back in the response, and once you approve it in
conversation the assistant records it by calling again with
`chat_confirmed: true`. Provenance stays `ai_surfaced` either way.

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

Install once; there is nothing to update by hand. **Leave the version off**, as
above — `npx` re-resolves a bare package name on every launch, so each session
starts the current build.

<details>
<summary>Why no version range — and why that matters</summary>

Do **not** write a range like `@^2`. A range is satisfied by whatever already
sits in the npx cache, so it never consults the registry again and the wire can
stay frozen on an old build for weeks while everything looks healthy. Measured
2026-07-29, same spec string both times, cache holding an older version the
range still allowed:

| spec | launched |
|---|---|
| `argus-decision-mcp` | the current release |
| `argus-decision-mcp@^2.0.0` | the stale cached build |

An exact pin is correct but freezes there until someone edits it. `argus_check_in`
reports the version actually running (`data.server_version`) if you ever need to
confirm which build answered.

</details>

## Where your records live

On your disk from the first call — nothing to set up.

`ARGUS_DIR` is optional. The default follows one rule — *project evidence
decides where the ledger lives*:

- the working directory is inside a **git repo**, or already has an `.argus`
  folder → `<that-project>/.argus` (per-project isolation, unchanged)
- otherwise (a temp folder, or an app that creates a fresh folder per
  conversation — the Codex desktop app does this) → the **personal home
  ledger** (`~/.argus`), so records accumulate across conversations instead
  of fragmenting into per-conversation orphans

A per-call absolute `argus_dir` overrides everything; `ARGUS_DIR` overrides
the rule.

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
