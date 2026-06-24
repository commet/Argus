/**
 * Recast brain — split a plan into execution steps and mark WHO holds each:
 * AI executes, or a human must judge, or both. This is Argus's central thesis
 * (the judgment ladder): in an age where AI took execution, make explicit the
 * judgment a human must keep. Aligned with the webapp's RecastStep shape
 * (task / actor / reasoning).
 *
 * Spine: this DESIGNS the role split — it does not judge the user.
 */

export type RecastActor = 'ai' | 'human' | 'both';

export interface RecastStepLite {
  task: string;
  actor: RecastActor;
  why: string;
}

export const RECAST_TOOL_NAME = 'recast_roles';

export const RECAST_TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    steps: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          task: { type: 'string' as const, description: '실행 단계 한 문장' },
          actor: { type: 'string' as const, enum: ['ai', 'human', 'both'], description: "ai=AI 실행 가능, human=반드시 사람 판단, both=AI 초안+사람 판단" },
          why: { type: 'string' as const, description: '왜 그 actor인지 (human이면 왜 사람이어야 하는지)' },
        },
        required: ['task', 'actor'],
      },
    },
  },
  required: ['steps'],
};

const RECAST_SYSTEM_KO = `주어진 결정/계획을 실행 단계로 나누고, 각 단계를 누가 맡을지 가르세요. Argus의 정신: AI가 실행을 가져간 시대에, 사람이 반드시 쥐고 있어야 할 '판단'을 분명히 가립니다. 도구를 호출하세요:

- steps: 3~6개. 각 단계:
  - task: 한 단계 (한 문장)
  - actor: 'ai'(AI가 실행해도 되는 일) | 'human'(반드시 사람의 판단이 필요) | 'both'(AI가 초안, 사람이 판단)
  - why: 왜 그 actor인지. 특히 human이면 '왜 사람이어야 하는지'를 한 줄로.

원칙: AI에 넘길 수 있는 건 과감히 넘기되, 가치·맥락·책임이 걸린 '판단'은 사람에게 남기세요.
사용자를 판단하지 말고, 역할을 설계만 하세요.`;

const RECAST_SYSTEM_EN = `Split the given decision/plan into execution steps and assign who holds each. Argus's thesis: in an age where AI took execution, make explicit the JUDGMENT a human must keep. Call the tool:

- steps: 3-6. Each step:
  - task: one step (one sentence)
  - actor: 'ai' (AI can execute) | 'human' (a human must judge) | 'both' (AI drafts, human judges)
  - why: why that actor — for 'human', why it must be a human, in one line.

Principle: hand to AI what you can, but keep the JUDGMENT (anything carrying values, context, or accountability) with the human. Don't judge the user — only design the roles.`;

export function recastSystemPrompt(locale: 'ko' | 'en'): string {
  return locale === 'ko' ? RECAST_SYSTEM_KO : RECAST_SYSTEM_EN;
}

export function coerceRecast(obj: unknown): RecastStepLite[] | null {
  const o = (obj ?? {}) as { steps?: unknown };
  if (!Array.isArray(o.steps)) return null;
  const steps = o.steps
    .map((s) => s as Partial<RecastStepLite>)
    .filter((s) => s && typeof s.task === 'string' && s.task.trim())
    .map((s) => ({
      task: s.task!.trim(),
      actor: (s.actor === 'ai' || s.actor === 'human' || s.actor === 'both' ? s.actor : 'both') as RecastActor,
      why: typeof s.why === 'string' ? s.why.trim() : '',
    }))
    .slice(0, 6);
  return steps.length ? steps : null;
}

const ACTOR_GLYPH: Record<RecastActor, string> = { ai: '🤖', human: '🧠', both: '🤝' };

export function recastToMarkdown(steps: RecastStepLite[], locale: 'ko' | 'en'): string {
  const ko = locale === 'ko';
  const out: string[] = [`🤝 **${ko ? '역할 나누기 — AI와 사람' : 'Role split — AI vs human'}**`, ''];
  steps.forEach((s, i) => {
    out.push(`${i + 1}. ${ACTOR_GLYPH[s.actor]} ${s.task}`);
    if (s.why) out.push(`   ↳ ${s.why}`);
  });
  const humanCount = steps.filter((s) => s.actor === 'human').length;
  out.push('', ko
    ? `🧠 = 당신이 판단할 자리 (${humanCount}곳). 나머지는 AI에 맡겨도 돼요.`
    : `🧠 = where your judgment holds (${humanCount}). The rest can go to AI.`);
  return out.join('\n');
}
