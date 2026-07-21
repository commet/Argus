import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(path), 'utf8');

describe('global keyboard navigation', () => {
  it('renders a localized skip link before the application shell', () => {
    const layout = read('src/app/[locale]/layout.tsx');
    const skipLink = read('src/components/layout/SkipLink.tsx');

    expect(layout).toContain('<SkipLink locale={locale} />');
    expect(skipLink).toContain('href="#main-content"');
    expect(skipLink).toContain('본문으로 건너뛰기');
    expect(skipLink).toContain('Skip to main content');
    expect(skipLink).toContain('focus:translate-y-0');
  });

  it('provides one focusable content target for every shell variant', () => {
    const shell = read('src/components/layout/LayoutShell.tsx');

    expect(shell.match(/id="main-content"/g)).toHaveLength(6);
    expect(shell.match(/tabIndex=\{-1\}/g)).toHaveLength(6);
  });

  it('keeps standalone workflow pages titled after their intro is dismissed', () => {
    for (const step of ['reframe', 'recast', 'rehearse', 'synthesize']) {
      const page = read(`src/app/[locale]/tools/${step}/page.tsx`);
      expect(page).toContain('<h1 className="sr-only">');
      expect(page).toContain("import { useLocale } from '@/hooks/useLocale';");
    }
  });
});
