/**
 * 버려진 익명 항해 청소 — **동작** 테스트.
 *
 * 이 저장소에서 사용자 콘텐츠를 지우는 크론은 이것 하나다. 틀리면 되돌릴 수
 * 없고, 지워진 쪽은 자기 것이 사라졌다는 사실조차 모른다(그 항해에 닿을 수
 * 있는 토큰이 이미 없다). 그래서 응답이 아니라 **실제로 무엇이 지워졌는지**를
 * 본다.
 *
 * 고정하는 것 다섯:
 *
 *  1. **기본은 예행이다.** 스위치와 `?live=1` 이 **둘 다** 있어야 지운다.
 *     한 손만으로 열리면 예행 보고를 읽기도 전에 실계정이 사라진다.
 *  2. **영구 계정은 범위 밖이다.** 후보에도 들지 않고, 지우지도 않는다.
 *  3. **지우기 직전에 신분을 다시 읽는다.** 목록을 뜬 뒤 가입했으면 그 id 는
 *     더 이상 익명이 아니고, 지우면 실사용자의 작업이 날아간다.
 *  4. **전부 아니면 아무것도.** 표 하나가 실패하면 신분을 지우지 않는다 —
 *     지워진 신분 아래 남은 행은 누구도 지울 수 없는 고아가 된다.
 *  5. **살아 있는 항해는 로그인이 오래됐다고 버려진 것이 아니다.** 다른 탭에서
 *     쓰이고 있는 작업의 최신 시각이 인증 시각을 이긴다.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { USER_DATA_TABLES } from '@/lib/user-data-tables';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
process.env.ANON_RETENTION_DAYS = '90';
process.env.ANON_CLEANUP_MAX_PER_RUN = '2';

type Op = [string, unknown?, unknown?];
interface Query { table: string; ops: Op[] }

const NOW = new Date('2026-08-11T00:00:00.000Z');
const OLD = '2026-01-01T00:00:00.000Z'; // 컷오프보다 훨씬 이전
const FRESH = '2026-08-10T00:00:00.000Z';

interface FakeUser { id: string; is_anonymous?: boolean; last_sign_in_at?: string; created_at?: string; updated_at?: string }

let USERS: FakeUser[] = [];
let LIST_ERROR: { message: string } | null = null;
/** getUserById 가 돌려줄 신분 (지우기 직전 재확인) — 없으면 USERS 에서 찾는다. */
let FRESH_USER: Record<string, FakeUser | null> = {};
let AUTHORED: Record<string, string | undefined> = {};
let DELETE_FAILS: { table: string; user: string } | null = null;
let DELETED_USERS: string[] = [];
let deletes: Query[] = [];

vi.mock('@/lib/server-events', () => ({ logServerEvent: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      admin: {
        listUsers: async () => (LIST_ERROR ? { data: null, error: LIST_ERROR } : { data: { users: USERS }, error: null }),
        getUserById: async (id: string) => ({
          data: { user: id in FRESH_USER ? FRESH_USER[id] : USERS.find((u) => u.id === id) ?? null },
        }),
        deleteUser: async (id: string) => {
          DELETED_USERS.push(id);
          return { error: null };
        },
      },
    },
    from(table: string) {
      const record: Query = { table, ops: [] };
      const q: Record<string, unknown> = {
        then(resolve: (v: unknown) => unknown) {
          const isDelete = record.ops.some(([op]) => op === 'delete');
          if (isDelete) {
            deletes.push(record);
            const user = record.ops.find(([op, col]) => op === 'eq' && col === 'user_id')?.[2] as string;
            if (DELETE_FAILS && DELETE_FAILS.table === table && DELETE_FAILS.user === user) {
              return Promise.resolve({ count: null, error: { message: 'permission denied' } }).then(resolve);
            }
            return Promise.resolve({ count: 1, error: null }).then(resolve);
          }
          // 활동 조회
          const user = record.ops.find(([op, col]) => op === 'eq' && col === 'user_id')?.[2] as string;
          const ts = AUTHORED[`${user}:${table}`] ?? AUTHORED[user];
          return Promise.resolve({ data: ts ? [{ updated_at: ts }] : [] }).then(resolve);
        },
      };
      for (const name of ['select', 'delete', 'eq', 'order', 'limit']) {
        q[name] = (...args: unknown[]) => {
          record.ops.push([name, ...args] as Op);
          return q;
        };
      }
      return q;
    },
  }),
}));

const { GET } = await import('../route');

const request = (search = '') =>
  ({
    url: `https://argus.voyage/api/cron/anon-cleanup${search}`,
    headers: { get: (k: string) => (k.toLowerCase() === 'authorization' ? 'Bearer secret-1' : null) },
  }) as never;

const anon = (id: string, seen: string): FakeUser => ({ id, is_anonymous: true, last_sign_in_at: seen, created_at: seen, updated_at: seen });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.CRON_SECRET = 'secret-1';
  process.env.ANON_CLEANUP_ENABLED = 'true';
  USERS = [];
  LIST_ERROR = null;
  FRESH_USER = {};
  AUTHORED = {};
  DELETE_FAILS = null;
  DELETED_USERS = [];
  deletes = [];
});

