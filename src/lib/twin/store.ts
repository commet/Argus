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
export function shadowContentHash(
  d: Pick<ShadowDraft, 'target' | 'expectation' | 'reasoning' | 'confidence' | 'modelId' | 'contaminatedByLean'>,
): string {
  // contaminatedByLean 도 해시에 넣는다 — 이 플래그가 twinScore 의 match 모수
  // 포함 여부를 정하므로, 해시 밖에 두면 성적을 좌우하는 값이 무결성 검사를
  // 통과한 채 바뀔 수 있다. 봉인은 "내용"뿐 아니라 **채점 조건**까지 덮어야 한다.
  return createHash('sha256')
    .update(JSON.stringify([d.target, d.expectation, d.reasoning, d.confidence, d.modelId, d.contaminatedByLean]))
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
      contaminatedByLean: r.contaminated_by_lean,
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

/**
 * 분신 성적표 — TWIN §4.2 의 두 숫자를 **절대 섞지 않고** 낸다.
 *
 * · matchRate    — 분신이 사용자를 아는가 (choice/deviation, 채택과 대조)
 * · outcomeRate  — 분신이 현실을 맞히는가 (outcome, 관찰과 대조)
 *
 * 규칙:
 * · indeterminate 와 late 는 **모수에서 뺀다** — 판정하지 못한 것을 맞혔다고도
 *   틀렸다고도 세지 않는다 (정직한 공백).
 * · 오염된 choice 예측(lean 이 있었던 것)은 match 모수에서 뺀다 — 자명한 예측을
 *   성적에 넣으면 숫자가 부풀려진다 (PRD 반박 1).
 * · 표본 수를 항상 함께 돌려준다. 호출부는 표본 미달이면 숫자를 감춘다.
 */
/**
 * 분신 성적을 숫자로 보여줄 최소 표본. **정본은 여기 하나다.**
 *
 * 표본 2건짜리 "50%"는 정보가 아니라 소음이고, 소음을 성적처럼 보이게 하는
 * 것이 이 제품이 하지 않기로 한 일이다. 임계 미달이면 숫자 대신 "아직
 * 모릅니다"를 말한다 (TWIN §6.2).
 *
 * 이 상수가 표면마다 복사되면 한 곳만 낮춰도 나머지가 조용히 따라가지 않는다 —
 * 실제로 극장 리포트와 recall 에 `const MIN = 3` 이 각각 박혀 있었다.
 */
export const TWIN_SCORE_MIN_SAMPLE = 3;

export interface TwinScore {
  matchRate: number | null;
  matchSample: number;
  outcomeRate: number | null;
  outcomeSample: number;
}

export async function twinScore(userId: string): Promise<TwinScore> {
  const empty: TwinScore = { matchRate: null, matchSample: 0, outcomeRate: null, outcomeSample: 0 };
  try {
    const admin = adminClient();
    const { data, error } = await admin
      .from('argus_shadow_predictions')
      .select('target, verdict, status, contaminated_by_lean')
      .eq('user_id', userId)
      .eq('status', 'revealed')
      .in('verdict', ['supported', 'contradicted']);
    if (error || !data) return empty;

    const rows = data as Array<Pick<ShadowRow, 'target' | 'verdict' | 'contaminated_by_lean'>>;
    const match = rows.filter(
      (r) => (r.target === 'deviation' || (r.target === 'choice' && !r.contaminated_by_lean)),
    );
    const outcome = rows.filter((r) => r.target === 'outcome');
    const rate = (xs: typeof rows) =>
      xs.length === 0 ? null : xs.filter((r) => r.verdict === 'supported').length / xs.length;

    return {
      matchRate: rate(match),
      matchSample: match.length,
      outcomeRate: rate(outcome),
      outcomeSample: outcome.length,
    };
  } catch {
    return empty;
  }
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
