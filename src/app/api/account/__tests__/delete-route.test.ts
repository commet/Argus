/**
 * 계정 삭제 — **동작** 테스트.
 *
 * 소거 커버리지는 지금까지 **정적으로만** 확인됐다. `erasure-coverage.test.ts`
 * 가 마이그레이션에서 사용자 테이블을 뽑아 `USER_DATA_TABLES` 와 대조하지만,
 * 그것은 **목록이 맞는가**를 볼 뿐 **그 목록대로 실제로 지우는가**는 못 본다.
 *
 * 이 파일이 고정하는 것 넷. 넷 다 소스를 읽어서는 확신할 수 없다:
 *
 *  1. **목록의 모든 테이블이 실제로 삭제된다.** 루프가 조용히 일부를 건너뛰면
 *     영수증에는 숫자가 찍히는데 행은 남는다.
 *  2. **모든 삭제가 `user_id` 로 좁혀진다.** 한 곳이라도 빠지면 그 테이블이
 *     통째로 날아간다 — 이 리포에서 가장 비싼 단일 실수다.
 *  3. **신원은 모든 행이 지워진 뒤에만 지운다.** 순서가 뒤집히면 부분 실패가
 *     삭제된 신원 아래 데이터를 고아로 남기고, 그것은 복구할 수 없다.
 *  4. **남의 객체 경로가 섞이면 아무것도 지우지 않는다.** locator 검사가
 *     느슨해지면 다른 계정의 파일이 지워진다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { USER_DATA_TABLES } from '@/lib/user-data-tables';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';

const USER_ID = 'user-1';

let USER: { id: string } | null = { id: USER_ID };
/** 삭제가 호출된 테이블과, 그때 소유 필터가 걸렸는지. */
let deletes: Array<{ table: string; scopedTo: string | null }> = [];
/** 이 테이블의 삭제가 실패해야 한다. */
let FAILING_TABLE: string | null = null;
let ARTIFACT_ROWS: Array<{ object_locator?: string; staging_locator?: string }> = [];
let ARTIFACT_READ_FAILS = false;
let STORAGE_REMOVE_FAILS = false;
let IDENTITY_DELETE_FAILS = false;
let removedObjects: string[] = [];
let identityDeleted = false;

vi.mock('@/lib/server-events', () => ({ logServerEvent: () => {} }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: USER }, error: USER ? null : { message: 'bad token' } }),
      admin: {
        deleteUser: async () => {
          if (IDENTITY_DELETE_FAILS) return { error: { message: 'identity delete failed' } };
          identityDeleted = true;
          return { error: null };
        },
      },
    },
    storage: {
      from: () => ({
        remove: async (keys: string[]) => {
          if (STORAGE_REMOVE_FAILS) return { error: { message: 'remove failed' } };
          removedObjects.push(...keys);
          return { error: null };
        },
      }),
    },
    from(table: string) {
      let scoped: string | null = null;
      let mode: 'select' | 'delete' = 'select';
      const q: Record<string, unknown> = {
        select: () => q,
        delete: () => {
          mode = 'delete';
          return q;
        },
        eq(col: string, val: unknown) {
          if (col === 'user_id') scoped = String(val);
          if (mode === 'delete') {
            deletes.push({ table, scopedTo: scoped });
            return Promise.resolve(
              FAILING_TABLE === table
                ? { count: null, error: { message: `cannot delete ${table}` } }
                : { count: 1, error: null },
            );
          }
          // select 경로 (아티팩트 기술자 조회)
          return Promise.resolve(
            ARTIFACT_READ_FAILS
              ? { data: null, error: { message: 'descriptor read failed' } }
              : { data: ARTIFACT_ROWS, error: null },
          );
        },
      };
      return q;
    },
  }),
}));

const { POST } = await import('../delete/route');

const request = (auth: string | null = 'Bearer token-1') =>
  ({ headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? auth : null) } }) as never;

beforeEach(() => {
  USER = { id: USER_ID };
  deletes = [];
  FAILING_TABLE = null;
  ARTIFACT_ROWS = [];
  ARTIFACT_READ_FAILS = false;
  STORAGE_REMOVE_FAILS = false;
  IDENTITY_DELETE_FAILS = false;
  removedObjects = [];
  identityDeleted = false;
});

