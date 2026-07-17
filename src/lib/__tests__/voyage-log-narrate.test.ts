/**
 * Chronicler narration (Phase 5) — verifies the prose layer merges only the
 * interpretive significance. The LLM must never author why_abandoned (E-B3).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/llm', () => ({ callLLMJson: vi.fn() }));

import { callLLMJson } from '@/lib/llm';
import { narrateWaypoint, isNarratable } from '@/lib/voyage-log-narrate';
import type { Waypoint } from '@/stores/types';

const mockCall = vi.mocked(callLLMJson);

const courseChange = (): Waypoint => ({
  id: 'w1', checkpoint_id: 'c2', type: 'course_change', headline: '이탈의 진짜 원인은?',
  trigger: '질문: 누가 결정? → CFO', created_at: 'x',
  alternatives: [
    { label: '챗봇 직접 제작', why_abandoned: '', taken: false },
    { label: '이탈 원인 분석', why_abandoned: '', taken: true },
  ],
});

describe('narrateWaypoint', () => {
  beforeEach(() => mockCall.mockReset());

  it('attaches significance but ignores even a model-supplied why_abandoned', async () => {
    mockCall.mockResolvedValue({ significance: 'ROI 근거 없이는 예산 승인 불가', why_abandoned: '이탈 원인 미검증' });
    const out = await narrateWaypoint({
      waypoint: courseChange(), problemText: '경쟁사처럼 챗봇', curRealQuestion: '이탈 원인?', prevRealQuestion: '챗봇 만들까?', locale: 'ko',
    });
    expect(out?.significance).toBe('ROI 근거 없이는 예산 승인 불가');
    expect(out).not.toHaveProperty('alternatives');

    const options = mockCall.mock.calls[0][1];
    expect(options.shape).toEqual({ significance: 'string' });
    expect(options.system).not.toContain('why_abandoned');
  });

  it('skips non-narratable types without calling the LLM', async () => {
    const departure: Waypoint = { id: 'd', checkpoint_id: 'c1', type: 'departure', headline: 'x', created_at: 'x' };
    const out = await narrateWaypoint({ waypoint: departure, problemText: 'p', locale: 'ko' });
    expect(out).toBeNull();
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('reef gets significance but no alternatives merge', async () => {
    mockCall.mockResolvedValue({ significance: '가정이 검증되어 위험이 줄었다' });
    const reef: Waypoint = { id: 'r', checkpoint_id: 'c3', type: 'reef', headline: '챗봇이 이탈을 막는다', created_at: 'x' };
    const out = await narrateWaypoint({ waypoint: reef, problemText: 'p', locale: 'ko' });
    expect(out?.significance).toBe('가정이 검증되어 위험이 줄었다');
  });

  it('returns null when the LLM yields nothing usable (no enrichment forced)', async () => {
    mockCall.mockResolvedValue({ significance: '' });
    const out = await narrateWaypoint({ waypoint: courseChange(), problemText: 'p', locale: 'ko' });
    expect(out).toBeNull();
  });

  it('isNarratable gates to turns with a "why"', () => {
    expect(isNarratable('course_change')).toBe(true);
    expect(isNarratable('reef')).toBe(true);
    expect(isNarratable('headwind')).toBe(true);
    expect(isNarratable('departure')).toBe(false);
    expect(isNarratable('anchorage')).toBe(false);
    expect(isNarratable('sighting')).toBe(false);
  });
});