describe('GET /api/cron/anon-cleanup', () => {
  it('관문이 닫혀 있으면 목록조차 뜨지 않는다', async () => {
    delete process.env.CRON_SECRET;
    const res = await GET({
      url: 'https://argus.voyage/api/cron/anon-cleanup?live=1',
      headers: { get: () => 'Bearer undefined' },
    } as never);
    expect(res.status).toBe(401);
    expect(DELETED_USERS).toHaveLength(0);
    expect(deletes).toHaveLength(0);
  });

  it('스위치와 ?live=1 **둘 다** 있어야 지운다 — 한 손으로는 안 열린다', async () => {
    USERS = [anon('anon-old', OLD)];

    process.env.ANON_CLEANUP_ENABLED = 'true';
    let body = await (await GET(request())).json(); // live 인자 없음
    expect(body.dry_run).toBe(true);
    expect(body.would_erase).toBe(1);
    expect(body.erased).toBe(0);
    expect(body.reason).toContain('live=1');

    process.env.ANON_CLEANUP_ENABLED = '';
    body = await (await GET(request('?live=1'))).json(); // 스위치 없음
    expect(body.dry_run).toBe(true);
    expect(body.reason).toContain('ANON_CLEANUP_ENABLED');

    // 예행 두 번 동안 아무것도 지워지지 않았다.
    expect(DELETED_USERS, '예행인데 신분을 지웠습니다').toHaveLength(0);
    expect(deletes, '예행인데 행을 지웠습니다').toHaveLength(0);
  });

  it('영구 계정은 후보에도 들지 않는다', async () => {
    USERS = [
      { id: 'permanent', is_anonymous: false, last_sign_in_at: OLD, created_at: OLD, updated_at: OLD },
      anon('anon-old', OLD),
    ];
    const body = await (await GET(request('?live=1'))).json();
    expect(body.anonymous_identities).toBe(1);
    expect(DELETED_USERS).toEqual(['anon-old']);
  });

  it('아직 쓰이고 있는 항해는 로그인이 오래돼도 버려진 것이 아니다', async () => {
    USERS = [anon('anon-writing', OLD)];
    AUTHORED['anon-writing'] = FRESH; // 다른 탭에서 방금 저장된 작업
    const body = await (await GET(request('?live=1'))).json();
    expect(body.abandoned).toBe(0);
    expect(DELETED_USERS).toHaveLength(0);
  });

  it('지우기 직전에 신분을 다시 읽는다 — 그 사이 가입했으면 건드리지 않는다', async () => {
    USERS = [anon('anon-signed-up', OLD)];
    // 목록을 뜬 뒤 실계정이 됐다.
    FRESH_USER['anon-signed-up'] = { id: 'anon-signed-up', is_anonymous: false };
    const body = await (await GET(request('?live=1'))).json();

    expect(DELETED_USERS, '실계정이 된 신분을 지웠습니다').toHaveLength(0);
    expect(deletes, '실계정이 된 사용자의 행을 지웠습니다').toHaveLength(0);
    expect(body.erased).toBe(0);
    expect(body.failed).toBe(1);
  });

  it('등재된 모든 사용자 표를 본인 것으로만 좁혀 지운다', async () => {
    USERS = [anon('anon-old', OLD)];
    await GET(request('?live=1'));

    const swept = deletes.map((d) => d.table);
    const missed = USER_DATA_TABLES.filter((t) => !swept.includes(t));
    // 빠진 표가 있으면 그 사람의 행은 지워진 신분 아래 영영 남는다.
    expect(missed, `청소에서 빠진 표입니다:\n${missed.join('\n')}`).toEqual([]);
    const unscoped = deletes.filter((d) => !d.ops.some(([op, col, val]) => op === 'eq' && col === 'user_id' && val === 'anon-old'));
    expect(unscoped.map((d) => d.table), '소유 필터 없이 삭제했습니다').toEqual([]);
  });

  it('표 하나가 실패하면 신분을 지우지 않는다 — 고아 행을 만들지 않는다', async () => {
    USERS = [anon('anon-old', OLD)];
    DELETE_FAILS = { table: USER_DATA_TABLES[1], user: 'anon-old' };
    const body = await (await GET(request('?live=1'))).json();

    expect(DELETED_USERS, '행 삭제가 실패했는데 신분을 지웠습니다').toHaveLength(0);
    expect(body.failed).toBe(1);
    expect(body.erased).toBe(0);
    // 다음 실행에 다시 시도할 수 있게 남겨 둔다 (실패는 유실이 아니다).
  });

  it('한 번에 지우는 수를 상한으로 묶는다', async () => {
    USERS = [anon('a1', OLD), anon('a2', OLD), anon('a3', OLD)];
    const body = await (await GET(request('?live=1'))).json();
    expect(body.abandoned).toBe(3);
    expect(body.would_erase).toBe(2); // ANON_CLEANUP_MAX_PER_RUN
    expect(DELETED_USERS).toHaveLength(2);
  });

  it('목록을 못 뜨면 500 이고 아무것도 지우지 않는다', async () => {
    LIST_ERROR = { message: 'auth admin down' };
    const res = await GET(request('?live=1'));
    expect(res.status).toBe(500);
    expect(DELETED_USERS).toHaveLength(0);
    expect(deletes).toHaveLength(0);
  });
});
