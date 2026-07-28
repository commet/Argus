import fs from 'fs';
import path from 'path';
import { boundMarkerPath } from './layout.js';

/** Project-scoped ledger resolution. Explicit absolute paths still win. */
export class ArgusDirError extends Error {
  code = 'ARGUS_DIR_INVALID';
  constructor(message: string) {
    super(message);
    this.name = 'ArgusDirError';
  }
}

export function requireArgusDir(callArg: unknown): string {
  if (typeof callArg !== 'string' || callArg.length === 0) {
    throw new ArgusDirError('argus_dir must be a non-empty absolute path.');
  }
  if (/\$\{[^}]*\}|%[A-Za-z_]+%/.test(callArg)) {
    throw new ArgusDirError(`The MCP host did not expand "${callArg}". Set ARGUS_DIR to an absolute project .argus path.`);
  }
  if (!path.isAbsolute(callArg)) throw new ArgusDirError('argus_dir must be an absolute path.');
  if (callArg.split(/[\\/]/).some((segment) => segment === '..')) {
    throw new ArgusDirError("argus_dir must not contain '..'.");
  }
  return path.resolve(callArg);
}

export function resolveToolArgusDir(callArg: unknown): string {
  if (typeof callArg === 'string' && callArg.length > 0) return requireArgusDir(callArg);
  const configured = process.env['ARGUS_DIR'];
  if (configured) return requireArgusDir(configured);
  return path.join(process.cwd(), '.argus');
}

/** Store project-local binding metadata only; never create a global path index. */
export function writeBoundMarker(argusDir: string): void {
  try {
    fs.writeFileSync(boundMarkerPath(argusDir), JSON.stringify({ bound: [argusDir] }), 'utf8');
  } catch {
    // Convenience metadata; the ledger write path reports material failures.
  }
}

/** @deprecated Cross-project discovery was removed for project isolation. */
export function readGlobalBoundList(): string[] {
  return [];
}

export function resolveArgusDirForResource(): string | null {
  const configured = process.env['ARGUS_DIR'];
  if (configured) {
    if (/\$\{[^}]*\}|%[A-Za-z_]+%/.test(configured) || !path.isAbsolute(configured)) return null;
    return path.resolve(configured);
  }
  return path.join(process.cwd(), '.argus');
}
