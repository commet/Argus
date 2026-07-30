// @vitest-environment jsdom
/**
 * 한 행이 전부를 인질로 잡지 않는다 (2026-07-30 실측 사망의 핵심).
 *
 * PostgREST의 N행 upsert는 한 문장이다 — 서버가 한 행을 거부하면 N행 전부가
 * 롤백된다. 그래서 남의 계정 행 44건을 실은 브라우저는 자기 계정의 정상 행
 * 2건까지 영구히 백업하지 못했다. 배치 실패 후 한 건씩 재시도하고, 서버가
 * 42501로 확정한 행만 격리하는 것이 수리의 전부다.
 *
 * 이 테스트는 실패 응답을 흉내내지 않는다 — 진짜 supabase 클라이언트 대신
 * 같은 계약(from().upsert())의 스텁을 두고, db.ts가 그 응답에 어떻게 반응하는지만
 * 본다. 검증 대상은 "몇 행이 실제로 서버에 도달했는가"다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { STORAGE_KEYS } from '@/lib/storage';

const RLS = {
  code: '42501',
  message: 'new row violates row-level security policy (USING expression) for table "projects"',
};

/** ids that belong to another account in the fake server. */
let foreignIds = new Set<string>();
let upsertCalls: Array<{ rows: number; ids: string[] }> = [];
let landed: string[] = [];
let remoteRows: Array<{ id: string; updated_at: string }> = [];

vi.mock('@/lib/supabase', () => ({
  getCurrentUserId: vi.fn().mockResolvedValue('me'),
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({ order: () => Promise.resolve({ data: remoteRows, error: null }) }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      upsert: (payload: any) => {
        const rows = Array.isArray(payload) ? payload : [payload];
        const ids = rows.map((r) => String(r.id));
        upsertCalls.push({ rows: rows.length, ids });
        // One statement: any foreign row rolls the whole call back.
        if (ids.some((id) => foreignIds.has(id))) return Promise.resolve({ error: RLS });
        landed.push(...ids);
        return Promise.resolve({ error: null });
      },
    }),
  },
}));

vi.mock('@/lib/logger', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/error-handler', () => ({ handleError: vi.fn() }));

const { loadAndMerge } = await import('@/lib/db');
const { getForeignIds, clearForeignRows } = await import('@/lib/account-scope');

beforeEach(() => {
  localStorage.clear();
  clearForeignRows();
  foreignIds = new Set();
  upsertCalls = [];
  landed = [];
  remoteRows = [];
});

function seedLocal(ids: string[]) {
  localStorage.setItem(
    STORAGE_KEYS.PROJECTS,
    JSON.stringify(ids.map((id) => ({ id, name: id, updated_at: '2026-07-30T00:00:00.000Z' }))),
  );
}

describe('남의 계정 행이 섞인 배치', () => {
  it('거부된 행만 남기고 내 행은 전부 서버에 도달한다', async () => {
    seedLocal(['mine-1', 'theirs-1', 'theirs-2', 'mine-2']);
    foreignIds = new Set(['theirs-1', 'theirs-2']);

    await loadAndMerge('projects', STORAGE_KEYS.PROJECTS);

    expect(landed.sort()).toEqual(['mine-1', 'mine-2']);
    expect([...getForeignIds('projects')].sort()).toEqual(['theirs-1', 'theirs-2']);
    // 배치 1회 + 개별 4회. 배치만 던지고 끝냈다면 landed는 비어 있었다.
    expect(upsertCalls[0].rows).toBe(4);
    expect(upsertCalls.length).toBe(5);
  });

  it('두 번째 로드에서는 격리된 행을 다시 시도하지 않는다 (무한 실패 종료)', async () => {
    seedLocal(['mine-1', 'theirs-1']);
    foreignIds = new Set(['theirs-1']);
    await loadAndMerge('projects', STORAGE_KEYS.PROJECTS);

    remoteRows = [{ id: 'mine-1', updated_at: '2026-07-30T00:00:00.000Z' }];
    upsertCalls = [];
    landed = [];
    await loadAndMerge('projects', STORAGE_KEYS.PROJECTS);

    // 올릴 것이 없다 → 쓰기 시도 0회. 수리 전에는 매 로드마다 같은 거부가 반복됐다.
    expect(upsertCalls).toEqual([]);
  });

  it('RLS가 아닌 실패는 격리하지 않는다 — 그건 재시도해야 하는 진짜 실패다', async () => {
    seedLocal(['mine-1']);
    const { supabase } = await import('@/lib/supabase');
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
      upsert: () => Promise.resolve({ error: { code: 'PGRST204', message: "Could not find the 'x' column" } }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await loadAndMerge('projects', STORAGE_KEYS.PROJECTS);
    expect([...getForeignIds('projects')]).toEqual([]);
  });
});
