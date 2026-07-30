<p align="center">
  <img src="public/voyage/voyage-mast.jpg" alt="Argus — Odysseus bound to the mast before the sirens' song" width="820">
</p>
<p align="center"><em>
Odysseus bound himself before the Sirens sang.<br>
Argus binds a decision to its premises and return condition before fluency — or hindsight — can rewrite them.
</em></p>

<h1 align="center">Argus</h1>

<p align="center"><strong>Keeping Judgment Human.</strong></p>
<p align="center">AI took over the execution. Where does your judgment accumulate?</p>

<p align="center">
  <a href="https://www.npmjs.com/package/argus-decision-mcp"><img src="https://img.shields.io/npm/v/argus-decision-mcp?color=A8842F&label=npm%20%C2%B7%20argus-decision-mcp" alt="npm version"></a>
  <img src="https://img.shields.io/badge/Claude%20Code%20plugin-argus-667572" alt="Claude Code plugin">
  <img src="https://img.shields.io/badge/license-open--core-6E8261" alt="license: open-core">
  <img src="https://img.shields.io/badge/local--first-no%20account%20needed-242321" alt="local-first">
</p>

<p align="center">
  <a href="https://argus.voyage"><strong>Web app</strong></a> ·
  <a href="#-try-it-in-30-seconds">Install</a> ·
  <a href="#what-argus-does">What it does</a> ·
  <a href="#the-judgment-record">The record</a> ·
  <a href="#license">License</a> ·
  <a href="./README.ko.md">한국어</a>
</p>

