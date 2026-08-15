import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { seal, resetSealSession } from '../seal.js';
import { decide } from '../public-tools.js';
import { replayLedger } from '../../lib/ledger-replay.js';
import { setElicitor } from '../../lib/elicit.js';

/**
 * 믿음 확인창 (입력 깊이 사이클 3) — 봉인 직후, 하중 믿음이 없는 결정에만
 * 사용자가 직접 타이핑하는 수집 창 하나를 연다. 칸의 문장은 모델을 거치지
 * 않으므로 저자성이 구조로 확보된다(user_stated + 원문 인용 + elicited).
 *
 * 지키는 규율: 이 호출에서 창이 이미 떴으면 두 번째 창 금지 · 하중 믿음이
 * 있으면 발화 금지 · 세션(원장)당 1회 · 거절과 무응답은 봉인을 해치지 않고
 * 조용히 존중 · 타이핑한 문장은 절대 잃지 않는다(too_long 되돌려주기).
 */

const TODAY = '2026-07-02';
const base = { predicate: 'shipped to TestFlight by the deadline', check_by: '2026-09-01', predicate_owner: 'user' as const, today_override: TODAY };

const typeBelief = (text: string) => async () => ({ action: 'accept' as const, content: { belief: text } });

beforeEach(() => resetSealSession());
afterEach(() => { setElicitor(null); resetSealSession(); });

describe('믿음 확인창 — 발화 게이트', () => {
  it('하중 믿음이 없는 사용자 봉인에서 창이 뜨고, 타이핑한 문장이 구조적 저자성으로 fold까지 남는다', async () => {
    const dir = tmpArgusDir();
    setElicitor(typeBelief('the review team stays at current capacity'));
    const r = body(await seal.handler({ argus_dir: dir, id: 'b1', ...base }));
    const data = r['data'] as Record<string, unknown>;
    expect(data['status']).toBe('sealed');
    const bw = data['belief_window'] as Record<string, unknown>;
    expect(bw['recorded']).toBe(true);
    expect(bw['ref']).toBe('P1');
    const prems = replayLedger(dir, TODAY).contracts.get('b1')?.premises ?? [];
    const p = prems.find((x) => x.text === 'the review team stays at current capacity');
    expect(p?.source).toBe('user_stated');
    expect(p?.anchor_quote).toBe('the review team stays at current capacity'); // 원문이 곧 인용
    expect(p?.elicited).toBe(true); // 채널 표식: 모델을 거치지 않았다
    expect(p?.load_bearing).toBe(true);
    expect(p?.external).toBe(false); // 검증 가능성은 추정하지 않는다 (승격과 같은 정직한 기본값)
    expect(String(r['surface'])).toContain('P1'); // 받았다는 사실을 한 줄로 돌려준다
  });

  it('unverified_assumption이 함께 오면 이미 가정이 이름을 얻었다: 창을 열지 않는다', async () => {
    const dir = tmpArgusDir();
    let asked = 0;
    setElicitor(async () => { asked++; return { action: 'accept' as const, content: {} }; });
    const r = body(await seal.handler({ argus_dir: dir, id: 'ua1', ...base, unverified_assumption: 'the vendor honors the quoted lead time' }));
    expect(asked).toBe(0);
    expect((r['data'] as Record<string, unknown>)['belief_window']).toBeUndefined();
  });

  it('살아있는 하중 전제가 이미 있으면 창을 열지 않는다', async () => {
    const dir = tmpArgusDir();
    let asked = 0;
    setElicitor(async () => { asked++; return { action: 'accept' as const, content: {} }; });
    await decide.handler({
      argus_dir: dir, action: 'open', id: 'lb1',
      decision: 'migrate billing to the new provider', stakes: 'high', reversibility: 'costly_to_reverse',
      status_quo: 'stay on the current provider', today_override: TODAY,
    });
    await decide.handler({
      argus_dir: dir, action: 'add_context', id: 'lb1',
      premises: [{ text: 'the migration window fits one weekend', source: 'user_stated', anchor_quote: 'one weekend is enough, I checked', external: true, load_bearing: true }],
      today_override: TODAY,
    });
    const r = body(await seal.handler({ argus_dir: dir, id: 'lb1', ...base }));
    expect(asked).toBe(0);
    expect((r['data'] as Record<string, unknown>)['belief_window']).toBeUndefined();
  });

  it('예측 확인창이 이미 떴으면(ai_surfaced) 두 번째 창을 열지 않는다: 호출당 창은 하나', async () => {
    const dir = tmpArgusDir();
    const messages: string[] = [];
    setElicitor(async (m) => { messages.push(m); return { action: 'accept' as const, content: {} }; });
    const r = body(await seal.handler({ argus_dir: dir, id: 'one1', ...base, predicate_owner: 'ai_surfaced' as const, confirm_draft: true }));
    expect(messages.length).toBe(1); // 예측 확인창만
    expect(messages[0].includes('Record this prediction') || messages[0].includes('기록할까요')).toBe(true);
    expect((r['data'] as Record<string, unknown>)['belief_window']).toBeUndefined();
  });

  it('세션(원장)당 1회: 연타 봉인 둘에 창은 첫 번째에만 뜬다', async () => {
    const dir = tmpArgusDir();
    let asked = 0;
    setElicitor(async () => { asked++; return { action: 'decline' as const }; });
    await seal.handler({ argus_dir: dir, id: 'n1', ...base });
    const r2 = body(await seal.handler({ argus_dir: dir, id: 'n2', ...base, predicate: 'churn stays under 3 percent through Q3' }));
    expect(asked).toBe(1);
    expect((r2['data'] as Record<string, unknown>)['belief_window']).toBeUndefined();
    expect((r2['data'] as Record<string, unknown>)['status']).toBe('sealed');
  });

  it('픽커 없는 호스트에서는 창 흔적조차 없다 (조용한 생략, 잔소리 없음)', async () => {
    const dir = tmpArgusDir();
    setElicitor(null);
    const r = body(await seal.handler({ argus_dir: dir, id: 'np1', ...base }));
    const data = r['data'] as Record<string, unknown>;
    expect(data['status']).toBe('sealed');
    expect(data['belief_window']).toBeUndefined();
  });
});

