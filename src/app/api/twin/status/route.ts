// 분신 상태 — **개수만** 돌려주는 계기판.
//
// 왜 이 라우트가 필요한가: 분신이 하는 일의 대부분은 사용자가 볼 수 없는
// 자리에서 일어난다. 봉인 예측은 RLS 정책이 0개라 본인도 정산 전에는 못 읽고
// (그것이 설계다), 프로필 갱신은 `after()` 안에서 돌고, 위임 채점은 정산
// 시점에만 움직인다. 그래서 사용자가 "이게 진짜 돌고 있나?"를 확인할 방법이
// 채팅에서 argus_recall 을 부르는 것뿐이었다.
//
// 보이지 않는 것과 없는 것을 구분할 수 없으면, 이 제품의 약속("일할수록 쌓인다")은
// 검증 불가능한 주장이 된다. 그래서 **내용이 아니라 개수**를 연다.
//
// 봉인을 깨지 않는 선:
// · expectation · reasoning · verdict_quote 는 **어떤 경우에도 나가지 않는다.**
//   이 파일은 그 컬럼들을 select 하지도 않는다 — 실수로 흘릴 코드가 존재하지
//   않는 것이 "흘리지 않도록 조심하는 것"보다 강하다.
// · 정산 전 예측의 개수는 봉인의 내용이 아니다. "3건이 잠겨 있다"는 사실은
//   사용자가 결정 3건을 열었다는 자기 기록에서 이미 따라 나온다.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 절대 이 라우트를 통과할 수 없는 컬럼 — `expectation` · `reasoning` ·
// `verdict_quote`. 목록의 정본은 `src/app/api/account/__tests__/export-seal.test.ts`
// 에 있고 그 테스트가 이 파일의 소스를 대조한다 (schema-drift 의 TABLE_COLUMNS 와
// 같은 방식: 계약은 그것을 강제하는 테스트가 갖는다).
//
// **여기에 상수로 export 하지 않는다.** Next 의 route 파일은 GET/POST/runtime/
// dynamic 같은 정해진 이름만 export 하도록 되어 있다. 이 파일은 실제로 한 번
// `export const NEVER_EXPOSED` 를 갖고 있었고 **그 상태로 `next build` 는
// 통과했다** — 즉 현재 버전은 관대하다. 그래도 옮긴 이유는 둘이다:
// (1) 계약은 그것을 강제하는 테스트가 갖는 것이 이 리포의 방식이고
//     (`schema-drift.test.ts` 의 TABLE_COLUMNS), (2) 이 관대함은 보장이 아니다.
// 관련 가드는 export-seal 테스트에 있다 — 지금 초록인 것을 근거로 규칙을
// 어겨 두면, 규칙이 조여질 때 그 자리가 어디였는지 아무도 모른다.

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !serviceKey || !anonKey) {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 });
  }

  const authClient = createClient(url, anonKey);
  const { data: { user }, error: authErr } = await authClient.auth.getUser(authHeader.slice(7));
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 표가 없으면(마이그레이션 미적용) 숫자를 0으로 **위장하지 않는다** — null 로
  // 두고 준비 상태 패널이 이유를 말하게 한다. 0 과 "아직 없음"은 다른 사실이다.
  const countOrNull = async (
    table: string,
    apply: (q: ReturnType<ReturnType<typeof createClient>['from']>) => unknown,
  ): Promise<number | null> => {
    try {
      const { count, error } = (await apply(admin.from(table))) as { count: number | null; error: unknown };
      return error ? null : count ?? 0;
    } catch {
      return null;
    }
  };

  const head = { count: 'exact' as const, head: true };

  const [
    sealed,
    revealed,
    graded,
    late,
    profileActive,
    profileRetired,
    delegationsActive,
    delegationsSuspended,
    beliefsGraded,
    theaterRuns,
    settledCases,
    openCases,
  ] = await Promise.all([
    countOrNull('argus_shadow_predictions', (q) =>
      q.select('id', head).eq('user_id', user.id).eq('status', 'sealed')),
    countOrNull('argus_shadow_predictions', (q) =>
      q.select('id', head).eq('user_id', user.id).eq('status', 'revealed')),
    countOrNull('argus_shadow_predictions', (q) =>
      q.select('id', head).eq('user_id', user.id).in('verdict', ['supported', 'contradicted'])),
    countOrNull('argus_shadow_predictions', (q) =>
      q.select('id', head).eq('user_id', user.id).eq('status', 'late')),
    countOrNull('argus_profile_items', (q) =>
      q.select('id', head).eq('user_id', user.id).eq('status', 'active')),
    countOrNull('argus_profile_items', (q) =>
      q.select('id', head).eq('user_id', user.id).eq('status', 'retired')),
    countOrNull('argus_delegations', (q) =>
      q.select('id', head).eq('user_id', user.id).eq('status', 'active')),
    countOrNull('argus_delegations', (q) =>
      q.select('id', head).eq('user_id', user.id).eq('status', 'suspended')),
    countOrNull('argus_belief_checks', (q) =>
      q.select('id', head).eq('user_id', user.id).in('verdict', ['supported', 'contradicted'])),
    countOrNull('argus_simulation_runs', (q) => q.select('id', head).eq('user_id', user.id)),
    countOrNull('argus_cases', (q) => q.select('id', head).eq('user_id', user.id).not('settled_at', 'is', null)),
    countOrNull('argus_cases', (q) => q.select('id', head).eq('user_id', user.id).is('settled_at', null)),
  ]);

  return NextResponse.json({
    cases: { open: openCases, settled: settledCases },
    shadows: { sealed, revealed, graded, late },
    profile: { active: profileActive, retired: profileRetired },
    delegations: { active: delegationsActive, suspended: delegationsSuspended },
    beliefs: { graded: beliefsGraded },
    theater: { runs: theaterRuns },
  });
}
