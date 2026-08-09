import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import { init } from '../init-config.js';
import { configPath } from '../../lib/layout.js';
import { resolveResponseLocale } from '../../lib/surfaces.js';
import { tmpArgusDir } from '../../test-helpers.js';

/**
 * Auto-init must NOT pin an env-guessed English locale into config, or a Korean
 * user on an English-locale OS is locked into English surfaces forever (config
 * wins over content detection). Regression for the check_in localization bug
 * (2026-07-14): an all-Korean session came back framed in English.
 */
describe('argus_init locale seeding', () => {
  const saved = { LANG: process.env['LANG'], LC_ALL: process.env['LC_ALL'] };
  afterEach(() => {
    for (const k of ['LANG', 'LC_ALL'] as const) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  });

  it('on a non-Korean env, writes NO locale line so Korean content still wins', async () => {
    process.env['LANG'] = 'en_US.UTF-8';
    delete process.env['LC_ALL'];
    const dir = tmpArgusDir();
    await init.handler({ argus_dir: dir });
    const cfg = fs.readFileSync(configPath(dir), 'utf8');
    expect(cfg).not.toMatch(/^locale:/m);
    // The whole point: with no pinned locale, the user's Korean words decide.
    expect(resolveResponseLocale(dir, '지분 배분 기준 미정')).toBe('ko');
    expect(resolveResponseLocale(dir, 'conversion stays above 3.2%')).toBe('en');
  });

  it('does not mistake a Korean machine locale for the user\'s conversation language', async () => {
    process.env['LANG'] = 'ko_KR.UTF-8';
    delete process.env['LC_ALL'];
    const dir = tmpArgusDir();
    await init.handler({ argus_dir: dir });
    expect(fs.readFileSync(configPath(dir), 'utf8')).not.toMatch(/^locale:/m);
    expect(resolveResponseLocale(dir, undefined)).toBe('en');
    expect(resolveResponseLocale(dir, '이번 주에 출시할지 결정한다')).toBe('ko');
  });
});
