/**
 * 그림자·프로필 백스톱 크론 — **동작** 테스트.
 *
 * 이 크론은 실패를 **침묵에서 지연으로** 바꾸는 장치다. 본 경로(after())가
 * 죽으면 그 케이스는 분신의 시험지도, 배운 것도 영영 없는데, 화면에는 아무
 * 표시가 나지 않는다. 그래서 여기서 고정하는 것은 "돌았다"가 아니라 **무엇을
 * 건드렸고 무엇을 건드리지 않았는가**이다.
 *
 *  1. 관문이 닫혀 있거나 생성 키가 없으면 **성공한 척하지 않는다** — 그리고
 *     그 상태에서는 아무 케이스도 건드리지 않는다.
 *  2. 한 건이 실패해도 나머지는 계속된다. 백스톱이 첫 실패에서 멈추면 그 뒤의
 *     케이스는 영영 재시도되지 않는다.
 *  3. 원문이 없는 케이스는 건너뛴다 — 없는 원문으로 시험지를 지어내지 않는다.
 *  4. 이미 채택이 끝난 뒤 봉인하는 경우 그 사실을 함께 넘긴다(late).
 *  5. 0건이어도 실행 이벤트를 남긴다. 남기지 않으면 "돌았는데 할 일이 없었다"와
 *     "아예 안 돌았다"가 구분되지 않는다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface SealCall { userId: string; caseId: string; facts: Record<string, unknown>; opts: { alreadyAdopted: boolean } }

let MISSING: Array<{ id: string; user_id: string }> = [];
let PENDING: Array<{ userId: string; facts: { caseId: string; observation: string } }> = [];
let ENGINES: Record<string, { utterance?: string; card?: unknown; baseline?: unknown; beliefs?: unknown[] }> = {};
let SEAL_THROWS: Record<string, string> = {};
let EXTRACT_THROWS: Record<string, string> = {};
let seals: SealCall[] = [];
let extracts: string[] = [];
let graded: string[] = [];
let events: Array<{ name: string; payload: Record<string, unknown> }> = [];

vi.mock('@/lib/twin/store', () => ({ recentCasesMissingShadows: async () => MISSING }));
vi.mock('@/lib/twin/shadow', () => ({
  generateAndSealShadow: async (userId: string, caseId: string, facts: Record<string, unknown>, opts: { alreadyAdopted: boolean }) => {
    if (SEAL_THROWS[caseId]) throw new Error(SEAL_THROWS[caseId]);
    seals.push({ userId, caseId, facts, opts });
  },
}));
vi.mock('@/lib/twin/profile', () => ({
  settledCasesMissingProfile: async () => PENDING,
  extractProfileFromSettlement: async (_userId: string, facts: { caseId: string }) => {
    if (EXTRACT_THROWS[facts.caseId]) throw new Error(EXTRACT_THROWS[facts.caseId]);
    extracts.push(facts.caseId);
    return { inserted: 1, reinforced: 0, contradicted: 0 };
  },
}));
vi.mock('@/lib/twin/beliefs', () => ({
  gradeStatedBeliefs: async (_userId: string, caseId: string) => { graded.push(caseId); },
}));
vi.mock('@/app/api/mcp/v2/store', () => ({
  loadEngine: async (_userId: string, caseId: string) => {
    const e = ENGINES[caseId] ?? {};
    return {
      state: () => ({
        baseline: e.baseline ?? 'not_captured',
        card: e.card ?? (e.beliefs ? { rationale: { materialBeliefs: e.beliefs } } : undefined),
      }),
      ledger: { forCase: () => (e.utterance ? [{ type: 'user_utterance', text: e.utterance }] : []) },
    };
  },
}));
vi.mock('@/lib/server-events', () => ({
  persistServerEvent: async (name: string, payload: Record<string, unknown>) => { events.push({ name, payload }); },
}));

const { GET } = await import('../route');

const request = (auth = 'Bearer secret-1') =>
  ({ headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? auth : null) } }) as never;

beforeEach(() => {
  process.env.CRON_SECRET = 'secret-1';
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  MISSING = [];
  PENDING = [];
  ENGINES = {};
  SEAL_THROWS = {};
  EXTRACT_THROWS = {};
  seals = [];
  extracts = [];
  graded = [];
  events = [];
});

describe('GET /api/cron/argus-shadow', () => {
  it('비밀이 없으면 열리지 않고 아무 케이스도 건드리지 않는다', async () => {
    delete process.env.CRON_SECRET;
    MISSING = [{ id: 'c1', user_id: 'u1' }];
    ENGINES.c1 = { utterance: '이 계약을 받을까' };
    expect((await GET(request('Bearer undefined'))).status).toBe(401);
    expect((await GET(request('Bearer wrong-and-longer'))).status).toBe(401);
    expect(seals).toHaveLength(0);
  });

  it('생성 키가 없으면 503 — 전부 실패할 것을 성공으로 보고하지 않는다', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    MISSING = [{ id: 'c1', user_id: 'u1' }];
    ENGINES.c1 = { utterance: '이 계약을 받을까' };
    const res = await GET(request());
    expect(res.status).toBe(503);
    expect(seals, '키가 없는데 생성이 돌았습니다').toHaveLength(0);
    // 0건 성공으로 적히면 다음 날 "그림자가 왜 없지"의 원인이 사라진다.
    expect(events).toHaveLength(0);
  });

  it('원문 없는 케이스는 건너뛴다 — 없는 말로 시험지를 지어내지 않는다', async () => {
    MISSING = [{ id: 'c1', user_id: 'u1' }, { id: 'c2', user_id: 'u1' }];
    ENGINES.c1 = {}; // 원문 없음
    ENGINES.c2 = { utterance: '이 계약을 받을까' };
    const body = await (await GET(request())).json();
    expect(seals.map((s) => s.caseId)).toEqual(['c2']);
    expect(body.scanned).toBe(2);
    expect(body.generated).toBe(1);
    // 건너뛴 것은 실패가 아니다 — 재시도할 것이 없다.
    expect(body.failed).toBe(0);
  });

  it('한 건이 실패해도 나머지는 계속된다', async () => {
    MISSING = [{ id: 'c1', user_id: 'u1' }, { id: 'c2', user_id: 'u2' }, { id: 'c3', user_id: 'u3' }];
    for (const id of ['c1', 'c2', 'c3']) ENGINES[id] = { utterance: `원문 ${id}` };
    SEAL_THROWS.c2 = 'model refused';
    const body = await (await GET(request())).json();
    // 첫 실패에서 멈추면 c3 은 영영 재시도되지 않는다.
    expect(seals.map((s) => s.caseId)).toEqual(['c1', 'c3']);
    expect(body.generated).toBe(2);
    expect(body.failed).toBe(1);
  });

  it('이미 채택이 끝난 케이스는 늦은 봉인이라는 사실을 함께 넘긴다', async () => {
    MISSING = [{ id: 'early', user_id: 'u1' }, { id: 'late', user_id: 'u1' }];
    ENGINES.early = { utterance: '아직 안 정했다' };
    ENGINES.late = { utterance: '이미 정했다', card: { choiceOrPolicy: 'A' } };
    await GET(request());
    expect(seals.find((s) => s.caseId === 'early')!.opts.alreadyAdopted).toBe(false);
    // 이 값이 뒤집히면 늦게 봉인된 예측이 정상 채점에 섞여 성적이 부풀려진다.
    expect(seals.find((s) => s.caseId === 'late')!.opts.alreadyAdopted).toBe(true);
  });

  it('그림자가 실패해도 프로필 백스톱은 돈다 — 두 구멍은 따로다', async () => {
    MISSING = [{ id: 'c1', user_id: 'u1' }];
    ENGINES.c1 = { utterance: '원문' };
    SEAL_THROWS.c1 = 'boom';
    PENDING = [{ userId: 'u1', facts: { caseId: 'settled-1', observation: '실제로는 줄었다' } }];
    ENGINES['settled-1'] = { beliefs: [{ belief: '가격 민감도가 높다', confidence: 'confident' }] };

    const body = await (await GET(request())).json();
    expect(extracts).toEqual(['settled-1']);
    expect(graded, '사전등록 믿음이 채점되지 않았습니다').toEqual(['settled-1']);
    expect(body.profileExtracted).toBe(1);
    expect(body.failed).toBe(1);
  });

  it('사전등록 믿음이 없으면 채점을 부르지 않는다', async () => {
    PENDING = [{ userId: 'u1', facts: { caseId: 'settled-2', observation: '무슨 일' } }];
    ENGINES['settled-2'] = {};
    await GET(request());
    expect(extracts).toEqual(['settled-2']);
    expect(graded, '채점할 문장이 없는데 채점을 불렀습니다').toEqual([]);
  });

  it('할 일이 0건이어도 실행 이벤트를 남긴다', async () => {
    const body = await (await GET(request())).json();
    expect(body).toEqual({ scanned: 0, generated: 0, profileScanned: 0, profileExtracted: 0, failed: 0 });
    // 이 이벤트가 없으면 "돌았는데 할 일이 없었다"와 "아예 안 돌았다"가 같아 보인다.
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('argus_shadow_cron_run');
    expect(events[0].payload.scanned).toBe(0);
  });
});