Argus records the judgment *behind* a decision — your first words, the premises
it rests on, **whose wording is whose** (yours vs. the AI's), and what should
bring it back. The record may be a claim reality can answer, a commitment, a
standard you chose, or simply a moment worth preserving. Not a better answer: a
living, append-only record of your calls.

---

## Why "Argus"?

<img align="right" width="210" src="public/images/brand/argus-v2/argus-returning.jpg" alt="Argus — the hound who knew Odysseus beneath the disguise">

The mast above and the name **Argus** carry the two halves of the product.
Odysseus bound himself before the Sirens could overtake his judgment. His hound,
Argus, recognized him twenty years later beneath a beggar's rags. One holds a
choice steady against persuasion; the other preserves memory, recognition, and
fidelity beyond time and appearances.

That's the whole product. Work with an AI long enough and its smooth voice
quietly takes over your memory of *why* you decided. Argus is the dog at the
door. It **remembers what you believed** when you decided, **notices the hidden
premise** under the fluent answer, **keeps watch** on the signals you chose, and
**returns first** when reality has an answer.

It never decides for you, and it never grades the person. Reality can answer a
claim; only you can answer what happened to your commitment or standard.

---

## ⚡ Try it in 30 seconds

Three doors, one loop. Start with whichever fits.

| | Best for | Get started |
|---|---|---|
| 🌐 **Web app** | Anyone. Nothing to install, no signup. | Open **[argus.voyage](https://argus.voyage)** |
| 🧩 **MCP server** | Any AI assistant that speaks MCP — Claude Desktop, Claude Code, Cursor… | `claude mcp add argus "--" npx -y argus-decision-mcp` |
| 🔌 **Claude Code plugin** | Deciding *inside* a codebase, over real PRs and files. | `/plugin marketplace add commet/Argus`<br>`/plugin install argus@argus` |

<sub>New and not sure? The **web app** needs zero setup. Want Argus in every AI chat? The **MCP server** is the one. (MCP = Model Context Protocol — the open standard assistants use to load tools.) Full setup + tool list in **[argus-mcp/README.md](./argus-mcp/README.md)** and **[argus-plugin-v2/README.md](./argus-plugin-v2/README.md)**.</sub>

<sub>**What you need:** the web app needs only a browser. The MCP server and the plugin need **Node.js 18+** on your `PATH` (`node --version`; get it from [nodejs.org](https://nodejs.org)). No API key, no account, no config file — records are local files from the first use.</sub>

---

## What Argus does

Two things — and the second is the one most tools skip.

### ① While you decide — it keeps *your* judgment separate from the AI's

Work with an AI long enough and its assumptions quietly blend into yours. Argus
pulls them apart and keeps them honest:

- **Remember exactly.** Your words, your premises, your confirmed call — and *whose*
  each one is. Every premise stays tagged as yours or the AI's, so something the
  model surfaced never quietly becomes your belief.
- **Notice beneath the surface.** It surfaces the hidden premise and the real
  question under the fluent answer — without choosing a side for you.

### ② After you decide — it keeps watch and returns when the question is answerable

- **Keep watch honestly.** It tracks only the signals *you* chose, and re-checks
  the load-bearing premises while your decisions are still open. If several
  decisions depend on the same premise, one material change brings them together
  in a single re-check — showing the connection instead of stacking duplicate
  alerts.
- **Return first.** It comes back on the date you set — or earlier, when a watched
  premise materially moves.
- **Keep the chronology, not a verdict.** Argus shows the original first. You
  append what reality showed, what happened to the commitment, and whether the
  original question still makes sense. No score is stored.

---

## One loop

Everywhere Argus runs, the loop is the same:

1. **Record & separate** — keep the first utterance, the confirmed wording, and
   whether an AI suggestion was adopted.
2. **Make it answerable** — choose what kind of question it is and a useful event
   or fallback date. A moment kept only for the record needs no return.
3. **Wait quietly** — no nagging; if the named event happens or the date arrives,
   Argus says so once.
4. **Return original-first** — you answer reality, commitment, and question
   validity separately. The model never invents the answer.
5. **Keep the chronology** — later wording and answers append. Earlier wording
   stays intact, and no person-level score or win rate is stored.

<details>
<summary>What that looks like at each door</summary>

- **Web app** — write the decision in one line (or upload a strategy doc); an AI
  crew surfaces the hidden premises, marks what only a human can call, and alerts
  you when a premise changes.
- **MCP server** — talk about a decision naturally in any chat; Argus preserves
  the user-authorized record and pulls it back on its event or fallback date.
- **Claude Code plugin** — five commands over your real code and PRs:
  `/argus:review` (deep pressure-test, explicit opt-in) · `/argus:check` ·
  `/argus:history` · `/argus:settings` · `/argus:help`.

</details>

---

## The Judgment Record

The artifact across time. Notice the split: **what the AI proposed** stays apart
from **the wording you authorized**. A later answer appends; it does not rewrite
the earlier statement.

```
┌─ ARGUS · JUDGMENT RECORD ─────────────────────────────────┐
  Confirmed 2026-04-02       Returned 2026-06-30

  FIRST WORDS
    "Can we cut over without a maintenance window users notice?"
  AI-SURFACED ASSUMPTION
    The index rebuild fits inside the replication lag budget.
  MY CONFIRMED CALL
    "Proceed only if measured downtime stays under 5 minutes."
  RETURN CONDITION
    After the production cutover · fallback 2026-06-30

  REALITY         Cutover took 3 minutes, no customer reports.
  STANDARD NOW    Still the same.
  QUESTION        Still valid.
  ─────────────────────────────────────────────────────────
  NO PERSON-LEVEL SCORE OR WIN RATE IS STORED.
└────────────────────── argus · statement → return → answer ┘
```

---

## How it differs from answer tools

| | Answer tools | **Argus** |
|---|---|---|
| Output | a more plausible answer | an **append-only judgment record** |
| Whose reasoning it keeps | the model's answer | **yours**, with AI proposals and adoption lineage kept separate |
| Who evaluates | the model (scores, confidence) | **nobody scores the person**; reality and the user's later answer remain separate facts |
| After the chat ends | the reasoning evaporates | Argus **comes back** — named events plus a fallback date |
| What accumulates | an implicit profile of you | **a chronology you own**: original wording, revisions, conditions, observations, and answers |

---

## An honest promise about your data

- **Local first.** The ledger lives in the current project's `.argus` directory (MCP/plugin) and your browser
  (web). Uninstalling never deletes your records.
- **No human score — structurally.** There is no scoring tool to call, and new
  foundation records reject score-shaped fields at the storage boundary.
- **No silent profiling.** Derived patterns about you are excluded from prompts by
  default; anything that would use them needs your explicit, scoped, revocable
  grant — and leaves a visible trace.

---

## Setup in detail

### 🌐 Web — use it right away

No install, straight in the browser: **[argus.voyage](https://argus.voyage)**.
No account required.

### 🧩 MCP server

Add Argus to any AI assistant that supports MCP (Claude Desktop, Claude Code,
Cursor, …). The fastest path, in Claude Code:

```bash
claude mcp add argus -- npx -y argus-decision-mcp          # this project
claude mcp add -s user argus -- npx -y argus-decision-mcp  # every project
```

Zero config works — your ledger lives in the current project's `.argus`. For the full config (Claude
Desktop, Windows, per-project ledgers, optional account sync) and the six tools,
see **[argus-mcp/README.md](./argus-mcp/README.md)**.

### 🔌 Claude Code plugin

One install wires everything — the skills, the MCP server, and quiet reminders:

```text
/plugin marketplace add commet/Argus
/plugin install argus@argus
```

Restart Claude Code, then from any repo:

```text
/argus:review "the question you need to decide"
```

**Commands (5):** `/argus:review` (deep pressure-test, explicit opt-in) ·
`/argus:check` (settle what is due · seal · premises) · `/argus:history`
(decision log · version tree · scan past chats) · `/argus:settings` ·
`/argus:help`. These are the complete public commands. More →
**[argus-plugin-v2/README.md](./argus-plugin-v2/README.md)**.

<details>
<summary>Local development &amp; optional API key</summary>

```bash
git clone https://github.com/commet/Argus.git
cd Argus
npm install
npm run dev            # runs at http://localhost:3000
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the repo layout, the CI checks, and
the conventions reviewers look for.

**API key (optional, web).** By default the web app works through a server proxy.
To use it without rate limits, pick "Direct Key" mode on the settings page and
enter your Anthropic API key — it is stored only in your browser's localStorage
and is never sent to our server.

</details>

---

## Repository layout

```
src/               # the web app (Next.js — argus.voyage)
argus-mcp/         # the MCP server (npm: argus-decision-mcp, MIT)
argus-plugin-v2/   # the Claude Code plugin (marketplace: argus, MIT)
tools/argus-watch/ # a standalone decision-watch CLI
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

<p align="center">
  <em>Argus translates a way of thinking hidden inside the strategy-planning craft<br>into a form anyone can use — and keeps the judgment where it belongs: with you.</em>
</p>
