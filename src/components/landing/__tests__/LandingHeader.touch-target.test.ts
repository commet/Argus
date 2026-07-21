import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', 'LandingHeader.tsx'), 'utf-8');

describe('LandingHeader mobile auth targets', () => {
  it('keeps both authenticated and signed-out actions at least 44px square', () => {
    for (const href of ['/workspace', '/login']) {
      const start = source.indexOf(`href="${href}"`);
      const end = source.indexOf('</LocaleLink>', start);
      const action = source.slice(start, end);

      expect(start).toBeGreaterThan(-1);
      expect(action).toContain('minHeight: 44');
      expect(action).toContain('minWidth: 44');
    }
  });
});
