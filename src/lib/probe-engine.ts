/**
 * Probe engine — measurement levers C (분기 탐침) and D (하중 탐침) (W2.1).
 *
 * Prompts are ported VERBATIM from the G0-passing backtest
 * (scripts/decision-watch-eval/lever-backtest-workflow.js) — 재발명 금지.
 * G0 verdict (.argus/eval/G0-verdict.md) sets the weights:
 *
 *   D runAblationProbe   — PRIMARY measurement lever (hit 78.6%, specific 88.9%).
 *   C runDivergenceProbe — question SOURCE, not a hit-finder (hit 57.1% ≈
 *                          noise over baseline). Its forks exist to feed
 *                          fork-to-question (W2.2); never sold as "위험 발견".
 *
 * Transport decision (recorded): no new /api/probe route. Probes ride the
 * existing llm.ts plumbing (callLLMParallel / callLLMJson) — auth, quota
 * (1 call = 1 unit, keeping the ≤30 calls/session budget honest), BYO-key,
 * retry and circuit-breaker come for free; a new route would have duplicated
 * all of it (CLAUDE.md single-source). "샘플 도착 순 emit" = onItemComplete;
 * "집계는 전체 후" = merge after Promise.allSettled. First sample <15s: each
 * sample is its own cheap-model call (~3–8s).
 *
 * Mechanical honesty enforcement (not prompt-trust):
 *  - C: a fork without a non-empty `flipped_user_claim` is DROPPED (P2 인용
 *    앵커의 기계적 강제), and a `cause_quote` that does not actually occur in
 *    the user's paragraph is DROPPED (hallucinated anchor).
 *  - D: a finding whose `removed_sentence` does not occur in the paragraph is
 *    DROPPED; only decision_shift=true && evidence-empty ablations are findings.
 *  - Silence is output: zero forks / zero findings is a valid, honest result.
 *
 * Budget (G0 실측): C batch = N(3) fast samples + 1 default merge = 4 calls.
 * D = 1 call. Per-call log: kind, ms, output chars (token cost is not visible
 * through the proxy — calls × tier is the budget unit the plan tracks).
 */

import { callLLMJson, callLLMParallel } from './llm';
import { sanitizeForPrompt } from './persona-prompt';
import { cSamplePrompt, cForkPrompt, dPrompt } from './prompts/probe-prompts';

// ─── Types ───

/** One independent executor's honest reading of the brief (C sample). */
export interface ProbeSample {
  week1_action: string;
  key_resource: string;
  success_test: string;
  purpose_reading: string;
}

export type ForkField = keyof ProbeSample;

/** A measured divergence between executors, anchored to the user's own words. */
export interface Fork {
  field: ForkField;
  /** The meaningfully different readings the executors actually produced. */
  variants: string[];
  /** The ambiguous phrase in the user's paragraph that caused the split —
   *  verified to occur in the paragraph (else the fork is dropped). */
  cause_quote: string;
  /** The user's implicit claim that flips true/false depending on the fork.
   *  Empty → fork dropped (뻔한 갈림 방지, P2 기계적 강제). */
  flipped_user_claim: string;
}

export interface ProbeCallLog {
  kind: 'c_sample' | 'c_merge' | 'd_ablation';
  ms: number;
  chars: number;
  ok: boolean;
}

export interface DivergenceProbeResult {
  samples: ProbeSample[];
  forks: Fork[];
  /** True when executors converged — the honest "선원들이 같은 곳으로 갔어요" card. */
  silent: boolean;
  /** Forks the merge emitted but mechanical enforcement dropped (for signal logging). */
  dropped: number;
  calls: ProbeCallLog[];
}

export interface Ablation {
  removed_sentence: string;
  decision_shift: boolean;
  /** Quote of in-text support for the sentence's claim; '' = unsupported. */
  evidence_in_text: string;
}

/** A load-bearing claim with no in-text support — D's product. */
export interface AblationFinding {
  load_bearing_claim: string;
  why_unsupported: string;
}

export interface AblationProbeResult {
  ablations: Ablation[];
  findings: AblationFinding[];
  silent: boolean;
  dropped: number;
  calls: ProbeCallLog[];
}

// ─── Prompts: single source — src/lib/prompts/probe-prompts.ts ───
// (P0 winners, verbatim; plugin mirror held in parity by
//  __tests__/probe-prompts-parity.test.ts. 재발명 금지.)

// ─── Mechanical enforcement helpers ───

