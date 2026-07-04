import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { tmpArgusDir } from '../../test-helpers.js';
import { configPath } from '../layout.js';
import { detectLocaleFromText } from '../locale.js';
import { resolveResponseLocale } from '../surfaces.js';

function writeLocale(dir: string, locale: 'ko' | 'en'): void {
  fs.writeFileSync(configPath(dir), `schema_version: 5\nlocale: ${locale}\n`, 'utf8');
}

describe('detectLocaleFromText (M4 — script-first, short-text safe)', () => {
  it('any Hangul ⇒ ko', () => {
    expect(detectLocaleFromText('회사를 옮길지 말지')).toBe('ko');
    expect(detectLocaleFromText('기준금리 3.5%에서 4.0%로')).toBe('ko');
    expect(detectLocaleFromText('cutover 다운타임 5분 미만')).toBe('ko'); // mixed ⇒ ko
  });

  it('Latin-only short strings ⇒ en (does NOT misfire like a raw n-gram guess)', () => {
    // These are the exact short strings tinyld/light guesses wrong on
    // ("no", "pl"); the Hangul-first rule pins them to en.
    expect(detectLocaleFromText('base rate stays at 3.5%')).toBe('en');
    expect(detectLocaleFromText('downtime < 5 min')).toBe('en');
    expect(detectLocaleFromText('we migrate with under 5 minutes of downtime')).toBe('en');
  });

  it('empty / too-short / whitespace ⇒ null (fall through to config/env)', () => {
    expect(detectLocaleFromText(undefined)).toBeNull();
    expect(detectLocaleFromText(null)).toBeNull();
    expect(detectLocaleFromText('')).toBeNull();
    expect(detectLocaleFromText('  ')).toBeNull();
    expect(detectLocaleFromText('a')).toBeNull();
  });
});

describe('resolveResponseLocale (M4 chain: config > text > env > en)', () => {
  it('explicit config ALWAYS wins — even against contrary text (the escape hatch)', () => {
    const dir = tmpArgusDir();
    writeLocale(dir, 'en');
    // Korean input, but the user pinned en — config is never overridden.
    expect(resolveResponseLocale(dir, '회사를 옮길지 말지')).toBe('en');
    writeLocale(dir, 'ko');
    expect(resolveResponseLocale(dir, 'base rate stays at 3.5%')).toBe('ko');
  });

  it('no config ⇒ input text decides', () => {
    const dir = tmpArgusDir(); // fresh, no config.yaml
    expect(resolveResponseLocale(dir, '이 계약을 봉인할까?')).toBe('ko');
    expect(resolveResponseLocale(dir, 'seal this contract?')).toBe('en');
  });

  it('no config and no usable text ⇒ falls through (env/Intl, else en)', () => {
    const dir = tmpArgusDir();
    // With no ko env in CI, the base voice is en.
    const r = resolveResponseLocale(dir, undefined);
    expect(r === 'en' || r === 'ko').toBe(true); // env-dependent, never throws
  });
});
