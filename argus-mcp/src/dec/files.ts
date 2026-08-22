import fs from 'node:fs';
import path from 'node:path';
import { foldDecisions, type DecFoldResult } from './fold.js';
import { decisionFileName, fingerprintOf, renderDecisionBody, renderDecisionFile, splitDecisionFile } from './render.js';
import type { DecisionRecord } from './types.js';

/**
 * 결정 파일을 디스크에 두는 자리 — 판정 10(B+) 의 몸통.
 *
 * **원장을 여기서 쓰지 않는다.** 추가 전용 원장은 `argus-mcp/src/v2/ledger.ts`
 * 와 `method-harness/ledger.ts` 가 이미 갖고 있고, 이 제품의 쓰기는 전부
 * `lib/ledger-append.ts` 한 관문을 지난다(`src/dec/write.ts`). 이 파일은
 * **읽어서 사람이 보는 파일을 그리기만** 한다 — 여기서 append 하면 관문이
 * 둘이 되고, 그걸 막는 검사가 `lib/__tests__/ledger-gateway.test.ts` 다.
 *
 * 규율 둘이 여기 전부다:
 *  1. **사람이 고친 파일을 덮어쓰지 않는다.** 덮어쓰면 그게 곧 "조용히 무시"이고,
 *     그것 때문에 안(B)이 탈락했다. 고친 흔적을 보면 **멈추고 알린다** — 그
 *     수정을 개정으로 받을지는 사람이 정한다.
 *  2. **원장에 없는 파일을 조용히 지우지 않는다.** 남의 파일일 수도, 우리 버그일
 *     수도 있다. 지우지 않고 이름을 돌려준다.
 */

/** 결정 파일이 사는 곳 — 저장소 안 `decisions/` (기획서 §4.2). */
export function decisionsDir(argusDir: string): string {
  return path.join(path.dirname(argusDir), 'decisions');
}

export type FileVerdict =
  /** 원장에서 다시 만든 것과 바이트까지 같다. */
  | 'match'
  /** 사람이 파일을 고쳤다 — 본문이 그 파일 자신의 지문과 안 맞는다. */
  | 'hand_edited'
  /** 사람은 안 고쳤는데 원장에서 다시 만든 것과 다르다 — 원장이 앞서 갔거나
   *  그리는 코드가 바뀌었다. 이 구조의 알려진 약점이고, 이게 그 전선이다. */
  | 'stale'
  /** 결정은 있는데 파일이 없다. */
  | 'missing'
  /** 파일은 있는데 그 id 의 결정이 원장에 없다. */
  | 'orphan';

export interface FileState {
  id: string;
  file: string;
  verdict: FileVerdict;
}

export interface SyncResult {
  written: string[];
  unchanged: string[];
  /** 덮어쓰지 **않은** 것들 — 사람이 고친 파일. 부르는 쪽이 물어봐야 한다. */
  hand_edited: string[];
  orphans: string[];
  dropped_lines: number;
  unreadable?: string;
}

export interface VerifyResult {
  ok: boolean;
  files: FileState[];
  dropped_lines: number;
  unreadable?: string;
}

function readIfExists(file: string): string | null {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

/** 디스크의 한 파일이 어떤 상태인지 — 원장에서 다시 만든 것과 견줘서. */
function verdictFor(existing: string | null, record: DecisionRecord): FileVerdict {
  if (existing === null) return 'missing';
  const split = splitDecisionFile(existing);
  // 지문이 아예 없으면 사람 손이 닿았다고 본다 (우리가 쓴 파일에는 항상 있다).
  if (!split) return 'hand_edited';
  if (fingerprintOf(split.body) !== split.fingerprint) return 'hand_edited';
  return existing === renderDecisionFile(record) ? 'match' : 'stale';
}

/** 디렉터리에 있는 `D-*.md` 들 (우리가 만드는 이름 규칙에 맞는 것만). */
function existingFiles(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((f) => /^[A-Za-z][\w-]*\.md$/.test(f)).sort();
  } catch { return []; }
}

