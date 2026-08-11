/**
 * OAuth 승인 → 인가 코드 발급 — **라우트 동작** 테스트.
 *
 * 이 라우트만이 코드를 만든다. 그래서 이 파일이 지키는 것은 하나로 모인다:
 * **코드는 언제나 실재하는 사람의 로그인 세션에서만 나오고, 오직 등록된
 * 주소로만 간다.**
 *
 * 가장 중요한 케이스는 `redirect_uri` 재검사다. 동의 화면의 URL 은 사용자가
 * 주소창에서 고칠 수 있으므로, authorize 단계의 검사를 방어로 믿으면 그 URL
 * 한 글자를 바꾸는 것만으로 인가 코드가 **등록되지 않은 곳으로 배달된다.**
 * 라우트 주석은 "여기서 다시 한다"고 적어 두었는데, 주석이 맞는 것과 코드가
 * 그렇게 판단하는 것은 다른 사실이므로 실행으로 고정한다.
 *
 * 부수 효과까지 본다 — 거절될 때 **grant 가 만들어지지 않는 것**. 400 을
 * 돌려주면서 행은 남기면, 그 코드는 응답에 실리지 않았을 뿐 유효하다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, randomBytes } from 'crypto';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const CHALLENGE = createHash('sha256').update(randomBytes(40).toString('base64url')).digest('base64url');

let GRANTS: Array<Record<string, unknown>> = [];
let CLIENT: { client_id: string; client_name: string; redirect_uris: string[] } | null = null;
let CLIENT_LOOKUP_FAILS = false;
let GRANT_INSERT_FAILS = false;
let USER: { id: string } | null = { id: 'user-1' };

vi.mock('@/lib/share-guard', () => ({
  adminClient: () => ({
    from: (table: string) => {
      if (table === 'argus_oauth_clients') {
        const q: Record<string, unknown> = {
          select: () => q,
          eq: () => q,
          async maybeSingle() {
            if (CLIENT_LOOKUP_FAILS) return { data: null, error: { message: 'boom' } };
            return { data: CLIENT, error: null };
          },
        };
        return q;
      }
      return {
        async insert(row: Record<string, unknown>) {
          if (GRANT_INSERT_FAILS) return { error: { message: 'insert failed' } };
          GRANTS.push(row);
          return { error: null };
        },
      };
    },
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: USER }, error: USER ? null : { message: 'bad token' } }),
    },
  }),
}));

const { POST } = await import('../approve/route');

function request(over: { body?: unknown; auth?: string | null; contentType?: string } = {}) {
  const headers: Record<string, string | null> = {
    'content-type': over.contentType ?? 'application/json',
    authorization: over.auth === undefined ? 'Bearer session-token' : over.auth,
  };
  return {
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: async () => {
      if (over.body === '__throw__') throw new Error('bad json');
      return over.body === undefined
        ? { client_id: 'client-1', redirect_uri: REDIRECT, code_challenge: CHALLENGE, state: 'st-1' }
        : over.body;
    },
  } as never;
}

beforeEach(() => {
  GRANTS = [];
  CLIENT = { client_id: 'client-1', client_name: 'Claude', redirect_uris: [REDIRECT] };
  CLIENT_LOOKUP_FAILS = false;
  GRANT_INSERT_FAILS = false;
  USER = { id: 'user-1' };
});

describe('POST /api/mcp/v2/oauth/approve', () => {
  it('승인이 성사되면 코드는 해시로만 저장되고 평문은 리다이렉트에만 실린다', async () => {
    const res = await POST(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    const url = new URL(body.redirect_url);
    expect(url.origin + url.pathname).toBe(REDIRECT);
    const code = url.searchParams.get('code')!;
    expect(code).toMatch(/^argus_code_/);
    expect(url.searchParams.get('state')).toBe('st-1');
    expect(res.headers.get('cache-control')).toBe('no-store');

    expect(GRANTS).toHaveLength(1);
    expect(GRANTS[0].code_hash).toBe(sha256(code));
    // 평문 코드가 행에 남으면 DB 를 읽을 수 있는 쪽이 그대로 교환할 수 있다.
    expect(JSON.stringify(GRANTS[0])).not.toContain(code);
    expect(GRANTS[0].user_id).toBe('user-1');
    expect(GRANTS[0].code_challenge).toBe(CHALLENGE);
    expect(GRANTS[0].redirect_uri).toBe(REDIRECT);
    // 만료는 10분. 무기한 코드는 탈취되면 영원히 유효하다.
    const ttlMs = Date.parse(String(GRANTS[0].expires_at)) - Date.now();
    expect(ttlMs).toBeGreaterThan(9 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(10 * 60 * 1000 + 5000);
  });

  it('등록되지 않은 redirect_uri 로는 코드를 만들지 않는다 (앞 화면 검사를 믿지 않는다)', async () => {
    const res = await POST(
      request({ body: { client_id: 'client-1', redirect_uri: 'https://evil.example/steal', code_challenge: CHALLENGE } }),
    );
    expect(res.status).toBe(400);
    // 400 을 주면서 행을 남기면 그 코드는 응답에 안 실렸을 뿐 유효하다.
    expect(GRANTS, '거절했는데 인가 코드가 만들어졌습니다').toHaveLength(0);
  });

  it('등록된 주소의 하위 경로도 거절한다 — 접두사 일치가 아니라 정확 일치다', async () => {
    const res = await POST(
      request({ body: { client_id: 'client-1', redirect_uri: `${REDIRECT}/../evil`, code_challenge: CHALLENGE } }),
    );
    expect(res.status).toBe(400);
    expect(GRANTS).toHaveLength(0);
  });

  it('로그인 세션이 없으면 코드가 나오지 않는다', async () => {
    const res = await POST(request({ auth: null }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('login_required');
    expect(GRANTS).toHaveLength(0);
  });

  it('토큰이 유효하지 않으면 코드가 나오지 않는다 (Bearer 가 있다는 사실만으로 통과하지 않는다)', async () => {
    USER = null;
    const res = await POST(request());
    expect(res.status).toBe(401);
    expect(GRANTS).toHaveLength(0);
  });

  it('PKCE 챌린지가 없거나 형식이 아니면 거절한다', async () => {
    for (const bad of [undefined, '', 'short', 123]) {
      GRANTS = [];
      const res = await POST(
        request({ body: { client_id: 'client-1', redirect_uri: REDIRECT, code_challenge: bad } }),
      );
      expect(res.status, `code_challenge=${String(bad)}`).toBe(400);
      expect(GRANTS).toHaveLength(0);
    }
  });

  it('없는 클라이언트로는 코드를 만들지 않는다', async () => {
    CLIENT = null;
    const res = await POST(request());
    expect(res.status).toBe(400);
    expect(GRANTS).toHaveLength(0);
  });

  it('클라이언트 조회 장애는 400 이 아니라 503 이다', async () => {
    CLIENT_LOOKUP_FAILS = true;
    const res = await POST(request());
    // 400 으로 돌려주면 사용자는 "잘못 눌렀나" 하며 같은 실패를 반복한다 —
    // 원인은 자기 쪽이 아닌데.
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('temporarily_unavailable');
  });

  it('코드 저장이 실패하면 리다이렉트를 주지 않는다', async () => {
    GRANT_INSERT_FAILS = true;
    const res = await POST(request());
    expect(res.status).toBe(503);
    // redirect_url 을 주면서 저장은 실패하면, 커넥터가 존재하지 않는 코드를
    // 들고 교환하러 가서 invalid_grant 를 받는다 — 원인은 훨씬 앞에 있는데.
    expect((await res.json()).redirect_url).toBeUndefined();
  });

  it('JSON 이 아닌 본문·깨진 JSON·배열·null 을 전부 거절한다', async () => {
    expect((await POST(request({ contentType: 'text/plain' }))).status).toBe(415);
    expect((await POST(request({ body: '__throw__' }))).status).toBe(400);
    expect((await POST(request({ body: [] }))).status).toBe(400);
    expect((await POST(request({ body: null }))).status).toBe(400);
    expect(GRANTS).toHaveLength(0);
  });

  it('state 가 없으면 붙이지 않는다 (빈 state 를 지어내지 않는다)', async () => {
    const res = await POST(
      request({ body: { client_id: 'client-1', redirect_uri: REDIRECT, code_challenge: CHALLENGE } }),
    );
    const url = new URL((await res.json()).redirect_url);
    expect(url.searchParams.has('state')).toBe(false);
  });
});
