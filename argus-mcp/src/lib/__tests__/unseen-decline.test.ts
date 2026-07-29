import { describe, it, expect, beforeEach } from 'vitest';
import {
  setElicitor,
  elicitDetailed,
  canElicit,
  UNSEEN_DECLINE_MAX_MS,
} from '../elicit.js';

/**
 * A DECLINE THAT ARRIVED BEFORE ANY FORM EXISTED IS NOT THE USER'S DECLINE.
 *
 * This was argued twice and reverted twice. It is settled by measurement now.
 * Real `codex app-server`, elicitations blocked by policy, five calls timed at
 * the seam (2026-07-29):
 *
 *     0.3ms · 0.3ms · 0.3ms · 0.4ms · 1.1ms
 *
 * A policy rejection is synthesized locally with no UI in the path. Every human
 * decline — keyboard, screen reader, someone who already knew their answer —
 * still needs a render, a read and a keypress, which is ~1000ms at the fastest.
 * `evals/decline-latency.mjs` re-measures both sides against the installed Codex
 * on every verify, so this is checked rather than believed.
 *
 * The threshold sits ~5x above the measured policy ceiling and ~200x below the
 * conservative human floor. Both directions are asserted below, because getting
 * it wrong either way erases a person:
 *
 *   too low  → a policy rejection is reported as "you declined", to someone who
 *              was shown nothing and then handed next_actions:["stop"]
 *   too high → a real "no" is swallowed and called a non-answer
 *
 * 무엇이 이걸 빨간불로 만드나: 귀속 거부를 지우면 ①②가, 문턱을 250ms 이상으로
 * 올리면 ③이, canElicit이 스트릭을 다시 보면 ④가 빨개진다.
 */

type Answer = { action: 'accept' | 'decline' | 'cancel'; content?: Record<string, unknown>; delayMs?: number };

function wire(answers: Answer[]): { asked: () => number } {
  let i = 0;
  setElicitor(
    async () => {
      const a = answers[Math.min(i, answers.length - 1)]!;
      i += 1;
      if (a.delayMs) await new Promise((r) => setTimeout(r, a.delayMs));
      return { action: a.action, content: a.content };
    },
    () => true,
  );
  return { asked: () => i };
}

/** Comfortably above the threshold and far below any real human — a stand-in for
 *  "the form was drawn and somebody looked at it". */
const HUMAN_MS = 120;

beforeEach(() => setElicitor(null));

describe('아무도 보지 못한 거절', () => {
  it('① 사용자의 거절이라고 기록하지 않는다', async () => {
    wire([{ action: 'decline' }]);
    const out = await elicitDetailed('Record this?', { type: 'object', properties: {} });
    expect(out.kind).toBe('no_answer');
    expect(out.kind === 'no_answer' && out.reason).toBe('unattributable');
  });

  it('② 전송 실패와는 다른 사유로 구분된다 (ambient 쿨다운이 갈린다)', async () => {
    setElicitor(async () => { throw new Error('transport dead'); }, () => true);
    const thrown = await elicitDetailed('ask', { type: 'object', properties: {} });
    expect(thrown.kind === 'no_answer' && thrown.reason).toBe('failed');

    wire([{ action: 'decline' }]);
    const unseen = await elicitDetailed('ask', { type: 'object', properties: {} });
    expect(unseen.kind === 'no_answer' && unseen.reason).toBe('unattributable');
  });

  it('③ 사람이 화면을 보고 누른 거절은 그대로 그 사람의 것이다', async () => {
    wire([{ action: 'decline', delayMs: HUMAN_MS }]);
    const out = await elicitDetailed('Record this?', { type: 'object', properties: {} });
    expect(out.kind).toBe('declined');
  });

  it('③b 접근성·키보드 사용자의 빠른 거절도 그 사람의 것이다', async () => {
    // 문턱(5ms)의 몇 배지만 사람으로서는 아주 빠른 축 — 이것도 삼키면 안 된다.
    wire([{ action: 'decline', delayMs: UNSEEN_DECLINE_MAX_MS * 8 }]);
    const out = await elicitDetailed('Record this?', { type: 'object', properties: {} });
    expect(out.kind).toBe('declined');
  });

  it('④ 거절 한 번이 이후 픽커를 없애지 않는다', async () => {
    const w = wire([{ action: 'decline' }, { action: 'accept', content: { outcome: 'held' } }]);
    const first = await elicitDetailed('seal?', { type: 'object', properties: {} });
    expect(first.kind).toBe('no_answer');
    expect(canElicit()).toBe(true);

    const second = await elicitDetailed('settle?', { type: 'object', properties: {} });
    expect(second.kind).toBe('accepted');
    expect(w.asked()).toBe(2);
  });

  it('⑤ 문턱은 사람의 최속보다 두 자릿수 아래에 있다', () => {
    // 게이트(evals/decline-latency.mjs)가 실호스트로 재는 것과 같은 불변식을,
    // 단위 수준에서도 못박는다. 문턱을 사람 영역으로 올리면 여기서 걸린다.
    expect(UNSEEN_DECLINE_MAX_MS).toBeLessThanOrEqual(25);
    expect(UNSEEN_DECLINE_MAX_MS).toBeGreaterThan(0);
  });
});
