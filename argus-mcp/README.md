# argus-mcp

> Your decisions have a check-in date. Argus makes sure you come back.

MCP server that works with any AI — Claude, GPT, Gemini, or any MCP-compatible client.

## What it does

Argus tracks consequential decisions, seals falsifiable predictions, and surfaces overdue contracts when you return. Unlike a calendar reminder, it brings back *what you assumed* when you made the decision — so you can learn, not just remember.

## One-line install (after npm publish)

```bash
npx argus-mcp
```

Or add directly to your AI client:

```json
{
  "mcpServers": {
    "argus": {
      "command": "npx",
      "args": ["argus-mcp"]
    }
  }
}
```

## Manual install

```bash
git clone https://github.com/Q00/argus
cd argus/argus-mcp
npm install && npm run build
```

Then add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "argus": {
      "command": "node",
      "args": ["/path/to/argus-mcp/dist/index.js"]
    }
  }
}
```

## Usage with other AI clients

Any MCP-compatible client (Continue.dev, OpenAI function calls, etc.) can point to `node dist/index.js`. The server speaks MCP over stdio.

### Tools available

| Tool | Description |
|------|-------------|
| `argus_init` | Initialize .argus/ directory |
| `argus_config_read` | Read locale, boss, team settings |
| `argus_config_write` | Write config |
| `argus_session_create` | Create a decision session |
| `argus_session_read` | Read a session |
| `argus_session_update` | Update session fields |
| `argus_session_list` | List all sessions |
| `argus_version_write` | Write a versioned artifact |
| `argus_version_read` | Read a versioned artifact |
| `argus_version_list` | List versions for a session |
| `argus_bearing_write` | Write current bearing + contract |
| `argus_bearing_read` | Read current bearing |
| `argus_ledger_append` | Append events to the ledger |
| `argus_ledger_replay` | Replay all contract states |
| `argus_contracts_due` | Get overdue decision contracts |

## System Prompt

Paste this into any AI's system prompt to make it Argus-aware:

```
You have access to Argus — a decision-navigation tool that helps you track consequential decisions, make predictions, and return later to check reality against expectation.

On every session start:
1. Call argus_contracts_due with the project's argus_dir
2. If any contracts are due, surface them: "Argus: {N} decision contract(s) past check-by ({date}) — '{predicate}' — time to settle"
3. If none are due, stay silent

When the user makes a consequential decision:
1. argus_session_create — create a session (id = slug from title + date)
2. Analyze: surface assumptions, risks, recommendation
3. argus_bearing_write — write bearing with contract_seed (predicate + check_by)
4. argus_ledger_append — record harvest then seal events

When user says "settle":
1. argus_contracts_due — show what's due
2. For each contract: "What actually happened? Did '{predicate}' turn out to be true?"
3. argus_ledger_append — record settle events
4. argus_session_update — mark status settled

The argus_dir is the .argus/ folder inside the project root (e.g. /project/.argus).
```

## .argus/ directory structure

```
.argus/
  config.yaml          # locale, boss, team settings
  ledger/
    ledger.jsonl       # append-only event log
  sessions/
    {id}/
      session.json     # session metadata
      versions/
        {label}/
          current_bearing.json   # recommendation + contract
          analysis.json          # optional analysis artifact
```
