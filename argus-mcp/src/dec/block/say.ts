import type { BlockDecision } from './decide.js';

/**
 * 막았을 때 나가는 글.
 *
 * **규율 하나가 전부다: 우회 방법을 적지 않는다.** "대신 이렇게 하세요"·
 * "정 필요하면 --force" 류가 한 줄이라도 들어가면, 자동 컴파일이 그것을
 * 결정 수만큼 복제해서 **잠긴 문마다 열쇠 설명서를 붙인다**.
 *
 * 대신 셋을 말한다: **무엇을 막았나 · 누가 언제 정했나 · 이 규칙이 못 잡는 것.**
 * 세 번째가 있어야 사람이 "안 막혔으니 괜찮다"를 안 믿는다.
 *
 * 푸는 길은 여기 없다. 결정을 바꾸는 것은 결정을 바꾸는 자리에서 한다
 * (`dec-amend`·`dec-close --sunset`) — 그건 막힌 순간이 아니라 다시 보는
 * 순간의 일이다. 급하면 사람이 훅을 끄면 되고, 그건 우리가 가르칠 일이 아니다.
 */
export function sayBlock(decision: BlockDecision): string[] {
  if (!decision.block) return [];
  const lines: string[] = ['[아르고스] 여기서 하지 않기로 정해 둔 일이다.'];
  for (const m of decision.blocking) {
    lines.push('');
    lines.push(`  ${m.id}  ${m.decision}`);
    lines.push(`  걸린 데: ${m.matched}`);
    if (m.blind_spots.length > 0) {
      // 막을 때도 못 잡는 것을 말한다 — 안 그러면 "안 막혔다"가 "괜찮다"가 된다.
      lines.push(`  이 규칙이 못 잡는 것: ${m.blind_spots.join(' / ')}`);
    }
  }
  if (decision.matched_not_ban > 0) {
    lines.push('');
    lines.push(`걸리긴 했으나 금지가 아니라 안 막은 것이 ${decision.matched_not_ban}건 있다.`);
  }
  return lines;
}

/**
 * 안 막았지만 **걸리긴 한** 것을 알리는 글 (관찰 중 · 사람이 멈춰 둔 것).
 *
 * 막는 글과 갈라 둔다 — 이건 손을 붙잡는 말이 아니라 알려 주는 말이고, 훅은
 * 이걸로 종료 코드를 바꾸지 않는다. 조용히 넘기면 **관찰 모드가 그냥 침묵**이
 * 되어 "3일간 4번 걸렸다, 깎을까?" 를 물을 재료가 안 쌓인다.
 */
export function sayHeldBack(decision: BlockDecision): string[] {
  if (decision.held_back.length === 0) return [];
  const lines: string[] = [];
  for (const h of decision.held_back) {
    lines.push(h.why === 'paused'
      ? `${h.id} 에 걸렸다. ${h.until}까지 멈춰 두기로 해서 안 막았다. (${h.decision})`
      : h.why === 'observing'
        ? `${h.id} 에 걸렸다. 아직 보고만 있다 — ${h.until}부터 막는다. (${h.decision})`
        : `${h.id} 에 걸렸다. 오늘이 며칠인지 몰라 안 막았다. (${h.decision})`);
  }
  return lines;
}
