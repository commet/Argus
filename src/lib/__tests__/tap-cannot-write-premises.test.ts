/**
 * A tap is not evidence.
 *
 * Typed questions ship options carrying a `snapshotPatch` the model wrote in
 * advance, and the fork prompt used to demand "updated hidden_assumptions (2–3
 * items) + updated skeleton (5 items)" inside it. Applying that patch wrote
 * model-invented premises directly into the living state — no anchor, no
 * counterfactual, no trip through the premise contract. One tap and Argus
 * "knew" things the user never said, which is the manufactured-meaning trap the
 * spine exists to prevent.
 *
 * The premise contract is the only door in. Framing may still move on a tap:
 * choosing which question you are answering IS the user's own act.
 */
import { describe, expect, it } from 'vitest';
import { applySnapshotPatch } from '../question-types';
import type { AnalysisSnapshot } from '@/stores/types';

const base = {
  version: 1,
  real_question: '이직 오퍼와 승진 사이에서 무엇을 먼저 확인할까?',
  hidden_assumptions: ['사용자 말에 앵커된 전제'],
  skeleton: [],
  insight: '지금까지 나온 것',
} as unknown as AnalysisSnapshot;

describe('a tapped option cannot write premises or a plan', () => {
  it('discards model-authored premises riding inside the patch', () => {
    const patched = applySnapshotPatch(base, {
      hidden_assumptions: ['탭 한 번으로 들어온 전제', '또 하나'],
      skeleton: ['1단계', '2단계', '3단계', '4단계', '5단계'],
    } as never);
    expect(patched.hidden_assumptions).toEqual(['사용자 말에 앵커된 전제']);
    expect(patched.skeleton).toEqual([]);
  });

  it('still lets the user’s choice move the framing', () => {
    const patched = applySnapshotPatch(base, {
      real_question: '승진이 확정인지부터 확인할까?',
      insight: '방금 달라진 것',
    } as never);
    expect(patched.real_question).toBe('승진이 확정인지부터 확인할까?');
    expect(patched.insight).toBe('방금 달라진 것');
  });

  it('leaves the snapshot untouched when there is no patch', () => {
    expect(applySnapshotPatch(base, undefined)).toEqual(base);
  });
});
