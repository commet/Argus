import fs from 'node:fs';
import path from 'node:path';
import { fingerprintOf } from '../render.js';
import { scopeSay } from '../scope.js';
import type { DecisionRecord } from '../types.js';

/**
 * 규칙 파일 방출 (단계 9, N5).
 *
 * fan-out 은 안 짓는다 — 도구마다 다른 형식으로 뿌리는 것은 커머디티다
 * (기획서 §4.3). 우리는 **한 파일**(`AGENTS.md`, 6만+ 저장소가 이미 읽는 이름)
 * 에 우리 몫 한 덩어리를 넣고, 방출이 해결 못 하는 셋을 우리가 갖는다:
 *
 *  ① **신선도** — 장부가 바뀌면 다시 방출한다. 일회 변환이 아니라 동기화다.
 *  ② **드리프트 감지** — 덩어리에 지문을 박아 손댄 걸 장부가 안다.
 *  ③ **계층 정직** — 방출된 법은 **읽히는 법이지 감시되는 법이 아니다.**
 *     그 문장을 파일 안에 우리가 직접 적는다. 안 적으면 방출본을 읽는
 *     다른 도구의 사용자는 자기가 감시받고 있다고 믿는다.
 *
 * **남의 글을 안 건드린다.** 표시 둘 사이만 우리 것이고, 밖은 바이트 그대로
 * 둔다. 표시가 없으면 파일 끝에 붙인다.
 */

export const BEGIN = '<!-- argus:decisions begin -->';
export const END = '<!-- argus:decisions end -->';
const PRINT = '<!-- argus:fingerprint sha256:';

/** 방출 파일이 사는 곳 — 저장소 뿌리의 `AGENTS.md`. */
export function exportPath(argusDir: string): string {
  return path.join(path.dirname(argusDir), 'AGENTS.md');
}

