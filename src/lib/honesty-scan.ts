/**
 * Honesty scan — a POST-generation, NON-BLOCKING pass over the initial analysis
 * that flags the two failure modes loop-16's independent refuter found the
 * flagship OPEN output committing DESPITE the prompt's own rules:
 *   (1) world_fact  — a claim about the outside world (stats / market / a third
 *       party's current state) stated as SETTLED FACT that the user did NOT give,
 *       where honesty requires a conditional "~라면 … 확인하세요" (prompt line 36).
 *   (2) fabricated  — a concrete specific (a number, proper noun, or third
 *       party's intent/psychology) INVENTED and not given by the user
 *       (prompt line 34: groundless psychology = NEVER).
 *
 * This is the "honest gap over fabrication" invariant enforced by STRUCTURE, not
 * by trusting the generator to self-police (it demonstrably doesn't — the rules
 * already exist in the prompt and it violates them). Precedent: applyRouteContract
 * is the same shape — a post-generation guard on the same output.
 *
 * PRECISION OVER RECALL — the flags become a user-facing "확인 필요" shade, so a
 * false flag on a legitimate neutral/hedged sentence is worse than a miss. The
 * prompt is tuned to abstain when uncertain. (This is the opposite tuning from
 * scripts/uiux-loop/quality-refute.ts, which is high-recall to FIND problems.)
 */

export type HonestyKind = 'world_fact' | 'fabricated';

export interface HonestyFlag {
  /** The EXACT substring from the analysis to shade (verbatim, so the UI locates it). */
  text: string;
  kind: HonestyKind;
  /** THE STAKE (loop-17 payload upgrade) — what breaks in the USER'S decision if this
   *  turns out false, in one line ("이게 사실이면 지금이 매도 적기가 아닐 수 있어요").
   *  This is the leverage: connects the unverified fact to the decision's hinge, so the
   *  shade reads as "이 지점이 여기서 갈린다", NOT a buck-passing "go verify it yourself".
   *  Empty only when no decision-consequence is clear. (Was `why` = why-flagged, dropped:
   *  that was internal meta, useless to the user.) */
  stake: string;
  /** WHERE + WHAT to check (loop-17 A, enriched) — the specific pointer, source AND the
   *  exact thing to look at ("청약홈 · 향후 2~3년 입주 물량", "경쟁사 IR · 최근 분기 해지율").
   *  NOT a bare source name. Empty when no obvious single check exists. */
  where?: string;
}

export const HONESTY_SCAN_TOOL_NAME = 'honesty_flags';

export const HONESTY_SCAN_SCHEMA = {
  type: 'object' as const,
  properties: {
    flags: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          text: { type: 'string' as const, description: '음영 처리할, 분석에서 그대로 따온 문장/구 (verbatim)' },
          kind: { type: 'string' as const, enum: ['world_fact', 'fabricated'] },
          stake: { type: 'string' as const, description: '이게 틀리면 사용자 결정의 무엇이 흔들리는지 한 줄 (하중). "확인해봐"가 아니라 "이 지점이 여기서 갈린다"로. 예: "이게 사실이면 지금이 매도 적기가 아닐 수 있어요"' },
          where: { type: 'string' as const, description: '구체적으로 어디서/무엇을 볼지 (출처+대상). 예: "청약홈 · 향후 2~3년 입주 물량", "경쟁사 IR · 최근 분기 해지율". 단순 출처명 말고 볼 대상까지. 없으면 생략' },
        },
        required: ['text', 'kind', 'stake'],
      },
    },
  },
  required: ['flags'],
};

const SCAN_SYSTEM_KO = `당신은 의사결정 분석의 '정직성'만 보는 고정밀 검수자입니다. 아래는 사용자의 입력과, 그에 대한 Argus의 분석입니다. 분석 문장 중 **오직 아래 두 종류의 명백한 위반만** 골라 도구로 신고하세요. 애매하면 신고하지 마세요 — 이 신고는 사용자 화면에 '확인 필요' 표시로 뜨므로, 멀쩡한 문장을 잘못 표시하는 것이 놓치는 것보다 나쁩니다.

신고할 것 (딱 이 둘):
1) world_fact — 바깥세상에 대한 사실(통계·시장 상황·제3자의 현재 상태·규제·가격·수급 등)을 사용자가 준 적 없는데 **단정형("~예요/~해요/~합니다")으로 서술**한 것. 정직하려면 조건부여야 함("~라면", "…인지 확인하세요"). 예: "GTX 역세권 여부에 따라 수급이 크게 달라요", "고객이 떠나는 진짜 이유는 가격보다 X인 경우가 훨씬 많아요".
2) fabricated — 사용자가 준 적 없는 구체(숫자·고유명사·제3자의 의도나 심리)를 지어낸 것. 예: "온보딩 1~3개월은 생산성 0", "2년 약정 시 15% 할인", "기회를 놓친다는 감각(FOMO)이 있을 수 있는데".

신고하지 말 것 (중요):
- 사용자가 입력에서 직접 준 사실·숫자.
- 질문형 문장(진짜 질문·크럭스·다음 질문) — 중립 질문은 사실 주장이 아님.
- 이미 조건부·유보로 쓴 문장("~라면", "~일 수 있어요", "확인하세요", "~인지 봐야 해요").
- 일반적 추론·논리·틀(사실 단정이 아닌 사고 방식).
- 가치 판단이 질문으로 제시된 것.

각 신고의 text는 분석에서 **그대로 복사**(verbatim)해 UI가 찾을 수 있게 하세요. 위반이 하나도 없으면 flags: []로 정직하게 비우세요.

**stake(하중) — 이게 제일 중요**: "확인해 보세요" 같은 잡일 떠넘기기 금지. 이 사실이 **틀렸을 때 사용자 결정의 무엇이 흔들리는지**를 한 줄로 짚으세요. 사용자가 "아, 이 지점이 내 결정을 가르는구나" 하고 느껴야 합니다. 예: 입력이 "동탄 집 매수"인데 분석이 "GTX 수급이 크게 달라요"라 했다면 → stake: "이게 사실이면 지금이 매도 적기가 아닐 수 있어요". 결정과 무관하면(하중 없으면) 애초에 flag하지 마세요.

**where(어디서·무엇을)**: 출처만 말고 **볼 대상까지** 짧게. 예: "청약홈 · 향후 2~3년 입주 물량", "경쟁사 IR·공시 · 최근 분기 해지율", "근로계약서 · 해고 요건 조항". 명확한 단일 체크가 없으면 생략(억지 금지).

아래 JSON으로만 응답하세요 (마크다운·설명 없이):
{"flags": [{"text": "분석에서 그대로 따온 문장", "kind": "world_fact" 또는 "fabricated", "stake": "틀리면 결정의 무엇이 흔들리나 한 줄", "where": "출처·볼 대상(있으면)"}]}`;

