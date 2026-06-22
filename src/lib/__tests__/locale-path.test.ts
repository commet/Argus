/**
 * Guard tests for the locale-path helpers — the single source of how a locale
 * is encoded in the URL. Every internal link (LocaleLink), router nav
 * (useLocaleRouter/useLocaleSwitch), the proxy redirect, and every
 * usePathname() comparison depends on these. Before this suite the whole
 * path-based-i18n layer had zero coverage, so a regression (e.g. dropping the
 * page path from canonical, or mis-stripping a locale) would pass silently.
 */
import { describe, it, expect } from 'vitest';
import {
  LOCALES,
  isLocale,
  localeFromPath,
  stripLocale,
  withLocale,
  buildLocaleAlternates,
} from '@/lib/locale-path';

describe('isLocale', () => {
  it('accepts the two real locales', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('ko')).toBe(true);
    expect(LOCALES).toEqual(['en', 'ko']);
  });
  it('rejects everything else', () => {
    for (const v of ['fr', 'EN', 'en-US', '', 'enko', undefined, null]) {
      expect(isLocale(v as string)).toBe(false);
    }
  });
});

describe('localeFromPath', () => {
  it('reads the leading locale segment', () => {
    expect(localeFromPath('/en')).toBe('en');
    expect(localeFromPath('/ko/workspace')).toBe('ko');
    expect(localeFromPath('/en/a/b')).toBe('en');
  });
  it('returns null when the first segment is not a locale', () => {
    expect(localeFromPath('/')).toBeNull();
    expect(localeFromPath('/workspace')).toBeNull();
    expect(localeFromPath('/enclave/x')).toBeNull(); // starts with "en" but is not the segment
  });
});

describe('stripLocale', () => {
  it('removes a leading locale segment', () => {
    expect(stripLocale('/en')).toBe('/');
    expect(stripLocale('/ko')).toBe('/');
    expect(stripLocale('/en/workspace')).toBe('/workspace');
    expect(stripLocale('/ko/a/b')).toBe('/a/b');
  });
  it('leaves locale-less paths unchanged', () => {
    expect(stripLocale('/')).toBe('/');
    expect(stripLocale('/workspace')).toBe('/workspace');
    expect(stripLocale('/settings')).toBe('/settings');
  });
  it('does NOT strip a segment that merely starts with a locale', () => {
    expect(stripLocale('/enclave')).toBe('/enclave');
    expect(stripLocale('/korean')).toBe('/korean');
  });
});

describe('withLocale', () => {
  it('prefixes an internal path', () => {
    expect(withLocale('en', '/workspace')).toBe('/en/workspace');
    expect(withLocale('ko', '/workspace')).toBe('/ko/workspace');
    expect(withLocale('en', '/workspace?demo=planning')).toBe('/en/workspace?demo=planning');
  });
  it('maps root to the bare locale (no trailing slash)', () => {
    expect(withLocale('en', '/')).toBe('/en');
    expect(withLocale('ko', '/')).toBe('/ko');
  });
  it('does not double-prefix an already-localed path', () => {
    expect(withLocale('en', '/en/x')).toBe('/en/x');
    expect(withLocale('ko', '/ko')).toBe('/ko');
    expect(withLocale('en', '/en?q=1')).toBe('/en?q=1');
  });
  it('leaves external / hash / relative / protocol-relative alone', () => {
    expect(withLocale('en', 'https://x.com')).toBe('https://x.com');
    expect(withLocale('en', '#section')).toBe('#section');
    expect(withLocale('en', 'mailto:a@b.com')).toBe('mailto:a@b.com');
    expect(withLocale('en', '//cdn.example')).toBe('//cdn.example');
  });
  it('round-trips with stripLocale for internal paths', () => {
    for (const p of ['/workspace', '/settings/x', '/']) {
      expect(stripLocale(withLocale('ko', p))).toBe(p);
    }
  });
});

describe('buildLocaleAlternates (per-page canonical/hreflang)', () => {
  const SITE = 'https://argus.voyage';

  it('homepage: canonical is the locale root', () => {
    const a = buildLocaleAlternates(SITE, 'en', '');
    expect(a.canonical).toBe('https://argus.voyage/en');
    expect(a.languages).toEqual({
      en: 'https://argus.voyage/en',
      ko: 'https://argus.voyage/ko',
      'x-default': 'https://argus.voyage/en',
    });
  });

  it('sub-page: canonical includes the page path (NOT the homepage)', () => {
    // This is the regression guard: a sub-page must canonical to ITSELF, not
    // inherit `/en`. If canonical ever drops the path, Google de-indexes it.
    const a = buildLocaleAlternates(SITE, 'ko', '/guide');
    expect(a.canonical).toBe('https://argus.voyage/ko/guide');
    expect(a.canonical).not.toBe('https://argus.voyage/ko');
    expect(a.languages.en).toBe('https://argus.voyage/en/guide');
    expect(a.languages.ko).toBe('https://argus.voyage/ko/guide');
    expect(a.languages['x-default']).toBe('https://argus.voyage/en/guide');
  });
});
