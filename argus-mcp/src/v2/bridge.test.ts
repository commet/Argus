/**
 * 툴 브리지 테스트 — envelope 생성·바인딩·동사 왕복의 수용 기준.
 * 실제 임시 ARGUS_HOME + 실제 파일로 검증 (mock 없음 — 배선이 진짜인지가 관심사).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerRepository } from './ledger.js';
import { loadState } from './reducer.js';
import { deriveBrief } from './brief.js';
import {
  contextFor, harvestV2, InitRequiredError, premiseAddV2, sealV2, settleV2, snoozeV2,
  ulid, workspaceBinding, type V2Context,
} from './bridge.js';

let home: string;
let repoDir: string;
let repoId: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-br-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-br-repo-'));
  fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
  repoId = registerRepository(home, path.join(repoDir, '.git'));
});
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
});

const u = (value: string) => ({ value, provenance: 'elicited_user' as const });

function ctx(): V2Context {
  return contextFor({
    home, gitCommonDir: path.join(repoDir, '.git'),
    workspaceArgusDir: path.join(repoDir, '.argus'),
    sessionId: 's-1', producerVersion: '2.0.0-p1', today: '2026-07-11',
  });
}

describe('ulid', () => {
  it('emits 26 Crockford chars, unique across calls, time-prefixed', () => {
    const a = ulid(1_752_000_000_000);
    const b = ulid(1_752_000_000_000);
    expect(a).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(a.slice(0, 10)).toBe(b.slice(0, 10)); // 같은 ms → 같은 time prefix
    expect(a).not.toBe(b); // random tail
    expect(ulid(1_752_000_000_000) < ulid(1_852_000_000_000)).toBe(true); // 시간 순 prefix
  });
});

describe('contextFor — 바인딩 (II-D)', () => {
  it('refuses an unbound repo with INIT_REQUIRED — no auto-create, nothing written', () => {
    const strangeRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-br-x-'));
    fs.mkdirSync(path.join(strangeRepo, '.git'), { recursive: true });
    try {
      expect(() => contextFor({
        home, gitCommonDir: path.join(strangeRepo, '.git'),
        workspaceArgusDir: path.join(strangeRepo, '.argus'),
        sessionId: 's', producerVersion: 'v', today: '2026-07-11',
      })).toThrow(InitRequiredError);
      expect(fs.existsSync(path.join(strangeRepo, '.argus'))).toBe(false); // 부작용 0
    } finally {
      fs.rmSync(strangeRepo, { recursive: true, force: true });
    }
  });

  it('creates a stable workspace_id in .argus/project.json and reuses it', () => {
    const c1 = ctx();
    const c2 = ctx();
    expect(c1.workspace_id).toBe(c2.workspace_id); // 재호출에도 동일
    const onDisk = JSON.parse(fs.readFileSync(path.join(repoDir, '.argus', 'project.json'), 'utf8'));
    expect(onDisk).toEqual({ repository_id: repoId, workspace_id: c1.workspace_id });
  });

  it('refuses a workspace already bound to a DIFFERENT repository (WORKSPACE_REBIND)', () => {
    fs.mkdirSync(path.join(repoDir, '.argus'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, '.argus', 'project.json'),
      JSON.stringify({ repository_id: '9b2fd3a1-6c7e-4a2b-8d1f-2e3a4b5c6d7e', workspace_id: 'w' }));
    expect(() => workspaceBinding(path.join(repoDir, '.argus'), repoId)).toThrow(/WORKSPACE_REBIND/);
  });
});

describe('동사 왕복 — 툴이 부를 그대로', () => {
  it('seal(self-create) → brief due → settle, all through the bridge', () => {
    const c = ctx();
    const sealed = sealV2(c, {
      decisionId: 'q3-cutover',
      predicate: u('cutover downtime < 5 min'),
      checkBy: u('2026-07-11'), // 오늘 = 바로 due
      basis: 'judgment',
      humanJudgment: u('이건 내 판단'),
      idempotencyKey: 'q3-cutover:1',
    });
    expect(sealed.appended).toBe(true);

    const brief = deriveBrief(loadState(home, repoId), '2026-07-11');
    expect(brief.due.map((d) => d.decision_id)).toEqual(['q3-cutover']); // self-create로 봉인이 증발하지 않았다

    const settled = settleV2(c, {
      decisionId: 'q3-cutover',
      outcome: { value: 'held', provenance: 'elicited_user' },
      note: '3m 40s',
      idempotencyKey: 'q3-cutover:1',
    });
    expect(settled.appended).toBe(true);
    expect(deriveBrief(loadState(home, repoId), '2026-07-11').due).toEqual([]);
  });

  it('caller idempotency key survives retries; tool namespace separates seal/settle', () => {
    const c = ctx();
    sealV2(c, { decisionId: 'd', predicate: u('12345678'), checkBy: u('2026-08-01'), idempotencyKey: 'same' });
    // 같은 caller key로 settle — tool prefix가 다르므로 충돌하지 않는다.
    settleV2(c, { decisionId: 'd', outcome: { value: 'held', provenance: 'elicited_user' }, idempotencyKey: 'same' });
    const retry = settleV2(c, { decisionId: 'd', outcome: { value: 'held', provenance: 'elicited_user' }, idempotencyKey: 'same' });
    expect(retry.appended).toBe(false); // 재시도 = 중복 판정, 원장 무변
    expect(loadState(home, repoId).decisions.get('d')?.state).toBe('settled');
  });

  it('without a caller key, identical calls are separate events (documented non-idempotence)', () => {
    const c = ctx();
    harvestV2(c, { decisionId: 'a', text: u('x') });
    // 두 번째는 DECISION_EXISTS로 가드가 거절한다 — key가 없으니 중복 판정이 아니라 전이 위반.
    expect(() => harvestV2(c, { decisionId: 'a', text: u('x') })).toThrow(/DECISION_EXISTS/);
  });

  it('premise + snooze verbs land with envelope fields the schema demands', () => {
    const c = ctx();
    sealV2(c, { decisionId: 'd', predicate: u('12345678'), checkBy: u('2026-07-01') });
    premiseAddV2(c, { premiseId: 'p-1', decisionId: 'd', kind: 'fact', text: u('전제'), recheckCadenceDays: 7 });
    snoozeV2(c, { decisionId: 'd', until: '2026-07-20' });
    const s = loadState(home, repoId);
    expect(s.premises.get('p-1')?.added_on).toBe('2026-07-11'); // envelope logical_date가 흘러들어왔다
    expect(s.decisions.get('d')?.snoozed_until).toBe('2026-07-20');
    expect(s.anomalies).toEqual([]);
    expect(s.dropped_corrupt).toBe(0); // envelope가 스키마를 전부 만족했다는 뜻
  });
});