const SCAN_SYSTEM_EN = `You are a high-precision reviewer checking ONLY the honesty of a decision analysis. Below is the user's input and Argus's analysis of it. Flag ONLY the two clear violation types below via the tool. When unsure, do NOT flag — these become a user-facing "needs checking" shade, so a false flag on a fine sentence is worse than a miss.

Flag ONLY:
1) world_fact — a claim about the outside world (stats / market conditions / a third party's current state / regulation / price / supply) the user did NOT provide, stated in the DECLARATIVE ("it is / they do"). Honesty requires it be conditional ("if …, verify …").
2) fabricated — a concrete specific (number, proper noun, a third party's intent or psychology) INVENTED, not given by the user.

Do NOT flag: facts/numbers the user gave; questions (the real question, crux, next question — a neutral question is not a claim); already-hedged/conditional sentences; general reasoning/frameworks; value judgments posed as questions.

Each flag's text must be COPIED VERBATIM from the analysis so the UI can locate it. If nothing violates, honestly return flags: [].

**stake (most important)**: NOT a buck-passing "go verify it". Name what breaks in the USER'S decision if this fact is false, in one line — so they feel "oh, THIS is where my decision turns". e.g. for a "should I sell my house" decision where the analysis asserted "supply is heavy", stake: "If true, now may not be the right time to sell." If it has no bearing on the decision, don't flag it at all.

**where (source + what)**: not a bare source name — the specific thing to look at. e.g. "the 10-K · last-quarter churn", "the lease · termination clause", "official stats · 2-3yr supply". Omit if no obvious single check.

Respond with ONLY this JSON (no markdown, no prose):
{"flags": [{"text": "verbatim sentence", "kind": "world_fact" or "fabricated", "stake": "what breaks in the decision if false", "where": "source · what to look at (if any)"}]}`;

export function honestyScanSystemPrompt(locale: 'ko' | 'en'): string {
  return locale === 'ko' ? SCAN_SYSTEM_KO : SCAN_SYSTEM_EN;
}

/** Build the {system, user} for the scan. `analysis` is the rendered fields we shade. */
export function buildHonestyScanPrompt(
  problemText: string,
  analysis: { real_question?: string; hidden_assumptions?: unknown; skeleton?: unknown; insight?: string },
  locale: 'ko' | 'en',
): { system: string; user: string } {
  const body = JSON.stringify(
    {
      real_question: analysis.real_question ?? '',
      hidden_assumptions: analysis.hidden_assumptions ?? [],
      skeleton: analysis.skeleton ?? [],
      insight: analysis.insight ?? '',
    },
    null,
    2,
  );
  const label = locale === 'ko' ? '사용자 입력' : 'User input';
  const label2 = locale === 'ko' ? 'Argus 분석' : 'Argus analysis';
  return {
    system: honestyScanSystemPrompt(locale),
    user: `${label}: "${problemText}"\n\n${label2}:\n${body}`,
  };
}

export function coerceHonestyFlags(obj: unknown): HonestyFlag[] {
  const o = (obj ?? {}) as { flags?: unknown };
  if (!Array.isArray(o.flags)) return [];
  return o.flags
    .map((f) => f as Partial<HonestyFlag>)
    .filter((f): f is HonestyFlag =>
      !!f && typeof f.text === 'string' && !!f.text.trim() &&
      (f.kind === 'world_fact' || f.kind === 'fabricated'),
    )
    .map((f) => ({
      text: f.text.trim(),
      kind: f.kind,
      stake: typeof f.stake === 'string' ? f.stake.trim() : '',
      ...(typeof f.where === 'string' && f.where.trim() ? { where: f.where.trim() } : {}),
    }))
    // De-dupe by text; cap so a runaway scan can't paint the whole card.
    .filter((f, i, arr) => arr.findIndex((g) => g.text === f.text) === i)
    .slice(0, 8);
}

/** Normalize for tolerant matching (the model may drop/alter trailing punctuation
 *  or spacing when copying). Returns the index of the flag text within `haystack`,
 *  or -1. Callers use this to wrap the matched span with a shade. */
export function locateFlag(haystack: string, flagText: string): number {
  if (!haystack || !flagText) return -1;
  const idx = haystack.indexOf(flagText);
  if (idx >= 0) return idx;
  // Fallback: trim trailing punctuation the model often normalizes away.
  const trimmed = flagText.replace(/[.。!?！？…]+\s*$/u, '').trim();
  if (trimmed && trimmed !== flagText) return haystack.indexOf(trimmed);
  return -1;
}
