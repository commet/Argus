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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const { to, subject, question, context, senderName, sessionId, workerId } = body;
  // en-first product, but default 'ko' to preserve behavior when the caller omits it.
  const lang: 'ko' | 'en' = body.locale === 'en' ? 'en' : 'ko';

  if (!to || typeof to !== 'string' || !to.includes('@')) {
    return NextResponse.json({ error: 'Valid email address required' }, { status: 400 });
  }
  if (!question || typeof question !== 'string') {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 });
  }
  if (typeof sessionId !== 'string' || !sessionId || typeof workerId !== 'string' || !workerId) {
    return NextResponse.json({ error: 'sessionId and workerId required for tracking' }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email is not configured on this deployment.' }, { status: 503 });
  }

  // Rate limit: cap outbound emails per user per day. Without this an
  // authenticated account is an unthrottled spam/phishing relay from the
  // argus.voyage domain (Resend cost + sender-reputation blacklisting).
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const DAILY_EMAIL_LIMIT = 30;
  const { data: emailAllowed, error: rateError } = await admin.rpc('record_share_if_allowed', {
    p_user_id: user.id,
    p_channel: 'human_agent_email',
    p_target: null,
    p_context: 'worker_question',
    p_limit: DAILY_EMAIL_LIMIT,
    p_scope_channel: 'human_agent_email',
  });
  if (rateError) {
    console.error('[email/send-question] rate-limit RPC failed:', rateError.message);
    return NextResponse.json({ error: 'Email service temporarily unavailable.' }, { status: 503 });
  }
  if (emailAllowed !== true) {
    return NextResponse.json(
      { error: `Daily email limit (${DAILY_EMAIL_LIMIT}) reached. Try again tomorrow.` },
      { status: 429 },
    );
  }

  const replyToken = generateId();
  const safeQuestion = question.slice(0, 2000);
  const safeContext = typeof context === 'string' ? context.slice(0, 5000) : '';
  const safeName = typeof senderName === 'string' && senderName ? senderName.slice(0, 100) : 'Argus User';
  const defaultSubject = lang === 'en' ? `Question from ${safeName}` : `${safeName}님의 질문`;
  const safeSubject = typeof subject === 'string' && subject ? subject.slice(0, 200) : defaultSubject;

  // Build email HTML — all user inputs HTML-escaped to prevent XSS
  const eName = escapeHtml(safeName);
  const eQuestion = escapeHtml(safeQuestion);
  const eContext = escapeHtml(safeContext);

  // The reply-to-reflect promise is only true when the inbound webhook is
  // configured (EMAIL_INBOUND_SECRET). Otherwise, be honest about it.
  const inboundConfigured = !!process.env.EMAIL_INBOUND_SECRET;
  const replyNotice = lang === 'en'
    ? (inboundConfigured
      ? `Replying to this email will automatically feed into ${eName}'s decision process.`
      : 'Replies go to the Argus team, but are not automatically added to the workspace yet.')
    : (inboundConfigured
      ? `이 이메일에 답장하시면 ${eName}님의 의사결정 과정에 자동으로 반영됩니다.`
      : '답장은 Argus 팀에 전달되지만, 아직 워크스페이스에 자동 반영되지는 않아요.');

  const headerLabel = lang === 'en' ? 'Question request' : '질문 요청';
  const askLine = lang === 'en'
    ? `<strong>${eName}</strong> is asking for your input:`
    : `<strong>${eName}</strong>님이 의견을 구합니다:`;
  const contextLabel = lang === 'en' ? 'Reference' : '참고 자료';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="border-bottom: 2px solid #D97706; padding-bottom: 16px; margin-bottom: 24px;">
        <span style="font-size: 14px; font-weight: 700; color: #D97706;">Argus</span>
        <span style="font-size: 12px; color: #9CA3AF; margin-left: 8px;">${headerLabel}</span>
      </div>

      <p style="font-size: 14px; color: #374151; margin-bottom: 16px;">
        ${askLine}
      </p>

      <div style="background: #FEF3C7; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="font-size: 15px; font-weight: 600; color: #92400E; margin: 0;">${eQuestion}</p>
      </div>

      ${eContext ? `
      <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="font-size: 11px; font-weight: 600; color: #6B7280; margin: 0 0 8px 0;">${contextLabel}</p>
        <p style="font-size: 13px; color: #374151; white-space: pre-wrap; margin: 0;">${eContext}</p>
      </div>
      ` : ''}

      <p style="font-size: 13px; color: #6B7280; margin-bottom: 8px;">
        ${replyNotice}
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
    // Only use the token address when Resend inbound is configured to deliver it
    // back to our webhook. Otherwise a real operator inbox must receive replies.
    const replyTo = inboundConfigured
      ? fromAddress
      : (process.env.EMAIL_REPLY_TO || `hello@${fromDomain}`);

    await resend.emails.send({
      from: `${safeName} via Argus <${fromAddress}>`,
      to,
      subject: safeSubject,
      html,
      replyTo,
    });

    // Track for reply matching (reuse the admin client from the rate-limit check).
    const { error: trackErr } = await admin.from('human_agent_messages').upsert({
      user_id: user.id,
      session_id: sessionId,
      worker_id: workerId,
      channel: 'email',
      reply_token: replyToken,
      status: 'sent',
      created_at: new Date().toISOString(),
    }, { onConflict: 'session_id,worker_id' });

    if (trackErr) {
      // Email already went out but tracking failed → the reply can never be
      // matched back. Surface it (tracked:false) instead of claiming success.
      console.error('[email/send-question] tracking upsert failed — reply loop not wired:', trackErr.message);
      return NextResponse.json({ ok: true, tracked: false }, { status: 200 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[email/send-question] Error:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 502 });
  }
}
