/**
 * 판단 아카이브 복원 — **동작** 테스트.
 *
 * 삭제의 거울이고, 되돌리기 어렵기는 마찬가지다. 여기서 틀리면 남의 기록이
 * 내 계정에 섞이거나, 복원이 일어났는데 그 사실이 어디에도 안 남는다.
 *
 * 고정하는 것 셋:
 *
 *  1. **대상은 언제나 인증된 사용자다.** `target_account_id` 와
 *     `target_account_confirmation` 이 아카이브의 `source_account_id` 나 요청
 *     본문에서 오면, 남의 아카이브를 올려 그 사람의 계정에 쓰거나 내 계정에
 *     남의 기록을 들일 수 있다.
 *  2. **기록되지 않은 복원은 성공이 아니다.** 영수증 저장이 실패했는데 200 을
 *     주면, 데이터는 들어갔는데 그 사실을 아무도 모른다 — 감사도 되돌리기도
 *     불가능해진다.
 *  3. **dry-run 은 아무것도 남기지 않는다.** 미리보기가 흔적을 남기면 그것은
 *     미리보기가 아니다.
 *
 * 셋 다 응답만 보는 검사로는 확인할 수 없다. 복원기에 **무엇이 넘어갔는지**와
 * RPC 가 **불렸는지**를 직접 본다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

const USER_ID = 'user-1';
const OTHER_ID = 'someone-else';

let USER: { id: string } | null = { id: USER_ID };
let restoreArgs: Record<string, unknown> | null = null;
let RESTORE_STATUS = 'restored';
let RESTORE_THROWS: string | null = null;
let PARSE_THROWS: string | null = null;
let rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
let RPC_FAILS = false;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: USER }, error: USER ? null : { message: 'bad' } }) },
    async rpc(fn: string, args: Record<string, unknown>) {
      rpcCalls.push({ fn, args });
      return RPC_FAILS ? { error: { message: 'persist failed' } } : { error: null };
    },
  }),
}));

vi.mock('@/lib/epistemic/server-judgment-archive', () => ({
  parseJudgmentArchive: async () => {
    if (PARSE_THROWS) throw new Error(PARSE_THROWS);
    // 아카이브는 **남의 계정**에서 나온 것으로 둔다 — 라우트가 이 값을 대상으로
    // 쓰는지 아닌지가 이 파일의 첫 번째 관심사다.
    return { manifest: { archive_id: 'arch-1', source_account_id: OTHER_ID } };
  },
}));

vi.mock('@/lib/epistemic/archive-restore', () => ({
  restoreJudgmentArchive: async (args: Record<string, unknown>) => {
    restoreArgs = args;
    if (RESTORE_THROWS) throw new Error(RESTORE_THROWS);
    return { restore_id: 'r-1', status: args.dry_run ? 'dry_run' : RESTORE_STATUS };
  },
}));

vi.mock('@/lib/epistemic/server-archive-restore', () => ({
  ServerArchiveRestoreGateway: class {},
}));

const { POST } = await import('../restore/route');

function request(over: { headers?: Record<string, string | null>; bytes?: number } = {}) {
  const h: Record<string, string | null> = {
    authorization: 'Bearer t',
    'x-argus-target-account': USER_ID,
    'content-length': '1024',
    ...over.headers,
  };
  return {
    headers: { get: (k: string) => h[k.toLowerCase()] ?? null },
    arrayBuffer: async () => new ArrayBuffer(over.bytes ?? 1024),
  } as never;
}

beforeEach(() => {
  USER = { id: USER_ID };
  restoreArgs = null;
  RESTORE_STATUS = 'restored';
  RESTORE_THROWS = null;
  PARSE_THROWS = null;
  rpcCalls = [];
  RPC_FAILS = false;
});

describe('POST /api/account/restore', () => {
  it('복원 대상은 **아카이브가 아니라 인증된 사용자**다', async () => {
    const res = await POST(request());
    expect(res.status).toBe(200);

    // 아카이브의 source_account_id 는 남의 것(OTHER_ID)이다. 그것이 대상으로
    // 새어 들어가면 남의 계정에 쓰거나 남의 기록을 들이게 된다.
    expect(restoreArgs!.target_account_id).toBe(USER_ID);
    expect(restoreArgs!.target_account_confirmation).toBe(USER_ID);
    expect(JSON.stringify({ t: restoreArgs!.target_account_id, c: restoreArgs!.target_account_confirmation }))
      .not.toContain(OTHER_ID);
  });

  it('대상 계정 확인 헤더가 안 맞으면 파싱조차 하지 않는다', async () => {
    const res = await POST(request({ headers: { 'x-argus-target-account': OTHER_ID } }));
    expect(res.status).toBe(400);
    // 확인 인터록은 클라이언트가 엉뚱한 계정을 가리키는 사고를 막는 자리다.
    expect(restoreArgs, '확인이 어긋났는데 복원기가 돌았습니다').toBeNull();
    expect(rpcCalls).toHaveLength(0);
  });

  it('확인 헤더가 아예 없어도 거절한다 (부재를 일치로 읽지 않는다)', async () => {
    const res = await POST(request({ headers: { 'x-argus-target-account': null } }));
    expect(res.status).toBe(400);
    expect(restoreArgs).toBeNull();
  });

  it('로그인 없이는 아무것도 복원하지 않는다', async () => {
    expect((await POST(request({ headers: { authorization: null } }))).status).toBe(401);
    USER = null;
    expect((await POST(request())).status).toBe(401);
    expect(restoreArgs).toBeNull();
  });

  it('영수증 저장이 실패하면 성공으로 보고하지 않는다', async () => {
    RPC_FAILS = true;
    const res = await POST(request());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.status).toBe('failed');
    expect(body.error_code).toBe('RESTORE_RECEIPT_PERSIST_FAILED');
    // 200 을 주면 데이터는 들어갔는데 그 사실을 아무도 모른다 — 감사도
    // 되돌리기도 불가능해진다.
  });

  it('dry-run 은 200 이지만 **아무 기록도 남기지 않는다**', async () => {
    const res = await POST(request({ headers: { 'x-argus-dry-run': 'true' } }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('dry_run');
    expect(restoreArgs!.dry_run).toBe(true);
    // 미리보기가 흔적을 남기면 그것은 미리보기가 아니다.
    expect(rpcCalls, 'dry-run 이 영수증을 남겼습니다').toHaveLength(0);
  });

  it('실제 복원은 영수증을 남기고, 그 영수증이 사용자와 아카이브를 가리킨다', async () => {
    await POST(request());
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fn).toBe('record_epistemic_restore_receipt');
    expect(rpcCalls[0].args.p_user_id).toBe(USER_ID);
    expect(rpcCalls[0].args.p_archive_id).toBe('arch-1');
    // 출처가 남의 계정이라는 사실 자체는 기록한다 — 대상으로 쓰지 않을 뿐이다.
    expect(rpcCalls[0].args.p_source_account_id).toBe(OTHER_ID);
  });

  it('충돌은 409 로, 실패는 500 으로 구분해서 끝낸다', async () => {
    RESTORE_STATUS = 'conflict';
    expect((await POST(request())).status).toBe(409);
    RESTORE_STATUS = 'failed';
    expect((await POST(request())).status).toBe(500);
  });

  it('깨진 아카이브는 코드만 돌려주고 내부 사정을 흘리지 않는다', async () => {
    PARSE_THROWS = 'ARCHIVE_SIGNATURE_INVALID: key id 3 at offset 91 in /tmp/x';
    const res = await POST(request());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('ARCHIVE_SIGNATURE_INVALID');
    // 경로·오프셋 같은 내부 사정이 나가면 그 자체가 정찰 정보가 된다.
    expect(JSON.stringify(body)).not.toContain('/tmp/x');
    expect(restoreArgs).toBeNull();
  });

  it('읽기 장애는 500 이 아니라 503 이다 (재시도 가능한 실패)', async () => {
    RESTORE_THROWS = 'GATEWAY_READ_FAILED: upstream down';
    expect((await POST(request())).status).toBe(503);
    RESTORE_THROWS = 'RESTORE_FAILED: bad state';
    expect((await POST(request())).status).toBe(500);
  });

  it('본문이 상한을 넘으면 파싱 전에 끝낸다 — 선언과 실제를 둘 다 본다', async () => {
    const big = String(65 * 1024 * 1024);
    expect((await POST(request({ headers: { 'content-length': big } }))).status).toBe(413);
    // content-length 는 거짓말할 수 있다. 실제 바이트도 봐야 한다.
    expect((await POST(request({ bytes: 65 * 1024 * 1024 }))).status).toBe(413);
    expect(restoreArgs).toBeNull();
  });

  it('프로젝트 매핑이 깨졌으면 복원하지 않는다', async () => {
    const bad = Buffer.from(JSON.stringify({ '': 'x' })).toString('base64url');
    const res = await POST(request({ headers: { 'x-argus-project-mapping': bad } }));
    expect(res.status).toBe(400);
    expect(restoreArgs).toBeNull();
  });

  it('정상 매핑은 복원기에 그대로 전달된다', async () => {
    const ok = Buffer.from(JSON.stringify({ 'proj-a': 'proj-b' })).toString('base64url');
    await POST(request({ headers: { 'x-argus-project-mapping': ok } }));
    expect(restoreArgs!.project_mapping).toEqual({ 'proj-a': 'proj-b' });
  });
});
