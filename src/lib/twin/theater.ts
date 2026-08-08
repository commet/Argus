// TWIN 시뮬레이션 극장 — 사용자가 쉬는 동안 분신이 도는 무대.
//
// 등급 라벨이 이 파일의 헌법이다:
// · graded    — 정답이 실재하는 문제를 푼 것. 두 트랙이 있고 리포트에서 절이
//               갈린다: 공개 사례(정답=역사) 와 변장 재제시(정답=사용자의 실제
//               선택, noise.ts). 한 절에 묶으면 "공개 사례"가 거짓말이 된다
// · fiction   — 가지 않은 길의 재생. **현실 결과가 없으므로 채점 불가**이며,
//               사실처럼 쓰는 순간 LLM-glue 위반이다
// 라벨 없는 산출물은 DB 제약(not null)이 거부하고, 리포트 문안도 라벨을
// 사람 말로 옮겨 싣는다. 극장 산출물은 어떤 경로로도 프로필 증거가 되지 않는다.

import { adminClient } from '@/lib/share-guard';
import { callAnthropicJson } from '@/lib/llm-server';
import { CASE_BANK_SEED, type CaseBankItem } from './case-bank-seed';
import { profileLines } from './profile';
import { TWIN_SCORE_MIN_SAMPLE } from './store';

const THEATER_MODEL_LABEL = 'anthropic:fast-tier';

// ── case bank 시드 적재 (멱등) ────────────────────────────────────────────
//
// 시드는 코드가 갖고 **정본은 테이블이 갖는다.** 읽기까지 코드 상수로 하면
// 테이블은 장식이 되고(지워도 아무도 눈치채지 못한다), 사례를 한 건 늘리는 데
// 배포가 필요해진다 — 기획서가 "확장은 별도 콘텐츠 작업"이라 적어 둔 것과
// 어긋난다. 그래서 시드는 밀어 넣고, 재생은 테이블에서 읽는다.
export async function ensureCaseBankSeeded(): Promise<void> {
  const admin = adminClient();
  const { error } = await admin.from('argus_case_bank').upsert(
    CASE_BANK_SEED.map((c) => ({
      id: c.id,
      domain: c.domain,
      situation: c.situation,
      options: c.options,
      outcome_key: c.outcome_key,
      outcome_note: c.outcome_note,
      source_url: c.source_url,
    })),
    { onConflict: 'id' },
  );
  if (error) throw new Error(`case bank seed failed: ${error.message}`);
}