/** Whitespace/quote-insensitive containment — "does this quote actually occur
 *  in the paragraph?" Tolerates the model trimming or re-spacing the quote,
 *  but NOT paraphrase: a fabricated anchor must fail. */
export function quoteOccursIn(paragraph: string, quote: string): boolean {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/["'""''«»()\[\]{}.,;:!?·…~\-—]/g, '')
      .replace(/\s+/g, '');
  const q = norm(quote);
  if (q.length === 0) return false;
  return norm(paragraph).includes(q);
}

function enforceForks(paragraph: string, raw: unknown): { forks: Fork[]; dropped: number } {
  const FIELDS: ForkField[] = ['week1_action', 'key_resource', 'success_test', 'purpose_reading'];
  const arr = Array.isArray((raw as { forks?: unknown[] })?.forks)
    ? ((raw as { forks: unknown[] }).forks as Record<string, unknown>[])
    : [];
  const forks: Fork[] = [];
  let dropped = 0;
  for (const f of arr) {
    const field = f?.field as ForkField;
    const variants = Array.isArray(f?.variants) ? (f.variants as unknown[]).filter((v) => typeof v === 'string') as string[] : [];
    const cause_quote = typeof f?.cause_quote === 'string' ? f.cause_quote.trim() : '';
    const flipped = typeof f?.flipped_user_claim === 'string' ? f.flipped_user_claim.trim() : '';
    const valid =
      FIELDS.includes(field) &&
      variants.length >= 2 &&
      flipped.length > 0 && // P2 기계적 강제: no flipped claim → no fork
      cause_quote.length > 0 &&
      quoteOccursIn(paragraph, cause_quote); // hallucinated anchor → drop
    if (valid) forks.push({ field, variants, cause_quote, flipped_user_claim: flipped });
    else dropped++;
  }
  return { forks, dropped };
}

function enforceAblations(paragraph: string, raw: unknown): { ablations: Ablation[]; findings: AblationFinding[]; dropped: number } {
  const r = (raw ?? {}) as { ablations?: unknown[]; findings?: unknown[] };
  const ablations: Ablation[] = (Array.isArray(r.ablations) ? r.ablations : [])
    .map((a) => a as Record<string, unknown>)
    .filter((a) => typeof a?.removed_sentence === 'string')
    .map((a) => ({
      removed_sentence: a.removed_sentence as string,
      decision_shift: a.decision_shift === true,
      evidence_in_text: typeof a.evidence_in_text === 'string' ? a.evidence_in_text : '',
    }));

  // Re-derive findings mechanically from ablations (don't trust the model's own
  // findings list), then keep only ones whose claim is anchored in the paragraph.
  const mechanical = ablations.filter(
    (a) => a.decision_shift && a.evidence_in_text.trim() === '' && quoteOccursIn(paragraph, a.removed_sentence),
  );
  const modelFindings = (Array.isArray(r.findings) ? r.findings : []).map((f) => f as Record<string, unknown>);
  const findings: AblationFinding[] = mechanical.map((a) => {
    const match = modelFindings.find(
      (f) => typeof f?.load_bearing_claim === 'string' && quoteOccursIn(a.removed_sentence, f.load_bearing_claim as string),
    );
    return {
      load_bearing_claim: a.removed_sentence,
      why_unsupported:
        match && typeof match.why_unsupported === 'string'
          ? (match.why_unsupported as string)
          : '이 문장을 빼면 결론이 바뀌는데, 문단 안에 이 주장을 받치는 다른 근거가 없어요.',
    };
  });
  const dropped = ablations.filter((a) => a.decision_shift && a.evidence_in_text.trim() === '').length - mechanical.length;
  return { ablations, findings, dropped };
}

// ─── Probes ───

export interface DivergenceProbeOptions {
  /** Sample count (default 3, clamped 3–5 per budget). */
  n?: number;
  /** Re-probe: only look at these fields (경량 재탐침, W2.3 — 세션당 ≤2회는 호출자 책임). */
  fields?: ForkField[];
  /** Fires as each executor's sample lands (도착 순 — drives the theater). */
  onSample?: (index: number, sample: ProbeSample) => void;
  signal?: AbortSignal;
}

/** C 분기 탐침 — N independent executors, no differentiation instructions;
 *  measure where they meaningfully diverge. QUESTION SOURCE, not a hit-finder
 *  (G0). Cost: n fast calls + 1 default call. */
export async function runDivergenceProbe(
  paragraph: string,
  opts: DivergenceProbeOptions = {},
): Promise<DivergenceProbeResult> {
  const n = Math.min(5, Math.max(3, opts.n ?? 3));
  const safe = sanitizeForPrompt(paragraph);
  const calls: ProbeCallLog[] = [];
  const samples: ProbeSample[] = [];

  const t0 = Date.now();
  const sampleShape = {
    week1_action: { type: 'string', required: true },
    key_resource: { type: 'string', required: true },
    success_test: { type: 'string', required: true },
    purpose_reading: { type: 'string', required: true },
  } as const;

  const { results } = await callLLMParallel<ProbeSample>(
    Array.from({ length: n }, () => ({
      messages: [{ role: 'user' as const, content: cSamplePrompt(safe) }],
    })),
    {
      system: '',
      model: 'fast', // 저렴 모델 (haiku급)
      maxTokens: 1024,
      signal: opts.signal,
      shape: sampleShape,
      onItemComplete: (i, s) => {
        calls.push({ kind: 'c_sample', ms: Date.now() - t0, chars: JSON.stringify(s).length, ok: true });
        opts.onSample?.(i, s);
      },
      onItemError: () => {
        calls.push({ kind: 'c_sample', ms: Date.now() - t0, chars: 0, ok: false });
      },
    },
  );
  for (const r of results) if (r) samples.push(r);

  // Fewer than 2 samples → divergence is unmeasurable. Silence, honestly.
  if (samples.length < 2) {
    logCalls('divergence', calls);
    return { samples, forks: [], silent: true, dropped: 0, calls };
  }

  const t1 = Date.now();
  let forks: Fork[] = [];
  let dropped = 0;
  try {
    const merged = await callLLMJson<{ forks: unknown[] }>(
      [{ role: 'user', content: cForkPrompt(safe, samples, opts.fields) }],
      { system: '', model: 'default', maxTokens: 1500, signal: opts.signal },
    );
    calls.push({ kind: 'c_merge', ms: Date.now() - t1, chars: JSON.stringify(merged).length, ok: true });
    const enforced = enforceForks(paragraph, merged);
    forks = enforced.forks;
    dropped = enforced.dropped;
  } catch {
    // Merge failure → no measured forks. Don't fake them (P3).
    calls.push({ kind: 'c_merge', ms: Date.now() - t1, chars: 0, ok: false });
  }

  logCalls('divergence', calls);
  return { samples, forks, silent: forks.length === 0, dropped, calls };
}

export interface AblationProbeOptions {
  signal?: AbortSignal;
}

/** D 하중 탐침 — remove sentences one at a time; a sentence that shifts the
 *  decision with no in-text support is a load-bearing unsupported claim.
 *  PRIMARY measurement lever (G0). Cost: 1 default call. */
export async function runAblationProbe(
  paragraph: string,
  opts: AblationProbeOptions = {},
): Promise<AblationProbeResult> {
  const safe = sanitizeForPrompt(paragraph);
  const calls: ProbeCallLog[] = [];
  const t0 = Date.now();
  try {
    const raw = await callLLMJson<{ ablations: unknown[]; findings: unknown[] }>(
      [{ role: 'user', content: dPrompt(safe) }],
      { system: '', model: 'default', maxTokens: 2000, signal: opts.signal },
    );
    calls.push({ kind: 'd_ablation', ms: Date.now() - t0, chars: JSON.stringify(raw).length, ok: true });
    const { ablations, findings, dropped } = enforceAblations(paragraph, raw);
    logCalls('ablation', calls);
    return { ablations, findings, silent: findings.length === 0, dropped, calls };
  } catch (e) {
    calls.push({ kind: 'd_ablation', ms: Date.now() - t0, chars: 0, ok: false });
    logCalls('ablation', calls);
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    // Probe failure is not a session failure — silence, honestly.
    return { ablations: [], findings: [], silent: true, dropped: 0, calls };
  }
}

/** 호출당 비용 로그 (W2.1 수용 기준). Token cost isn't visible through the
 *  proxy — the budget unit the plan tracks is calls × tier; chars proxy size. */
function logCalls(probe: string, calls: ProbeCallLog[]) {
  if (typeof console === 'undefined') return;
  console.info(
    `[probe:${probe}] calls=${calls.length} ok=${calls.filter((c) => c.ok).length} ` +
      calls.map((c) => `${c.kind}:${c.ms}ms/${c.chars}ch`).join(' '),
  );
}
