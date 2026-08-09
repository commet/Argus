import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../RetroSeal.tsx', import.meta.url), 'utf8');

describe('RetroSeal embedded routing contract', () => {
  it('persists the rehearsal without activating the legacy workspace router', () => {
    expect(source).toContain(
      "createProject(name, '', { activate: false, trackCreation: false })",
    );
  });

  it('keeps a document-level heading throughout the three-step rehearsal', () => {
    expect(source.match(/<h1 className="sr-only">/g)).toHaveLength(2);
  });
});
