/**
 * The light path handed people a lean they never stated.
 *
 * Two unanimous H verdicts in the 2026-08-02 run — the light engine's own rule
 * 1 already forbids it ("사실에서 기울기를 추론하지도 마세요"), with its own ✗
 * example, and the model reworded around the ban twice:
 *
 *   user "내일 아침 일찍 일어나야 되긴 해"
 *   ✗    "내일 아침 일찍 일어나야 하니까 집 가는 쪽이 끌리시는 거네요."
 *
 *   user "엄마가 서운해하실 것 같아서요. 근데 밀린 일도 있어요"
 *   ✗    "엄마가 서운해하실까 봐 가고 싶으신데, 밀린 일이 걸려 있는 거."
 *
 * Both took a FACT the user gave and returned an INCLINATION as if it were
 * theirs. Repairing the prompt's contradictory exemplar cleared the gate beat
 * and left the turn beat doing it — the shape survives a ban and dies to a
 * clamp, which is the lesson this codebase keeps paying for.
 */
import { describe, expect, it } from 'vitest';
import { stripSuppliedLean } from '../light-engine';

describe('a lean with no source in their words', () => {
  it.each([
    ['끌리시는 거네요', '내일 아침 일찍 일어나야 하니까 집 가는 쪽이 끌리시는 거네요.'],
    ['가고 싶으신데', '엄마가 서운해하실까 봐 가고 싶으신데, 밀린 일이 걸려 있는 거예요.'],
    ['낫겠다 싶으신', '파티 끝나고 빨리 가서 잠 자는 게 낫겠다 싶으신 건데.'],
    ['쪽으로 기울', '내일이 있으니 집으로 가는 쪽으로 기울어져 있는 거네요.'],
    ['english', "Since you're up early, you're leaning toward heading home."],
  ])('is removed: %s', (_l, mirror) => {
    expect(stripSuppliedLean(mirror, ['내일 아침 일찍 일어나야 되긴 해.'])).toBe('');
  });

  it('takes only the offending sentence, not the whole mirror', () => {
    const mirror = '지난달에도 못 가셨고요. 엄마가 서운해하실까 봐 가고 싶으신데. 밀린 일도 있고요.';
    const out = stripSuppliedLean(mirror, ['엄마가 서운해하실 것 같아서요.']);
    expect(out).toContain('지난달에도 못 가셨고요.');
    expect(out).toContain('밀린 일도 있고요.');
    expect(out).not.toContain('싶으신');
  });
});

describe('reflecting a lean they DID state is honest mirroring', () => {
  it('keeps it when the user expressed an inclination', () => {
    const mirror = '집에 가는 쪽이 끌리시는 거네요.';
    expect(stripSuppliedLean(mirror, ['그냥 집에 가고 싶긴 해.'])).toBe(mirror);
  });

  it('keeps a plain reflection with no lean in it at all', () => {
    const mirror = '내일 아침 일찍 일어나야 하고, 지금은 재밌으신 거네요.';
    expect(stripSuppliedLean(mirror, ['내일 일찍 일어나야 돼.', '지금 좀 재밌긴 함.'])).toBe(mirror);
  });

  it('asking which way they lean is never a lean', () => {
    // The escape the whole rule exists to protect: reflect the fact, ASK the
    // inclination. A question about it must survive untouched.
    const mirror = '가고 싶으신 건지 가야 한다는 쪽인지는 아직 안 들었고요.';
    expect(stripSuppliedLean(mirror, ['지난달에도 못 갔거든요.'])).toBe(mirror);
  });
});

describe('the turn beat runs it, which is where it survived', () => {
  it('is wired into coerceLightTurn, where userTexts already lives', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/lib/light-path/light-engine.ts', 'utf8');
    expect(src).toContain('stripSuppliedLean(asTrimmedString(r.mirror), userTexts)');
  });

  it('the prompt no longer holds the violation up as its best example', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/lib/light-path/light-engine.ts', 'utf8');
    // It shipped for months as ✓ "(가장 사람다웠던 실제 출력)" — twelve lines
    // under the rule it breaks. The model copied it verbatim.
    expect(src).not.toContain('✓ (가장 사람다웠던 실제 출력)');
    expect(src).toContain('✗ "지난달에 못 가셨으니까 이번 주말엔 가야 하는 거 아닌가 싶으신 거네요."');
  });
});

/**
 * The last sentence of a session is the worst place to decide for someone.
 *
 * The F6 clamp already exists and its own header names "~하는 걸로 하고" as one
 * of the measured violations — while the pattern it ships never matched it.
 * Unanimous H across three judge runs, 2026-08-02: the user said only "피곤한
 * 쪽이 더 커" and the session closed with "그럼 토요일에 피곤한 대로 움직이시는
 * 걸로 하고 — 모임을 어떻게 하셨는지, 제가 한 번만 물어볼까요?".
 *
 * Naming which side is bigger is not choosing it.
 */
describe('an ask may not settle what the user did not', () => {
  const undecided = { problemText: '모임 끝나고 바로 올지 늦게까지 있을지 고민이야.', qas: [{ question: '지금 마음은?', answer: '피곤한 쪽이 더 커.' }] };
  const turn = (ask: string) => ({
    mirror: '피곤한 쪽이 크신 거네요.',
    action: 'offer' as const,
    offer: { sentence: '토요일 모임에서 일찍 나왔다', when: 'in_days' as const, days: 2, ask },
  });

  it('drops the settling ask', async () => {
    const { neutralizeUndecidedAsk } = await import('../light-engine');
    const out = neutralizeUndecidedAsk(
      turn('그럼 토요일에 피곤한 대로 움직이시는 걸로 하고 — 모임을 어떻게 하셨는지, 제가 한 번만 물어볼까요?'),
      undecided.problemText,
      undecided.qas,
    );
    expect(out.offer?.ask).toBeUndefined();
  });

  it('keeps an ask that only asks how it went', async () => {
    // The clamp's own lesson from an earlier run: dropping every tailored ask
    // gave five different people the same subject-less sentence. An ask that
    // presupposes nothing never needed neutralising.
    const { neutralizeUndecidedAsk } = await import('../light-engine');
    const ask = '그럼 토요일 모임에서 어떻게 하셨는지, 제가 한 번만 물어볼까요?';
    const out = neutralizeUndecidedAsk(turn(ask), undecided.problemText, undecided.qas);
    expect(out.offer?.ask).toBe(ask);
  });

  it('keeps a settling ask when the USER settled it', async () => {
    const { neutralizeUndecidedAsk } = await import('../light-engine');
    const ask = '그럼 일찍 나오시는 걸로 하고 — 토요일에 어떻게 됐는지 물어볼까요?';
    const out = neutralizeUndecidedAsk(
      turn(ask),
      undecided.problemText,
      [{ question: '어떻게 하실 거예요?', answer: '그냥 일찍 나오기로 했어.' }],
    );
    expect(out.offer?.ask).toBe(ask);
  });
});
