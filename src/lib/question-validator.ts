/**
 * Question Quality Gate — Layer 1: deterministic validator
 * (DESIGN-clarify-question-system-v2 §6.2).
 *
 * Every question that goes to the user passes through here first. Pure, sync,
 * <1ms, fully fixture-tested. A reject is a HARD floor: the caller regenerates
 * (≤2, with the reason injected into the prompt) and, on exhaustion, draws from
 * the safe fallback pool. Layer 2 (an optional LLM judge for tilt/leading) is a
 * hook only, off by default — deterministic is the floor, the judge is the
 * increment (CODEX Open Q7 → §6.3).
 *
 * Honesty note: R2 (category options) and R3 (re-ask) are heuristics, not proofs.
 * A false reject burns a regen attempt, which is worse than a false pass, so
 * both lean permissive — when unsure, pass and let Layer 2 (if enabled) catch it.
 */

import { matchBannedPattern, OPTION_MIN_AVG_LEN, CATEGORY_OPTION_WORDS, type RejectRule, type RuleLocale } from './question-rules';
import { pickSafeFallbackQuestion } from './question-fallbacks';

export interface ValidateInput {
  /** The question shown to the user. */
  text: string;
  /** Option labels (empty for short-answer questions). */
  options?: string[];
  /** The question type tag (QuestionTypeTag | 'checkpoint_seed'). Kept loose so
   *  this module doesn't couple to the type union and stays forward-compatible. */
  tag?: string;
  locale: RuleLocale;
  /** snapshot.request_type. A defined non-'open' value here means the structural
   *  gate was bypassed → R5 throws (fail loud). Undefined → R5 is skipped. */
  requestType?: string;
  /** Prior Q&A this session — R3 re-ask detection. */
  previousQA?: Array<{ q: string; a: string }>;
  /** The user's own original problem text — also checked for R3 re-ask. */
  userText?: string;
  /** checkpoint_seed only (R6): whether a load-bearing premise is linked. */
  hasLinkedPremise?: boolean;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; rule: RejectRule; detail: string };

/** R5 — a non-open request reached the validator: the structural gate
 *  (pickNextQuestionType) was bypassed. Thrown, not returned, so the bug is
 *  loud. The engine's runTypedQuestion try/catch degrades it to the safe
 *  fallback in production; tests assert the throw. */
export class OverFireError extends Error {
  constructor(public requestType: string) {
    super(`Question generated on a non-open request (request_type='${requestType}') — the structural gate was bypassed.`);
    this.name = 'OverFireError';
  }
}

// ── text normalization (shared with re-ask math) ────────────────────────────
function norm(s: string): string {
  return (s ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

// ── R2: category options ────────────────────────────────────────────────────
const CATEGORY_SET = new Set(CATEGORY_OPTION_WORDS.map(w => w.toLowerCase()));

function isCategoryOptions(options: string[], locale: RuleLocale): boolean {
  // Conservative: need 3+ options to judge shape at all (§6.2 R2).
  if (options.length < 3) return false;
  const floor = OPTION_MIN_AVG_LEN[locale];
  const avgLen = options.reduce((s, o) => s + o.trim().length, 0) / options.length;
  const allShortOrCategory = options.every(o => {
    const t = o.trim();
    return t.length < floor || CATEGORY_SET.has(t.toLowerCase());
  });
  // Reject only when ALL options are short/category AND the average is below the
  // floor — a real fork ("범위를 좁혀 먼저 검증한다") clears this easily.
  return allShortOrCategory && avgLen < floor;
}

// ── R3: re-ask (character-trigram overlap) ─────────────────────────────────
/** Korean spacing/조사 variance breaks word n-grams, so compare on character
 *  trigrams of the normalized text (§6.2 heuristic note). */
const REASK_OVERLAP = 0.7;
const REASK_MIN_LEN = 8; // don't compare against trivially short priors

function trigrams(s: string): Set<string> {
  const t = norm(s).replace(/ /g, '');
  const g = new Set<string>();
  for (let i = 0; i + 3 <= t.length; i++) g.add(t.slice(i, i + 3));
  return g;
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return shared / Math.min(a.size, b.size);
}

function isReask(text: string, priors: string[]): boolean {
  const cur = trigrams(text);
  if (cur.size < 3) return false;
  for (const p of priors) {
    if (norm(p).length < REASK_MIN_LEN) continue;
    if (overlap(cur, trigrams(p)) >= REASK_OVERLAP) return true;
  }
  return false;
}

/**
 * Validate a question against the deterministic quality floor. Pure.
 * Throws OverFireError (R5) when a defined non-open request reached generation.
 */
export function validateQuestion(input: ValidateInput): ValidationResult {
  // R5 — over-fire (fail loud). Only when request_type is explicitly non-open.
  if (input.requestType && input.requestType !== 'open') {
    throw new OverFireError(input.requestType);
  }

  const text = input.text ?? '';
  const options = (input.options ?? []).filter(o => typeof o === 'string' && o.trim().length > 0);

  // R6 — forced checkpoint: a checkpoint_seed with no linked premise (or on a
  // non-open request, though R5 already caught that) is manufactured ceremony.
  if (input.tag === 'checkpoint_seed' && input.hasLinkedPremise === false) {
    return { ok: false, rule: 'forced_checkpoint', detail: 'checkpoint_seed with no linked load-bearing premise' };
  }

  // R1 / R4 / confirmation-bias — banned patterns in the question or any option.
  const bannedInText = matchBannedPattern(text);
  if (bannedInText) return { ok: false, rule: bannedInText.rule, detail: `banned pattern in question: ${bannedInText.note}` };
  for (const o of options) {
    const b = matchBannedPattern(o);
    if (b) return { ok: false, rule: b.rule, detail: `banned pattern in option "${o}": ${b.note}` };
  }

  // R2 — category options.
  if (isCategoryOptions(options, input.locale)) {
    return { ok: false, rule: 'category_options', detail: 'options are bare category nouns, not real forks' };
  }

  // R3 — re-asking something already known.
  const priors = [
    ...(input.previousQA ?? []).map(qa => qa.q),
    ...(input.userText ? [input.userText] : []),
  ];
  if (isReask(text, priors)) {
    return { ok: false, rule: 'reask_known', detail: 're-asks a theme already in the transcript' };
  }

  return { ok: true };
}

/**
 * Last-line floor for ANY user-facing question, not just typed ones (§6.2
 * coverage note — legacy/generic/deepening questions must be covered too, or the
 * gate is a "quality probability", not a floor). A banned question text is
 * swapped for a safe crux from the fallback pool; the caller then drops any
 * now-stale options. Cheap, sync, no LLM — the honest-gap version of regen for
 * paths that can't be regenerated. */
export function guardQuestionText(
  text: string,
  locale: RuleLocale,
  seed?: string,
): { text: string; banned: boolean } {
  if (matchBannedPattern(text)) {
    return { text: pickSafeFallbackQuestion(locale, seed), banned: true };
  }
  return { text, banned: false };
}

// ── Layer 2 hook (off by default) ───────────────────────────────────────────
export type SemanticValidator = (
  input: ValidateInput,
) => Promise<{ verdict: 'pass' | 'reject' | 'abstain'; reason?: string }>;

let _semantic: SemanticValidator | null = null;
/** Wire an optional LLM judge (§6.3). abstain=pass. Left null in Phase 1. */
export function setSemanticValidator(fn: SemanticValidator | null): void {
  _semantic = fn;
}
export function getSemanticValidator(): SemanticValidator | null {
  return _semantic;
}
