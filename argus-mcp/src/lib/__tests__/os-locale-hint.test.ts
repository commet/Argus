import { describe, it, expect, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { osLocaleHint } from '../locale.js';

/**
 * §9.7 O1 방1 — one env resolver, deterministic on every machine.
 *
 * The old chain treated LANG/LC_ALL as a ko-detector only, so `LANG=en_US`
 * fell through to Intl and a Korean-locale OS still resolved ko — the release
 * suite was red on a ko machine and green on en CI with no code difference.
 * These tests pin the rule: non-empty env decides (ko iff ^ko, else en);
 * only an empty env consults Intl.
 */

const saved = { LANG: process.env['LANG'], LC_ALL: process.env['LC_ALL'] };
afterEach(() => {
  for (const k of ['LANG', 'LC_ALL'] as const) {
    if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

function mockIntlLocale(locale: string): void {
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({ locale } as Intl.ResolvedDateTimeFormatOptions);
}

describe('osLocaleHint — env decides when present, Intl only when empty', () => {
  it('LANG=ko_KR → ko', () => {
    process.env['LANG'] = 'ko_KR.UTF-8';
    expect(osLocaleHint()).toBe('ko');
  });

  it('LANG=en_US → en, even when the OS Intl locale is Korean (the 4-reds regression)', () => {
    process.env['LANG'] = 'en_US.UTF-8';
    mockIntlLocale('ko-KR');
    expect(osLocaleHint()).toBe('en');
  });

  it('a non-ko env is en — Argus is binary ko/en (LANG=de_DE → en)', () => {
    process.env['LANG'] = 'de_DE.UTF-8';
    mockIntlLocale('ko-KR');
    expect(osLocaleHint()).toBe('en');
  });

  it('LC_ALL is honored when LANG is absent', () => {
    delete process.env['LANG'];
    process.env['LC_ALL'] = 'ko_KR.UTF-8';
    expect(osLocaleHint()).toBe('ko');
  });

  it('empty env falls through to Intl: ko-KR OS → ko', () => {
    delete process.env['LANG'];
    delete process.env['LC_ALL'];
    mockIntlLocale('ko-KR');
    expect(osLocaleHint()).toBe('ko');
  });

  it('empty env, non-ko Intl → en', () => {
    delete process.env['LANG'];
    delete process.env['LC_ALL'];
    mockIntlLocale('en-US');
    expect(osLocaleHint()).toBe('en');
  });
});

describe('test-setup isolation canaries — if these fail, the suite can touch the real machine again', () => {
  it('the suite baseline env locale is pinned to en (machine-independent)', () => {
    // test-setup.ts pins LANG before any test runs; a test changing it must
    // restore it (this file's afterEach does).
    expect(saved.LANG).toBe('en_US.UTF-8');
    expect(saved.LC_ALL).toBeUndefined();
  });

  it('os.homedir() points into the temp dir, not the real profile — ~/.argus writes cannot contaminate the machine', () => {
    const home = os.homedir();
    expect(home.startsWith(os.tmpdir())).toBe(true);
    // and it is actually usable as a zero-config home
    fs.mkdirSync(path.join(home, '.argus'), { recursive: true });
    expect(fs.existsSync(path.join(home, '.argus'))).toBe(true);
  });
});
