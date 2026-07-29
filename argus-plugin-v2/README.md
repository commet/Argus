# Argus

[**English**](./README.md) | [한국어](./README.ko.md)

Argus is a decision loop for Claude Code.

It helps you:

1. sharpen what a decision rests on,
2. confirm the sentence you want to preserve and what should reopen it,
3. come back to the original and append your answer.

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
# restart Claude Code, then:
/argus:review "Should we ...?"
```

After a decision, Argus lets you keep a claim reality can answer, a commitment,
a chosen standard, or simply the moment as written. A return uses the event or
fallback date you chose, shows the original first, and records your answer
without a score or win rate.

What remains is a Judgment Receipt — your prediction and reality side by side,
with no grade:

```text
┌─ ARGUS · JUDGMENT RECEIPT ───────────────────────────────────┐

  What I predicted                              saved 2026-07-02
    "churn stays flat for 30 days after the new pricing ships"
    check-by 2026-08-01

  What actually happened                     recorded 2026-08-03
    Churn rose 2pp. Poor plan-migration messaging did most of it.

  This call was made by: me (not the model)

  ───────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  The model never graded you. Reality answered.
└──────────────────  argus · prediction saved → reality recorded ⚓ ─┘
```

What remains is a Judgment Receipt — your prediction and reality side by side,
with no grade:

```text
┌─ ARGUS · JUDGMENT RECEIPT ───────────────────────────────────┐

  What I predicted                              saved 2026-07-02
    "churn stays flat for 30 days after the new pricing ships"
    check-by 2026-08-01

  What actually happened                     recorded 2026-08-03
    Churn rose 2pp. Poor plan-migration messaging did most of it.

  This call was made by: me (not the model)

  ───────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  The model never graded you. Reality answered.
└──────────────────  argus · prediction saved → reality recorded ⚓ ─┘
```

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
  registers the `argus-decision-mcp` stdio server at an **exact pinned version**,
  so the decision tools (capture, record, predict, check-in, resolve, patterns,
  settings) are available to the model immediately. The pin is deliberate: `npx` reuses a
  cached install whenever the spec is a range, so a `@^1`-style wire can sit
  frozen on an old build indefinitely. `argus_check_in` reports the version it is
  actually running (`data.server_version`) and `/argus:doctor` compares it to the
  pin, so a stale wire is visible instead of being felt as missing behavior.
- **Quiet hooks** — a session-start check that mentions decisions whose check-by
  date has arrived (and refreshes a stale decision view), plus an ambient trigger
  that may ask about at most one due item
  per session (4-hour cooldown across sessions; silence is the default). Opt out
  with `{ "ambient": { "opt_out": true } }` in `~/.argus/config.json`.
- **`/argus:doctor`** — a read-only self-diagnosis of the install and wiring. It
  repairs nothing; each line names the public tool that can.
- **Statusline (optional)** — [`statusline/index.js`](./statusline/index.js) reads
  your local decision records. Enable it with one line in `~/.claude/settings.json`:
  `"statusLine": { "type": "command", "command": "node ${CLAUDE_PLUGIN_ROOT}/statusline/index.js" }`

Uninstalling the plugin never deletes your decision records — the files under
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
- `check` is the return loop — what is due now, show the original before asking,
  append the user's answer, save a candidate for later (`/argus:check <id>`),
  or re-check premises (`/argus:check premises`).
- `history` is the record — decision log, one decision's version tree, a neutral
  chronology, and `/argus:history scan` to recover
  decisions from past Claude Code chats.
- `settings` is setup — language and boss persona, webapp pairing and sync.

Older command names are retired. The former step commands are internal files;
`review`, `check`, `history`, `settings`, and `help` are the complete public
surface.

Argus may show a short local reminder when something is ready to check. It does
not judge, settle, or sync automatically.

---

## Webapp Sync

The plugin is local-first. Webapp sync is optional.

Connect this project once:

```text
/argus:settings connect
```

Argus opens a browser approval page. The credential returns directly to the
local plugin and is stored in a git-ignored file; do not paste it into chat.
After approval, new saved checks can sync automatically. To reconcile both
directions on demand, use:

```text
/argus:settings sync
```

Sync first pulls webapp actions into the local decision record, then pushes the updated
local records back to the webapp. Re-running it is safe.

Nothing is sent before browser approval. Auto-sync can be disabled with
`/argus:settings push --auto off`.

---

## Commands

| Command | Use it when |
|---|---|
| `/argus:review` | You want a decision or artifact pressure-tested by the full reviewer pipeline. |
| `/argus:check` | A return is due, you want to append an answer, save a candidate (`<id>`), or re-check premises. |
| `/argus:history` | You want the decision chronology, a version tree (`versions`), or `scan`. |
| `/argus:settings` | You want to configure Argus or pair/sync the webapp (`connect`, `sync`). |
| `/argus:help` | You want the shortest command map. |

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
- Webapp sync is off until browser approval. After approval, saved checks may
  auto-sync; the user can turn that off at any time.

Review `.argus/` before sharing or committing it.

---

## Development

```bash
claude --plugin-dir ./argus-plugin-v2
node ./argus-plugin-v2/scripts/validate-plugin.js
node ./argus-plugin-v2/scripts/simulate-plugin.js
```

Restart Claude Code after editing skill files. Skill bodies are cached at
session start.

## Reference

- Web app: https://argus.voyage · Source & issues: https://github.com/commet/Argus · MCP on npm: https://www.npmjs.com/package/argus-decision-mcp
- Changelog: `CHANGELOG.md`
- Bounded reviewer roles: `agents/`
- Boss tone skins (voice only — the review's substance is the configured seat): `data/boss-types.yaml`
- Schemas: `data/schemas/*.json`

## License

MIT
