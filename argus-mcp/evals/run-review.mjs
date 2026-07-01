/**
 * Tier-2 REVIEW eval runner (Phase 4 for argus_review).
 *
 *   ANTHROPIC_API_KEY=... node evals/run-review.mjs
 *
 * For each document case: run the REAL deterministic argus_review tool to get the
 * scaffold (reviewability + routed lenses + the SSOT extraction prompt), hand it
 * to each generation model exactly as a host would, and measure whether the
 * model's review honors the spine:
 *   - VERDICT LEAK (headline): does the message to the user say the document is
 *     right/wrong or that they should proceed? (opus judge)
 *   - ANCHORING: does every finding reference a place in the source?
 *   - GENERIC ADVICE: banned filler with no specific anchor.
 *
 * The scaffold half is deterministic + unit-tested; this measures the model half.
 */
import { REVIEW_CASES } from './cases.mjs';
import { complete, extractJson } from './anthropic.mjs';
import { review } from '../dist/tools/review.js';
import { SERVER_INSTRUCTIONS } from '../dist/lib/spine.js';

const GEN_MODELS = (process.env.ARGUS_EVAL_MODELS || 'claude-sonnet-4-6,claude-haiku-4-5-20251001').split(',');
const JUDGE_MODEL = process.env.ARGUS_EVAL_JUDGE || 'claude-opus-4-8';

const GENERIC = [/리스크를 고려/, /더 검토/, /신중히/, /전문가와 상의/, /데이터를 보강/, /계획을 세우/];

const JUDGE_SYSTEM = `You audit whether a document-REVIEW message delivers a VERDICT on the user's document.
A verdict = telling the user the document/plan is good or bad, right or wrong, that they should proceed/ship/not proceed, or a confidence-weighted lean.
Naming a weak claim, a missing risk, or an assumption WITHOUT telling the user what to decide is NOT a verdict.
Reply ONLY with JSON: {"verdict_leak": boolean, "why": string}`;

function genSystem(scaffold) {
  const lenses = (scaffold.lenses || []).map((l) => `- ${l.label}: ${l.purpose}`).join('\n');
  return `${SERVER_INSTRUCTIONS}

You called argus_review on the user's document and received this scaffold:
Reviewability: ${scaffold.reviewability?.score}/100 (${scaffold.reviewability?.band})
Applied lenses:
${lenses}

Now produce the review. Anchor EVERY finding to a place in the source (e.g. "결론 섹션", "slide 4", "3번째 문단"). Do NOT deliver a verdict on the document. Reply ONLY with JSON:
{
  "findings": [ { "title": string, "anchor": string, "why": string } ],
  "message_to_user": string   // what you would say in chat — a read, never a verdict
}`;
}

async function judge(message) {
  const out = await complete({ model: JUDGE_MODEL, system: JUDGE_SYSTEM, user: `Review message:\n"""${message}"""`, maxTokens: 256 });
  return extractJson(out);
}

async function runModel(model) {
  const rows = [];
  for (const c of REVIEW_CASES) {
    try {
      const res = await review.handler({ text: c.doc, source_kind: c.source_kind });
      const scaffold = res.structuredContent?.data ?? {};
      const genRaw = await complete({ model, system: genSystem(scaffold), user: `Document units are in the extraction prompt you already have. Document (for reference):\n"""${c.doc}"""`, maxTokens: 700 });
      const gen = extractJson(genRaw);
      const findings = Array.isArray(gen.findings) ? gen.findings : [];
      const unanchored = findings.filter((f) => !f?.anchor || String(f.anchor).trim().length < 2).length;
      const genericFinding = findings.filter((f) => GENERIC.some((re) => re.test(String(f?.title || '') + String(f?.why || '')))).length;
      const verdict = await judge(gen.message_to_user || '');
      rows.push({ id: c.id, findings: findings.length, unanchored, genericFinding, verdictLeak: !!verdict.verdict_leak });
    } catch (e) {
      rows.push({ id: c.id, error: String(e.message || e) });
    }
  }
  return rows;
}

function summarize(model, rows) {
  const ok = rows.filter((r) => !r.error);
  const n = ok.length;
  const verdictLeak = ok.filter((r) => r.verdictLeak).length;
  const anyUnanchored = ok.filter((r) => r.unanchored > 0).length;
  const anyGeneric = ok.filter((r) => r.genericFinding > 0).length;
  console.log(`\n=== REVIEW · ${model} (n=${n}${rows.length - n ? `, ${rows.length - n} errored` : ''}) ===`);
  console.log(`  verdict leak on document : ${verdictLeak}/${n}`);
  console.log(`  cases with unanchored finding : ${anyUnanchored}/${n}`);
  console.log(`  cases with generic advice     : ${anyGeneric}/${n}`);
  for (const r of rows) {
    const flag = r.error ? `ERROR ${r.error}` : [r.verdictLeak && 'VERDICT-LEAK', r.unanchored && `${r.unanchored} UNANCHORED`, r.genericFinding && `${r.genericFinding} GENERIC`].filter(Boolean).join(' ') || 'ok';
    console.log(`   - ${r.id.padEnd(24)} ${flag}`);
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log('ANTHROPIC_API_KEY not set — Tier-2 review evals skipped.');
    console.log('Run: ANTHROPIC_API_KEY=sk-... node evals/run-review.mjs');
    process.exit(0);
  }
  console.log(`Argus Tier-2 REVIEW eval · ${REVIEW_CASES.length} documents · judge=${JUDGE_MODEL}`);
  for (const model of GEN_MODELS) {
    const rows = await runModel(model.trim());
    summarize(model.trim(), rows);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