describe('POST /api/account/delete', () => {
  it('로그인 없이는 아무것도 지우지 않는다', async () => {
    expect((await POST(request(null))).status).toBe(401);
    USER = null;
    expect((await POST(request())).status).toBe(401);
    expect(deletes).toHaveLength(0);
    expect(identityDeleted).toBe(false);
  });

  it('등재된 모든 테이블을 실제로 지운다 — 목록이 맞는 것과 지우는 것은 다른 사실이다', async () => {
    const res = await POST(request());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    const touched = new Set(deletes.map((d) => d.table));
    const missed = USER_DATA_TABLES.filter((t) => !touched.has(t));
    expect(missed, `삭제되지 않은 테이블입니다:\n${missed.join('\n')}`).toEqual([]);
    // 영수증도 테이블마다 있어야 한다 — 숫자가 없으면 무엇이 지워졌는지 못 보인다.
    for (const t of USER_DATA_TABLES) expect(body.receipt[t], t).toBeDefined();
  });

  it('모든 삭제가 본인 것으로 좁혀진다 — 하나라도 빠지면 테이블이 통째로 날아간다', async () => {
    await POST(request());
    const unscoped = deletes.filter((d) => d.scopedTo !== USER_ID).map((d) => d.table);
    expect(unscoped, `소유 필터 없이 삭제한 테이블입니다:\n${unscoped.join('\n')}`).toEqual([]);
  });

  it('한 테이블이라도 실패하면 신원을 지우지 않는다 (고아 데이터 방지)', async () => {
    FAILING_TABLE = USER_DATA_TABLES[2];
    const res = await POST(request());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.identityDeleted).toBe(false);
    // 신원을 먼저 지우면 남은 행은 주인을 잃고, 그것은 복구할 수 없다.
    expect(identityDeleted, '행 삭제가 실패했는데 신원이 지워졌습니다').toBe(false);
    expect(String(body.receipt[USER_DATA_TABLES[2]])).toContain('error');
  });

  it('남의 객체 경로가 섞이면 아무것도 지우지 않는다', async () => {
    ARTIFACT_ROWS = [{ object_locator: `${USER_ID}/mine.bin` }, { object_locator: 'other-user/theirs.bin' }];
    const res = await POST(request());
    const body = await res.json();

    expect(body.ok).toBe(false);
    expect(String(body.receipt['storage:epistemic-artifacts'])).toContain('invalid cross-account');
    // 내 것만 골라 지우고 진행하면 "일부는 지웠다"가 되어 재시도가 불완전해진다.
    expect(removedObjects, '교차 계정 경로를 보고도 객체를 지웠습니다').toHaveLength(0);
    expect(deletes, '객체 소거가 불완전한데 행을 지웠습니다').toHaveLength(0);
    expect(identityDeleted).toBe(false);
  });

  it('객체 소거가 실패하면 행도 신원도 건드리지 않고 재시도 가능한 상태로 둔다', async () => {
    ARTIFACT_ROWS = [{ object_locator: `${USER_ID}/a.bin` }];
    STORAGE_REMOVE_FAILS = true;
    const body = await (await POST(request())).json();

    expect(body.ok).toBe(false);
    expect(deletes).toHaveLength(0);
    expect(identityDeleted).toBe(false);
    // 건너뛴 이유가 영수증에 남아야 한다 — "0건 지움"과 "안 지움"은 다른 사실이다.
    expect(String(body.receipt[USER_DATA_TABLES[0]])).toContain('skipped');
  });

  it('기술자 조회가 실패해도 같은 규율이다 (읽지 못한 것을 없다고 보지 않는다)', async () => {
    ARTIFACT_READ_FAILS = true;
    const body = await (await POST(request())).json();
    expect(body.ok).toBe(false);
    expect(deletes).toHaveLength(0);
    expect(identityDeleted).toBe(false);
  });

  it('정상 경로에서는 본인 객체를 지우고 개수를 영수증에 적는다', async () => {
    ARTIFACT_ROWS = [
      { object_locator: `${USER_ID}/a.bin`, staging_locator: `${USER_ID}/a.staging` },
      { object_locator: `${USER_ID}/a.bin` }, // 중복은 한 번만
    ];
    const body = await (await POST(request())).json();
    expect(body.ok).toBe(true);
    expect(new Set(removedObjects)).toEqual(new Set([`${USER_ID}/a.bin`, `${USER_ID}/a.staging`]));
    expect(body.receipt['storage:epistemic-artifacts']).toBe(2);
  });

  it('신원 삭제가 실패하면 성공했다고 말하지 않는다', async () => {
    IDENTITY_DELETE_FAILS = true;
    const res = await POST(request());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.identityDeleted).toBe(false);
    expect(String(body.receipt['auth.users'])).toContain('error');
  });
});
