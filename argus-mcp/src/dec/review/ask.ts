import type { DueItem } from './due.js';

/**
 * 다시 물을 때 화면에 나가는 글.
 *
 * **순서가 규율이다: 그때 쓴 문장을 먼저 보여주고 나서 묻는다.**
 * 기억은 다시 쓰인다 — 사람은 지금의 자기 생각을 그때의 생각이라고 믿는다
 * (E-0 실측). 원문을 먼저 눈앞에 놓지 않고 물으면 사람은 자기가 쓰지 않은
 * 판단을 자기 판단으로 확인한다.
 *
 * **채점하지 않는다.** 여기 나오는 숫자는 전부 그 결정에 일어난 일이고,
 * 사람에 대한 판정이 아니다.
 */

const REASON_SAY: Record<DueItem['reason'], (days: number) => string> = {
  calendar: (d) => d === 0 ? '오늘 다시 보기로 한 날이다.' : `다시 보기로 한 날에서 ${d}일 지났다.`,
  event: () => '이런 일이 생기면 다시 보기로 했다.',
  quiet: (d) => `${d}일 동안 아무 일도 없었다.`,
};

/** 화면에 적히는 명령은 **그대로 쳐서 도는 것**이어야 한다 (index.ts 가 받는 이름). */
export const DEC_BIN = 'argus-decision-mcp';

export function sayAsk(item: DueItem, argusDir?: string): string[] {
  const { record } = item;
  const run = (rest: string): string =>
    `${DEC_BIN} ${rest}${argusDir ? ` --argus-dir ${argusDir}` : ''}`;
  const lines: string[] = [];

  lines.push(`${record.id}  ${record.decision}`);
  lines.push(`  ${REASON_SAY[item.reason](item.days)}`);
  if (item.reason === 'event' && record.review_on_event) {
    lines.push(`  그 일: ${record.review_on_event}`);
  }
  lines.push('');

  // ── 먼저 보여주는 것: 그때의 당신 ──────────────────────────────────
  lines.push(`  ${record.adopted}에 정했다.`);
  if (record.because) lines.push(`  그때 쓴 이유: ${record.because}`);
  if (record.quote) {
    const quoted = record.quote.replace(/\s+/g, ' ').trim();
    lines.push(`  그때 이렇게 적혀 있었다: "${quoted.length > 120 ? `${quoted.slice(0, 119)}…` : quoted}"`);
  }
  if (!record.because && !record.quote) {
    // 없는 것을 있는 척하지 않는다.
    lines.push('  그때 남긴 이유는 없다.');
  }
  lines.push('');

  // ── 그 다음에 보여주는 것: 그동안 있었던 일 ────────────────────────
  if (record.fires.length > 0) {
    const last = record.fires.at(-1)!;
    lines.push(`  그 뒤로 ${record.fires.length}번 걸렸다 (마지막 ${last.at.slice(0, 10)} · ${last.where}).`);
  } else if (item.reason !== 'quiet') {
    // 조용해서 묻는 것이면 머리에서 이미 말했다 — 두 번 말하지 않는다.
    lines.push('  그 뒤로 한 번도 안 걸렸다.');
  }
  if (record.misfires > 0) lines.push(`  잘못 잡았다고 ${record.misfires}번 말했다.`);
  if (record.falsified_if) {
    // 반증 조건은 있는데 읽는 자리가 없던 것이 가장 값싼 해독제의 dead-on-arrival 이었다.
    lines.push(`  틀린 것으로 치기로 한 조건: ${record.falsified_if}`);
    lines.push('  이 조건에 해당하는 일이 있었나?');
  }
  lines.push('');

  lines.push(`  그대로 둔다    ${run(`dec-close --id ${record.id} --keep --next-review <날짜>`)}`);
  lines.push(`  문장을 바꾼다  ${run(`dec-amend --id ${record.id} --decision "<새 문장>" --why "<왜 바꾸나>"`)}`);
  lines.push(`  그만둔다       ${run(`dec-close --id ${record.id} --sunset --why "<왜 그만두나>"`)}`);
  lines.push(`  나중에 다시    ${run(`dec-close --id ${record.id} --later --next-review <날짜>`)}`);
  return lines;
}
