/**
 * Seal core — drafts a decision into a falsifiable, later-checkable form.
 * Validates the horizon clamp, the coercion guards, and (critically) the
 * surface-language invariant: user-facing copy must NEVER expose the internal
 * names 내기/반증/predicate (ledger-schema.ts).
 */
import { describe, it, expect } from 'vitest';
import {
  sealSystemPrompt, coerceSealDraft, sealPreviewMarkdown, settleQuestionMarkdown, formatCheckBy,
  SEAL_TOOL_SCHEMA,
} from '@/lib/seal-core';

describe('seal-core', () => {
  describe('system prompt', () => {
    it('ko/en differ and carry the non-judgment principle', () => {
      expect(sealSystemPrompt('ko')).not.toBe(sealSystemPrompt('en'));
      expect(sealSystemPrompt('ko')).toContain('판단하지');
      expect(sealSystemPrompt('en').toLowerCase()).toContain('do not judge');
    });
    it('tool schema requires the 4 ledger fields', () => {
      expect(SEAL_TOOL_SCHEMA.required).toEqual(['decision', 'predicate', 'falsified_if', 'check_by_days']);
    });
  });

  describe('coerceSealDraft', () => {
    const base = { decision: '신입 채용', predicate: '3개월 내 독립 배포', falsified_if: '리뷰 계속 필요', check_by_days: 30 };
    it('passes a valid draft through', () => {
      expect(coerceSealDraft(base)).toEqual(base);
    });
    it('clamps the horizon to 3..180', () => {
      expect(coerceSealDraft({ ...base, check_by_days: 1000 })!.check_by_days).toBe(180);
      expect(coerceSealDraft({ ...base, check_by_days: 0 })!.check_by_days).toBe(3);
      expect(coerceSealDraft({ ...base, check_by_days: 'x' })!.check_by_days).toBe(14); // NaN → default
    });
    it('rejects when decision or predicate is missing', () => {
      expect(coerceSealDraft({ ...base, decision: '' })).toBeNull();
      expect(coerceSealDraft({ ...base, predicate: undefined })).toBeNull();
      expect(coerceSealDraft(null)).toBeNull();
    });
  });

  describe('surface-language invariant (no internal names to the user)', () => {
    const draft = { decision: '신입 개발자 채용', predicate: '3개월 내 신입이 첫 기능 독립 배포', falsified_if: '계속 리뷰 필요', check_by_days: 90 };
    const FORBIDDEN = ['내기', '반증', 'predicate', 'falsified'];
    it('seal preview shows decision + signal but no forbidden terms', () => {
      const md = sealPreviewMarkdown(draft, '9월 24일', 'ko');
      expect(md).toContain('신입 개발자 채용');
      expect(md).toContain('9월 24일');
      for (const w of FORBIDDEN) expect(md.toLowerCase()).not.toContain(w.toLowerCase());
    });
    it('settle question carries the decision but no forbidden terms', () => {
      const md = settleQuestionMarkdown(draft.decision, draft.predicate, 'ko');
      expect(md).toContain('어떻게 됐어요');
      for (const w of FORBIDDEN) expect(md.toLowerCase()).not.toContain(w.toLowerCase());
    });
    it('en variants also avoid the internal names', () => {
      const md = sealPreviewMarkdown(draft, 'Sep 24', 'en') + settleQuestionMarkdown(draft.decision, draft.predicate, 'en');
      for (const w of ['predicate', 'falsified']) expect(md.toLowerCase()).not.toContain(w);
    });
  });

  describe('formatCheckBy', () => {
    it('ko renders 월/일', () => {
      expect(formatCheckBy(new Date(2026, 8, 24), 'ko')).toBe('9월 24일');
    });
  });
});
