// TWIN 저장 층 — service role 전용.
//
// argus_shadow_predictions 의 접근 규칙이 이 파일의 존재 이유다:
// **정산 전에 봉인 예측을 돌려주는 함수를 여기 만들지 않는다.** 조회는
// 정산 경로(revealShadowsForCase)와 크론 백스톱뿐이고, 그나마 전자는 즉시
// status='revealed' 로 옮긴다. 사용자 표면이 이 테이블을 직접 읽는 경로는
// RLS(정책 0)와 이 파일의 API 표면, 두 겹으로 막혀 있다.

import { createHash } from 'crypto';
import { adminClient } from '@/lib/share-guard';

export type ShadowTarget = 'outcome' | 'choice' | 'deviation';
export type ShadowVerdict = 'supported' | 'contradicted' | 'indeterminate';

export interface ShadowRow {
  id: string;
  case_id: string;
  user_id: string;
  target: ShadowTarget;
  expectation: string;
  reasoning: string;
  confidence: number;
  contaminated_by_lean: boolean;
  model_id: string;
  content_hash: string;
  sealed_at: string;
  status: 'sealed' | 'late' | 'revealed';
  verdict: ShadowVerdict | null;
}

export interface ShadowDraft {
  target: ShadowTarget;
  expectation: string;
  reasoning: string;
  confidence: number;
  contaminatedByLean: boolean;
  modelId: string;
  late: boolean;
}

// 봉인 해시 — 공개 시점에 같은 함수로 재계산해 대조한다. 여기 들어가는 필드가
// 곧 "봉인된 내용"의 정의다.
export function shadowContentHash(d: Pick<ShadowDraft, 'target' | 'expectation' | 'reasoning' | 'confidence' | 'modelId'>): string {
  return createHash('sha256')
    .update(JSON.stringify([d.target, d.expectation, d.reasoning, d.confidence, d.modelId]))
    .digest('hex');
}

export async function sealShadows(userId: string, caseId: string, drafts: ShadowDraft[]): Promise<void> {
  if (drafts.length === 0) return;
  const admin = adminClient();
  const { error } = await admin.from('argus_shadow_predictions').insert(
    drafts.map((d) => ({
      case_id: caseId,
      user_id: userId,
      target: d.target,
      expectation: d.expectation,
      reasoning: d.reasoning,
      confidence: d.confidence,
      contaminated_by_lean: d.contaminatedByLean,
      model_id: d.modelId,
      content_hash: shadowContentHash(d),
      status: d.late ? 'late' : 'sealed',
    })),
  );
  if (error) throw new Error(`shadow seal failed: ${error.message}`);
}

// 정산 경로 전용: 봉인을 열고 그 자리에서 revealed 로 옮긴다.
// 해시 대조에 실패한 행은 **공개하지 않고** 그대로 알린다 — 조용히 고치는
// 순간 봉인의 의미가 죽는다.
export async function revealShadowsForCase(
  userId: string,
  caseId: string,
): Promise<{ revealed: ShadowRow[]; integrityFailures: number }> {
  const admin = adminClient();
  const { data, error } = await admin
    .from('argus_shadow_predictions')
    .select('*')
    .eq('user_id', userId)
    .eq('case_id', caseId)
    .in('status', ['sealed', 'late']);
  if (error) throw new Error(`shadow read failed: ${error.message}`);

  const rows = (data ?? []) as ShadowRow[];
  const intact: ShadowRow[] = [];
  let integrityFailures = 0;
  for (const r of rows) {
    const expected = shadowContentHash({
      target: r.target,
      expectation: r.expectation,
      reasoning: r.reasoning,
      confidence: r.confidence,
      modelId: r.model_id,
    });
    if (expected === r.content_hash) intact.push(r);
    else {
      integrityFailures += 1;
      console.error(`[twin/shadow] content hash mismatch for ${r.id} — not revealing`);
    }
  }

  if (intact.length > 0) {
    await admin
      .from('argus_shadow_predictions')
      .update({ status: 'revealed', revealed_at: new Date().toISOString() })
      .in('id', intact.map((r) => r.id))
      .eq('user_id', userId);
  }
  return { revealed: intact, integrityFailures };
}

// 채점은 공개 이후의 비동기 작업 — 실패해도 정산을 막지 않는다.
export async function setShadowVerdict(id: string, verdict: ShadowVerdict, quote: string): Promise<void> {
  const admin = adminClient();
  const { error } = await admin
    .from('argus_shadow_predictions')
    .update({ verdict, verdict_quote: quote })
    .eq('id', id)
    .eq('status', 'revealed');
  if (error) console.error('[twin/shadow] verdict write failed:', error.message);
}

// 크론 백스톱: 최근에 열렸는데 그림자가 없는 케이스. after() 가 실패한 경우다.
export async function recentCasesMissingShadows(hours = 48, limit = 20): Promise<Array<{ id: string; user_id: string }>> {
  const admin = adminClient();
  const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
  const { data: cases, error } = await admin
    .from('argus_cases')
    .select('id, user_id')
    .gte('updated_at', since)
    .is('settled_at', null)
    .limit(limit * 3);
  if (error || !cases || cases.length === 0) return [];

  const { data: shadows } = await admin
    .from('argus_shadow_predictions')
    .select('case_id')
    .in('case_id', cases.map((c) => c.id));
  const covered = new Set((shadows ?? []).map((s) => s.case_id as string));
  return (cases as Array<{ id: string; user_id: string }>).filter((c) => !covered.has(c.id)).slice(0, limit);
}
