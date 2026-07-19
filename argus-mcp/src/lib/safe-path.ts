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
// Windows reserved device basenames (CON, NUL, COM1…). Case-insensitive and
// matched on the name up to the first dot, so `nul` and `nul.ics` both hit.
// On Windows `calendar/NUL.ics` resolves to the null device → the write
// "succeeds" but the bytes vanish (silent reminder loss); `sessions/con`
// throws a cryptic EINVAL. Reject the whole family loudly instead.
const WIN_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

export function safeSegment(raw: unknown, kind = 'segment'): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 128) {
    throw new PathSafetyError(`invalid_${kind}`, `${kind} must be a 1-128 char string`);
  }
  if (raw === '.' || raw === '..' || !SEGMENT.test(raw)) {
    throw new PathSafetyError(`invalid_${kind}`, `${kind} must match [A-Za-z0-9._-] and not be '.'/'..'`);
  }
  // A trailing dot or space is stripped by Windows at path-resolution time, so
  // "build." and "build" alias to ONE directory → the second decision silently
  // overwrites the first. assertInside can't catch it (the aliasing happens in
  // the OS at write time, invisible to a lexical check). Reject it here.
  if (/[. ]$/.test(raw)) {
    throw new PathSafetyError(`invalid_${kind}`, `${kind} must not end with a '.' or space`);
  }
  if (WIN_RESERVED.test(raw)) {
    throw new PathSafetyError(`invalid_${kind}`, `${kind} must not be a reserved device name (CON, NUL, COM1…)`);
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
