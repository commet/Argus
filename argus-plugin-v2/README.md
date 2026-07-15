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
/argus:sail "Should we ...?"
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
/argus:sail "Should we migrate from Firestore to Supabase?"
/argus:sail "Is PR 123 safe to merge?"
/argus:sail "Is docs/strategy.md taking us the right way?"
```

You can also just ask in natural language. If your question names a PR, file,
branch, or document, Argus tries to read that artifact and work where the
decision is actually happening.

Supported documents: `pdf`, `md`, `txt`, `pptx`, `docx`, `hwpx`. For `xlsx` and
legacy Office/HWP formats, export to CSV/PDF first.

---

## What It Does

Argus is useful when a decision has enough consequence that a polished answer is
not enough.

The core loop is small:

```text
Decide      /argus:sail
Recover     /argus:scan
Save check  /argus:predict
Return      /argus:resolve
```

Plain language:

- `sail` works the decision you are making now.
- `scan` recovers decision candidates from past Claude Code conversations.
- `seal` saves one sail seed or scan candidate as a later-checkable item.
- `settle` asks what actually happened later.

There is more under the surface. `/argus:sail` usually calls the working commands
for you: `/argus:clarify`, `/argus:team`, `/argus:verify`, `/argus:boss`, and
`/argus:revise`. Use `/argus:journal` and `/argus:versions` for history and decision
state; use `/argus:connect` and `/argus:sync` when you want the webapp paired.

Argus may show a short local reminder when something is ready to check. It does
not judge, settle, or sync automatically.

---

## Webapp Sync

The plugin is local-first. Webapp sync is optional.

First connect this project once:

```text
/argus:connect <argus_pat_...>
```

Then use:

```text
/argus:sync
```

`/argus:sync` first pulls webapp actions into the local ledger, then pushes the
updated local records back to the webapp. Re-running it is safe.

Nothing is sent to the webapp unless you run `/argus:sync` or `/argus:push`.

---

## Commands

| Command | Use it when |
|---|---|
| `/argus:sail` | You have a decision to make. Start here. |
| `/argus:scan` | You want to recover decision candidates from past Claude Code chats. |
| `/argus:predict` | You want to save a check for later. |
| `/argus:resolve` | Argus asks what actually happened, or a check is due. |
| `/argus:journal` | You want to see your decision history and prediction record. |
| `/argus:versions` | You want to inspect a decision/version tree. |
| `/argus:connect` | You want to pair this project with the webapp once. |
| `/argus:sync` | You want the local plugin and webapp to agree. |
| `/argus:help` | You want the shortest command map. |

Advanced commands used by `/argus:sail`: `/argus:clarify`, `/argus:team`,
`/argus:verify`, `/argus:boss`, `/argus:revise`, `/argus:preapprove`.

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

- Changelog: `CHANGELOG.md`
- Agent roster: `data/agents.yaml`
- Boss personas: `data/boss-types.yaml`
- Schemas: `data/schemas/*.json`
- Build log: `BUILD_STATUS.md`
- Test plan: `TEST_PLAN.md`

## License

MIT
