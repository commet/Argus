/**
 * OAuth 인가 요청 — **라우트 동작** 테스트.
 *
 * 이 라우트의 핵심 판단은 "무엇을 검사하는가"가 아니라 **"오류를 어디로
 * 돌려주는가"**다. RFC 6749 §4.1.2.1 은 `redirect_uri` 가 등록된 것으로
 * 확인되기 **전에는** 그 주소로 리다이렉트하지 말라고 규정한다. 어기면 이
 * 엔드포인트 자체가 **열린 리다이렉터**가 된다 — 공격자가 아무 주소나
 * `redirect_uri` 에 넣고 `argus.voyage/api/mcp/v2/oauth/authorize?...` 링크를
 * 뿌리면, 사용자는 우리 도메인을 보고 눌렀는데 임의의 사이트에 떨어진다.
 *
 * 그래서 이 파일이 세는 것은 응답의 **종류**다: 확인 전 오류는 사람이 읽는
 * 평문이어야 하고, 확인 후 오류만 사양대로 리다이렉트여야 한다. 이것은 소스를
 * 훑어서는 확신하기 어렵다 — 검사 순서가 바뀌면 조용히 뒤집히기 때문이다.
 *
 * 또 하나: **이 라우트는 코드를 만들지 않는다.** 발급은 사람이 동의 화면에서
 * 승인할 때 approve 가 한다. 승인 없이 발급하면 그것은 사용자의 행위가 아니다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, randomBytes } from 'crypto';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';

const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
const CHALLENGE = createHash('sha256').update(randomBytes(40).toString('base64url')).digest('base64url');

let CLIENT: { client_id: string; client_name: string; redirect_uris: string[] } | null = null;
let LOOKUP_FAILS = false;
/** 이 라우트가 어떤 테이블에든 쓰기를 시도하면 잡아낸다. */
let writes = 0;

vi.mock('@/lib/share-guard', () => ({
  adminClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {
        select: () => q,
        eq: () => q,
        insert: () => {
          writes += 1;
          return Promise.resolve({ error: null });
        },
        async maybeSingle() {
          if (LOOKUP_FAILS) return { data: null, error: { message: 'boom' } };
          return { data: CLIENT, error: null };
        },
      };
      return q;
    },
  }),
}));

const { GET } = await import('../authorize/route');

function request(params: Record<string, string> = {}) {
  const u = new URL('https://argus.voyage/api/mcp/v2/oauth/authorize');
  const all: Record<string, string> = {
    client_id: 'client-1',
    redirect_uri: REDIRECT,
    response_type: 'code',
    code_challenge_method: 'S256',
    code_challenge: CHALLENGE,
    state: 'st-1',
    ...params,
  };
  for (const [k, v] of Object.entries(all)) if (v !== '') u.searchParams.set(k, v);
  return { url: u.toString() } as never;
}

/** 리다이렉트 응답인가, 사람이 읽는 평문인가. */
function kind(res: Response): 'redirect' | 'plain' {
  return res.headers.get('location') ? 'redirect' : 'plain';
}

beforeEach(() => {
  CLIENT = { client_id: 'client-1', client_name: 'Claude', redirect_uris: [REDIRECT] };
  LOOKUP_FAILS = false;
  writes = 0;
});

