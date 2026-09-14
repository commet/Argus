import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { PastEvent } from './engine.js';

/**
 * 과거를 모으는 자리 — 시운전에 대볼 재료.
 *
 * 두 곳에서 온다:
 *  - **git 이력**: 어떤 파일을 고쳤나 (파일 채널) + 커밋 제목 (말 채널)
 *  - **대화 기록**: 무슨 말이 오갔나 (말 채널)
 *
 * **기존 대화 읽기를 안 쓰는 이유** (능력 중복 검사기가 묻는 것):
 * `argus-mcp/src/v2/candidate-capture.ts` 의 `readTranscriptTurns` 와
 * `argus-mcp/src/v2/gate.ts` 의 `userUtterances` 가 같은 파일을 읽지만 —
 *  · **시각이 없다.** 시운전은 "지난 30일"과 "08-12" 를 말해야 한다.
 *  · **파일을 통째로 받는다.** 긴 세션 하나가 나머지를 통째로 막는 일이 실제로
 *    났고, 그래서 여기는 큰 파일의 **꼬리만** 읽는다.
 *  · 기계가 끼운 글을 거르는 기준이 다르다 (아래 `isHumanTurn` 주석).
 * `argus-mcp/src/v2/harvest.ts` 는 후보를 **만드는** 쪽이라 여기서 부를 수 없다 —
 * 시운전은 아무것도 만들지 않는다.
 *
 * 판정은 여기 없다 — 판정은 `engine.ts` 의 순수 함수가 한다. 여기는 읽기만
 * 하고, 못 읽으면 **못 읽었다고 말한다.** 조용히 빈 배열을 돌려주면
 * "부딪힌 적 없다"는 거짓말이 된다.
 *
 * 구분자에 비가시 문자를 쓰지 않는다 (이 저장소 규약: 사람이 diff 에서 볼 수
 * 없는 글자는 고칠 수도 없다). 커밋 해시가 40자 고정이고 날짜에 공백이 없다는
 * 것을 이용해 앞에서부터 자른다.
 */

export interface CollectResult {
  past: PastEvent[];
  /** 못 읽은 것 — 이유와 함께. 비어 있어야 숫자를 믿을 수 있다. */
  gaps: string[];
  sources: { git: boolean; transcripts: number };
}

const GIT_TIMEOUT_MS = 20_000;
const MAX_GIT_BYTES = 12 * 1024 * 1024;
/** 한 번에 읽을 총량. */
const MAX_TRANSCRIPT_BYTES = 200 * 1024 * 1024;
/** 파일 하나에서 읽을 최대치 — 넘으면 **꼬리만** 읽는다. 긴 세션 하나 때문에
 *  나머지 세션을 통째로 못 읽는 일이 실제로 났다 (2026-08-21 실주행). */
const MAX_ONE_TRANSCRIPT_BYTES = 32 * 1024 * 1024;
const COMMIT_MARK = '@@argus-commit@@';

/** git 이력 — 커밋마다 고친 파일 목록과 제목. */
export function collectGitPast(repoRoot: string, days: number): { past: PastEvent[]; gap?: string } {
  let raw: string;
  try {
    raw = execFileSync('git', [
      'log', `--since=${days}.days`, '--no-merges',
      `--pretty=format:${COMMIT_MARK}%H %aI %s`, '--name-only',
    ], { cwd: repoRoot, encoding: 'utf8', timeout: GIT_TIMEOUT_MS, maxBuffer: MAX_GIT_BYTES });
  } catch (error) {
    const why = error instanceof Error ? (error.message.split('\n')[0] ?? error.message) : String(error);
    return { past: [], gap: `git 이력을 못 읽었다: ${why}` };
  }

  const past: PastEvent[] = [];
  for (const chunk of raw.split(COMMIT_MARK)) {
    if (!chunk.trim()) continue;
    const lines = chunk.split('\n');
    const header = lines[0] ?? '';
    const sha = header.slice(0, 40);
    if (!/^[0-9a-f]{40}$/.test(sha)) continue;
    const rest = header.slice(41);
    const space = rest.indexOf(' ');
    const at = space < 0 ? rest : rest.slice(0, space);
    const subject = space < 0 ? '' : rest.slice(space + 1);
    const where = sha.slice(0, 7);
    if (subject.trim()) past.push({ kind: 'utterance', at, text: subject, where });
    for (const line of lines.slice(1)) {
      const file = line.trim();
      // 커밋 제목을 같이 실어야 장면이 "무슨 작업 중이었나"를 말해 준다.
      if (file) past.push({ kind: 'file_change', at, path: file, where, context: subject.trim() });
    }
  }
  return { past };
}

/** 이 저장소의 대화 기록이 사는 곳 (Claude Code 는 작업 폴더 경로를 이름으로 쓴다). */
export function transcriptDirFor(repoRoot: string, home = os.homedir()): string {
  const slug = path.resolve(repoRoot).replace(/\\/g, '/').replace(/[/.]/g, '-');
  return path.join(home, '.claude', 'projects', slug);
}

/**
 * 이 줄이 **사람이 실제로 친 말**인가.
 *
 * `type: 'user'` 만 보면 안 된다 — 도구 결과·시스템이 끼워 넣은 글·다른
 * 에이전트의 말이 전부 같은 이름을 달고 들어온다. 그걸 "그때 한 말"이라며
 * 사용자에게 보여주면 자기 말이 아닌 것을 자기 말로 읽게 된다 (저자성에
 * 거짓말하지 않는다). 다행히 기록에 표식이 다 있다.
 */
