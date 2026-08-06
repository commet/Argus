import { beforeEach, describe, expect, it, vi } from 'vitest';

// TWIN 시뮬레이션 극장 — 등급 라벨과 채점 수학의 기계 검증.
//
// 불변식:
// 1. bank 사례는 "무엇을 골라야 했나"가 아니라 "무슨 일이 일어났나"를 묻는다
//    (반사실 채점 금지 — 시드 형태 검사)
// 2. options 밖의 답은 답이 아니다
// 3. Brier: 맞으면 (1-p)^2, 틀리면 p^2
// 4. 가지 않은 길은 언제나 fiction 라벨 — graded 로 저장될 경로가 없다
// 5. 리포트에서 허구 절은 "채점할 수 없습니다"를 명시한다

const inserted: Array<Record<string, unknown>> = [];
let llmResponse: Record<string, unknown> | null = null;
let playedRefs: Array<{ source_ref: string }> = [];
// 은행은 이제 **테이블이 정본**이다 — 코드 상수는 시드일 뿐이므로 mock 도
// 테이블을 흉내낸다. 기본값은 시드와 같은 내용.
let bankRows: Array<Record<string, unknown>> = [];
let bankError: { message: string } | null = null;

vi.mock('@/lib/llm-server', () => ({
  callAnthropicJson: vi.fn(async () => llmResponse),
}));

vi.mock('@/lib/share-guard', () => ({
  adminClient: () => ({
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        if (table === 'argus_simulation_runs') inserted.push(row);
        return Promise.resolve({ error: null });
      },
      upsert: () => Promise.resolve({ error: null }),
      select: () =>
        table === 'argus_case_bank'
          ? { order: () => Promise.resolve({ data: bankRows, error: bankError }) }
          : { eq: () => ({ eq: () => Promise.resolve({ data: playedRefs, error: null }) }) },
    }),
  }),
}));

vi.mock('../profile', () => ({ profileLines: vi.fn(async () => []) }));

import { CASE_BANK_SEED } from '../case-bank-seed';
import { buildTheaterReport, playBankCase, replayUntakenPath, unplayedBankCases } from '../theater';

beforeEach(() => {
  inserted.length = 0;
  playedRefs = [];
  bankRows = CASE_BANK_SEED.map((c) => ({ ...c }));
  bankError = null;
  llmResponse = { choice_key: CASE_BANK_SEED[0].outcome_key, confidence: 0.8, reasoning: '근거' };
});