describe('GET /api/mcp/v2/oauth/authorize', () => {
  it('정상 요청은 동의 화면으로 보내고, 코드는 만들지 않는다', async () => {
    const res = await GET(request());
    expect(kind(res)).toBe('redirect');
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toContain('/connect/mcp');
    // 동의 화면이 다시 검증할 수 있도록 파라미터가 그대로 실린다.
    expect(loc.searchParams.get('client_id')).toBe('client-1');
    expect(loc.searchParams.get('redirect_uri')).toBe(REDIRECT);
    expect(loc.searchParams.get('code_challenge')).toBe(CHALLENGE);
    expect(loc.searchParams.get('state')).toBe('st-1');
    // 사람이 "무엇을 승인하는지" 알 수 있도록 이름을 넘긴다.
    expect(loc.searchParams.get('client_name')).toBe('Claude');
    // 승인 없이 발급하면 그것은 사용자의 행위가 아니다.
    expect(writes, '인가 단계에서 무언가가 저장됐습니다').toBe(0);
  });

  // ── 열린 리다이렉터 금지 (이 파일의 존재 이유) ─────────────────────────
  it('등록되지 않은 redirect_uri 로는 **리다이렉트하지 않는다**', async () => {
    const res = await GET(request({ redirect_uri: 'https://evil.example/steal' }));
    expect(kind(res), '미등록 주소로 리다이렉트했습니다 — 열린 리다이렉터입니다').toBe('plain');
    expect(res.status).toBe(400);
    expect(res.headers.get('location')).toBeNull();
  });

  it('없는 client_id 에도 리다이렉트하지 않는다 (클라이언트를 모르면 주소도 믿을 수 없다)', async () => {
    CLIENT = null;
    const res = await GET(request({ redirect_uri: 'https://evil.example/steal' }));
    expect(kind(res)).toBe('plain');
    expect(res.status).toBe(400);
  });

  it('client_id·redirect_uri 가 없으면 평문으로 끝낸다', async () => {
    for (const missing of ['client_id', 'redirect_uri']) {
      const res = await GET(request({ [missing]: '' }));
      expect(kind(res), missing).toBe('plain');
      expect(res.status).toBe(400);
    }
  });

  it('조회 장애는 빈 500 이 아니라 사람이 읽는 503 이다', async () => {
    LOOKUP_FAILS = true;
    const res = await GET(request());
    expect(res.status).toBe(503);
    expect(kind(res)).toBe('plain');
    const body = await res.text();
    // 커넥터 설정 화면에서 이 문장이 그대로 보인다 — 빈 화면이면 사용자는
    // "설정 실패"만 보고 무엇이 틀렸는지 영영 모른다.
    expect(body.length).toBeGreaterThan(20);
    expect(body).toContain('다시 시도');
  });

  // ── 주소가 확인된 뒤에는 사양대로 리다이렉트로 돌려준다 ────────────────
  it('response_type 이 code 가 아니면 등록된 주소로 오류를 돌려준다', async () => {
    const res = await GET(request({ response_type: 'token' }));
    expect(kind(res)).toBe('redirect');
    const loc = new URL(res.headers.get('location')!);
    expect(loc.origin + loc.pathname).toBe(REDIRECT);
    expect(loc.searchParams.get('error')).toBe('unsupported_response_type');
    expect(loc.searchParams.get('state')).toBe('st-1');
  });

  it('PKCE 가 S256 이 아니거나 챌린지가 없으면 오류를 돌려준다', async () => {
    for (const bad of [{ code_challenge_method: 'plain' }, { code_challenge: '' }, { code_challenge: 'short' }]) {
      const res = await GET(request(bad));
      expect(kind(res), JSON.stringify(bad)).toBe('redirect');
      const loc = new URL(res.headers.get('location')!);
      expect(loc.origin + loc.pathname).toBe(REDIRECT);
      expect(loc.searchParams.get('error')).toBe('invalid_request');
    }
  });

  it('state 가 없으면 동의 화면에도 붙이지 않는다 (빈 state 를 지어내지 않는다)', async () => {
    const res = await GET(request({ state: '' }));
    const loc = new URL(res.headers.get('location')!);
    expect(loc.searchParams.has('state')).toBe(false);
  });

  it('어떤 실패 경로에서도 코드가 만들어지지 않는다', async () => {
    await GET(request({ redirect_uri: 'https://evil.example/steal' }));
    await GET(request({ response_type: 'token' }));
    await GET(request({ code_challenge: '' }));
    CLIENT = null;
    await GET(request());
    expect(writes).toBe(0);
  });
});
