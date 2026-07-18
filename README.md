<p align="center">
  <img src="public/voyage/voyage-mast.jpg" alt="Argus — Odysseus bound to the mast before the sirens' song" width="820">
</p>

<h1 align="center">Argus</h1>

<p align="center"><strong>Keeping Judgment Human.</strong></p>
<p align="center">AI took over the execution. Where does your judgment accumulate?</p>

<p align="center">
  <a href="https://www.npmjs.com/package/argus-decision-mcp"><img src="https://img.shields.io/npm/v/argus-decision-mcp?color=A8842F&label=npm%20%C2%B7%20argus-decision-mcp" alt="npm version"></a>
  <img src="https://img.shields.io/badge/Claude%20Code%20plugin-argus%402.10.0-667572" alt="Claude Code plugin">
  <img src="https://img.shields.io/badge/license-open--core-6E8261" alt="license: open-core">
  <img src="https://img.shields.io/badge/local--first-no%20account%20needed-242321" alt="local-first">
</p>

<p align="center">
  <a href="https://argus.voyage"><strong>Web app</strong></a> ·
  <a href="#-try-it-in-30-seconds">Install</a> ·
  <a href="#what-argus-does">What it does</a> ·
  <a href="#the-judgment-receipt">The receipt</a> ·
  <a href="#license">License</a> ·
  <a href="./README.ko.md">한국어</a>
</p>

Argus records the judgment *behind* a decision — the premises it rests on,
**whose premise is whose** (yours vs. the AI's), and one falsifiable prediction —
then comes back when reality answers. Not a better answer: a **living record of
your calls**, settled against what actually happened.

---

## Why "Argus"?

<img align="right" width="210" src="public/images/brand/argus-v2/argus-returning.jpg" alt="Argus — the hound who knew Odysseus beneath the disguise">

Argus is the hound who, after twenty years, knew Odysseus beneath a beggar's
rags — the one who recognized the true master under the disguise. Memory,
recognition, and fidelity that outlast appearances.

That's the whole product. Work with an AI long enough and its smooth voice
quietly takes over your memory of *why* you decided. Argus is the dog at the
door. It **remembers what you believed** when you decided, **notices the hidden
premise** under the fluent answer, **keeps watch** on the signals you chose, and
**returns first** when reality has an answer.

It never decides for you. `AI VERDICT` stays `NONE` — reality does the grading.

---

## ⚡ Try it in 30 seconds

Three doors, one loop. Start with whichever fits.

| | Best for | Get started |
|---|---|---|
| 🌐 **Web app** | Anyone. Nothing to install, no signup. | Open **[argus.voyage](https://argus.voyage)** |
| 🧩 **MCP server** | Any AI assistant that speaks MCP — Claude Desktop, Claude Code, Cursor… | `claude mcp add argus "--" npx -y argus-decision-mcp` |
| 🔌 **Claude Code plugin** | Deciding *inside* a codebase, over real PRs and files. | `/plugin marketplace add commet/Argus`<br>`/plugin install argus@argus` |

<sub>New and not sure? The **web app** needs zero setup. Want Argus in every AI chat? The **MCP server** is the one. (MCP = Model Context Protocol — the open standard assistants use to load tools.) Full setup + tool list in **[argus-mcp/README.md](./argus-mcp/README.md)** and **[argus-plugin-v2/README.md](./argus-plugin-v2/README.md)**.</sub>

---

## What Argus does

Two things — and the second is the one most tools skip.

### ① While you decide — it keeps *your* judgment separate from the AI's

Work with an AI long enough and its assumptions quietly blend into yours. Argus
pulls them apart and keeps them honest:

- **Remember exactly.** Your words, your premises, your prediction — and *whose*
  each one is. A sentence the AI surfaced never quietly becomes yours; provenance
  is tagged, and derived guesses about you never reach a prompt without your
  explicit, revocable grant.
- **Notice beneath the surface.** It surfaces the hidden premise and the real
  question under the fluent answer — without choosing a side for you.

### ② After you decide — it keeps watch and lets reality grade it

- **Keep watch honestly.** It tracks only the signals *you* chose, and re-checks
  the load-bearing premises against reality while the bet is still open. When one
  rate hike breaks the premise under three of your decisions, that's **one**
  re-check, not three.
- **Return first.** It comes back on the date you set — or earlier, when a watched
  premise materially moves.
- **Stay without judging.** Reality answers, you record, Argus keeps the receipt.
  `AI VERDICT` remains `NONE`.

---

## One loop

Everywhere Argus runs, the loop is the same:

1. **Record & separate** — the decision, the premises it rests on, and whose each
   premise is (yours vs. the AI's), in your own words.
2. **Seal** one falsifiable prediction with a check-by date.
3. **Wait quietly** — no nagging; if a watched premise shifts or the date arrives,
   Argus says so once.
4. **Settle** against what actually happened. You answer; the model never grades.
5. **Keep the receipt** — settled predictions accumulate into your own track
   record: calibration you can see, principles you choose to ratify.

<details>
<summary>What that looks like at each door</summary>

- **Web app** — write the decision in one line (or upload a strategy doc); an AI
  crew surfaces the hidden premises, marks what only a human can call, and alerts
  you when a premise changes.
- **MCP server** — talk about a decision naturally in any chat; Argus captures it,
  seals the prediction, and pulls you back on the check-by date.
- **Claude Code plugin** — five commands over your real code and PRs:
  `/argus:review` (deep pressure-test, explicit opt-in) · `/argus:check` ·
  `/argus:history` · `/argus:settings` · `/argus:help`.

</details>

---

## The Judgment Receipt

The artifact at the end. Notice the split: **what the AI assumed** (still
unverified) sits apart from **the call only you could make** — and the model's
verdict is, by design, `NONE`.

```
┌─ ARGUS · JUDGMENT RECEIPT ────────────────────────────────┐
  Prediction saved 2026-04-02      Result recorded 2026-06-30

  THE REAL QUESTION
    Can we cut over without a maintenance window users notice?
  THE UNVERIFIED ASSUMPTION      (the AI's)
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
| Whose reasoning it keeps | the model's answer | **yours** — your premises and prediction, tagged apart from the AI's |
| Who evaluates | the model (scores, confidence) | **nobody** — `AI VERDICT: NONE`; reality settles on the date you set |
| After the chat ends | the reasoning evaporates | Argus **comes back** — check-by dates, premise-change alerts |
| What accumulates | an implicit profile of you | **a record you own**: settled predictions, your calibration, principles *you* ratified |

---

## An honest promise about your data

- **Local first.** The ledger lives in `~/.argus` (MCP/plugin) and your browser
  (web). Uninstalling never deletes your records.
- **No verdict — structurally.** There is no scoring tool to call. The receipt's
  last line is the product's signature, not a marketing slogan.
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
claude mcp add argus "--" npx -y argus-decision-mcp
```

Zero config works — your ledger lives in `~/.argus`. For the full config (Claude
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
`/argus:help`. Aliases kept: `/argus:sail`, `/argus:resolve`. More →
**[argus-plugin-v2/README.md](./argus-plugin-v2/README.md)**.

<details>
<summary>Alternative: copy-install without the plugin system</summary>

```bash
curl -fsSL https://raw.githubusercontent.com/commet/Argus/main/argus-plugin-v2/install.sh | bash
```

Flat-installed skills lose the `argus:` prefix and the automatic reminders — the
plugin install above is the documented experience.

</details>

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
