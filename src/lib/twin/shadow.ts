// TWIN 그림자 시험 — 생성·봉인·공개·채점의 조율 층.
//
// 실패 원칙: 그림자는 부가 기능이다. 생성이 실패하면 **로그를 남기고 조용히
// 물러난다** — 사용자의 결정 열기를 막지 않는다. 대신 크론 백스톱이 "그림자
// 없는 최근 케이스"를 쓸어담아 재시도하므로, 실패는 침묵이 아니라 지연이 된다.
// (ANTHROPIC_API_KEY 없는 환경에서도 같은 경로 — 지어내는 폴백은 없다.)

import { after } from 'next/server';
import { callAnthropicJson } from '@/lib/llm-server';
import {
  buildChoiceVerdictUser,
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

// 확신도는 **지어내지 않는다.** 0.5 로 메우면 "확신 50%"가 사용자에게 표시되고,
// 그것이 모델이 말한 값인지 우리가 채운 값인지 구분할 수 없다 — 이 파일 상단이
// 금지한 바로 그 형태다. 범위 밖·부재면 null 을 돌려주고 호출부가 그 예측을 버린다.
function num(v: unknown): number | null {
  return typeof v === 'number' && v >= 0 && v <= 1 ? v : null;
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
    const outcomeConfidence = num(out.outcome_confidence);
    const secondConfidence = num(out.second_confidence);

    const candidates: Array<ShadowDraft | null> = [
      outcomeConfidence === null
        ? null
        : {
            target: 'outcome' as const,
            expectation: String(out.outcome_expectation ?? ''),
            reasoning: String(out.reasoning ?? ''),
            confidence: outcomeConfidence,
            contaminatedByLean: hasLean,
            modelId: SHADOW_MODEL_LABEL,
            late,
          },
      secondConfidence === null
        ? null
        : {
            // lean 이 있으면 선택 예측은 자명하므로(오염) 이탈 예측으로 전환한다.
            target: hasLean ? ('deviation' as const) : ('choice' as const),
            expectation: String(out.second_expectation ?? ''),
            reasoning: String(out.reasoning ?? ''),
            confidence: secondConfidence,
            contaminatedByLean: hasLean,
            modelId: SHADOW_MODEL_LABEL,
            late,
          },
    ];
    const drafts = candidates.filter((d): d is ShadowDraft => d !== null && d.expectation.length > 0);

    if (drafts.length === 0) {
      console.error('[twin/shadow] no usable prediction (empty expectation or unstated confidence) — nothing sealed');
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

/**
 * 공개된 예측 전부를 3치 판정한다. 비동기 — 정산을 막지 않는다.
 *
 * 대조 대상이 target 마다 다르다:
 * · outcome            → **현실**(사용자의 관찰문). accuracy 의 재료
 * · choice / deviation → **사용자의 실제 채택**. match rate 의 재료
 *
 * 봉인만 하고 채점하지 않으면 그 데이터는 죽은 데이터다 — 두 지표 중 하나가
 * 영영 계산되지 않는다.
 */
export async function gradeRevealedShadows(
  rows: ShadowRow[],
  observation: string,
  adopted?: { choice: string; lean?: string },
): Promise<void> {
  for (const r of rows) {
    // 늦게 봉인된 예측은 채점하지 않는다 — 채택을 보고 쓴 예측이므로.
    if (r.status === 'late') continue;

    const isChoiceLike = r.target === 'choice' || r.target === 'deviation';
    if (isChoiceLike && !adopted) continue; // 채택 기록이 없으면 대조할 것이 없다

    try {
      const out = await callAnthropicJson({
        system: buildVerdictSystem(),
        user: isChoiceLike
          ? buildChoiceVerdictUser(r.target as 'choice' | 'deviation', r.expectation, adopted!.choice, adopted!.lean)
          : buildVerdictUser(r.expectation, observation),
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
  // **동기 호출이어야 한다.** 예전 구현은 `await import('next/server')` 뒤에
  // after() 를 불렀는데, 그 await 가 마이크로태스크를 하나 끼워 넣어 응답이
  // 이미 나간 뒤에 after() 가 불릴 수 있었다. 그러면 "요청 범위 밖" 오류가 나고
  // catch 로 떨어져 **그냥 떠 있는 promise** 가 되며, 서버리스에서 그것은
  // 람다가 얼면 죽는다 — 그림자는 크론 백스톱이 있으나 프로필 추출은 없어서
  // "정산했는데 분신이 아무것도 배우지 않는" 조용한 실패가 된다.
  try {
    after(fn);
  } catch (e) {
    // 요청 범위 밖(테스트·스크립트)에서는 그냥 돌린다. 여기서 죽으면 안 된다.
    console.error('[twin] after() unavailable, running inline:', e);
    fn().catch((err) => console.error('[twin] after-fallback failed:', err));
  }
}
