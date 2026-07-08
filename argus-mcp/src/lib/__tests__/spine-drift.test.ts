import { describe, it, expect } from 'vitest';
import { TOOLS } from '../../tools/index.js';
import { NEXT_ACTIONS, FORBIDDEN_VERDICT_VERBS, FORBIDDEN_FORK_KEYS } from '../spine.js';
import { openDecision } from '../../tools/open-decision.js';
import { renderReceipt, renderSeal, renderWake, type WakeContractRow } from '../render-receipt.js';

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
    expect(ai).toContain('You have not yet made them yours');
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
    expect(en).toMatch(/not a grade\. It is what actually happened/);
  });
});

describe('settlement receipt copy', () => {
  it('does not label an unsettled receipt as "Settled (open)"', () => {
    const text = renderReceipt({
      id: 'd1',
      predicate: 'cutover downtime stays under five minutes',
      check_by: '2026-08-01',
      created_at: '2026-07-07T00:00:00.000Z',
      real_question: 'Can we cut over safely?',
      unverified_assumption: 'traffic stays stable',
      human_only: 'own the launch call',
      human_judgment: 'ship',
      skipped: [],
    });

    expect(text).toContain('Not yet settled');
    expect(text).not.toContain('Settled (open)');
  });
});

/** wake_text drift guard (P1-E7, master appendix): the accumulation render is
 *  counts, dates and user-stated outcome words ONLY. If a future edit adds an
 *  accuracy %, a "1/3" ratio, a tier/score, or a streak, this fails CI. */
describe('wake_text spine (renderWake)', () => {
  const TODAY = '2026-07-21';
  const row = (patch: Partial<WakeContractRow> & { id: string }): WakeContractRow => ({
    status: 'sealed',
    predicate: `feature usage crosses the agreed line for ${patch.id}`,
    check_by: '2026-08-01',
    ...patch,
  });
  const fixture: WakeContractRow[] = [
    // 6 overdue — exercises the (+N) fold at TOP=5
    ...[1, 2, 3, 4, 5, 6].map((i) => row({ id: `dec-0${i}`, check_by: '2026-07-10' })),
    // 2 waiting
    row({ id: 'dec-07', check_by: '2026-08-15' }),
    row({ id: 'dec-08', check_by: '2026-08-01' }),
    // 3 settled — one of each outcome
    row({ id: 'dec-09', status: 'settled', outcome: 'held', settled_on: '2026-07-21', check_by: '2026-07-20' }),
    row({ id: 'dec-10', status: 'settled', outcome: 'avoided', settled_on: '2026-07-21', check_by: '2026-07-20' }),
    row({ id: 'dec-11', status: 'settled', outcome: 'partial', settled_on: '2026-07-21', check_by: '2026-07-20' }),
    // never rendered as a group
    row({ id: 'dec-12', status: 'dismissed' }),
  ];
  const stats = { held: 1, avoided: 1, partial: 1 };

  it('no %/ratio/tier/score/streak vocabulary in either locale', () => {
    for (const locale of ['ko', 'en'] as const) {
      const text = renderWake(fixture, stats, TODAY, locale, '2026-07-03');
      for (const re of [/%/, /\d+\s*\/\s*\d+/, /\btier\b/i, /\bscore\b/i, /\bstreak\b/i, /점수/, /등급/, /연속/, /적중률/]) {
        expect(text, `${locale} leaked ${re}`).not.toMatch(re);
      }
    }
  });

  it('settled group is a count list of user-stated outcomes, never a rate', () => {
    const ko = renderWake(fixture, stats, TODAY, 'ko', '2026-07-03');
    expect(ko).toContain('정산됨 (3): held 1 · avoided 1 · partial 1');
    const en = renderWake(fixture, stats, TODAY, 'en', '2026-07-03');
    expect(en).toContain('settled (3): held 1 · avoided 1 · partial 1');
  });

  it('three groups on a time axis, folded at 5 lines, with the settle handle returned', () => {
    const ko = renderWake(fixture, stats, TODAY, 'ko', '2026-07-03');
    expect(ko).toContain('확인일 지남 (6)');
    expect(ko).toContain('← argus_settle');
    expect(ko).toContain('… (+1)'); // 6 overdue, 5 shown
    expect(ko).toContain('결과를 기다리는 중 (2)');
    expect(ko).toContain('11일 경과'); // 07-10 → 07-21
    expect(ko).toContain('답 08-01');
    expect(ko).toContain('결정 12 · 봉인 중 8 · 정산 3');
    expect(ko).toContain('기록 시작 2026-07-03 부터');
  });

  it('waiting lines sort by check_by ascending (dec-08 before dec-07)', () => {
    const ko = renderWake(fixture, stats, TODAY, 'ko');
    expect(ko.indexOf('dec-08')).toBeLessThan(ko.indexOf('dec-07'));
  });

  it('empty groups vanish instead of rendering hollow frames', () => {
    const one = renderWake([row({ id: 'only-one', check_by: '2026-09-01' })], { held: 0, avoided: 0, partial: 0 }, TODAY, 'ko');
    expect(one).toContain('결과를 기다리는 중 (1)');
    expect(one).not.toContain('확인일 지남');
    expect(one).not.toContain('정산됨');
  });
});
