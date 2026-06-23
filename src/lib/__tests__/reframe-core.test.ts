/**
 * Reframe core — the shared brain used by BOTH the webapp and the Telegram bot.
 * Verifies the prompt is intact after extraction and the parser is robust to the
 * ways a model wraps JSON (fences, prose, string-array assumptions).
 */
import { describe, it, expect } from 'vitest';
import {
  reframeSystemPrompt, deeperSuffix, parseReframe, reframeToMarkdown,
  ASSUMPTION_PROMPT_KO, ASSUMPTION_PROMPT_EN,
} from '@/lib/reframe-core';

describe('reframe-core', () => {
  describe('system prompt (single source)', () => {
    it('ko/en select the right canonical prompt', () => {
      expect(reframeSystemPrompt('ko')).toBe(ASSUMPTION_PROMPT_KO);
      expect(reframeSystemPrompt('en')).toBe(ASSUMPTION_PROMPT_EN);
    });
    it('keeps the 4-axis instruction (the brain, not a stub)', () => {
      expect(ASSUMPTION_PROMPT_KO).toContain('4축');
      expect(ASSUMPTION_PROMPT_KO).toContain('hidden_assumptions');
      expect(ASSUMPTION_PROMPT_EN).toContain('4-axis');
      expect(ASSUMPTION_PROMPT_EN).toContain('hidden_assumptions');
    });
    it('deeperSuffix differs by locale and asks for the load-bearing one', () => {
      expect(deeperSuffix('ko')).toContain('하중');
      expect(deeperSuffix('en').toLowerCase()).toContain('load-bearing');
      expect(deeperSuffix('ko')).not.toBe(deeperSuffix('en'));
    });
  });

  describe('parseReframe robustness', () => {
    const obj = {
      surface_task: 'Launch a paid tier',
      hidden_assumptions: [
        { assumption: 'Users will pay', risk_if_false: 'No revenue', axis: 'business' },
        { assumption: 'We can build it', axis: 'feasibility' },
      ],
      reasoning_narrative: 'These gate the whole bet.',
    };

    it('parses clean JSON', () => {
      const r = parseReframe(JSON.stringify(obj));
      expect(r.surface_task).toBe('Launch a paid tier');
      expect(r.hidden_assumptions).toHaveLength(2);
      expect(r.reasoning_narrative).toContain('gate');
    });

    it('parses fenced ```json blocks', () => {
      const r = parseReframe('Here you go:\n```json\n' + JSON.stringify(obj) + '\n```\nDone.');
      expect(r.hidden_assumptions[0].assumption).toBe('Users will pay');
    });

    it('parses JSON embedded in prose', () => {
      const r = parseReframe('Sure! ' + JSON.stringify(obj) + ' Hope that helps.');
      expect(r.surface_task).toBe('Launch a paid tier');
    });

    it('coerces string-array assumptions into objects', () => {
      const r = parseReframe(JSON.stringify({ surface_task: 'x', hidden_assumptions: ['a', 'b'] }));
      expect(r.hidden_assumptions).toEqual([{ assumption: 'a' }, { assumption: 'b' }]);
    });

    it('returns empty-but-safe shape on missing fields', () => {
      const r = parseReframe('{}');
      expect(r.surface_task).toBe('');
      expect(r.hidden_assumptions).toEqual([]);
      expect(r.reasoning_narrative).toBeUndefined();
    });

    it('throws on genuinely non-JSON (caller handles)', () => {
      expect(() => parseReframe('totally not json')).toThrow();
    });
  });

  describe('reframeToMarkdown', () => {
    const r = {
      surface_task: '유료 전환',
      hidden_assumptions: [
        { assumption: '사용자가 돈을 낼 것', risk_if_false: '매출 0', axis: 'business' },
      ],
      reasoning_narrative: '핵심 베팅을 가른다.',
    };
    it('renders surface task, bold assumptions, axis label, and risk', () => {
      const md = reframeToMarkdown(r, 'ko');
      expect(md).toContain('표면 과제');
      expect(md).toContain('**사용자가 돈을 낼 것**');
      expect(md).toContain('(사업성)');
      expect(md).toContain('틀리면: 매출 0');
      expect(md).toContain('핵심 베팅을 가른다.');
    });
    it('uses English labels for en locale', () => {
      const md = reframeToMarkdown(r, 'en');
      expect(md).toContain('Surface task');
      expect(md).toContain('(Business)');
      expect(md).toContain('if false:');
    });
  });
});
