/**
 * Recast core — split a plan into AI/human/both steps (the judgment ladder).
 * Validates coercion and that the spine shows where HUMAN judgment must stay.
 */
import { describe, it, expect } from 'vitest';
import {
  recastSystemPrompt, coerceRecast, recastToMarkdown, RECAST_TOOL_SCHEMA,
} from '@/lib/recast-core';

describe('recast-core', () => {
  it('system prompt carries the judgment-ladder thesis + non-judgment', () => {
    expect(recastSystemPrompt('ko')).toContain('판단');
    expect(recastSystemPrompt('ko')).toContain('사용자를 판단하지');
    expect(recastSystemPrompt('en').toLowerCase()).toContain('judgment');
    expect(recastSystemPrompt('en').toLowerCase()).toContain("don't judge the user");
  });

  it('tool schema requires steps with task + actor enum', () => {
    expect(RECAST_TOOL_SCHEMA.required).toEqual(['steps']);
    expect(RECAST_TOOL_SCHEMA.properties.steps.items.properties.actor.enum).toEqual(['ai', 'human', 'both']);
  });

  describe('coerceRecast', () => {
    it('keeps valid steps, defaults bad actor to both, caps at 6', () => {
      const r = coerceRecast({ steps: [
        { task: '데이터 수집', actor: 'ai', why: '기계적' },
        { task: '채용 결정', actor: 'human', why: '책임이 걸림' },
        { task: '초안 작성', actor: 'xxx', why: '' },
        ...Array.from({ length: 5 }, (_, i) => ({ task: `s${i}`, actor: 'both' })),
      ] });
      expect(r).toHaveLength(6);
      expect(r![0].actor).toBe('ai');
      expect(r![1].actor).toBe('human');
      expect(r![2].actor).toBe('both'); // bad actor → both
    });
    it('returns null when no valid steps', () => {
      expect(coerceRecast({ steps: [] })).toBeNull();
      expect(coerceRecast({ steps: [{ actor: 'ai' }] })).toBeNull(); // no task
      expect(coerceRecast(null)).toBeNull();
    });
  });

  describe('recastToMarkdown', () => {
    it('renders glyphs and names where human judgment stays', () => {
      const md = recastToMarkdown([
        { task: '데이터 수집', actor: 'ai', why: '기계적' },
        { task: '채용 여부 결정', actor: 'human', why: '책임' },
        { task: '공고 초안', actor: 'both', why: 'AI 초안+검토' },
      ], 'ko');
      expect(md).toContain('🤖 데이터 수집');
      expect(md).toContain('🧠 채용 여부 결정');
      expect(md).toContain('🤝 공고 초안');
      expect(md).toContain('판단할 자리 (1곳)'); // exactly one human step
    });
  });
});
