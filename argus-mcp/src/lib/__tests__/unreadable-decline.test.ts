import { describe, it, expect, beforeEach } from 'vitest';
import {
  setElicitor,
  elicitDetailed,
  canElicit,
  elicitationLikelyBlocked,
  resetElicitObservations,
  UNREADABLE_DECLINE_MAX_MS,
} from '../elicit.js';

/**
 * A DECLINE NOBODY COULD HAVE READ IS NOT THE USER'S DECLINE — AND IT MUST NOT
 * COST THEM THE REST OF THEIR PICKERS.
 *
 * Measured on a real `codex app-server` (2026-07-29, five configs, same Argus
 * build): under `approval_policy = "never"` or `granular.mcp_elicitations =
 * false`, Codex advertises the elicitation capability, never forwards the
 * request to anything that could render it, and answers `decline` itself in
 * ~330ms. Argus then told the user "Not recorded." with `choice: "declined"` —
 * a decision attributed to a human who was never shown anything, and no way
 * forward. Codex's own protocol carries no marker to tell the two apart
 * (`McpServerElicitationRequestResponse`: action + content + a null `_meta`).
 *
 * An earlier fix tripped a SESSION-WIDE breaker on the first fast decline, so
 * one ordinary "no" deleted the settle, defer and premise pickers for the rest
 * of the session. That trade is backwards: asking a blocked host again costs an
 * intercepted request nobody sees; guessing wrong costs the user every later
 * screen.
 *
 * 무엇이 이걸 빨간불로 만드나 — 각각 하나씩:
 *   1. 빠른 decline을 다시 `declined`로 돌린다        → 사용자가 안 한 결정을 사용자 것이라 함
 *   2. canElicit()이 관측 스트릭을 다시 본다            → 한 번의 거절이 이후 픽커를 전부 삭제
 *   3. 스트릭 문턱을 1로 내린다                        → 사람의 빠른 거절 한 번이 환경을 오진
 *   4. noteOutcome의 리셋을 지운다                     → 반증이 와도 오진이 안 풀림
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

const SLOW = UNREADABLE_DECLINE_MAX_MS + 120;

beforeEach(() => {
  setElicitor(null);
  resetElicitObservations();
});

describe('읽을 수 없이 빠른 거절', () => {
  it('사용자의 거절이라고 주장하지 않는다 — 정직한 no_answer로 돌려준다', async () => {
    wire([{ action: 'decline' }]);
    const out = await elicitDetailed('Record this?', { type: 'object', properties: {} });
    expect(out.kind).toBe('no_answer');
    expect(out.kind === 'no_answer' && out.reason).toBe('unattributable');
  });

  it('사람이 시간을 들여 누른 거절은 그대로 거절이다', async () => {
    wire([{ action: 'decline', delayMs: SLOW }]);
    const out = await elicitDetailed('Record this?', { type: 'object', properties: {} });
    expect(out.kind).toBe('declined');
  });

  it('전송 자체가 터진 것과는 구분된다 — 묻지도 않은 질문의 쿨다운이 걸려 있다', async () => {
    // ambient-elicit은 `failed`에서만 쿨다운을 되돌린다. 읽을 수 없이 빠른
    // 거절까지 `failed`로 뭉뚱그리면 보이지 않는 타이머가 영원히 재시도하거나,
    // 방금 거절한 사람에게 묻지도 않은 질문이 다시 간다.
    setElicitor(async () => { throw new Error('transport dead'); }, () => true);
    const thrown = await elicitDetailed('ask', { type: 'object', properties: {} });
    expect(thrown.kind === 'no_answer' && thrown.reason).toBe('failed');

    wire([{ action: 'decline' }]);
    const fast = await elicitDetailed('ask', { type: 'object', properties: {} });
    expect(fast.kind === 'no_answer' && fast.reason).toBe('unattributable');
  });
});

describe('오진의 피해 반경', () => {
  it('빠른 거절 한 번이 다음 픽커를 없애지 않는다 — 이어지는 Accept가 살아남는다', async () => {
    wire([{ action: 'decline' }, { action: 'accept', content: { outcome: 'held' } }]);
    const first = await elicitDetailed('seal?', { type: 'object', properties: {} });
    expect(first.kind).toBe('no_answer');

    // 이것이 회귀의 핵심: 예전 설계는 여기서 픽커를 이미 꺼버려 settle 화면이
    // 아예 뜨지 않았다.
    expect(canElicit()).toBe(true);
    const second = await elicitDetailed('settle?', { type: 'object', properties: {} });
    expect(second.kind).toBe('accepted');
    expect(second.kind === 'accepted' && second.content['outcome']).toBe('held');
  });

  it('빠른 거절 열 번이 이어져도 ask 자체는 계속 나간다', async () => {
    const w = wire(Array.from({ length: 10 }, () => ({ action: 'decline' as const })));
    for (let n = 0; n < 10; n += 1) {
      await elicitDetailed('ask', { type: 'object', properties: {} });
      expect(canElicit()).toBe(true);
    }
    expect(w.asked()).toBe(10);
  });
});

describe('환경 보고 (조언일 뿐, 게이트가 아니다)', () => {
  it('한 번으로는 차단으로 보지 않는다 — 사람도 한 번은 빨리 누른다', async () => {
    wire([{ action: 'decline' }]);
    await elicitDetailed('ask', { type: 'object', properties: {} });
    expect(elicitationLikelyBlocked()).toBe(false);
  });

  it('연속 두 번이면 화면을 안 보여주는 호스트로 보고한다', async () => {
    wire([{ action: 'decline' }, { action: 'decline' }]);
    await elicitDetailed('ask', { type: 'object', properties: {} });
    await elicitDetailed('ask', { type: 'object', properties: {} });
    expect(elicitationLikelyBlocked()).toBe(true);
  });

  it('반증이 하나라도 오면 스트릭이 풀린다 (사람은 한 번 거절하고 다른 일을 한다)', async () => {
    wire([{ action: 'decline' }, { action: 'accept', content: {} }, { action: 'decline' }]);
    await elicitDetailed('ask', { type: 'object', properties: {} });
    await elicitDetailed('ask', { type: 'object', properties: {} }); // accept — 리셋
    await elicitDetailed('ask', { type: 'object', properties: {} }); // 다시 1회째
    expect(elicitationLikelyBlocked()).toBe(false);
  });

  it('느린 거절은 스트릭을 쌓지 않는다', async () => {
    wire([{ action: 'decline', delayMs: SLOW }, { action: 'decline', delayMs: SLOW }]);
    await elicitDetailed('ask', { type: 'object', properties: {} });
    await elicitDetailed('ask', { type: 'object', properties: {} });
    expect(elicitationLikelyBlocked()).toBe(false);
  });

  it('cancel은 스트릭을 쌓지 않는다 — 창이 있었다는 뜻이다', async () => {
    wire([{ action: 'cancel' }, { action: 'cancel' }]);
    await elicitDetailed('ask', { type: 'object', properties: {} });
    await elicitDetailed('ask', { type: 'object', properties: {} });
    expect(elicitationLikelyBlocked()).toBe(false);
  });

  it('새 세션(setElicitor 재배선)은 관측을 잊는다', async () => {
    wire([{ action: 'decline' }, { action: 'decline' }]);
    await elicitDetailed('ask', { type: 'object', properties: {} });
    await elicitDetailed('ask', { type: 'object', properties: {} });
    expect(elicitationLikelyBlocked()).toBe(true);
    wire([{ action: 'accept', content: {} }]);
    expect(elicitationLikelyBlocked()).toBe(false);
  });
});
