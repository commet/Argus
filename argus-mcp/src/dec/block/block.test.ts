import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decideBlock } from './decide.js';
import { sayBlock } from './say.js';
import { runDecBlockCli } from '../dec-cli.js';
import { signDecision } from '../write.js';
import type { DecisionRecord, DecSignedPayload } from '../types.js';
import type { WatchRule } from '../watch/rule.js';

const WATCH: WatchRule = {
  paths: ['src/app/**'], phrases: ['이름으로 죽이기'],
  except_paths: [], except_phrases: [],
  blind_spots: ['다른 이름으로 부르면 못 잡는다'], mode: 'machine',
};

const rec = (id: string, extra: Partial<DecisionRecord> = {}): DecisionRecord => ({
  id, type: 'ban', decision: `${id} 은 하지 않는다`, scope: 'repo', binds: '나', author: '나',
  provenance: 'user', adopted: '2026-08-01', unattended: 'deny', watch: 'machine',
  watch_rule: WATCH, review: '2026-12-01', status: 'active',
  amendments: [], fires: [], misfires: 0, reviews: [], ...extra,
});

describe('막을 것인가 — 금지형만', () => {
  it('금지형이 걸리면 막는다', () => {
    const d = decideBlock([rec('D-0001')], { kind: 'file', path: 'src/app/page.tsx' });
    expect(d.block).toBe(true);
    expect(d.blocking.map((m) => m.id)).toEqual(['D-0001']);
  });

  it('고정·열림·예측은 걸려도 안 막는다 — 세어서 알린다', () => {
    for (const type of ['pin', 'open', 'pred'] as const) {
      const d = decideBlock([rec('D-0002', { type })], { kind: 'file', path: 'src/app/page.tsx' });
      expect(d.block, `${type} 이 막았다`).toBe(false);
      expect(d.matched_not_ban).toBe(1);
    }
  });

  it('그만둔 금지는 안 막는다', () => {
    const d = decideBlock([rec('D-0003', { status: 'repealed' })], { kind: 'file', path: 'src/app/page.tsx' });
    expect(d.block).toBe(false);
  });

  it('안 걸리는 자리는 안 막는다', () => {
    expect(decideBlock([rec('D-0001')], { kind: 'file', path: 'docs/note.md' }).block).toBe(false);
  });
});

describe('막는 글 — 못 여는 문에 열쇠 설명서를 안 붙인다', () => {
  const text = sayBlock(decideBlock([rec('D-0001')], { kind: 'file', path: 'src/app/page.tsx' })).join('\n');

  it('무엇을 왜 막았는지 말한다', () => {
    expect(text).toContain('D-0001');
    expect(text).toContain('걸린 데');
  });

  it('막을 때도 못 잡는 것을 같이 말한다', () => {
    expect(text).toContain('이 규칙이 못 잡는 것');
    expect(text).toContain('다른 이름으로 부르면 못 잡는다');
  });

  it('우회 방법을 한 줄도 적지 않는다', () => {
    for (const key of ['대신', '우회', '--force', '무시하려면', '정 필요하면', '끄려면', '건너뛰',
                       '이렇게 하세요', '대안']) {
      expect(text, `막는 글이 "${key}" 를 가르친다`).not.toContain(key);
    }
  });

  it('안 막았으면 아무 말도 안 한다', () => {
    expect(sayBlock(decideBlock([rec('D-0001')], { kind: 'file', path: 'docs/x.md' }))).toEqual([]);
  });
});

describe('판정을 못 하면 안 막는다 (fail-closed = 영향력 0)', () => {
  let repo: string;
  let dir: string;
  const capture = (args: string[]): { block: boolean; why_not?: string; unreadable?: string } => {
    const write = process.stdout.write.bind(process.stdout);
    let out = '';
    (process.stdout as { write: unknown }).write = (c: string): boolean => { out += c; return true; };
    try { runDecBlockCli(args); } finally { (process.stdout as { write: unknown }).write = write; }
    return JSON.parse(out) as { block: boolean; why_not?: string; unreadable?: string };
  };

  beforeEach(() => {
    // `.argus` 의 **부모가 저장소 뿌리**다 — 그 자리에 `decisions/`·`AGENTS.md`
    // 가 생긴다. 임시 디렉터리를 그대로 argusDir 로 쓰면 그것들이 /tmp 에 떨어지고,
    // 파일 하나(`AGENTS.md`)를 여러 테스트가 나눠 쓰게 된다.
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'dec-block-'));
    dir = path.join(repo, '.argus');
    fs.mkdirSync(path.join(dir, 'ledger'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(repo, { recursive: true, force: true }); });

  it('원장이 아예 없으면 통과시킨다', () => {
    expect(capture(['--argus-dir', dir, '--file', 'src/app/page.tsx']).block).toBe(false);
  });

  it('원장을 못 읽으면 "안 걸렸다"가 아니라 "모른다"로 통과시킨다', () => {
    const ledger = path.join(dir, 'ledger', 'ledger.jsonl');
    fs.writeFileSync(ledger, '{}\n');
    fs.chmodSync(ledger, 0o000);
    const result = capture(['--argus-dir', dir, '--file', 'src/app/page.tsx']);
    fs.chmodSync(ledger, 0o600);
    if (result.unreadable) {
      expect(result.block).toBe(false);
      expect(result.why_not).toBe('ledger_unreadable');
    }
    // root 로 도는 환경에서는 chmod 가 안 막는다 — 그때는 이 사례를 검사할 수 없다.
  });

  it('서명된 금지가 실제로 막는다 (원장 → 판정까지)', async () => {
    await signDecision(dir, 'D-0001', {
      type: 'ban', decision: '이름으로 죽이지 않는다', scope: 'repo', binds: '나', author: '나',
      provenance: 'user', adopted: '2026-08-01', unattended: 'deny', watch: 'machine',
      watch_rule: WATCH, review: '2026-12-01',
    } as DecSignedPayload, '2026-08-21T00:00:00.000Z');
    expect(capture(['--argus-dir', dir, '--file', 'src/app/page.tsx']).block).toBe(true);
    expect(capture(['--argus-dir', dir, '--text', '이름으로 죽이기 를 하자']).block).toBe(true);
    expect(capture(['--argus-dir', dir, '--file', 'docs/x.md']).block).toBe(false);
  });
});
