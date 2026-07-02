import { describe, it, expect } from 'vitest';
import { TOOLS } from '../../tools/index.js';
import { NEXT_ACTIONS, FORBIDDEN_VERDICT_VERBS, FORBIDDEN_FORK_KEYS } from '../spine.js';
import { openDecision } from '../../tools/open-decision.js';
import { renderSeal } from '../render-receipt.js';

/**
 * The drift guard (blueprint §3.6). If a future edit reintroduces a verdict
 * surface on any of the three Argus bodies, this fails CI.
 */
describe('spine drift guard', () => {
  it('exposes no verdict/grade/score tool', () => {
    for (const t of TOOLS) {
      for (const verb of FORBIDDEN_VERDICT_VERBS) {
        expect(t.name.toLowerCase()).not.toContain(verb);
      }
    }
  });

  it('next_actions enum contains no judgment verb', () => {
    for (const action of NEXT_ACTIONS) {
      for (const verb of FORBIDDEN_VERDICT_VERBS) {
        expect(action.toLowerCase()).not.toContain(verb);
      }
    }
  });

  it('open_decision output cannot express a fork or a lean', () => {
    const schema = JSON.stringify(openDecision.outputSchema ?? {});
    // The structured output is the generic envelope; fork keys must never be added as required output.
    for (const key of FORBIDDEN_FORK_KEYS) {
      // a defensive check: no fork key is a declared output property
      expect(JSON.parse(schema).properties?.[key]).toBeUndefined();
    }
  });

  it('no tool input or output schema can express a fork or a lean', () => {
    // plan v5 §3/§4: resolve is elicitation-only; recheck returns the handle.
    // If a future edit adds an options/lean-shaped field anywhere, this fails.
    for (const t of TOOLS) {
      const out = JSON.stringify(t.outputSchema ?? {});
      for (const key of FORBIDDEN_FORK_KEYS) {
        expect(JSON.parse(out).properties?.[key], `${t.name} output declares "${key}"`).toBeUndefined();
      }
      const input = t.inputSchema ? JSON.stringify((t.inputSchema as { shape?: Record<string, unknown> }).shape ? Object.keys((t.inputSchema as unknown as { shape: Record<string, unknown> }).shape) : []) : '[]';
      for (const key of FORBIDDEN_FORK_KEYS) {
        expect(input.includes(`"${key}"`), `${t.name} input declares "${key}"`).toBe(false);
      }
    }
  });

  it('every tool declares an input schema and a name', () => {
    for (const t of TOOLS) {
      expect(t.name).toMatch(/^argus_/);
      expect(t.inputSchema).toBeTruthy();
    }
  });
});

/** seal_text drift guard (P1-E2, master appendix): the new user-facing render
 *  must never grow verdict vocabulary, and its provenance line must stay an
 *  honest fact statement in BOTH ownership branches. */
describe('seal_text spine (renderSeal)', () => {
  const base = {
    predicate: 'cutover downtime stays under five minutes',
    sealed_on: '2026-07-03',
    check_by: '2026-07-17',
    today: '2026-07-03',
  } as const;

  it('no %/tier/score/streak vocabulary in any locale or ownership branch', () => {
    for (const locale of ['ko', 'en'] as const) {
      for (const owner of ['user', 'ai_surfaced'] as const) {
        const text = renderSeal({ ...base, predicate_owner: owner, locale });
        for (const re of [/%/, /\btier\b/i, /\bscore\b/i, /\bstreak\b/i, /점수/, /등급/, /연속/]) {
          expect(text, `${locale}/${owner} leaked ${re}`).not.toMatch(re);
        }
      }
    }
  });

  it('provenance is honest in both branches — never a false ownership narrative', () => {
    const user = renderSeal({ ...base, predicate_owner: 'user', locale: 'en' });
    expect(user).toContain('These words are yours.');
    const ai = renderSeal({ ...base, predicate_owner: 'ai_surfaced', locale: 'en' });
    expect(ai).toContain('you have not yet made them yours');
    expect(ai).not.toContain('These words are yours.');
    const aiKo = renderSeal({ ...base, predicate_owner: 'ai_surfaced', locale: 'ko' });
    expect(aiKo).toContain('아직 당신이 확언하지 않았습니다');
    expect(aiKo).not.toContain('이 문장은 당신의 것입니다');
  });

  it('carries the quote, both dates, and the day diff from resolveToday', () => {
    const ko = renderSeal({ ...base, predicate_owner: 'user', locale: 'ko' });
    expect(ko).toContain('"cutover downtime stays under five minutes"');
    expect(ko).toContain('2026-07-03');
    expect(ko).toContain('2026-07-17');
    expect(ko).toContain('(14일 뒤)');
    expect(ko).toContain('평가가 아니라');
    const en = renderSeal({ ...base, predicate_owner: 'user', locale: 'en' });
    expect(en).toContain('(14 days out)');
    expect(en).toMatch(/not\s+a grade — it is what actually happened/);
  });
});
