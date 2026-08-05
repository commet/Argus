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
  // 정산 투영 (마이그레이션 20260805180000). 원장에서 재생 가능한 캐시이며,
  // 이 넷이 있어야 `argus_recall` 이 "지난번에 실제로 어떻게 됐는지"를 말할 수
  // 있다 — 그것이 범용 AI가 못 하는 유일한 것이다.
  choice?: string | null;
  last_observation?: string | null;
  recall_gap?: string | null;
  settled_at?: string | null;
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

// `*` 인 이유: 정산 투영 넷은 마이그레이션 20260805180000 이후에만 있다. 컬럼을
// 명시하면 그 마이그레이션 전에는 **조회 자체가 실패해** argus_recall 이 통째로
// 죽는다 — 의도한 것은 "투영이 없으면 제목 목록으로 물러난다"였지 "도구가
// 에러를 낸다"가 아니었다. `*` 면 있으면 읽고 없으면 undefined 로 물러난다.
const CASE_COLUMNS = '*';

export async function listCases(userId: string, limit = 20): Promise<CaseRow[]> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('argus_cases')
    .select(CASE_COLUMNS)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`case list failed: ${error.message}`);
  return (data ?? []) as CaseRow[];
}

export async function getCase(userId: string, caseId: string): Promise<CaseRow | null> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('argus_cases')
    .select(CASE_COLUMNS)
    .eq('user_id', userId)
    .eq('id', caseId)
    .maybeSingle();
  if (error) throw new Error(`case read failed: ${error.message}`);
  return (data ?? null) as CaseRow | null;
}

// 정산 결과를 케이스 행에 투영한다. 원장이 정본이고 이것은 캐시다 — 그래서
// 실패해도 던지지 않는다. 던지면 이미 원장에 들어간 정산이 사용자에게는
// 실패로 보인다(실제로는 성공했다).
export async function projectOutcome(
  userId: string,
  caseId: string,
  outcome: { choice?: string; observation: string; recall: string; settledAt: string },
): Promise<void> {
  const admin = adminClient();
  const { error } = await admin
    .from('argus_cases')
    .update({
      ...(outcome.choice ? { choice: outcome.choice } : {}),
      last_observation: outcome.observation,
      recall_gap: outcome.recall,
      settled_at: outcome.settledAt,
    })
    .eq('id', caseId)
    .eq('user_id', userId);
  if (error) console.error('[mcp/v2] outcome projection failed:', error.message);
}

// 기한이 지난 귀환 — **채팅 안에서 알리기 위한** 조회.
//
// 이메일은 진짜 push지만 받은편지함 → 클릭 → 웹페이지라는 이동을 요구한다.
// 사용자가 이미 AI 채팅에 있다면 거기서 알리는 것이 이동 0이다. MCP 서버는
// 먼저 말을 걸 수 없으므로, **다음에 어떤 도구든 불릴 때 그 응답에 얹는다.**
// 이메일은 채팅으로 다시 오지 않는 사람을 위한 backstop으로 남는다.
export async function dueReturns(userId: string, now: string, limit = 3) {
  const admin = adminClient();
  const { data, error } = await admin
    .from('argus_returns')
    .select('case_id, kind, due_at, from_step, status')
    .eq('user_id', userId)
    .in('status', ['armed', 'sent'])
    .lte('due_at', now)
    .order('due_at', { ascending: true })
    .limit(limit);
  if (error) return []; // 알림은 부가 기능이다 — 실패해도 본 작업을 막지 않는다
  return data ?? [];
}

// 정산이 끝난 귀환은 닫는다. 안 닫으면 채팅 안 알림이 영원히 같은 결정을
// 다시 부른다 — 그것이 곧 과발화다(닫힌 결정을 다시 여는 것, CLAUDE.md 거울 조항).
//
// argus_events 와 달리 이 테이블은 원장이 아니라 **스케줄러의 작업 큐**다.
// 크론이 이미 status 를 'sent' 로 옮기는 것과 같은 층위의 갱신이다.
export async function completeReturns(userId: string, caseId: string): Promise<void> {
  const admin = adminClient();
  await admin
    .from('argus_returns')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('case_id', caseId)
    .in('status', ['armed', 'sent']);
  // 실패해도 던지지 않는다 — 정산은 이미 원장에 기록됐고, 이건 큐 정리다.
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
