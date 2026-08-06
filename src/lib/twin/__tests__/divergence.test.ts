import { beforeEach, describe, expect, it, vi } from 'vitest';

// TWIN 자기 이탈 감지 — 침묵이 기본값임을 기계로 강제한다.
//
// 이 감지기의 실패 형태는 "안 울리는 것"이 아니라 **"아무 데서나 울리는 것"**
// 이다 (과발화 = 거울 조항 위반). 그래서 테스트의 대부분이 침묵 경로다.

const llmCalls: number[] = [];
let llmResponse: Record<string, unknown> | null = null;
let profileRows: Array<{ domain: string; content: string; evidence_case_ids: string[] }> = [];

vi.mock('@/lib/llm-server', () => ({
  callAnthropicJson: vi.fn(async () => {
    llmCalls.push(1);
    return llmResponse;
  }),
}));

vi.mock('@/lib/share-guard', () => ({
  adminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ data: profileRows, error: null }),
          }),
        }),
      }),
    }),
  }),
}));

import { DIVERGENCE_MIN_EVIDENCE, divergenceCrux, qualifiedPatterns } from '../divergence';

const FIVE_IDS = ['c1', 'c2', 'c3', 'c4', 'c5'];

beforeEach(() => {
  llmCalls.length = 0;
  llmResponse = { conflicting_index: 0 };
  profileRows = [
    { domain: '채용', content: '현금이 빠듯할 때 고정비 증가를 기각해 왔다', evidence_case_ids: FIVE_IDS },
  ];
});

describe('결정론 관문', () => {
  it(`같은 도메인 증거 ${DIVERGENCE_MIN_EVIDENCE}건 미만이면 LLM 을 부르지도 않는다`, async () => {
    profileRows = [{ domain: '채용', content: '패턴', evidence_case_ids: ['c1', 'c2'] }];
    const text = await divergenceCrux('user-1', '정규직을 뽑을까', '뽑자');
    expect(text).toBe('');
    expect(llmCalls).toHaveLength(0);
  });

  it('여러 항목의 증거는 도메인 단위로 합산된다', async () => {
    profileRows = [
      { domain: '채용', content: '패턴 A', evidence_case_ids: ['c1', 'c2', 'c3'] },
      { domain: '채용', content: '패턴 B', evidence_case_ids: ['c3', 'c4', 'c5'] },
    ];
    const q = await qualifiedPatterns('user-1');
    expect(q).toHaveLength(2); // 고유 증거 5개(c1..c5) → 임계 통과
  });

  it('기울기가 없으면 침묵 — 이탈할 대상이 없다', async () => {
    const text = await divergenceCrux('user-1', '뽑을까 말까', undefined);
    expect(text).toBe('');
    expect(llmCalls).toHaveLength(0);
  });
});

describe('LLM 은 인덱스만 고른다', () => {
  it('충돌 인덱스가 오면 결정론 템플릿 질문이 나온다 — 근거 케이스 id 포함', async () => {
    const text = await divergenceCrux('user-1', '정규직을 뽑을까', '이번엔 정규직으로 가자');
    expect(text).toContain('지난 채용 정산 5건');
    expect(text).toContain('현금이 빠듯할 때 고정비 증가를 기각해 왔다');
    expect(text).toContain('c1');
    expect(text).toContain('새로 알게 된 것이 있어서인가요');
    // 방향 문장이 아니다 — 어느 쪽이 낫다는 말이 없다.
    expect(text).not.toMatch(/낫|추천|해야 합니다/);
  });

  it('-1(충돌 없음)이면 침묵', async () => {
    llmResponse = { conflicting_index: -1 };
    expect(await divergenceCrux('user-1', '뽑을까', '뽑자')).toBe('');
  });

  it('범위 밖 인덱스면 침묵 — LLM 이 지어낸 패턴은 존재하지 않는 패턴이다', async () => {
    llmResponse = { conflicting_index: 7 };
    expect(await divergenceCrux('user-1', '뽑을까', '뽑자')).toBe('');
  });

  it('LLM 실패 시 침묵하고 던지지 않는다 — 열기를 막으면 안 된다', async () => {
    llmResponse = null;
    await expect(divergenceCrux('user-1', '뽑을까', '뽑자')).resolves.toBe('');
  });
});
