/**
 * 분신의 집 라우트 — **동작** 테스트.
 *
 * 이미 `export-seal.test.ts` 가 이 라우트의 소스를 스캔해 "본문 컬럼을 select
 * 하지 않는다"를 지킨다. 그것으로 부족한 이유가 이 파일의 존재 이유다:
 * 소스 스캔은 코드의 **모양**을 보지만 **동작**은 못 본다.
 *
 * 스캔이 통과하는데 봉인이 깨지는 경우가 실제로 있다. 예를 들어 봉인 쿼리의
 * status 필터가 `['sealed','late']` 가 아니라 다른 값이 되면 — select 목록은
 * 그대로이므로 스캔은 초록인데 — 정산된 행이 "봉인" 자리에 들어가거나, 반대로
 * 잠긴 것이 하나도 안 보인다. 어느 쪽이든 화면은 **그럴듯하게** 틀린다.
 *
 * 그래서 여기서는 Supabase 를 메모리로 갈아 끼우고 라우트를 실제로 호출해,
 * 나가는 JSON 을 직접 본다. 검사 대상은 세 가지다:
 *   1. 봉인 행에 본문이 실려 나가지 않는가 (경계)
 *   2. 상태별로 올바른 바구니에 담기는가 (분류)
 *   3. 읽지 못한 것과 없는 것이 구분되는가 (정직한 공백)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

interface Row {
  case_id: string;
  target: string;
  status: string;
  sealed_at?: string;
  revealed_at?: string;
  expectation?: string;
  reasoning?: string;
  confidence?: number;
  verdict?: string | null;
  verdict_quote?: string | null;
  was_late?: boolean;
}

let ROWS: Row[] = [];
let USER: { id: string } | null = { id: 'u1' };
/** 이 테이블 조회가 오류를 내야 하는가 (마이그레이션 미적용 재현). */
let TABLE_ERROR = false;

/**
 * 최소 Supabase 흉내. **select 목록을 실제로 지킨다** — 라우트가 요청한 컬럼만
 * 돌려준다. 이것이 이 목의 핵심이다: 라우트가 `expectation` 을 안 골랐다면
 * 결과에도 없어야 하고, 그 사실을 테스트가 눈으로 확인할 수 있어야 한다.
 */
function makeQuery(): Record<string, unknown> {
  let columns: string[] = [];
  const filters: Array<(r: Row) => boolean> = [];

  const q: Record<string, unknown> = {
    select(cols: string) {
      columns = cols.split(',').map((c) => c.trim());
      return q;
    },
    eq(col: string, val: unknown) {
      if (col === 'user_id') return q; // 소유 필터는 목 밖의 관심사
      filters.push((r) => (r as unknown as Record<string, unknown>)[col] === val);
      return q;
    },
    in(col: string, vals: unknown[]) {
      filters.push((r) => vals.includes((r as unknown as Record<string, unknown>)[col]));
      return q;
    },
    order() {
      return q;
    },
    limit() {
      return q;
    },
    then(resolve: (v: { data: unknown; error: unknown }) => unknown) {
      if (TABLE_ERROR) return Promise.resolve({ data: null, error: { message: 'relation does not exist' } }).then(resolve);
      const rows = ROWS.filter((r) => filters.every((f) => f(r))).map((r) => {
        const out: Record<string, unknown> = {};
        for (const c of columns) out[c] = (r as unknown as Record<string, unknown>)[c];
        return out;
      });
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    },
  };
  return q;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => makeQuery(),
    auth: {
      getUser: async () => ({ data: { user: USER }, error: USER ? null : { message: 'bad token' } }),
    },
  }),
}));

vi.mock('@/lib/twin/store', () => ({
  twinScore: async () => ({ matchRate: null, matchSample: 0, outcomeRate: null, outcomeSample: 0 }),
}));

const { GET } = await import('../route');

function request(auth = 'Bearer token-1') {
  return { headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? auth : null) } } as never;
}

beforeEach(() => {
  ROWS = [];
  USER = { id: 'u1' };
  TABLE_ERROR = false;
});

