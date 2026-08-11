/**
 * 계정 내보내기 — **동작** 테스트.
 *
 * `export-seal.test.ts` 는 이 라우트의 **소스**를 스캔해 redaction 함수가
 * 존재하는지 본다. 그것으로는 부족하다: 함수가 파일에 있다는 사실과, 나가는
 * JSON 에 봉인 본문이 없다는 사실은 다른 주장이다.
 *
 * 이 라우트는 소유권과 봉인이 **충돌하는 유일한 자리**다. 사용자는 자기
 * 데이터를 전부 반출할 권리가 있는데, 분신의 미정산 예측은 정산 전에 보이면
 * 안 된다 — 자기 시험지를 미리 보면 봉인 자체가 무의미해진다. RLS 로 막아 둔
 * 문을 service role 이 여는 자리이므로, 여기서 새면 **사용자가 버튼 하나로
 * 자기 봉인을 깬다.**
 *
 * 그래서 이 파일은 응답 본문을 직렬화해 **본문 문자열이 실제로 없는지**를 본다.
 * 필드 이름을 지웠는지가 아니라, 그 값이 어디에도 안 나오는지를.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { USER_DATA_TABLES } from '@/lib/user-data-tables';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

const USER_ID = 'user-1';
const SEALED_TEXT = '이탈이 20% 늘 것이다';
const SEALED_REASONING = '가격 민감도가 높다고 봤다';
const REVEALED_TEXT = '재구매가 줄 것이다';

let USER: { id: string; email?: string; created_at?: string } | null = { id: USER_ID };
let ROWS: Record<string, unknown[]> = {};
let BROKEN = new Set<string>();
/** 각 조회가 소유 필터를 걸었는지. */
let scopes: Array<{ table: string; scopedTo: string | null }> = [];

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: USER }, error: USER ? null : { message: 'bad token' } }),
    },
    from(table: string) {
      let scoped: string | null = null;
      const q: Record<string, unknown> = {
        select: () => q,
        eq(col: string, val: unknown) {
          if (col === 'user_id') scoped = String(val);
          scopes.push({ table, scopedTo: scoped });
          return Promise.resolve(
            BROKEN.has(table)
              ? { data: null, error: { message: `no such table: ${table}` } }
              : { data: ROWS[table] ?? [], error: null },
          );
        },
      };
      return q;
    },
  }),
}));

const { GET } = await import('../export/route');

const request = (auth: string | null = 'Bearer token-1', qs = '') =>
  ({
    url: `https://argus.voyage/api/account/export${qs}`,
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? auth : null) },
  }) as never;

beforeEach(() => {
  USER = { id: USER_ID, email: 'a@b.c', created_at: '2026-01-01T00:00:00Z' };
  ROWS = {};
  BROKEN = new Set();
  scopes = [];
});

describe('GET /api/account/export', () => {
  it('로그인 없이는 아무것도 읽지 않는다', async () => {
    expect((await GET(request(null))).status).toBe(401);
    USER = null;
    expect((await GET(request())).status).toBe(401);
    expect(scopes).toHaveLength(0);
  });

  it('미정산 봉인 예측의 **본문이 응답 어디에도 없다**', async () => {
    ROWS['argus_shadow_predictions'] = [
      {
        id: 's1',
        case_id: 'c1',
        revealed_at: null,
        content_hash: 'abc123',
        expectation: SEALED_TEXT,
        reasoning: SEALED_REASONING,
        verdict_quote: null,
      },
    ];
    const res = await GET(request());
    const raw = await res.text();

    // 필드를 지웠는지가 아니라 **값이 없는지**를 본다. 중첩 어딘가로 새는
    // 경우까지 잡히는 것은 이 형태뿐이다.
    expect(raw).not.toContain(SEALED_TEXT);
    expect(raw).not.toContain(SEALED_REASONING);

    const body = JSON.parse(raw);
    const row = body.tables['argus_shadow_predictions'][0];
    // 소유권은 잃지 않는다 — 존재·해시·메타는 그대로 간다.
    expect(row.content_hash).toBe('abc123');
    expect(row.case_id).toBe('c1');
    expect(row._redacted).toBe('sealed_until_settlement');
    // 왜 가려졌는지 사람이 읽을 수 있어야 한다. 조용히 빠지면 사용자는
    // 데이터가 유실됐다고 믿는다.
    expect(String(row._note)).toContain('정산');
  });

  it('정산된 예측은 전문 그대로 반출한다 — 봉인의 목적은 그때 달성된다', async () => {
    ROWS['argus_shadow_predictions'] = [
      { id: 's2', revealed_at: '2026-08-05T00:00:00Z', expectation: REVEALED_TEXT, reasoning: 'r', verdict_quote: 'q' },
    ];
    const raw = await (await GET(request())).text();
    expect(raw).toContain(REVEALED_TEXT);
    const row = JSON.parse(raw).tables['argus_shadow_predictions'][0];
    expect(row._redacted).toBeUndefined();
    expect(row.verdict_quote).toBe('q');
  });

  it('같은 응답에 봉인과 개봉이 섞여도 각각 다르게 다룬다', async () => {
    ROWS['argus_shadow_predictions'] = [
      { id: 's1', revealed_at: null, expectation: SEALED_TEXT },
      { id: 's2', revealed_at: '2026-08-05T00:00:00Z', expectation: REVEALED_TEXT },
    ];
    const raw = await (await GET(request())).text();
    expect(raw).not.toContain(SEALED_TEXT);
    expect(raw).toContain(REVEALED_TEXT);
  });

  it('등재된 모든 테이블을 읽고, 전부 본인 것으로 좁힌다', async () => {
    await GET(request());
    const read = new Set(scopes.map((s) => s.table));
    const missed = USER_DATA_TABLES.filter((t) => !read.has(t));
    expect(missed, `내보내기에서 빠진 테이블입니다:\n${missed.join('\n')}`).toEqual([]);

    const unscoped = scopes.filter((s) => s.scopedTo !== USER_ID).map((s) => s.table);
    // 소유 필터가 빠지면 남의 행이 내 내보내기 파일에 들어간다.
    expect(unscoped, `소유 필터 없이 읽은 테이블입니다:\n${unscoped.join('\n')}`).toEqual([]);
  });

  it('읽지 못한 테이블은 빈 배열이 아니라 오류로 적는다', async () => {
    BROKEN = new Set([USER_DATA_TABLES[1]]);
    const body = JSON.parse(await (await GET(request())).text());
    // 빈 배열로 적으면 사용자는 "그 표에는 원래 아무것도 없었다"로 읽는다.
    expect(body.tables[USER_DATA_TABLES[1]].error).toBeTruthy();
    expect(Array.isArray(body.tables[USER_DATA_TABLES[1]])).toBe(false);
    // 한 표가 깨져도 나머지는 계속 반출된다.
    expect(Array.isArray(body.tables[USER_DATA_TABLES[0]])).toBe(true);
  });

  it('첨부 파일로 내려주고 계정 정보를 함께 적는다', async () => {
    const res = await GET(request());
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    const body = JSON.parse(await res.text());
    expect(body.user.id).toBe(USER_ID);
    expect(body.exported_at).toBeTruthy();
  });
});
