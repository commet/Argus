/**
 * Enum-literal copy guard (Argus 2.0 plan, H1-C5).
 *
 * Internal schema enum values leaked into user-facing copy — the review
 * privacy line literally rendered "(receipt_only)" to every user on the
 * landing page's main wedge. Users don't speak schema; a machine token inside
 * a trust-critical sentence reads as a bug and drains exactly the confidence
 * that line exists to build.
 *
 * Rule: an internal enum literal must never sit on the same line as Hangul
 * copy (the failure mode is "한국어 문장 (enum_value)") or inside JSX text.
 * Using these identifiers in CODE (types, comparisons, object keys) is fine.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENTS = join(process.cwd(), 'src/components');

const ENUM_LITERALS = ['receipt_only', 'store_source', 'local_only', 'ai_surfaced'];

// A leak = one STRING LITERAL containing both Hangul copy and an enum value
// ("기본은 원문을 저장하지 않습니다 (receipt_only)"). Code comparisons like
// `owner === 'ai_surfaced'` sit in their own Hangul-free string and pass.
const STRING_LITERAL = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;
const ENUM_RE = new RegExp(`\\b(${ENUM_LITERALS.join('|')})\\b`);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.tsx') && !name.includes('.test.')) out.push(p);
  }
  return out;
}

describe('enum-literal copy guard', () => {
  const files = walk(COMPONENTS);

  it('no internal enum value appears inside user-facing Korean copy', () => {
    const leaks: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(STRING_LITERAL)) {
        const body = m[1] ?? m[2] ?? m[3] ?? '';
        if (/[가-힣]/.test(body) && ENUM_RE.test(body)) {
          const line = src.slice(0, m.index).split('\n').length;
          leaks.push(`${f.slice(COMPONENTS.length + 1)}:${line}: ${body.trim().slice(0, 90)}`);
        }
      }
    }
    expect(leaks).toEqual([]);
  });
});
