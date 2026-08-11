/**
 * 원격 MCP 엔드포인트 — **인증 관문과 전송의 동작** 테스트.
 *
 * `protocol.test.ts` 는 규칙층(`../protocol`, `../tools`)만 부른다. 실제
 * 라우트(`route.ts`)는 이 파일이 생기기 전까지 한 번도 실행된 적이 없었다 —
 * **모든 도구 호출이 통과하는 단 하나의 관문**인데도.
 *
 * 여기서 지키는 것 셋:
 *
 *  1. **관문이 먼저 돈다.** 인증이 실패하면 어떤 도구도 불리지 않는다. 응답만
 *     보는 검사는 "401 을 줬다"까지만 확인하고, 그 사이에 핸들러가 이미
 *     돌았는지는 못 본다. 그래서 핸들러 호출 횟수를 센다.
 *  2. **401 과 403 을 구분한다.** 범위 부족은 재인증해도 열리지 않는 문이다 —
 *     401 로 돌려주면 클라이언트가 OAuth 흐름을 **무한히** 다시 돈다
 *     (RFC 6750 §3.1). 이 구분이 뒤집히면 증상은 "연결이 안 되는데 오류도
 *     안 보이는" 무한 재시도 루프다.
 *  3. **401 에 WWW-Authenticate 가 붙는다.** Claude·ChatGPT 커넥터는 이 헤더를
 *     보고 OAuth 흐름을 시작한다. 없으면 사용자는 "설정 실패"만 본다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type AuthResult =
  | { ok: true; userId: string; tokenId: string }
  | { ok: false; reason: 'missing' | 'malformed' | 'unknown_or_expired' | 'insufficient_scope' };

let AUTH: AuthResult = { ok: true, userId: 'user-1', tokenId: 'tok-1' };
let seenHeader: string | null | undefined;
/** 도구가 실제로 불린 횟수 — 관문이 먼저 도는지 보는 유일한 방법. */
let toolCalls: Array<{ tool: string; userId: string }> = [];

