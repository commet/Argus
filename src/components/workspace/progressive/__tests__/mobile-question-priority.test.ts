import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const flow = readFileSync(
  new URL('../ProgressiveFlow.tsx', import.meta.url),
  'utf8',
);

describe('heavy path mobile hierarchy', () => {
  it('keeps the original available without spending several lines before the active question', () => {
    expect(flow).toContain("'line-clamp-1 md:line-clamp-4'");
    expect(flow).toContain("problemExpanded ? 'whitespace-pre-wrap break-words'");
  });
});
