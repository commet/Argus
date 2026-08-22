import fs from 'node:fs';
import path from 'node:path';

/**
 * 이미 쓰고 있던 규칙 파일 찾기 — 역이식(`dec-scan-rules` → `dec-sign --from-clause`)의 첫 걸음.
 *
 * **빈 장부로 시작하지 않는다**가 이 제품의 첫 60초다. 그러려면 사람이
 * 이미 쓰고 있던 규칙이 어디 있는지부터 알아야 한다.
 *
 * 목록은 **고정이고 짧다.** 저장소를 훑어 "규칙처럼 생긴 파일"을 찾는 방식은
 * 안 쓴다 — 무엇을 읽었는지 사람이 예측할 수 없게 되고, 남의 문서를 읽어
 * 후보로 만드는 사고가 난다. 새 자리를 더하려면 이 목록에 적는다.
 */

export interface RuleFile {
  /** 저장소 뿌리 기준 경로 (`/` 로 정규화 — 윈도우에서도 같은 값). */
  rel: string;
  abs: string;
  /** 어느 도구의 규칙 파일인가 — 화면에서 "CLAUDE.md 41조" 처럼 쓴다. */
  tool: string;
  bytes: number;
}

const KNOWN: Array<{ rel: string; tool: string }> = [
  { rel: 'CLAUDE.md', tool: 'Claude Code' },
  { rel: '.claude/CLAUDE.md', tool: 'Claude Code' },
  { rel: 'AGENTS.md', tool: 'Codex' },
  { rel: '.cursorrules', tool: 'Cursor' },
  { rel: '.cursor/rules', tool: 'Cursor' },
  { rel: '.windsurfrules', tool: 'Windsurf' },
  { rel: '.github/copilot-instructions.md', tool: 'Copilot' },
  { rel: 'CONVENTIONS.md', tool: 'Aider' },
];

/** 최대 읽기 크기 — 이보다 큰 규칙 파일은 규칙 파일이 아니라 문서다. */
export const MAX_RULE_FILE_BYTES = 512 * 1024;

export interface DiscoverResult {
  files: RuleFile[];
  /** 있었지만 안 읽은 것 — 이유와 함께. 조용히 건너뛰지 않는다. */
  skipped: Array<{ rel: string; why: string }>;
}

export function discoverRuleFiles(repoRoot: string): DiscoverResult {
  const files: RuleFile[] = [];
  const skipped: DiscoverResult['skipped'] = [];
  for (const known of KNOWN) {
    const abs = path.join(repoRoot, known.rel);
    let stat: fs.Stats;
    try { stat = fs.statSync(abs); } catch { continue; }
    if (!stat.isFile()) { skipped.push({ rel: known.rel, why: '파일이 아니다' }); continue; }
    if (stat.size === 0) { skipped.push({ rel: known.rel, why: '비어 있다' }); continue; }
    if (stat.size > MAX_RULE_FILE_BYTES) {
      skipped.push({ rel: known.rel, why: `너무 크다 (${Math.round(stat.size / 1024)}KB)` });
      continue;
    }
    files.push({ rel: known.rel, abs, tool: known.tool, bytes: stat.size });
  }
  return { files, skipped };
}
