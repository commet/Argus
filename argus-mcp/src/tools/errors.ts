import { toolError, type McpToolResult } from '../lib/envelope.js';
import { ArgusDirError } from '../lib/argus-dir.js';
import { PathSafetyError } from '../lib/safe-path.js';
import { GuardError } from '../lib/state-machine.js';
import { logError } from '../lib/log.js';

/**
 * Map a thrown exception to a spine-safe tool error envelope. Known typed
 * errors carry their own code + recovery hint; anything else is an internal
 * error (logged to stderr, never stdout).
 */
export function handleToolException(tool: string, e: unknown): McpToolResult {
  if (e instanceof ArgusDirError) {
    return toolError({ ok: false, tool, error_code: e.code, message: e.message, recovery: 'Pass an absolute .argus path with no "..".' });
  }
  if (e instanceof PathSafetyError) {
    return toolError({ ok: false, tool, error_code: e.code, message: e.message, recovery: 'Use ids/labels matching [A-Za-z0-9._-] only.' });
  }
  if (e instanceof GuardError) {
    return toolError({ ok: false, tool, error_code: e.code, message: e.message, recovery: e.recovery });
  }
  logError(`[${tool}] unhandled`, e);
  return toolError({ ok: false, tool, error_code: 'INTERNAL_ERROR', message: String(e instanceof Error ? e.message : e) });
}
