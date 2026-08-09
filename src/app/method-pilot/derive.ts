// method-pilot 복원 로직 — page.tsx 에서 분리한 이유 둘: (1) Next.js page 파일은
// 페이지 외 export 가 금지다, (2) 복원이 틀리면 사용자가 같은 입력을 다시 하게
// 되고 그 재입력이 append-only 원장에 중복으로 영구히 남는다 — 기계 가드가
// 필요한 로직은 페이지 밖에서 테스트 가능해야 한다.

import { type CaseState, type LedgerEvent } from '../../../method-harness/types';

export const FIRST_CASE_ID = 'pilot_case';

export type FlowStep =
  | 'listen'
  | 'baseline'
  | 'coach'
  | 'acting'
  | 'return_observe'
  | 'return_probe'
  | 'return_reveal'
  | 'reviewed';

// 원장은 여러 케이스를 담을 수 있다 — 한 바퀴 완주 뒤 "전부 삭제" 없이 다음
// 결정을 시작할 수 있어야 한다 (정산 기록이 쌓이는 것이 이 제품의 전부인데,
// 새 결정의 대가가 기존 기록 삭제면 두 번째 루프는 영영 없다).
// 활성 케이스 = 원장의 마지막 이벤트가 속한 케이스. 이벤트가 없으면 첫 케이스.
export function activeCaseId(events: readonly LedgerEvent[]): string {
  return events.length > 0 ? events[events.length - 1].caseId : FIRST_CASE_ID;
}

// 복원 지점 유도 — 인자 events 는 **활성 케이스의 이벤트만** 받는다.
export function deriveStep(s: CaseState, events: readonly LedgerEvent[]): FlowStep {
  if (s.state === 'REVIEWED') return 'reviewed';
  // 귀환 계약 없이 정산까지 끝난 케이스는 recordRevealed 가 리셋되지 않는다
  // (return_closed 가 없으므로). 복원은 대조 화면으로 온다 — "돌아보기 마치기"
  // 를 다시 누르면 완주 화면으로 간다. 데이터는 이미 온전하다.
  if (s.recordRevealed) return 'return_reveal';
  if (s.card) {
    // 이번 사이클의 관찰(마지막 기록 공개 이후)이 이미 있으면 회상 단계로
    // 복원한다 — acting 으로 돌리면 사용자가 관찰을 다시 적고, 그 재입력이
    // 원장에 중복으로 남는다 (2026-08-09 라운드 4 감사에서 발견).
    const lastRevealIdx = events.reduce((acc, e, i) => (e.type === 'record_revealed' ? i : acc), -1);
    const cycleHasObservation = events.slice(lastRevealIdx + 1).some((e) => e.type === 'observation');
    if (cycleHasObservation) return 'return_probe';
    return 'acting';
  }
  const hasBaseline = s.baseline !== undefined;
  const hasUtterance = events.some((e) => e.type === 'user_utterance');
  if (hasBaseline) return 'coach';
  if (hasUtterance) return 'baseline';
  return 'listen';
}
