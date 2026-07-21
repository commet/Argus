import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', 'ReviewFlow.tsx'), 'utf8');

describe('document review import accessibility', () => {
  it('keeps persistent labels connected to every free-text field', () => {
    for (const id of ['review-document-text', 'review-audience', 'review-worry']) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }
  });

  it('groups review modes and keeps touch targets sized through tablet widths', () => {
    expect(source).toContain('<fieldset>');
    expect(source).toContain('<legend');
    expect(source).toContain('aria-pressed={concerns.includes(c.id)}');
    expect(source).toContain('min-h-11 px-3');
    expect(source).toContain('sm:px-2.5 lg:min-h-9');
  });
});
