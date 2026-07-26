import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkIn } from '../check-in.js';
import { seal } from '../seal.js';

/**
 * The wire must be able to describe ITSELF.
 *
 * Root cause this pins (2026-07-26): the founder dogfooded MCP 1.2.0 for twelve
 * days while 1.3.0–1.9.0 sat published on npm. `npx -y argus-decision-mcp@^1`
 * reuses a cached install whenever the spec is a RANGE, so the wire never
 * upgraded — and nothing anywhere reported the version a live session actually
 * launched. CI proved the repo consistent with itself; npm held the latest; the
 * one number nobody could see was the one the user was touching.
 *
 * `data.server_version` closes that gap: /doctor (and the user) can compare the
 * running build against the version the plugin pins, instead of inferring
 * staleness from behavior that silently isn't there.
 *
 * What makes this red: check_in stops reporting server_version on any of its
 * three return paths (first run / nothing due / something due), or reports a
 * value that disagrees with package.json.
 */
const PKG_VERSION = (() => {
  const raw = fs.readFileSync(new URL('../../../package.json', import.meta.url), 'utf8');
  return (JSON.parse(raw) as { version: string }).version;
})();

let dir: string;
let home: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-wire-'));
  dir = path.join(home, '.argus');
  fs.mkdirSync(dir, { recursive: true });
  process.env['ARGUS_HOME'] = home;
});

afterEach(() => {
  delete process.env['ARGUS_HOME'];
  fs.rmSync(home, { recursive: true, force: true });
});

const data = (r: { structuredContent?: Record<string, unknown> }) =>
  (r.structuredContent?.['data'] ?? {}) as Record<string, unknown>;

describe('check_in reports the wire it is running on', () => {
  it('first run (empty ledger) carries server_version', async () => {
    const res = await checkIn.handler({ argus_dir: dir, include_upcoming_days: 0, fleet: false, today_override: '2026-07-26' });
    const d = data(res);
    expect(d['first_run']).toBe(true);
    expect(d['server_version']).toBe(PKG_VERSION);
  });

  it('nothing-due carries server_version', async () => {
    await seal.handler({
      argus_dir: dir, id: 'wire-1', predicate: 'the pinned version reaches the user',
      check_by: '2026-12-01', predicate_owner: 'user', today_override: '2026-07-26',
    });
    const res = await checkIn.handler({ argus_dir: dir, include_upcoming_days: 0, fleet: false, today_override: '2026-07-27' });
    const d = data(res);
    expect(d['due_count']).toBe(0);
    expect(d['server_version']).toBe(PKG_VERSION);
  });

  it('something-due carries server_version', async () => {
    await seal.handler({
      argus_dir: dir, id: 'wire-2', predicate: 'the pinned version reaches the user',
      check_by: '2026-08-01', predicate_owner: 'user', today_override: '2026-07-26',
    });
    const res = await checkIn.handler({ argus_dir: dir, include_upcoming_days: 0, fleet: false, today_override: '2026-08-02' });
    const d = data(res);
    expect(d['due_count']).toBeGreaterThan(0);
    expect(d['server_version']).toBe(PKG_VERSION);
  });

  it('picker availability is still reported alongside it', async () => {
    const res = await checkIn.handler({ argus_dir: dir, include_upcoming_days: 0, fleet: false, today_override: '2026-07-26' });
    expect(['one_tap', 'text_fallback']).toContain(data(res)['picker']);
  });
});
