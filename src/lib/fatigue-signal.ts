/**
 * Fatigue signal — a DETERMINISTIC read of "stop asking" (DESIGN-clarify-question
 * -system-v2 §7). The router gates the remaining questions on this, not the LLM:
 * "지쳐 보이면 묻지 마라"는 프롬프트 지시가 아니라 구조여야 한다 (rounds 5–8).
 *
 * CRITICAL (§7 주의): one "모르겠다" is NOT fatigue — it's the first-class honest
 * answer this system promotes (it becomes an open_question). Mis-reading it as
 * fatigue robs an honest user of the rest of the flow. So a single weak signal
 * never fires; a weak signal must OVERLAP with another to count.
 */

export interface AnswerRecord {
  /** The user's answer text (option label or free text). */
  value: string;
}

// Explicit "just decide / stop" cues — each alone is enough (§7 A).
const STOP_CUE = /그냥\s*(정해|해)|알아서\s*해|빨리|그만|아무거나|대충\s*해|귀찮|skip it|just (decide|pick|do it)|whatever'?s?\b|hurry/i;
// Escape answers — a weak signal, never fatigue on its own (§7 D + 주의).
const ESCAPE = /모르겠|잘\s*모르|나중에|다음에|don'?t know|not sure|later\b|건너뛰/i;

/** Budget cap: a standard session is 2 questions, max 3 (§4.2). Past that,
 *  stop regardless of the answers' shape. */
export const QUESTION_BUDGET = 3;

/**
 * Decide whether to stop asking, given the answers so far (oldest→newest). Pure.
 *
 *  Immediate (each alone → true):
 *    A. an explicit stop cue in any answer
 *    B. the question budget is already spent (≥ 3 answered)
 *  Weak (need ≥ 2 overlapping → true; §7 주의):
 *    C. the latest answer is very short (< 5 chars) but non-empty
 *    D. an escape ("모르겠다/나중에") was chosen
 *    E. the last three answers shrank monotonically (visible drop-off)
 */
export function detectFatigue(recentAnswers: AnswerRecord[] | undefined): boolean {
  const answers = (Array.isArray(recentAnswers) ? recentAnswers : [])
    .map((a) => (a?.value ?? '').trim());

  // A — explicit stop cue
  if (answers.some((a) => STOP_CUE.test(a))) return true;
  // B — budget spent
  if (answers.length >= QUESTION_BUDGET) return true;

  // weak signals — must overlap
  let weak = 0;
  const last = answers[answers.length - 1] ?? '';
  if (last.length > 0 && last.length < 5) weak++;                 // C
  if (answers.some((a) => ESCAPE.test(a))) weak++;               // D
  if (answers.length >= 3) {                                     // E
    const [a, b, c] = answers.slice(-3);
    if (c.length < b.length && b.length < a.length) weak++;
  }
  return weak >= 2;
}
