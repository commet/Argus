/**
 * OAuth 동적 클라이언트 등록 — **라우트 동작** 테스트.
 *
 * 이 라우트는 **인증 없이 열려 있다.** 사양이 그렇게 정의한다(등록 시점에는
 * 아직 아무 자격증명도 없다). 그래서 이 파일이 지키는 것은 "누가 부르는가"가
 * 아니라 **"인증 없이 열린 표면이 무엇을 못 하게 되어 있는가"**다:
 *
 *  1. **멱등** — 커넥터는 재연결할 때마다 등록한다. 매번 새 행을 만들면 인증
 *     없이 열린 표면에 행이 무한히 쌓인다. 같은 (이름, 콜백)이면 같은 client_id.
 *  2. **redirect_uri 는 하나라도 못 믿으면 등록 자체를 거부** — 조용히 걸러
 *     등록하면 클라이언트는 등록됐다고 믿고 그 URI 로 흐름을 시작한다.
 *  3. **공개 클라이언트만** — 비밀을 발급하지 않으므로 훔칠 비밀이 없다.
 *
 * 1번은 소스를 읽어서는 확신할 수 없다. 지문 계산이 한 글자만 달라져도
 * 멱등성이 조용히 깨지고, 그때 증상은 "느리게 늘어나는 행"뿐이라 아무도
 * 눈치채지 못한다. 그래서 같은 본문을 두 번 보내 client_id 를 대조한다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';

const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';

interface ClientRow {
  client_id: string;
  client_name: string;
  redirect_uris: string[];
  fingerprint: string;
  token_endpoint_auth_method: string;
}

let CLIENTS: ClientRow[] = [];
let READ_FAILS = false;
let INSERT_FAILS = false;

vi.mock('@/lib/share-guard', () => ({
  adminClient: () => ({
    from: () => {
      let fp: string | null = null;
      const q: Record<string, unknown> = {
        select: () => q,
        eq(_col: string, val: unknown) {
          fp = String(val);
          return q;
        },
        async maybeSingle() {
          if (READ_FAILS) return { data: null, error: { message: 'boom' } };
          const hit = CLIENTS.find((c) => c.fingerprint === fp);
          return { data: hit ? { client_id: hit.client_id } : null, error: null };
        },
        async insert(row: ClientRow) {
          if (INSERT_FAILS) return { error: { message: 'insert failed' } };
          CLIENTS.push(row);
          return { error: null };
        },
      };
      return q;
    },
  }),
}));

const { POST } = await import('../register/route');

function request(body: unknown) {
  return {
    async json() {
      if (body === '__throw__') throw new Error('bad json');
      return body;
    },
  } as never;
}

const VALID = { client_name: 'Claude', redirect_uris: [REDIRECT] };

beforeEach(() => {
  CLIENTS = [];
  READ_FAILS = false;
  INSERT_FAILS = false;
});

describe('POST /api/mcp/v2/oauth/register', () => {
  it('정상 등록은 201 과 공개 클라이언트 메타데이터를 돌려준다', async () => {
    const res = await POST(request(VALID));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.client_id).toMatch(/^argus_client_/);
    expect(body.token_endpoint_auth_method).toBe('none');
    expect(body.grant_types).toEqual(['authorization_code']);
    expect(body.response_types).toEqual(['code']);
    expect(body.redirect_uris).toEqual([REDIRECT]);
    // 비밀을 발급하지 않는다 — 발급하면 공개 클라이언트에서 훔칠 것이 생긴다.
    expect(body.client_secret).toBeUndefined();
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(CLIENTS).toHaveLength(1);
  });

  it('같은 (이름, 콜백)으로 다시 등록하면 같은 client_id 를 준다 — 행이 쌓이지 않는다', async () => {
    const first = await (await POST(request(VALID))).json();
    const second = await (await POST(request(VALID))).json();
    const third = await (await POST(request({ ...VALID, redirect_uris: [REDIRECT] }))).json();

    expect(second.client_id).toBe(first.client_id);
    expect(third.client_id).toBe(first.client_id);
    // 인증 없이 열린 표면이다. 멱등성이 깨지면 증상은 "느리게 늘어나는 행"뿐이라
    // 아무도 눈치채지 못한 채 계속 쌓인다.
    expect(CLIENTS, '재등록마다 행이 새로 생겼습니다').toHaveLength(1);
  });

  it('이름이나 콜백이 다르면 다른 클라이언트다', async () => {
    const a = await (await POST(request(VALID))).json();
    const b = await (await POST(request({ ...VALID, client_name: 'ChatGPT' }))).json();
    const c = await (await POST(request({ ...VALID, redirect_uris: ['https://chatgpt.com/cb'] }))).json();

    expect(new Set([a.client_id, b.client_id, c.client_id]).size).toBe(3);
    expect(CLIENTS).toHaveLength(3);
  });

  it('평문 http 콜백은 등록 자체를 거부한다 (걸러서 등록하지 않는다)', async () => {
    const res = await POST(request({ ...VALID, redirect_uris: ['http://evil.example/cb'] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_redirect_uri');
    expect(CLIENTS).toHaveLength(0);
  });

  it('하나라도 못 믿을 콜백이 섞이면 통째로 거부한다', async () => {
    const res = await POST(request({ ...VALID, redirect_uris: [REDIRECT, 'javascript:alert(1)'] }));
    expect(res.status).toBe(400);
    // 조용히 걸러 등록하면 클라이언트는 등록됐다고 믿고 그 URI 로 흐름을 시작한다.
    expect(CLIENTS, '못 믿을 URI 를 버리고 등록했습니다').toHaveLength(0);
  });

  it('loopback http 는 허용한다 (로컬 CLI 의 정상 경로)', async () => {
    const res = await POST(request({ ...VALID, redirect_uris: ['http://127.0.0.1:8976/cb'] }));
    expect(res.status).toBe(201);
  });

  it('콜백이 없거나 너무 많으면 거부한다', async () => {
    expect((await POST(request({ ...VALID, redirect_uris: [] }))).status).toBe(400);
    expect((await POST(request({ client_name: 'X' }))).status).toBe(400);
    const many = Array.from({ length: 6 }, (_, i) => `https://claude.ai/cb${i}`);
    expect((await POST(request({ ...VALID, redirect_uris: many }))).status).toBe(400);
    expect(CLIENTS).toHaveLength(0);
  });

  it('비밀을 쓰겠다는 클라이언트는 거부한다 — 공개 클라이언트만 지원한다', async () => {
    const res = await POST(request({ ...VALID, token_endpoint_auth_method: 'client_secret_post' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_client_metadata');
    expect(CLIENTS).toHaveLength(0);
  });

  it('authorization_code 이외의 grant 만 요구하면 거부한다', async () => {
    const res = await POST(request({ ...VALID, grant_types: ['refresh_token'] }));
    expect(res.status).toBe(400);
    expect(CLIENTS).toHaveLength(0);
  });

  it('JSON 이 아닌 본문·배열·null 은 사양 안의 오류로 끝난다 (500 이 아니다)', async () => {
    for (const bad of ['__throw__', [], null, 'string']) {
      const res = await POST(request(bad));
      expect(res.status, JSON.stringify(bad)).toBe(400);
      // 사양 밖의 500 을 주면 클라이언트가 OAuth 오류로 분류하지 못하고
      // "설정 실패"로만 끝난다.
      expect((await res.json()).error).toBe('invalid_client_metadata');
    }
  });

  it('저장소 장애는 사양 안의 503 이다', async () => {
    READ_FAILS = true;
    const a = await POST(request(VALID));
    expect(a.status).toBe(503);
    expect((await a.json()).error).toBe('temporarily_unavailable');

    READ_FAILS = false;
    INSERT_FAILS = true;
    const b = await POST(request(VALID));
    expect(b.status).toBe(503);
    // client_id 를 돌려주고 저장은 실패하면, 커넥터는 존재하지 않는 클라이언트로
    // 인가 흐름을 시작해 "등록되지 않은 client_id" 에서 막힌다 — 원인은 여기인데.
    expect((await b.json()).client_id).toBeUndefined();
  });
});
