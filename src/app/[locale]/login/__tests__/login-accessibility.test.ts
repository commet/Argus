import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', 'page.tsx'), 'utf8');

describe('login accessibility contract', () => {
  it('keeps a page heading and persistent labels for every auth field', () => {
    expect(source).toContain('<h1');
    expect(source).toContain('{authTitle}</h1>');

    for (const id of ['auth-name', 'auth-email', 'auth-password']) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }
  });

  it('exposes role choices and asynchronous feedback semantically', () => {
    expect(source).toContain('<fieldset>');
    expect(source).toContain('<legend');
    expect(source).toContain('role="alert"');
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-busy={submitting}');
  });
});
