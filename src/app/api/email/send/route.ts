import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { validateContentType, validateContentLength, validateOrigin } from '@/lib/api-security';
import { markdownToEmailHtml } from '@/lib/email-html';
import { recordAndCheckShare } from '@/lib/share-guard';

// 09 S8: explicit server budget instead of the platform default — a stuck
// upstream (Resend) call must terminate, not hold the client's 15s abort alone.
export const maxDuration = 30;

/**
 * Share an Argus deliverable to an email recipient. Unlike send-question (which
 * wires a reply loop for human-agent answers), this is a one-way share: the full
 * markdown deliverable rendered as an HTML email. Rate-limited via share_log.
 */
function maskEmail(addr: string): string {
  const [user, domain] = addr.split('@');
  if (!domain) return '***';
  const head = user.slice(0, 2);
  return `${head}${'*'.repeat(Math.max(1, user.length - 2))}@${domain}`;
}

export async function POST(req: NextRequest) {
  const ctError = validateContentType(req);
  if (ctError) return ctError;
  const clError = validateContentLength(req);
  if (clError) return clError;
  const originError = validateOrigin(req);
  if (originError) return originError;

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

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email is not configured on this deployment.' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const { to, title, content, context } = body;

  if (!to || typeof to !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ error: 'Valid email address required' }, { status: 400 });
  }
  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const safeTitle = (typeof title === 'string' && title ? title : 'Argus').slice(0, 200);

  // Rate limit + log (shared across channels).
  const guard = await recordAndCheckShare(user.id, 'email', {
    target: maskEmail(to),
    context: typeof context === 'string' ? context.slice(0, 60) : undefined,
  });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 429 });

  const html = markdownToEmailHtml(safeTitle, content);

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromDomain = process.env.EMAIL_FROM_DOMAIN || 'argus.voyage';
    const replyTo = process.env.EMAIL_REPLY_TO || `hello@${fromDomain}`;
    await resend.emails.send({
      from: `Argus <share@${fromDomain}>`,
      to,
      replyTo,
      subject: safeTitle,
      html,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[email/send] Error:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 502 });
  }
}
