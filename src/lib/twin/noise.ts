// TWIN 잡음 거울 — 분신이 나를 **기억**하는가, **일반화**하는가.
//
// 기획서 §4.4 의 마지막 미시공분. bootstrapping 문헌(Meehl→Goldberg→Dawes)의
// 핵심 기제는 "판단자의 모델이 판단자를 이기는 이유 = 모델에는 잡음이 없다"였다.
// 그 기제를 제품 기능으로 뒤집은 것이 이것이다: **과거의 자기 결정을 변장시켜**
// 분신에게 다시 물어보고, 분신이 그때 사용자가 실제로 한 선택과 같은 답을
// 내는지 본다.
//
// 무엇을 재는가 (그리고 무엇을 재지 않는가):
// · 재는 것 — 분신이 표면(회사 이름·숫자·업종)이 아니라 **구조**를 배웠는가.
//   원문 그대로 물으면 프로필에 그 케이스가 근거로 박혀 있어 자명하게 맞힌다.
//   변장을 통과해야 "일반화"라 부를 수 있다.
// · 재지 않는 것 — **사용자의 일관성이 아니다.** 그것을 재려면 사용자에게
//   퀴즈를 내야 하고, 그 순간 이 도구는 사람을 시험하는 물건이 된다
//   (zero-judgment 위반). 채점 대상은 여기서도 분신의 예측뿐이다.
//
// 오염 방지선 셋:
// 1. 변장 프롬프트에 **사용자의 실제 선택을 넣지 않는다** — 질문만 넣는다.
//    답을 아는 채로 문제를 내면 문제에 답이 새어 들어간다.
// 2. 선택지 순서는 caseId 로 **결정론적으로** 뒤집는다. 늘 정답이 앞이면
//    분신이 위치를 배운다.
// 3. 변장이 실패하면(원문 고유명사가 그대로 남으면) 그 케이스는 버린다.

import { adminClient } from '@/lib/share-guard';
import { callAnthropicJson } from '@/lib/llm-server';
import { sanitizeForPrompt } from '@/lib/persona-prompt';
import type { TheaterItem } from './theater';

const NOISE_MODEL_LABEL = 'anthropic:fast-tier';

/** 변장의 재료가 되려면 정산됐고, 선택과 기각 대안이 **둘 다** 있어야 한다. */
export interface DisguiseSource {
  caseId: string;
  question: string;
  choice: string;
  rejectedAlternative: string;
}

const DISGUISE_SCHEMA = {
  type: 'object' as const,
  properties: {
    situation: { type: 'string', description: '변장된 상황 서술. 결정 시점에 알 수 있던 것만.' },
    option_a: { type: 'string', description: '첫 번째 선택지를 같은 구조로 바꾼 문장.' },
    option_b: { type: 'string', description: '두 번째 선택지를 같은 구조로 바꾼 문장.' },
  },
  required: ['situation', 'option_a', 'option_b'],
};

/**
 * 변장. **사용자의 실제 선택이 무엇이었는지 모델에게 알려주지 않는다** —
 * 두 선택지를 대등하게 주고 둘 다 바꾸게 한다.
 */
