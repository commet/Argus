import { describe, it, expect, beforeEach } from 'vitest';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { premises } from '../premises.js';
import { seal } from '../seal.js';
import { setElicitor } from '../../lib/elicit.js';

/**
 * The claim band has two rules. Only one of them was wired here.
 *
 * `statesAClaim` — does this sentence say more than its own quote — has guarded
 * the terminal since 2026-08-02 (premise-claim-band.test.ts). Its sibling
 * `attributesStanceToUser` — does this sentence claim something about the
 * USER'S inner weighting, what matters to them, what they believe — was shared
 * into argus-mcp/src/lib byte-for-byte and then called by nothing.
 *
 * On the web a sentence like that is a STANDARD whatever the model labelled it,
 * and a standard is REFUSED unless the quote carries the user's own weighing
 * words, because relabelling it would launder it into their mouth.
 *
 * In a terminal none of that ran, and the consequence is worse than on the web.
 * A load-bearing external premise is MONITORED: Argus comes back weeks later
 * and asks the user to re-check it. So an agent's guess about what matters to
 * someone could be stored under their name, with a quote that never said it,
 * and then returned to them as their own belief — the single failure the whole
 * design exists to prevent.
 *
 * What would make this red:
 *   · a stance the user never voiced stored as load_bearing or monitored
 *   · that stance still attributed to them as `user_stated`
 *   · a stance they DID voice demoted anyway (the quote carries their weighing)
 *   · the sentence dropped instead of recorded
 */

const TODAY = '2026-08-02';
/** They named the fact. They never said what it weighs. */
const FACTUAL_QUOTE = '지금 팀은 여섯 명이고, 제안 온 회사는 연봉이 40% 높아요';
/** Their own weighing, in their own words — and saying less than the premise
 *  that rests on it, so the claim band is not what decides this test. */
const WEIGHING_QUOTE = '연봉은 솔직히 그렇게 중요하지 않다고 봐요';

beforeEach(() => { setElicitor(null); });

async function openDecision(dir: string) {
  await seal.handler({
    argus_dir: dir, id: 'd1', predicate: '3개월 안에 이직 여부를 정한다',
    check_by: '2026-11-02', predicate_owner: 'user', today_override: TODAY,
  } as never);
}

async function add(dir: string, premise: Record<string, unknown>) {
  return premises.handler({
    argus_dir: dir, op: 'add', id: 'd1', today_override: TODAY,
    premises: [premise],
  } as never);
}

describe('a belief the user never voiced', () => {
  it('is recorded, but never as theirs and never monitored', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);

    const res = await add(dir, {
      text: '연봉보다 팀이 더 중요하다',
      anchor_quote: FACTUAL_QUOTE,
      kind: 'premise',
      source: 'user_stated',
      external: true,
      load_bearing: true,
    });

    const data = body(res).data as Record<string, unknown>;
    const echo = (data['premises'] as Record<string, unknown>[])[0];

    // Kept — the sentence is real material and dropping it would lose it.
    expect(echo['text']).toBe('연봉보다 팀이 더 중요하다');
    expect(echo['recorded_as']).toBe('unconfirmed_stance');
    // Not something Argus will come back and ask them to confirm.
    expect(echo['load_bearing']).toBe(false);
    expect(echo['monitored']).toBe(false);
    // And not in their mouth.
    expect(echo['source']).toBe('ai_surfaced');
    expect(echo['ai_original']).toBe('연봉보다 팀이 더 중요하다');
    expect(String(data['stance_note'])).toMatch(/unconfirmed/);
  });

  it('tells the host to ask rather than to assert', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);
    const res = await add(dir, {
      text: '지금은 안정성을 가장 중요하게 보고 있다',
      ai_original: '지금은 안정성을 가장 중요하게 보고 있다',
      anchor_quote: FACTUAL_QUOTE,
      kind: 'premise', source: 'ai_surfaced', external: false, load_bearing: true,
    });
    const data = body(res).data as Record<string, unknown>;
    expect(String(data['stance_note'])).toMatch(/Ask them/);
  });
});

describe('a stance the user actually voiced', () => {
  it('stands, load-bearing and attributed to them', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);

    const res = await add(dir, {
      text: '팀의 일하는 방식이 연봉 인상폭보다 중요하다',
      anchor_quote: WEIGHING_QUOTE,
      kind: 'premise',
      source: 'user_stated',
      external: true,
      load_bearing: true,
    });

    const data = body(res).data as Record<string, unknown>;
    const echo = (data['premises'] as Record<string, unknown>[])[0];

    expect(echo['recorded_as']).toBeUndefined();
    expect(echo['load_bearing']).toBe(true);
    expect(echo['source']).toBe('user_stated');
    expect(data['stance_note']).toBeUndefined();
  });
});

describe('the ordinary premise is untouched', () => {
  it('a claim about the world keeps every property it was given', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);

    const res = await add(dir, {
      text: '제안 온 회사는 다음 라운드를 12개월 안에 마감하지 못한다',
      ai_original: '제안 온 회사는 다음 라운드를 12개월 안에 마감하지 못한다',
      anchor_quote: FACTUAL_QUOTE,
      kind: 'premise',
      source: 'ai_surfaced',
      external: true,
      load_bearing: true,
    });

    const echo = ((body(res).data as Record<string, unknown>)['premises'] as Record<string, unknown>[])[0];
    expect(echo['recorded_as']).toBeUndefined();
    expect(echo['load_bearing']).toBe(true);
  });
});
