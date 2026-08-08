// 분신의 집 — 화면 하나가 쓰는 데이터.
//
// **이 라우트가 존재하는 이유는 하나다: `argus_shadow_predictions` 만 RLS 로
// 읽을 수 없기 때문이다.** 그 표는 정책이 0개라 본인조차 직접 조회할 수 없고,
// 그것이 설계다 (정산 전에 자기 시험지를 보면 봉인이 무의미해진다). 프로필·
// 위임·케이스·믿음 채점은 전부 본인 read 정책이 있으므로 화면이 브라우저에서
// 직접 읽는다 — 최소 권한 원칙이고, 이 비대칭 자체가 제품의 이야기다.
//
// 봉인과 공개를 **두 쿼리로 나눈 것**이 이 파일의 핵심 규율이다:
// · 봉인 행 쿼리는 `expectation`·`reasoning`·`verdict_quote` 를 **이름조차 쓰지
//   않는다.** 한 쿼리로 전부 읽고 코드에서 골라 내보내는 형태였다면, 필드 하나
//   빠뜨리는 실수가 곧 봉인 파기가 된다. 흘릴 코드가 존재하지 않게 만든다.
// · 공개 행은 이미 정산된 것이므로 전문을 낸다 — 봉인의 목적이 그때 달성된다.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { twinScore } from '@/lib/twin/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  // ── 봉인 (내용 없음) ─────────────────────────────────────────────────
  // status='late' 도 함께 읽는다: 봉인이 채택보다 늦어 채점에서 빠지는 행인데,
  // 그 사실을 화면에서 숨기면 "왜 성적에 안 들어갔지"를 설명할 수 없다.
  const { data: sealedRaw, error: sealedErr } = await admin
    .from('argus_shadow_predictions')
    .select('case_id, target, sealed_at, status')
    .eq('user_id', user.id)
    .in('status', ['sealed', 'late'])
    .order('sealed_at', { ascending: true });

  // ── 공개 (정산된 것 — 전문) ──────────────────────────────────────────
  const { data: revealedRaw, error: revealedErr } = await admin
    .from('argus_shadow_predictions')
    .select('case_id, target, expectation, confidence, verdict, verdict_quote, revealed_at, was_late')
    .eq('user_id', user.id)
    .eq('status', 'revealed')
    .order('revealed_at', { ascending: false })
    .limit(50);

  // 표가 없으면(마이그레이션 미적용) 빈 배열로 위장하지 않는다 — null 로 두고
  // 화면이 "읽지 못했다"와 "아직 없다"를 다르게 말하게 한다.
  return NextResponse.json({
    sealed: sealedErr ? null : (sealedRaw ?? []),
    revealed: revealedErr ? null : (revealedRaw ?? []),
    score: await twinScore(user.id),
  });
}
