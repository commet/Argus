import fs from 'fs';
import os from 'os';
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

/**
 * 기본 원장 위치 (2026-07-30 개정 — Codex 앱 실측에서).
 *
 * Codex 데스크톱 앱은 대화마다 새 폴더를 만든다. 옛 기본값(무조건 cwd/.argus)은
 * 그 폴더마다 고아 원장을 만들어 **대화가 끝나면 기록이 다시는 안 보였다** —
 * 사용자당 하나의 논리 데이터셋이라는 정본 모델(ADR 2026-07-27)과 정면으로
 * 어긋나는 파편화다.
 *
 * 규칙: 프로젝트라는 증거가 있으면 프로젝트 원장, 없으면 개인 홈 원장.
 *   1. per-call argus_dir            — 항상 이긴다 (명시)
 *   2. ARGUS_DIR 환경변수            — 항상 이긴다 (명시)
 *   3. cwd/.argus 가 이미 존재       — 그대로 쓴다 (기존 로컬 기록 존중)
 *   4. cwd 가 git 저장소 안          — cwd/.argus (프로젝트 맥락)
 *   5. 그 외(앱 대화 폴더·임시 폴더) — 개인 홈(ARGUS_HOME 또는 ~/.argus)
 *
 * 5번이 처음 발동하는 프로세스는 stderr 로 한 줄 알린다 — "내 기록이 어디
 * 갔지"를 지원할 때 이 줄이 답이다. 깃 없는 새 프로젝트 폴더는 홈으로 가다가
 * git init 후 프로젝트 원장으로 갈라진다 — 앱 대화 기록이 영원히 조각나는
 * 것보다 훨씬 작은 비용이다 (트레이드오프 검토 2026-07-30).
 */
const HOME_FALLBACK_NOTE = 'argus: this folder has no git repo and no .argus - using the personal home ledger';
let homeFallbackAnnounced = false;

function insideGitRepo(startDir: string): boolean {
  let dir = startDir;
  for (let i = 0; i < 40; i++) {
    try {
      if (fs.existsSync(path.join(dir, '.git'))) return true;
    } catch { return false; }
    const parent = path.dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
  return false;
}

export function resolveDefaultArgusDir(
  cwd: string = process.cwd(),
  homeRoot: string = process.env['ARGUS_HOME'] || path.join(os.homedir(), '.argus'),
): string {
  const local = path.join(cwd, '.argus');
  try {
    if (fs.existsSync(local)) return local;
  } catch { /* 접근 불가 폴더 — 아래 규칙으로 */ }
  if (insideGitRepo(cwd)) return local;
  if (!homeFallbackAnnounced) {
    homeFallbackAnnounced = true;
    try { process.stderr.write(HOME_FALLBACK_NOTE + ` (${homeRoot})\n`); } catch { /* stderr 없음 */ }
  }
  return homeRoot;
}

export function resolveToolArgusDir(callArg: unknown): string {
  if (typeof callArg === 'string' && callArg.length > 0) return requireArgusDir(callArg);
  const configured = process.env['ARGUS_DIR'];
  if (configured) return requireArgusDir(configured);
  return resolveDefaultArgusDir();
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
  return resolveDefaultArgusDir();
}
