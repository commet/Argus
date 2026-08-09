import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { tmpArgusDir } from '../../test-helpers.js';
import { configPath } from '../layout.js';
import { detectLocaleFromText, learnLocaleFromContent } from '../locale.js';
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

  it('empty / too-short / whitespace ⇒ null (fall through to config/base voice)', () => {
    expect(detectLocaleFromText(undefined)).toBeNull();
    expect(detectLocaleFromText(null)).toBeNull();
    expect(detectLocaleFromText('')).toBeNull();
    expect(detectLocaleFromText('  ')).toBeNull();
    expect(detectLocaleFromText('a')).toBeNull();
  });
});

describe('resolveResponseLocale (M4 chain: config > text > en)', () => {
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

  it('no config and no usable text ⇒ deterministic English base voice', () => {
    const dir = tmpArgusDir();
    expect(resolveResponseLocale(dir, undefined)).toBe('en');
  });
});

describe('learnLocaleFromContent — session stays in the user\'s language', () => {
  it('persists ko from Korean content so later contentless surfaces stay Korean', () => {
    const dir = tmpArgusDir();
    // Before: a contentless call would resolve en (no config, no text).
    expect(resolveResponseLocale(dir, undefined)).toBe('en');
    learnLocaleFromContent(dir, { predicate: '전환율이 3.2% 위로 유지된다' });
    // After: the session is pinned ko, so a later error/recall surface is Korean.
    expect(resolveResponseLocale(dir, undefined)).toBe('ko');
  });

  it('never pins from English content (English session must stay English)', () => {
    const dir = tmpArgusDir();
    learnLocaleFromContent(dir, { predicate: 'conversion stays above 3.2 percent' });
    expect(resolveResponseLocale(dir, undefined)).toBe('en');
  });

  it('never overrides an explicit locale already set', () => {
    const dir = tmpArgusDir();
    writeLocale(dir, 'en'); // user pinned English
    learnLocaleFromContent(dir, { decision: '회사를 옮길지 말지' });
    expect(resolveResponseLocale(dir, '회사를 옮길지')).toBe('en'); // explicit choice wins
  });

  it('ignores incidental fields (only real content fields count)', () => {
    const dir = tmpArgusDir();
    learnLocaleFromContent(dir, { id: '한글아이디', note: '메모' }); // not content fields
    expect(resolveResponseLocale(dir, undefined)).toBe('en');
  });
});
