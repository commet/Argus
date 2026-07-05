/**
 * Premise-engine parity guard. The webapp review path and the MCP ship a
 * byte-for-byte copy of the PURE premise engine (types, cadence, materiality
 * drift, per-premise due-ness) so a premise means the same thing in the browser
 * and the terminal. Same philosophy as review-mcp-drift.test.ts; the only
 * sanctioned difference is the `.js` import extension NodeNext requires.
 *
 * Both trees keep the three files under lib/ (webapp src/lib/, MCP
 * argus-mcp/src/lib/), so the relative import specifiers inside each file are
 * identical (co-located siblings) and the copies stay byte-for-byte equal.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PAIRS: Array<[string, string]> = [
  ['src/lib/canonical-scales.ts', 'argus-mcp/src/lib/canonical-scales.ts'],
  ['src/lib/numeric-drift.ts', 'argus-mcp/src/lib/numeric-drift.ts'],
  ['src/lib/premises-core.ts', 'argus-mcp/src/lib/premises-core.ts'],
];

/** Strip the `.js` extension the MCP copy adds to relative imports. */
function normalize(src: string): string {
  return src.replace(/(from '\.\/[a-zA-Z0-9_-]+)\.js'/g, "$1'").replace(/\r\n/g, '\n').trimEnd();
}

describe('premise engine: webapp ↔ MCP parity', () => {
  const root = process.cwd();
  it.each(PAIRS)('%s is identical to %s (modulo .js imports)', (web, mcp) => {
    const wp = join(root, web);
    const mp = join(root, mcp);
    expect(existsSync(wp), `webapp copy missing: ${web}`).toBe(true);
    expect(existsSync(mp), `MCP copy missing: ${mcp}`).toBe(true);
    expect(normalize(readFileSync(wp, 'utf8'))).toBe(normalize(readFileSync(mp, 'utf8')));
  });
});
