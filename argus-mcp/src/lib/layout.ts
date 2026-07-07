import path from 'path';
import { safeSegment, assertInside } from './safe-path.js';

/**
 * Filesystem layout (blueprint §3.0). `argus_dir` IS the `.argus/` directory.
 *
 * Single-identity model: one decision = one `id` = one directory
 * `sessions/{id}/`. There is no `versions/{label}/` tier anymore (clean break).
 * The bearing and the receipt live at fixed names inside the session dir.
 *
 * Every `id` flows through `safeSegment`, and every built path is checked with
 * `assertInside` so a crafted id can never escape `.argus/`.
 */

export const sessionsRoot = (argusDir: string): string =>
  path.join(argusDir, 'sessions');

export const ledgerDir = (argusDir: string): string =>
  path.join(argusDir, 'ledger');

export const ledgerPath = (argusDir: string): string =>
  path.join(ledgerDir(argusDir), 'ledger.jsonl');

export const calendarDir = (argusDir: string): string =>
  path.join(argusDir, 'calendar');

export const configPath = (argusDir: string): string =>
  path.join(argusDir, 'config.yaml');

export const boundMarkerPath = (argusDir: string): string =>
  path.join(argusDir, '.bound');

export function sessionDir(argusDir: string, id: string): string {
  const root = sessionsRoot(argusDir);
  const dir = path.join(root, safeSegment(id, 'id'));
  assertInside(root, dir);
  return dir;
}

export function bearingPath(argusDir: string, id: string): string {
  return path.join(sessionDir(argusDir, id), 'current_bearing.json');
}

export function receiptPath(argusDir: string, id: string): string {
  return path.join(sessionDir(argusDir, id), 'receipt.json');
}

export function calendarPath(argusDir: string, id: string): string {
  const root = calendarDir(argusDir);
  const file = path.join(root, `${safeSegment(id, 'id')}.ics`);
  assertInside(root, file);
  return file;
}

export function sessionFilePath(argusDir: string, id: string): string {
  return path.join(sessionDir(argusDir, id), 'session.json');
}
