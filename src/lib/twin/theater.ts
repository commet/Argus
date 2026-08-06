// TWIN 시뮬레이션 극장 — 사용자가 쉬는 동안 분신이 도는 무대.
//
// 등급 라벨이 이 파일의 헌법이다:
// · graded    — 결과가 이미 나온 공개 사례에 대한 예측을 실결과로 채점한 것
// · fiction   — 가지 않은 길의 재생. **현실 결과가 없으므로 채점 불가**이며,
//               사실처럼 쓰는 순간 LLM-glue 위반이다
// 라벨 없는 산출물은 DB 제약(not null)이 거부하고, 리포트 문안도 라벨을
// 사람 말로 옮겨 싣는다. 극장 산출물은 어떤 경로로도 프로필 증거가 되지 않는다.

import { adminClient } from '@/lib/share-guard';
import { callAnthropicJson } from '@/lib/llm-server';
import { CASE_BANK_SEED } from './case-bank-seed';
import { profileLines } from './profile';

const THEATER_MODEL_LABEL = 'anthropic:fast-tier';

// ── case bank 시드 적재 (멱등) ────────────────────────────────────────────
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
  title: string;
  body: string;
  correct?: boolean;
}

export async function playBankCase(
  userId: string,
  bank: (typeof CASE_BANK_SEED)[number],
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

  const confidence = typeof out.confidence === 'number' ? Math.min(Math.max(out.confidence, 0), 1) : 0.5;
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
    title: `${bank.domain} — ${bank.id}`,
    body:
      `상황: ${bank.situation}\n` +
      `분신의 예측: ${chosenLabel} (확신 ${Math.round(confidence * 100)}%)\n` +
      `실제: ${bank.outcome_note}\n` +
      `채점: ${correct ? '적중' : '빗나감'} · 출처: ${bank.source_url}`,
    correct,
  };
}

// 이 사용자가 아직 안 푼 bank 사례를 고른다.
export async function unplayedBankCases(userId: string, limit = 2) {
  const admin = adminClient();
  const { data } = await admin
    .from('argus_simulation_runs')
    .select('source_ref')
    .eq('user_id', userId)
    .eq('source', 'case_bank');
  const played = new Set((data ?? []).map((r) => r.source_ref as string));
  return CASE_BANK_SEED.filter((c) => !played.has(c.id)).slice(0, limit);
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
export function buildTheaterReport(items: TheaterItem[]): { subject: string; text: string } {
  const graded = items.filter((i) => i.gradeLabel === 'graded');
  const fiction = items.filter((i) => i.gradeLabel === 'fiction');
  const hits = graded.filter((i) => i.correct).length;

  const lines: string[] = ['분신 극장 — 이번 주 당신의 분신이 생각한 것들.'];
  if (graded.length > 0) {
    lines.push('', `■ 채점된 것 (결과가 이미 나온 공개 사례, ${hits}/${graded.length} 적중)`);
    for (const i of graded) lines.push('', `[채점됨] ${i.title}`, i.body);
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
