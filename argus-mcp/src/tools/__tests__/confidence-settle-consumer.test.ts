import { describe, it, expect, afterEach } from 'vitest';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { seal } from '../seal.js';
import { settle } from '../settle.js';
import { recall } from '../recall.js';
import { setElicitor } from '../../lib/elicit.js';

/**
 * 정산 대조 소비처 (입력 깊이 사이클 4) — 봉인 때 수집된 확신도가 정산 순간에
 * 소비되는 전선. 규율: 병치는 사실뿐(평가 어휘 0), 집계는 개수+근거 id뿐
 * (비율·등급·백분율은 성적이 된다), 표본 임계(5) 미달이면 경향 판단 유보 명시,
 * 채점 대상은 사용자가 아니라 사전등록된 예측임을 데이터가 밝힌다.
 */

const T0 = '2026-07-02';
const LATER = '2026-09-10';

afterEach(() => setElicitor(null));

async function sealOne(dir: string, id: string, opts: { confidence?: 'confident' | 'uncertain' | 'contested' } = {}): Promise<void> {
  const r = await seal.handler({
    argus_dir: dir, id,
    predicate: `metric ${id} stays above the agreed floor through Q3`,
    check_by: '2026-09-01', predicate_owner: 'user', today_override: T0,
    // 믿음 확인창(사이클 3)이 비계에서 발화하지 않도록 가정을 함께 준다.
    unverified_assumption: `baseline for ${id} was measured correctly`,
    ...(opts.confidence ? { confidence: opts.confidence } : {}),
  });
  expect(body(r)['ok']).toBe(true);
}

async function settleOne(dir: string, id: string, outcome: 'held' | 'missed'): Promise<Record<string, unknown>> {
  const r = body(await settle.handler({
    argus_dir: dir, id, outcome, outcome_source: 'user_stated',
    what_happened: `reality answered for ${id} in plain words`,
    today_override: LATER,
  }));
  expect(r['ok']).toBe(true);
  return r;
}

describe('정산의 대조 한 줄 — 봉인 확신도의 병치', () => {
  it('확신도가 실린 봉인의 정산은 surface와 data에 사실 병치를 싣는다', async () => {
    const dir = tmpArgusDir();
    await sealOne(dir, 'c1', { confidence: 'confident' });
    const r = await settleOne(dir, 'c1', 'missed');
    expect((r['data'] as Record<string, unknown>)['sealed_confidence']).toBe('confident');
    expect(String(r['surface'])).toContain("Confidence recorded at seal: 'confident'");
  });

  it('확신도 없는 봉인의 정산에는 흔적조차 없다 (키도 줄도 없음)', async () => {
    const dir = tmpArgusDir();
    await sealOne(dir, 'p1');
    const r = await settleOne(dir, 'p1', 'held');
    expect('sealed_confidence' in (r['data'] as Record<string, unknown>)).toBe(false);
    expect(String(r['surface'])).not.toContain('Confidence recorded');
  });

  it('병치는 사실뿐이다: 평가 어휘가 없다', async () => {
    const dir = tmpArgusDir();
    await sealOne(dir, 'e1', { confidence: 'confident' });
    const r = await settleOne(dir, 'e1', 'missed');
    // confident인데 missed — 판정 어휘가 나오기 가장 쉬운 조합에서 잰다.
    const s = String(r['surface']);
    for (const banned of ['과신', '과대', '잘못된 확신', 'overconfiden', 'miscalibrat', 'wrong to be']) {
      expect(s.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });
});

describe('track_record의 보정 기록 — 개수와 근거 id만', () => {
  it('확신도별 결과 개수 + 근거 id를 집계하고, 표본 5 미만이면 판단 유보를 명시한다', async () => {
    const dir = tmpArgusDir();
    await sealOne(dir, 'a1', { confidence: 'confident' });
    await sealOne(dir, 'a2', { confidence: 'confident' });
    await sealOne(dir, 'a3', { confidence: 'uncertain' });
    await sealOne(dir, 'a4'); // 확신도 없는 봉인은 집계 대상이 아니다
    await settleOne(dir, 'a1', 'held');
    await settleOne(dir, 'a2', 'missed');
    await settleOne(dir, 'a3', 'held');
    await settleOne(dir, 'a4', 'held');

    const r = body(await recall.handler({ argus_dir: dir, view: 'track_record', today_override: LATER }));
    const rec = (r['data'] as Record<string, unknown>)['confidence_record'] as Record<string, unknown>;
    expect(rec['n']).toBe(3);
    const by = rec['by_confidence'] as Record<string, { n: number; outcomes: Record<string, number>; ids: string[] }>;
    expect(by['confident'].n).toBe(2);
    expect(by['confident'].outcomes).toEqual({ held: 1, missed: 1 });
    expect(by['confident'].ids.sort()).toEqual(['a1', 'a2']);
    expect(by['uncertain'].outcomes).toEqual({ held: 1 });
    expect(String(rec['sample_note'])).toContain('Fewer than 5');
    expect(String(rec['scored_object'])).toContain('never the person');
  });

  it('확신도 실린 정산이 하나도 없으면 블록 자체가 없다', async () => {
    const dir = tmpArgusDir();
    await sealOne(dir, 'z1');
    await settleOne(dir, 'z1', 'held');
    const r = body(await recall.handler({ argus_dir: dir, view: 'track_record', today_override: LATER }));
    expect('confidence_record' in (r['data'] as Record<string, unknown>)).toBe(false);
  });

  it('표본 5 이상이면 유보 노트가 사라진다 (숫자는 그대로 개수뿐)', async () => {
    const dir = tmpArgusDir();
    for (let i = 1; i <= 5; i++) await sealOne(dir, `b${i}`, { confidence: 'uncertain' });
    for (let i = 1; i <= 5; i++) await settleOne(dir, `b${i}`, i % 2 ? 'held' : 'missed');
    const r = body(await recall.handler({ argus_dir: dir, view: 'track_record', today_override: LATER }));
    const rec = (r['data'] as Record<string, unknown>)['confidence_record'] as Record<string, unknown>;
    expect(rec['n']).toBe(5);
    expect('sample_note' in rec).toBe(false);
  });

  it('비율·등급·백분율은 어디에도 없다 (개수와 id만이 사실이다)', async () => {
    const dir = tmpArgusDir();
    await sealOne(dir, 'r1', { confidence: 'contested' });
    await settleOne(dir, 'r1', 'missed');
    const r = body(await recall.handler({ argus_dir: dir, view: 'track_record', today_override: LATER }));
    const json = JSON.stringify((r['data'] as Record<string, unknown>)['confidence_record']);
    expect(json).not.toMatch(/rate|percent|grade|score(?!d_object)|accuracy|%/i);
  });
});
