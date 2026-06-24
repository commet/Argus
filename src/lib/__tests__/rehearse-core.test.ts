/**
 * Rehearse core — simulate a stakeholder's reaction to a plan. Validates the
 * coercion guards and the spine: user-facing copy must frame it as a SIMULATION
 * ("한 가지 가능성"), never a certainty or a verdict on the user.
 */
import { describe, it, expect } from 'vitest';
import {
  rehearseSystemPrompt, buildRehearseUser, coerceRehearse, rehearseToMarkdown,
  REHEARSE_PRESETS, REHEARSE_TOOL_SCHEMA,
} from '@/lib/rehearse-core';

describe('rehearse-core', () => {
  it('system prompt is simulation-framed, non-judgmental, locale-split', () => {
    expect(rehearseSystemPrompt('ko')).not.toBe(rehearseSystemPrompt('en'));
    expect(rehearseSystemPrompt('ko')).toContain('시뮬레이션');
    expect(rehearseSystemPrompt('ko')).toContain('판단하거나');
    expect(rehearseSystemPrompt('en').toLowerCase()).toContain('simulation');
    expect(rehearseSystemPrompt('en').toLowerCase()).toContain('never judge');
  });

  it('has the 4 stakeholder presets', () => {
    expect(Object.keys(REHEARSE_PRESETS).sort()).toEqual(['boss', 'customer', 'investor', 'team']);
    expect(REHEARSE_PRESETS.boss.whoKo).toContain('상사');
  });

  it('tool schema requires first_reaction + concerns', () => {
    expect(REHEARSE_TOOL_SCHEMA.required).toEqual(['first_reaction', 'concerns']);
  });

  it('buildRehearseUser embeds the stakeholder and the plan', () => {
    const u = buildRehearseUser('신입 채용', '나의 상사', 'ko');
    expect(u).toContain('나의 상사');
    expect(u).toContain('신입 채용');
  });

  describe('coerceRehearse', () => {
    const base = { first_reaction: '음, 비용이 걱정인데.', concerns: ['예산', '타이밍'], approval_condition: 'ROI 근거', sharp_question: '왜 지금?' };
    it('passes a valid reaction', () => {
      expect(coerceRehearse(base)).toEqual(base);
    });
    it('rejects when first_reaction or concerns are empty', () => {
      expect(coerceRehearse({ ...base, first_reaction: '' })).toBeNull();
      expect(coerceRehearse({ ...base, concerns: [] })).toBeNull();
      expect(coerceRehearse(null)).toBeNull();
    });
    it('caps concerns at 4 and tolerates missing optional fields', () => {
      const r = coerceRehearse({ first_reaction: 'x', concerns: ['a', 'b', 'c', 'd', 'e'] });
      expect(r!.concerns).toHaveLength(4);
      expect(r!.approval_condition).toBe('');
      expect(r!.sharp_question).toBe('');
    });
  });

  describe('rehearseToMarkdown (spine: framed as simulation)', () => {
    const r = { first_reaction: '비용이 걱정이에요.', concerns: ['예산 초과', '온보딩 여력'], approval_condition: 'ROI 근거 제시', sharp_question: '왜 지금인가요?' };
    it('shows reaction, concerns, approval, question + the simulation disclaimer', () => {
      const md = rehearseToMarkdown(r, '👔 상사', 'ko');
      expect(md).toContain('👔 상사');
      expect(md).toContain('비용이 걱정이에요.');
      expect(md).toContain('예산 초과');
      expect(md).toContain('ROI 근거 제시');
      expect(md).toContain('왜 지금인가요?');
      expect(md).toContain('시뮬레이션'); // honest framing, never presented as certain truth
    });
    it('en carries the simulation disclaimer too', () => {
      expect(rehearseToMarkdown(r, '👔 Boss', 'en').toLowerCase()).toContain('a simulation');
    });
  });
});
