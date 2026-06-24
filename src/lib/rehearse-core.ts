/**
 * Rehearse brain — simulate how a given stakeholder would react to the user's
 * plan/decision: their first reaction, concerns, what would earn their approval,
 * and the sharpest question they'd ask. Aligned with the webapp's per-persona
 * review shape (first_reaction / concerns / approval_condition).
 *
 * Spine: this SIMULATES a stakeholder's view ("그 사람이라면 이렇게 볼 수 있어요")
 * — information about how others might react, framed as a possibility, never a
 * verdict about the user. The user-facing copy carries that honesty.
 */

export interface RehearseReaction {
  first_reaction: string;
  concerns: string[];
  approval_condition: string;
  sharp_question: string;
}

export const REHEARSE_TOOL_NAME = 'rehearse_reaction';

export const REHEARSE_TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    first_reaction: { type: 'string' as const, description: '그 사람의 첫 반응 (그 사람 말투로 1-2문장)' },
    concerns: { type: 'array' as const, items: { type: 'string' as const }, description: '그 사람이 짚을 우려 2-3개' },
    approval_condition: { type: 'string' as const, description: '이래야 승인/동의한다는 조건' },
    sharp_question: { type: 'string' as const, description: '그 사람이 던질 가장 날카로운 질문 하나' },
  },
  required: ['first_reaction', 'concerns'],
};

/** Common stakeholder presets → the "who" text fed to the model. */
export const REHEARSE_PRESETS: Record<string, { ko: string; en: string; whoKo: string; whoEn: string }> = {
  boss: { ko: '👔 상사', en: '👔 Boss', whoKo: '나의 상사이자 이 결정의 의사결정권자', whoEn: 'my boss, the decision-maker for this' },
  investor: { ko: '💰 투자자', en: '💰 Investor', whoKo: '냉정한 투자자', whoEn: 'a hard-nosed investor' },
  customer: { ko: '🙋 고객', en: '🙋 Customer', whoKo: '까다로운 고객', whoEn: 'a demanding customer' },
  team: { ko: '👥 팀', en: '👥 Team', whoKo: '함께 일하는 팀원들', whoEn: 'the teammates who’d execute this' },
};

const REHEARSE_SYSTEM_KO = `당신은 주어진 '이해관계자'의 입장이 되어, 사용자의 계획/결정에 그 사람이라면 어떻게 반응할지 시뮬레이션합니다. 그 사람의 관점·우려·승인 조건을 드러내세요. 도구를 호출해 만드세요:

- first_reaction: 그 사람의 솔직한 첫 반응 (그 사람 말투로 1-2문장)
- concerns: 그 사람이 짚을 우려나 반대 2-3개 (구체적으로)
- approval_condition: 이것만 충족되면 그 사람이 승인/동의하겠다는 조건
- sharp_question: 그 사람이 던질 가장 날카로운 질문 하나

원칙: 이건 시뮬레이션이지 확정이 아닙니다. '그 사람이라면 이렇게 볼 수 있다'를 보여줄 뿐,
사용자를 판단하거나 무엇을 해야 한다고 말하지 마세요. 그 사람의 입장에 충실하되 과장하지 마세요.`;

const REHEARSE_SYSTEM_EN = `You step into the given STAKEHOLDER's shoes and simulate how they would react to the user's plan/decision. Surface their perspective, concerns, and what would earn their approval. Call the tool to produce:

- first_reaction: their honest first reaction (1-2 sentences, in their voice)
- concerns: 2-3 specific concerns or objections they'd raise
- approval_condition: the condition that, if met, would earn their approval/agreement
- sharp_question: the single sharpest question they'd ask

Principle: this is a SIMULATION, not a certainty. Show "how they might see it" — never judge
the user or say what they should do. Be faithful to the stakeholder without caricature.`;

export function rehearseSystemPrompt(locale: 'ko' | 'en'): string {
  return locale === 'ko' ? REHEARSE_SYSTEM_KO : REHEARSE_SYSTEM_EN;
}

/** Build the user message: the stakeholder + the plan to react to. */
export function buildRehearseUser(decision: string, who: string, locale: 'ko' | 'en'): string {
  return locale === 'ko'
    ? `이해관계자: ${who}\n\n검토할 계획/결정:\n${decision}`
    : `Stakeholder: ${who}\n\nPlan/decision to react to:\n${decision}`;
}

export function coerceRehearse(obj: unknown): RehearseReaction | null {
  const o = (obj ?? {}) as Partial<RehearseReaction>;
  if (typeof o.first_reaction !== 'string' || !o.first_reaction.trim()) return null;
  const concerns = Array.isArray(o.concerns)
    ? o.concerns.filter((c): c is string => typeof c === 'string' && !!c.trim()).slice(0, 4)
    : [];
  if (concerns.length === 0) return null;
  return {
    first_reaction: o.first_reaction.trim(),
    concerns,
    approval_condition: typeof o.approval_condition === 'string' ? o.approval_condition.trim() : '',
    sharp_question: typeof o.sharp_question === 'string' ? o.sharp_question.trim() : '',
  };
}

export function rehearseToMarkdown(r: RehearseReaction, whoLabel: string, locale: 'ko' | 'en'): string {
  const ko = locale === 'ko';
  const out: string[] = [];
  out.push(`🎭 **${whoLabel}${ko ? ' 입장에서' : "'s view"}**`, r.first_reaction, '');
  out.push(`**${ko ? '짚을 우려' : 'Concerns they’d raise'}**`);
  r.concerns.forEach((c) => out.push(`• ${c}`));
  if (r.approval_condition) out.push('', `**${ko ? '승인 조건' : 'What earns approval'}**: ${r.approval_condition}`);
  if (r.sharp_question) out.push('', `**${ko ? '날카로운 질문' : 'Sharpest question'}**: ${r.sharp_question}`);
  out.push('', ko
    ? '_시뮬레이션이에요 — 그 사람이라면 이렇게 볼 수 있다는 한 가지 가능성._'
    : '_A simulation — one way they might see it, not a certainty._');
  return out.join('\n');
}
