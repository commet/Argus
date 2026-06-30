/**
 * Reframe core — the shared brain used by BOTH the webapp and the Telegram bot.
 * Verifies the prompt is intact after extraction and the parser is robust to the
 * ways a model wraps JSON (fences, prose, string-array assumptions).
 */
import { describe, it, expect } from 'vitest';
import {
  reframeSystemPrompt, deeperSuffix, parseReframe, reframeToMarkdown,
  ASSUMPTION_PROMPT_KO, ASSUMPTION_PROMPT_EN,
  questionSystemPrompt, coerceQuestion, questionToMarkdown,
} from '@/lib/reframe-core';

describe('reframe-core', () => {
  describe('system prompt (single source)', () => {
    it('ko/en select the right canonical prompt', () => {
      expect(reframeSystemPrompt('ko')).toBe(ASSUMPTION_PROMPT_KO);
      expect(reframeSystemPrompt('en')).toBe(ASSUMPTION_PROMPT_EN);
    });
    it('keeps the 4-lens instruction (the brain, not a stub) + domain-adaptiveness', () => {
      expect(ASSUMPTION_PROMPT_KO).toContain('렌즈');
      expect(ASSUMPTION_PROMPT_KO).toContain('hidden_assumptions');
      expect(ASSUMPTION_PROMPT_KO).toContain('개인'); // domain-adaptive note (don't force business jargon)
      expect(ASSUMPTION_PROMPT_EN.toLowerCase()).toContain('lens');
      expect(ASSUMPTION_PROMPT_EN).toContain('hidden_assumptions');
      expect(ASSUMPTION_PROMPT_EN.toLowerCase()).toContain('personal');
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
      expect(md).toContain('(대가·지속)');
      expect(md).toContain('틀리면: 매출 0');
      expect(md).toContain('핵심 베팅을 가른다.');
    });
    it('uses English labels for en locale', () => {
      const md = reframeToMarkdown(r, 'en');
      expect(md).toContain('Surface task');
      expect(md).toContain('(Cost & durability)');
      expect(md).toContain('if false:');
    });
  });

  describe('Stage 2 — question reframe + neutral crux (spine)', () => {
    it('system prompt encodes the restraint invariant (crux = question, no verdict/fork)', () => {
      const ko = questionSystemPrompt('ko');
      expect(ko).toContain('중립적인 질문');
      expect(ko).toContain('두 갈래');     // forbids a two-pole fork
      expect(ko).toContain('판단하지');
      const en = questionSystemPrompt('en').toLowerCase();
      expect(en).toContain('neutral question');
      expect(en).toContain('never tell the user what to do');
    });
    it('coerceQuestion guards required fields and caps alternatives', () => {
      expect(coerceQuestion({ reframed_question: 'X?', crux_question: 'Y?' }))
        .toEqual({ reframed_question: 'X?', crux_question: 'Y?', alternatives: [] });
      expect(coerceQuestion({ reframed_question: '', crux_question: 'Y?' })).toBeNull();
      expect(coerceQuestion({ reframed_question: 'X?' })).toBeNull();
      expect(coerceQuestion({ reframed_question: 'X?', crux_question: 'Y?', alternatives: ['a', 'b', 'c', 'd'] })!.alternatives)
        .toHaveLength(3);
    });
    it('markdown surfaces the real question + crux, uses identity not branch-mechanism language', () => {
      const md = questionToMarkdown(
        { reframed_question: '지금이 적기인가?', crux_question: '멘토링 여력이 실제로 있는가?', alternatives: ['외주가 더 맞지 않나?'] },
        'ko',
      );
      expect(md).toContain('진짜 질문');
      expect(md).toContain('지금이 적기인가?');
      expect(md).toContain('멘토링 여력이 실제로 있는가?');
      expect(md).toContain('외주가 더 맞지 않나?');
      // copy-identity-not-mechanism: never the "어디서 갈리는지"(branch-detector) framing
      expect(md).not.toContain('갈리');
      expect(md).not.toContain('분기');
    });
  });
});
