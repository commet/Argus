import fs from 'fs';
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
  const resolved = path.resolve(callArg);
  if (!path.isAbsolute(callArg)) {
    throw new ArgusDirError('argus_dir must be an absolute path.');
  }
  if (callArg.split(/[\\/]/).some((seg) => seg === '..')) {
    throw new ArgusDirError("argus_dir must not contain '..'.");
  }
  return resolved;
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
