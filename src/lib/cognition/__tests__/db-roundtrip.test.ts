import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { elementToRow, frameToRow, readingToRow, rowToElement, rowToReading, rowsToFrame } from '../db';
import { addElement, emptyFrame, makeElement, recordReading, sealFrame, settleFrame } from '../frame';
import { readingFrom, watchToBinding, type WatchSetup } from '../watch';
import type { CognitiveFrame } from '../types';

/**
 * 지속 계층 왕복 — **한 번도 실행된 적 없는 코드를 실행해 둔다.**
 *
 * 진단에서 나온 것: `db.ts` 의 여섯 함수는 어떤 화면도 부르지 않는다.
 * 테이블은 실재하고 RLS·불변식 시험도 통과했는데, 그 사이를 잇는 코드만
 * 한 줄도 돈 적이 없다. 그러면 서버로 승격하는 날이 **그 코드가 처음 도는
 * 날**이 되고, 실패는 사용자 데이터 위에서 난다.
 *
 * 이 테스트가 실제로 잡은 것: `elementToRow` 가 `created_at` 을 안 실어
 * 보냈다. 컬럼 기본값이 `now()` 라 8월 1일에 쓴 문장이 20일에 동기화되면
 * DB는 20일에 쓴 것이라고 말한다 — 빈티지 보존(P1)이 막으려는 바로 그 일이다.
 */
const w: WatchSetup = {
  what: '전환율', where: '대시보드 A', normal: '3%', wobble: '0.2%p', broken: '2%',
  why: '2% 밑이면 광고비가 안 빠집니다',
};

/** 있을 수 있는 것을 다 담은 프레임 — 봉인·건넘·판독·정산까지. */
function richFrame(): CognitiveFrame {
  let f = emptyFrame({ id: 'f1', userId: 'u1', title: '광고비를 두 배로 올린다', now: Date.parse('2026-08-01T00:00:00Z') });
  const at = Date.parse('2026-08-01T00:00:00Z');
  for (const [axis, text] of [
    ['frame', '지금 성장 국면이라고 보고 있다'],
    ['values', '성장이 이익보다 먼저다'],
    ['premises', '전환율이 지금 수준으로 유지된다'],
    ['falsifier', '전환율이 2% 밑으로 가면 틀린 것이다'],
  ] as const) {
    f = addElement(f, makeElement({ id: `f1-${axis}`, axis, text, touched: true, now: at }), at);
  }
  // AI 초안을 그대로 둔 원소 하나 — 저자성·이해 게이트 필드가 채워진다.
  f = addElement(
    f,
    makeElement({ id: 'f1-inference', axis: 'inference', text: '그래서 지금이 적기다', aiDraft: '그래서 지금이 적기다', now: at }),
    at,
  );
  const binding = watchToBinding(w);
  f = { ...f, elements: f.elements.map((el) => (el.axis === 'premises' ? { ...el, bindings: [binding] } : el)) };

  const sealed = sealFrame({ frame: f, now: at });
  if (!sealed.ok) throw new Error(sealed.messages.join(' / '));
  let out = recordReading(sealed.frame, readingFrom(w, { value: '2.4%', observedAt: '2026-08-02T00:00:00Z' }), Date.parse('2026-08-02T00:00:00Z'));
  out = recordReading(out, readingFrom(w, { value: '', unreadReason: '대시보드가 안 열렸다', observedAt: '2026-08-03T00:00:00Z' }), Date.parse('2026-08-03T00:00:00Z'));
  return settleFrame({
    frame: out,
    settlement: {
      falsifier_observed: true,
      observed: '전환율이 1.9% 로 떨어졌다',
      evidence_ref: 'dash:2026-08-10',
      observed_at: '2026-08-10T00:00:00Z',
      retrospective: '광고 단가를 과소평가했다',
    },
    now: Date.parse('2026-08-10T00:00:00Z'),
  });
}

/** DB 왕복 흉내 — 행으로 바꿨다가 그대로 읽어 온다. */
function roundTrip(f: CognitiveFrame): CognitiveFrame {
  return rowsToFrame({
    frame: frameToRow(f),
    elements: f.elements.map((el) => elementToRow(el, f.id, f.user_id)),
    readings: f.readings.map((r) => readingToRow(r, f.id, f.user_id)),
  });
}

