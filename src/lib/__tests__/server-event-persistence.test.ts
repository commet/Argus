import { beforeEach, describe, expect, it, vi } from 'vitest';

const insert = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({ insert })),
  })),
}));

import { persistServerEvent } from '../server-events';

describe('persistServerEvent', () => {
  beforeEach(() => {
    insert.mockReset();
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role');
  });

  it('waits for a successful analytics insert and reports success', async () => {
    insert.mockResolvedValue({ error: null });

    await expect(persistServerEvent('return_reminder_sent', {
      project_id: 'project-1',
      channel: 'email',
    }, { path: '/api/cron/checkin-due' })).resolves.toBe(true);

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      event_name: 'return_reminder_sent',
      properties: expect.objectContaining({
        project_id: 'project-1',
        channel: 'email',
        server: true,
      }),
      session_id: 'server',
    }));
  });

  it('fails quietly but truthfully when the insert is rejected', async () => {
    insert.mockResolvedValue({ error: { message: 'disk unavailable' } });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(persistServerEvent('return_reminder_sent')).resolves.toBe(false);
  });
});
