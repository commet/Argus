/**
 * 분신 상태 계기판 — **동작** 테스트.
 *
 * `export-seal.test.ts` 가 이 라우트의 소스를 스캔한다. 그것으로 부족한 이유는
 * home 라우트와 같다: 스캔은 코드의 모양을 보고 동작은 못 본다.
 *
 * 특히 `engine` 필드가 그렇다. 스캔은 소스에 `Boolean(` 이 있는지를 **텍스트로**
 * 확인할 뿐이고, 실제로 나가는 JSON 이 `true`/`false` 인지 — 혹은 키 값이
 * 그대로 실렸는지 — 는 아무도 본 적이 없었다. 이 필드는 비밀을 다루므로
 * "그렇게 짰다"와 "그렇게 나간다"의 차이가 여기서는 특히 크다.
 *
 * 두 번째 관심사는 **0 과 null 의 구분**이다. 마이그레이션이 안 붙은 표는
 * 0 이 아니라 null 로 나가야 하고, 그래야 화면이 "아직 없음"과 "못 읽음"을
 * 다르게 말할 수 있다. 이것도 스캔으로는 확인할 수 없다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

let USER: { id: string } | null = { id: 'u1' };
/** 오류를 내야 하는 테이블 이름들 (마이그레이션 미적용 재현). */
let BROKEN = new Set<string>();
/** 테이블별 count. 안 적으면 0. */
let COUNTS: Record<string, number> = {};
/** 각 집계가 user_id 필터를 실제로 걸었는지 기록한다. */
let sawUserFilter: boolean[] = [];

function makeQuery(table: string): Record<string, unknown> {
  let scoped = false;
  const q: Record<string, unknown> = {
    select: () => q,
    eq(col: string) {
      if (col === 'user_id') scoped = true;
      return q;
    },
    in: () => q,
    is: () => q,
    not: () => q,
    then(resolve: (v: { count: number | null; error: unknown }) => unknown) {
      sawUserFilter.push(scoped);
      if (BROKEN.has(table)) {
        return Promise.resolve({ count: null, error: { message: 'relation does not exist' } }).then(resolve);
      }
      return Promise.resolve({ count: COUNTS[table] ?? 0, error: null }).then(resolve);
    },
  };
  return q;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (t: string) => makeQuery(t),
    auth: {
      getUser: async () => ({ data: { user: USER }, error: USER ? null : { message: 'bad token' } }),
    },
  }),
}));

const { GET } = await import('../route');

function request(auth = 'Bearer token-1') {
  return { headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? auth : null) } } as never;
}

const SECRET = 'sk-ant-super-secret-value';

beforeEach(() => {
  USER = { id: 'u1' };
  BROKEN = new Set();
  COUNTS = {};
  sawUserFilter = [];
  process.env.ANTHROPIC_API_KEY = SECRET;
  process.env.RESEND_API_KEY = 'resend-secret';
  process.env.CRON_SECRET = 'cron-secret';
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.RESEND_API_KEY;
  delete process.env.CRON_SECRET;
});

describe('GET /api/twin/status', () => {
  it('토큰이 없으면 401', async () => {
    expect((await GET(request(''))).status).toBe(401);
  });

  it('토큰이 유효하지 않으면 401', async () => {
    USER = null;
    expect((await GET(request()))?.status).toBe(401);
  });

  it('설정 값이 아니라 불리언이 나간다 — 실제 JSON 으로 확인한다', async () => {
    const res = await GET(request());
    const body = await res.json();
    expect(body.engine).toEqual({ anthropic: true, resend: true, cronSecret: true });
    // 응답 어디에도 값 자체가 없어야 한다. 소스에 `Boolean(` 이 있다는 사실과
    // 응답에 비밀이 없다는 사실은 다른 주장이고, 여기서는 후자를 검사한다.
    const raw = JSON.stringify(body);
    expect(raw).not.toContain(SECRET);
    expect(raw).not.toContain('resend-secret');
    expect(raw).not.toContain('cron-secret');
    // 접두사 몇 글자도 새면 안 된다.
    expect(raw).not.toContain('sk-ant');
  });

  it('키가 없으면 false 로 나간다 (빠지거나 undefined 가 아니다)', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const body = await (await GET(request())).json();
    // 키가 아예 빠지면 클라이언트의 `!status.engine.anthropic` 이 "미설정"과
    // "구버전 서버"를 구분하지 못한다. false 로 **말해야** 한다.
    expect(body.engine.anthropic).toBe(false);
    expect('anthropic' in body.engine).toBe(true);
  });

  it('빈 문자열도 미설정으로 본다 (환경변수를 지우지 않고 비우는 경우)', async () => {
    process.env.ANTHROPIC_API_KEY = '';
    const body = await (await GET(request())).json();
    expect(body.engine.anthropic).toBe(false);
  });

  it('표를 못 읽으면 0 이 아니라 null 이다', async () => {
    BROKEN = new Set(['argus_belief_checks', 'argus_simulation_runs']);
    const body = await (await GET(request())).json();
    expect(body.beliefs.graded).toBeNull();
    expect(body.theater.runs).toBeNull();
    // 다른 표는 멀쩡하므로 0 이어야 한다 — null 이 전염되면 안 된다.
    expect(body.shadows.sealed).toBe(0);
  });

  it('실제로 0 인 것과 못 읽은 것이 다르게 나온다', async () => {
    COUNTS = { argus_shadow_predictions: 3 };
    const body = await (await GET(request())).json();
    expect(body.shadows.sealed).toBe(3);
    expect(body.profile.active).toBe(0);
    expect(body.profile.active).not.toBeNull();
  });

  it('모든 집계가 user_id 로 좁혀진다 — 한 건이라도 빠지면 남의 수를 센다', async () => {
    await GET(request());
    expect(sawUserFilter.length).toBeGreaterThan(8);
    expect(sawUserFilter.every(Boolean), '소유 필터 없이 센 집계가 있습니다').toBe(true);
  });
});
