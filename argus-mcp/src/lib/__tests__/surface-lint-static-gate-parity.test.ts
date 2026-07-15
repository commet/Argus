/**
 * No-drift lock: the plugin's static-gate (argus-plugin-v2/evals/static-gate.mjs)
 * reuses the MCP surface-lint verdict tells as the SHARED BRAIN. The plugin is a
 * separate package with its own Node test harness, so it keeps a verbatim copy of
 * the four regexes rather than importing across the package boundary. This test —
 * in the MCP suite, which can read both — fails CI if the copy drifts from the
 * canonical source here. Edit surface-lint.ts and the copy stays in lockstep; edit
 * one without the other and this goes red.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERDICT_LEAN, VERDICT_FORK, VERDICT_CONFIRM_EN, VERDICT_CONFIRM_KO } from '../surface-lint';

const here = dirname(fileURLToPath(import.meta.url));
// argus-mcp/src/lib/__tests__ → repo root → the plugin gate.
const STATIC_GATE = resolve(here, '..', '..', '..', '..', 'argus-plugin-v2', 'evals', 'static-gate.mjs');
const hasPlugin = existsSync(STATIC_GATE);

const literal = (re: RegExp) => `/${re.source}/${re.flags}`;

describe.skipIf(!hasPlugin)('surface-lint verdict tells are mirrored verbatim in the plugin static-gate', () => {
  const text = hasPlugin ? readFileSync(STATIC_GATE, 'utf8') : '';
  it.each([
    ['VERDICT_LEAN', VERDICT_LEAN],
    ['VERDICT_FORK', VERDICT_FORK],
    ['VERDICT_CONFIRM_EN', VERDICT_CONFIRM_EN],
    ['VERDICT_CONFIRM_KO', VERDICT_CONFIRM_KO],
  ])('%s appears byte-for-byte in static-gate.mjs', (_name, re) => {
    expect(text).toContain(literal(re));
  });
});
