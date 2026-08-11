/**
 * 익명 작업 이관 — **동작** 테스트.
 *
 * 이 두 라우트는 작지만 경계가 날카롭다. 로그인 없이 쓰던 사람의 작업이
 * 계정으로 넘어오는 유일한 길이고, 방향이 뒤집히거나 주체가 뒤바뀌면
 * **남의 익명 작업을 가로챌 수 있다.**
 *
 * 방향이 정확히 한 쪽이어야 한다:
 *   · `prepare` — **익명 세션만** 티켓을 만든다. 영구 계정이 만들 수 있으면
 *     자기 계정을 "청구 가능한 꾸러미"로 포장할 수 있다.
 *   · `claim`   — **영구 계정만** 청구한다. 익명이 청구할 수 있으면 익명
 *     세션끼리 서로를 흡수한다.
 *
 * 그리고 하나, 모르고 보면 버그처럼 보이는 결정이 있다: **RPC 가 실패하면
 * 쿠키를 지우지 않는다.** 트랜잭션이 롤백됐으므로 같은 계정이 다시 시도할 수
 * 있어야 하기 때문이다. 여기서 "정리"한답시고 쿠키를 지우면 사용자의 익명
 * 작업은 영영 넘어오지 못한다 — 되돌릴 수 없는 손실이다. 그래서 고정한다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

const COOKIE = 'argus_anon_transfer';

let USER: { id: string; is_anonymous?: boolean } | null = null;
let inserted: Array<Record<string, unknown>> = [];
let INSERT_FAILS = false;
let rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
let RPC_FAILS = false;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: USER }, error: USER ? null : { message: 'bad token' } }),
    },
    from: () => ({
      async insert(row: Record<string, unknown>) {
        if (INSERT_FAILS) return { error: { message: 'insert failed' } };
        inserted.push(row);
        return { error: null };
      },
    }),
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      if (RPC_FAILS) return { data: null, error: { message: 'rolled back' } };
      return { data: { moved: 3 }, error: null };
    },
  }),
}));

const { POST: prepare } = await import('../anonymous-transfer/prepare/route');
const { POST: claim } = await import('../anonymous-transfer/claim/route');

function request(opts: { auth?: string | null; cookie?: string | null } = {}) {
  return {
    // `??` 로 쓰면 안 된다 — `auth: null`(헤더 없음)이 nullish 로 판정돼 기본값
    // 'Bearer t' 로 되돌아가고, **헤더 부재 경로가 아예 검사되지 않는다.**
    // (초안이 그랬고, 그래서 401 을 기대한 두 케이스가 403 으로 나왔다.)
    headers: {
      get: (k: string) =>
        k.toLowerCase() === 'authorization' ? (opts.auth === undefined ? 'Bearer t' : opts.auth) : null,
    },
    cookies: { get: (n: string) => (n === COOKIE && opts.cookie ? { value: opts.cookie } : undefined) },
  } as never;
}

beforeEach(() => {
  USER = null;
  inserted = [];
  INSERT_FAILS = false;
  rpcCalls = [];
  RPC_FAILS = false;
});

describe('POST /api/account/anonymous-transfer/prepare', () => {
  it('익명 세션이 티켓을 만들면 원문은 쿠키에만, DB 에는 해시만 간다', async () => {
    USER = { id: 'anon-1', is_anonymous: true };
    const res = await prepare(request());
    expect(res.status).toBe(200);

    const cookie = res.cookies.get(COOKIE)!;
    expect(cookie.value.length).toBeGreaterThan(20);
    // 원문이 DB 에 남으면 그 표를 읽을 수 있는 쪽이 남의 작업을 청구할 수 있다.
    expect(inserted).toHaveLength(1);
    expect(inserted[0].token_hash).toBe(createHash('sha256').update(cookie.value).digest('hex'));
    expect(JSON.stringify(inserted[0])).not.toContain(cookie.value);
    expect(inserted[0].source_user_id).toBe('anon-1');
    // 브라우저 스크립트가 읽을 수 있으면 XSS 한 번에 티켓이 새어 나간다.
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('lax');
  });

  it('영구 계정은 티켓을 만들 수 없다 — 자기 계정을 청구 가능한 꾸러미로 포장할 수 없다', async () => {
    USER = { id: 'user-1', is_anonymous: false };
    const res = await prepare(request());
    expect(res.status).toBe(403);
    expect(inserted, '영구 계정이 이관 티켓을 만들었습니다').toHaveLength(0);
  });

  it('is_anonymous 가 아예 없으면 익명으로 보지 않는다 (부재를 참으로 읽지 않는다)', async () => {
    USER = { id: 'user-1' };
    expect((await prepare(request())).status).toBe(403);
    expect(inserted).toHaveLength(0);
  });

  it('로그인 없이는 티켓이 없다', async () => {
    expect((await prepare(request({ auth: null }))).status).toBe(401);
    USER = null;
    expect((await prepare(request())).status).toBe(403);
    expect(inserted).toHaveLength(0);
  });

  it('저장이 실패하면 쿠키를 심지 않는다', async () => {
    USER = { id: 'anon-1', is_anonymous: true };
    INSERT_FAILS = true;
    const res = await prepare(request());
    expect(res.status).toBe(500);
    // 쿠키만 심고 행이 없으면, 사용자는 티켓을 들고 있는데 청구는 영영 안 된다.
    expect(res.cookies.get(COOKIE)?.value).toBeFalsy();
  });
});

describe('POST /api/account/anonymous-transfer/claim', () => {
  it('영구 계정이 청구하면 해시로 조회하고, 대상은 자기 자신이다', async () => {
    USER = { id: 'user-9', is_anonymous: false };
    const res = await claim(request({ cookie: 'raw-ticket-abc' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.transferred).toBe(true);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fn).toBe('claim_anonymous_account_transfer');
    // 원문을 그대로 넘기면 저장된 해시와 대조가 안 되고, 로그에도 남는다.
    expect(rpcCalls[0].args.p_token_hash).toBe(createHash('sha256').update('raw-ticket-abc').digest('hex'));
    // 대상은 **인증된 사용자**여야 한다 — 본문에서 받으면 남의 계정으로 옮길 수 있다.
    expect(rpcCalls[0].args.p_target_user_id).toBe('user-9');
    // 성공하면 티켓은 소진된다.
    expect(res.cookies.get(COOKIE)?.value).toBe('');
  });

  it('익명 세션은 청구할 수 없다 — 익명끼리 서로를 흡수하지 못한다', async () => {
    USER = { id: 'anon-2', is_anonymous: true };
    const res = await claim(request({ cookie: 'raw-ticket-abc' }));
    expect(res.status).toBe(403);
    expect(rpcCalls, '익명 세션이 이관을 청구했습니다').toHaveLength(0);
  });

  it('티켓이 없으면 조용히 204 — 오류가 아니다', async () => {
    USER = { id: 'user-9', is_anonymous: false };
    const res = await claim(request({ cookie: null }));
    // 대부분의 로그인은 이관과 무관하다. 오류로 만들면 정상 로그인마다
    // 실패가 찍히고, 진짜 실패가 그 소음에 묻힌다.
    expect(res.status).toBe(204);
    expect(rpcCalls).toHaveLength(0);
  });

  it('티켓이 있는데 로그인 안 했으면 401 이고 아무 일도 없다', async () => {
    const res = await claim(request({ cookie: 'raw-ticket-abc', auth: null }));
    expect(res.status).toBe(401);
    expect(rpcCalls).toHaveLength(0);
  });

  it('RPC 가 실패하면 쿠키를 **지우지 않는다** — 다시 시도할 길을 남긴다', async () => {
    USER = { id: 'user-9', is_anonymous: false };
    RPC_FAILS = true;
    const res = await claim(request({ cookie: 'raw-ticket-abc' }));

    expect(res.status).toBe(409);
    // 트랜잭션이 롤백됐으므로 같은 계정이 다시 시도할 수 있어야 한다.
    // 여기서 "정리"한답시고 쿠키를 지우면 그 사람의 익명 작업은 영영 못 넘어온다.
    expect(res.cookies.get(COOKIE)?.value, '실패했는데 티켓을 버렸습니다 — 재시도가 불가능해집니다').toBeUndefined();
  });
});
