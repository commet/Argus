import { describe, it, expect, beforeEach } from 'vitest';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { premises } from '../premises.js';
import { seal } from '../seal.js';
import { recall } from '../recall.js';
import { setElicitor } from '../../lib/elicit.js';

/**
 * The terminal makes the same move the browser makes.
 *
 * Measured on the webapp (2026-08-01 census): given a user's answer, the model
 * hands the sentence straight back with the word "premise" on it — 6 of 11
 * collected items were the user's own words restated. The MCP had no defence at
 * all: it ASKED for anchor_quote, used it once to decide user_stated vs
 * ai_surfaced, and then threw it away without ever comparing it to the text. A
 * pure restatement was stored as load-bearing and queued for re-checking, so
 * the check-in day would ask "이 전제가 맞았나요?" about a sentence the user
 * had written themselves.
 *
 * The claim band is now shared byte-for-byte with the webapp
 * (lib/premise-claim.ts, guarded by premises-core-drift.test.ts).
 *
 * What would make this red:
 *   · a restatement stored as load_bearing or monitored
 *   · a real claim demoted because it happens to reuse the quote's words
 *   · the user's own sentence dropped rather than recorded as context
 *   · anchor_quote asked for and thrown away again
 */

const TODAY = '2026-08-02';
const QUOTE = '전세 만기가 4개월 남았는데 이참에 매매로 갈아탈까 고민이에요';

beforeEach(() => { setElicitor(null); });

async function add(dir: string, premise: Record<string, unknown>) {
  return premises.handler({
    argus_dir: dir, op: 'add', id: 'd1', today_override: TODAY,
    premises: [premise],
  } as never);
}

async function openDecision(dir: string) {
  await seal.handler({
    argus_dir: dir, id: 'd1', predicate: '4개월 안에 매매로 갈아탄다',
    check_by: '2026-12-02', predicate_owner: 'user', today_override: TODAY,
  } as never);
}

describe('a sentence that only repeats its own quote', () => {
  it('is recorded, but as context — not as something to re-check', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);
    const res = await add(dir, {
      text: '전세 만기가 4개월 남았다',
      anchor_quote: QUOTE,
      kind: 'premise',
      source: 'user_stated',
      external: true,
      load_bearing: true,
    });
    const data = body(res).data as { premises: Array<Record<string, unknown>>; context_note?: string };
    const [p] = data.premises;
    // Kept — the user said it and it stays on the record.
    expect(p.text).toBe('전세 만기가 4개월 남았다');
    expect(p.recorded_as).toBe('context');
    // But not treated as an assumption: no re-check, no load-bearing flag.
    expect(p.load_bearing).toBe(false);
    expect(p.monitored).toBe(false);
    // And the model is told what to do about it, in `data` where the model
    // reads — never in `surface`, which is the line a person reads.
    expect(data.context_note).toContain('makes possible or impossible');
    expect(body(res).surface).not.toContain('context');
  });

  it('keeps the quote instead of discarding it', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);
    await add(dir, {
      text: '전세 만기가 4개월 남았다',
      anchor_quote: QUOTE,
      kind: 'premise', source: 'user_stated', external: true, load_bearing: true,
    });
    const view = await recall.handler({
      argus_dir: dir, view: 'premises', id: 'd1', today_override: TODAY,
    } as never);
    const rows = (body(view).data as { premises: Array<Record<string, unknown>> }).premises;
    // It survives the ledger round-trip AND reaches the read view, so the
    // terminal can show what the browser card shows under every premise:
    // "내가 쓴 말". Collected-and-dropped was the state for months.
    expect(rows[0].anchor_quote).toBe(QUOTE);
  });
});

describe('a real claim is untouched', () => {
  it('keeps load-bearing when the sentence goes past the quote', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);
    const res = await add(dir, {
      text: '지금 대출 금리로는 4개월 안에 매매 자금을 맞출 수 없다',
      anchor_quote: QUOTE,
      kind: 'premise', source: 'user_stated', external: true, load_bearing: true,
    });
    const data = body(res).data as { premises: Array<Record<string, unknown>>; context_note?: string };
    expect(data.premises[0].load_bearing).toBe(true);
    expect(data.premises[0].recorded_as).toBeUndefined();
    expect(data.context_note).toBeUndefined();
  });

  it('does not judge a premise offered without a quote', async () => {
    // Nothing to compare against is not evidence of restatement. The host may
    // legitimately have no quote (an ai_surfaced read), and inventing a verdict
    // from an absent input is the fabrication this codebase refuses elsewhere.
    const dir = tmpArgusDir();
    await openDecision(dir);
    const res = await add(dir, {
      text: '전세 만기가 4개월 남았다',
      kind: 'premise', source: 'ai_surfaced', ai_original: '전세 만기가 4개월 남았다',
      external: true, load_bearing: true,
    });
    const data = body(res).data as { premises: Array<Record<string, unknown>> };
    expect(data.premises[0].load_bearing).toBe(true);
  });

  it('leaves an open_question alone — it is not claiming to be an assumption', async () => {
    const dir = tmpArgusDir();
    await openDecision(dir);
    const res = await add(dir, {
      text: '집주인이 갱신을 어떻게 할지 물어봤나?',
      anchor_quote: QUOTE,
      kind: 'open_question', source: 'user_stated', external: false, load_bearing: false,
    });
    const data = body(res).data as { premises: Array<Record<string, unknown>>; context_note?: string };
    expect(data.premises[0].kind).toBe('open_question');
    expect(data.context_note).toBeUndefined();
  });
});
