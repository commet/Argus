// TWIN M5 — 보정 거울. **사용자가 그때 적어 둔 예측**을 현실과 대조한다.
//
// 이 파일이 다루는 것은 분신이 아니라 사용자다. 그래서 규율이 가장 조심스럽다.
//
// 무엇을 채점하는가: `argus_adopt` 의 materialBeliefs — 각 믿음에 사용자가
// 직접 고른 confident / uncertain / contested 가 붙어 있고, 그것은 **결과를
// 알기 전에** 적힌 확신도다. 사전등록의 정의 그대로이며, CLAUDE.md TWIN
// 수정조항이 채점을 허용하는 둘 중 하나다.
//
// 무엇을 채점하지 **않는가**: 사용자. "당신은 과신하는 편입니다" 같은 문장은
// 이 파일에서 나올 수 없다. 나오는 것은 "confident 로 적으신 믿음 12건 중
// 9건이 뒷받침됐습니다 (근거: case-…)" 뿐이고, 그 문장의 주어는 사람이 아니라
// **문장들**이다.
//
// 숫자를 지어내지 않는다: 세 등급에 0.85/0.6/0.4 를 붙여 Brier 를 내고 싶은
// 유혹이 있으나 그 확률은 사용자가 말한 적이 없다. 등급별 적중률만 낸다 —
// 그것이 보정(신뢰도 구간별 실제 적중률)의 정의이고, 지어낸 확률 없이 계산할
// 수 있는 유일한 정직한 형태다.

import { adminClient } from '@/lib/share-guard';
import { callAnthropicJson } from '@/lib/llm-server';
import { sanitizeForPrompt } from '@/lib/persona-prompt';

const BELIEF_MODEL_LABEL = 'anthropic:fast-tier';

/** 한 정산에서 채점하는 믿음의 상한. 그 이상은 관찰 하나로 판정할 수 없다. */
const MAX_BELIEFS_PER_SETTLEMENT = 5;

/** 등급별 표본이 이보다 적으면 숫자를 보여주지 않는다. */
export const CALIBRATION_MIN_SAMPLE = 5;

export type StatedConfidence = 'confident' | 'uncertain' | 'contested';
export type BeliefVerdict = 'supported' | 'contradicted' | 'indeterminate';

export interface StatedBelief {
  belief: string;
  confidence?: StatedConfidence;
}

const GRADE_SCHEMA = {
  type: 'object' as const,
  properties: {
    verdicts: {
      type: 'array',
      description: '입력 믿음과 **같은 순서·같은 개수**로. 판정할 수 없으면 indeterminate.',
      items: {
        type: 'object',
        properties: {
          verdict: { type: 'string', enum: ['supported', 'contradicted', 'indeterminate'] },
          quote: { type: 'string', description: '관찰문에서 그대로 인용한 근거. indeterminate 면 빈 문자열.' },
        },
        required: ['verdict', 'quote'],
      },
    },
  },
  required: ['verdicts'],
};

/**
 * 정산 때 호출. 사용자가 채택 시 적은 믿음들을 관찰과 대조해 저장한다.
 *
 * 실패는 조용히 물러난다 — 정산을 막지 않는다. 저장 충돌(같은 케이스·같은
 * 믿음)은 DB 유일 색인이 막으므로 이중 채점으로 모수가 부풀지 않는다.
 */