// ── 분신이 bank 사례를 푼다 (엄밀 트랙) ──────────────────────────────────
const BANK_SCHEMA = {
  type: 'object' as const,
  properties: {
    choice_key: { type: 'string', description: 'options 의 key 중 하나 — 실제로 일어났다고 예측하는 쪽' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reasoning: { type: 'string' },
  },
  required: ['choice_key', 'confidence', 'reasoning'],
};

export interface TheaterItem {
  gradeLabel: 'graded' | 'fiction';
  // 채점된 것끼리도 **무엇에 대한 채점인지**가 다르다. 공개 사례 채점과 변장
  // 재제시를 한 절에 묶으면 "결과가 이미 나온 공개 사례"라는 문장이 변장
  // 항목에 대해 거짓말이 된다. 라벨이 헌법인 파일에서 그건 자기모순이다.
  track?: 'bank' | 'disguised';
  title: string;
  body: string;
  correct?: boolean;
  // 생산한 필드는 소비하거나 명시적으로 포기한다 — 저장만 하고 아무도 읽지
  // 않으면 그 숫자는 dead-on-arrival 이다. 리포트의 보정 줄이 이것을 쓴다.
  brier?: number;
}

export async function playBankCase(
  userId: string,
  bank: CaseBankItem,
  profile: string[],
): Promise<TheaterItem | null> {
  const out = await callAnthropicJson({
    system:
      '너는 아래 판단 프로필을 가진 사용자의 판단 분신이다. 이미 결과가 나온 역사적 결정의 ' +
      '**후일담을 예측**하라 — 무엇을 골라야 했는지가 아니라, 그 결정 뒤에 실제로 무슨 일이 ' +
      '일어났을지를. 결과를 아는 척하지 말고, 결정 시점 정보만으로 추론하라.\n\n' +
      (profile.length > 0 ? '판단 프로필:\n' + profile.map((l) => `· ${l}`).join('\n') : '판단 프로필: 아직 없음.'),
    user:
      `${bank.situation}\n\n무슨 일이 일어났는가?\n` +
      bank.options.map((o) => `- ${o.key}: ${o.label}`).join('\n'),
    toolName: 'predict_outcome',
    schema: BANK_SCHEMA,
    model: 'fast',
    maxTokens: 400,
  });
  if (!out) return null;

  const choiceKey = String(out.choice_key ?? '');
  const valid = bank.options.some((o) => o.key === choiceKey);
  if (!valid) return null; // options 밖의 답은 답이 아니다

  // 확신도를 0.5 로 메우지 않는다 — 그 값이 Brier 성분을 만들고 성적표에 실린다.
  // 지어낸 확신으로 계산한 보정 점수는 그럴듯한 가짜 숫자다.
  if (typeof out.confidence !== 'number' || out.confidence < 0 || out.confidence > 1) return null;
  const confidence = out.confidence;
  const correct = choiceKey === bank.outcome_key;
  // Brier 성분: 맞으면 (1-p)^2, 틀리면 p^2 — 낮을수록 좋다.
  const brier = correct ? (1 - confidence) ** 2 : confidence ** 2;
  const chosenLabel = bank.options.find((o) => o.key === choiceKey)?.label ?? choiceKey;

  const admin = adminClient();
  const { error } = await admin.from('argus_simulation_runs').insert({
    user_id: userId,
    source: 'case_bank',
    grade_label: 'graded',
    source_ref: bank.id,
    content: `예측: ${chosenLabel} (확신 ${Math.round(confidence * 100)}%) — ${String(out.reasoning ?? '')}`,
    correct,
    brier_component: brier,
    model_id: THEATER_MODEL_LABEL,
  });
  if (error) {
    console.error('[twin/theater] bank run insert failed:', error.message);
    return null;
  }

  return {
    gradeLabel: 'graded',
    track: 'bank',
    title: `${bank.domain} — ${bank.id}`,
    body:
      `상황: ${bank.situation}\n` +
      `분신의 예측: ${chosenLabel} (확신 ${Math.round(confidence * 100)}%)\n` +
      `실제: ${bank.outcome_note}\n` +
      `채점: ${correct ? '적중' : '빗나감'} · 출처: ${bank.source_url}`,
    correct,
    brier,
  };
}

/**
 * 아직 재생하지 않은 "가지 않은 길" 후보 — 정산됐고 기각 대안이 기록된 케이스.
 * 기각 대안이 없으면 재생할 길도 없다 (지어내지 않는다).
 */
export async function unreplayedUntakenPaths(userId: string, limit = 1) {
  const admin = adminClient();
  const { data: cases } = await admin
    .from('argus_cases')
    .select('id, title, choice, rejected_alternative')
    .eq('user_id', userId)
    .not('settled_at', 'is', null)
    .not('rejected_alternative', 'is', null)
    .order('settled_at', { ascending: false })
    .limit(limit * 5);
  if (!cases || cases.length === 0) return [];

  const { data: done } = await admin
    .from('argus_simulation_runs')
    .select('source_ref')
    .eq('user_id', userId)
    .eq('source', 'untaken');
  const replayed = new Set((done ?? []).map((r) => r.source_ref as string));

  return (cases as Array<{ id: string; title: string | null; choice: string | null; rejected_alternative: string }>)
    .filter((c) => !replayed.has(c.id) && c.choice)
    .slice(0, limit)
    .map((c) => ({
      caseId: c.id,
      question: c.title ?? c.id,
      choice: c.choice!,
      rejectedAlternative: c.rejected_alternative,
    }));
}

// 이 사용자가 아직 안 푼 bank 사례를 고른다 — **테이블에서** 읽는다.
// 읽기 실패는 던진다: 조용히 빈 배열을 돌려주면 "이번 주엔 풀 사례가 없었다"와
// "은행을 못 읽었다"가 구분되지 않고, 크론은 아무 일도 없었던 것처럼 끝난다.
export async function unplayedBankCases(userId: string, limit = 2): Promise<CaseBankItem[]> {
  const admin = adminClient();
  const { data: runs } = await admin
    .from('argus_simulation_runs')
    .select('source_ref')
    .eq('user_id', userId)
    .eq('source', 'case_bank');
  const played = new Set((runs ?? []).map((r) => r.source_ref as string));

  const { data, error } = await admin
    .from('argus_case_bank')
    .select('id, domain, situation, options, outcome_key, outcome_note, source_url')
    .order('id');
  if (error) throw new Error(`case bank read failed: ${error.message}`);

  const rows = (data ?? []) as Array<CaseBankItem & { options: unknown }>;
  return rows
    .filter((c) => !played.has(c.id))
    .map((c) => ({ ...c, options: normalizeOptions(c.options) }))
    // 선택지가 둘 미만이면 채점할 수 있는 문제가 아니다 — 지어내지 않고 건너뛴다.
    .filter((c) => c.options.length >= 2 && c.options.some((o) => o.key === c.outcome_key))
    .slice(0, limit);
}

// jsonb 는 무엇이든 들어올 수 있다 (사람이 손으로 사례를 넣을 수 있는 테이블이다).
// 모양이 아니면 빈 배열 — 위 필터가 그런 행을 걸러 낸다.
function normalizeOptions(raw: unknown): Array<{ key: string; label: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o): o is { key: string; label: string } =>
      Boolean(o) && typeof (o as { key?: unknown }).key === 'string' && typeof (o as { label?: unknown }).label === 'string',
    )
    .map((o) => ({ key: o.key, label: o.label }));
}