export async function disguiseCase(
  src: DisguiseSource,
  flip: boolean,
): Promise<{ situation: string; options: Array<{ key: 'a' | 'b'; label: string }> } | null> {
  // 순서를 먼저 정하고 그 순서대로 준다. 늘 실제 선택이 앞이면 변장을 해도
  // 위치가 답을 알려 준다.
  const first = flip ? src.rejectedAlternative : src.choice;
  const second = flip ? src.choice : src.rejectedAlternative;

  const out = await callAnthropicJson({
    system:
      '아래 결정을 **다른 업종·다른 이름·다른 숫자**로 바꿔 같은 구조의 문제로 만들어라.\n' +
      '· 결정의 뼈대(무엇과 무엇 사이의 선택인가, 무엇이 걸려 있나)는 그대로 둔다.\n' +
      '· 고유명사·구체적 숫자·업종은 전부 바꾼다.\n' +
      '· 어느 쪽이 나은지 암시하지 말 것. 두 선택지를 대등하게 쓸 것.\n' +
      '· 실제로 무엇이 선택됐는지는 너에게 주어지지 않았다. 추측해서 티내지 말 것.',
    user:
      `결정 질문: "${sanitizeForPrompt(src.question)}"\n` +
      `선택지 1: "${sanitizeForPrompt(first)}"\n` +
      `선택지 2: "${sanitizeForPrompt(second)}"`,
    toolName: 'disguise_case',
    schema: DISGUISE_SCHEMA,
    model: 'fast',
    maxTokens: 500,
  });
  if (!out) return null;

  const situation = String(out.situation ?? '').trim();
  const a = String(out.option_a ?? '').trim();
  const b = String(out.option_b ?? '').trim();
  if (!situation || !a || !b) return null;

  // 변장 검사: 원문의 긴 토큰(고유명사·숫자 등)이 그대로 남아 있으면 변장이
  // 아니다. 그런 케이스로 낸 성적은 "구조를 배웠다"의 증거가 되지 못한다.
  if (leaksOriginal(src, `${situation} ${a} ${b}`)) return null;

  return {
    situation,
    options: [
      { key: 'a', label: a },
      { key: 'b', label: b },
    ],
  };
}

/**
 * 변장이 원문을 흘렸는가.
 *
 * 토큰 단위 비교는 한국어에서 쓸 수 없다 — "브랜드로"·"계약직을" 같은 흔한
 * 말이 걸려 멀쩡한 변장이 전부 버려지고, 그러면 이 기능은 **조용히 아무것도
 * 하지 않는 기능**이 된다 (가장 나쁜 실패 형태다). 대신 둘만 본다:
 *
 * 1. **긴 공통 부분문자열** — 공백을 뺀 6자 이상이 겹치면 문구를 옮겨 적은 것이다.
 *    낱말 하나가 겹치는 것과 어구가 통째로 남는 것은 다른 사건이다.
 * 2. **원문의 숫자** — 프롬프트가 숫자를 바꾸라고 지시했으므로, 두 자리 이상
 *    숫자가 그대로면 변장이 지시를 따르지 않은 것이다.
 */
const LEAK_MIN_SUBSTRING = 6;

function leaksOriginal(src: DisguiseSource, disguised: string): boolean {
  const source = `${src.question} ${src.choice} ${src.rejectedAlternative}`;

  for (const n of source.match(/\d{2,}/g) ?? []) {
    if (disguised.includes(n)) return true;
  }

  const a = source.replace(/\s+/g, '');
  const b = disguised.replace(/\s+/g, '');
  return longestCommonSubstring(a, b) >= LEAK_MIN_SUBSTRING;
}

/** 표준 DP. 두 문자열 모두 수백 자 규모라 이 비용은 문제가 되지 않는다. */
function longestCommonSubstring(a: string, b: string): number {
  if (!a || !b) return 0;
  let best = 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) best = cur[j];
      }
    }
    prev = cur;
  }
  return best;
}

const ANSWER_SCHEMA = {
  type: 'object' as const,
  properties: {
    choice_key: { type: 'string', description: 'a 또는 b — 이 사용자라면 골랐을 쪽.' },
    reasoning: { type: 'string' },
  },
  required: ['choice_key', 'reasoning'],
};

/**
 * 변장된 자기 케이스를 분신에게 다시 묻는다. 정답은 사용자가 **실제로** 고른 쪽.
 * 결과는 argus_simulation_runs(source='distant', grade_label='graded')로 남는다.
 */