/** 방출되는 것은 **살아 있는 결정**뿐이다. 그만둔 것은 안 나간다. */
export function exportableOf(records: readonly DecisionRecord[]): DecisionRecord[] {
  return records.filter((r) => r.status === 'active')
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function renderExportBody(records: readonly DecisionRecord[]): string {
  const live = exportableOf(records);
  const out: string[] = ['## 이 저장소에서 정해 둔 것', ''];
  if (live.length === 0) {
    out.push('아직 정해 둔 것이 없다.', '');
  }
  for (const r of live) {
    out.push(`- **${r.id}** ${r.decision}`);
    // **누구를 묶나를 빼면 안 된다.** 이 파일은 남의 도구가 읽는다 — 읽는 쪽이
    // 자기한테 걸리는 말인지 알아야 한다. 기록에 있는데 안 보여 주면 없는 것과 같다.
    const bits = [`누구에게: ${r.binds}`, `걸리는 곳: ${scopeSay(r.scope)}`];
    if (r.review) bits.push(`다시 볼 날 ${r.review}`);
    out.push(`  ${bits.join(' · ')}`);
    if (r.because) out.push(`  왜: ${r.because}`);
  }
  out.push('');
  // ③ 계층 정직 — 이 파일이 무엇이 아닌지를 이 파일이 말한다.
  out.push('여기 적힌 것은 **읽히는 법이지 감시되는 법이 아니다.** 이 파일을 읽는 도구는');
  out.push('어긋나도 알려주지 않는다 — 알림과 막는 것은 아르고스가 붙어 있는 자리에서만 돈다.');
  out.push('');
  out.push('이 덩어리는 기계가 쓴다. 손으로 고치면 다음 방출 때 알아채고 묻는다 —');
  out.push('고칠 것이 있으면 결정을 고쳐라(`dec-amend`).');
  return out.join('\n') + '\n';
}

export interface ExportBlock { body: string; fingerprint: string }

/** 파일에서 우리 덩어리를 꺼낸다. 없으면 `null`. */
export function readBlock(text: string): ExportBlock | null {
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  if (start < 0 || end < 0 || end < start) return null;
  const inner = text.slice(start + BEGIN.length, end);
  const printAt = inner.lastIndexOf(`\n${PRINT}`);
  if (printAt < 0) return { body: inner.replace(/^\n/, ''), fingerprint: '' };
  const body = inner.slice(0, printAt + 1).replace(/^\n/, '');
  const rest = inner.slice(printAt + 1).trim();
  const fingerprint = rest.startsWith(PRINT) && rest.endsWith('-->')
    ? rest.slice(PRINT.length, rest.length - 3).trim()
    : '';
  return { body, fingerprint };
}

function wrap(body: string): string {
  return `${BEGIN}\n${body}${PRINT}${fingerprintOf(body)} -->\n${END}`;
}

export type ExportVerdict =
  /** 파일이 원장과 같다. */
  | 'match'
  /** 사람이 방출본을 손으로 고쳤다 — 덮어쓰지 않는다. */
  | 'hand_edited'
  /** 원장이 앞서 갔다 — 다시 방출하면 된다. */
  | 'stale'
  /** 아직 방출한 적이 없다. */
  | 'missing';

export interface ExportState {
  file: string;
  verdict: ExportVerdict;
  /** 손으로 고친 경우, 무엇이 어떻게 달라졌나 (사람이 보고 정한다). */
  hand_edit?: { on_disk: string; from_ledger: string };
}

export function inspectExport(argusDir: string, records: readonly DecisionRecord[]): ExportState {
  const file = exportPath(argusDir);
  let text: string;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return { file, verdict: 'missing' }; }
  const block = readBlock(text);
  if (!block) return { file, verdict: 'missing' };

  const fresh = renderExportBody(records);
  if (block.fingerprint !== fingerprintOf(block.body)) {
    // 지문이 자기 본문과 안 맞는다 = 사람(또는 남의 도구)이 손댔다.
    return { file, verdict: 'hand_edited', hand_edit: { on_disk: block.body, from_ledger: fresh } };
  }
  return { file, verdict: block.body === fresh ? 'match' : 'stale' };
}

export interface EmitResult {
  file: string;
  /** 무엇을 했나. `held` 는 사람이 고친 것을 보고 멈춘 것이다. */
  action: 'written' | 'unchanged' | 'held';
  verdict: ExportVerdict;
  count: number;
  hand_edit?: { on_disk: string; from_ledger: string };
}

/**
 * 방출한다. **사람이 고친 덩어리는 덮어쓰지 않는다** — 결정 파일과 같은 규율이다
 * (files.ts). 덮어쓰는 순간 그것이 곧 "조용히 무시"다.
 */
export function emitExport(argusDir: string, records: readonly DecisionRecord[]): EmitResult {
  const state = inspectExport(argusDir, records);
  const count = exportableOf(records).length;
  if (state.verdict === 'hand_edited') {
    return { file: state.file, action: 'held', verdict: state.verdict, count, hand_edit: state.hand_edit };
  }
  if (state.verdict === 'match') {
    return { file: state.file, action: 'unchanged', verdict: state.verdict, count };
  }

  const body = renderExportBody(records);
  let text = '';
  try { text = fs.readFileSync(state.file, 'utf8'); } catch { /* 새로 만든다 */ }
  const start = text.indexOf(BEGIN);
  const end = text.indexOf(END);
  const next = start >= 0 && end > start
    ? text.slice(0, start) + wrap(body) + text.slice(end + END.length)
    : (text ? `${text.replace(/\n*$/, '')}\n\n` : '') + wrap(body) + '\n';

  fs.mkdirSync(path.dirname(state.file), { recursive: true });
  const tmp = `${state.file}.tmp`;
  fs.writeFileSync(tmp, next, 'utf8');
  fs.renameSync(tmp, state.file);
  return { file: state.file, action: 'written', verdict: state.verdict, count };
}
