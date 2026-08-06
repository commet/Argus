// TWIN 그림자 시험 — 생성·봉인·공개·채점의 조율 층.
//
// 실패 원칙: 그림자는 부가 기능이다. 생성이 실패하면 **로그를 남기고 조용히
// 물러난다** — 사용자의 결정 열기를 막지 않는다. 대신 크론 백스톱이 "그림자
// 없는 최근 케이스"를 쓸어담아 재시도하므로, 실패는 침묵이 아니라 지연이 된다.
// (ANTHROPIC_API_KEY 없는 환경에서도 같은 경로 — 지어내는 폴백은 없다.)

import { callAnthropicJson } from '@/lib/llm-server';
import {
  buildShadowSystem,
  buildShadowUser,
  buildVerdictSystem,
  buildVerdictUser,
  SHADOW_SCHEMA,
  VERDICT_SCHEMA,
  type ShadowOpening,
} from './prompts';
import {
  revealShadowsForCase,
  sealShadows,
  setShadowVerdict,
  type ShadowDraft,
  type ShadowRow,
  type ShadowVerdict,
} from './store';

// callAnthropicJson 은 폴백 후 실제 사용 모델을 돌려주지 않으므로, 후보 1순위를
// 기록한다. 층화 채점의 키로 쓰기에 충분하고, 정확한 모델은 로그에 남는다.
const SHADOW_MODEL_TIER = 'default' as const;
const SHADOW_MODEL_LABEL = 'anthropic:default-tier';

function num(v: unknown, fallback = 0.5): number {
  return typeof v === 'number' && v >= 0 && v <= 1 ? v : fallback;
}

/**
 * 결정이 열린 직후(after())와 크론 백스톱이 부르는 단일 진입점.
 * `alreadyAdopted` 가 참이면 봉인은 하되 late 로 — 채택 후의 예측은 match
 * 채점에서 제외된다 (봉인이 늦었다는 사실을 지우지 않고 기록한다).
 */
export async function generateAndSealShadow(
  userId: string,
  caseId: string,
  opening: ShadowOpening,
  opts: { alreadyAdopted?: boolean; profileLines?: string[] } = {},
): Promise<void> {
  try {
    const out = await callAnthropicJson({
      system: buildShadowSystem(opts.profileLines ?? []),
      user: buildShadowUser(opening),
      toolName: 'seal_shadow_prediction',
      schema: SHADOW_SCHEMA,
      model: SHADOW_MODEL_TIER,
      maxTokens: 700,
    });
    if (!out) {
      console.error('[twin/shadow] model returned no tool call — skipping (cron will retry)');
      return;
    }

    const hasLean = Boolean(opening.lean);
    const late = opts.alreadyAdopted === true;
    const drafts: ShadowDraft[] = ([
      {
        target: 'outcome' as const,
        expectation: String(out.outcome_expectation ?? ''),
        reasoning: String(out.reasoning ?? ''),
        confidence: num(out.outcome_confidence),
        contaminatedByLean: hasLean,
        modelId: SHADOW_MODEL_LABEL,
        late,
      },
      {
        // lean 이 있으면 선택 예측은 자명하므로(오염) 이탈 예측으로 전환한다.
        target: hasLean ? ('deviation' as const) : ('choice' as const),
        expectation: String(out.second_expectation ?? ''),
        reasoning: String(out.reasoning ?? ''),
        confidence: num(out.second_confidence),
        contaminatedByLean: hasLean,
        modelId: SHADOW_MODEL_LABEL,
        late,
      },
    ] satisfies ShadowDraft[]).filter((d) => d.expectation.length > 0);

    if (drafts.length === 0) {
      console.error('[twin/shadow] empty expectations — nothing sealed');
      return;
    }
    await sealShadows(userId, caseId, drafts);
  } catch (e) {
    // 부가 기능의 실패는 본 작업을 막지 않는다. 크론이 재시도한다.
    console.error('[twin/shadow] generate/seal failed:', e);
  }
}

/** 정산 응답에 붙일 3자 대조 텍스트. 공개할 것이 없으면 빈 문자열. */
export async function revealShadowsText(userId: string, caseId: string): Promise<{ text: string; revealed: ShadowRow[] }> {
  try {
    const { revealed, integrityFailures } = await revealShadowsForCase(userId, caseId);
    if (revealed.length === 0 && integrityFailures === 0) return { text: '', revealed: [] };

    const lines: string[] = ['\n\n---\n분신의 봉인 예측 — 당신이 정하기 전에 잠겨 있던 것입니다:'];
    for (const r of revealed) {
      const label = r.target === 'outcome' ? '결과 예측' : r.target === 'deviation' ? '이탈 예측' : '선택 예측';
      const late = r.status === 'late' ? ' (봉인이 채택보다 늦어 채점 제외)' : '';
      lines.push(`· [${label}] "${r.expectation}" (확신 ${Math.round(r.confidence * 100)}%)${late}`);
    }
    if (integrityFailures > 0) {
      // 조용히 빼는 대신 뺐다고 말한다 — 봉인의 신뢰는 이 문장이 지킨다.
      lines.push(`· 예측 ${integrityFailures}건은 무결성 검사에 실패해 공개하지 않았습니다.`);
    }
    return { text: lines.join('\n'), revealed };
  } catch (e) {
    console.error('[twin/shadow] reveal failed:', e);
    return { text: '', revealed: [] };
  }
}

/** 공개된 outcome 예측을 관찰과 대조해 3치 판정. 비동기 — 정산을 막지 않는다. */
export async function gradeRevealedShadows(rows: ShadowRow[], observation: string): Promise<void> {
  for (const r of rows) {
    if (r.target !== 'outcome') continue; // choice/deviation 판정은 채택 기록과의 결정론 대조로 별도 처리(M2)
    try {
      const out = await callAnthropicJson({
        system: buildVerdictSystem(),
        user: buildVerdictUser(r.expectation, observation),
        toolName: 'grade_prediction',
        schema: VERDICT_SCHEMA,
        model: 'fast',
        maxTokens: 300,
      });
      if (!out) continue;
      const verdict = out.verdict as ShadowVerdict;
      const quote = String(out.quote ?? '');
      // 인용 없는 supported/contradicted 는 무효 — indeterminate 로 강등한다.
      const honest: ShadowVerdict = verdict !== 'indeterminate' && quote.trim().length === 0 ? 'indeterminate' : verdict;
      await setShadowVerdict(r.id, honest, quote);
    } catch (e) {
      console.error('[twin/shadow] grading failed:', e);
    }
  }
}

/**
 * Next 런타임이면 응답 후에, 아니면(테스트·스크립트) fire-and-forget 으로.
 * 어느 쪽이든 호출자의 응답 경로를 막지 않는다.
 */
export function runAfterResponse(fn: () => Promise<void>): void {
  void (async () => {
    try {
      const { after } = await import('next/server');
      after(fn);
    } catch {
      fn().catch((e) => console.error('[twin] after-fallback failed:', e));
    }
  })();
}
