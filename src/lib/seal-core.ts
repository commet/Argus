/**
 * Seal brain — drafts a decision into a falsifiable, later-checkable form
 * (the back half of Argus's spine: 전제 → 약속 → 현실 → 보정).
 *
 * Conforms to the canonical ledger shape (ledger-schema.ts LedgerDecision):
 * decision · predicate · falsified_if · check_by. The model returns check_by as
 * a DAY COUNT (not an absolute date) — models are unreliable at "today + 2w =
 * which date", so the caller computes the date with the real clock.
 *
 * Surface-language invariant (ledger-schema.ts): predicate/falsified_if are
 * INTERNAL names. User-facing copy here says "잘 됐다는 신호"/"어떻게 됐어요?" —
 * never 내기/반증/predicate. And the spine: we do NOT judge the decision; the
 * predicate is the user's own bet, framed so reality (not us) is the judge.
 */

export interface SealDraft {
  decision: string;
  predicate: string;
  falsified_if: string;
  /** Suggested horizon in days; caller clamps + converts to a real date. */
  check_by_days: number;
}

export const SEAL_TOOL_NAME = 'seal_decision';

export const SEAL_TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    decision: { type: 'string' as const, description: '무엇을 하기로 했는지 한 문장 / one sentence: what was decided' },
    predicate: { type: 'string' as const, description: '이 결정이 잘 된 것이라면 참이어야 하는, 반증 가능한 한 문장' },
    falsified_if: { type: 'string' as const, description: '위가 틀렸음을 보여줄 구체적 관찰' },
    check_by_days: { type: 'integer' as const, description: '결과가 드러나기에 자연스러운 기간(일수)' },
  },
  required: ['decision', 'predicate', 'falsified_if', 'check_by_days'],
};

const SEAL_SYSTEM_KO = `당신은 사용자의 결정을 '나중에 분명히 판가름 나는 형태'로 봉인하는 것을 돕습니다.
시간이 지나면 맞았는지 틀렸는지 관찰로 확인 가능한 형태로 정리하세요. 도구를 호출해 만드세요:

- decision: 무엇을 하기로 했는지 한 문장 (사용자 관점, 그들의 결정)
- predicate: 이 결정이 '잘 된 것'이라면 참이어야 하는, 반증 가능한 한 문장. 구체적·관찰 가능하게.
  (예: "3개월 안에 신입이 첫 기능을 독립적으로 배포한다")
- falsified_if: 위가 틀렸음을 보여줄 구체적 관찰 (예: "3개월 뒤에도 모든 PR에 시니어 리뷰가 필요하다")
- check_by_days: 결과가 드러나기에 자연스러운 기간(일수). 너무 짧지도 길지도 않게(보통 7~90).

원칙(중요): 사용자를 판단하지 마세요. 결정의 옳고 그름을 말하지 말고, 단지 '나중에 확인
가능한 형태'로만 정리하세요. predicate는 사용자가 거는 베팅이지 당신의 평가가 아닙니다.`;

const SEAL_SYSTEM_EN = `You help seal a user's decision into a form that will clearly resolve later.
Make it checkable by observation once time passes. Call the tool to produce:

- decision: one sentence — what they decided (their view, their decision)
- predicate: a falsifiable sentence that must be TRUE if this decision went well.
  Concrete and observable. (e.g. "Within 3 months the new hire ships a first feature independently")
- falsified_if: a concrete observation that would disprove it (e.g. "After 3 months every PR still needs senior review")
- check_by_days: a natural horizon in days for the outcome to show (usually 7–90)

Principle (important): do NOT judge the user. Don't say whether the decision is right or wrong —
only put it into a later-checkable form. The predicate is the user's bet, not your verdict.`;

export function sealSystemPrompt(locale: 'ko' | 'en'): string {
  return locale === 'ko' ? SEAL_SYSTEM_KO : SEAL_SYSTEM_EN;
}

/** Coerce a forced tool_use input into a SealDraft, clamping the horizon. */
export function coerceSealDraft(obj: unknown): SealDraft | null {
  const o = (obj ?? {}) as Partial<SealDraft>;
  if (typeof o.decision !== 'string' || !o.decision.trim()) return null;
  if (typeof o.predicate !== 'string' || !o.predicate.trim()) return null;
  const days = Number(o.check_by_days);
  return {
    decision: o.decision.trim(),
    predicate: o.predicate.trim(),
    falsified_if: typeof o.falsified_if === 'string' ? o.falsified_if.trim() : '',
    check_by_days: Number.isFinite(days) ? Math.min(180, Math.max(3, Math.round(days))) : 14,
  };
}

/** Format a Date as a local-ish friendly date string (caller passes the date). */
export function formatCheckBy(date: Date, locale: 'ko' | 'en'): string {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return locale === 'ko' ? `${m}월 ${d}일` : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * User-facing seal preview (surface language — no 내기/반증/predicate).
 * Shows: what you're committing, the success signal in plain words, and the date
 * we'll come back to ask.
 */
export function sealPreviewMarkdown(draft: SealDraft, checkByLabel: string, locale: 'ko' | 'en'): string {
  if (locale === 'ko') {
    return [
      '🔒 **이 결정을 기억해 둘게요**',
      '',
      `**${draft.decision}**`,
      '',
      `✓ 잘 됐다는 신호: ${draft.predicate}`,
      `📅 ${checkByLabel}에 — "그래서, 어떻게 됐어요?" 하고 먼저 물어볼게요.`,
      '',
      '이대로 봉인할까요?',
    ].join('\n');
  }
  return [
    '🔒 **I’ll remember this decision**',
    '',
    `**${draft.decision}**`,
    '',
    `✓ Sign it went well: ${draft.predicate}`,
    `📅 On ${checkByLabel} I’ll come back first and ask, “So — how did it go?”`,
    '',
    'Seal it like this?',
  ].join('\n');
}

/** The settle buttons sent with the check-in question. Outcome tokens match the
 *  canonical ledger vocabulary (happened/avoided/partial); 'later' amends the
 *  date instead of settling. callback_data 'st:<id>:<outcome>' (id is a uuid,
 *  no colons) stays well under Telegram's 64-byte limit. */
export function settleKeyboard(id: string, locale: 'ko' | 'en') {
  const ko = locale === 'ko';
  return {
    inline_keyboard: [
      [
        { text: ko ? '✅ 잘 됐어요' : '✅ It happened', callback_data: `st:${id}:happened` },
        { text: ko ? '✋ 안 됐어요' : '✋ It didn’t', callback_data: `st:${id}:avoided` },
      ],
      [
        { text: ko ? '〰 반반' : '〰 Partly', callback_data: `st:${id}:partial` },
        { text: ko ? '⏳ 아직' : '⏳ Not yet', callback_data: `st:${id}:later` },
      ],
    ],
  };
}

/** The check-in question sent on the due date (surface language). */
export function settleQuestionMarkdown(decision: string, predicate: string, locale: 'ko' | 'en'): string {
  if (locale === 'ko') {
    return [
      '⏰ **그래서, 어떻게 됐어요?**',
      '',
      `봉인했던 결정: **${decision}**`,
      `당시 신호: ${predicate}`,
      '',
      '지금 보면 어때요?',
    ].join('\n');
  }
  return [
    '⏰ **So — how did it go?**',
    '',
    `Your sealed decision: **${decision}**`,
    `The sign back then: ${predicate}`,
    '',
    'Looking now — which is it?',
  ].join('\n');
}
