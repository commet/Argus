import { describe, it, expect, beforeEach } from 'vitest';
import { setElicitor, elicitDetailed, elicit, canElicit, UNSEEN_DECLINE_MAX_MS } from '../elicit.js';

/**
 * ACCEPT MUST RECORD. AT EVERY SPEED. FOREVER.
 *
 * "I press Accept and nothing is recorded" was reported by the founder THREE
 * times across 2026-07-27~28. Each report had a different real cause — a
 * `required` field, then a `format` constraint, then the confirm dialog
 * declaring input boxes at all (which made Enter move the cursor instead of
 * submitting). Each time the gates were green.
 *
 * 2.0.11 introduced a timing branch on the DECLINE path. That branch must never
 * be able to touch Accept, and "must never" is not a promise — it is this file.
 * The founder's instruction was explicit: this fix must not become a fourth
 * "Accept does not work".
 *
 * So Accept is asserted across the whole latency range a real answer can arrive
 * in, from an instant machine reply through the timings that surround the
 * decline threshold, past a human pause, and out beyond the SDK's old 60-second
 * default that silently discarded a real Accept at 71 seconds.
 *
 * 무엇이 이걸 빨간불로 만드나: elicitDetailed의 accept 반환을 타이밍 분기 아래로
 * 내리거나, accept에 어떤 조건이든 붙이면 즉시 빨개진다.
 */

type Reply = { action: 'accept' | 'decline' | 'cancel'; content?: Record<string, unknown>; delayMs?: number };

function wire(replies: Reply[]): { asked: () => number } {
  let i = 0;
  setElicitor(
    async () => {
      const r = replies[Math.min(i, replies.length - 1)]!;
      i += 1;
      if (r.delayMs) await new Promise((res) => setTimeout(res, r.delayMs));
      return { action: r.action, content: r.content };
    },
    () => true,
  );
  return { asked: () => i };
}

beforeEach(() => setElicitor(null));

/**
 * Every latency an Accept can plausibly arrive in. The ones bracketing
 * UNSEEN_DECLINE_MAX_MS are the point: if the timing branch ever leaks into the
 * accept path, THOSE are what break first.
 */
const SPEEDS: Array<[string, number]> = [
  ['즉시 (0ms — 기계·자동화)', 0],
  ['문턱 바로 아래 (1ms)', 1],
  ['문턱과 같음', UNSEEN_DECLINE_MAX_MS],
  ['문턱 바로 위', UNSEEN_DECLINE_MAX_MS + 1],
  ['문턱의 10배', UNSEEN_DECLINE_MAX_MS * 10],
  ['사람이 읽고 누름 (300ms)', 300],
  ['천천히 (1.2초)', 1200],
];

describe('Accept는 어떤 속도에서도 기록된다', () => {
  for (const [label, delayMs] of SPEEDS) {
    it(`빈 Accept — ${label}`, async () => {
      wire([{ action: 'accept', content: {}, delayMs }]);
      const out = await elicitDetailed('Record this prediction?', { type: 'object', properties: {} });
      expect(out.kind).toBe('accepted');
      expect(out.kind === 'accepted' && out.content).toEqual({});
    });

    it(`내용이 있는 Accept — ${label}`, async () => {
      wire([{ action: 'accept', content: { outcome: 'held', what_happened: '실제로 그렇게 됐다' }, delayMs }]);
      const out = await elicitDetailed('What did reality do?', { type: 'object', properties: {} });
      expect(out.kind).toBe('accepted');
      expect(out.kind === 'accepted' && out.content['outcome']).toBe('held');
      // 사용자가 친 말이 한 글자도 안 없어져야 한다
      expect(out.kind === 'accepted' && out.content['what_happened']).toBe('실제로 그렇게 됐다');
    });
  }

  it('구형 elicit() 경로도 같은 속도 전 구간에서 내용을 돌려준다', async () => {
    for (const [, delayMs] of SPEEDS) {
      wire([{ action: 'accept', content: { reword: '내 문장' }, delayMs }]);
      const got = await elicit('Reword?', { type: 'object', properties: {} });
      expect(got).toEqual({ reword: '내 문장' });
    }
  });

  it('SDK의 옛 60초 기본값 너머에서 온 Accept도 살아남는다', async () => {
    // 창업자 호스트 로그 2026-07-27: Accept가 71초에 도착했고 버려졌다.
    // 가짜 타이머 없이 실제로 기다리지 않기 위해, 지연 대신 "이미 오래 걸린 뒤
    // 도착한 응답"을 그대로 흘려보내는지만 본다 — accept에는 어떤 시간 조건도
    // 없어야 하므로 이 단언은 지연과 무관하게 참이어야 한다.
    wire([{ action: 'accept', content: { keep: true }, delayMs: 80 }]);
    const out = await elicitDetailed('still there?', { type: 'object', properties: {} });
    expect(out.kind).toBe('accepted');
  });

  it('거절이 한 번 있어도 다음 Accept는 정상 기록된다', async () => {
    const w = wire([
      { action: 'decline' },                                   // 아무도 못 본 거절
      { action: 'accept', content: { outcome: 'missed' } },     // 그 다음 진짜 Accept
    ]);
    const first = await elicitDetailed('seal?', { type: 'object', properties: {} });
    expect(first.kind).toBe('no_answer');

    expect(canElicit()).toBe(true);
    const second = await elicitDetailed('settle?', { type: 'object', properties: {} });
    expect(second.kind).toBe('accepted');
    expect(second.kind === 'accepted' && second.content['outcome']).toBe('missed');
    expect(w.asked()).toBe(2);
  });

  it('연속 Accept 20번이 전부 기록된다 (누적 상태가 픽커를 갉아먹지 않는다)', async () => {
    wire([{ action: 'accept', content: { n: 1 } }]);
    for (let i = 0; i < 20; i += 1) {
      const out = await elicitDetailed(`ask ${i}`, { type: 'object', properties: {} });
      expect(out.kind).toBe('accepted');
      expect(canElicit()).toBe(true);
    }
  });
});
