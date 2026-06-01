import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { validateContentType, validateContentLength, validateOrigin } from '@/lib/api-security';
import { generateId } from '@/lib/uuid';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Send a question to an external person (human agent) via email.
 *
 * Body:
 *   to: string — recipient email address
 *   subject: string — email subject
 *   question: string — the question to ask
 *   context: string — AI-prepared background context
 *   senderName: string — the user's name (from)
 *   sessionId: string — progressive session ID (for reply tracking)
 *   workerId: string — worker ID (for reply matching)
 */

export async function POST(req: NextRequest) {
  const ctError = validateContentType(req);
  if (ctError) return ctError;
  const clError = validateContentLength(req);
  if (clError) return clError;
  const originError = validateOrigin(req);
  if (originError) return originError;

  // Auth
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { to, subject, question, context, senderName, sessionId, workerId } = body;

  if (!to || typeof to !== 'string' || !to.includes('@')) {
    return NextResponse.json({ error: 'Valid email address required' }, { status: 400 });
  }
  if (!question || typeof question !== 'string') {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 });
  }
  if (!sessionId || !workerId) {
    return NextResponse.json({ error: 'sessionId and workerId required for tracking' }, { status: 400 });
  }

  const replyToken = generateId();
  const safeQuestion = question.slice(0, 2000);
  const safeContext = (context || '').slice(0, 5000);
  const safeName = (senderName || 'Argus User').slice(0, 100);
  const safeSubject = (subject || `${safeName}님의 질문`).slice(0, 200);

  // Build email HTML — all user inputs HTML-escaped to prevent XSS
  const eName = escapeHtml(safeName);
  const eQuestion = escapeHtml(safeQuestion);
  const eContext = escapeHtml(safeContext);

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="border-bottom: 2px solid #D97706; padding-bottom: 16px; margin-bottom: 24px;">
        <span style="font-size: 14px; font-weight: 700; color: #D97706;">Argus</span>
        <span style="font-size: 12px; color: #9CA3AF; margin-left: 8px;">질문 요청</span>
      </div>

      <p style="font-size: 14px; color: #374151; margin-bottom: 16px;">
        <strong>${eName}</strong>님이 의견을 구합니다:
      </p>

      <div style="background: #FEF3C7; border-left: 3px solid #D97706; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
        <p style="font-size: 15px; font-weight: 600; color: #92400E; margin: 0;">${eQuestion}</p>
      </div>

      ${eContext ? `
      <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="font-size: 11px; font-weight: 600; color: #6B7280; margin: 0 0 8px 0;">참고 자료</p>
        <p style="font-size: 13px; color: #374151; white-space: pre-wrap; margin: 0;">${eContext}</p>
      </div>
      ` : ''}

      <p style="font-size: 13px; color: #6B7280; margin-bottom: 8px;">
        이 이메일에 답장하시면 ${eName}님의 기획 프로세스에 자동으로 반영됩니다.
      </p>

      <p style="font-size: 11px; color: #9CA3AF; margin-top: 32px;">
        Powered by <a href="https://argus.voyage" style="color: #D97706; text-decoration: none;">Argus</a>
      </p>
    </div>
  `;

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromDomain = process.env.EMAIL_FROM_DOMAIN || 'argus.voyage';
    const fromAddress = `reply+${replyToken}@${fromDomain}`;

    await resend.emails.send({
      from: `${safeName} via Argus <${fromAddress}>`,
      to,
      subject: safeSubject,
      html,
      replyTo: fromAddress,
    });

    // Track for reply matching
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    await admin.from('human_agent_messages').upsert({
      user_id: user.id,
      session_id: sessionId,
      worker_id: workerId,
      channel: 'email',
      reply_token: replyToken,
      status: 'sent',
      created_at: new Date().toISOString(),
    }, { onConflict: 'session_id,worker_id' });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[email/send-question] Error:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 502 });
  }
}
