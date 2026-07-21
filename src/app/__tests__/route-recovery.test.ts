import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = join(process.cwd(), 'src', 'app');
const read = (...path: string[]) => readFileSync(join(appRoot, ...path), 'utf8');

describe('route recovery UX', () => {
  it('keeps Korean recovery copy readable', () => {
    expect(read('error.tsx')).toContain('문제가 생겼어요');
    expect(read('global-error.tsx')).toContain('다시 시도');
    expect(read('not-found.tsx')).toContain('페이지를 찾을 수 없어요');
    expect(read('[locale]', 'tools', 'error.tsx')).toContain('도구를 불러오지 못했어요');
  });

  it('preserves locale and exposes mobile-sized recovery actions', () => {
    const error = read('error.tsx');
    const notFound = read('not-found.tsx');

    expect(error).toContain("withLocale(locale, '/workspace')");
    expect(notFound).toContain("withLocale(locale, '/workspace')");
    expect(notFound).toContain("withLocale(locale, '/')");
    expect(error).toContain('min-h-11');
    expect(notFound).toContain('min-h-11');
  });

  it('provides an accessible reduced-motion route loading boundary', () => {
    const loading = read('[locale]', 'loading.tsx');

    expect(loading).toContain('role="status"');
    expect(loading).toContain('aria-live="polite"');
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain('motion-reduce:animate-none');
  });
});