describe('지속 계층 왕복 — 나갔다 온 판단이 같은 판단인가', () => {
  const before = richFrame();
  const after = roundTrip(before);

  it('프레임의 정체가 그대로다', () => {
    expect(after.id).toBe(before.id);
    expect(after.user_id).toBe(before.user_id);
    expect(after.title).toBe(before.title);
    expect(after.status).toBe(before.status);
    expect(after.sealed_at).toBe(before.sealed_at);
  });

  it('**언제 쓴 문장인가가 보존된다** — 동기화 시각으로 덮이지 않는다', () => {
    expect(after.created_at).toBe(before.created_at);
    for (const el of before.elements) {
      const back = after.elements.find((x) => x.id === el.id)!;
      expect(back.created_at, `${el.axis}: 문장을 쓴 시각`).toBe(el.created_at);
      expect(back.authorship.recorded_at, `${el.axis}: 저자성 기록 시각`).toBe(el.authorship.recorded_at);
    }
  });

  it('원소가 하나도 안 빠지고 같은 문장이다', () => {
    expect(after.elements).toHaveLength(before.elements.length);
    for (const el of before.elements) {
      const back = after.elements.find((x) => x.id === el.id)!;
      expect(back.text).toBe(el.text);
      expect(back.axis).toBe(el.axis);
    }
  });

  it('저자성이 그대로다 — 손대지 않은 AI 문장이 사람 문장으로 둔갑하지 않는다', () => {
    const ai = before.elements.find((e) => e.axis === 'inference')!;
    const back = after.elements.find((x) => x.id === ai.id)!;
    expect(back.authorship.authored).toBe(ai.authorship.authored);
    expect(back.authorship.wording_source).toBe(ai.authorship.wording_source);
    expect(back.authorship.revision_distance).toBe(ai.authorship.revision_distance);
    expect(back.authorship.revision_rounds).toBe(ai.authorship.revision_rounds);
  });

  it('두 세계와 그 증거가 그대로다', () => {
    const p = before.elements.find((e) => e.axis === 'premises')!;
    const back = after.elements.find((x) => x.id === p.id)!;
    expect(p.world).toBe('reality_contact');
    expect(back.world).toBe(p.world);
    expect(back.crossings).toEqual(p.crossings);
  });

  it('이해 게이트 상태와 결박이 그대로다', () => {
    for (const el of before.elements) {
      const back = after.elements.find((x) => x.id === el.id)!;
      expect(back.comprehension).toEqual(el.comprehension);
      expect(back.bindings).toEqual(el.bindings);
    }
  });

  it('정산이 그대로다 — 봉인 당시 문장과 나중 결과가 둘 다 남는다', () => {
    expect(after.settlement).toEqual(before.settlement);
  });

  it('판독 원장이 그대로다 — 미판독도 함께 돌아온다', () => {
    expect(after.readings).toHaveLength(before.readings.length);
    expect(after.readings.map((r) => r.verdict).sort()).toEqual(['holds', 'unread']);
    const unread = after.readings.find((r) => r.verdict === 'unread')!;
    expect(unread.value).toBeNull();
    expect(unread.unread_reason).toBe('대시보드가 안 열렸다');
  });

  it('두 번 왕복해도 더 변하지 않는다 (멱등)', () => {
    expect(roundTrip(after)).toEqual(after);
  });
});

describe('행이 이상해도 조용히 지어내지 않는다', () => {
  it('모르는 축은 버리되 null 로 알린다 — 조용히 다른 축으로 만들지 않는다', () => {
    expect(rowToElement({ axis: '없는축', body: '문장' })).toBeNull();
  });

  it('빈 행에서 저자성을 지어내지 않는다 — 모르면 legacy_unknown 이다', () => {
    const el = rowToElement({ axis: 'premises', body: '문장' })!;
    expect(el.authorship.wording_source).toBe('legacy_unknown');
    // 편집 거리 fallback 은 1(=완전히 다른 문장). 0이면 "손대지 않았다"가 되어
    // 정반대 사실이 기록된다.
    expect(el.authorship.revision_distance).toBe(1);
  });

  it('건넘 증거 없이 reality_contact 라고 적힌 행은 프레임 안으로 되돌린다', () => {
    const el = rowToElement({ axis: 'premises', body: '문장', world: 'reality_contact', crossings: [] })!;
    expect(el.world).toBe('in_frame');
  });

  it('판독값이 없으면 unread 이고 값을 추정하지 않는다', () => {
    const r = rowToReading({ binding_kind: '전환율', target: '대시보드', value: null, verdict: 'unread', observed_at: '2026-08-01T00:00:00Z' });
    expect(r.value).toBeNull();
    expect(r.verdict).toBe('unread');
  });
});

describe('행 모양이 실제 테이블과 맞는가', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260817000000_cognitive_frames_seven_axes.sql'),
    'utf8',
  );
  const columnsOf = (table: string): Set<string> => {
    const start = sql.indexOf(`create table if not exists public.${table} (`);
    const body = sql.slice(start, sql.indexOf('\n);', start));
    const cols = new Set<string>();
    for (const line of body.split('\n').slice(1)) {
      const m = /^\s{2}([a-z_]+)\s+(uuid|text|jsonb|numeric|smallint|timestamptz|boolean|integer)/.exec(line);
      if (m) cols.add(m[1]);
    }
    return cols;
  };

  /**
   * PostgREST 는 없는 컬럼 하나에 **행 전체를 PGRST204 로 거부**하고, 그 에러는
   * 삼켜진다 (CLAUDE.md Schema Sync). 그러면 그 사용자의 데이터가 조용히 서버에
   * 안 닿는다. 그래서 보내는 키가 전부 실재하는지 여기서 못박는다.
   */
  it.each([
    ['cognitive_frames', frameToRow(richFrame())],
    ['cognitive_frame_elements', elementToRow(richFrame().elements[0], 'f1', 'u1')],
    ['cognitive_frame_readings', readingToRow(richFrame().readings[0], 'f1', 'u1')],
  ])('%s 로 보내는 키가 전부 실재한다', (table, row) => {
    const cols = columnsOf(table);
    expect(cols.size).toBeGreaterThan(3);
    const missing = Object.keys(row).filter((k) => !cols.has(k));
    expect(missing, `${table} 에 없는 컬럼으로 보내고 있습니다: ${missing.join(', ')}`).toEqual([]);
  });
});