describe('GET /api/twin/home', () => {
  it('토큰이 없으면 401 — 아무 데이터도 만지지 않는다', async () => {
    const res = await GET(request(''));
    expect(res.status).toBe(401);
  });

  it('토큰이 유효하지 않으면 401', async () => {
    USER = null;
    const res = await GET(request());
    expect(res.status).toBe(401);
  });

  it('봉인 행에 예측 본문이 실려 나가지 않는다', async () => {
    ROWS = [
      {
        case_id: 'c1',
        target: 'outcome',
        status: 'sealed',
        sealed_at: '2026-08-01T00:00:00Z',
        // 이 행에는 본문이 실제로 들어 있다 — 라우트가 고르지 **않아야** 한다.
        expectation: '이탈이 늘 것이다',
        reasoning: '가격 민감도가 높다',
      },
    ];
    const body = await (await GET(request())).json();
    expect(body.sealed).toHaveLength(1);
    const keys = Object.keys(body.sealed[0]);
    expect(keys).not.toContain('expectation');
    expect(keys).not.toContain('reasoning');
    // 응답 전체를 문자열로 봐도 본문이 없어야 한다 (중첩 어딘가로 새는 것 방지).
    expect(JSON.stringify(body)).not.toContain('이탈이 늘 것이다');
    expect(JSON.stringify(body)).not.toContain('가격 민감도');
  });

  it('늦은 봉인도 봉인 바구니에 담긴다 — 숨기면 "왜 성적에 없나"를 설명할 수 없다', async () => {
    ROWS = [
      { case_id: 'c1', target: 'outcome', status: 'sealed', sealed_at: '2026-08-01T00:00:00Z' },
      { case_id: 'c2', target: 'choice', status: 'late', sealed_at: '2026-08-02T00:00:00Z' },
    ];
    const body = await (await GET(request())).json();
    expect(body.sealed.map((s: { status: string }) => s.status).sort()).toEqual(['late', 'sealed']);
  });

  it('정산된 행은 봉인이 아니라 공개 바구니에 담기고, 그때는 전문이 나온다', async () => {
    ROWS = [
      {
        case_id: 'c1',
        target: 'outcome',
        status: 'revealed',
        revealed_at: '2026-08-05T00:00:00Z',
        expectation: '이탈이 늘 것이다',
        confidence: 0.7,
        verdict: 'contradicted',
        verdict_quote: '이탈은 그대로였다',
      },
    ];
    const body = await (await GET(request())).json();
    // 분류: 봉인 자리에 들어가면 화면이 "잠겨 있다"고 거짓말한다.
    expect(body.sealed).toEqual([]);
    expect(body.revealed).toHaveLength(1);
    // 봉인의 목적은 이 순간 달성되므로 전문이 나오는 것이 맞다.
    expect(body.revealed[0].expectation).toBe('이탈이 늘 것이다');
    expect(body.revealed[0].verdict).toBe('contradicted');
  });

  it('표를 읽지 못하면 빈 배열이 아니라 null 이다 — "없음"과 구분된다', async () => {
    TABLE_ERROR = true;
    const body = await (await GET(request())).json();
    expect(body.sealed).toBeNull();
    expect(body.revealed).toBeNull();
    // 조용한 0 은 이 제품에서 가장 나쁜 실패다. 빈 배열로 위장하면 화면은
    // "아직 아무것도 없습니다"라고 말하고, 사용자는 영영 원인을 못 찾는다.
    expect(body.sealed).not.toEqual([]);
  });

  it('아무것도 없으면 빈 배열이다 — 못 읽은 것과 다른 사실', async () => {
    const body = await (await GET(request())).json();
    expect(body.sealed).toEqual([]);
    expect(body.revealed).toEqual([]);
  });

  it('성적을 함께 돌려준다 (화면이 한 번의 왕복으로 그린다)', async () => {
    const body = await (await GET(request())).json();
    expect(body.score).toEqual({ matchRate: null, matchSample: 0, outcomeRate: null, outcomeSample: 0 });
  });
});
