import { checkSubject, type CheckResult, type CheckSubject, type Match } from '../check/match.js';
import type { DecisionRecord } from '../types.js';

/**
 * 막을 것인가 (단계 9, L3).
 *
 * 단계 7 의 알림과 **같은 기계**를 쓴다 (`checkSubject`). 다른 것은 하나뿐 —
 * 여기는 **금지형(`ban`)만** 막는다. 나머지 종류는 걸려도 안 막는다.
 *
 * 왜 금지형만인가: 고정(`pin`)은 *"이렇게 하기로 했다"* 이고, 그 반대가 늘
 * 사고인 것은 아니다. 열림(`open`)은 아직 안 정한 것이고, 예측(`pred`)은
 * 막을 대상이 아니라 채점할 대상이다. **금지만이 "이건 하지 마라"** 다.
 *
 * **못 여는 문에는 열쇠 설명서를 안 붙인다** (기획서 §4.3). 이 저장소의 실물
 * L3 원형이 그 실수를 한다 — 훅 본문이 우회 대안을 친절히 안내한다. 자동
 * 컴파일과 결합하면 잠긴 문마다 열쇠를 대량 생산한다. `say.ts` 가 그 규율을
 * 문장 수준에서 지키고, 테스트가 강제한다.
 *
 * **엔진이 못 읽으면 안 막는다.** 기획서 §4.1 의 fail-closed 는
 * *"서명 기록을 남길 수 없으면 그 규칙의 영향력은 0"* 이라는 뜻이다 —
 * 판정을 못 하면 영향력 0, 즉 통과다. 반대로 하면 원장 한 줄이 깨졌을 때
 * 사람의 하루가 통째로 멈춘다.
 */

/** 갓 만든 금지는 처음 사흘 동안 **보기만 한다** (§4.7 관찰 모드). */
export const OBSERVE_DAYS = 3;

/** 금지형인데 안 막은 것 — 왜 안 막았는지까지 들고 온다. */
export interface HeldBack {
  id: string;
  decision: string;
  matched: string;
  why: 'observing' | 'paused' | 'unknown_date';
  /** 관찰이면 언제부터 물기 시작하나, 정지면 언제까지 멈춰 있나. */
  until: string;
}

export interface BlockDecision {
  block: boolean;
  /** 막은 것들 (금지형만). */
  blocking: Match[];
  /** 금지인데 아직 안 무는 것 — 관찰 중이거나 사람이 멈춰 둔 것. */
  held_back: HeldBack[];
  /** 걸리긴 했으나 금지형이 아니라 안 막은 것 — 세어서 알린다. */
  matched_not_ban: number;
  check: CheckResult;
}

const addDays = (day: string, n: number): string => {
  const t = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(t) ? new Date(t + n * 86_400_000).toISOString().slice(0, 10) : day;
};

/**
 * @param today 오늘 (YYYY-MM-DD). 관찰 기간과 정지 기간을 재는 자다.
 *   **안 주면 아무것도 안 막는다** — 날짜를 모르는 채로 손을 붙잡느니 통과다.
 */
export function decideBlock(
  records: readonly DecisionRecord[], subject: CheckSubject, today?: string,
): BlockDecision {
  const check = checkSubject(records, subject);
  const bans = new Map(records.filter((r) => r.type === 'ban').map((r) => [r.id, r]));
  const blocking: Match[] = [];
  const held: HeldBack[] = [];

  for (const m of check.matches) {
    const record = bans.get(m.id);
    if (!record) continue;
    if (!today) {
      // 관찰도 정지도 아니다 — **날짜를 모르는 것**이다. 셋을 한 이름으로
      // 뭉치면 이 값을 읽는 쪽이 "사흘 뒤엔 물겠구나"로 잘못 읽는다.
      held.push({ id: m.id, decision: m.decision, matched: m.matched, why: 'unknown_date', until: '' });
      continue;
    }
    // ① 사람이 멈춰 뒀나 — 그 날짜가 지나면 저절로 다시 문다.
    if (record.paused_until && today <= record.paused_until) {
      held.push({ id: m.id, decision: m.decision, matched: m.matched, why: 'paused', until: record.paused_until });
      continue;
    }
    // ② 아직 사흘이 안 지났나 — 갓 만든 규칙이 그날 일을 세우지 않게.
    const bitesFrom = addDays(record.adopted, OBSERVE_DAYS);
    if (record.effective_now !== true && today < bitesFrom) {
      held.push({ id: m.id, decision: m.decision, matched: m.matched, why: 'observing', until: bitesFrom });
      continue;
    }
    blocking.push(m);
  }

  return {
    block: blocking.length > 0,
    blocking,
    held_back: held,
    matched_not_ban: check.matches.length - blocking.length - held.length,
    check,
  };
}
