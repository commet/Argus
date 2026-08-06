import { beforeEach, describe, expect, it, vi } from 'vitest';

// TWIN 판단 프로필 — 추출 검증의 기계 확인.
//
// 프로필이 지키는 불변식:
// 1. 증거 케이스가 실제로 정산돼 있지 않으면 항목 전체를 버린다 (fail-closed)
// 2. 정체성 판정 언어는 프로필이 될 수 없다 (zero-judgment)
// 3. LLM 이 빈 배열을 내면 0건 — 없음이 정직한 답이다

const inserted: Array<Record<string, unknown>> = [];
let llmResponse: Record<string, unknown> | null = null;
let settledRow: { id: string; settled_at: string } | null = { id: 'case-1', settled_at: '2026-08-06T00:00:00Z' };
let profileRows: Array<Record<string, unknown>> = [];

vi.mock('@/lib/llm-server', () => ({
  callAnthropicJson: vi.fn(async () => llmResponse),
}));

vi.mock('@/lib/share-guard', () => ({
  adminClient: () => ({
    from: (table: string) => ({
      insert: (rows: Array<Record<string, unknown>>) => {
        if (table === 'argus_profile_items') inserted.push(...rows);
        return Promise.resolve({ error: null });
      },
      select: () => ({
        eq: () => ({
          eq: () => ({
            not: () => ({ maybeSingle: () => Promise.resolve({ data: settledRow, error: null }) }),
            order: () => ({ limit: () => Promise.resolve({ data: profileRows, error: null }) }),
          }),
        }),
      }),
    }),
  }),
}));

import { extractProfileFromSettlement, profileLines, violatesJudgmentLanguage } from '../profile';

const FACTS = {
  caseId: 'case-1',
  question: '직원을 뽑을 것인가',
  choice: '3개월 계약직',
  statedReasons: ['일이 넘친다'],
  observation: '두 달 만에 퇴사했다',
  recall: '리스크를 줄이려 했다',
};

beforeEach(() => {
  inserted.length = 0;
  profileRows = [];
  settledRow = { id: 'case-1', settled_at: '2026-08-06T00:00:00Z' };
  llmResponse = {
    items: [
      { layer: 'L1', domain: '채용', content: '이 결정에서 가역성을 비용보다 무겁게 쳤다', confidence: 0.6 },
    ],
  };
});

describe('extractProfileFromSettlement', () => {
  it('정상 항목은 증거 케이스 id 와 함께 저장된다', async () => {
    const n = await extractProfileFromSettlement('user-1', FACTS);
    expect(n).toBe(1);
    expect(inserted[0]).toMatchObject({
      layer: 'L1',
      evidence_case_ids: ['case-1'],
      provenance: 'ai_extracted',
    });
  });

  it('증거 케이스가 정산돼 있지 않으면 전부 버린다 (fail-closed)', async () => {
    settledRow = null;
    const n = await extractProfileFromSettlement('user-1', FACTS);
    expect(n).toBe(0);
    expect(inserted).toHaveLength(0);
  });

  it('판정 언어 항목은 버려진다 — 프로필은 사람에 대한 진단이 아니다', async () => {
    llmResponse = {
      items: [
        { layer: 'L1', domain: '채용', content: '당신은 리스크 회피 성향이 강한 사람이다', confidence: 0.8 },
        { layer: 'L3', domain: '채용', content: '현금이 빠듯할 때 정규직 대신 계약직을 골랐다', confidence: 0.6 },
      ],
    };
    const n = await extractProfileFromSettlement('user-1', FACTS);
    expect(n).toBe(1);
    expect(inserted).toHaveLength(1);
    expect(String(inserted[0].content)).toContain('계약직');
  });

  it('LLM 이 빈 배열을 내면 0건 — 없음이 정직한 답', async () => {
    llmResponse = { items: [] };
    expect(await extractProfileFromSettlement('user-1', FACTS)).toBe(0);
  });

  it('LLM 실패 시 던지지 않는다 — 정산 응답을 막으면 안 된다', async () => {
    llmResponse = null;
    await expect(extractProfileFromSettlement('user-1', FACTS)).resolves.toBe(0);
  });

  it('스키마 밖 항목(잘못된 layer·범위 밖 confidence)은 파싱에서 걸러진다', async () => {
    llmResponse = {
      items: [
        { layer: 'L9', domain: '채용', content: '유효하지 않은 층', confidence: 0.5 },
        { layer: 'L2', domain: '채용', content: '가정 적중 관찰', confidence: 1.5 },
      ],
    };
    expect(await extractProfileFromSettlement('user-1', FACTS)).toBe(0);
  });
});

describe('violatesJudgmentLanguage', () => {
  it.each([
    '당신은 신중한 타입이다',
    '결정 점수 85점',
    '위험 회피 성향이 강하다',
  ])('판정 언어를 잡는다: %s', (s) => {
    expect(violatesJudgmentLanguage(s)).toBe(true);
  });

  it('관찰 문장은 통과한다', () => {
    expect(violatesJudgmentLanguage('이 결정에서 가역성을 비용보다 무겁게 쳤다')).toBe(false);
  });
});

describe('profileLines', () => {
  it('활성 항목을 근거 케이스 id 와 함께 돌려준다', async () => {
    profileRows = [
      { layer: 'L1', domain: '채용', content: '가역성 우선', evidence_case_ids: ['case-1'], confidence: 0.6 },
    ];
    const lines = await profileLines('user-1');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('[L1·채용]');
    expect(lines[0]).toContain('case-1');
  });

  it('항목이 없으면 빈 배열', async () => {
    expect(await profileLines('user-1')).toEqual([]);
  });
});
