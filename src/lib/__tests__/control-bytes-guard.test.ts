/**
 * A literal control byte in source is always an accident, and always a silent
 * one — most often a shell or script turning a regex word-boundary escape into
 * 0x08 while editing a Korean-matching pattern. It renders as an ordinary
 * escape in a diff and matches nothing at runtime, so the guard it belongs to
 * quietly stops guarding while every test stays green.
 *
 * Hit twice on this codebase (light-engine 2026-07, progressive-guards
 * 2026-08-02, both while editing regexes from a script), which is twice more
 * than a defect this invisible should ever be caught by hand. The mojibake
 * guard next door catches lossy re-encodes; this catches the other family.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    // Skips itself: it necessarily names the bytes it hunts for.
    else if (/\.(ts|tsx|css|mjs)$/.test(name) && !name.includes('control-bytes')) out.push(p);
  }
  return out;
}

/** Backspace, vertical tab, form feed, NUL — tab/CR/LF are legitimate. */
const CONTROL_CODES = [0x00, 0x08, 0x0b, 0x0c];

describe('no literal control bytes in source', () => {
  const files = walk(SRC);

  it('walks a non-trivial tree (sanity)', () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('every file is free of them', () => {
    const bad: string[] = [];
    for (const abs of files) {
      const text = readFileSync(abs, 'utf8');
      for (let i = 0; i < text.length; i += 1) {
        if (CONTROL_CODES.includes(text.charCodeAt(i))) {
          const line = text.slice(0, i).split('\n').length;
          bad.push(`${abs.slice(SRC.length + 1)}:${line}`);
          break;
        }
      }
    }
    expect(
      bad,
      `literal control byte in source (usually a regex word-boundary mangled into 0x08): ${bad.join(', ')}`,
    ).toEqual([]);
  });
});
