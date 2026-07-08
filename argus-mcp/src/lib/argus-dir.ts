import fs from 'fs';
import os from 'os';
import path from 'path';
import { boundMarkerPath } from './layout.js';

/**
 * argus_dir resolution + precedence (blueprint §4.0 + addendum A/B).
 *
 * The `${workspaceFolder}` config variable only expands in VS Code — Claude
 * Code expands `${CLAUDE_PROJECT_DIR}`, others expand nothing. So env
 * interpolation is the LEAST reliable channel and must come last. Tools always
 * receive a per-call `argus_dir`, which works on every host, so that wins.
 *
 * Precedence:
 *   1. per-call `argus_dir` argument            (works on every host)
 *   2. last dir written to `.bound` by argus_init (read-side for Resources)
 *   3. ARGUS_DIR env                            (host-dependent interpolation)
 */

export class ArgusDirError extends Error {
  code = 'ARGUS_DIR_INVALID';
  constructor(message: string) {
    super(message);
    this.name = 'ArgusDirError';
  }
}

/** Validate a per-call argus_dir: must be an absolute path, no traversal segments. */
export function requireArgusDir(callArg: unknown): string {
  if (typeof callArg !== 'string' || callArg.length === 0) {
    throw new ArgusDirError('argus_dir is required (absolute path to the .argus directory).');
  }
  // An unexpanded config variable is the #1 Claude Desktop first-run failure:
  // only Claude Code expands ${CLAUDE_PROJECT_DIR}, so Desktop passes the
  // literal string through. Name the actual problem instead of "not absolute".
  if (/\$\{[^}]*\}|%[A-Za-z_]+%/.test(callArg)) {
    throw new ArgusDirError(
      `Your MCP host did not expand the variable in "${callArg}" (only some hosts interpolate env vars). ` +
        'Replace it with an absolute path in your MCP config (e.g. "C:\\Users\\you\\.argus" or "/Users/you/.argus"), ' +
        'or remove ARGUS_DIR entirely to use the default ~/.argus.',
    );
  }
  const resolved = path.resolve(callArg);
  if (!path.isAbsolute(callArg)) {
    throw new ArgusDirError('argus_dir must be an absolute path.');
  }
  if (callArg.split(/[\\/]/).some((seg) => seg === '..')) {
    throw new ArgusDirError("argus_dir must not contain '..'.");
  }
  return resolved;
}

/**
 * Resolve argus_dir for a TOOL call, implementing the full precedence the
 * blueprint promised (§4.0): a per-call `argus_dir` wins, else the `ARGUS_DIR`
 * env var. This is the ergonomic win — set ARGUS_DIR once in the MCP config and
 * never pass the path again. Both channels get the same path-safety validation;
 * omitting both yields one clear, actionable error.
 */
export function resolveToolArgusDir(callArg: unknown): string {
  if (typeof callArg === 'string' && callArg.length > 0) return requireArgusDir(callArg);
  const env = process.env['ARGUS_DIR'];
  if (typeof env === 'string' && env.length > 0) return requireArgusDir(env);
  // Zero-config default (blueprint §9.4 "첫 설치의 문"): a brand-new user on a
  // host without env interpolation still gets a working home for their ledger.
  // Per-call argus_dir and ARGUS_DIR both keep winning over this.
  return path.join(os.homedir(), '.argus');
}

/** Record the bound dir so Resources (which get no args) can find it later. */
export function writeBoundMarker(argusDir: string): void {
  try {
    const envDirs = readBoundList(argusDir);
    if (!envDirs.includes(argusDir)) envDirs.unshift(argusDir);
    fs.writeFileSync(boundMarkerPath(argusDir), JSON.stringify({ bound: envDirs.slice(0, 8) }), 'utf8');
  } catch {
    /* non-critical */
  }
}

function readBoundList(argusDir: string): string[] {
  try {
    const raw = fs.readFileSync(boundMarkerPath(argusDir), 'utf8');
    const parsed = JSON.parse(raw) as { bound?: unknown };
    return Array.isArray(parsed.bound) ? (parsed.bound.filter((x) => typeof x === 'string') as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Resolve argus_dir for a Resource read (no per-call arg available).
 * Returns null (unbound) rather than throwing — the Resource degrades cleanly.
 */
export function resolveArgusDirForResource(): string | null {
  const env = process.env['ARGUS_DIR'];
  if (typeof env === 'string' && env.length > 0 && path.isAbsolute(env)) {
    return path.resolve(env);
  }
  return null;
}
