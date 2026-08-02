/**
 * The judgment harness sees THIS decision and nothing else.
 *
 * 2026 CHI work on LLM sycophancy ("Does Sycophancy Change Decisions?",
 * "Interaction Context Often Increases Sycophancy in LLMs") measured which
 * inputs make a model agree with a user more. The largest single amplifier was
 * not tone or phrasing — it was a USER MEMORY PROFILE, worth a 45% increase in
 * agreement sycophancy on one frontier model. A system that remembers what you
 * believed last time is a system that agrees with you more this time.
 *
 * Argus is currently immune to that by construction rather than by policy:
 * buildInitialJudgmentPrompt takes (problemText, locale) and there is nowhere
 * to put a history. That is a real architectural property of the product whose
 * whole promise is not to agree with you — and it is one refactor away from
 * being lost, silently, in a change that would look like a feature.
 *
 * This is not a ban on memory. BLUEPRINT §9.8 and epistemic/control-plane.ts
 * define how derived memory may influence anything: an active scoped grant, an
 * InfluenceTrace, fail-closed when the trace cannot be persisted. The rule is
 * that the harness may not quietly acquire a back door around that.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildInitialJudgmentPrompt,
  buildDeepeningJudgmentPrompt,
} from '../judgment-harness-v2';
import type { AnalysisSnapshot } from '@/stores/types';

const src = readFileSync(join(process.cwd(), 'src/lib/judgment-harness-v2.ts'), 'utf8');

/** The declared parameter NAMES of an exported builder, read from source. */
function paramsOf(fn: string): string[] {
  const at = src.indexOf(`export function ${fn}(`);
  if (at < 0) throw new Error(`${fn} not found — was it renamed?`);
  const open = src.indexOf('(', at);
  let depth = 0;
  let close = open;
  for (; close < src.length; close += 1) {
    if (src[close] === '(') depth += 1;
    else if (src[close] === ')') { depth -= 1; if (depth === 0) break; }
  }
  return src.slice(open + 1, close)
    .split('\n')
    .map((l) => l.replace(/\/\*[^]*?\*\//g, '').replace(/\/\/.*$/, '').trim())
    .filter((l) => /^[a-zA-Z_]/.test(l))
    .map((l) => l.split(/[?:,]/)[0].trim())
    .filter(Boolean);
}

describe('the first turn cannot see a past session', () => {
  it('takes the situation and the language, and nothing else', () => {
    // Read from the source, not Function.length — that stops counting at the
    // first defaulted parameter, so a history argument with a default would be
    // invisible to it. The whole point is to notice a NEW parameter.
    expect(paramsOf('buildInitialJudgmentPrompt')).toEqual(['problemText', 'locale']);
  });

  it('puts nothing in the prompt that did not come from this turn', () => {
    const SECRET = 'ZZ_PRIOR_SESSION_MARKER';
    const { system, user } = buildInitialJudgmentPrompt('회사를 옮길지 고민이에요.', 'ko');
    expect(user).toContain('회사를 옮길지 고민이에요.');
    expect(system + user).not.toContain(SECRET);
    // The system half is a constant: same for every user, every session.
    const second = buildInitialJudgmentPrompt('완전히 다른 결정입니다.', 'ko').system;
    expect(second).toBe(system);
  });
});

describe('the harness never reaches for memory on its own', () => {
  it('imports no store, no pattern source, no control plane', () => {
    // A grant-checked injection is a decision for the control plane to make and
    // hand down — never for the prompt builder to fetch for itself. Reaching
    // directly is how the grant, the scope and the trace get bypassed.
    for (const forbidden of [
      'useProgressiveStore', 'usePatternStore', 'useProjectStore',
      'epistemic/control-plane', 'lib/patterns', 'lib/current-bearing',
      'localStorage', 'supabase',
    ]) {
      expect(src, `judgment-harness-v2 must not reach for ${forbidden}`).not.toContain(forbidden);
    }
  });

  it('the deepening turn sees only this session\'s own state', () => {
    // problemText, currentSnapshot, Q&A, round, maxRounds, locale, and the
    // optional crew results — all of them produced by THIS decision. A new
    // parameter carrying anything older belongs behind the control plane, and
    // adding one here turns this red on purpose.
    expect(paramsOf('buildDeepeningJudgmentPrompt')).toEqual([
      'problemText', 'currentSnapshot', 'questionsAndAnswers', 'round', 'maxRounds', 'locale',
    ]);
  });

  it('a session\'s own earlier answers are in scope, and are the ONLY history', () => {
    const snapshot = {
      real_question: '지금 결정', hidden_assumptions: [], skeleton: [],
    } as unknown as AnalysisSnapshot;
    const qa = [{
      question: { id: 'q1', text: '가장 걸리는 게 뭐예요?', type: 'short' },
      answer: { question_id: 'q1', value: '기한이 다음 주예요.' },
    }];
    const { user } = buildDeepeningJudgmentPrompt(
      '지금 결정', snapshot, qa as never, 1, 3, 'ko',
    );
    expect(user).toContain('기한이 다음 주예요.');
  });
});
