import { describe, expect, it, vi } from 'vitest';
import { appendProjectSemanticEvents } from '@/lib/semantic-ledger-gateway';
import { buildSemanticWebCommand } from '@/lib/semantic-web';

const userId = 'user-1';
const projectId = '4c8fe7bf-820a-4d8d-9721-8a7e3f4a4112';

function query(result: { data: unknown; error: unknown }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(resolve(result)),
  };
  return chain;
}

function sealEvents() {
  const built = buildSemanticWebCommand({
    project_id: projectId,
    recorded_at: '2026-07-14T00:00:00.000Z',
    command: {
      kind: 'seal', command_id: 'seal-1', judgment_id: 'judgment-1',
      return_contract_id: 'return-1', statement: 'Keep the current price.',
      review_at: '2026-09-01T00:00:00.000Z', review_question: 'Did conversion stay above 3.2%?',
    },
  });
  if (!built.ok) throw new Error(built.code);
  return built.events;
}

describe('project semantic ledger gateway', () => {
  it('preflights and returns the canonical stream after an atomic append', async () => {
    const events = sealEvents();
    const reads = [
      { data: [], error: null },
      { data: events.map((event) => ({ event })), error: null },
    ];
    const rpc = vi.fn().mockResolvedValue({ data: [{ duplicate: false }], error: null });
    const admin = { from: vi.fn(() => query(reads.shift()!)), rpc };

    await expect(appendProjectSemanticEvents(admin, userId, projectId, events)).resolves.toEqual({
      ok: true,
      events,
      receipt: [{ duplicate: false }],
    });
    expect(rpc).toHaveBeenCalledWith('append_project_semantic_events', {
      p_user_id: userId,
      p_project_id: projectId,
      p_events: events,
    });
  });

  it('refuses an invalid candidate before calling the database', async () => {
    const rpc = vi.fn();
    const admin = { from: vi.fn(() => query({ data: [], error: null })), rpc };
    const invalid = [{ ...sealEvents()[0], statement: '' }];

    const result = await appendProjectSemanticEvents(admin, userId, projectId, invalid as never);
    expect(result).toMatchObject({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('surfaces a project-pointer conflict without hiding it as a generic append failure', async () => {
    const events = sealEvents();
    const admin = {
      from: vi.fn(() => query({ data: [], error: null })),
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'SEMANTIC_JUDGMENT_CONFLICT' } }),
    };

    await expect(appendProjectSemanticEvents(admin, userId, projectId, events)).resolves.toEqual({
      ok: false,
      code: 'SEMANTIC_JUDGMENT_CONFLICT',
    });
  });
});
