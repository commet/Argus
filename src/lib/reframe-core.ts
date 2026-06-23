/**
 * Reframe brain — the single source of truth for the Stage-1 assumption-surfacing
 * prompt. Lives in a dependency-free lib so BOTH faces share one brain:
 *   - the webapp (ReframeStep.tsx, client) layers its prompt-mutation /
 *     personalization on top of reframeSystemPrompt()
 *   - the Telegram bot (api/telegram/webhook, server) calls it bare
 *
 * Keep the prompt here ONLY. Copying it into a third place is the drift this
 * extraction exists to prevent (CLAUDE.md → Single Source of Truth for Prompts).
 */

export type ReframeAxis = 'customer_value' | 'feasibility' | 'business' | 'org_capacity';

export interface ReframeAssumption {
  assumption: string;
  risk_if_false?: string;
  axis?: ReframeAxis | string;
}

export interface ReframeCoreResult {
  surface_task: string;
  hidden_assumptions: ReframeAssumption[];
  reasoning_narrative?: string;
}

/* ── Stage 1: 전제 도출 프롬프트 (가설 기반 사고) ── */
export const ASSUMPTION_PROMPT_KO = `당신은 전략기획 전문가입니다. 주어진 과제의 숨겨진 전제를 찾으세요.

[사고 방식: 가설 기반 사고 + 4축 전제 점검]
- 이 과제가 나온 진짜 이유는 무엇인가? 가설을 세우세요.
- 이 과제가 의미 있으려면 참이어야 하는 전제를 찾으세요.
- 네 가지 축으로 점검: (1) 고객 가치 (2) 실행 가능성 (3) 사업성 (4) 조직 역량

[다양성 원칙]
- 전제 3-4개는 반드시 서로 다른 축에서 나와야 합니다. 같은 축에서 2개 이상 나오면 안 됩니다.
- 각 전제에 axis 필드로 어떤 축인지 표시하세요.

아래 JSON 구조로 응답하세요.
1. surface_task: 사용자가 말한 과제를 한 문장으로 정리
2. hidden_assumptions: 이 과제가 성립하려면 맞아야 하는 전제 3-4개. 각 전제에 대해:
   - assumption: 전제 내용 (한 문장, 명확하게)
   - risk_if_false: 이 전제가 틀리면 구체적으로 어떤 위험이 생기는지
   - axis: 이 전제가 속하는 축 ("customer_value" | "feasibility" | "business" | "org_capacity")
3. reasoning_narrative: 왜 이 전제들이 중요한지 2-3문장으로 설명

반드시 JSON만 응답하세요.`;

export const ASSUMPTION_PROMPT_EN = `You are a strategy expert. Find the hidden assumptions behind the given task.

[Mindset: hypothesis-based thinking + 4-axis assumption check]
- What is the real reason this task came up? Form a hypothesis.
- Find the assumptions that must be true for this task to be meaningful.
- Check across four axes: (1) customer value (2) feasibility (3) business viability (4) organizational capacity

[Diversity principle]
- The 3-4 assumptions must come from different axes. No more than one from the same axis.
- Mark each assumption's axis with the axis field.

Respond in the JSON structure below.
1. surface_task: Summarize the task the user described in one sentence
2. hidden_assumptions: The 3-4 assumptions that must hold for this task to make sense. For each:
   - assumption: The assumption (one sentence, clearly stated)
   - risk_if_false: Concretely, what risk arises if this assumption is wrong
   - axis: The axis this assumption belongs to ("customer_value" | "feasibility" | "business" | "org_capacity")
3. reasoning_narrative: Explain in 2-3 sentences why these assumptions matter

Respond with JSON only.`;

export function reframeSystemPrompt(locale: 'ko' | 'en'): string {
  return locale === 'ko' ? ASSUMPTION_PROMPT_KO : ASSUMPTION_PROMPT_EN;
}

/** Nudge appended when the user asks to go deeper on the most load-bearing assumption. */
export function deeperSuffix(locale: 'ko' | 'en'): string {
  return locale === 'ko'
    ? '\n\n[심화] 가장 하중이 큰(틀리면 전체가 무너지는) 전제 하나를 골라, 그것을 어떻게 가장 싸게 검증할 수 있는지 risk_if_false에 함께 적으세요.'
    : '\n\n[Deeper] Pick the single most load-bearing assumption (the one whose failure collapses everything) and, in its risk_if_false, also state the cheapest way to test it.';
}

/** Tolerant JSON extraction — models sometimes wrap JSON in prose or fences. */
export function parseReframe(text: string): ReframeCoreResult {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  // Fall back to the first balanced-looking object.
  if (!raw.startsWith('{')) {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
  }
  const obj = JSON.parse(raw) as Partial<ReframeCoreResult>;
  return {
    surface_task: typeof obj.surface_task === 'string' ? obj.surface_task : '',
    hidden_assumptions: Array.isArray(obj.hidden_assumptions)
      ? obj.hidden_assumptions
          .map((a) => (typeof a === 'string' ? { assumption: a } : a))
          .filter((a): a is ReframeAssumption => !!a && typeof a.assumption === 'string')
      : [],
    reasoning_narrative: typeof obj.reasoning_narrative === 'string' ? obj.reasoning_narrative : undefined,
  };
}

const AXIS_LABEL: Record<string, { ko: string; en: string }> = {
  customer_value: { ko: '고객 가치', en: 'Customer value' },
  feasibility: { ko: '실행 가능성', en: 'Feasibility' },
  business: { ko: '사업성', en: 'Business' },
  org_capacity: { ko: '조직 역량', en: 'Org capacity' },
};

/** Render a reframe result as Telegram-ready markdown (fed to markdownToTelegramHtml). */
export function reframeToMarkdown(r: ReframeCoreResult, locale: 'ko' | 'en'): string {
  const ko = locale === 'ko';
  const out: string[] = [];
  if (r.surface_task) out.push(`**${ko ? '표면 과제' : 'Surface task'}**\n${r.surface_task}`, '');
  out.push(`**${ko ? '숨은 전제 — 이게 맞아야 성립해요' : 'Hidden assumptions — these must hold'}**`);
  r.hidden_assumptions.forEach((a, i) => {
    const axis = a.axis && AXIS_LABEL[a.axis] ? ` (${ko ? AXIS_LABEL[a.axis].ko : AXIS_LABEL[a.axis].en})` : '';
    out.push(`${i + 1}. **${a.assumption}**${axis}`);
    if (a.risk_if_false) out.push(`   ↳ ${ko ? '틀리면' : 'if false'}: ${a.risk_if_false}`);
  });
  if (r.reasoning_narrative) out.push('', r.reasoning_narrative);
  return out.join('\n');
}
