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
});
