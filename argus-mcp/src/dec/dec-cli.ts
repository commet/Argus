import path from 'node:path';
import { syncDecisionFiles, verifyDecisionFiles } from './files.js';

function flag(args: readonly string[], name: string): string | null {
  const index = args.indexOf(name);
  return index >= 0 && typeof args[index + 1] === 'string' ? args[index + 1]! : null;
}

function argusDirOf(args: readonly string[], command: string): string {
  const dir = flag(args, '--argus-dir');
  if (!dir || !path.isAbsolute(dir)) throw new Error(`${command} requires an absolute --argus-dir`);
  return dir;
}

/** 원장에서 결정 파일을 다시 그린다. 사람이 고친 파일은 손대지 않는다. */
export function runDecSyncCli(args: readonly string[]): void {
  process.stdout.write(JSON.stringify(syncDecisionFiles(argusDirOf(args, 'dec-sync'))) + '\n');
}

/**
 * 파일과 기록이 같다는 것을 증명한다 — 전부 다시 만들어 바이트로 비교.
 * **어긋나면 0 아닌 코드로 끝난다** (나중에 CI 관문으로 그대로 쓰인다).
 */
export function runDecVerifyCli(args: readonly string[]): void {
  const result = verifyDecisionFiles(argusDirOf(args, 'dec-verify'));
  process.stdout.write(JSON.stringify(result) + '\n');
  if (!result.ok) process.exitCode = 1;
}
