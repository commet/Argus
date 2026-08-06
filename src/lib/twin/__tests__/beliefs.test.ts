import { beforeEach, describe, expect, it, vi } from 'vitest';

// TWIN M5 보정 거울 — 사용자가 **자기 손으로** 적어 둔 확신도의 채점.
//
// 이 파일은 사람을 채점하는 데 가장 가까이 가는 표면이므로 규율이 가장 빡빡하다:
//
// 1. 확신 등급이 없는 믿음은 채점하지 않는다 (등급을 추측해 붙이면 사용자가
//    하지 않은 사전등록을 우리가 대신 한 것이 된다)
// 2. 판정 개수가 안 맞으면 **통째로 버린다** — 순서로 짝짓는 구조에서 길이
//    불일치는 조용히 어긋난 짝을 만든다
// 3. 인용 없는 판정은 indeterminate 로 강등되고 모수에서 빠진다
// 4. 등급별 표본이 임계 미달이면 숫자를 보여주지 않는다
// 5. 문장의 주어는 사람이 아니라 **문장들**이다 (zero-judgment)

const inserted: Array<Record<string, unknown>> = [];
let llmResponse: Record<string, unknown> | null = null;
let checkRows: Array<Record<string, unknown>> = [];

vi.mock('@/lib/llm-server', () => ({
  callAnthropicJson: vi.fn(async () => llmResponse),
}));

function query(result: () => { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const k of ['eq', 'in', 'order', 'limit', 'gte', 'is', 'not']) chain[k] = () => chain;
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(result()).then(res, rej);
  return chain;
}

vi.mock('@/lib/share-guard', () => ({
  adminClient: () => ({
    from: () => ({
      insert: (rows: Array<Record<string, unknown>>) => {
        inserted.push(...rows);
        return Promise.resolve({ error: null });
      },
      select: () => query(() => ({ data: checkRows, error: null })),
    }),
  }),
}));

import {
  beliefCalibration,
  calibrationLines,
  gradeStatedBeliefs,
  CALIBRATION_MIN_SAMPLE,
  type StatedBelief,
} from '../beliefs';

const BELIEFS: StatedBelief[] = [
  { belief: '수요는 3개월 안에 회복된다', confidence: 'confident' },
  { belief: '경쟁사가 가격을 내리지 않는다', confidence: 'contested' },
];

beforeEach(() => {
  inserted.length = 0;
  checkRows = [];
  llmResponse = {
    verdicts: [
      { verdict: 'supported', quote: '수요가 두 달 만에 돌아왔다' },
      { verdict: 'contradicted', quote: '경쟁사가 20% 내렸다' },
    ],
  };
});

describe('gradeStatedBeliefs', () => {
  it('사용자가 적은 등급과 판정을 함께 저장한다', async () => {
    const n = await gradeStatedBeliefs('user-1', 'case-1', BELIEFS, '수요가 두 달 만에 돌아왔다. 경쟁사가 20% 내렸다.');
    expect(n).toBe(2);
    expect(inserted[0]).toMatchObject({ stated_confidence: 'confident', verdict: 'supported' });
    expect(inserted[1]).toMatchObject({ stated_confidence: 'contested', verdict: 'contradicted' });
  });

  it('확신 등급이 없는 믿음은 채점하지 않는다 — 등급을 대신 정하지 않는다', async () => {
    const n = await gradeStatedBeliefs('user-1', 'case-1', [{ belief: '등급 없음' }], '관찰');
    expect(n).toBe(0);
    expect(inserted).toHaveLength(0);
  });

  it('판정 개수가 안 맞으면 통째로 버린다 — 어긋난 짝은 조용한 오답이다', async () => {
    llmResponse = { verdicts: [{ verdict: 'supported', quote: '인용' }] }; // 믿음은 2건
    const n = await gradeStatedBeliefs('user-1', 'case-1', BELIEFS, '관찰');
    expect(n).toBe(0);
    expect(inserted).toHaveLength(0);
  });

  it('인용 없는 supported 는 indeterminate 로 강등된다', async () => {
    llmResponse = {
      verdicts: [
        { verdict: 'supported', quote: '   ' },
        { verdict: 'supported', quote: '인용 있음' },
      ],
    };
    await gradeStatedBeliefs('user-1', 'case-1', BELIEFS, '관찰');
    expect(inserted[0].verdict).toBe('indeterminate');
    expect(inserted[1].verdict).toBe('supported');
  });

  it('LLM 이 답을 못 내면 아무것도 저장하지 않는다', async () => {
    llmResponse = null;
    expect(await gradeStatedBeliefs('user-1', 'case-1', BELIEFS, '관찰')).toBe(0);
  });

  it('확신 등급을 프롬프트에 넣지 않는다 — 등급을 알면 판정이 그쪽으로 끌린다', async () => {
    const { callAnthropicJson } = await import('@/lib/llm-server');
    await gradeStatedBeliefs('user-1', 'case-1', BELIEFS, '관찰');
    const call = (callAnthropicJson as unknown as { mock: { calls: Array<[{ user: string }]> } }).mock.calls.at(-1)!;
    expect(call[0].user).not.toContain('confident');
    expect(call[0].user).not.toContain('contested');
  });
});

describe('beliefCalibration', () => {
  it('indeterminate 는 모수에서 빠진다 (조회가 애초에 거른다)', async () => {
    checkRows = [
      { stated_confidence: 'confident', verdict: 'supported' },
      { stated_confidence: 'confident', verdict: 'contradicted' },
      { stated_confidence: 'uncertain', verdict: 'supported' },
    ];
    const buckets = await beliefCalibration('user-1');
    expect(buckets.find((b) => b.stated === 'confident')).toMatchObject({ sample: 2, supported: 1 });
    expect(buckets.find((b) => b.stated === 'uncertain')).toMatchObject({ sample: 1, supported: 1 });
    expect(buckets.find((b) => b.stated === 'contested')).toMatchObject({ sample: 0, supported: 0 });
  });
});

describe('calibrationLines', () => {
  const full = (stated: 'confident' | 'uncertain' | 'contested', supported: number) => ({
    stated,
    sample: CALIBRATION_MIN_SAMPLE,
    supported,
  });

  it('표본이 임계 미달이면 아무것도 말하지 않는다 — 없는 성적을 있는 척하지 않는다', () => {
    expect(calibrationLines([{ stated: 'confident', sample: CALIBRATION_MIN_SAMPLE - 1, supported: 3 }])).toBe('');
  });

  it('표본이 차면 등급별 적중률을 내고, 채점 대상이 문장임을 밝힌다', () => {
    const t = calibrationLines([full('confident', 4)]);
    expect(t).toContain(`${CALIBRATION_MIN_SAMPLE}건 중 4건`);
    expect(t).toContain('당신에 대한 평가가 아니라');
  });

  it('확률을 지어내지 않는다 — 세 등급에 소수점 확신도를 붙이지 않는다', () => {
    const t = calibrationLines([full('confident', 4), full('uncertain', 2)]);
    expect(t).not.toMatch(/0\.\d/);
    expect(t).not.toContain('Brier');
  });

  it('임계를 넘은 등급만 실린다 — 미달 등급은 조용히 빠지지 않고 아예 없다', () => {
    const t = calibrationLines([full('confident', 5), { stated: 'contested', sample: 1, supported: 0 }]);
    expect(t).toContain('확신한다');
    expect(t).not.toContain('다툼이 있다');
  });
});
