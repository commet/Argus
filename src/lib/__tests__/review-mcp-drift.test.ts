/**
 * Review-core parity guard (CLAUDE.md §"Single Source of Truth" + webapp/plugin
 * drift philosophy). The MCP ships a byte-for-byte copy of the webapp review
 * core so both surfaces produce the SAME JudgmentReceipt. The only sanctioned
 * difference is the `.js` import extensions NodeNext requires.
 *
 * This test fails the moment the two copies diverge in anything else — edit one,
 * you must edit the other. If the port is intentionally changed, update both.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PORTED = ['schema', 'ids', 'ingest', 'reviewability', 'lenses', 'routing', 'prompts', 'render'];

/** Strip the `.js` extension the MCP copy adds to relative imports, so the only
 *  sanctioned difference doesn't register as drift. */
function normalize(src: string): string {
  return src.replace(/(from '\.\/[a-zA-Z0-9_-]+)\.js'/g, "$1'").replace(/\r\n/g, '\n').trimEnd();
}

describe('review core: webapp ↔ MCP parity', () => {
  const root = process.cwd();
  it.each(PORTED)('%s.ts is identical in both copies (modulo .js imports)', (name) => {
    const web = join(root, `src/lib/review/${name}.ts`);
    const mcp = join(root, `argus-mcp/src/lib/review/${name}.ts`);
    expect(existsSync(mcp), `MCP copy missing: argus-mcp/src/lib/review/${name}.ts`).toBe(true);
    expect(normalize(readFileSync(mcp, 'utf8'))).toBe(normalize(readFileSync(web, 'utf8')));
  });
});