describe('case bank 시드 형태', () => {
  it('id 유일, 출처는 https, outcome_key 는 options 안에 있다', () => {
    const ids = CASE_BANK_SEED.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CASE_BANK_SEED) {
      expect(c.source_url).toMatch(/^https:\/\//);
      expect(c.options.map((o) => o.key)).toContain(c.outcome_key);
      expect(c.options.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('시드는 후일담 예측형이다 — situation 이 결과를 미리 말하지 않는다', () => {
    for (const c of CASE_BANK_SEED) {
      // outcome_note 의 핵심 서술이 situation 에 새면 시험지가 답안지가 된다.
      // 완전한 의미 검사는 불가능하므로 형태 검사: situation 은 결정까지만,
      // "무슨 일이 일어났는가"는 options 가 묻는다.
      expect(c.situation.length).toBeGreaterThan(50);
      expect(c.outcome_note.length).toBeGreaterThan(10);
    }
  });
});

describe('playBankCase', () => {
  const bank = CASE_BANK_SEED[0];

  it('적중 시 Brier = (1-p)^2, correct = true 로 저장된다', async () => {
    llmResponse = { choice_key: bank.outcome_key, confidence: 0.8, reasoning: 'r' };
    const item = await playBankCase('user-1', bank, []);
    expect(item?.gradeLabel).toBe('graded');
    expect(item?.correct).toBe(true);
    expect(inserted[0]).toMatchObject({ grade_label: 'graded', correct: true });
    expect(inserted[0].brier_component).toBeCloseTo(0.04, 5);
  });

  it('빗나감 시 Brier = p^2', async () => {
    const wrongKey = bank.options.find((o) => o.key !== bank.outcome_key)!.key;
    llmResponse = { choice_key: wrongKey, confidence: 0.8, reasoning: 'r' };
    const item = await playBankCase('user-1', bank, []);
    expect(item?.correct).toBe(false);
    expect(inserted[0].brier_component).toBeCloseTo(0.64, 5);
  });

  it('options 밖의 답은 저장되지 않는다', async () => {
    llmResponse = { choice_key: 'not-an-option', confidence: 0.9, reasoning: 'r' };
    expect(await playBankCase('user-1', bank, [])).toBeNull();
    expect(inserted).toHaveLength(0);
  });
});

describe('replayUntakenPath', () => {
  it('언제나 fiction 라벨로 저장된다 — 일어나지 않은 일은 채점될 수 없다', async () => {
    llmResponse = { narrative: '그 길에서는 현금 소진 속도를 먼저 봤을 것으로 추론된다.' };
    const item = await replayUntakenPath(
      'user-1',
      { caseId: 'c1', question: '채용?', choice: '계약직', rejectedAlternative: '정규직' },
      [],
    );
    expect(item?.gradeLabel).toBe('fiction');
    expect(inserted[0]).toMatchObject({ grade_label: 'fiction', source: 'untaken' });
    expect(inserted[0].correct).toBeUndefined();
  });
});

describe('unplayedBankCases', () => {
  it('이미 푼 사례는 다시 내지 않는다', async () => {
    playedRefs = [{ source_ref: CASE_BANK_SEED[0].id }];
    const next = await unplayedBankCases('user-1', 2);
    expect(next.map((c) => c.id)).not.toContain(CASE_BANK_SEED[0].id);
    expect(next).toHaveLength(2);
  });

  it('은행을 못 읽으면 던진다 — "풀 사례가 없었다"와 구분되어야 한다', async () => {
    bankError = { message: 'relation does not exist' };
    await expect(unplayedBankCases('user-1', 2)).rejects.toThrow(/case bank read failed/);
  });

  it('모양이 깨진 행은 건너뛴다 — 손으로 넣은 사례가 채점을 오염시키지 않는다', async () => {
    bankRows = [
      { ...CASE_BANK_SEED[0], options: 'not-an-array' },
      { ...CASE_BANK_SEED[1], options: [{ key: 'a', label: 'A' }] }, // 선택지 1개 = 문제가 아니다
      { ...CASE_BANK_SEED[2], outcome_key: 'nonexistent' }, // 정답이 선택지 밖 = 채점 불가
      { ...CASE_BANK_SEED[3] },
    ];
    const next = await unplayedBankCases('user-1', 5);
    expect(next.map((c) => c.id)).toEqual([CASE_BANK_SEED[3].id]);
  });
});

describe('buildTheaterReport', () => {
  it('채점/허구 절이 분리되고, 허구 절은 채점 불가를 명시한다', () => {
    const report = buildTheaterReport([
      { gradeLabel: 'graded', title: 't1', body: 'b1', correct: true },
      { gradeLabel: 'fiction', title: 't2', body: 'b2' },
    ]);
    expect(report.text).toContain('[채점됨]');
    expect(report.text).toContain('[허구]');
    expect(report.text).toContain('채점할 수 없습니다');
    expect(report.text).toContain('1/1 적중');
  });

  it('표본 미달이면 퍼센트 대신 "아직 모릅니다" — 3건짜리 비율은 소음이다', () => {
    const report = buildTheaterReport([{ gradeLabel: 'graded', title: 't', body: 'b', correct: true }], {
      matchRate: 1,
      matchSample: 2,
      outcomeRate: 0.5,
      outcomeSample: 2,
    });
    expect(report.text).toContain('아직 모릅니다');
    expect(report.text).not.toContain('100%');
  });

  it('표본이 차면 두 숫자를 분리해서 싣고, 채점 대상이 분신임을 밝힌다', () => {
    const report = buildTheaterReport([], {
      matchRate: 0.75,
      matchSample: 4,
      outcomeRate: 0.5,
      outcomeSample: 6,
    });
    expect(report.text).toContain('75% (4건)');
    expect(report.text).toContain('50% (6건)');
    expect(report.text).toContain('당신이 아니라 분신의 예측을 채점한 것');
  });
});