export async function playDisguisedCase(
  userId: string,
  src: DisguiseSource,
  profile: string[],
): Promise<TheaterItem | null> {
  // 순서 뒤집기는 caseId 에서 결정론적으로 나온다 — 같은 케이스는 늘 같은
  // 배치가 되므로 재현 가능하고, 케이스마다 배치가 달라 위치 학습을 막는다.
  const flip = [...src.caseId].reduce((n, c) => n + c.charCodeAt(0), 0) % 2 === 1;
  const disguised = await disguiseCase(src, flip);
  if (!disguised) return null;

  // 실제 선택은 flip 여부에 따라 a 또는 b 다.
  const truthKey: 'a' | 'b' = flip ? 'b' : 'a';

  const out = await callAnthropicJson({
    system:
      '너는 이 사용자의 판단 분신이다. 아래 상황에서 **이 사용자라면** 어느 쪽을 고를지 하나만 답하라.\n' +
      '어느 쪽이 옳은지가 아니라, 이 사람의 판단 패턴이 어디로 가는지를 답하는 것이다.\n\n' +
      (profile.length > 0
        ? '판단 프로필:\n' + profile.map((l) => `· ${l}`).join('\n')
        : '판단 프로필: 아직 없음.'),
    user:
      `${disguised.situation}\n\n` +
      disguised.options.map((o) => `- ${o.key}: ${o.label}`).join('\n'),
    toolName: 'answer_disguised',
    schema: ANSWER_SCHEMA,
    model: 'fast',
    maxTokens: 400,
  });
  if (!out) return null;

  const key = String(out.choice_key ?? '').trim().toLowerCase();
  if (key !== 'a' && key !== 'b') return null; // 선택지 밖의 답은 답이 아니다
  const correct = key === truthKey;

  const admin = adminClient();
  const { error } = await admin.from('argus_simulation_runs').insert({
    user_id: userId,
    source: 'distant',
    grade_label: 'graded',
    source_ref: src.caseId,
    content: `변장 재제시 — 분신의 답: ${key} · 실제: ${truthKey} · 근거: ${String(out.reasoning ?? '')}`,
    correct,
    model_id: NOISE_MODEL_LABEL,
  });
  if (error) {
    console.error('[twin/noise] insert failed:', error.message);
    return null;
  }

  return {
    gradeLabel: 'graded',
    track: 'disguised',
    title: `변장 재제시 — ${src.caseId}`,
    body:
      `${disguised.situation}\n` +
      disguised.options.map((o) => `- ${o.key}: ${o.label}`).join('\n') +
      `\n분신의 답: ${key} · 당신이 실제로 간 쪽: ${truthKey}\n` +
      `채점: ${correct ? '같았습니다' : '달랐습니다'} — 표면을 바꿔도 같은 답이 나오는지 본 것입니다 ` +
      '(채점 대상은 분신의 예측입니다).',
    correct,
  };
}

/** 변장 재제시 후보: 오래 전에 정산됐고, 아직 변장으로 낸 적 없는 케이스. */
export async function unplayedDisguiseSources(userId: string, minAgeDays = 30, limit = 1): Promise<DisguiseSource[]> {
  try {
    const admin = adminClient();
    const before = new Date(Date.now() - minAgeDays * 86400_000).toISOString();
    const { data: cases } = await admin
      .from('argus_cases')
      .select('id, title, choice, rejected_alternative')
      .eq('user_id', userId)
      .not('settled_at', 'is', null)
      .not('rejected_alternative', 'is', null)
      .lt('settled_at', before)
      .order('settled_at', { ascending: false })
      .limit(limit * 5);
    if (!cases || cases.length === 0) return [];

    const { data: done } = await admin
      .from('argus_simulation_runs')
      .select('source_ref')
      .eq('user_id', userId)
      .eq('source', 'distant');
    const played = new Set((done ?? []).map((r) => r.source_ref as string));

    return (cases as Array<{ id: string; title: string | null; choice: string | null; rejected_alternative: string }>)
      .filter((c) => !played.has(c.id) && c.choice && c.title)
      .slice(0, limit)
      .map((c) => ({
        caseId: c.id,
        question: c.title!,
        choice: c.choice!,
        rejectedAlternative: c.rejected_alternative,
      }));
  } catch {
    return [];
  }
}
