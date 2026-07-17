/**
 * Chronicler narration (Phase 5) — the *prose* layer over the deterministic
 * waypoint gate. Kept separate from voyage-log.ts so that module stays pure
 * (the store imports the gate; only the UI driver imports this LLM layer).
 *
 * Honesty contract: the LLM never decides whether a waypoint exists, its type,
 * or its cause — those are fixed by the deterministic gate and handed in here.
 * It only writes one grounded, explicitly interpretive fragment:
 *   - significance — why this turn mattered (one sentence)
 *
 * It MUST NOT write `why_abandoned`. A supplied option rationale or a plausible
 * reading of the transition is not the user's reason for declining a path.
 * That field stays empty until the user states a reason (E-B3).
 * It is told to invent nothing. Narration is best-effort enrichment: any failure
 * leaves the deterministic waypoint untouched.
 */

import { callLLMJson } from '@/lib/llm';
import type { Waypoint, WaypointType } from '@/stores/types';

/** Types whose entries gain meaning from a "why" line. Endpoints (departure,
 *  anchorage) and sightings read fine from their headline alone. */
const NARRATABLE: ReadonlySet<WaypointType> = new Set(['course_change', 'reef', 'headwind']);

export function isNarratable(type: WaypointType): boolean {
  return NARRATABLE.has(type);
}

export interface WaypointNarrationContext {
  waypoint: Waypoint;
  problemText: string;
  prevRealQuestion?: string;
  curRealQuestion?: string;
  locale: 'ko' | 'en';
  signal?: AbortSignal;
}

export interface WaypointNarration {
  significance?: string;
}

export async function narrateWaypoint(ctx: WaypointNarrationContext): Promise<WaypointNarration | null> {
  const { waypoint: w, locale } = ctx;
  if (!isNarratable(w.type)) return null;
  const ko = locale === 'ko';
  const isCourseChange = w.type === 'course_change';

  const system = ko
    ? `당신은 항해일지를 기록하는 항해사다. 의사결정 과정의 한 변곡점을 짧게 서술한다.
규칙:
- significance: 이 변곡점이 *왜 중요한지* 한 문장(최대 60자). 주어진 사실에 근거, 과장 금지.
- 사용자가 말하지 않은 선택 이유나 인과를 추정하지 말 것.
- 주어진 정보만 사용하고 새로운 사실을 지어내지 말 것.
- 순수 JSON만 응답: {"significance": "..."}`
    : `You are the navigator keeping the ship's log. Narrate one decision turning point briefly.
Rules:
- significance: one sentence (<=80 chars) on *why this turn matters*. Grounded in the given facts, no hype.
- Do not infer an unstated reason or causal explanation for the user's choice.
- Use only the given facts; invent nothing.
- Respond with pure JSON only: {"significance": "..."}`;

  const user = [
    `${ko ? '원래 과제' : 'Original ask'}: ${ctx.problemText}`,
    `${ko ? '변곡점 유형' : 'Turn type'}: ${w.type}`,
    `${ko ? '헤드라인' : 'Headline'}: ${w.headline}`,
    w.trigger ? `${ko ? '계기' : 'Trigger'}: ${w.trigger}` : '',
    isCourseChange && ctx.prevRealQuestion ? `${ko ? '이전 질문' : 'Previous question'}: ${ctx.prevRealQuestion}` : '',
    isCourseChange && ctx.curRealQuestion ? `${ko ? '바뀐 질문' : 'New question'}: ${ctx.curRealQuestion}` : '',
  ].filter(Boolean).join('\n');

  try {
    // 'fast': one short interpretive line for the logbook — background flavor.
    const res = await callLLMJson<{ significance?: string }>(
      [{ role: 'user', content: user }],
      { system, maxTokens: 160, signal: ctx.signal, model: 'fast', shape: { significance: 'string' } },
    );
    const out: WaypointNarration = {};
    if (res.significance?.trim()) out.significance = res.significance.trim();
    return out.significance ? out : null;
  } catch {
    return null; // best-effort — leave the deterministic waypoint as-is
  }
}
