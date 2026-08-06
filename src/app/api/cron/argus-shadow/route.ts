// TWIN 그림자 백스톱 크론 — after() 가 실패한 케이스를 쓸어담는다.
//
// 왜 필요한가: 그림자 생성은 결정 열기를 막지 않으려고 응답 뒤(after())에서
// 도는데, 서버리스에서 그 실행은 보장이 아니라 최선 노력이다. 실패하면 그
// 케이스는 분신의 시험지가 영영 없다 — 조용한 구멍. 이 크론이 "최근에 열렸는데
// 그림자가 없는 케이스"를 찾아 재시도하므로, 실패는 침묵이 아니라 지연이 된다.
//
// 늦은 봉인의 정직성: 여기서 봉인하는 시점에 이미 채택이 끝났을 수 있다.
// 그 경우 late 로 봉인된다(generateAndSealShadow 가 처리) — 채점에서 빠지되,
// 늦었다는 사실 자체가 기록된다.

import { NextRequest, NextResponse } from 'next/server';
import { generateAndSealShadow } from '@/lib/twin/shadow';
import { gradeStatedBeliefs, type StatedBelief } from '@/lib/twin/beliefs';
import { extractProfileFromSettlement, settledCasesMissingProfile } from '@/lib/twin/profile';
import { recentCasesMissingShadows } from '@/lib/twin/store';
import { loadEngine } from '@/app/api/mcp/v2/store';
import { persistServerEvent } from '@/lib/server-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  if (!process.env.CRON_SECRET || !safeCompare(authHeader, `Bearer ${process.env.CRON_SECRET}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    // 키가 없으면 생성이 전부 실패할 것이므로 성공한 척하지 않는다.
    return NextResponse.json({ error: 'missing ANTHROPIC_API_KEY' }, { status: 503 });
  }

  const missing = await recentCasesMissingShadows();
  let generated = 0;
  const failures: string[] = [];

  for (const c of missing) {
    try {
      const engine = await loadEngine(c.user_id, c.id);
      const state = engine.state();
      const opening = engine.ledger
        .forCase(c.id)
        .find((e) => e.type === 'user_utterance') as { text?: string } | undefined;
      if (!opening?.text) continue; // 원문 없는 케이스는 시험지도 없다

      const baseline = state.baseline !== 'not_captured' ? state.baseline : undefined;
      await generateAndSealShadow(
        c.user_id,
        c.id,
        {
          utterance: opening.text,
          lean: baseline && baseline.lean !== 'none_stated' ? baseline.lean : undefined,
          statedReasons: baseline?.statedReasons ?? [],
          // 하네스 baseline 타입에는 대안 필드가 없다 (원장에는 있지만 fold 가
          // 안 나른다). 없는 것을 없는 대로 — 빈 배열이 정직한 값이다.
          consideredAlternatives: [],
        },
        { alreadyAdopted: Boolean(state.card) },
      );
      generated += 1;
    } catch (e) {
      failures.push(`${c.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── 프로필 추출 백스톱 ────────────────────────────────────────────────
  //
  // 같은 성격의 구멍이 프로필 쪽에도 있었다. 추출도 after() 안에서 돌지만
  // 그림자와 달리 백스톱이 없어서, 그 경로가 죽으면 **정산은 됐는데 분신만
  // 아무것도 배우지 못한 상태**가 영구히 남았다 — 화면에 아무 표시도 나지
  // 않는 종류의 실패다. 시도 표식(profile_extracted_at)이 없는 정산만 집는다.
  const pending = await settledCasesMissingProfile();
  let extracted = 0;
  for (const p of pending) {
    try {
      await extractProfileFromSettlement(p.userId, p.facts);
      extracted += 1;

      // 사전등록 믿음 채점도 같은 after() 안에서 돌았으므로 같은 후보를 쓴다.
      // 이미 채점됐으면 (case_id, belief) 유일 색인이 두 번째 삽입을 거절한다 —
      // 조용한 중복보다 시끄러운 거절이 낫다.
      //
      // 남는 정직한 공백: 프로필 추출은 성공했는데 믿음 채점만 실패한 경우는
      // 표식(profile_extracted_at)이 이미 찍혀 있어 다시 집히지 않는다. 둘은
      // 같은 after() 안에서 각자 try/catch 로 돌므로 한쪽만 죽는 경우가 드물고,
      // 표식을 둘로 쪼개는 비용이 그 드묾보다 크다고 판단했다.
      const engine = await loadEngine(p.userId, p.facts.caseId);
      const beliefs = (engine.state().card?.rationale?.materialBeliefs ?? []) as StatedBelief[];
      if (beliefs.length > 0) await gradeStatedBeliefs(p.userId, p.facts.caseId, beliefs, p.facts.observation);
    } catch (e) {
      failures.push(`profile ${p.facts.caseId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 크론은 흔적을 남긴다 (cron-instrumentation 규약) — 몇 건을 재시도했는지가
  // 곧 after() 경로의 건강 지표다. 이 수가 크면 본 경로가 병든 것이다.
  await persistServerEvent('argus_shadow_cron_run', {
    scanned: missing.length,
    generated,
    profileScanned: pending.length,
    profileExtracted: extracted,
    failed: failures.length,
  }, { path: '/api/cron/argus-shadow' });

  return NextResponse.json({
    scanned: missing.length,
    generated,
    profileScanned: pending.length,
    profileExtracted: extracted,
    failed: failures.length,
  });
}
