// TWIN 극장 크론 (주간) — 분신이 사용자 부재 중에 돈 결과를 배달한다.
//
// 설계 의도: 재미가 1차 표면이고, 재미가 귀환율(H-B)을 끌어올린다 — 정산하러
// 돌아올 이유가 하나 더 생긴다: 내 분신이 뭘 했는지 보러. 그래서 이 메일은
// 사용자당 주 1통이 상한이고, 보낼 것이 없으면(새 산출물 0) 보내지 않는다.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import {
  buildTheaterReport,
  ensureCaseBankSeeded,
  playBankCase,
  unplayedBankCases,
  type TheaterItem,
} from '@/lib/twin/theater';
import { profileLines } from '@/lib/twin/profile';
import { persistServerEvent } from '@/lib/server-events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_USERS_PER_RUN = 20;

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
  if (!apiKey || !serviceKey || !url || !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'missing RESEND/SUPABASE/ANTHROPIC keys' }, { status: 503 });
  }

  await ensureCaseBankSeeded();

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const resend = new Resend(apiKey);
  const fromDomain = process.env.RESEND_FROM_DOMAIN || 'argus.voyage';

  // 극장의 관객 = 케이스를 하나라도 연 사람. 그 외에는 보낼 근거가 없다.
  const { data: caseRows, error } = await admin.from('argus_cases').select('user_id').limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const userIds = [...new Set((caseRows ?? []).map((r) => r.user_id as string))].slice(0, MAX_USERS_PER_RUN);

  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const userId of userIds) {
    try {
      const profile = await profileLines(userId);
      const items: TheaterItem[] = [];

      for (const bank of await unplayedBankCases(userId, 2)) {
        const item = await playBankCase(userId, bank, profile);
        if (item) items.push(item);
      }

      if (items.length === 0) {
        // 보낼 것이 없으면 보내지 않는다 — 빈 극장에 초대하는 것이 과발화다.
        skipped += 1;
        continue;
      }

      const { data: userRow } = await admin.auth.admin.getUserById(userId);
      const email = userRow?.user?.email;
      if (!email) {
        failures.push(`${userId}: no email`);
        continue;
      }

      const report = buildTheaterReport(items);
      const result = await resend.emails.send({
        from: `Argus <hello@${fromDomain}>`,
        to: email,
        subject: report.subject,
        text: report.text,
      });
      if (result.error) {
        failures.push(`${userId}: ${result.error.message}`);
        continue;
      }
      sent += 1;
    } catch (e) {
      failures.push(`${userId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await persistServerEvent('argus_theater_cron_run', {
    users: userIds.length,
    sent,
    skipped,
    failed: failures.length,
  }, { path: '/api/cron/argus-theater' });

  return NextResponse.json({ users: userIds.length, sent, skipped, failed: failures.length });
}
