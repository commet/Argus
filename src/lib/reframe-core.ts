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

/** Coerce an already-parsed object (e.g. a forced tool_use input) into the
 *  result shape — tolerant of missing/odd fields. */
export function coerceReframe(obj: unknown): ReframeCoreResult {
  const o = (obj ?? {}) as Partial<ReframeCoreResult>;
  return {
    surface_task: typeof o.surface_task === 'string' ? o.surface_task : '',
    hidden_assumptions: Array.isArray(o.hidden_assumptions)
      ? o.hidden_assumptions
          .map((a) => (typeof a === 'string' ? { assumption: a } : a))
          .filter((a): a is ReframeAssumption => !!a && typeof a.assumption === 'string')
      : [],
    reasoning_narrative: typeof o.reasoning_narrative === 'string' ? o.reasoning_narrative : undefined,
  };
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
  return coerceReframe(JSON.parse(raw));
}

/** JSON-Schema for the forced tool call — guarantees valid structured output. */
export const REFRAME_TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    surface_task: { type: 'string' as const },
    hidden_assumptions: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          assumption: { type: 'string' as const },
          risk_if_false: { type: 'string' as const },
          axis: { type: 'string' as const },
        },
        required: ['assumption'],
      },
    },
    reasoning_narrative: { type: 'string' as const },
  },
  required: ['surface_task', 'hidden_assumptions'],
};

/* ── Stage 2: 질문 재정의 + 중립 크럭스 ──
 * Spine (CLAUDE.md mirror clause): the crux is a BARE NEUTRAL QUESTION — never a
 * directional statement, a two-pole fork, or a disclaimed lean. We surface the
 * real question and the one load-bearing crux; we do NOT decide for the user. */

export interface ReframeQuestion {
  reframed_question: string;
  crux_question: string;
  alternatives: string[];
}

export const QUESTION_TOOL_NAME = 'reframe_question';

export const QUESTION_TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    reframed_question: { type: 'string' as const, description: '표면 질문 뒤의 더 정확하고 결정적인 진짜 질문 (질문 형태)' },
    crux_question: { type: 'string' as const, description: '가장 하중이 큰 핵심을 담은 중립적인 질문 하나 (판단·방향 금지)' },
    alternatives: { type: 'array' as const, items: { type: 'string' as const }, description: '다르게 볼 수 있는 질문 1-2개' },
  },
  required: ['reframed_question', 'crux_question'],
};

const QUESTION_SYSTEM_KO = `당신은 사용자의 표면 질문 뒤에 있는 '진짜 질문'을 드러냅니다. 판단하지 말고, 더 정확한 질문으로 다시 세우세요. 도구를 호출해 만드세요:

- reframed_question: 표면적으로 묻는 것 뒤에 있는, 더 정확하고 결정적인 진짜 질문 (한 문장, 반드시 질문 형태)
- crux_question: 이 결정에서 가장 하중이 큰(답이 정해지면 나머지가 따라오는) 단 하나의 핵심을 **중립적인 질문**으로. 한 문장.
- alternatives: 다르게 볼 수 있는 질문 1-2개 (없으면 빈 배열)

원칙(매우 중요 — 반드시 지킬 것):
- crux_question과 reframed_question은 반드시 '질문(?로 끝나는)'이어야 합니다. 단정·판단·조언·'~해야 한다'·'~쪽으로 기운다' 표현 절대 금지.
- 두 갈래(A vs B 중 골라라) 강제 금지. 사용자가 무엇을 해야 하는지 말하지 마세요.
- 당신은 진짜 질문과 핵심을 드러낼 뿐, 답을 정하지 않습니다. 답은 사용자와 현실의 몫입니다.`;

const QUESTION_SYSTEM_EN = `You reveal the REAL question behind the user's surface question. Don't judge — re-pose it more precisely. Call the tool to produce:

- reframed_question: the more precise, decisive real question behind what they surface (one sentence, MUST be a question)
- crux_question: the single most load-bearing point (answer it and the rest follows) as a NEUTRAL question. One sentence.
- alternatives: 1-2 other ways to frame it (empty array if none)

Principles (critical — must follow):
- crux_question and reframed_question MUST be questions (ending in ?). Never a statement, verdict, advice, "should", or "leans toward X".
- Never force a two-pole fork (pick A vs B). Never tell the user what to do.
- You only surface the real question and the crux; you do not decide. The answer belongs to the user and reality.`;

export function questionSystemPrompt(locale: 'ko' | 'en'): string {
  return locale === 'ko' ? QUESTION_SYSTEM_KO : QUESTION_SYSTEM_EN;
}

export function coerceQuestion(obj: unknown): ReframeQuestion | null {
  const o = (obj ?? {}) as Partial<ReframeQuestion>;
  if (typeof o.reframed_question !== 'string' || !o.reframed_question.trim()) return null;
  if (typeof o.crux_question !== 'string' || !o.crux_question.trim()) return null;
  return {
    reframed_question: o.reframed_question.trim(),
    crux_question: o.crux_question.trim(),
    alternatives: Array.isArray(o.alternatives)
      ? o.alternatives.filter((a): a is string => typeof a === 'string' && !!a.trim()).slice(0, 3)
      : [],
  };
}

/** Render the question reframe. Identity-language, not mechanism: we name the
 *  real question and the one crux — no "어디서 갈린다"(branch-detector) framing. */
export function questionToMarkdown(q: ReframeQuestion, locale: 'ko' | 'en'): string {
  const ko = locale === 'ko';
  const out: string[] = [];
  out.push(`🎯 **${ko ? '진짜 질문' : 'The real question'}**`, q.reframed_question, '');
  out.push(`**${ko ? '결국 이거예요' : 'It comes down to this'}**`, q.crux_question);
  if (q.alternatives.length) {
    out.push('', `${ko ? '다른 각도' : 'Other angles'}:`);
    q.alternatives.forEach((a) => out.push(`• ${a}`));
  }
  return out.join('\n');
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