// ── 가지 않은 길 (허구 트랙) ─────────────────────────────────────────────
const UNTAKEN_SCHEMA = {
  type: 'object' as const,
  properties: {
    narrative: {
      type: 'string',
      description: '기각된 대안을 골랐다면 이 사용자가 어떻게 추론했을지 — 3문장 이내. 결과 단정 금지, 추론 전시만.',
    },
  },
  required: ['narrative'],
};

export async function replayUntakenPath(
  userId: string,
  settled: { caseId: string; question: string; choice: string; rejectedAlternative: string },
  profile: string[],
): Promise<TheaterItem | null> {
  const out = await callAnthropicJson({
    system:
      '기각된 대안의 재생이다. **일어나지 않은 일이므로 결과를 단정할 수 없다** — ' +
      '이 사용자가 그 길을 골랐다면 어떤 추론을 했을지만 3문장 이내로 전시하라. ' +
      '"~했을 것이다" 같은 결과 서술 금지, 추론 과정만.\n\n' +
      (profile.length > 0 ? '판단 프로필:\n' + profile.map((l) => `· ${l}`).join('\n') : ''),
    user: `결정: ${settled.question}\n실제 채택: ${settled.choice}\n기각된 대안: ${settled.rejectedAlternative}`,
    toolName: 'replay_untaken',
    schema: UNTAKEN_SCHEMA,
    model: 'fast',
    maxTokens: 300,
  });
  if (!out || !out.narrative) return null;

  const admin = adminClient();
  const { error } = await admin.from('argus_simulation_runs').insert({
    user_id: userId,
    source: 'untaken',
    grade_label: 'fiction',
    source_ref: settled.caseId,
    content: String(out.narrative),
    model_id: THEATER_MODEL_LABEL,
  });
  if (error) {
    console.error('[twin/theater] untaken run insert failed:', error.message);
    return null;
  }
  return {
    gradeLabel: 'fiction',
    title: `가지 않은 길 — ${settled.question}`,
    body: `기각했던 대안: ${settled.rejectedAlternative}\n분신의 재생: ${String(out.narrative)}`,
  };
}

