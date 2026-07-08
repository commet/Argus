import fs from 'fs';
import { configPath } from './layout.js';

/**
 * Premise opt-in sync (§9.2-4 / M3 전제 개통).
 *
 * DEFAULT OFF: premise data never leaves the machine — that is the privacy
 * contract the README states. When the user explicitly sets
 * `premise_sync: true` (argus_config), the MONITORED premises of a sealed
 * decision ride along with the seal push, so the account's autonomous
 * premise-watch (T2) can re-check them against reality and email a material
 * drift. This is the ONLY switch; nothing else uploads a premise.
 */
export function premiseSyncEnabled(argusDir?: string | null): boolean {
  if (!argusDir) return false;
  try {
    const cfg = fs.readFileSync(configPath(argusDir), 'utf8');
    return /^premise_sync:\s*true\b/m.test(cfg);
  } catch {
    return false;
  }
}
