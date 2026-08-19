/**
 * 만료 청소 크론 — **동작** 테스트.
 *
 * 이 라우트는 service role 로 **지운다.** 세 표를 훑고, 그중 둘은 하드 삭제다.
 * 여기서 필터 하나가 빠지면 살아 있는 토큰이 전부 사라지고, 그 사고는 조용히
 * 성공(200)으로 보고된다 — 다음 날 사용자들이 "연결이 끊겼다"고 말할 때까지
 * 아무도 모른다.
 *
 * 고정하는 것:
 *
 *  1. **관문은 fail-closed.** CRON_SECRET 이 없으면 `Bearer undefined` 로도
 *     열리지 않는다. 길이가 다른 문자열이 와도 **던지지 않고** 401 이다
 *     (`timingSafeEqual` 은 길이가 다르면 예외를 던진다 — 그래서 앞의 길이
 *     검사가 장식이 아니다).
 *  2. **만료된 것만 지운다.** `expires_at` 이 NULL 인 옛 토큰은 `.lt` 에
 *     걸리지 않아 살아남는다. 필터가 빠지거나 넓어지면 이 파일이 빨간불이 된다.
 *  3. **부분 실패를 성공 숫자로 덮지 않는다.** 한 표의 청소가 실패하면 그
 *     개수는 0 으로 남고 나머지 작업은 계속된다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';

type Op = [string, unknown?, unknown?];
interface Query { table: string; ops: Op[] }

let queries: Query[] = [];
let RESULT: (q: Query) => { data: unknown[] | null; error: { message: string } | null } =
  () => ({ data: [], error: null });

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from(table: string) {
      const record: Query = { table, ops: [] };
      queries.push(record);
      const q: Record<string, unknown> = {
        then(resolve: (v: unknown) => unknown) {
          return Promise.resolve(RESULT(record)).then(resolve);
        },
      };
      for (const name of ['update', 'delete', 'select', 'eq', 'lt', 'limit']) {
        q[name] = (...args: unknown[]) => {
          record.ops.push([name, ...args] as Op);
          return q;
        };
      }
      return q;
    },
  }),
}));

const { GET } = await import('../route');

const request = (auth: string | null = 'Bearer secret-1') =>
  ({ headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? auth : null) } }) as never;

/** 그 표에 걸린 연산들 (여러 번 조회되면 첫 번째). */
const on = (table: string) => queries.find((q) => q.table === table);

beforeEach(() => {
  queries = [];
  RESULT = () => ({ data: [], error: null });
  process.env.CRON_SECRET = 'secret-1';
});

describe('GET /api/cron/expire-tokens', () => {
  it('비밀이 없으면 아무도 못 들어온다 — `Bearer undefined` 도', async () => {
    delete process.env.CRON_SECRET;
    expect((await GET(request('Bearer undefined'))).status).toBe(401);
    expect((await GET(request(null))).status).toBe(401);
    // 관문이 열리기 전에는 service role 이 표를 만지지 않는다.
    expect(queries, '인증 전에 삭제 질의가 나갔습니다').toHaveLength(0);
  });

  it('길이가 다른 헤더에도 던지지 않고 401 이다', async () => {
    // timingSafeEqual 은 길이가 다르면 예외를 던진다. 앞의 길이 검사가 사라지면
    // 이 요청은 401 이 아니라 500 이 되고, 관문이 오류처럼 보인다.
    for (const bad of ['', 'Bearer', 'Bearer wrong-and-much-longer-than-the-real-one', 'x']) {
      expect((await GET(request(bad))).status).toBe(401);
    }
    expect(queries).toHaveLength(0);
  });

  it('맞는 비밀이면 세 표를 훑고 결과 수를 보고한다', async () => {
    RESULT = (q) => {
      if (q.table === 'human_agent_messages' && q.ops.some(([op]) => op === 'update')) {
        return { data: [{ session_id: 's1', worker_id: 'w1' }, { session_id: 's1' }], error: null };
      }
      if (q.table === 'plugin_tokens') return { data: [{ id: 't1' }, { id: 't2' }], error: null };
      if (q.table === 'argus_oauth_grants') return { data: [{ id: 'g1' }], error: null };
      return { data: [], error: null };
    };
    const body = await (await GET(request())).json();
    expect(body).toEqual({
      ok: true,
      expired: 2,
      sessions: 1, // 같은 세션 둘은 한 번만 손본다
      plugin_tokens_expired: 2,
      oauth_grants_swept: 1,
    });
  });

  it('만료된 것만 지운다 — NULL 만료(옛 비만료 토큰)는 걸리지 않는다', async () => {
    await GET(request());
    for (const table of ['plugin_tokens', 'argus_oauth_grants']) {
      const q = on(table)!;
      expect(q, `${table} 를 훑지 않았습니다`).toBeTruthy();
      expect(q.ops.some(([op]) => op === 'delete'), `${table} 삭제가 없습니다`).toBe(true);
      const bound = q.ops.find(([op, col]) => op === 'lt' && col === 'expires_at');
      // 이 줄이 사라지면(또는 lte/gte 로 바뀌면) 살아 있는 자격증명이 전부 지워진다.
      expect(bound, `${table} 삭제에 expires_at 상한이 없습니다`).toBeTruthy();
      expect(String(bound![2])).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('메시지 만료는 보낸 것 중 기한이 지난 것만 건드린다', async () => {
    await GET(request());
    const q = on('human_agent_messages')!;
    expect(q.ops).toContainEqual(['update', { status: 'expired' }]);
    expect(q.ops).toContainEqual(['eq', 'status', 'sent']);
    expect(q.ops.some(([op, col]) => op === 'lt' && col === 'expires_at')).toBe(true);
  });

  it('한 표의 청소가 실패해도 나머지는 계속되고, 실패한 개수는 0으로 남는다', async () => {
    RESULT = (q) => {
      if (q.table === 'plugin_tokens') return { data: null, error: { message: 'permission denied' } };
      if (q.table === 'argus_oauth_grants') return { data: [{ id: 'g1' }], error: null };
      return { data: [], error: null };
    };
    const res = await GET(request());
    const body = await res.json();
    expect(res.status).toBe(200);
    // 지우지 못한 것을 지운 것처럼 세지 않는다. (실패한 delete 는 행을 돌려주지
    // 않으므로 이 0 은 에러 분기를 지우는 변이로는 흔들리지 않는다 — 실제로
    // 시험해 확인했다. 이 줄이 지키는 것은 "실패가 숫자를 만들어 내지 않는다"는
    // 결과이지, 에러 분기의 존재가 아니다.)
    expect(body.plugin_tokens_expired).toBe(0);
    // 앞의 실패가 뒤의 청소를 막지 않는다 — 이 줄은 변이로 실제로 빨간불이 된다.
    expect(body.oauth_grants_swept).toBe(1);
  });

  it('메시지 만료 자체가 실패하면 500 이다 — 조용히 ok 를 주지 않는다', async () => {
    RESULT = (q) =>
      (q.table === 'human_agent_messages'
        ? { data: null, error: { message: 'table missing' } }
        : { data: [], error: null });
    const res = await GET(request());
    expect(res.status).toBe(500);
    // 내부 사정은 흘리지 않는다.
    expect(JSON.stringify(await res.json())).not.toContain('table missing');
  });
});
