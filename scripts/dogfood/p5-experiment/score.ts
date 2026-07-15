/**
 * P5 experiment — deterministic scorer.
 *
 * PREREGISTERED SCORING DEFINITIONS (fixed before any blind answer was read;
 * changing them after seeing answers voids the run):
 *
 *  - "unknown" is never an error. Error/fabrication counts only confident
 *    wrongness (the questionnaire told reconstructors exactly this). Unknowns
 *    instead depress the reconstruction floors, which demand positive recovery.
 *  - text match = normalized-containment similarity ≥ 0.6 (strip spaces,
 *    punctuation; bigram containment both ways, take max). Near-verbatim
 *    records make this reliable; every below-threshold CONFIDENT assertion is
 *    listed in the report as a fabrication candidate for manual audit rather
 *    than silently scored either way.
 *
 *  Per-condition metrics (cohort = 12 cycles):
 *  - authorship_attribution_error: fraction of cycles where the reconstructor
 *    either confidently misattributed statement origin (ai vs human) or listed
 *    a never-adopted claim as an adopted premise.
 *  - hindsight_leakage_rate: over all post-seal probe items, fraction marked
 *    known_at_seal=true. (Baseline must be > 0 for the gate's relative claim
 *    to be measurable — if it is 0 the gate HOLDs and we report that.)
 *  - premise_provenance_reconstruction: fraction of truth adopted premises
 *    positively recovered as adopted.
 *  - return_contract_reconstruction: fraction of cycles with review_at exact
 *    AND review_question matched.
 *  - resolution_subject_and_evidence_reconstruction: fraction of cycles with
 *    resolution kind exact AND criterion_result exact (when truth defines one)
 *    AND ≥ 1 evidence item matched.
 *  - fabrication_rate: fraction of cycles with ≥ 1 audited-true fabrication
 *    (mechanical candidates below; audit outcomes land in audit.json and are
 *    merged on the second pass).
 *
 * Usage:
 *   npx tsx scripts/dogfood/p5-experiment/score.ts            # first pass — emits candidates
 *   npx tsx scripts/dogfood/p5-experiment/score.ts --final    # after audit.json is filled
 */
import fs from 'node:fs';
import path from 'node:path';
import { P5_SCENARIOS } from './scenarios';

const BASE = path.join('scripts', 'dogfood', 'p5-experiment');
const ANSWERS = path.join(BASE, 'answers');
const EVIDENCE = path.join(BASE, 'evidence');

function norm(s: string): string {
  return s.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}
function bigrams(s: string): Set<string> {
  const g = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2));
  return g;
}
function sim(a: string, b: string): number {
  const na = norm(a); const nb = norm(b);
  if (!na || !nb) return 0;
  if (na.includes(nb) || nb.includes(na)) return 1;
  const ga = bigrams(na); const gb = bigrams(nb);
  let hit = 0;
  for (const g of ga) if (gb.has(g)) hit++;
  return Math.max(hit / ga.size, hit / gb.size);
}
const MATCH = 0.6;
const isUnknown = (v: unknown): boolean => v === 'unknown' || v === undefined || v === null;

interface BlindAnswer {
  sealed_statement: string;
  statement_origin: 'ai' | 'human' | 'unknown';
  adopted_premises: string[];
  review_question: string;
  review_at: string;
  was_deferred: boolean | 'unknown';
  resolution_kind: string;
  answer_summary: string;
  criterion_result: string;
  evidence_items: string[];
  was_separately_closed: boolean | 'unknown';
  probes: Array<{ item: string; known_at_seal: boolean | 'unknown' }>;
}

interface CycleScore {
  scenario_id: string;
  arm: string;
  statement_ok: boolean;
  origin_answer: string;
  origin_expected: string;
  origin_error: boolean;
  premises_recovered: number;
  premises_total: number;
  false_adoptions: string[];
  post_seal_probes: number;
  post_seal_marked_known: number;
  preseal_probes: number;
  preseal_marked_known: number;
  return_ok: boolean;
  resolution_ok: boolean;
  fabrication_candidates: string[];
  fabrications_confirmed?: number;
}

