import path from 'node:path';
import { syncDecisionFiles, verifyDecisionFiles } from './files.js';
import fs from 'node:fs';
import { discoverRuleFiles } from './rules/discover.js';
import { splitRuleFile, unmarkedBlocks, verifyClauseAnchors, type Clause, type SkippedBlock } from './rules/split.js';

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

/**
 * 이미 쓰고 있던 규칙 파일을 읽어 조항으로 갈라 낸다 — 역이식의 앞쪽 절반.
 *
 * **여기서 모델을 부르지 않는다.** 자르기만 하고, 이해하는 일(범위·어긋난 걸
 * 아는 방법의 초안)은 사람이 확인하는 순간에 한 번 부른다.
 *
 * 읽을 과거가 없으면 지어내지 않고 **없다고 말한다** — 자격 거절의 재료다.
 */
export function runDecScanRulesCli(args: readonly string[]): void {
  const repo = flag(args, '--repo');
  if (!repo || !path.isAbsolute(repo)) throw new Error('dec-scan-rules requires an absolute --repo');
  const found = discoverRuleFiles(repo);
  const clauses: Clause[] = [];
  const skipped: SkippedBlock[] = [];
  const anchorsMissing: string[] = [];
  /** 표지가 없어 후보로 안 올린 덩어리의 **원문**. 세기만 하고 감추면
   *  "우리가 못 본 규칙"이 조용한 공백이 된다 — 다음 단계와 사람이 볼 수
   *  있도록 그대로 돌려준다. */
  const unmarked: Array<{ file: string; line_start: number; text: string }> = [];
  for (const file of found.files) {
    const source = fs.readFileSync(file.abs, 'utf8');
    const split = splitRuleFile(file.rel, source);
    clauses.push(...split.clauses);
    skipped.push(...split.skipped);
    anchorsMissing.push(...verifyClauseAnchors(source, split.clauses).missing);
    unmarked.push(...unmarkedBlocks(source, split));
  }
  const skipped_by_reason: Record<string, number> = {};
  for (const s of skipped) skipped_by_reason[s.why] = (skipped_by_reason[s.why] ?? 0) + 1;
  process.stdout.write(JSON.stringify({
    files: found.files.map((f) => ({ rel: f.rel, tool: f.tool, bytes: f.bytes })),
    files_skipped: found.skipped,
    clause_count: clauses.length,
    skipped_by_reason,
    // 원문이 파일에 그대로 있는지 바이트로 다시 본 결과. 비어 있어야 정상이다.
    anchors_missing: anchorsMissing,
    clauses,
    unmarked,
  }) + '\n');
}
