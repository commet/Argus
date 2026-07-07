import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Handoff } from '@/stores/types';

/**
 * useHandoffStore is the transient step-to-step carrier (decompose→recast→…),
 * consumed once on mount — if it drops or fails to clear, context is silently
 * lost between steps. We assert set/clear and that a step transition is tracked.
 */

const trackSpy = vi.fn();
vi.mock('@/lib/analytics', () => ({ track: (...a: unknown[]) => trackSpy(...a) }));

import { useHandoffStore } from '../useHandoffStore';

const sample = { from: 'reframe', to: 'recast', data: { any: 1 } } as unknown as Handoff;

beforeEach(() => {
  useHandoffStore.setState({ handoff: null });
  trackSpy.mockClear();
});

describe('useHandoffStore', () => {
  it('starts empty', () => {
    expect(useHandoffStore.getState().handoff).toBeNull();
  });

  it('setHandoff stores the payload and records a step_transition event', () => {
    useHandoffStore.getState().setHandoff(sample);
    expect(useHandoffStore.getState().handoff).toBe(sample);
    expect(trackSpy).toHaveBeenCalledWith('step_transition', expect.objectContaining({ from: 'reframe', from_label: 'Set the Heading' }));
  });

  it('falls back to the raw step name in the label when the step is unknown', () => {
    useHandoffStore.getState().setHandoff({ ...sample, from: 'mystery' } as Handoff);
    expect(trackSpy).toHaveBeenCalledWith('step_transition', { from: 'mystery', from_label: 'mystery' });
  });

  it('clearHandoff resets to null (consumed-on-mount contract)', () => {
    useHandoffStore.getState().setHandoff(sample);
    useHandoffStore.getState().clearHandoff();
    expect(useHandoffStore.getState().handoff).toBeNull();
  });
});
