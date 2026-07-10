# Argus

*[한국어 → README.ko.md](./README.ko.md) · English (this document)*

**An important decision shouldn't end at an answer.**

Argus keeps it alive as a **living course**.

It's a judgment system that reframes the question, marks the forks, verifies the
claims, shows your current bearing, and comes back when reality answers.

## ⚡ Install the MCP server (30 seconds)

Argus ships as an **MCP server** — drop it into Claude Code, Claude Desktop,
Cursor, or any MCP host, and your AI gains a *decision-accountability* loop.
In Claude Code, one line does it:

```bash
claude mcp add argus -- npx -y argus-decision-mcp
```

**Zero config** — no API key, no account, your data stays local in `~/.argus`.
Then just tell your AI *"seal a prediction that … by <date>"* and it takes over.

- 📦 npm: [`argus-decision-mcp`](https://www.npmjs.com/package/argus-decision-mcp)
- 🛠️ Full setup (Claude Desktop, Windows, per-project ledger) + the tool list → **[argus-mcp/README.md](./argus-mcp/README.md)**

---

### Three ways to use Argus

Pick the door that fits you — each one links to its own setup guide.

| | Best for | Get started |
|---|---|---|
| 🌐 **Web app** | Anyone. Nothing to install. | Open **[argus.voyage](https://argus.voyage)** |
| 🧩 **MCP server** | Any AI assistant that speaks MCP — Claude Desktop, Claude Code, Cursor, and more. | `claude mcp add argus -- npx -y argus-decision-mcp` → [MCP docs](./argus-mcp/README.md) |
| 🔌 **Claude Code plugin** | Deciding *inside* a codebase (over your PRs and files). | `/plugin marketplace add commet/Argus` → [plugin docs](./argus-plugin-v2/README.md) |

New here and not sure? **Start with the [web app](https://argus.voyage)** — it
needs no setup. If you live in an AI assistant and want Argus available in every
chat, the **[MCP server](./argus-mcp/README.md)** is the one you want.

> *Argus* is the name of the dog who, after Odysseus returned in disguise ten
> years later, recognized his true master beneath the rags. An eye that sees
> what's really there rather than the smooth surface — that's what Argus does.

---

## Why it's needed

If you tell ChatGPT "analyze our competitors," the result is often plausible but
unusable for an actual decision. **Because the question itself was wrong.**

Tools like LangGraph and CrewAI deal with **how** to run AI agents.
Argus deals with **what** should be run.

```
Without Argus:   task → straight to AI → plausible but unusable result
With Argus:      task → a structure for judgment → AI execution → a decision-usable result
```

---

## The voyage to Ithaca

From leaving the harbor to reaching Ithaca — four stages.

| Stage | Name | What it does |
|-------|------|--------------|
| 1 | **Reframe** · redefine the problem | Finds the task's hidden hypotheses, premises, and the real question. The thinking process itself gets narrated. |
| 2 | **Crew** · design the execution | Splits AI/human roles and designs the workflow. The core assumptions and the captain's judgment points are made explicit. |
| 3 | **Rehearsal** · pre-validation | Validates the output ahead of time from stakeholders' perspectives. Classifies risk as critical threat · manageable · silent risk. |
| 4 | **Course correction** · fold in feedback | Iterates the course until it settles, incorporating validation results. Progress is tracked with a convergence index. |

The context found at each stage (hypotheses, premises, assumptions, risks)
carries forward automatically to the next stage. You can watch this **accumulating
context chain** with your own eyes.

---

## You can see the thinking

The core of Argus is showing you the AI's reasoning process itself.

- **Context-chain visibility**: the chain in which a hidden premise from Reframe
  becomes a core assumption in Crew, then a validation target in Rehearsal, is
  shown in the UI.
- **A trajectory of thought**: the output carries the narrative of "the original
  task → the redefined question → the governing idea → risks → convergence."
- **Three-way risk classification**: critical threat (🔴), manageable (🟡), and
  silent risk (🟣) — surfacing even the danger nobody says out loud.
- **The log (looking back)**: post-voyage reflection questions accumulate a
  metacognitive asset.

> "This process itself was worth more than the AI's output." — that's the
> experience Argus is after.

---

## A worked example

**Situation**: the CEO says, "A competitor launched an AI chatbot, so build one
fast."

### 1. Reframe
Pick 3 cards + one sentence of input → the AI analyzes:
> The question isn't "should we build a chatbot?" but
> **"what's the real cause of customer churn?"** — that's what needs answering first.

Hidden hypotheses, unverified premises, and alternative perspectives are laid out
together, and the AI's reasoning is narrated.

### 2. Crew
The AI designs a 7-step workflow automatically. The AI track and the human track
are visualized in parallel:

- 🤖 AI: gather market data, analyze customer reviews
- 🧠 Human: interpret churn causes, make the final call
- ⚑ Checkpoint: a human must validate at stage 3

How the governing idea was derived from Reframe's hypotheses is shown as a link.
The captain's judgment points, core assumptions, and critical path are made explicit.

### 3. Rehearsal
Register personas and simulate feedback on the output:

> **CFO Kim** (influence: high): "Can't request budget without an ROI estimate."
> **Premortem**: "If this plan fails, it's because we decided on a solution
> without customer research."
> **🔴 Critical threat**: "Proceeding with investment without validating market size"
> **🟣 Silent risk**: "Resistance from the existing CS team — nobody says it, but
> everyone knows it."

High-influence stakeholders' concerns get handled first.

### 4. Course correction
Pick which concerns from the rehearsal to resolve → convert them into constraints
→ re-analyze from stage 1. Convergence is tracked with an SVG chart:
`0% → 45% → 78% → 92%`

### The log: looking back
After generating the output, answer three reflection questions:
1. How did your understanding when you first got the instruction differ from your
   understanding now?
2. What was the most surprising discovery in this process?
3. What would you do differently next time you meet a similar task?

### Outputs
From the same thinking process, export into four purpose-fit formats:

- **The Log · Project Brief** — a decision record carrying the trajectory of thought
- **Crew Orders · Prompt Chain** — a set of prompts to feed Claude/ChatGPT in
  order (with context annotations)
- **Full Chart · Agent Spec** — a design doc that becomes the starting point for a
  LangGraph/CrewAI implementation (includes `context_chain`)
- **Checklist · Execution Checklist** — a checklist with assumption-validation
  checkpoints

---

## How it differs from existing tools

| | ChatGPT/Claude | LangGraph/CrewAI | **Argus** |
|---|---|---|---|
| Core question | run it now | how to run? | **what to run?** |
| If the question is wrong? | a plausible useless answer | wrong result, faster | **corrects the question first** |
| Reasoning process | invisible | only in the logs | **visualized as a context chain** |
| Risk validation | none | none | **3-way classification + persona simulation** |
| The more you use it? | from scratch every time | needs code changes | **learns your patterns automatically** |
| Stakeholder validation? | none | none | **influence-based prioritization** |

---

## It gets smarter the more you use it

- **Judgment record**: your question choices, role changes, and issue calls are
  recorded automatically.
- **Pattern learning**: accumulated judgment patterns feed automatically into the
  next AI analysis.
- **Your judgment patterns**: it surfaces insights like "you revised 42% of the
  AI's suggestions — mostly changing AI→human."
- **Persona accuracy**: recording real reactions raises simulation accuracy.
- **Similar-analysis suggestions**: when it finds a past project like your current
  task, it offers it as reference.
- **Log accumulation**: the more projects you run, the more your metacognitive
  asset compounds.

---

## Getting started

### Web (use it right away)

No install, straight in the browser — **[argus.voyage](https://argus.voyage)**

### Claude Code plugin

Structure decisions inside a real codebase. An AI team is deployed as workers to
build a **decision scaffold** over your code, PRs, and files (judgment, not code
generation).

```bash
curl -fsSL https://raw.githubusercontent.com/commet/Argus/main/argus-plugin-v2/install.sh | bash
```

After restarting Claude Code, from any repo:

```
/argus:sail "the question you need to decide"
```

Commands: `/argus:sail` (30-second judgment) · `/argus:team` (deploy an agent team)
· `/argus:boss` (boss simulation) · `/argus:clarify` · `/argus:chart`
More → [argus-plugin-v2/README.md](./argus-plugin-v2/README.md)

### MCP server

Add Argus to any AI assistant that supports MCP (Claude Desktop, Claude Code,
Cursor, …). It gives your AI a **decision-accountability** loop: seal a
falsifiable prediction, then settle it against reality on a date you set — the
model never grades you.

The fastest path, in Claude Code:

```bash
claude mcp add argus -- npx -y argus-decision-mcp
```

Zero config works — your ledger lives in `~/.argus`. For the full config (Claude
Desktop, Windows, per-project ledgers, optional account sync) and the tool list,
see **[argus-mcp/README.md](./argus-mcp/README.md)**.

### Local development

```bash
git clone https://github.com/commet/Argus.git
cd Argus
npm install
npm run dev
```

Runs at `http://localhost:3000`. See [CONTRIBUTING.md](./CONTRIBUTING.md) for the
repo layout, the CI checks, and the conventions reviewers look for.

### API key setup (optional)

By default it works through a server proxy. To use it without rate limits, pick
"direct API key" mode on the settings page and enter your Anthropic API key. The
key is stored only in your browser's localStorage and is never sent to the server.

---

## Tech stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** + **Pretendard Variable** (Korean font)
- **Zustand** (state management + automatic localStorage persistence)
- **Anthropic Claude API** (server proxy or direct call)
- **Web Audio API** (transition-tone synthesis — silent by default)
- **Lucide React** (icons)

---

## Project structure

```
src/
├── app/
│   ├── workspace/       # workspace (the main interface)
│   ├── project/         # project overview + judgment-pattern dashboard
│   └── settings/        # settings (LLM, audio)
├── components/
│   ├── workspace/       # the stage components + workflow graph
│   ├── ui/              # shared UI (StepEntry, Card, Badge, OutputSelector, …)
│   ├── tools/           # personas, feedback (incl. 3-way risk classification)
│   └── landing/         # landing page (the voyage to Ithaca)
├── stores/              # Zustand stores
└── lib/                 # LLM calls, output generation, similarity engine, context builders, audio
```

For the top-level layout (the web app vs. the plugins vs. the MCP server), see
[CONTRIBUTING.md](./CONTRIBUTING.md).

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

*Argus is a project that translates a way of thinking hidden inside the strategy-
planning craft into a form anyone can use. The plugins and MCP are shared as open
source; the web app is shared with its source open. This process itself is worth
more than the AI's output.*