function writeAtomic(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * 원장 → 파일. 사람이 고친 파일은 **건드리지 않고 이름만 돌려준다.**
 */
/**
 * 원장에서 결정 파일을 다시 그린다.
 *
 * `fold` 를 받을 수 있게 열어 둔다 — 쓰기 한 번에 원장을 두 번 접으면 그
 * 사이에 다른 프로세스가 끼어들어 **두 접힘이 서로 다른 세상**을 보게 된다.
 * (그리고 원장이 길어질수록 그냥 두 배 느리다.)
 */
export function syncDecisionFiles(argusDir: string, folded?: DecFoldResult): SyncResult {
  const fold = folded ?? foldDecisions(argusDir);
  const dir = decisionsDir(argusDir);
  const result: SyncResult = {
    written: [], unchanged: [], hand_edited: [], orphans: [], dropped_lines: fold.dropped,
    ...(fold.unreadable ? { unreadable: fold.unreadable } : {}),
  };
  // 원장을 못 읽었으면 아무것도 안 쓴다 — 빈 원장으로 착각해 파일을 지우거나
  // 되돌리는 것이 최악이다.
  if (fold.unreadable) return result;

  const known = new Set<string>();
  for (const record of fold.records) {
    const file = path.join(dir, decisionFileName(record.id));
    known.add(decisionFileName(record.id));
    const existing = readIfExists(file);
    const verdict = verdictFor(existing, record);
    if (verdict === 'hand_edited') { result.hand_edited.push(record.id); continue; }
    if (verdict === 'match') { result.unchanged.push(record.id); continue; }
    writeAtomic(file, renderDecisionFile(record));
    result.written.push(record.id);
  }
  for (const name of existingFiles(dir)) {
    if (!known.has(name)) result.orphans.push(name);
  }
  return result;
}

/**
 * 원장에서 전부 다시 만들어 바이트로 비교한다 — 파일과 기록이 같다는 증명.
 */
/**
 * 손으로 고친 결정 파일을 **말로** 옮긴다.
 *
 * 결정 파일 맨 아래가 *"고친 게 보이면 다음에 「이대로 바꿀까요?」 하고
 * 묻는다"* 라고 약속한다. 초판은 그 약속을 지킬 문장이 없었다 —
 * `hand_edited` 가 JSON 에만 담기고 어느 화면에도 안 나갔다
 * (2026-08-21 전수 검수에서 실측: 브리프도 · 다음 쓰기 명령도 · verify 도
 * 한 마디 안 했다). 내보낸 규칙 파일 쪽에는 이미 `sayExport` 가 있었다.
 */
export function sayHandEdited(ids: readonly string[]): string[] {
  if (ids.length === 0) return [];
  const which = ids.join(' · ');
  return [
    `${which} 의 파일을 손으로 고쳤다. 덮어쓰지 않았다 — 고친 그대로 있다.`,
    '이대로 결정을 바꿀까? 그러면: ' +
      ids.map((id) => `argus-decision-mcp dec-amend --id ${id} --decision "<파일에 쓴 문장>" --why "<왜 바꾸나>"`).join(' / '),
    '아니면 파일을 지우고 다시 그리면 원래대로 돌아온다.',
  ];
}

export function verifyDecisionFiles(argusDir: string): VerifyResult {
  const fold = foldDecisions(argusDir);
  const dir = decisionsDir(argusDir);
  if (fold.unreadable) {
    return { ok: false, files: [], dropped_lines: fold.dropped, unreadable: fold.unreadable };
  }
  const files: FileState[] = [];
  const known = new Set<string>();
  for (const record of fold.records) {
    const name = decisionFileName(record.id);
    known.add(name);
    files.push({ id: record.id, file: name, verdict: verdictFor(readIfExists(path.join(dir, name)), record) });
  }
  for (const name of existingFiles(dir)) {
    if (!known.has(name)) files.push({ id: name.replace(/\.md$/, ''), file: name, verdict: 'orphan' });
  }
  files.sort((a, b) => a.file.localeCompare(b.file));
  return { ok: files.every((f) => f.verdict === 'match') && fold.dropped === 0, files, dropped_lines: fold.dropped };
}

/** 사람이 고친 파일에서 **무엇이 달라졌는지** — "이대로 바꿀까요?" 를 물으려면 필요하다. */
export function handEditDiff(argusDir: string, record: DecisionRecord): { before: string; after: string } | null {
  const file = path.join(decisionsDir(argusDir), decisionFileName(record.id));
  const existing = readIfExists(file);
  if (existing === null) return null;
  const split = splitDecisionFile(existing);
  const after = split ? split.body : existing;
  return { before: renderDecisionBody(record), after };
}