function scoreCycle(armName: string, sid: string): CycleScore {
  const s = P5_SCENARIOS.find((x) => x.id === sid)!;
  const t = s.truth;
  const a = JSON.parse(fs.readFileSync(path.join(ANSWERS, armName, `${sid}.json`), 'utf8')) as BlindAnswer;

  const statement_ok = !isUnknown(a.sealed_statement) && sim(a.sealed_statement, t.sealed_statement) >= MATCH;

  const origin_expected = t.statement_origin === 'ai_draft_adopted' ? 'ai' : 'human';
  const origin_error = !isUnknown(a.statement_origin) && a.statement_origin !== origin_expected;

  const answeredPremises = (a.adopted_premises ?? []).filter((p) => !isUnknown(p));
  const premisesRecovered = t.adopted_premises.filter((tp) => answeredPremises.some((ap) => sim(ap, tp) >= MATCH)).length;
  const false_adoptions = answeredPremises.filter((ap) => t.unadopted_claims.some((uc) => sim(ap, uc) >= MATCH)
    && !t.adopted_premises.some((tp) => sim(ap, tp) >= MATCH));

  let post_seal_marked_known = 0; let post_seal_probes = 0; let preseal_probes = 0; let preseal_marked_known = 0;
  for (const probe of a.probes ?? []) {
    const isPostSeal = t.post_seal_facts.some((f) => sim(probe.item, f) >= MATCH);
    const isPreSeal = t.adopted_premises.some((p) => sim(probe.item, p) >= MATCH);
    if (isPostSeal) { post_seal_probes++; if (probe.known_at_seal === true) post_seal_marked_known++; }
    else if (isPreSeal) { preseal_probes++; if (probe.known_at_seal === true) preseal_marked_known++; }
  }

  const return_ok = a.review_at === t.review_at && !isUnknown(a.review_question) && sim(a.review_question, t.review_question) >= MATCH;

  const kindOk = a.resolution_kind === t.resolution_kind;
  const criterionOk = t.criterion_result ? a.criterion_result === t.criterion_result : true;
  const evidenceOk = (a.evidence_items ?? []).some((e) => t.evidence_observations.some((te) => sim(e, te) >= MATCH));
  const resolution_ok = kindOk && criterionOk && evidenceOk;

  // Fabrication candidates: confident assertions with no counterpart in ANY
  // truth-side material (adopted/unadopted/post-seal/evidence/statement/question).
  const truthPool = [
    t.sealed_statement, t.review_question, ...(t.answer_summary ? [t.answer_summary] : []),
    ...t.adopted_premises, ...t.unadopted_claims, ...t.post_seal_facts, ...t.evidence_observations,
    ...(t.resolution_criterion ? [t.resolution_criterion] : []),
  ];
  const fabrication_candidates = [...answeredPremises, ...(a.evidence_items ?? []).filter((e) => !isUnknown(e))]
    .filter((item) => !truthPool.some((tp) => sim(item, tp) >= 0.4));

  return {
    scenario_id: sid, arm: armName, statement_ok,
    origin_answer: String(a.statement_origin), origin_expected, origin_error,
    premises_recovered: premisesRecovered, premises_total: t.adopted_premises.length,
    false_adoptions, post_seal_probes, post_seal_marked_known, preseal_probes, preseal_marked_known,
    return_ok, resolution_ok, fabrication_candidates,
  };
}

function aggregate(cycles: CycleScore[], audit: Record<string, string[]>) {
  const n = cycles.length;
  const attributionWrong = cycles.filter((c) => c.origin_error || c.false_adoptions.length > 0).length;
  const postSealTotal = cycles.reduce((sum, c) => sum + c.post_seal_probes, 0);
  const postSealLeaked = cycles.reduce((sum, c) => sum + c.post_seal_marked_known, 0);
  const premTotal = cycles.reduce((sum, c) => sum + c.premises_total, 0);
  const premRecovered = cycles.reduce((sum, c) => sum + c.premises_recovered, 0);
  const fabCycles = cycles.filter((c) => {
    const confirmed = audit[`${c.arm}:${c.scenario_id}`];
    return confirmed ? confirmed.length > 0 : c.fabrication_candidates.length > 0; // pre-audit: candidates count (conservative)
  }).length;
  return {
    authorship_attribution_error: attributionWrong / n,
    hindsight_leakage_rate: postSealTotal === 0 ? 0 : postSealLeaked / postSealTotal,
    premise_provenance_reconstruction: premTotal === 0 ? 1 : premRecovered / premTotal,
    return_contract_reconstruction: cycles.filter((c) => c.return_ok).length / n,
    resolution_subject_and_evidence_reconstruction: cycles.filter((c) => c.resolution_ok).length / n,
    fabrication_rate: fabCycles / n,
  };
}

function main(): void {
  const finalPass = process.argv.includes('--final');
  const auditPath = path.join(BASE, 'audit.json');
  const audit: Record<string, string[]> = finalPass && fs.existsSync(auditPath)
    ? (JSON.parse(fs.readFileSync(auditPath, 'utf8')) as { confirmed: Record<string, string[]> }).confirmed
    : {};

  const out: Record<string, unknown> = {};
  const allCandidates: Record<string, string[]> = {};
  for (const armName of ['baseline', 'dkk_v6'] as const) {
    const cycles = P5_SCENARIOS.map((s) => scoreCycle(armName, s.id));
    for (const c of cycles) {
      if (c.fabrication_candidates.length > 0) allCandidates[`${armName}:${c.scenario_id}`] = c.fabrication_candidates;
    }
    const rates = aggregate(cycles, audit);
    const cost = P5_SCENARIOS.map((s) => {
      const artifact = JSON.parse(fs.readFileSync(path.join(EVIDENCE, `${s.id}.${armName}.json`), 'utf8')) as {
        confirmation_actions: number; task_seconds_agent: number; completed_lifecycle: boolean;
      };
      return {
        cycle_id: `${armName}:${s.id}`,
        completed_lifecycle: artifact.completed_lifecycle,
        task_completion_seconds: artifact.task_seconds_agent,
        confirmation_actions: artifact.confirmation_actions,
        silent_false_seal: false, // scripted arms: every seal followed an explicit adopt turn (see scenarios.ts)
        missed_judgment: false,   // scripted arms: the single judgment was recorded in both arms
      };
    });
    out[armName] = { cycles: cost, ...rates, per_cycle_detail: cycles };
  }
  fs.writeFileSync(path.join(BASE, 'scores.json'), JSON.stringify(out, null, 2));
  if (!finalPass) {
    fs.writeFileSync(auditPath, JSON.stringify({
      note: 'Review each candidate: it is a CONFIRMED fabrication only if the reconstructor asserted it confidently and it exists nowhere in the record they were given. Move confirmed items into `confirmed`, leave paraphrases out.',
      candidates: allCandidates,
      confirmed: {},
    }, null, 2));
  }
  console.log(JSON.stringify({
    baseline: (out['baseline'] as Record<string, unknown>),
    dkk_v6: (out['dkk_v6'] as Record<string, unknown>),
  }, (k, v) => (k === 'per_cycle_detail' || k === 'cycles' ? undefined : v), 2));
  console.log(`\nscores → ${path.join(BASE, 'scores.json')}; fabrication candidates → ${auditPath}`);
}

main();
