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
      en: { message: e.message, recovery: 'Set ARGUS_DIR (or the per-call argus_dir) to an absolute path with no "..", e.g. C:\\Users\\you\\.argus or /Users/you/.argus; or remove ARGUS_DIR to use the default ~/.argus. A ${VAR} may be passed through unexpanded by your host.' },
      ko: { message: 'Argus 기록 경로(argus_dir / ARGUS_DIR)가 올바르지 않습니다.', recovery: '절대 경로여야 하고 ".."을 포함할 수 없습니다. MCP 설정에서 절대 경로(예: C:\\Users\\이름\\.argus, /Users/이름/.argus)로 바꾸거나 ARGUS_DIR을 지워 기본값(~/.argus)을 쓰세요. ${...} 같은 변수는 호스트가 확장하지 못할 수 있습니다.' },
    });
    return toolError({ ok: false, tool, error_code: e.code, ...copy });
  }
  if (e instanceof PathSafetyError) {
    const copy = localizedErrorCopy(null, undefined, {
      en: { message: e.message, recovery: 'Use A-Za-z0-9._- only, with no trailing dot or space, and avoid reserved device names (con, nul, com1…). Example: "career-move".' },
      ko: { message: '이 id 또는 label은 쓸 수 없습니다.', recovery: '영문·숫자·. _ - 만 쓰되, 끝에 마침표나 공백을 두지 말고 con·nul·com1 같은 예약어는 피하세요. 예: "career-move".' },
    });
    return toolError({ ok: false, tool, error_code: e.code, ...copy });
  }
  if (e instanceof GuardError) {
    return toolError({ ok: false, tool, error_code: e.code, message: e.message, recovery: e.recovery });
  }
  // A filesystem error (ENOENT/EACCES/…) on the records dir is almost always an
  // argus_dir that is syntactically fine but points somewhere unwritable (a
  // non-existent drive, a read-only or permission-denied path). Raw "ENOENT …
  // mkdir" + "inspect the server log" is a dead end for a non-technical user on
  // first setup; give friendly, actionable argus_dir guidance instead.
  const fsCode = (e && typeof e === 'object' && 'code' in e) ? String((e as { code?: unknown }).code) : '';
  if (['ENOENT', 'EACCES', 'EPERM', 'EROFS', 'ENOTDIR'].includes(fsCode)) {
    logError(`[${tool}] argus_dir unwritable`, e);
    const copy = localizedErrorCopy(null, undefined, {
      en: { message: "Argus couldn't create or write its records folder.", recovery: 'Point ARGUS_DIR (or the per-call argus_dir) at a folder that exists and is writable: an absolute path on a real drive, no "..". Then try again.' },
      ko: { message: 'Argus가 기록 폴더를 만들거나 쓰지 못했습니다.', recovery: 'ARGUS_DIR(또는 argus_dir)을 실제로 있고 쓸 수 있는 폴더로 바꿔 주세요. 실제 드라이브의 절대 경로여야 하고 ".."은 넣을 수 없습니다. 그다음 다시 시도하세요.' },
    });
    return toolError({ ok: false, tool, error_code: 'ARGUS_DIR_UNWRITABLE', ...copy });
  }
  logError(`[${tool}] unhandled`, e);
  const detail = String(e instanceof Error ? e.message : e);
  const copy = localizedErrorCopy(null, undefined, {
    en: { message: `Internal error: ${detail}`, recovery: 'Try the same operation again. If it repeats, inspect the server log.' },
    ko: { message: `내부 오류가 발생했습니다: ${detail}`, recovery: '같은 작업을 다시 시도하세요. 반복되면 서버 로그를 확인하세요.' },
  });
  return toolError({ ok: false, tool, error_code: 'INTERNAL_ERROR', ...copy });
}
