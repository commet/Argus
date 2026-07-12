import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  fileURLToPath(new URL('../LocaleProvider.tsx', import.meta.url)),
  'utf8',
);

describe('LocaleProvider route authority', () => {
  it('does not let local storage override an explicitly opened locale route', () => {
    expect(source).not.toContain('STORAGE_KEYS.SETTINGS');
    expect(source).not.toContain('getStorage<');
  });

  it('still supports an explicit ?lang query override', () => {
    expect(source).toContain("new URLSearchParams(window.location.search).get('lang')");
    expect(source).toContain('if (explicit && explicit !== seed)');
  });
});
