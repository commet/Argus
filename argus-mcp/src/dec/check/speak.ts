import type { CheckResult, Match } from './match.js';

/**
 * **말할지 말지가 형태보다 먼저다.**
 *
 * CLAUDE.md 거울 조항: 과발화도 스파인 위반이다. 걸렸다고 매번 말하면
 * 사람은 사흘 만에 도구를 끈다. 그래서 판정이 먼저 돌고, 통과한 것만 한 줄이
 * 된다.
 *
 * 침묵하는 자리 넷:
 *  ① 이번 세션에 이미 말한 결정   ② 잘못 잡았다고 세 번 들은 결정
 *  ③ 오늘 이 저장소에서 이미 세 번 말했으면 (하루 상한)
 *  ④ 걸린 것이 없을 때 — 당연하지만, **"안 걸렸다"를 "괜찮다"로 말하지 않는다**
 */

export interface SpeakInput {
  result: CheckResult;
  /** 이번 세션에 이미 말한 결정 id. */
  spoken_this_session: readonly string[];
  /** id → 잘못 잡았다고 들은 횟수. */
  misfires: Readonly<Record<string, number>>;
  /** 오늘 이 저장소에서 말한 총 횟수. */
  spoken_today: number;
}

/** 잘못 잡았다는 말을 이만큼 들으면 그 규칙은 말하기를 멈춘다. */
export const MISFIRE_LIMIT = 3;
/** 하루에 이보다 많이 말하지 않는다. */
export const DAILY_LIMIT = 3;

export type SpeakDecision =
  | { speak: true; match: Match; lines: string[] }
  | { speak: false; why: 'no_match' | 'already_said' | 'too_many_misfires' | 'daily_limit' };

export function decideSpeak(input: SpeakInput): SpeakDecision {
  if (input.result.matches.length === 0) return { speak: false, why: 'no_match' };
  if (input.spoken_today >= DAILY_LIMIT) return { speak: false, why: 'daily_limit' };

  const fresh = input.result.matches.filter((m) => !input.spoken_this_session.includes(m.id));
  if (fresh.length === 0) return { speak: false, why: 'already_said' };

  const usable = fresh.filter((m) => (input.misfires[m.id] ?? 0) < MISFIRE_LIMIT);
  if (usable.length === 0) return { speak: false, why: 'too_many_misfires' };

  // 한 번에 하나만 말한다. 여러 개가 걸려도 사람에게 목록을 던지지 않는다.
  const match = usable[0]!;
  const lines = [
    `[아르고스] ${match.id} — ${match.decision}`,
    match.channel === 'file'
      ? `  방금 ${match.matched} 에 걸렸다.`
      : `  방금 "${match.matched}" 라는 말에 걸렸다.`,
  ];
  if (match.blind_spots.length > 0) {
    lines.push(`  이 규칙이 못 잡는 것: ${match.blind_spots.join(' / ')}`);
  }
  lines.push(`  잘못 잡았으면: argus-decision-mcp dec-misfire --id ${match.id} --matched "${match.matched}"`);
  return { speak: true, match, lines };
}
