/**
 * OAuth 토큰 교환 — **라우트 동작** 테스트.
 *
 * `oauth.test.ts` 는 이 흐름의 **규칙층**(`oauth/lib`, discovery 문서)만 부른다.
 * 라우트 핸들러 넷(`authorize`·`register`·`approve`·`token`)은 이 파일이
 * 생기기 전까지 테스트에서 한 줄도 실행된 적이 없었다 — 원격 커넥터의 정문이고
 * 창업자가 곧 처음 걸어갈 길인데도.
 *
 * 여기서 지키는 것은 규칙이 **문서에 있다**가 아니라 **코드가 그렇게 판단한다**
 * 이다. 특히 순서가 걸린 두 가지는 소스를 읽어서는 확신할 수 없다:
 *
 *  1. **코드는 자격증명보다 먼저 소모된다.** 순서가 뒤집히면 동시에 도착한 두
 *     요청이 같은 코드로 토큰을 두 개 만든다.
 *  2. **토큰 상한은 코드를 태우기 전에 본다.** 뒤에 두면 상한에 걸린 사용자의
 *     코드가 이미 소모돼, 다시 시도해도 그 코드로는 영영 안 된다.
 *
 * PKCE·해시는 진짜 `oauth/lib` 을 쓴다. 그것까지 목으로 만들면 "우리가 만든
 * 값으로 우리가 만든 검증을 통과했다"가 되어 아무것도 증명하지 못한다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, randomBytes } from 'crypto';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const pkceChallenge = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url');

interface Grant {
  id: string;
  client_id: string;
  user_id: string;
  code_hash: string;
  code_challenge: string;
  redirect_uri: string;
  scope: string;
  status: string;
  expires_at: string;
  consumed_at?: string;
}

let GRANTS: Grant[] = [];
let TOKENS: Array<Record<string, unknown>> = [];
let LIVE_TOKEN_COUNT = 0;
/** 조회가 장애를 내야 하는가 (저장소 장애 재현). */
let GRANT_LOOKUP_FAILS = false;
/** plugin_tokens insert 가 실패해야 하는가. */
let TOKEN_INSERT_FAILS = false;

function grantsTable(): Record<string, unknown> {
  let mode: 'select' | 'update' = 'select';
  let patch: Record<string, unknown> = {};
  const preds: Array<(g: Grant) => boolean> = [];
  const q: Record<string, unknown> = {
    select: () => q,
    update(p: Record<string, unknown>) {
      mode = 'update';
      patch = p;
      return q;
    },
    eq(col: string, val: unknown) {
      preds.push((g) => (g as unknown as Record<string, unknown>)[col] === val);
      return q;
    },
    async maybeSingle() {
      if (GRANT_LOOKUP_FAILS && mode === 'select') return { data: null, error: { message: 'boom' } };
      const hit = GRANTS.find((g) => preds.every((p) => p(g)));
      if (!hit) return { data: null, error: null };
      if (mode === 'update') Object.assign(hit, patch);
      return { data: { ...hit }, error: null };
    },
  };
  return q;
}

function tokensTable(): Record<string, unknown> {
  const q: Record<string, unknown> = {
    select: () => q,
    eq: () => q,
    or: () => q,
    then(resolve: (v: { count: number; error: unknown }) => unknown) {
      return Promise.resolve({ count: LIVE_TOKEN_COUNT, error: null }).then(resolve);
    },
    async insert(row: Record<string, unknown>) {
      if (TOKEN_INSERT_FAILS) return { error: { message: 'insert failed' } };
      TOKENS.push(row);
      return { error: null };
    },
  };
  return q;
}

function clientsTable(): Record<string, unknown> {
  const q: Record<string, unknown> = {
    select: () => q,
    update: () => q,
    eq: () => q,
    async maybeSingle() {
      return { data: { client_name: 'Claude' }, error: null };
    },
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
  };
  return q;
}

vi.mock('@/lib/share-guard', () => ({
  adminClient: () => ({
    from: (t: string) =>
      t === 'argus_oauth_grants' ? grantsTable() : t === 'plugin_tokens' ? tokensTable() : clientsTable(),
  }),
}));

const { POST } = await import('../token/route');

const VERIFIER = randomBytes(40).toString('base64url');
const CODE = `argus_code_${randomBytes(32).toString('hex')}`;
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';

function seedGrant(over: Partial<Grant> = {}): Grant {
  const g: Grant = {
    id: 'g1',
    client_id: 'client-1',
    user_id: 'user-1',
    code_hash: sha256(CODE),
    code_challenge: pkceChallenge(VERIFIER),
    redirect_uri: REDIRECT,
    scope: 'argus.decisions',
    status: 'issued',
    expires_at: new Date(Date.now() + 600_000).toISOString(),
    ...over,
  };
  GRANTS.push(g);
  return g;
}

function form(over: Record<string, string> = {}) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: CODE,
    code_verifier: VERIFIER,
    client_id: 'client-1',
    redirect_uri: REDIRECT,
    ...over,
  });
  return {
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/x-www-form-urlencoded' : null) },
    text: async () => body.toString(),
    json: async () => ({}),
  } as never;
}

beforeEach(() => {
  GRANTS = [];
  TOKENS = [];
  LIVE_TOKEN_COUNT = 0;
  GRANT_LOOKUP_FAILS = false;
  TOKEN_INSERT_FAILS = false;
});

