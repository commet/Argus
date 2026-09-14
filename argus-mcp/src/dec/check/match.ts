import { matchWatch, type WatchVerdict } from '../watch/rule.js';
import { scopeCoversPath } from '../inject/select.js';
import { parseScope } from '../scope.js';
import type { DecisionRecord } from '../types.js';

/**
 * 지금 하려는 일이 정해 둔 것에 걸리나 (단계 7).
 *
 * **판정은 전부 결정론이다.** 여기에 모델이 들어오면 되돌릴 수 없다 —
 * 시공 계획 §7: *"걸렸는지 판정하는 자리에 모델을 넣으면 되돌릴 수 없다."*
 *
 * 같은 기계를 둘이 쓴다:
 *  - **미는 쪽**: 훅이 파일을 고칠 때·말이 오갈 때 물어본다
 *  - **당기는 쪽**: 에이전트가 작업 직전에 `dec-check --plan "<하려는 일>"` 으로 물어본다
 *    (v4 의 인터페이스가 전부 push 라 pull 이 0이었다 — §4.9)
 */

export type CheckSubject =
  | { kind: 'file'; path: string }
  | { kind: 'text'; text: string };

export interface Match {
  id: string;
  decision: string;
  channel: 'file' | 'word';
  /** 규칙의 어느 부분에 걸렸나 — 사람이 왜 걸렸는지 알 수 있게. */
  matched: string;
  /** 이 규칙이 못 잡는 것 — 걸렸을 때도 같이 말한다. */
  blind_spots: string[];
}

export interface CheckResult {
  matches: Match[];
  /** 살아 있는데 기계가 못 잡는 것 — "안 걸렸다"가 "괜찮다"가 아니라는 표시. */
  unwatchable: number;
  /** 자리 지정 법인데 지금은 자리를 알 수 없어 못 본 것 (말만 오갔을 때).
   *  세어서 돌려준다 — 조용히 빠지면 "안 걸렸다"가 거짓이 된다. */
  scope_unknown: number;
  /** 본 것 (분모). */
  considered: number;
}

export function checkSubject(
  records: readonly DecisionRecord[], subject: CheckSubject,
): CheckResult {
  const alive = records.filter((r) => r.status === 'active');
  const matches: Match[] = [];
  let unwatchable = 0;
  let scopeUnknown = 0;

  for (const record of alive) {
    if (record.watch !== 'machine' || !record.watch_rule) { unwatchable += 1; continue; }
    // 파일이면 범위부터 본다 — 다른 자리의 법이 여기서 걸리면 안 된다.
    if (subject.kind === 'file' && !scopeCoversPath(record.scope, subject.path)) continue;
    // **말만 오갔을 때는 자리를 알 수 없다.** 자리 지정 법을 여기서 걸면
    // `docs/**` 에만 걸리는 법이 아무 말에나 걸린다 — 회전 슬롯이 누설
    // 엔진이 됐던 것과 같은 실수다. 안 걸고, 몇 개를 못 봤는지 센다.
    if (subject.kind === 'text' && parseScope(record.scope)?.kind === 'path') { scopeUnknown += 1; continue; }
    const verdict: WatchVerdict = subject.kind === 'file'
      ? matchWatch(record.watch_rule, { kind: 'file_change', path: subject.path })
      : matchWatch(record.watch_rule, { kind: 'utterance', text: subject.text });
    if (!verdict.fire) continue;
    matches.push({
      id: record.id,
      decision: record.decision,
      channel: verdict.channel,
      matched: verdict.matched,
      blind_spots: record.watch_rule.blind_spots,
    });
  }

  return { matches, unwatchable, scope_unknown: scopeUnknown, considered: alive.length };
}
