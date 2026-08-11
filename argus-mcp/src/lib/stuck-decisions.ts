import type { LedgerState } from './ledger-replay.js';

/**
 * 시공됐지만 현실에 닿을 수 없는 결정 — 전제는 있는데 예측이 없는 기록.
 *
 * WHY. 첫 사용자 여정 하네스 실측 (2026-08-11, 원장 있는 실행 16회 중 3회).
 * 사용자가 결정을 열고 하중 전제를 자기 손으로 적었는데, 어시스턴트는 예측을
 * **다른 id로** 봉인한다 (봉인마다 새 id를 지어내고 작명 규칙도 매번 바꾼다:
 * `api-migration-*` / `monolith-migration-*` / `monolith-to-standalone-*`).
 * D1은 한 대화·한 마이그레이션인데 원장에 id가 6개였고, 전제 2개가 달린 결정에는
 * 예측이 끝내 안 달렸다.
 *
 * 그 결정은 **어떤 표면에도 뜨지 않는다** — check_in도, patterns view="active"도
 * 부르지 않고, 전체 덤프에만 이름이 보인다 (측정 확인). 전제는 결정이 정산될 때
 * 현실과 대조되라고 있는 것이므로, 봉인이 없으면 정산도 없고, 사용자가 직접 쓴
 * 가정은 영영 확인되지 않는다. 조용히 죽는 기록이다.
 *
 * 배선 자체는 이미 완전하다 (측정 확인): 그 결정 id로 argus_predict를 부르면
 * 봉인되고, 전제가 그대로 살아있고, 확인일에 check_in이 정확히 불러낸다.
 * **빠진 것은 관계가 아니라 손잡이다** — 호출자가 그 id의 존재를 모른다.
 * 그래서 이 파일은 새 필드를 만들지 않고, 서버가 이미 아는 것을 이름 붙여
 * 돌려주기만 한다 (check_by 시계·saved_ids와 같은 계열의 수리).
 *
 * 전제가 있는 것만 센다. 전제 없는 맨 포착은 잃을 사용자 문장이 없어서, 그것까지
 * 부르면 실제 공백이 아니라 잡음을 만든다 (거울 조항: 과발화도 스파인 위반).
 */
export interface StuckDecision {
  id: string;
  /** 사용자가 쓴 결정 문장 (렌더 시 sanitize는 표면의 몫). */
  decision: string;
  premise_count: number;
}

export function stuckDecisions(state: LedgerState): StuckDecision[] {
  const out: StuckDecision[] = [];
  for (const [id, c] of state.contracts) {
    if (c.status !== 'candidate' || c.predicate) continue;
    const premises = Array.isArray(c.premises) ? c.premises : [];
    if (premises.length === 0) continue;
    out.push({ id, decision: String(c.text ?? id), premise_count: premises.length });
  }
  return out;
}
