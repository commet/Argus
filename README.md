# Argus

*[한국어 → README.ko.md](./README.ko.md) · English (this document)*

**Keeping Judgment Human.**

**AI took over the execution. Where does your judgment accumulate?**

Argus records the judgment *behind* a decision — the premises it rests on and a
falsifiable prediction — then comes back when reality answers. Not a better
answer: a **living record of your calls**, settled against what actually
happened.

## ⚡ Install the MCP server (30 seconds)

> Never installed anything? The **[web app](https://argus.voyage)** needs zero
> setup — decide right in the browser. The MCP server below is for using Argus
> *inside* an AI assistant.

Argus ships as an **MCP server** (Model Context Protocol — the open standard AI
assistants use to load tools). Drop it into Claude Code, Claude Desktop, Cursor,
or any MCP host, and your AI gains a *decision-accountability* loop. In Claude
Code, one line does it:

```bash
claude mcp add argus -- npx -y argus-decision-mcp
```

**Zero config** — no API key, no account, your data stays local in `~/.argus`.
Then just tell your AI *"seal a prediction that … by <date>"* and it takes over.

- 📦 npm: [`argus-decision-mcp`](https://www.npmjs.com/package/argus-decision-mcp)
- 🛠️ Full setup (Claude Desktop, Windows, per-project ledger) + the tool list → **[argus-mcp/README.md](./argus-mcp/README.md)**
- 🔌 Using **Claude Code**? There's also a native plugin with slash commands (`/argus:review`, `/argus:check`). Install is two lines: `/plugin marketplace add commet/Argus` then `/plugin install argus@argus` → **[plugin docs](./argus-plugin-v2/README.md)**

---

### Three ways to use Argus

Pick the door that fits you — each one links to its own setup guide.

| | Best for | Get started |
|---|---|---|
| 🌐 **Web app** | Anyone. Nothing to install, no signup. | Open **[argus.voyage](https://argus.voyage)** |
| 🧩 **MCP server** | Any AI assistant that speaks MCP — Claude Desktop, Claude Code, Cursor, and more. | `claude mcp add argus -- npx -y argus-decision-mcp` → [MCP docs](./argus-mcp/README.md) |
| 🔌 **Claude Code plugin** | Deciding *inside* a codebase (over your PRs and files). | `/plugin marketplace add commet/Argus`<br>`/plugin install argus@argus` → [plugin docs](./argus-plugin-v2/README.md) |

New here and not sure? **Start with the [web app](https://argus.voyage)** — it
needs no setup. If you live in an AI assistant and want Argus available in every
chat, the **[MCP server](./argus-mcp/README.md)** is the one you want.

> *Argus* is the name of the dog who, after Odysseus returned in disguise ten
> years later, recognized his true master beneath the rags. An eye that sees
> what's really there rather than the smooth surface — that's what Argus does.

---

## Why it exists

Ask an AI anything and a confident answer arrives in seconds. What never gets
recorded is the part that was *yours*: what you actually decided, what you were
betting on, and — months later — whether reality agreed.

Argus is not another answer tool. It keeps the judgment:

```
Without Argus:  decide → execute → the reasoning evaporates
With Argus:     decide → seal a falsifiable prediction → reality settles it → your record grows
```

## One loop, three doors

Everywhere Argus runs, the loop is the same:

1. **Record** the decision and the premises it rests on — in your own words.
2. **Seal** one falsifiable prediction with a check-by date.
3. **Wait quietly.** No nagging; if a premise shifts or the date arrives, Argus
   says so once.
4. **Settle** against what actually happened. You answer; the model never grades.
5. **Keep the receipt.** Settled predictions accumulate into your own track
   record — calibration you can see, principles you choose to ratify.

What that looks like per door:

- **Web app** — write the decision in one line (or upload a strategy doc); Argus
  reviews it from multiple angles, marks what only a human can call, and alerts
  you when a premise changes.
- **MCP server** — talk about a decision naturally in any chat; capture it,
  seal the prediction, get pulled back on the check-by date.
- **Claude Code plugin** — five commands over your real code and PRs:
  `/argus:review` (deep pressure-test, explicit opt-in) · `/argus:check` ·
  `/argus:history` · `/argus:settings` · `/argus:help`.

The artifact at the end is a **Judgment Receipt**:

```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  Prediction saved 2026-04-02      Result recorded 2026-06-30

  THE REAL QUESTION
    Can we cut over without a maintenance window users notice?
  THE UNVERIFIED ASSUMPTION
    The index rebuild fits inside the replication lag budget.
  HUMAN-ONLY CALL   Whether a 5-minute blip is acceptable.
  …made by          Me. (not the model)

  YOU PREDICTED   "Cutover downtime is under 5 minutes"   (check-by 2026-06-30)
  WHAT HAPPENED   Cutover took 3 minutes, no customer reports.
  ─────────────────────────────────────────────────────────
  AI VERDICT ON THIS DECISION ······················  NONE
  The model never graded you. Reality did.
└──────────────────────────  argus · prediction → reality ─┘
```

---

## How it differs from answer tools

| | Answer tools | **Argus** |
|---|---|---|
| Output | a more plausible answer | a **judgment receipt** — prediction → reality |
| Who evaluates | the model (scores, confidence) | **nobody** — `AI VERDICT: NONE`; reality settles on the date you set |
| After the chat ends | the reasoning evaporates | Argus **comes back** — check-by dates, premise-change alerts |
| What accumulates | an implicit profile of you | **a record you own**: settled predictions, your calibration, principles *you* ratified |

## An honest promise about your data

- **Local first.** The ledger lives in `~/.argus` (MCP/plugin) and your browser
  (web). Uninstalling never deletes your records.
- **No verdict — structurally.** There is no scoring tool to call. The receipt's
  last line is the product's signature.
- **No silent profiling.** Derived patterns about you are excluded from prompts
  by default; anything that would use them needs your explicit, scoped,
  revocable grant — and leaves a visible trace.

---

## Getting started

### Web (use it right away)

No install, straight in the browser — **[argus.voyage](https://argus.voyage)**

### MCP server

Add Argus to any AI assistant that supports MCP (Claude Desktop, Claude Code,
Cursor, …). The fastest path, in Claude Code:

```bash
claude mcp add argus -- npx -y argus-decision-mcp
```

Zero config works — your ledger lives in `~/.argus`. For the full config (Claude
Desktop, Windows, per-project ledgers, optional account sync) and the tool list,
see **[argus-mcp/README.md](./argus-mcp/README.md)**.

### Claude Code plugin

One install wires everything (skills + the MCP server + quiet reminders). In
Claude Code:

```
/plugin marketplace add commet/Argus
/plugin install argus@argus
```

Restart Claude Code, then from any repo:

```
/argus:review "the question you need to decide"
```

Commands (5): `/argus:review` (deep pressure-test, explicit opt-in) ·
`/argus:check` (settle what is due · seal · premises) · `/argus:history`
(decision log · version tree · scan past chats) · `/argus:settings` ·
`/argus:help` — aliases kept: `/argus:sail`, `/argus:resolve`
More → [argus-plugin-v2/README.md](./argus-plugin-v2/README.md)

<details>
<summary>Alternative: copy-install without the plugin system</summary>

```bash
curl -fsSL https://raw.githubusercontent.com/commet/Argus/main/argus-plugin-v2/install.sh | bash
```

Flat-installed skills lose the `argus:` prefix and the automatic reminders —
the plugin install above is the documented experience.
</details>

### Local development

```bash
git clone https://github.com/commet/Argus.git
cd Argus
npm install
npm run dev
```

Runs at `http://localhost:3000`. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the
repo layout, the CI checks, and the conventions reviewers look for.

### API key setup (optional, web)

By default the web app works through a server proxy. To use it without rate
limits, pick "Direct Key" mode on the settings page and enter your Anthropic API
key. The key is stored only in your browser's localStorage and is never sent to
the server.

---

## Repository layout

```
src/               # the web app (Next.js — argus.voyage)
argus-mcp/         # the MCP server (npm: argus-decision-mcp, MIT)
argus-plugin-v2/   # the Claude Code plugin (marketplace: argus, MIT)
docs/ARGUS-BLUEPRINT.md   # the build canon (what gets built, in what order)
```

Details → [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

Argus is **open-core**: the parts meant to spread are open source, and the product
itself is source-available. This repo is **licensed by part** (full explanation →
[LICENSING.md](./LICENSING.md)):

| Part | License | Commercial use |
|---|---|---|
| `argus-plugin-v2/`, `argus-mcp/` (plugin · MCP) | **MIT** (open source) | ✅ Freely |
| Everything else — the **web app core** (`src/`, etc.) | **PolyForm Noncommercial 1.0.0** | ❌ Needs a separate commercial license |

In other words, **the plugin and the MCP server are open source (MIT)** and can be
used freely, including commercially. **The web app source is source-available** —
you can read it, learn from it, and run it personally, but **commercial use is not
permitted**. For a commercial license, open an [issue](https://github.com/commet/Argus/issues).

Trademarks: the "Argus" name, logo, and argus.voyage are trademarks and are not
covered by the licenses above.

---

*Argus translates a way of thinking hidden inside the strategy-planning craft
into a form anyone can use — and keeps the judgment where it belongs: with you.*
