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

  it('keeps a top-level heading while running and after failure', () => {
    // The contract is the HEADING — a running/failed import must still expose an
    // <h1> so the page never loses its top-level landmark. It is deliberately NOT
    // a contract about type size: pinning the whole class string made a
    // legibility pass (2026-07-28, 10px → 12px across the app) fail an
    // accessibility test, which inverts the guard's purpose — bigger text is the
    // thing this test should welcome.
    const headings = [...source.matchAll(/<h1\s+className="([^"]*)"/g)].map((m) => m[1]);
    const accent = headings.find((c) => c.includes('text-[var(--accent)]'));
    const danger = headings.find((c) => c.includes('text-[var(--danger)]'));

    expect(accent, 'the running state lost its <h1>').toBeDefined();
    expect(danger, 'the failure state lost its <h1>').toBeDefined();
    // Still an eyebrow-style heading in both states (weight + tracking), and still
    // legible — a heading is not allowed to shrink back below 12px.
    for (const cls of [accent!, danger!]) {
      expect(cls).toMatch(/font-bold/);
      expect(cls).toMatch(/uppercase/);
      const size = Number(cls.match(/text-\[(\d+(?:\.\d+)?)px\]/)?.[1] ?? NaN);
      expect(size, `heading type too small: ${cls}`).toBeGreaterThanOrEqual(12);
    }
  });
});
