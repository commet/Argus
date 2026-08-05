// 귀환 크론 — 기한이 오면 서버가 먼저 찾아간다.
//
// 이 라우트가 이 제품의 유일한 outbound 채널이고, H-B("사람들이 돌아오는가")를
// 재는 유일한 장치다. 없으면 정산은 사용자가 우연히 다시 열 때만 일어나고,
// 그건 일어나지 않는다.
//
// 규칙 셋:
//  1. 기록을 보내지 않는다 (§7.3) — 문안은 argus-return-email.ts가 정한다.
//  2. 하루 전역 예산 3건 (봉인 계약 §1). 예산을 넘으면 남기고 다음 날 보낸다.
//  3. 한 번 보낸 것은 다시 보내지 않는다 (status로 멱등).

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { buildReturnEmail, DAILY_RETURN_BUDGET } from '@/lib/argus-return-email';
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
  const apiKey = process.env.RESEND_API_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!apiKey || !serviceKey || !url) {
    // 설정이 없으면 조용히 성공한 척하지 않는다.
    return NextResponse.json({ error: 'missing RESEND_API_KEY / SUPABASE keys' }, { status: 503 });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const resend = new Resend(apiKey);
  const now = new Date().toISOString();
  const origin = new URL(req.url).origin;
  const fromDomain = process.env.RESEND_FROM_DOMAIN || 'argus.voyage';

  // 만기이고 아직 안 보낸 것. 이른 것부터 — 곧 닥친 약속이 정산 가치가 높다.
  const { data: due, error } = await admin
    .from('argus_returns')
    .select('id, case_id, user_id, kind, due_at, from_step')
    .eq('status', 'armed')
    .lte('due_at', now)
    .order('due_at', { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!due || due.length === 0) return NextResponse.json({ sent: 0, skipped: 0 });

  // 사용자별 하루 예산. 넘는 것은 건드리지 않고 남긴다 — 다음 날 다시 만기다.
  const perUser = new Map<string, number>();
  let sent = 0;
  let deferred = 0;
  const failures: string[] = [];

  for (const r of due) {
    const used = perUser.get(r.user_id) ?? 0;
    if (used >= DAILY_RETURN_BUDGET) {
      deferred += 1;
      continue;
    }

    // 케이스의 **질문만** 읽는다. 선택·이유는 조회조차 하지 않는다 —
    // 읽지 않으면 실수로 보낼 수도 없다.
    const { data: caseRow } = await admin
      .from('argus_cases')
      .select('title')
      .eq('id', r.case_id)
      .eq('user_id', r.user_id)
      .single();

    const { data: userRow } = await admin.auth.admin.getUserById(r.user_id);
    const email = userRow?.user?.email;
    if (!email) {
      failures.push(`${r.id}: no email`);
      continue;
    }

    const mail = buildReturnEmail({
      question: caseRow?.title ?? '지난 결정',
      fromStep: r.from_step ?? undefined,
      kind: r.kind,
      returnUrl: `${origin}/method-pilot?case=${encodeURIComponent(r.case_id)}`,
    });

    const result = await resend.emails.send({
      from: `Argus <hello@${fromDomain}>`,
      to: email,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    if (result.error) {
      failures.push(`${r.id}: ${result.error.message}`);
      continue;
    }

    await admin.from('argus_returns').update({ status: 'sent', sent_at: now }).eq('id', r.id);
    perUser.set(r.user_id, used + 1);
    sent += 1;

    // H-B("기한이 오면 돌아와 결과를 적는가")의 분모가 여기서 생긴다.
    // 발송을 기록하지 않으면 완주율은 영원히 추측이다 — 도착한 귀환 대비
    // 완주한 귀환을 세는 것이 이 사업의 유일한 판정 지표다.
    await persistServerEvent(
      'argus_return_sent',
      { case_id: r.case_id, kind: r.kind, due_at: r.due_at, days_late: Math.round((Date.parse(now) - Date.parse(r.due_at)) / 86_400_000) },
      { userId: r.user_id, path: '/api/cron/argus-returns' },
    );
  }

  // 정직한 보고: 보낸 것, 예산에 걸려 미룬 것, 실패한 것을 전부 센다.
  await persistServerEvent('argus_return_cron_run', { sent, deferred, failed: failures.length, due_total: due.length }, {
    path: '/api/cron/argus-returns',
  });

  return NextResponse.json({ sent, deferred, failed: failures.length, failures: failures.slice(0, 10) });
}
