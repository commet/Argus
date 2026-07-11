/**
 * v1 리더 + 위치 이전 테스트 — "과거 이벤트는 영원히 읽는다"(II-E)와
 * v1→v2 이전(II-F)의 수용 기준.
 *
 * 픽스처: 리포에 커밋된 **진짜 v1 원장**을 그대로 쓴다
 * (docs/receipts/2026-07-11-v2-schedule/.argus/ledger/ledger.jsonl — 실제
 * argus-decision-mcp 1.1.0이 stdio로 쓴 파일. 합성 아님). published 패키지
 * 밖에서만 존재하므로 부재 시 해당 테스트는 정직하게 skip.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerRepository } from './ledger.js';
import { appendEventGuarded, emptyState, loadState } from './reducer.js';
import { foldV1, migrateV1Ledger, readV1File, v1LedgerPath, type V1Event } from './v1-reader.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const REAL_V1 = path.resolve(here, '..', '..', '..',
  'docs', 'receipts', '2026-07-11-v2-schedule', '.argus', 'ledger', 'ledger.jsonl');
const hasRealV1 = fs.existsSync(REAL_V1);

let home: string;
let repoDir: string;
let repoId: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-v1r-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-v1r-repo-'));
  fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
  repoId = registerRepository(home, path.join(repoDir, '.git'));
});
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
});

describe('readV1File — 진짜 v1 원장 (실서버가 쓴 파일)', () => {
  it.skipIf(!hasRealV1)('reads the committed schedule-seal ledger cleanly', () => {
    const r = readV1File(REAL_V1);
    expect(r.events.map((e) => e.event)).toEqual(['harvest', 'seal', 'premise_add']);
    expect(r.skipped_unknown).toBe(0);
    expect(r.dropped_corrupt).toBe(0);
  });

  it.skipIf(!hasRealV1)('folds it into a sealed decision with downgraded provenance', () => {
    const state = emptyState();
    foldV1(state, readV1File(REAL_V1).events);
    const d = state.decisions.get('v2-rebuild-schedule')!;
    expect(d.state).toBe('sealed');
    expect(d.check_by?.value).toBe('2026-10-03');
    expect(d.predicate?.provenance).toBe('host_reported'); // 하향 — 위조 없는 방향
    const p = [...state.premises.values()][0];
    expect(p.load_bearing).toBe(true);
    expect(p.text.provenance).toBe('host_reported'); // v1 source:user_stated → 하향
  });
});

describe('foldV1 — 합성 v1 여정 (defer·watch·gate 포함)', () => {
  const j = (extra: V1Event[] = []): V1Event[] => [
    { v: 1, ts: '2026-06-01T00:00:00Z', id: 'd1', event: 'harvest', decision: '결정 텍스트' },
    { v: 1, ts: '2026-06-01T00:01:00Z', id: 'd1', event: 'seal', predicate: '예측 문장', check_by: '2026-06-15' },
    ...extra,
  ];

  it('defer re-arms check_by, keeps sealed, and preserves history in extras', () => {
    const state = emptyState();
    const extras = foldV1(state, j([
      { v: 1, ts: '2026-06-15T00:00:00Z', id: 'd1', event: 'defer', from: '2026-06-15', check_by: '2026-06-29', note: '아직 현실이 답 안 줌' },
    ]));
    const d = state.decisions.get('d1')!;
    expect(d.state).toBe('sealed');
    expect(d.check_by?.value).toBe('2026-06-29');
    expect(extras.defers).toEqual([{ id: 'd1', from: '2026-06-15', to: '2026-06-29', note: '아직 현실이 답 안 줌' }]);
  });

  it('maps v1 predicate_owner honestly: ai_surfaced stays, user downgrades to host_reported', () => {
    const state = emptyState();
    foldV1(state, [
      { v: 1, id: 'a', event: 'seal', predicate: 'ai가 쓴 것', check_by: '2026-06-15', predicate_owner: 'ai_surfaced' },
      { v: 1, id: 'b', event: 'seal', predicate: 'user가 확인한 것', check_by: '2026-06-15', predicate_owner: 'user' },
    ]);
    expect(state.decisions.get('a')?.predicate?.provenance).toBe('ai_surfaced');
    expect(state.decisions.get('b')?.predicate?.provenance).toBe('host_reported'); // 위로 위조 금지
  });

  it('keeps watch/gate events out of the decision machine but counts them in extras', () => {
    const state = emptyState();
    const extras = foldV1(state, [
      { v: 1, id: 'w', event: 'watch_anchor', date: '2026-06-01', text: '오늘 여기까지' },
      { v: 1, id: 'w', event: 'watch_capture', date: '2026-06-01', kind: 'claim', text: '이건 전제다', source: 'user_stated' },
      { v: 1, id: 'g', event: 'gate_input' },
    ]);
    expect(state.decisions.size).toBe(0); // 앵커는 내기가 아니다 (§9.2-3)
    expect(extras.anchors).toHaveLength(1);
    expect(extras.captures[0].text).toBe('이건 전제다');
    expect(extras.gate_inputs).toBe(1);
  });

  it('counts unknown v1 events and corrupt lines separately, strips BOM', () => {
    const f = path.join(home, 'v1-messy.jsonl');
    fs.writeFileSync(f, '﻿' + [
      JSON.stringify({ v: 1, id: 'd1', event: 'harvest', decision: 'x' }),
      '{"v":1,"event":"mystery_v1_event"}',
      '{"broken json',
    ].join('\n') + '\n');
    const r = readV1File(f);
    expect(r.events).toHaveLength(1); // BOM이 있어도 첫 줄이 산다
    expect(r.skipped_unknown).toBe(1);
    expect(r.dropped_corrupt).toBe(1);
  });
});

describe('migrateV1Ledger — 복사, 원본 보존, 재실행 멱등 (II-F)', () => {
  let source: string;
  beforeEach(() => {
    source = path.join(repoDir, '.argus', 'ledger', 'ledger.jsonl');
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, JSON.stringify({ v: 1, id: 'd1', event: 'harvest', decision: 'x' }) + '\n');
  });

  it('copies to the durable v1 slot and leaves the original untouched', () => {
    const before = fs.readFileSync(source, 'utf8');
    const r = migrateV1Ledger(home, repoId, source);
    expect(r).toMatchObject({ action: 'copied', lines: 1 });
    expect(fs.readFileSync(v1LedgerPath(home, repoId), 'utf8')).toBe(before);
    expect(fs.readFileSync(source, 'utf8')).toBe(before); // 원본 그대로 — 이동·삭제 금지
  });

  it('re-run stays a no-op FOREVER, even after the source grows (경계 고정 — 성장분은 미러가 커버)', () => {
    migrateV1Ledger(home, repoId, source);
    expect(migrateV1Ledger(home, repoId, source).action).toBe('already_migrated');
    // dual-write 시대: v1 원본은 계속 자란다 — 재이전하면 이중 표현이므로 no-op이어야 한다.
    fs.appendFileSync(source, '{"v":1,"id":"d2","event":"harvest","decision":"y"}\n');
    expect(migrateV1Ledger(home, repoId, source).action).toBe('already_migrated');
    expect(fs.readFileSync(v1LedgerPath(home, repoId), 'utf8')).not.toContain('"d2"'); // 스냅샷 동결
  });

  it('a SECOND, different v1 history refuses loudly (두 역사의 병합은 사람의 결정)', () => {
    migrateV1Ledger(home, repoId, source);
    const other = path.join(repoDir, 'other-ledger.jsonl');
    fs.writeFileSync(other, '{"v":1,"id":"z","event":"harvest","decision":"다른 역사"}\n');
    expect(() => migrateV1Ledger(home, repoId, other)).toThrow(/MIGRATION_CONFLICT/);
  });

  it('missing source is a named state, not an error', () => {
    expect(migrateV1Ledger(home, repoId, path.join(repoDir, 'nope.jsonl')).action).toBe('source_missing');
  });

  it('backs up an existing v2 ledger before the copy lands', () => {
    appendEventGuarded(home, repoId, v2SettleReadyEvent('pre-existing'));
    const r = migrateV1Ledger(home, repoId, source);
    expect(r.action).toBe('copied');
    expect(r.backup && fs.existsSync(r.backup)).toBe(true);
  });
});

// v2 이벤트 조립 헬퍼 (연속성 테스트용)
function v2SettleReadyEvent(decisionId: string): Record<string, unknown> {
  return {
    event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4C6D', v: 2, producer_version: '2.0.0-p1',
    repository_id: repoId, workspace_id: '9b2fd3a1-6c7e-4a2b-8d1f-2e3a4b5c6d7e',
    session_id: 's-1', occurred_at: '2026-07-11T10:30:00Z', logical_date: '2026-07-11',
    tz: 'Asia/Seoul', idempotency_key: `harvest:${decisionId}:1`,
    event: 'harvest', decision_id: decisionId,
    text: { value: 'x', provenance: 'elicited_user' },
  };
}

describe('연속성 — v1에서 봉인한 결정을 v2가 정산한다', () => {
  it.skipIf(!hasRealV1)('v2 settle lands on the v1-sealed decision through the guard', () => {
    migrateV1Ledger(home, repoId, REAL_V1);
    const r = appendEventGuarded(home, repoId, {
      event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4E6F', v: 2, producer_version: '2.0.0-p1',
      repository_id: repoId, workspace_id: '9b2fd3a1-6c7e-4a2b-8d1f-2e3a4b5c6d7e',
      session_id: 's-1', occurred_at: '2026-10-03T09:00:00Z', logical_date: '2026-10-03',
      tz: 'Asia/Seoul', idempotency_key: 'settle:v2-rebuild-schedule:1',
      event: 'settle', decision_id: 'v2-rebuild-schedule',
      outcome: { value: 'held', provenance: 'elicited_user' },
    });
    expect(r.appended).toBe(true);
    const s = loadState(home, repoId);
    expect(s.decisions.get('v2-rebuild-schedule')?.state).toBe('settled'); // v1 봉인 + v2 정산 = 한 결정
    expect(s.v1_extras).toBeDefined();
    expect(s.anomalies).toEqual([]);
  });

  it('double-settling a v1-settled decision is refused (guard sees v1 state)', () => {
    fs.mkdirSync(path.dirname(v1LedgerPath(home, repoId)), { recursive: true });
    fs.writeFileSync(v1LedgerPath(home, repoId), [
      JSON.stringify({ v: 1, id: 'old', event: 'harvest', decision: 'x' }),
      JSON.stringify({ v: 1, id: 'old', event: 'seal', predicate: 'p12345678', check_by: '2026-06-15' }),
      JSON.stringify({ v: 1, id: 'old', event: 'settle', outcome: 'held' }),
    ].join('\n') + '\n');
    const { text: _harvestOnly, ...base } = v2SettleReadyEvent('old');
    expect(() => appendEventGuarded(home, repoId, {
      ...base, event: 'settle', idempotency_key: 'settle:old:1',
      outcome: { value: 'missed', provenance: 'elicited_user' },
    })).toThrow(/ALREADY_SETTLED/);
  });
});

describe('그물 회귀 (P4-5 재검토 발견 A): v1 미봉인 결정도 조용히 사라지지 않는다', () => {
  it('fold된 v1 harvest는 harvested_on(ts 날짜)을 얻어 unsealed_net에 뜬다', async () => {
    const { deriveBrief } = await import('./brief.js');
    const state = emptyState();
    foldV1(state, [
      { v: 1, event: 'harvest', id: 'v1-open', decision: '옛날에 잡고 봉인 안 한 것', ts: '2026-05-01T09:00:00+09:00' },
      { v: 1, event: 'harvest', id: 'v1-sealed', decision: '봉인된 것', ts: '2026-05-01T09:00:00+09:00' },
      { v: 1, event: 'seal', id: 'v1-sealed', predicate: 'p', check_by: '2099-01-01' },
    ] as unknown as V1Event[]);
    const brief = deriveBrief(
      { ...state, skipped_unknown: 0, dropped_corrupt: 0, last_event_id: null }, '2026-07-11');
    expect(brief.unsealed_net).toEqual([
      { decision_id: 'v1-open', text: '옛날에 잡고 봉인 안 한 것', harvested_on: '2026-05-01' },
    ]);
  });
});
