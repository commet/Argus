import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  tokenUser: { id: 'user-1' } as { id: string } | null,
  recordError: null as { message: string } | null,
  parseSpy: vi.fn().mockResolvedValue({ manifest: { archive_id: 'archive:1', source_account_id: 'source:1' } }),
  restoreSpy: vi.fn().mockResolvedValue({
    restore_id: 'restore:1', status: 'restored', source_account_id: 'source:1', target_account_id: 'user-1',
  }),
  rpcSpy: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (_url: string, key: string) => key === 'svc-key'
    ? { rpc: (...args: unknown[]) => state.rpcSpy(...args).then(() => ({ data: null, error: state.recordError })) }
    : { auth: { getUser: () => Promise.resolve({ data: { user: state.tokenUser }, error: state.tokenUser ? null : { message: 'bad' } }) } },
}));
vi.mock('@/lib/epistemic/server-judgment-archive', () => ({ parseJudgmentArchive: state.parseSpy }));
vi.mock('@/lib/epistemic/archive-restore', () => ({ restoreJudgmentArchive: state.restoreSpy }));
vi.mock('@/lib/epistemic/server-archive-restore', () => ({ ServerArchiveRestoreGateway: class {} }));

import { POST } from '../route';

function request(headers: Record<string, string> = {}) {
  return new Request('https://argus.voyage/api/account/restore', {
    method: 'POST', body: new Uint8Array([1, 2, 3]),
    headers: { authorization: 'Bearer good', 'x-argus-target-account': 'user-1', ...headers },
  }) as never;
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.test');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'svc-key');
  state.tokenUser = { id: 'user-1' };
  state.recordError = null;
  state.parseSpy.mockClear(); state.restoreSpy.mockClear(); state.rpcSpy.mockReset().mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/account/restore', () => {
  it('requires an authenticated exact target confirmation', async () => {
    const noAuth = new Request('https://argus.voyage/api/account/restore', { method: 'POST' }) as never;
    expect((await POST(noAuth)).status).toBe(401);
    expect((await POST(request({ 'x-argus-target-account': 'someone-else' }))).status).toBe(400);
    expect(state.parseSpy).not.toHaveBeenCalled();
  });

  it('passes a decoded project mapping through dry-run without persisting a receipt', async () => {
    const mapping = Buffer.from(JSON.stringify({ source: 'target' })).toString('base64url');
    const response = await POST(request({
      'x-argus-project-mapping': mapping, 'x-argus-dry-run': 'true',
    }));
    expect(response.status).toBe(200);
    expect(state.restoreSpy).toHaveBeenCalledWith(expect.objectContaining({
      target_account_id: 'user-1', target_account_confirmation: 'user-1',
      project_mapping: { source: 'target' }, dry_run: true,
    }));
    expect(state.rpcSpy).not.toHaveBeenCalled();
  });

  it('does not report success when the durable restore receipt cannot be persisted', async () => {
    state.recordError = { message: 'db unavailable' };
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ status: 'failed', error_code: 'RESTORE_RECEIPT_PERSIST_FAILED' });
  });

  it('rejects malformed mappings and oversized declared bodies before parsing', async () => {
    expect((await POST(request({ 'x-argus-project-mapping': '!!!' }))).status).toBe(400);
    expect((await POST(request({ 'content-length': String(65 * 1024 * 1024) }))).status).toBe(413);
  });
});
