import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';
import { validateContentType, validateContentLength, validateOrigin } from '@/lib/api-security';
import { recordAndCheckShare, adminClient } from '@/lib/share-guard';

/**
 * Create a public, read-only share page for a deliverable. Snapshots the
 * markdown at share time and returns a short token; the page lives at
 * /d/<token> and is openable by anyone (no account). Revoke = the owner deletes
 * the row client-side (RLS), which 404s the page. Rate-limited via share_log.
 */
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const { title, content, context } = body;
  if (!content || typeof content !== 'string') {
    return NextResponse.json({ error: 'content is required' }, { status: 400 });
  }

  const safeTitle = (typeof title === 'string' && title ? title : 'Argus').slice(0, 200);
  const safeContent = content.slice(0, 100_000);

  // 익명 신원도 링크를 만들 수 있다 — 첫인상은 대부분 로그아웃 상태에서 오고,
  // 결과물을 남에게 보여줄 수단이 "텍스트 복사"뿐이면 그 사람은 아무에게도 못 보여준다.
  // 다만 익명 신원은 브라우저마다 공짜로 나오므로 한도를 훨씬 낮게 준다 (ANON_SHARE_LIMIT).
  const guard = await recordAndCheckShare(user.id, 'link', {
    context: typeof context === 'string' ? context.slice(0, 60) : undefined,
    anonymous: user.is_anonymous === true,
  });
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status ?? 429 });

  const shareToken = randomBytes(9).toString('base64url'); // 12 url-safe chars
  const admin = adminClient();
  const { error: insErr } = await admin.from('shared_links').insert({
    token: shareToken,
    user_id: user.id,
    title: safeTitle,
    content: safeContent,
    context: typeof context === 'string' ? context.slice(0, 60) : null,
  });
  if (insErr) {
    console.error('[share/link] insert failed:', insErr.message);
    return NextResponse.json({ error: 'Could not create link' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, token: shareToken, path: `/d/${shareToken}` });
}