describe('POST /api/mcp/v2/oauth/token', () => {
  it('올바른 교환은 PAT 을 내주고, 저장은 해시로만 한다', async () => {
    seedGrant();
    const res = await POST(form());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.access_token).toMatch(/^argus_pat_[0-9a-f]{48}$/);
    expect(body.token_type).toBe('Bearer');
    expect(body.scope).toBe('argus.decisions');
    // 캐시되면 중간 프록시에 자격증명이 남는다.
    expect(res.headers.get('cache-control')).toBe('no-store');

    // 평문 토큰이 DB 에 들어가면 유출 시 그대로 쓰인다.
    expect(TOKENS).toHaveLength(1);
    expect(TOKENS[0].token_hash).toBe(sha256(body.access_token));
    expect(JSON.stringify(TOKENS[0])).not.toContain(body.access_token);
    // 동의 화면이 약속한 범위가 토큰에 실제로 새겨진다. 이것이 없으면 같은
    // PAT 으로 ingest·seal 까지 열려 화면의 문장이 거짓말이 된다.
    // (OAuth 응답의 scope 와 토큰에 새기는 scope 는 서로 다른 상수에서 오는데
    //  지금은 값이 같다 — 갈라지면 이 두 줄이 그것을 드러낸다.)
    expect(TOKENS[0].scope).toBe('argus.decisions');
  });

  it('코드는 한 번만 쓰인다 — 두 번째 교환은 토큰을 만들지 않는다', async () => {
    seedGrant();
    const first = await POST(form());
    expect(first.status).toBe(200);

    const second = await POST(form());
    expect(second.status).toBe(400);
    expect((await second.json()).error).toBe('invalid_grant');
    expect(TOKENS, '같은 코드로 토큰이 두 개 만들어졌습니다').toHaveLength(1);
  });

  it('상한에 걸리면 코드를 태우지 않는다 — 다시 시도할 길이 남아야 한다', async () => {
    const g = seedGrant();
    LIVE_TOKEN_COUNT = 10;

    const blocked = await POST(form());
    expect(blocked.status).toBe(429);
    expect(TOKENS).toHaveLength(0);
    // 여기서 status 가 consumed 면, 사용자가 설정에서 토큰을 지워도 이 코드로는
    // 영영 못 들어온다 — 상한 검사가 소모 뒤에 있다는 뜻이다.
    expect(g.status, '상한에 걸렸는데 코드가 이미 소모됐습니다').toBe('issued');

    LIVE_TOKEN_COUNT = 0;
    expect((await POST(form())).status).toBe(200);
  });

  it('PKCE 가 안 맞으면 거절한다 (검증기를 진짜로 돌린다)', async () => {
    seedGrant();
    const res = await POST(form({ code_verifier: randomBytes(40).toString('base64url') }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_grant');
    expect(TOKENS).toHaveLength(0);
  });

  it('code_verifier 가 아예 없으면 거절한다 (공개 클라이언트의 유일한 방어선)', async () => {
    seedGrant();
    const res = await POST(form({ code_verifier: '' }));
    expect(res.status).toBe(400);
    expect(TOKENS).toHaveLength(0);
  });

  it('client_id 가 다르면 invalid_client', async () => {
    seedGrant();
    const res = await POST(form({ client_id: 'someone-else' }));
    expect((await res.json()).error).toBe('invalid_client');
    expect(TOKENS).toHaveLength(0);
  });

  it('redirect_uri 는 인가 때와 정확히 같아야 한다', async () => {
    seedGrant();
    const res = await POST(form({ redirect_uri: REDIRECT + '/extra' }));
    expect((await res.json()).error).toBe('invalid_grant');
    expect(TOKENS).toHaveLength(0);
  });

  it('만료된 코드는 거절한다', async () => {
    seedGrant({ expires_at: new Date(Date.now() - 1000).toISOString() });
    const res = await POST(form());
    expect((await res.json()).error_description).toContain('expired');
    expect(TOKENS).toHaveLength(0);
  });

  it('refresh_token 은 발급하지 않는다 — 지원 안 하는 것을 지원하는 척하지 않는다', async () => {
    seedGrant();
    const ok = await POST(form());
    expect((await ok.json()).refresh_token).toBeUndefined();

    const res = await POST(form({ grant_type: 'refresh_token' }));
    expect((await res.json()).error).toBe('unsupported_grant_type');
  });

  it('저장소 장애는 invalid_grant 가 아니라 temporarily_unavailable 이다', async () => {
    seedGrant();
    GRANT_LOOKUP_FAILS = true;
    const res = await POST(form());
    // invalid_grant 로 돌려주면 클라이언트는 코드를 버리고 흐름을 처음부터
    // 다시 도는데, 원인이 코드가 아니므로 그래도 실패한다. 원인을 바꿔
    // 말하는 오류는 사용자를 무한 재시도에 가둔다.
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('temporarily_unavailable');
  });

  it('토큰 저장이 실패하면 성공한 척하지 않는다', async () => {
    seedGrant();
    TOKEN_INSERT_FAILS = true;
    const res = await POST(form());
    expect(res.status).toBe(503);
    // access_token 을 돌려주고 저장은 실패하면, 사용자는 동작하지 않는
    // 자격증명을 손에 쥔 채 원인을 못 찾는다.
    expect((await res.json()).access_token).toBeUndefined();
  });

  it('form 이 아닌 본문은 거절한다 (사양은 form-encoded 다)', async () => {
    seedGrant();
    const res = await POST({
      headers: { get: () => 'text/plain' },
      text: async () => 'whatever',
      json: async () => ({}),
    } as never);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_request');
  });
});