vi.mock('../auth', () => ({
  authenticate: async (header: string | null) => {
    seenHeader = header;
    return AUTH;
  },
  wwwAuthenticate: (origin: string) =>
    `Bearer realm="argus", resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
}));

const stub = (tool: string) => async (userId: string) => {
  toolCalls.push({ tool, userId });
  return { content: [{ type: 'text' as const, text: 'ok' }] };
};

vi.mock('../handlers', () => ({
  handleOpen: stub('argus_open'),
  handleSharpen: stub('argus_sharpen'),
  handlePlan: stub('argus_plan'),
  handleAdopt: stub('argus_adopt'),
  handleReturn: stub('argus_return'),
  handleRecall: stub('argus_recall'),
}));

const { POST, GET } = await import('../route');

function request(body: unknown, headers: Record<string, string> = {}) {
  const h: Record<string, string> = { authorization: 'Bearer argus_pat_x', ...headers };
  return {
    url: 'https://argus.voyage/api/mcp/v2',
    headers: { get: (k: string) => h[k.toLowerCase()] ?? null },
    json: async () => {
      if (body === '__throw__') throw new Error('bad json');
      return body;
    },
  } as never;
}

const rpc = (method: string, params: Record<string, unknown> = {}, id: unknown = 1) => ({
  jsonrpc: '2.0',
  method,
  params,
  ...(id === undefined ? {} : { id }),
});

beforeEach(() => {
  AUTH = { ok: true, userId: 'user-1', tokenId: 'tok-1' };
  toolCalls = [];
  seenHeader = undefined;
});

describe('POST /api/mcp/v2 — 인증 관문', () => {
  it('토큰이 없으면 401 + WWW-Authenticate, 그리고 **도구는 불리지 않는다**', async () => {
    AUTH = { ok: false, reason: 'missing' };
    const res = await POST(request(rpc('tools/call', { name: 'argus_open', arguments: {} })));

    expect(res.status).toBe(401);
    // 이 헤더가 없으면 커넥터는 어디서 인증받아야 하는지 몰라 "설정 실패"로 끝난다.
    expect(res.headers.get('WWW-Authenticate')).toContain('oauth-protected-resource');
    expect(toolCalls, '인증 실패인데 도구가 실행됐습니다').toHaveLength(0);
  });

  it('만료·미상 토큰도 401 이고 도구는 불리지 않는다', async () => {
    AUTH = { ok: false, reason: 'unknown_or_expired' };
    const res = await POST(request(rpc('tools/call', { name: 'argus_recall', arguments: {} })));
    expect(res.status).toBe(401);
    expect(toolCalls).toHaveLength(0);
  });

  it('범위 부족은 401 이 아니라 403 이다 — 재인증해도 열리지 않는 문이다', async () => {
    AUTH = { ok: false, reason: 'insufficient_scope' };
    const res = await POST(request(rpc('tools/list')));

    // 401 로 돌려주면 클라이언트가 OAuth 흐름을 무한히 다시 돈다 (RFC 6750 §3.1).
    // 증상은 "연결이 안 되는데 오류도 안 보이는" 재시도 루프다.
    expect(res.status).toBe(403);
    expect(res.headers.get('WWW-Authenticate')).toContain('insufficient_scope');
    expect(toolCalls).toHaveLength(0);
  });

  it('Authorization 헤더를 그대로 관문에 넘긴다', async () => {
    await POST(request(rpc('tools/list'), { authorization: 'Bearer argus_pat_abc' }));
    expect(seenHeader).toBe('Bearer argus_pat_abc');
  });

  it('도구는 토큰이 가리키는 사용자로만 실행된다', async () => {
    AUTH = { ok: true, userId: 'user-9', tokenId: 'tok-9' };
    await POST(request(rpc('tools/call', { name: 'argus_open', arguments: { utterance: 'x' } })));
    expect(toolCalls).toEqual([{ tool: 'argus_open', userId: 'user-9' }]);
  });

  it('본문이 너무 크면 읽기 전에 413 으로 끝낸다', async () => {
    const res = await POST(request(rpc('tools/list'), { 'content-length': String(300 * 1024) }));
    expect(res.status).toBe(413);
    expect(toolCalls).toHaveLength(0);
  });
});

describe('POST /api/mcp/v2 — JSON-RPC 전송', () => {
  it('initialize 는 도구 선언과 지시문을 돌려준다', async () => {
    const res = await POST(request(rpc('initialize', { protocolVersion: '2025-06-18' })));
    const body = await res.json();
    expect(body.result.serverInfo).toBeTruthy();
    expect(body.result.protocolVersion).toBeTruthy();
    // 지시문은 호스트가 모델 맥락에 얹는 유일한 사양이다 — 비면 모델은
    // argus_recall 을 영영 부르지 않는다.
    expect(String(body.result.instructions ?? '').length).toBeGreaterThan(50);
  });

  it('tools/list 는 선언된 도구를 전부 돌려준다', async () => {
    const { TOOLS } = await import('../tools');
    const body = await (await POST(request(rpc('tools/list')))).json();
    expect(body.result.tools.map((t: { name: string }) => t.name).sort()).toEqual(
      TOOLS.map((t) => t.name).sort(),
    );
  });

  it('깨진 JSON 은 parse error 로 끝낸다 (사양 밖 500 이 아니다)', async () => {
    const res = await POST(request('__throw__'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBeTruthy();
  });

  it('JSON-RPC 가 아닌 항목은 배치 안에서도 각각 오류가 된다', async () => {
    const body = await (await POST(request([rpc('tools/list'), { not: 'rpc' }]))).json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    expect(body[1].error).toBeTruthy();
  });

  it('알림(id 없음)에는 답하지 않는다 — 전부 알림이면 202', async () => {
    const res = await POST(request({ jsonrpc: '2.0', method: 'notifications/initialized' }));
    expect(res.status).toBe(202);
  });

  it('빈 배치는 거절한다', async () => {
    expect((await POST(request([]))).status).toBe(400);
  });

  it('없는 도구를 불러도 500 이 아니라 도구 오류로 끝낸다', async () => {
    const body = await (
      await POST(request(rpc('tools/call', { name: 'argus_nonexistent', arguments: {} })))
    ).json();
    expect(body.result?.isError || body.error).toBeTruthy();
    expect(toolCalls).toHaveLength(0);
  });

  it('응답은 캐시되지 않는다', async () => {
    const res = await POST(request(rpc('tools/list')));
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

describe('GET /api/mcp/v2', () => {
  it('405 로 끝내되 어디서 인증받는지는 알려준다', async () => {
    const res = await GET(request(null));
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
    expect(res.headers.get('WWW-Authenticate')).toContain('oauth-protected-resource');
  });
});