describe('믿음 확인창 — 응답 처리', () => {
  it('거절은 답이다: 봉인은 그대로, 아무것도 기록하지 않고, 사실만 data에 남는다', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => ({ action: 'decline' as const }));
    const r = body(await seal.handler({ argus_dir: dir, id: 'd1', ...base }));
    const data = r['data'] as Record<string, unknown>;
    expect(data['status']).toBe('sealed'); // 예측 확인창의 거절(기록 안 함)과 다르다: 봉인은 이미 원장에 있다
    expect((data['belief_window'] as Record<string, unknown>)['reason']).toBe('declined');
    expect(replayLedger(dir, TODAY).contracts.get('d1')?.premises ?? []).toHaveLength(0);
  });

  it('무응답(cancel)도 봉인을 해치지 않는다', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => ({ action: 'cancel' as const }));
    const r = body(await seal.handler({ argus_dir: dir, id: 'c1', ...base }));
    const data = r['data'] as Record<string, unknown>;
    expect(data['status']).toBe('sealed');
    expect((data['belief_window'] as Record<string, unknown>)['reason']).toBe('no_answer');
  });

  it('빈 채 Accept는 건너뛰기다: 기록 없음, 죄책감 없음', async () => {
    const dir = tmpArgusDir();
    setElicitor(async () => ({ action: 'accept' as const, content: {} }));
    const r = body(await seal.handler({ argus_dir: dir, id: 'e1', ...base }));
    const data = r['data'] as Record<string, unknown>;
    expect((data['belief_window'] as Record<string, unknown>)['reason']).toBe('left_blank');
    expect(replayLedger(dir, TODAY).contracts.get('e1')?.premises ?? []).toHaveLength(0);
  });

  it('400자 초과는 타이핑을 잃지 않는다: 원문을 되돌려주고 기록은 미룬다', async () => {
    const dir = tmpArgusDir();
    const long = 'b'.repeat(401);
    setElicitor(typeBelief(long));
    const r = body(await seal.handler({ argus_dir: dir, id: 'l1', ...base }));
    const bw = (r['data'] as Record<string, unknown>)['belief_window'] as Record<string, unknown>;
    expect(bw['reason']).toBe('too_long');
    expect((bw['user_input'] as Record<string, unknown>)['belief']).toBe(long); // 사용자의 문장은 절대 증발하지 않는다
    expect(replayLedger(dir, TODAY).contracts.get('l1')?.premises ?? []).toHaveLength(0);
  });

  it('같은 문장을 두 번 받으면 중복을 만들지 않는다 (승격 기계와 같은 규칙)', async () => {
    const dir = tmpArgusDir();
    setElicitor(typeBelief('the review team stays at current capacity'));
    await decide.handler({
      argus_dir: dir, action: 'open', id: 'dup1',
      decision: 'keep the release date', stakes: 'high', reversibility: 'costly_to_reverse',
      status_quo: 'slip the date', today_override: TODAY,
    });
    await decide.handler({
      argus_dir: dir, action: 'add_context', id: 'dup1',
      premises: [{ text: 'the review team stays at current capacity', source: 'user_stated', anchor_quote: 'capacity will hold, they told me', external: false, load_bearing: false }],
      today_override: TODAY,
    });
    const r = body(await seal.handler({ argus_dir: dir, id: 'dup1', ...base }));
    const bw = (r['data'] as Record<string, unknown>)['belief_window'] as Record<string, unknown>;
    expect(bw['recorded']).toBe(false);
    expect(bw['reason']).toBe('duplicate_or_cap');
    expect(replayLedger(dir, TODAY).contracts.get('dup1')?.premises ?? []).toHaveLength(1);
  });
});
