/**
 * `argus push` 적재 — **동작** 테스트.
 *
 * 이 라우트는 브라우저 세션이 아니라 PAT 하나로 남의 계정에 **쓴다.** 여기서
 * 틀리면 조용히 남의 원장에 행이 생기고, 그 사실은 어디에도 빨간불로 뜨지
 * 않는다. 세 가지를 고정한다:
 *
 *  1. **범위 분리.** 원격 커넥터가 사용자 동의로 받아 가는 `argus.decisions`
 *     토큰으로는 적재할 수 없다 — 그 동의는 파일 적재를 말한 적이 없다.
 *     라우트가 `SCOPE_FULL` 을 요구하는지를 인자로 직접 본다.
 *  2. **적재 대상은 토큰의 주인이다.** 본문에 어떤 id 가 들어와도 그것이
 *     소유자로 새면 남의 계정에 쓰게 된다.
 *  3. **실패를 성공으로 보고하지 않는다.** 아무것도 못 썼는데 200 을 주면
 *     CLI 는 "올렸다"고 말하고 사용자는 유실을 모른다. 반대로 일부라도
 *     들어갔으면 502 로 덮지 않는다 — 그러면 재시도가 중복을 만든다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCOPE_DECISIONS, SCOPE_FULL } from '@/lib/plugin-token-auth';

const USER_ID = 'user-1';

let AUTH: { ok: boolean; reason?: string; userId?: string } = { ok: true, userId: USER_ID };
let requiredScopes: string[] = [];
let ingestCalls: Array<{ userId: string; files: Array<{ name: string; content: string }>; source: string }> = [];
let SUMMARY: Record<string, unknown> = {
  decisions: { written: 2, skipped: 0 },
  bearings: { written: 1, skipped: 0 },
};

vi.mock('@/lib/share-guard', () => ({ adminClient: () => ({ tag: 'admin' }) }));

vi.mock('@/lib/plugin-ingest-core', () => ({
  ingestPluginFiles: async (
    _admin: unknown,
    userId: string,
    files: Array<{ name: string; content: string }>,
    source: string,
  ) => {
    ingestCalls.push({ userId, files, source });
    return SUMMARY;
  },
}));

vi.mock('@/lib/plugin-token-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/plugin-token-auth')>();
  return {
    ...actual,
    authenticatePluginToken: async (_header: string | null, required: string) => {
      requiredScopes.push(required);
      return AUTH;
    },
  };
});

const { POST } = await import('../ingest/route');

function request(over: {
  headers?: Record<string, string | null>;
  body?: unknown;
  bodyThrows?: boolean;
} = {}) {
  const h: Record<string, string | null> = {
    'content-type': 'application/json',
    authorization: 'Bearer argus_pat_x',
    ...over.headers,
  };
  return {
    headers: { get: (k: string) => h[k.toLowerCase()] ?? null },
    json: async () => {
      if (over.bodyThrows) throw new SyntaxError('Unexpected token');
      return over.body ?? { files: [{ name: 'ledger.jsonl', content: '{}' }] };
    },
  } as never;
}

beforeEach(() => {
  AUTH = { ok: true, userId: USER_ID };
  requiredScopes = [];
  ingestCalls = [];
  SUMMARY = { decisions: { written: 2, skipped: 0 }, bearings: { written: 1, skipped: 0 } };
});

describe('POST /api/plugin/ingest', () => {
  it('계정 전체 범위를 요구한다 — 결정 범위 토큰으로는 적재할 수 없다', async () => {
    const res = await POST(request());
    expect(res.status).toBe(200);
    // 여기서 SCOPE_DECISIONS 로 바뀌면 원격 커넥터의 동의가 적재 권한이 된다.
    expect(requiredScopes).toEqual([SCOPE_FULL]);
    expect(SCOPE_FULL).not.toBe(SCOPE_DECISIONS);
  });

  it('범위가 모자란 토큰은 403 이고 아무것도 적재하지 않는다', async () => {
    AUTH = { ok: false, reason: 'insufficient_scope' };
    const res = await POST(request());
    expect(res.status).toBe(403);
    // 401 로 주면 CLI 는 토큰을 재발급하러 가고, 범위가 문제라는 사실은 묻힌다.
    expect(ingestCalls, '범위가 모자란데 적재가 돌았습니다').toHaveLength(0);
  });

  it('없거나 모르는 토큰은 401 이고 아무것도 적재하지 않는다', async () => {
    for (const reason of ['missing', 'malformed', 'unknown_or_expired']) {
      AUTH = { ok: false, reason };
      expect((await POST(request())).status).toBe(401);
    }
    expect(ingestCalls).toHaveLength(0);
  });

  it('적재 대상은 **토큰의 주인**이다 — 본문의 id 를 따르지 않는다', async () => {
    await POST(request({
      body: {
        user_id: 'someone-else',
        userId: 'someone-else',
        files: [{ name: 'ledger.jsonl', content: '{"a":1}' }],
      },
    }));
    expect(ingestCalls).toHaveLength(1);
    expect(ingestCalls[0].userId).toBe(USER_ID);
    expect(JSON.stringify(ingestCalls[0])).not.toContain('someone-else');
    // 출처를 'push' 로 남긴다 — 수동 업로드와 자동 밀어넣기가 섞이면 나중에
    // 무엇이 어디서 왔는지 되짚을 수 없다.
    expect(ingestCalls[0].source).toBe('push');
  });

  it('JSON 이 아닌 요청은 파싱 전에 415 로 끝낸다', async () => {
    const res = await POST(request({ headers: { 'content-type': 'text/plain' } }));
    expect(res.status).toBe(415);
    expect(ingestCalls).toHaveLength(0);
  });

  it('선언된 본문이 상한을 넘으면 인증 전에 413 이다', async () => {
    const res = await POST(request({ headers: { 'content-length': String(17 * 1024 * 1024) } }));
    expect(res.status).toBe(413);
    expect(requiredScopes, '상한을 넘겼는데 토큰 조회까지 갔습니다').toHaveLength(0);
    expect(ingestCalls).toHaveLength(0);
  });

  it('깨진 JSON 은 400 이다 (500 으로 터지지 않는다)', async () => {
    const res = await POST(request({ bodyThrows: true }));
    expect(res.status).toBe(400);
    expect(ingestCalls).toHaveLength(0);
  });

  it('files 가 없거나 비었으면 400 이다', async () => {
    for (const body of [{}, { files: [] }, { files: 'ledger.jsonl' }, { files: null }]) {
      expect((await POST(request({ body }))).status).toBe(400);
    }
    expect(ingestCalls).toHaveLength(0);
  });

  it('모양이 틀린 항목은 버리고, 하나도 안 남으면 400 이다', async () => {
    const res = await POST(request({
      body: { files: [{ name: 'a.jsonl' }, { content: 'x' }, null, 'a.jsonl', { name: 1, content: 2 }] },
    }));
    expect(res.status).toBe(400);
    // 조용히 빈 적재를 성공으로 보고하면 CLI 는 올렸다고 말한다.
    expect(ingestCalls).toHaveLength(0);
  });

  it('쓸 수 있는 항목만 골라 넘기고 이름은 상한에서 자른다', async () => {
    const long = `${'n'.repeat(300)}.jsonl`;
    await POST(request({
      body: { files: [{ name: long, content: 'ok' }, { name: 'bad' }] },
    }));
    expect(ingestCalls[0].files).toHaveLength(1);
    expect(ingestCalls[0].files[0].name).toHaveLength(200);
    // 내용은 자르지 않는다 — 이름은 라벨이지만 내용은 사용자의 기록이다.
    expect(ingestCalls[0].files[0].content).toBe('ok');
  });

  it('한 줄도 못 썼는데 오류가 있으면 502 — 성공으로 보고하지 않는다', async () => {
    SUMMARY = {
      error: 'ledger table missing',
      decisions: { written: 0, skipped: 3 },
      bearings: { written: 0, skipped: 0 },
    };
    const res = await POST(request());
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.error).toBe('ledger table missing');
    // 요약을 함께 준다 — 무엇이 얼마나 실패했는지 CLI 가 사람에게 말할 수 있어야 한다.
    expect(body.summary).toBeTruthy();
  });

  it('일부라도 들어갔으면 오류가 있어도 200 이다 — 재시도가 중복을 만든다', async () => {
    SUMMARY = {
      error: 'one bearing file was malformed',
      decisions: { written: 4, skipped: 1 },
      bearings: { written: 0, skipped: 1 },
    };
    const res = await POST(request());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    // 그래도 오류는 숨기지 않는다 — 요약 안에 그대로 실려 나간다.
    expect(body.summary.error).toBe('one bearing file was malformed');
  });
});