function isHumanTurn(row: Record<string, unknown>): boolean {
  if (row['type'] !== 'user') return false;
  if (row['toolUseResult'] !== undefined) return false;      // 도구가 돌려준 것
  if (row['isMeta'] === true) return false;                   // 시스템이 끼워 넣은 것
  if (row['isCompactSummary'] === true) return false;         // 이어붙이기 요약 (기계가 쓴 글)
  if (row['isSidechain'] === true) return false;              // 다른 에이전트의 말
  if (row['isVisibleInTranscriptOnly'] === true) return false;
  return true;
}

/**
 * 사람이 친 줄에도 기계가 붙인 딱지가 섞인다 — 그 부분만 걷어낸다.
 * (실주행에서 `<task-notification>` 이 "그때 한 말"로 화면에 나왔다.)
 */
const MACHINE_TAGS = [
  'system-reminder', 'task-notification', 'github-webhook-activity',
  'untrusted_external_data', 'local-command-caveat', 'local-command-stdout',
  'local-command-stderr', 'command-name', 'command-message', 'command-args',
  'function_results', 'wake',
];
const STRIP_TAGS = new RegExp(`<(${MACHINE_TAGS.join('|')})[^>]*>[\\s\\S]*?<\\/\\1>`, 'g');
const STRIP_SELF_CLOSING = new RegExp(`<(?:${MACHINE_TAGS.join('|')})[^>]*/?>`, 'g');

function userTextOf(row: Record<string, unknown>): string {
  const message = row['message'] as { content?: unknown } | undefined;
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((part): part is { type: string; text: string } =>
      !!part && typeof part === 'object' &&
      (part as { type?: unknown }).type === 'text' &&
      typeof (part as { text?: unknown }).text === 'string')
    .map((part) => part.text)
    .join('\n');
}

/** 대화 기록 — **사람이 한 말만.** 에이전트가 한 말은 규칙의 대상이 아니다. */
export function collectTranscriptPast(
  repoRoot: string, days: number, home = os.homedir(),
): { past: PastEvent[]; files: number; gaps: string[] } {
  const dir = transcriptDirFor(repoRoot, home);
  let names: string[];
  try { names = fs.readdirSync(dir).filter((n) => n.endsWith('.jsonl')); }
  catch { return { past: [], files: 0, gaps: [`대화 기록 폴더가 없다: ${dir}`] }; }

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const past: PastEvent[] = [];
  const gaps: string[] = [];
  let files = 0;
  let bytes = 0;

  for (const name of names.sort()) {
    const file = path.join(dir, name);
    let stat: fs.Stats;
    try { stat = fs.statSync(file); } catch { continue; }
    if (stat.mtimeMs < cutoff) continue;
    if (bytes >= MAX_TRANSCRIPT_BYTES) {
      gaps.push(`읽을 양이 한도를 넘어 ${name} 부터는 안 읽었다`);
      break;
    }
    let text: string;
    try {
      if (stat.size > MAX_ONE_TRANSCRIPT_BYTES) {
        // 앞을 버리고 뒤를 읽는다 — 시운전은 최근을 본다. 잘린 첫 줄은
        // 파스가 안 되므로 아래 루프가 알아서 버린다.
        const handle = fs.openSync(file, 'r');
        try {
          const buffer = Buffer.alloc(MAX_ONE_TRANSCRIPT_BYTES);
          fs.readSync(handle, buffer, 0, MAX_ONE_TRANSCRIPT_BYTES, stat.size - MAX_ONE_TRANSCRIPT_BYTES);
          text = buffer.toString('utf8');
        } finally { fs.closeSync(handle); }
        gaps.push(`${name} 이 너무 커서 뒷부분만 읽었다`);
        bytes += MAX_ONE_TRANSCRIPT_BYTES;
      } else {
        text = fs.readFileSync(file, 'utf8');
        bytes += stat.size;
      }
    } catch (error) {
      gaps.push(`${name} 을 못 읽었다: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    files += 1;
    const where = name.replace(/\.jsonl$/, '').slice(0, 8);
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      let row: Record<string, unknown>;
      try { row = JSON.parse(line) as Record<string, unknown>; } catch { continue; }
      if (!isHumanTurn(row)) continue;
      const said = userTextOf(row)
        .replace(STRIP_TAGS, ' ')
        .replace(STRIP_SELF_CLOSING, ' ')
        .trim();
      const at = typeof row['timestamp'] === 'string' ? row['timestamp'] : new Date(stat.mtimeMs).toISOString();
      if (said.trim()) past.push({ kind: 'utterance', at, text: said, where });
    }
  }
  return { past, files, gaps };
}

export function collectPast(repoRoot: string, days: number, home = os.homedir()): CollectResult {
  const git = collectGitPast(repoRoot, days);
  const transcripts = collectTranscriptPast(repoRoot, days, home);
  return {
    past: [...git.past, ...transcripts.past],
    gaps: [...(git.gap ? [git.gap] : []), ...transcripts.gaps],
    sources: { git: !git.gap, transcripts: transcripts.files },
  };
}
