import { scopeSay } from '../scope.js';
import type { InjectionPlan } from './select.js';

/**
 * 세션이 열릴 때 에이전트에게 가는 글.
 *
 * **읽는 쪽이 사람이 아니라 에이전트다** (기획서 §4.9). 그래서 형식이
 * 계약이다 — 넷을 반드시 말한다:
 *   ① 이게 무엇인지  ② 서로 어긋나 보이면 **네가 고르지 말고 사람에게 회부**
 *   ③ 모르면 **하지 마라(abstain)**  ④ **이 창에 없는 N건** 정직 공백
 *
 * ④ 가 없으면 에이전트는 도착한 몇 줄을 **전부**라고 믿는다. 그게 v4 가
 * 무너진 세 자리 중 하나였다.
 *
 * **발원 원문(`source`)은 여기 안 들어온다.** 보증 문장은 "사람이 서명한
 * 바이트 = 에이전트가 받는 바이트, 그리고 그 사람이 구속하려 한 상대에게만"
 * 이다. 남이 쓴 글이 서명을 거쳐 세탁되는 길을 막는 자리가 여기다.
 */
export function sayInjection(plan: InjectionPlan): string[] {
  if (plan.picks.length === 0 && plan.omitted === 0 && plan.out_of_scope === 0) return [];

  const lines: string[] = [];
  lines.push('[아르고스] 이 사람이 여기서 정해 둔 것이다. 네 판단보다 위다.');
  lines.push('');

  for (const { record, slot } of plan.picks) {
    lines.push(`${record.id}  ${record.decision}`);
    if (slot === 'due') {
      // 날짜가 지났으면 **말해야** 한다 — 목록에 조용히 섞어 두면 아무도 안 닫는다.
      // 다만 닫는 것은 사람 몫이다 (불변식 ② 서명 대리 불가).
      lines.push('      ▸ 다시 볼 때가 됐다. 이건 사람이 답할 것이다 — 네가 대신 닫지 마라.');
    }
    const where = scopeSay(record.scope);
    lines.push(`      걸리는 곳: ${where}${record.review ? ` · 다시 볼 날 ${record.review}` : ''}`);
    const watch = record.watch_rule;
    if (record.watch === 'machine' && watch) {
      if (watch.paths.length > 0) lines.push(`      이 자리: ${watch.paths.join(' · ')}`);
      if (watch.phrases.length > 0) lines.push(`      이 말: ${watch.phrases.map((p) => `"${p}"`).join(' · ')}`);
      if (watch.blind_spots.length > 0) lines.push(`      기계가 못 잡는 것: ${watch.blind_spots.join(' / ')}`);
    } else {
      lines.push('      기계가 못 잡는다. 읽고 지키는 것은 네 몫이다.');
    }
    if (record.because) lines.push(`      왜: ${record.because}`);
    const lesson = record.reviews.filter((r) => r.lesson).at(-1)?.lesson;
    if (lesson) lines.push(`      다시 보고 배운 것: ${lesson}`);
  }

  lines.push('');
  if (plan.omitted > 0) {
    lines.push(`이 창에 안 들어온 것이 ${plan.omitted}건 더 있다 — 없어진 게 아니라 안 펴진 것이다.`);
    lines.push('이 목록을 전부라고 믿지 마라. 걸릴 것 같으면 `dec-check --plan "<하려는 일>"` 으로 물어라.');
  }
  if (plan.out_of_scope > 0) {
    lines.push(`다른 자리에만 걸리는 것 ${plan.out_of_scope}건은 일부러 뺐다.`);
  }
  const due = plan.picks.filter((p) => p.slot === 'due').length;
  if (due > 0) {
    lines.push(`다시 볼 때가 된 것이 ${due}건이다. 사람이 보게 \`dec-due\` 를 띄워 주고, 답은 사람이 한다.`);
  }
  lines.push('서로 어긋나 보이면 **네가 고르지 마라.** 사람에게 물어라.');
  lines.push('여기 없는 일은 모르는 일이다. 모르면 하지 마라 — 지어내지 마라.');
  return lines;
}
