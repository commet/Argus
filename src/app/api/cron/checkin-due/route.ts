import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Check-in reminder cron (the LAND phase's missing outbound channel).
 *
 * Until now the seal→settle loop was 100% pull-only: a decision resurfaced only if
 * the user happened to reopen /project on the right day. This emails OPTED-IN,
 * logged-in users on/after their check-in date so the loop can actually close.
 *
 * HONEST BY DEFAULT: only contracts with `email_reminder === true` (an explicit
 * opt-in at seal time) are ever emailed — the product's "no emails unless you ask"
 * promise stays true for everyone else. Deduped via `reminder_sent_at` (re-emails at
 * most once per 7 days while a contract stays due). Guarded by CRON_SECRET.
 *
 * FOUNDER: this does NOT fire until (1) it's added to vercel.json crons and (2)
 * CRON_SECRET / RESEND_API_KEY / SUPABASE_SERVICE_ROLE_KEY are set. Verify the email
 * content + a real send before relying on it.
 */

const RESEND_DUP_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function safeCompare(a: string, b: string): boolean {
  const lengthMismatch = a.length !== b.length ? 1 : 0;
  const compareTarget = lengthMismatch ? a : b;
  let mismatch = lengthMismatch;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ compareTarget.charCodeAt(i);
  return mismatch === 0;
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

interface Contract {
  check_in_at?: string;
  graded_at?: string;
  email_reminder?: boolean;
  reminder_sent_at?: string;
  predicates?: { source?: string; text?: string }[];
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`;
  if (!process.env.CRON_SECRET || !safeCompare(authHeader, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const resend = new Resend(process.env.RESEND_API_KEY);
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://argus.voyage';
  const now = Date.now();

  // Pull candidate contracts (small scale: select the lot, filter in JS for clarity).
  const { data: rows, error } = await supabase
    .from('projects')
    .select('id, user_id, name, decision_contract')
    .not('decision_contract', 'is', null)
    .is('deleted_at', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const due = (rows ?? []).filter((r: { decision_contract: Contract | null }) => {
    const c = r.decision_contract;
    if (!c || c.email_reminder !== true) return false;          // opt-in only
    if (!c.check_in_at || c.graded_at) return false;             // armed + ungraded
    if (new Date(c.check_in_at).getTime() > now) return false;   // actually due
    if (c.reminder_sent_at && now - new Date(c.reminder_sent_at).getTime() < RESEND_DUP_WINDOW_MS) return false;
    return true;
  });

  let sent = 0;
  const failures: string[] = [];
  for (const r of due as { id: string; user_id: string; name: string; decision_contract: Contract }[]) {
    try {
      const { data: u } = await supabase.auth.admin.getUserById(r.user_id);
      const email = u?.user?.email;
      if (!email) continue;
      const c = r.decision_contract;
      const lean = c.predicates?.find((p) => p.source === 'user_lean')?.text;
      const name = typeof r.name === 'string' ? r.name : '';
      const link = `${origin}/project`;
      const html = `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
          <p style="font-size:18px;font-weight:700;margin:0 0 12px">그래서, 어떻게 됐어요?</p>
          <p style="font-size:14px;color:#57534e;line-height:1.6;margin:0 0 8px">${escHtml(name)} — 그날 확인하기로 한 결정이에요.</p>
          ${lean ? `<p style="font-size:13px;color:#78716c;line-height:1.5;margin:0 0 16px">출항 때 당신의 한 줄: “${escHtml(lean)}”</p>` : ''}
          <a href="${link}" style="display:inline-block;background:#2d4a7c;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 18px;border-radius:10px">돌아가서 정산하기 →</a>
          <p style="font-size:11px;color:#a8a29e;margin:20px 0 0">이 메일은 봉인할 때 알림을 켜셔서 받은 거예요.</p>
        </div>`;
      await resend.emails.send({
        from: 'Argus <onboarding@resend.dev>',
        to: email,
        subject: `그래서, 어떻게 됐어요? — ${name}`,
        html,
      });
      // Stamp reminder_sent_at so we don't re-email daily.
      await supabase
        .from('projects')
        .update({ decision_contract: { ...c, reminder_sent_at: new Date(now).toISOString() } })
        .eq('id', r.id);
      sent++;
    } catch (e) {
      failures.push(`${r.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, candidates: due.length, sent, failures });
}
