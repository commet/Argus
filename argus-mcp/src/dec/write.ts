import { withLedgerLock, appendLedger } from '../lib/ledger-append.js';
import { foldDecisions } from './fold.js';
import { syncDecisionFiles, type SyncResult } from './files.js';
import { isValidScope } from './scope.js';
import type { DecAmendedPayload, DecRepealedPayload, DecSignedPayload } from './types.js';

/**
 * 결정을 원장에 쓰는 자리 — **여기 말고는 없다.**
 *
 * 세 함수 전부 `appendLedger` 하나만 부른다 (단계 0 의 관문 단일성).
 * 쓰기가 끝나면 파일을 다시 그린다 — 원장과 파일이 벌어져 있는 시간을
 * 0 으로 만든다. 그리기는 잠금 **밖**이다 (잠금 범위는 되읽기~쓰기까지라는
 * 이 저장소의 규율: 영수증·내보내기는 잠금 밖).
 */

export interface DecWriteResult {
  id: string;
  written: number;
  files: SyncResult;
}

/**
 * 되읽기 → 검사 → 쓰기를 **잠금 안에서** 한 덩어리로 한다. 밖에서 검사하면
 * 같은 id 로 동시에 들어온 서명 둘이 **둘 다** 검사를 통과한다 (이 저장소가
 * 정산 이중 기록으로 이미 겪은 경주다 — ledger-append.ts 의 잠금 주석).
 * 그리기는 잠금 밖 — 잠금 범위는 여기까지라는 규율.
 */
async function appendAndDraw(
  argusDir: string, id: string, event: 'dec_signed' | 'dec_amended' | 'dec_repealed',
  dec: unknown, now: string, check: () => void,
): Promise<DecWriteResult> {
  const written = await withLedgerLock(argusDir, async () => {
    check();
    const outcome = await appendLedger(argusDir, [{ id, event, dec, ts: now }], now);
    return outcome.written;
  });
  return { id, written, files: syncDecisionFiles(argusDir) };
}

/** 서명 — 결정이 법이 되는 단 하나의 순간. 같은 id 로 두 번은 안 된다. */
export async function signDecision(
  argusDir: string, id: string, payload: DecSignedPayload, now: string,
): Promise<DecWriteResult> {
  if (!isValidScope(payload.scope)) {
    // 범위가 빈·틀린 결정 하나가 "다른 프로젝트 규칙이 안 섞인다"는 보증을 무너뜨린다.
    throw new Error(`BAD_SCOPE: ${payload.scope} — repo · global · path:<자리> 중 하나여야 한다`);
  }
  if (payload.watch === 'inject_only' && !payload.review) {
    // 불변식 ⑤ + §12: 기계가 못 잡는 법은 사건형 재확인을 고를 수 없다.
    throw new Error('INJECT_ONLY_NEEDS_CALENDAR: 기계가 못 잡는 규칙은 날짜로만 다시 볼 수 있다');
  }
  if (!payload.review && !payload.review_on_event) {
    throw new Error('NO_RECHECK: 다시 볼 날이나 다시 볼 계기 중 하나는 있어야 한다');
  }
  return appendAndDraw(argusDir, id, 'dec_signed', payload, now, () => {
    if (foldDecisions(argusDir).records.some((r) => r.id === id)) {
      throw new Error(`ALREADY_SIGNED: ${id} 은 이미 서명됐다 — 바꾸려면 개정(amend)이다`);
    }
  });
}

/** 개정 — 이유가 없으면 받지 않는다. */
export async function amendDecision(
  argusDir: string, id: string, payload: DecAmendedPayload, now: string,
): Promise<DecWriteResult> {
  if (!payload.why) throw new Error('NO_REASON: 왜 바꾸는지 한 줄이 있어야 한다');
  if (payload.scope !== undefined && !isValidScope(payload.scope)) {
    throw new Error(`BAD_SCOPE: ${payload.scope} — repo · global · path:<자리> 중 하나여야 한다`);
  }
  return appendAndDraw(argusDir, id, 'dec_amended', payload, now, () => mustBeLive(argusDir, id));
}

/** 폐지 — 지우지 않는다. 그만뒀다는 사실이 기록에 쌓인다. */
export async function repealDecision(
  argusDir: string, id: string, payload: DecRepealedPayload, now: string,
): Promise<DecWriteResult> {
  if (!payload.why) throw new Error('NO_REASON: 왜 그만두는지 한 줄이 있어야 한다');
  return appendAndDraw(argusDir, id, 'dec_repealed', payload, now, () => mustBeLive(argusDir, id));
}

function mustBeLive(argusDir: string, id: string): void {
  const record = foldDecisions(argusDir).records.find((r) => r.id === id);
  if (!record) throw new Error(`NOT_SIGNED: ${id} 은 서명된 적이 없다`);
  if (record.status === 'repealed') throw new Error(`REPEALED: ${id} 은 이미 그만둔 결정이다`);
}
