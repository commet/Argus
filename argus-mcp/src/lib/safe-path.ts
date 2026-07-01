import path from 'path';
import fs from 'fs';

/**
 * Single source of truth for path safety (blueprint §3.4 / addendum M5).
 *
 * Every path segment that originates from a tool argument, a ledger id, a
 * receipt label, or a directory name read off disk MUST pass through
 * `safeSegment` before it is joined, and every resulting path MUST be checked
 * with `assertInside`. No inline `..` guards anywhere else — that scatter is
 * exactly what let the traversal bug survive.
 */

// A single path segment: letters, digits, dot, underscore, hyphen.
// Rejects separators (/ \), '..', '.', percent-encoding, NUL, etc.
const SEGMENT = /^[A-Za-z0-9._-]+$/;

export function safeSegment(raw: unknown, kind = 'segment'): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 128) {
    throw new PathSafetyError(`invalid_${kind}`, `${kind} must be a 1-128 char string`);
  }
  if (raw === '.' || raw === '..' || !SEGMENT.test(raw)) {
    throw new PathSafetyError(`invalid_${kind}`, `${kind} must match [A-Za-z0-9._-] and not be '.'/'..'`);
  }
  // Defense in depth: reject any percent-encoded or NUL byte that slipped the regex.
  if (raw.includes('\0') || /%2e/i.test(raw) || /%2f/i.test(raw) || /%5c/i.test(raw)) {
    throw new PathSafetyError(`invalid_${kind}`, `${kind} contains an encoded separator`);
  }
  return raw;
}

/**
 * Resolve `candidate` and assert it is `root` itself or strictly inside `root`.
 * Uses realpath when the path exists so symlink/junction escapes (Windows) are
 * caught, falling back to lexical resolution for not-yet-created paths.
 */
export function assertInside(root: string, candidate: string): string {
  const realRoot = realpathOrResolve(root);
  const realCand = realpathOrResolve(candidate);
  const rootWithSep = realRoot.endsWith(path.sep) ? realRoot : realRoot + path.sep;
  if (realCand !== realRoot && !realCand.startsWith(rootWithSep)) {
    throw new PathSafetyError('path_escape_blocked', `path escapes root: ${candidate}`);
  }
  return realCand;
}

function realpathOrResolve(p: string): string {
  // Resolve the deepest existing ancestor via realpath (so a symlinked/junction
  // ancestor cannot be used to escape), then re-attach the not-yet-existing
  // lexical tail.
  let dir = path.resolve(p);
  const tail: string[] = [];
  for (let i = 0; i < 4096; i++) {
    try {
      const real = fs.realpathSync.native(dir);
      return tail.length ? path.join(real, ...tail.reverse()) : real;
    } catch {
      tail.push(path.basename(dir));
      const parent = path.dirname(dir);
      if (parent === dir) break; // reached filesystem root
      dir = parent;
    }
  }
  return path.resolve(p);
}

export class PathSafetyError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'PathSafetyError';
    this.code = code;
  }
}