export async function gradeStatedBeliefs(
  userId: string,
  caseId: string,
  beliefs: StatedBelief[],
  observation: string,
): Promise<number> {
  // 확신 등급이 없는 믿음은 채점하지 않는다. 등급을 추측해 붙이는 순간
  // 사용자가 하지 않은 사전등록을 우리가 대신 한 것이 된다.
  const gradable = beliefs
    .filter((b) => b.belief?.trim() && b.confidence)
    .slice(0, MAX_BELIEFS_PER_SETTLEMENT);
  if (gradable.length === 0) return 0;

  try {
    const out = await callAnthropicJson({
      system:
        '사용자가 결정을 내릴 때 적어 둔 사실 믿음들이 있다. 정산 때 사용자가 말한 실제 관찰과 ' +
        '대조해 각각을 판정하라. 셋 중 하나씩: supported / contradicted / indeterminate.\n' +
        '· 근거 문장을 관찰문에서 **그대로 인용**해야 하며, 인용 없는 판정은 무효다.\n' +
        '· 관찰이 그 믿음을 다루지 않으면 indeterminate — 의심스러우면 이쪽이다.\n' +
        '· 사용자가 적은 확신 등급은 **주지 않는다.** 등급을 알면 판정이 그쪽으로 끌린다.\n' +
        '· 사람을 평가하지 말고 문장만 본다.',
      user:
        `정산 때 사용자가 말한 실제 관찰:\n"${sanitizeForPrompt(observation)}"\n\n` +
        `그때 적어 둔 믿음들:\n` +
        gradable.map((b, i) => `${i}. ${sanitizeForPrompt(b.belief)}`).join('\n'),
      toolName: 'grade_beliefs',
      schema: GRADE_SCHEMA,
      model: 'fast',
      maxTokens: 600,
    });
    if (!out) return 0;

    const raw = (out as { verdicts?: unknown }).verdicts;
    if (!Array.isArray(raw)) return 0;
    // 개수가 안 맞으면 어느 판정이 어느 믿음의 것인지 알 수 없다. 순서로
    // 짝짓는 구조에서 길이 불일치는 조용히 어긋난 짝을 만들므로 통째로 버린다.
    if (raw.length !== gradable.length) {
      console.error(
        `[twin/beliefs] verdict count ${raw.length} != beliefs ${gradable.length} — dropping all (cannot pair safely)`,
      );
      return 0;
    }

    const rows = gradable.map((b, i) => {
      const v = raw[i] as { verdict?: unknown; quote?: unknown };
      const verdict = String(v?.verdict ?? '');
      const quote = String(v?.quote ?? '').trim();
      // 인용 없는 판정은 무효 — 그림자·위임과 같은 규율.
      const honest: BeliefVerdict =
        (verdict === 'supported' || verdict === 'contradicted') && quote ? verdict : 'indeterminate';
      return {
        user_id: userId,
        case_id: caseId,
        belief: b.belief.trim().slice(0, 500),
        stated_confidence: b.confidence,
        verdict: honest,
        verdict_quote: quote || null,
        model_id: BELIEF_MODEL_LABEL,
      };
    });

    const admin = adminClient();
    const { error } = await admin.from('argus_belief_checks').insert(rows);
    if (error) {
      // 유일 색인 충돌(이미 채점됨)은 정상 경로다 — 백스톱과 겹친 것뿐이다.
      console.error('[twin/beliefs] insert failed:', error.message);
      return 0;
    }
    return rows.length;
  } catch (e) {
    console.error('[twin/beliefs] grading failed:', e);
    return 0;
  }
}

export interface CalibrationBucket {
  stated: StatedConfidence;
  sample: number;
  supported: number;
}

/**
 * 등급별 적중률. indeterminate 는 모수에서 뺀다 — 판정하지 못한 것을
 * 맞혔다고도 틀렸다고도 세지 않는다.
 */
export async function beliefCalibration(userId: string): Promise<CalibrationBucket[]> {
  try {
    const admin = adminClient();
    const { data, error } = await admin
      .from('argus_belief_checks')
      .select('stated_confidence, verdict')
      .eq('user_id', userId)
      .in('verdict', ['supported', 'contradicted']);
    if (error || !data) return [];

    const rows = data as Array<{ stated_confidence: StatedConfidence; verdict: BeliefVerdict }>;
    const order: StatedConfidence[] = ['confident', 'uncertain', 'contested'];
    return order.map((stated) => {
      const inBucket = rows.filter((r) => r.stated_confidence === stated);
      return {
        stated,
        sample: inBucket.length,
        supported: inBucket.filter((r) => r.verdict === 'supported').length,
      };
    });
  } catch {
    return [];
  }
}

const LABEL: Record<StatedConfidence, string> = {
  confident: '확신한다',
  uncertain: '불확실하다',
  contested: '다툼이 있다',
};

/**
 * 보정 거울 문안. **당김(pull) 표면에서만 쓴다** — 사용자가 argus_recall 을
 * 직접 불렀을 때. 결정을 여는 중이나 정산 직후에 이 숫자를 들이미는 것은
 * 요청받지 않은 성적표이고, 기획서 §9 위험표의 "성적표 공포"가 가리키는 것이다.
 *
 * 표본 미달 등급은 숫자를 감추고 몇 건이 더 필요한지 말한다. 전부 미달이면
 * 빈 문자열 — 없는 성적을 있는 척하지 않는다.
 */
export function calibrationLines(buckets: CalibrationBucket[]): string {
  const ready = buckets.filter((b) => b.sample >= CALIBRATION_MIN_SAMPLE);
  if (ready.length === 0) return '';
  const lines = ready.map((b) => {
    const pct = Math.round((b.supported / b.sample) * 100);
    return `· "${LABEL[b.stated]}"고 적으신 믿음 ${b.sample}건 중 ${b.supported}건이 뒷받침됐습니다 (${pct}%)`;
  });
  return (
    '그때 적어 두신 믿음이 현실과 얼마나 맞았는지 (결과를 알기 전에 적으신 것만 셉니다):\n' +
    lines.join('\n') +
    '\n이 숫자는 당신에 대한 평가가 아니라 **그 문장들**의 성적입니다. ' +
    '판정하지 못한 것은 세지 않았고, 근거 인용이 없는 판정도 세지 않았습니다.'
  );
}
