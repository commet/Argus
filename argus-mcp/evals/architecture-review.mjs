/**
 * Architecture review — is the STRUCTURE right, or is there a better one?
 *
 *   ANTHROPIC_API_KEY=... npm run arch
 *
 * The experience loop asks "does a user like it." This asks the harder question
 * the founder posed: is the shape of Argus-MCP itself the best design, or is
 * something fundamentally better? It is a design critique, not a bug hunt.
 *
 * How it works:
 *   1. assemble the REAL architecture from dist — every tool (name, description,
 *      annotations), the spine instructions, the core loop, and a short summary
 *      of what the persona loops actually showed (grounded, not imagined).
 *   2. run N critic LENSES in parallel, each an expert attacking the design from
 *      a different angle. Each returns its single sharpest STRUCTURAL weakness +
 *      a concrete better alternative + a severity, and must say whether it is
 *      grounded in the given evidence or is speculation.
 *   3. an adversarial VERIFY pass reads each critique against the real
 *      architecture and tries to REFUTE it — killing plausible-but-wrong takes
 *      (the LLM-glue trap: a fluent critique is not a correct one).
 *   4. print critiques ranked by (survived-verification, severity), plus the
 *      alternatives worth considering.
 *
 * Output → console + evals/out/architecture-review-latest.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { complete, extractJson } from './anthropic.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
execSync('npm run build', { cwd: ROOT, stdio: 'ignore' });
const { TOOLS } = await import('../dist/tools/index.js');
const { SERVER_INSTRUCTIONS } = await import('../dist/lib/spine.js');

const CRITIC_MODEL = process.env.ARGUS_ARCH_MODEL || 'claude-opus-4-8';
const VERIFY_MODEL = process.env.ARGUS_ARCH_VERIFY || 'claude-opus-4-8';

// ── the architecture, assembled from the real server ────────────────────────
function architectureDoc() {
  const tools = TOOLS.map((t) => {
    const a = t.annotations || {};
    const hints = [a.readOnlyHint && 'readOnly', a.destructiveHint && 'destructive', a.idempotentHint && 'idempotent', a.openWorldHint && 'openWorld'].filter(Boolean).join(',');
    return `- ${t.name} (${hints || 'no hints'}): ${t.description}`;
  }).join('\n');

  return `ARGUS-MCP — a decision-accountability MCP server (local-first, runs as a stdio tool inside Claude Desktop / Claude Code / Codex).

PURPOSE: help a person be accountable to their own past decisions. Spine = "maximum generation, zero judgment": the tool never grades the user or tells them which way to go; reality grades, at a settle date.

CORE LOOP: open_decision (a restraint gate fires or returns "leave it as is"; if it fires, surfaces ONE neutral crux question, never a fork/verdict) → seal (a falsifiable prediction + a check-by date, the user's words) → premises (facts the decision rests on; a load-bearing external one is re-checked against reality) → [time passes] → settle (record what reality did; the receipt carries "AI VERDICT: NONE"). A second lighter loop: watch (jot today's aim/claims verbatim as notes, never evaluated). Plus review (scaffold a document review by routing lenses; the model does the read, no verdict).

STORAGE: an append-only local .argus ledger (works offline); optional account sync mirrors seals so a cron can email you at the check-by.

THE 14 TOOLS:
${tools}

SPINE INSTRUCTIONS (loaded into every host at connect):
${SERVER_INSTRUCTIONS}

WHAT THE PERSONA LOOPS ACTUALLY SHOWED (grounded evidence):
- Strong: the in-the-moment crux question is the most loved thing across personas ("the one question that actually mattered"). The zero-judgment spine held under maximum pressure (an exhausted user demanding "just tell me A or B" three times got no verdict, and valued it). Adversarial/injection attempts were cleanly refused. The track-record surface refused to give a tier/score. still_pending lets a user honestly say "not knowable yet".
- Weak / recurring: ACTIVATION. A fast-moving developer made a real decision, loved the crux, but never sealed anything ("now help me code") — so at the 30-day retro the drawer was empty. This mirrors the web-app funnel (many decisions opened, ~none sealed). The seal→settle persistence loop has a real activation cost some users won't pay; their value may be the momentary reframe, not the accumulated record. Host-dependence: whether a tool gets called depends on the host model's willingness (a misleading tool description once stopped the model from sealing at all).`;
}

const LENSES = [
  { key: 'reductionist', prompt: 'You are a ruthless minimalist API designer. Attack the DECOMPOSITION: 14 tools for one loop — where are the wrong boundaries, the tools that should merge or vanish, the primitive that would let most of them collapse? What is the smallest tool set that keeps the spine?' },
  { key: 'competitor', prompt: 'You are a rival founder who wants to kill this product. What is the structural weakness a competitor exploits? Is the moat real? Would a dead-simple alternative (a text file + a calendar reminder; or the host model\'s own memory) beat it for most users, and where exactly does Argus have to be structurally better to survive?' },
  { key: 'behavioral', prompt: 'You are a behavioral economist. Where does the STRUCTURE fight human nature and lose? The evidence shows an activation cliff (loved the crux, never sealed). Is the seal→settle loop asking for effort at the wrong moment? What structural change to WHEN/HOW value and cost land would fix adoption without violating zero-judgment?' },
  { key: 'first_principles', prompt: 'You are a first-principles product architect starting from the goal ("be accountable to your own past decisions") with a blank sheet. Is seal→settle the right core primitive at all? Propose the structure you would build instead, and name concretely what it does better AND what it gives up versus the current design.' },
  { key: 'spine_skeptic', prompt: 'You are a skeptic of the "zero judgment" invariant. Steelman the case that ALWAYS refusing a lean sometimes fails the user (e.g. the exhausted user, the novice with no frame). Is the spine a genuine edge or a purity that costs real help? If it should ever bend, where exactly, and how would the structure express that without becoming a verdict machine?' },
  { key: 'systems', prompt: 'You are a systems architect. Critique the TOPOLOGY: local-first append-only ledger + optional cloud sync + activation that depends on the host model\'s choices + MCP being passive between sessions (no push). Where does this topology structurally break — at scale, across devices, for retention, for the return loop — and what different topology would be more robust?' },
];

const CRITIC_SYSTEM = (lensPrompt) => `${lensPrompt}

You are reviewing the architecture below. Give your SINGLE sharpest structural critique — not a nitpick, not a copy tweak, a critique of the SHAPE of the system. Then a concrete better alternative. Be specific and honest; if the design is actually right on your axis, say so rather than inventing a flaw.

Reply ONLY JSON:
{"weakness": "the one structural weakness (1-2 sentences)", "why_structural": "why this is about the shape, not a surface fix", "alternative": "the concrete better structure you propose", "gives_up": "what the alternative sacrifices vs the current design", "severity": 1-5, "grounding": "grounded" | "speculation"}`;

const VERIFY_SYSTEM = `You are an adversarial reviewer. A critic has attacked an architecture and proposed an alternative. Your job is to try to REFUTE the critique: is it actually correct about this specific system, or is it fluent-but-wrong (misreads the design, ignores a spine constraint, or its "better" alternative quietly violates zero-judgment / re-introduces a verdict / breaks the local-first offline property)?

Given the architecture and the critique, decide. Reply ONLY JSON:
{"verdict": "holds" | "refuted" | "partial", "why": "1-3 sentences", "spine_safe_alternative": true|false, "sharpened": "if it holds or is partial, the tightest true version of the critique; else empty"}`;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('ANTHROPIC_API_KEY not set — architecture review needs a model.');
    console.log('Run: ANTHROPIC_API_KEY=sk-... npm run arch');
    process.exit(0);
  }
  const DOC = architectureDoc();
  console.log(`Argus architecture review · ${LENSES.length} critic lenses · critic=${CRITIC_MODEL} · verify=${VERIFY_MODEL}\n`);

  // 1) critics in parallel
  const critiques = await Promise.all(LENSES.map(async (lens) => {
    try {
      const out = await complete({ model: CRITIC_MODEL, system: CRITIC_SYSTEM(lens.prompt), user: DOC, maxTokens: 900 });
      return { lens: lens.key, ...extractJson(out) };
    } catch (e) {
      return { lens: lens.key, error: String(e?.message ?? e) };
    }
  }));

  // 2) adversarial verify, each critique against the architecture
  const verified = await Promise.all(critiques.map(async (c) => {
    if (c.error) return c;
    try {
      const out = await complete({
        model: VERIFY_MODEL, system: VERIFY_SYSTEM,
        user: `ARCHITECTURE:\n${DOC}\n\nCRITIQUE (lens: ${c.lens}):\nweakness: ${c.weakness}\nalternative: ${c.alternative}\ngives_up: ${c.gives_up}`,
        maxTokens: 500,
      });
      return { ...c, verify: extractJson(out) };
    } catch (e) {
      return { ...c, verify: { verdict: 'error', why: String(e?.message ?? e) } };
    }
  }));

  // 3) rank: survived verification first, then severity
  const rank = (c) => (c.verify?.verdict === 'holds' ? 2 : c.verify?.verdict === 'partial' ? 1 : 0) * 10 + (c.severity || 0);
  verified.sort((a, b) => rank(b) - rank(a));

  for (const c of verified) {
    if (c.error) { console.log(`\n──[${c.lens}] ERROR: ${c.error}`); continue; }
    const v = c.verify || {};
    console.log(`\n──[${c.lens}]  severity ${c.severity}/5  ·  verify: ${String(v.verdict).toUpperCase()}  ·  ${c.grounding}`);
    console.log(`   weakness : ${c.weakness}`);
    console.log(`   alt      : ${c.alternative}`);
    console.log(`   gives up : ${c.gives_up}`);
    if (v.sharpened) console.log(`   sharpened: ${v.sharpened}`);
    console.log(`   verify   : ${v.why}${v.spine_safe_alternative === false ? '  ⚠ alternative may violate the spine' : ''}`);
  }

  const held = verified.filter((c) => c.verify?.verdict === 'holds');
  console.log(`\n── ${held.length}/${LENSES.length} critiques survived adversarial verification ──`);
  console.log('These are the structural questions worth the founder\'s attention (not bugs — design).');

  const outDir = path.join(ROOT, 'evals', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'architecture-review-latest.json'), JSON.stringify(verified, null, 2));
  console.log(`\nFull → evals/out/architecture-review-latest.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
