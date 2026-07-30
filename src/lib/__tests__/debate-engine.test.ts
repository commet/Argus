/**
 * debate-engine — the critic's honesty guard. The prompt tells the critic:
 * "If the plan is genuinely solid, do NOT manufacture a weakness — set severity
 * to none." The engine must honor that answer: severity 'none' emits NO
 * challenge, never a coerced 'important' one.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/llm', () => ({ callLLMJson: vi.fn() }));
vi.mock('@/lib/persona-prompt', () => ({ sanitizeForPrompt: (t: string) => t }));
vi.mock('@/lib/i18n', () => ({ getCurrentLanguage: () => 'en' }));

import { callLLMJson } from '@/lib/llm';
import { runDebateRound, type DebateInput } from '@/lib/debate-engine';

const mockCall = vi.mocked(callLLMJson);

const input: DebateInput = {
  problemText: 'Ship the migration this quarter',
  stage1Results: [{ agentName: 'A', agentRole: 'analyst', framework: null, result: 'looks solid' }],
  criticName: 'Critic',
  criticExpertise: 'risk analysis',
  locale: 'en',
};

describe('runDebateRound', () => {
  beforeEach(() => mockCall.mockReset());

  it("severity 'none' emits NO challenge (honors the don't-manufacture-weaknesses guard)", async () => {
    mockCall.mockResolvedValue({
      challenge: 'no critical blind spot', target_agent: '', weakest_claim: '',
      alternative_view: '', severity: 'none',
    });
    expect(await runDebateRound(input)).toBeNull();
  });

  it('a real severity passes through unchanged', async () => {
    mockCall.mockResolvedValue({
      challenge: 'the rollback path is untested', target_agent: 'A',
      weakest_claim: 'zero-downtime claim', alternative_view: 'stage it', severity: 'critical',
    });
    const out = await runDebateRound(input);
    expect(out?.severity).toBe('critical');
    expect(out?.challenge).toBe('the rollback path is untested');
  });

  it('an unknown/garbled severity still falls back to important (defensive default)', async () => {
    mockCall.mockResolvedValue({
      challenge: 'x', target_agent: 'A', weakest_claim: 'y', alternative_view: 'z', severity: 'sorta',
    });
    expect((await runDebateRound(input))?.severity).toBe('important');
  });

  it('returns null without calling the LLM when there are no stage-1 results', async () => {
    expect(await runDebateRound({ ...input, stage1Results: [] })).toBeNull();
    expect(mockCall).not.toHaveBeenCalled();
  });
});
