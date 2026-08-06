import { beforeEach, describe, expect, it, vi } from 'vitest';

// TWIN 그림자 시험 — 봉인 파이프라인의 기계 검증.
//
// 지키는 불변식 넷:
// 1. lean 이 있으면 choice 예측은 오염이다 → deviation 으로 전환 + 플래그
// 2. 봉인 해시가 안 맞는 행은 공개하지 않고, 뺐다고 말한다
// 3. 인용 없는 supported/contradicted 판정은 indeterminate 로 강등
// 4. 생성 실패는 던지지 않는다 (부가 기능이 본 작업을 막으면 안 됨)

interface InsertedRow {
  target: string;
  expectation: string;
  confidence: number;
  contaminated_by_lean: boolean;
  content_hash: string;
  status: string;
}

const inserted: InsertedRow[] = [];
const updates: Array<{ values: Record<string, unknown> }> = [];
let selectRows: Record<string, unknown>[] = [];
let llmResponse: Record<string, unknown> | null = null;
let llmShouldThrow = false;

vi.mock('@/lib/llm-server', () => ({
  callAnthropicJson: vi.fn(async () => {
    if (llmShouldThrow) throw new Error('ANTHROPIC_API_KEY is not set');
    return llmResponse;
  }),
}));

vi.mock('@/lib/share-guard', () => ({
  adminClient: () => ({
    from: (table: string) => ({
      insert: (rows: InsertedRow[]) => {
        if (table === 'argus_shadow_predictions') inserted.push(...rows);
        return Promise.resolve({ error: null });
      },
      select: () => ({
        eq: () => ({
          eq: () => ({
            in: () => Promise.resolve({ data: selectRows, error: null }),
          }),
        }),
        gte: () => ({ is: () => ({ limit: () => Promise.resolve({ data: [], error: null }) }) }),
        in: () => Promise.resolve({ data: [], error: null }),
      }),
      update: (values: Record<string, unknown>) => {
        updates.push({ values });
        const chain = {
          in: () => ({ eq: () => Promise.resolve({ error: null }) }),
          eq: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
        return chain;
      },
    }),
  }),
}));

import { generateAndSealShadow, gradeRevealedShadows, revealShadowsText } from '../shadow';
import { shadowContentHash, type ShadowRow } from '../store';

const OPENING = {
  utterance: '직원을 한 명 더 뽑을지 고민 중',
  statedReasons: ['일이 넘친다'],
  consideredAlternatives: [],
};

function sealedRow(over: Partial<ShadowRow> = {}): ShadowRow {
  const base = {
    target: 'outcome' as const,
    expectation: '3개월 안에 신규 인력이 백로그를 절반으로 줄인다',
    reasoning: '업무량 근거',
    confidence: 0.6,
    modelId: 'anthropic:default-tier',
  };
  return {
    id: 'sp1',
    case_id: 'case-1',
    user_id: 'user-1',
    contaminated_by_lean: false,
    model_id: base.modelId,
    content_hash: shadowContentHash(base),
    sealed_at: '2026-08-06T00:00:00Z',
    status: 'sealed',
    verdict: null,
    ...base,
    ...over,
  };
}

beforeEach(() => {
  inserted.length = 0;
  updates.length = 0;
  selectRows = [];
  llmShouldThrow = false;
  llmResponse = {
    outcome_expectation: '3개월 안에 백로그가 절반이 된다',
    outcome_confidence: 0.6,
    second_expectation: '계약직 채용을 최종 채택한다',
    second_confidence: 0.7,
    reasoning: '업무량이 구조적이라고 판단해 왔음',
  };
});

describe('generateAndSealShadow', () => {
  it('lean 없음 → outcome + choice 두 행, 오염 플래그 없음', async () => {
    await generateAndSealShadow('user-1', 'case-1', OPENING);
    expect(inserted.map((r) => r.target).sort()).toEqual(['choice', 'outcome']);
    expect(inserted.every((r) => r.contaminated_by_lean === false)).toBe(true);
    expect(inserted.every((r) => r.status === 'sealed')).toBe(true);
  });

  it('lean 있음 → choice 대신 deviation, 오염 플래그 참 — 자명한 match 를 만들지 않는다', async () => {
    await generateAndSealShadow('user-1', 'case-1', { ...OPENING, lean: '계약직으로 뽑자' });
    expect(inserted.map((r) => r.target).sort()).toEqual(['deviation', 'outcome']);
    expect(inserted.every((r) => r.contaminated_by_lean === true)).toBe(true);
  });

  it('이미 채택된 케이스면 late 로 봉인 — 늦었다는 사실을 지우지 않는다', async () => {
    await generateAndSealShadow('user-1', 'case-1', OPENING, { alreadyAdopted: true });
    expect(inserted.every((r) => r.status === 'late')).toBe(true);
  });

  it('봉인 해시가 내용에서 결정론적으로 나온다', async () => {
    await generateAndSealShadow('user-1', 'case-1', OPENING);
    for (const r of inserted) {
      expect(r.content_hash).toHaveLength(64);
    }
  });

  it('LLM 이 tool call 을 안 내면 아무것도 봉인하지 않는다 (지어내지 않음)', async () => {
    llmResponse = null;
    await generateAndSealShadow('user-1', 'case-1', OPENING);
    expect(inserted).toHaveLength(0);
  });

  it('키 부재 등 실패 시 던지지 않는다 — 열기를 막으면 안 된다', async () => {
    llmShouldThrow = true;
    await expect(generateAndSealShadow('user-1', 'case-1', OPENING)).resolves.toBeUndefined();
    expect(inserted).toHaveLength(0);
  });
});

describe('revealShadowsText', () => {
  it('무결한 행만 공개하고 revealed 로 옮긴다', async () => {
    selectRows = [sealedRow()];
    const { text, revealed } = await revealShadowsText('user-1', 'case-1');
    expect(revealed).toHaveLength(1);
    expect(text).toContain('봉인 예측');
    expect(text).toContain('결과 예측');
    expect(updates.some((u) => u.values.status === 'revealed')).toBe(true);
  });

  it('해시가 안 맞는 행은 공개하지 않고, 뺐다고 말한다', async () => {
    selectRows = [sealedRow({ expectation: '조작된 문장 — 해시와 불일치' })];
    const { text, revealed } = await revealShadowsText('user-1', 'case-1');
    expect(revealed).toHaveLength(0);
    expect(text).toContain('무결성 검사에 실패');
  });

  it('late 행은 채점 제외를 명시한다', async () => {
    const base = {
      target: 'outcome' as const,
      expectation: '늦게 봉인된 예측',
      reasoning: 'r',
      confidence: 0.5,
      modelId: 'anthropic:default-tier',
    };
    selectRows = [sealedRow({ ...base, status: 'late', content_hash: shadowContentHash(base) })];
    const { text } = await revealShadowsText('user-1', 'case-1');
    expect(text).toContain('채점 제외');
  });

  it('공개할 것이 없으면 빈 문자열 — 없는 것을 있는 척하지 않는다', async () => {
    const { text, revealed } = await revealShadowsText('user-1', 'case-1');
    expect(text).toBe('');
    expect(revealed).toHaveLength(0);
  });
});

describe('gradeRevealedShadows', () => {
  it('인용 없는 supported 는 indeterminate 로 강등된다', async () => {
    llmResponse = { verdict: 'supported', quote: '   ' };
    await gradeRevealedShadows([sealedRow({ status: 'revealed' })], '실제로 백로그가 줄었다');
    expect(updates.some((u) => u.values.verdict === 'indeterminate')).toBe(true);
    expect(updates.some((u) => u.values.verdict === 'supported')).toBe(false);
  });

  it('인용 있는 contradicted 는 그대로 기록된다', async () => {
    llmResponse = { verdict: 'contradicted', quote: '두 달 만에 퇴사했다' };
    await gradeRevealedShadows([sealedRow({ status: 'revealed' })], '두 달 만에 퇴사했다');
    expect(updates.some((u) => u.values.verdict === 'contradicted')).toBe(true);
  });

  it('choice 예측은 채택 기록이 있어야 채점된다 — 없으면 건너뛴다', async () => {
    llmResponse = { verdict: 'supported', quote: '인용' };
    await gradeRevealedShadows([sealedRow({ target: 'choice', status: 'revealed' })], '관찰');
    expect(updates).toHaveLength(0); // adopted 미전달
  });

  it('채택 기록을 넘기면 choice 예측도 채점된다 — match rate 의 모수가 생긴다', async () => {
    llmResponse = { verdict: 'supported', quote: '3개월 계약직' };
    await gradeRevealedShadows([sealedRow({ target: 'choice', status: 'revealed' })], '관찰', {
      choice: '3개월 계약직',
    });
    expect(updates.some((u) => u.values.verdict === 'supported')).toBe(true);
  });

  it('deviation 예측은 기울기와 채택을 함께 대조한다', async () => {
    llmResponse = { verdict: 'contradicted', quote: '정규직으로 갔다' };
    await gradeRevealedShadows([sealedRow({ target: 'deviation', status: 'revealed' })], '관찰', {
      choice: '정규직',
      lean: '계약직',
    });
    expect(updates.some((u) => u.values.verdict === 'contradicted')).toBe(true);
  });

  it('late 봉인은 채점하지 않는다 — 채택을 보고 쓴 예측이다', async () => {
    llmResponse = { verdict: 'supported', quote: '인용' };
    await gradeRevealedShadows([sealedRow({ target: 'outcome', status: 'late' })], '관찰');
    expect(updates).toHaveLength(0);
  });
});
