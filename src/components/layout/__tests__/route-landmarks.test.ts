import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const layoutShell = readFileSync(join(__dirname, '..', 'LayoutShell.tsx'), 'utf8');
const patternsSurface = readFileSync(join(__dirname, '..', '..', 'patterns', 'PatternsSurface.tsx'), 'utf8');

describe('route landmark contract', () => {
  it('keeps every patterns state inside one main landmark', () => {
    expect(layoutShell).toContain('isPatterns');
    expect(layoutShell).toContain('<main id="main-content"');
    expect(patternsSurface).not.toContain('<main');
  });
});
