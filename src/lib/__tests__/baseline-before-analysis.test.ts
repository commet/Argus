import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync(
  new URL('../../app/[locale]/workspace/page.tsx', import.meta.url),
  'utf8',
);

describe('pre-review baseline enters the first heavy analysis', () => {
  it('starts heavy analysis from the bind resolution with the user-authored baseline', () => {
    expect(page).toContain('beginHeavyAnalysis(text, bind?.lean)');
    expect(page).toContain('runInitialAnalysis(text, (token) =>');
    expect(page).toContain('}, preReviewBaseline)');
  });

  it('does not start the ordinary heavy call while the baseline card is still open', () => {
    const submit = page.slice(
      page.indexOf('const handleSubmit ='),
      page.indexOf('const handleLightDeepen ='),
    );
    expect(submit).not.toContain('beginHeavyAnalysis(');
  });

  it('defers landing auto-start past StrictMode effect replay', () => {
    const autoStart = page.slice(
      page.indexOf('// Auto-submit from ?q= param'),
      page.indexOf('// Start heavy analysis only after'),
    );
    expect(autoStart).toContain('const autoStartTimer = window.setTimeout(() =>');
    expect(autoStart.indexOf('window.setTimeout')).toBeLessThan(autoStart.indexOf('handleSubmit(text)'));
    expect(autoStart).toContain('return () => window.clearTimeout(autoStartTimer)');
  });
});
