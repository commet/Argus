import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ledgerInstallId, accountPushId, resetUnpersistedInstallIds } from '../install-id.js';

/**
 * The account namespace must not change under the user's feet.
 *
 * Found by adversarial audit 2026-07-27. `ledgerInstallId` generated a fresh
 * random id whenever it could not WRITE `.install`, and that id namespaces
 * every account row: seal writes `mcp_<id>_<slug>`, settle addresses the same
 * key. On a read-only / full / locked `.argus` the two disagreed, so the
 * account row never closed — the Companion Brief kept emailing a bet the user
 * had already settled, `argus_sync` reported it as "another ledger", and every
 * surface said "synced" the whole time. Unreachable orphan rows, forever.
 *
 * 무엇이 이걸 빨간불로 만드나: 쓰기 실패 시 다시 무작위를 뽑는 코드로 되돌린다.
 */
let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-install-'));
  resetUnpersistedInstallIds();
});
afterEach(() => {
  vi.restoreAllMocks();
  resetUnpersistedInstallIds();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('install id는 계정 네임스페이스다 — 흔들리면 안 된다', () => {
  it('정상적으로 쓸 수 있으면 두 번 불러도 같다 (디스크에 남는다)', () => {
    const a = ledgerInstallId(dir);
    const b = ledgerInstallId(dir);
    expect(a).toBe(b);
    expect(fs.readFileSync(path.join(dir, '.install'), 'utf8').trim()).toBe(a);
  });

  it('디스크에 못 써도 같은 세션 안에서는 같은 id다 (봉인과 정산이 같은 행을 가리킨다)', () => {
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => { throw Object.assign(new Error('EACCES'), { code: 'EACCES' }); });
    const first = ledgerInstallId(dir);
    const second = ledgerInstallId(dir);
    expect(second, '쓰기 실패마다 새 무작위를 뽑으면 계정 행이 영영 미아가 된다').toBe(first);
    // and the ids the account actually sees must match across the loop
    expect(accountPushId(dir, 'q3')).toBe(accountPushId(dir, 'q3'));
  });

  it('원장이 다르면 id도 다르다 (한 네임스페이스를 공유하지 않는다)', () => {
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-install2-'));
    try {
      expect(ledgerInstallId(dir)).not.toBe(ledgerInstallId(other));
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  it('찢어진 .install은 한 번만 다시 쓰고, 그 뒤로는 안정적이다', () => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, '.install'), 'not-hex-at-all', 'utf8');
    const a = ledgerInstallId(dir);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(ledgerInstallId(dir), '파손을 고친 뒤에는 매 호출마다 새로 뽑으면 안 된다').toBe(a);
  });
});
