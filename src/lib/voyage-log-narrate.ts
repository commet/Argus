/**
 * Chronicler narration (Phase 5) — the *prose* layer over the deterministic
 * waypoint gate. Kept separate from voyage-log.ts so that module stays pure
 * (the store imports the gate; only the UI driver imports this LLM layer).
 *
 * Honesty contract: the LLM never decides whether a waypoint exists, its type,
 * or its cause — those are fixed by the deterministic gate and handed in here.
 * It only writes two grounded fragments:
 *   - significance — why this turn mattered (one sentence)
 *   - why_abandoned — for a course change, why the road was not taken
 * It is told to invent nothing. Narration is best-effort enrichment: any failure
 * leaves the deterministic waypoint untouched.
 */

import { callLLMJson } from '@/lib/llm';
import type { Waypoint, WaypointAlternative, WaypointType } from '@/stores/types';

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
  alternatives?: WaypointAlternative[];
}

export async function narrateWaypoint(ctx: WaypointNarrationContext): Promise<WaypointNarration | null> {
  const { waypoint: w, locale } = ctx;
  if (!isNarratable(w.type)) return null;
  const ko = locale === 'ko';
  const isCourseChange = w.type === 'course_change';
  const notTaken = (w.alternatives || []).find(a => !a.taken);

  const system = ko
    ? `당신은 항해일지를 기록하는 항해사다. 의사결정 과정의 한 변곡점을 짧게 서술한다.
규칙:
- significance: 이 변곡점이 *왜 중요한지* 한 문장(최대 60자). 주어진 사실에 근거, 과장 금지.
- ${isCourseChange ? 'why_abandoned: 가지 않은 길을 왜 버렸는지 한 구절(최대 40자).' : 'why_abandoned: 빈 문자열.'}
- 주어진 정보만 사용하고 새로운 사실을 지어내지 말 것.
- 순수 JSON만 응답: {"significance": "...", "why_abandoned": "..."}`
    : `You are the navigator keeping the ship's log. Narrate one decision turning point briefly.
Rules:
- significance: one sentence (<=80 chars) on *why this turn matters*. Grounded in the given facts, no hype.
- ${isCourseChange ? 'why_abandoned: one short phrase (<=60 chars) on why the road was not taken.' : 'why_abandoned: empty string.'}
- Use only the given facts; invent nothing.
- Respond with pure JSON only: {"significance": "...", "why_abandoned": "..."}`;

  const user = [
    `${ko ? '원래 과제' : 'Original ask'}: ${ctx.problemText}`,
    `${ko ? '변곡점 유형' : 'Turn type'}: ${w.type}`,
    `${ko ? '헤드라인' : 'Headline'}: ${w.headline}`,
    w.trigger ? `${ko ? '계기' : 'Trigger'}: ${w.trigger}` : '',
    isCourseChange && ctx.prevRealQuestion ? `${ko ? '이전 질문' : 'Previous question'}: ${ctx.prevRealQuestion}` : '',
    isCourseChange && ctx.curRealQuestion ? `${ko ? '바뀐 질문' : 'New question'}: ${ctx.curRealQuestion}` : '',
    isCourseChange && notTaken ? `${ko ? '가지 않은 길' : 'Road not taken'}: ${notTaken.label}` : '',
  ].filter(Boolean).join('\n');

  try {
    // 'fast': two short narration lines for the logbook — background flavor.
    const res = await callLLMJson<{ significance?: string; why_abandoned?: string }>(
      [{ role: 'user', content: user }],
      { system, maxTokens: 220, signal: ctx.signal, model: 'fast', shape: { significance: 'string', why_abandoned: 'string' } },
    );
    const out: WaypointNarration = {};
    if (res.significance?.trim()) out.significance = res.significance.trim();
    if (isCourseChange && notTaken && res.why_abandoned?.trim()) {
      const why = res.why_abandoned.trim();
      out.alternatives = (w.alternatives || []).map(a =>
        a === notTaken ? { ...a, why_abandoned: why } : a,
      );
    }
    return out.significance || out.alternatives ? out : null;
  } catch {
    return null; // best-effort — leave the deterministic waypoint as-is
  }
}
