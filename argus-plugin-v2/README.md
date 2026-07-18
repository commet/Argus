# Argus

[**English**](./README.md) | [한국어](./README.ko.md)

Argus is a decision loop for Claude Code.

It helps you:

1. make a decision,
2. save what would prove it right or wrong later,
3. come back later and compare it with reality.

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
# restart Claude Code, then:
/argus:review "Should we ...?"
```

After a decision, Argus may ask whether to save a check for later. Later, it
asks what actually happened. You answer: predicted, missed, partial, or later.
Argus does not judge the outcome for you.

---

## Install

In Claude Code:

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
```

Restart Claude Code, then start with:

```text
/argus:review "Should we migrate from Firestore to Supabase?"
/argus:review "Is PR 123 safe to merge?"
/argus:review "Is docs/strategy.md taking us the right way?"
```

If your question names a PR, file, branch, or document, Argus reads that
artifact and works where the decision is actually happening. Talking about a
decision in plain language stays quiet by design: Argus can capture it and save
a check for later, but the deep reviewer pipeline runs only when you invoke
`/argus:review` yourself.

Supported documents: `pdf`, `md`, `txt`, `pptx`, `docx`, `hwpx`. For `xlsx` and
legacy Office/HWP formats, export to CSV/PDF first.

### What one install wires up

Installing the plugin is the whole setup — there is no separate init step:

- **Decision tools (MCP), wired automatically** — a bundled [`.mcp.json`](./.mcp.json)
  registers the `argus-decision-mcp` stdio server (`npx -y argus-decision-mcp@^1`),
  so the decision tools (capture, predict, check-in, resolve, patterns, settings)
  are available to the model immediately.
- **Quiet hooks** — a session-start check that mentions decisions whose check-by
  date has arrived (and refreshes a stale decision view), plus an ambient trigger
  that may ask about at most one due item
  per session (4-hour cooldown across sessions; silence is the default). Opt out
  with `{ "ambient": { "opt_out": true } }` in `~/.argus/config.json`.
- **`/argus:doctor`** — a read-only self-diagnosis of the install and wiring. It
  repairs nothing; each line names the public tool that can.
- **Statusline (optional)** — [`statusline/index.js`](./statusline/index.js) reads
  your decision ledgers. Enable it with one line in `~/.claude/settings.json`:
  `"statusLine": { "type": "command", "command": "node ${CLAUDE_PLUGIN_ROOT}/statusline/index.js" }`

Uninstalling the plugin never deletes your decision records — the ledgers under
`.argus/` (and `~/.argus`) are your data, not the plugin's.

---

## What It Does

Argus is useful when a decision has enough consequence that a polished answer is
not enough.

The core loop is small — five commands, and quiet by default:

```text
Deep review   /argus:review
Return loop   /argus:check
Record        /argus:history
Setup & sync  /argus:settings
Map           /argus:help
```

Plain language:

- `review` pressure-tests the decision you are making now — the full reviewer
  pipeline (sharpen the question, reviewer agents on the real artifact,
  supported/challenged claims, optional stakeholder pass). Explicit opt-in
  only: it never runs on its own.
- `check` is the return loop — what is due now, settle past predictions against
  reality, seal a candidate for later (`/argus:check <id>`), re-check premises
  (`/argus:check premises`).
- `history` is the record — decision log, one decision's version tree, your
  track record, recurring principles, and `/argus:history scan` to recover
  decisions from past Claude Code chats.
- `settings` is setup — language and boss persona, webapp pairing and sync.

Two legacy aliases are kept: `/argus:sail` (= review) and `/argus:resolve`
(= settle what is due). The old step commands (clarify, team, verify, boss,
revise) are no longer separate commands — review runs them as internal steps.

Argus may show a short local reminder when something is ready to check. It does
not judge, settle, or sync automatically.

---

## Webapp Sync

The plugin is local-first. Webapp sync is optional.

First, create a push token in the webapp: **[argus.voyage](https://argus.voyage)
→ Settings → Argus token**. Then connect this project once:

```text
/argus:settings connect <argus_pat_...>
```

Then use:

```text
/argus:settings sync
```

Sync first pulls webapp actions into the local ledger, then pushes the updated
local records back to the webapp. Re-running it is safe.

Nothing is sent to the webapp unless you run a sync or push yourself.

---

## Commands

| Command | Use it when |
|---|---|
| `/argus:review` | You want a decision or artifact pressure-tested by the full reviewer pipeline. |
| `/argus:check` | A check is due, you want to settle against reality, seal a candidate (`<id>`), or re-check premises. |
| `/argus:history` | You want the decision log, a version tree (`versions`), your track record, principles, or `scan`. |
| `/argus:settings` | You want to configure Argus or pair/sync the webapp (`connect <token>`, `sync`). |
| `/argus:help` | You want the shortest command map. |

Kept aliases: `/argus:sail` (= review) · `/argus:resolve` (= settle what is due).
Emergency hatch: `/argus:doctor` (read-only install/wiring self-diagnosis).

---

## Good Fits

- "Should we migrate from Firestore to Supabase?"
- "Review PR #42 as a product, risk, and implementation decision."
- "Is our auth middleware design wrong?"
- "Read this strategy doc and tell me the current course."
- "Should we expand to the EU market next quarter, or wait?"
- "Which vendor should we pick, and what would make that wrong?"

Best developer moments:

- Before merge: "Is this PR safe to merge?"
- Before a large change: "Should we run this migration now?"
- Before approving an AI plan: "Can Claude Code execute this plan as-is?"
- Before touching an unfamiliar surface: "Where should I start in billing/auth/permissions?"

A good answer is not generic advice. Argus tries to leave you with the file, PR,
test, failure mode, and smallest next patch that matter.

Not a good fit:

- Syntax lookup.
- Boilerplate generation.
- Decisions you would comfortably make before lunch.
- Asking only for validation of an answer you already chose.

---

## Privacy

Argus writes project-local state under `.argus/`.

- `.argus/sessions/` stores decision trails and is git-ignored by default.
- `.argus/ledger/` stores saved checks and webapp sync tokens and is git-ignored
  by default.
- Webapp sync is explicit. It never runs in the background.

Review `.argus/` before sharing or committing it.

---

## Development

```bash
./argus-plugin-v2/install.sh --link
node ./argus-plugin-v2/scripts/validate-plugin.js
node ./argus-plugin-v2/scripts/simulate-plugin.js
```

Restart Claude Code after editing skill files. Skill bodies are cached at
session start.

## Reference

- Web app: https://argus.voyage · Source & issues: https://github.com/commet/Argus · MCP on npm: https://www.npmjs.com/package/argus-decision-mcp
- Changelog: `CHANGELOG.md`
- Agent roster: `data/agents.yaml`
- Boss tone skins (voice only — the review's substance is the configured seat): `data/boss-types.yaml`
- Schemas: `data/schemas/*.json`
- Build log (frozen historical record): `BUILD_STATUS.md`
- Test plan (frozen historical record): `TEST_PLAN.md`

## License

MIT
