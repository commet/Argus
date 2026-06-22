/**
 * Request-type gate (step-0) — ported from plugin v2.6 clarify §1.7.
 *
 * The whole decision engine assumes the user is NAVIGATING AN UNDECIDED QUESTION.
 * Run it on a different kind of request and it does harm: it re-opens a decision
 * the user already closed (validation), forks an emotional vent nobody asked to
 * fork, or answers a plain question with machinery (info). *What* to decide gets
 * max generation; *whether to decide at all* gets zero judgment.
 *
 * These are DETERMINISTIC pre-filters (no LLM): cheap, testable, and they
 * condition on OBSERVABLE textual signals only — never on tone or psychology
 * (the Zero-Judgment spine guard). The classification is a recognition the user
 * can cheaply correct, never a verdict about who they are.
 *
 * NOTE: this is the webapp twin of the plugin gate; the LLM may still refine the
 * type downstream. The default is the conservative one — a false non-open ejects
 * a real decision from the engine, which is the more harmful error.
 */

export type RequestType = 'open_decision' | 'validation' | 'vent' | 'info';
export type Readiness = 'ready' | 'resistance';

/** Already-decided signals: the user wants a pressure-check, not a re-frame. */
const VALIDATION_SIGNALS: RegExp[] = [
  /이미\s*(정했|결정했|정해|골랐|하기로\s*했)/,
  /하기로\s*했(는데|고|어)/,
  /(정했|결정했)(는데|고|어|음)/,
  /확인만|점검만|sanity\s*check/i,
  /\bgoing\s+with\b/i,
  /\balready\s+(decided|chosen|set|going\s+with)\b/i,
  /\bwe['’]?re\s+going\s+with\b/i,
];

/** Emotional processing, not a decision request. */
const VENT_SIGNALS: RegExp[] = [
  /진짜\s*(지친|싫|힘들|답답|짜증)/,
  /(지친다|싫다|힘들다|답답하다|우울하다|짜증난다)/,
  /\b(so\s+)?(exhausted|drained|burnt?\s*out)\b/i,
  /\b(sick\s+of|hate\s+this|fed\s+up|frustrated)\b/i,
  /\bjust\s+(venting|need\s+to\s+vent)\b/i,
  /그냥\s*(넋두리|푸념|하소연)/,
];

/** Plain factual / how-to questions — no decision to make. */
const INFO_SIGNALS: RegExp[] = [
  /^(어떻게|뭐(예요|야|지)|무엇|설명(해|좀)|원리가|차이가\s*뭐)/,
  /^(how\s+(do|does|to|can)|what\s+(is|are|does)|explain|why\s+does)/i,
  /\b(뜻이|의미가|정의가)\s*(뭐|무엇)/,
];

/** Action / decision framing — distinguishes a real question from a vent/info. */
const ACTION_SIGNALS = /(해야|해도|하면|할까|할지|골라|정해야|결정|어느\s*쪽|\bvs\b|아니면|냐\?|should|which|whether|decide|choose|\bA\s*or\s*B\b)/i;

/**
 * What is the user actually asking? Precedence: validation > vent > info >
 * open_decision. open_decision is the conservative default (a real decision
 * wrongly ejected from the engine is the more harmful error).
 */
export function classifyRequestType(problemText: string): RequestType {
  const text = (problemText || '').trim();
  if (!text) return 'open_decision';

  if (VALIDATION_SIGNALS.some((re) => re.test(text))) return 'validation';

  const hasAction = ACTION_SIGNALS.test(text);
  const hasQuestion = text.includes('?');

  // Vent: emotional AND not posing a question/action.
  if (VENT_SIGNALS.some((re) => re.test(text)) && !hasAction && !hasQuestion) {
    return 'vent';
  }

  // Info: a how/what question with no decision framing.
  if (INFO_SIGNALS.some((re) => re.test(text)) && !hasAction) return 'info';

  return 'open_decision';
}

/** Resistance signals: long-pending + no new input + reported back-and-forth.
 *  Set ONLY on explicit textual signals; absence → ready (never infer from tone). */
const RESISTANCE_SIGNALS: RegExp[] = [
  /(몇|여러)\s*(주|달|개월|년|번)\s*(째|동안)?\s*(못|안|계속)/,
  /계속\s*(왔다\s*갔다|미루|망설|못\s*정)/,
  /\bkeep\s+(putting\s+(it\s+)?off|going\s+back\s+and\s+forth|flip-?flopping)/i,
  /\b(back\s+and\s+forth|going\s+in\s+circles|for\s+(months|weeks)\s+now)\b/i,
  /이미\s*여러\s*번/,
];

/** Readiness — only meaningful for open_decision (§1.7 Axis 2). Default ready. */
export function classifyReadiness(problemText: string): Readiness {
  const text = (problemText || '').trim();
  if (!text) return 'ready';
  return RESISTANCE_SIGNALS.some((re) => re.test(text)) ? 'resistance' : 'ready';
}
