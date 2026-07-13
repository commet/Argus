import { toolError, type McpToolResult } from '../lib/envelope.js';
import { ArgusDirError } from '../lib/argus-dir.js';
import { PathSafetyError } from '../lib/safe-path.js';
import { GuardError } from '../lib/state-machine.js';
import { logError } from '../lib/log.js';
import { localizedErrorCopy } from '../lib/localized-message.js';

/**
 * Map a thrown exception to a spine-safe tool error envelope. Known typed
 * errors carry their own code + recovery hint; anything else is an internal
 * error (logged to stderr, never stdout).
 */
export function handleToolException(tool: string, e: unknown): McpToolResult {
  if (e instanceof ArgusDirError) {
    const copy = localizedErrorCopy(null, undefined, {
      en: { message: e.message, recovery: 'Pass an absolute .argus path with no "..".' },
      ko: { message: 'Argus 기록 경로가 올바르지 않습니다.', recovery: '".."이 없는 절대 .argus 경로를 전달하세요.' },
    });
    return toolError({ ok: false, tool, error_code: e.code, ...copy });
  }
  if (e instanceof PathSafetyError) {
    const copy = localizedErrorCopy(null, undefined, {
      en: { message: e.message, recovery: 'Use ids/labels matching [A-Za-z0-9._-] only.' },
      ko: { message: '안전하지 않은 id 또는 label입니다.', recovery: 'id와 label에는 [A-Za-z0-9._-] 문자만 사용하세요.' },
    });
    return toolError({ ok: false, tool, error_code: e.code, ...copy });
  }
  if (e instanceof GuardError) {
    return toolError({ ok: false, tool, error_code: e.code, message: e.message, recovery: e.recovery });
  }
  logError(`[${tool}] unhandled`, e);
  const detail = String(e instanceof Error ? e.message : e);
  const copy = localizedErrorCopy(null, undefined, {
    en: { message: `Internal error: ${detail}`, recovery: 'Try the same operation again. If it repeats, inspect the server log.' },
    ko: { message: `내부 오류가 발생했습니다: ${detail}`, recovery: '같은 작업을 다시 시도하세요. 반복되면 서버 로그를 확인하세요.' },
  });
  return toolError({ ok: false, tool, error_code: 'INTERNAL_ERROR', ...copy });
}