// ── 주간 리포트 문안 ─────────────────────────────────────────────────────
export function buildTheaterReport(
  items: TheaterItem[],
  score?: { matchRate: number | null; matchSample: number; outcomeRate: number | null; outcomeSample: number },
): { subject: string; text: string } {
  const graded = items.filter((i) => i.gradeLabel === 'graded' && i.track !== 'disguised');
  const disguised = items.filter((i) => i.track === 'disguised');
  const fiction = items.filter((i) => i.gradeLabel === 'fiction');
  const hits = graded.filter((i) => i.correct).length;

  const lines: string[] = ['분신 극장 — 이번 주 당신의 분신이 생각한 것들.'];

  // 성적표. 표본이 임계 미달이면 숫자를 감추고 "아직 모른다"고 말한다 —
  // 표본 3건짜리 퍼센트는 정보가 아니라 소음이다 (TWIN §6.2).
  if (score) {
    const MIN = TWIN_SCORE_MIN_SAMPLE;
    const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)}%`);
    const parts: string[] = [];
    parts.push(
      score.matchSample >= MIN
        ? `· 분신이 당신의 선택을 맞힌 비율: ${pct(score.matchRate)} (${score.matchSample}건)`
        : `· 분신이 당신의 선택을 맞힌 비율: 아직 모릅니다 (정산 ${score.matchSample}건, ${MIN}건부터 표시)`,
    );
    parts.push(
      score.outcomeSample >= MIN
        ? `· 분신이 현실을 맞힌 비율: ${pct(score.outcomeRate)} (${score.outcomeSample}건)`
        : `· 분신이 현실을 맞힌 비율: 아직 모릅니다 (정산 ${score.outcomeSample}건, ${MIN}건부터 표시)`,
    );
    lines.push('', '■ 분신 성적 — 당신이 아니라 분신의 예측을 채점한 것입니다', ...parts);
  }
  if (graded.length > 0) {
    lines.push('', `■ 채점된 것 (결과가 이미 나온 공개 사례, ${hits}/${graded.length} 적중)`);
    // 보정(Brier): 맞고 틀림만이 아니라 **확신의 크기가 맞았는지**. 낮을수록
    // 좋고, 슈퍼포캐스터 0.166 / 일반 0.259 가 외부 기준선이다.
    const briers = graded.map((i) => i.brier).filter((b): b is number => typeof b === 'number');
    if (briers.length > 0) {
      const avg = briers.reduce((a, b) => a + b, 0) / briers.length;
      lines.push(`보정 점수(Brier) 평균 ${avg.toFixed(3)} — 낮을수록 확신의 크기까지 맞은 것입니다.`);
    }
    for (const i of graded) lines.push('', `[채점됨] ${i.title}`, i.body);
  }
  if (disguised.length > 0) {
    // 잡음 거울. 같은 'graded' 라벨이지만 채점의 **대상**이 다르다 —
    // 여기서 맞았다는 것은 "표면을 바꿔도 같은 답이 나왔다"는 뜻이다.
    const dHits = disguised.filter((i) => i.correct).length;
    lines.push(
      '',
      `■ 변장 재제시 (당신의 지난 결정을 다른 업종·다른 숫자로 바꿔 분신에게 다시 물은 것, ${dHits}/${disguised.length} 일치)`,
      '표면을 바꿔도 같은 답이 나오는지를 본 것입니다. 채점 대상은 분신이며, 당신에 대한 평가가 아닙니다.',
    );
    for (const i of disguised) lines.push('', `[변장 재제시] ${i.title}`, i.body);
  }
  if (fiction.length > 0) {
    lines.push('', '■ 허구 — 가지 않은 길의 재생. 일어나지 않은 일이므로 채점할 수 없습니다.');
    for (const i of fiction) lines.push('', `[허구] ${i.title}`, i.body);
  }
  lines.push(
    '',
    '분신은 당신의 정산 기록 위에서 생각합니다. 정산이 쌓일수록 이 극장은 당신을 닮아갑니다.',
  );
  return { subject: '분신 극장 — 이번 주의 시뮬레이션', text: lines.join('\n') };
}
