import { describe, it, expect, afterEach } from 'vitest';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';
import { recall } from '../recall.js';
import { replayLedger } from '../../lib/ledger-replay.js';
import { setElicitor } from '../../lib/elicit.js';

/**
 * 귀환이 남기는 규칙 한 줄 (CONTEXT.md 의 `Lesson`).
 *
 * 제품의 약속은 "결정 → 현실 → 사용자가 승인한 배움 → 더 나은 다음 판단"이고,
 * MCP 에는 그 마지막 고리가 없었다 — 웹만 갖고 있었는데(ContractSettlement.
 * lesson) 재고 있는 여정은 전부 MCP 위에서 돈다.
 *
 * 지키는 규율: 현실이 예측에서 벗어난 정산에서만 묻는다(예측대로 된 귀환에
 * 규칙을 물으면 아무것도 안 움직인 자리에 규칙을 제조하는 과발화다) · 한
 * 호출에 창 하나 · 사용자가 타이핑한 문장 그대로, 모델 요약 금지 · 거절·무응답·
 * 빈 제출은 정산을 해치지 않는다 · 영수증을 다시 열면 그 규칙이 거기 있다.
 */

const T0 = '2026-07-02';
const AFTER = '2026-07-20';
const RULE = '재고 가정은 물류 리드타임과 같이 본다';

const typeLesson = (text: string) => async () => ({ action: 'accept' as const, content: { lesson: text } });

async function sealed(dir: string, id: string) {
  await seal.handler({
    argus_dir: dir, id, predicate: '신규 SKU 가 6주 안에 손익분기를 넘는다',
    check_by: '2026-07-15', predicate_owner: 'user', today_override: T0,
  });
}

afterEach(() => setElicitor(null));

describe('규칙 창 — 언제 여는가', () => {
  it('빗나간 정산에서 열리고, 타이핑한 문장이 사용자 저자성으로 fold까지 남는다', async () => {
    const dir = tmpArgusDir();
    await sealed(dir, 'r1');
    setElicitor(typeLesson(RULE));
    const r = body(await settle.handler({
      argus_dir: dir, id: 'r1', outcome: 'missed', outcome_source: 'user_stated',
      what_happened: '8주가 걸렸다. 초도 물량이 늦게 들어왔다', today_override: AFTER,
    }));
    const data = r['data'] as Record<string, unknown>;
    expect(data['lesson']).toBe(RULE);
    expect(data['lesson_authored']).toBe('user');
    expect(data['lesson_elicited']).toBe(true);
    const c = replayLedger(dir, AFTER).contracts.get('r1');
    expect(c?.lesson).toBe(RULE);
    expect(c?.lesson_elicited).toBe(true);
  });

  it('예측대로 된 정산에는 창을 열지 않는다 (과발화 금지)', async () => {
    const dir = tmpArgusDir();
    await sealed(dir, 'r2');
    let opened = 0;
    setElicitor(async () => { opened++; return { action: 'accept' as const, content: { lesson: RULE } }; });
    const r = body(await settle.handler({
      argus_dir: dir, id: 'r2', outcome: 'held', outcome_source: 'user_stated',
      what_happened: '5주 만에 넘었다', today_override: AFTER,
    }));
    expect(opened).toBe(0);
    expect((r['data'] as Record<string, unknown>)['lesson']).toBeUndefined();
    expect(replayLedger(dir, AFTER).contracts.get('r2')?.lesson).toBeUndefined();
  });

  it('결과를 모델이 안 줘서 창이 이미 떴으면 두 번째 창을 열지 않는다', async () => {
    const dir = tmpArgusDir();
    await sealed(dir, 'r3');
    const schemas: string[] = [];
    setElicitor(async (_msg: string, schema: unknown) => {
      schemas.push(Object.keys((schema as { properties?: object })?.properties ?? {}).join(','));
      return { action: 'accept' as const, content: { outcome: 'missed', what_happened: '안 됐다. 채널 하나가 통째로 빠졌다' } };
    });
    await settle.handler({ argus_dir: dir, id: 'r3', today_override: AFTER });
    expect(schemas.filter((s) => s.includes('lesson'))).toHaveLength(0);
  });
});

describe('규칙 창 — 창이 정산을 해치지 않는다', () => {
  for (const [name, elicitor] of [
    ['거절', async () => ({ action: 'decline' as const })],
    ['취소', async () => ({ action: 'cancel' as const })],
    ['빈 제출', async () => ({ action: 'accept' as const, content: { lesson: '   ' } })],
    ['호스트가 던짐', async () => { throw new Error('host blew up'); }], // elicit.ts가 no_answer로 바꾼다
  ] as const) {
    it(`${name} 이어도 정산은 그대로 저장된다`, async () => {
      const dir = tmpArgusDir();
      await sealed(dir, 'r4');
      setElicitor(elicitor as never);
      const r = body(await settle.handler({
        argus_dir: dir, id: 'r4', outcome: 'partial', outcome_source: 'user_stated',
        what_happened: '절반쯤 됐다', today_override: AFTER,
      }));
      expect(r['ok']).toBe(true);
      const c = replayLedger(dir, AFTER).contracts.get('r4');
      expect(c?.status).toBe('settled');
      expect(c?.what_happened).toBe('절반쯤 됐다');
      expect(c?.lesson).toBeUndefined();
    });
  }

  it('400자를 넘으면 기록하지 않고 정산만 남긴다 (몰래 자르지 않는다)', async () => {
    const dir = tmpArgusDir();
    await sealed(dir, 'r5');
    setElicitor(typeLesson('가'.repeat(401)));
    const r = body(await settle.handler({
      argus_dir: dir, id: 'r5', outcome: 'avoided', outcome_source: 'user_stated',
      what_happened: '걱정한 일은 안 일어났다', today_override: AFTER,
    }));
    expect(r['ok']).toBe(true);
    expect((r['data'] as Record<string, unknown>)['lesson']).toBeUndefined();
    expect(replayLedger(dir, AFTER).contracts.get('r5')?.lesson).toBeUndefined();
  });
});

describe('규칙 창 — 소비처', () => {
  it('영수증을 다시 열면 규칙이 거기 있다 (선언만 하고 안 읽히는 필드 금지)', async () => {
    const dir = tmpArgusDir();
    await sealed(dir, 'r6');
    setElicitor(typeLesson(RULE));
    await settle.handler({
      argus_dir: dir, id: 'r6', outcome: 'missed', outcome_source: 'user_stated',
      what_happened: '못 넘었다', today_override: AFTER,
    });
    setElicitor(null);
    const rec = body(await recall.handler({ argus_dir: dir, view: 'receipt', id: 'r6', today_override: AFTER }));
    const data = rec['data'] as Record<string, unknown>;
    expect(data['lesson']).toBe(RULE);
    expect(data['lesson_authored']).toBe('user');
  });

  it('표면은 규칙이 남았다는 사실만 말하고 문장을 되풀이하지 않는다', async () => {
    const dir = tmpArgusDir();
    await sealed(dir, 'r7');
    setElicitor(typeLesson(RULE));
    const r = body(await settle.handler({
      argus_dir: dir, id: 'r7', outcome: 'missed', outcome_source: 'user_stated',
      what_happened: '못 넘었다', today_override: AFTER,
    }));
    const surface = String(r['surface']);
    expect(surface).toContain('규칙');
    expect(surface).not.toContain(RULE); // 되읊으면 기계가 저자인 척하는 쪽으로 읽힌다
  });
});
