// 서버 원장 — 하네스의 이벤트 소싱을 Supabase로 옮긴 층.
//
// 규칙 하나가 이 파일 전체를 지배한다: **argus_events 는 append-only 다.**
// 여기에 update/delete 함수를 만들지 않는다. "나중 사실은 덧붙고, 이전에 믿었던
// 것을 고치지 않는다"(§AUTHORITY)가 코드에서도 참이어야 하고, DB 정책에도
// 같은 이유로 UPDATE/DELETE 정책이 없다.
//
// stateless: 매 요청마다 원장을 읽어 fold 한다. 세션 상태를 서버 메모리에 두면
// 서버리스에서 다음 요청이 다른 인스턴스로 가는 순간 조용히 틀린다.

import { adminClient } from '@/lib/share-guard';
import { Ledger, restoreLedger } from '../../../../../method-harness/ledger';
import { SessionEngine } from '../../../../../method-harness/surfaces/engine';
import { type LedgerEvent } from '../../../../../method-harness/types';

export interface CaseRow {
  id: string;
  title: string | null;
  state: string;
  updated_at: string;
}

// 원장을 읽어 하네스 엔진을 복원한다. 케이스가 없으면 빈 엔진 —
// 없는 것을 있는 척하지 않는다.
export async function loadEngine(userId: string, caseId: string): Promise<SessionEngine> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('argus_events')
    .select('payload')
    .eq('user_id', userId)
    .eq('case_id', caseId)
    .order('at', { ascending: true });

  if (error) throw new Error(`ledger read failed: ${error.message}`);

  const events = (data ?? []).map((r) => r.payload as LedgerEvent);
  return events.length > 0
    ? new SessionEngine(caseId, restoreLedger(events))
    : new SessionEngine(caseId, new Ledger());
}

// 엔진이 새로 만든 이벤트만 저장한다. 이미 있던 것은 다시 쓰지 않는다
// (append-only 이므로 중복 삽입은 기본키 충돌로 크게 실패해야 정상이다).
export async function persistNewEvents(
  userId: string,
  caseId: string,
  engine: SessionEngine,
  knownIds: ReadonlySet<string>,
): Promise<number> {
  const fresh = engine.ledger.forCase(caseId).filter((e) => !knownIds.has(e.id));
  if (fresh.length === 0) return 0;

  const admin = adminClient();
  const { error } = await admin.from('argus_events').insert(
    fresh.map((e) => ({
      id: e.id,
      case_id: caseId,
      user_id: userId,
      type: e.type,
      at: e.at,
      payload: e,
    })),
  );
  if (error) throw new Error(`ledger write failed: ${error.message}`);
  return fresh.length;
}

export async function upsertCase(userId: string, caseId: string, title: string, state: string): Promise<void> {
  const admin = adminClient();
  const { error } = await admin
    .from('argus_cases')
    .upsert({ id: caseId, user_id: userId, title, state, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw new Error(`case upsert failed: ${error.message}`);
}

// 귀환 계약을 크론이 읽을 수 있는 자리에 둔다. 계획의 마일스톤이 여기로 온다.
export async function armReturns(
  userId: string,
  caseId: string,
  returns: Array<{ kind: string; dueAt: string; fromStep?: string }>,
): Promise<void> {
  if (returns.length === 0) return;
  const admin = adminClient();
  const { error } = await admin.from('argus_returns').insert(
    returns.map((r) => ({
      case_id: caseId,
      user_id: userId,
      kind: r.kind,
      due_at: r.dueAt,
      from_step: r.fromStep ?? null,
      status: 'armed',
    })),
  );
  if (error) throw new Error(`return arm failed: ${error.message}`);
}

export async function listCases(userId: string, limit = 20): Promise<CaseRow[]> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('argus_cases')
    .select('id, title, state, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`case list failed: ${error.message}`);
  return (data ?? []) as CaseRow[];
}

export async function knownEventIds(userId: string, caseId: string): Promise<Set<string>> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('argus_events')
    .select('id')
    .eq('user_id', userId)
    .eq('case_id', caseId);
  if (error) throw new Error(`ledger id read failed: ${error.message}`);
  return new Set((data ?? []).map((r) => r.id as string));
}
