import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// NOTIFICATION_GATE_EXEMPT_OWNER_REPORT: internal founder report, not a user-facing Argus notification.
const REPORT_EMAIL = process.env.REPORT_EMAIL || '';
const OWNER_EMAILS = (process.env.OWNER_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

// ───── Palette (email-safe) ─────
const C = {
  bg: '#fafaf9',
  card: '#ffffff',
  border: '#e7e5e4',
  borderSubtle: '#f5f5f4',
  text: '#1a1a1a',
  muted: '#78716c',
  faint: '#a8a29e',
  primary: '#2d4a7c',
  primaryLight: '#dbeafe',
  accent: '#4b6a95',
  growth: '#10b981',
  growthBg: '#ecfdf5',
  decline: '#dc2626',
  declineBg: '#fef2f2',
  warm: '#d97706',
  warmBg: '#fffbeb',
};

// ───── Helpers ─────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeCompare(a: string, b: string): boolean {
  const lengthMismatch = a.length !== b.length ? 1 : 0;
  const compareTarget = lengthMismatch ? a : b;
  let mismatch = lengthMismatch;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ compareTarget.charCodeAt(i);
  return mismatch === 0;
}

function kstDateString(d: Date): string {
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

function kstRange(daysAgo: number): { start: string; end: string; label: string } {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCDate(kst.getUTCDate() - daysAgo);
  const label = kst.toISOString().split('T')[0];
  const start = new Date(`${label}T00:00:00+09:00`).toISOString();
  const end = new Date(`${label}T23:59:59.999+09:00`).toISOString();
  return { start, end, label };
}

function classifySource(initialReferrer: string | null | undefined, utmSource: string | null | undefined): string {
  if (utmSource) {
    const u = utmSource.toLowerCase();
    if (u === 'ig' || u.includes('instagram')) return 'Instagram';
    if (u.includes('linkedin')) return 'LinkedIn';
    if (u.includes('threads')) return 'Threads';
    if (u === 'fb' || u.includes('facebook')) return 'Facebook';
    if (u.includes('kakao')) return 'KakaoTalk';
    if (u === 'x' || u.includes('twitter')) return 'X (Twitter)';
    if (u.includes('discord')) return 'Discord';
    if (u.includes('reddit')) return 'Reddit';
    if (u.includes('youtube')) return 'YouTube';
    if (u.includes('email') || u.includes('newsletter')) return 'Email';
    return utmSource;
  }
  if (!initialReferrer) return 'Direct';
  const host = initialReferrer.replace(/^https?:\/\//, '').replace(/^android-app:\/\//, '').split('/')[0];
  if (host.includes('linkedin')) return 'LinkedIn';
  if (host.includes('threads')) return 'Threads';
  if (host.includes('instagram')) return 'Instagram';
  if (host.includes('facebook') || host === 'm.facebook.com') return 'Facebook';
  if (host.includes('google') || host.includes('bing') || host.includes('duckduckgo')) return 'Search';
  if (host.includes('accounts.google')) return 'Google OAuth';
  if (host.includes('vercel')) return 'Vercel';
  if (host.includes('argus') || host.includes('localhost')) return 'Internal';
  return host;
}

function deltaLabel(current: number, baseline: number): { text: string; color: string; arrow: string } {
  if (baseline === 0 && current === 0) return { text: '—', color: C.faint, arrow: '' };
  if (baseline === 0) return { text: '신규', color: C.growth, arrow: '↑' };
  const pct = Math.round(((current - baseline) / baseline) * 100);
  if (pct === 0) return { text: '0%', color: C.faint, arrow: '→' };
  if (pct > 0) return { text: `${pct}%`, color: C.growth, arrow: '↑' };
  return { text: `${Math.abs(pct)}%`, color: C.decline, arrow: '↓' };
}

type EventRow = {
  session_id: string;
  event_name: string;
  properties: Record<string, unknown> | null;
  user_id: string | null;
  page_path: string | null;
  referrer: string | null;
  created_at: string;
};

type UserRow = { id: string; email: string | null; created_at: string; user_metadata: Record<string, unknown> | null };

// ───── Handler ─────

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`;
  if (!process.env.CRON_SECRET || !safeCompare(authHeader, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const missingConfig = [
    ['NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL],
    ['SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY],
    ['RESEND_API_KEY', process.env.RESEND_API_KEY],
    ['REPORT_EMAIL', REPORT_EMAIL],
    ['OWNER_EMAILS', OWNER_EMAILS.length > 0 ? 'configured' : ''],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missingConfig.length > 0) {
    console.error('[daily-report] missing configuration:', missingConfig.join(', '));
    return NextResponse.json({ error: 'Report delivery is not configured' }, { status: 503 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const resend = new Resend(process.env.RESEND_API_KEY);

  // ─── Time windows ───
  const yesterday = kstRange(1);
  const twoWeeksAgo = kstRange(14);

  // ─── 1. Auth users + owner ids ───
  // Paginate — a single perPage:1000 page silently undercounts past 1000 users.
  const authUsers: { id: string; email?: string; created_at: string; user_metadata?: Record<string, unknown> }[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data: pageData } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    const batch = pageData?.users || [];
    authUsers.push(...batch);
    if (batch.length < 1000) break;
  }
  const allUsers: UserRow[] = authUsers.map(u => ({
    id: u.id,
    email: u.email || null,
    created_at: u.created_at,
    user_metadata: (u.user_metadata as Record<string, unknown>) || null,
  }));
  const ownerIds = new Set(allUsers.filter(u => OWNER_EMAILS.includes((u.email || '').toLowerCase())).map(u => u.id));
  const externalUsers = allUsers.filter(u => !ownerIds.has(u.id));
  const userById = new Map(externalUsers.map(u => [u.id, u]));

  // ─── 2. Events: yesterday (detailed) + last 14 days (rollup for WoW comparison) ───
  // Page explicitly instead of silently truncating once traffic exceeds a
  // fixed daily/fortnightly limit. Supabase projects often cap each response,
  // so a large `.limit()` is not a reliable production rollup.
  const loadEvents = async (columns: string, start: string, end: string) => {
    const rows: Record<string, unknown>[] = [];
    const pageSize = 1000;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase
        .from('user_events')
        .select(columns)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error(`user_events query failed: ${error.message}`);
      const batch = (data || []) as unknown as Record<string, unknown>[];
      rows.push(...batch);
      if (batch.length < pageSize) break;
    }
    return rows;
  };

  let yesterdayRaw: Record<string, unknown>[];
  let twoWeekRaw: Record<string, unknown>[];
  try {
    [yesterdayRaw, twoWeekRaw] = await Promise.all([
      loadEvents('session_id, event_name, properties, user_id, page_path, referrer, created_at', yesterday.start, yesterday.end),
      loadEvents('session_id, user_id, event_name, created_at', twoWeeksAgo.start, yesterday.end),
    ]);
  } catch (err) {
    console.error('[daily-report] analytics query error:', err);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }

  const yesterdayEvents = yesterdayRaw as unknown as EventRow[];
  const twoWeekEvents = twoWeekRaw as unknown as Pick<EventRow, 'session_id' | 'user_id' | 'event_name' | 'created_at'>[];

  // Owner session filter: any session that has an owner user_id event
  const ownerSessionIds = new Set<string>();
  for (const e of yesterdayEvents) if (e.user_id && ownerIds.has(e.user_id)) ownerSessionIds.add(e.session_id);
  for (const e of twoWeekEvents) if (e.user_id && ownerIds.has(e.user_id)) ownerSessionIds.add(e.session_id);

  const extYAll = yesterdayEvents.filter(e => !ownerSessionIds.has(e.session_id));
  // Server-side telemetry uses one synthetic "server" session. Keep it for the
  // error digest, but never count it as a person, session, source, or funnel hit.
  const extY = extYAll.filter(e => e.session_id !== 'server');
  const ext14 = twoWeekEvents.filter(e => !ownerSessionIds.has(e.session_id) && e.session_id !== 'server');

  // ─── 3. All-time cumulative stats ───
  const { count: totalUsers } = await supabase
    .from('projects')
    .select('user_id', { count: 'exact', head: true })
    .not('user_id', 'in', `(${[...ownerIds].map(id => `"${id}"`).join(',') || '""'})`);
  // More direct: just count non-owner auth users
  const cumulativeUsers = externalUsers.length;

  const { count: cumulativeProjects } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .not('user_id', 'in', `(${[...ownerIds].map(id => `"${id}"`).join(',') || '""'})`);

  // Completions: progressive_sessions where phase=complete OR final_deliverable is set
  const { data: allProgressive } = await supabase
    .from('progressive_sessions')
    .select('user_id, data')
    .limit(5000);
  const cumulativeCompletions = (allProgressive || []).filter(s => {
    if (s.user_id && ownerIds.has(s.user_id)) return false;
    const phase = (s.data as { phase?: string })?.phase;
    const fd = (s.data as { final_deliverable?: string })?.final_deliverable;
    return phase === 'complete' || (fd && fd.length > 0);
  }).length;

  // Ignore the unused first `totalUsers` query — we use externalUsers.length for accuracy
  void totalUsers;

  // ─── 4. Yesterday top-line ───
  const sessionsY = new Set(extY.map(e => e.session_id));
  const usersY = new Set(extY.filter(e => e.user_id).map(e => e.user_id!));
  const anonSessionsY = new Set(extY.filter(e => !e.user_id).map(e => e.session_id));

  // ─── 5. 7-day trend (daily session count, external) + WoW comparison ───
  const daily: Record<string, Set<string>> = {};
  for (const e of ext14) {
    const date = kstDateString(new Date(e.created_at));
    if (!daily[date]) daily[date] = new Set();
    daily[date].add(e.session_id);
  }
  const last14Dates: string[] = [];
  for (let i = 13; i >= 0; i--) last14Dates.push(kstRange(i + 1).label);
  const dailyTrend = last14Dates.slice(7).map(d => ({ date: d, sessions: daily[d]?.size || 0 }));
  const thisWeek = last14Dates.slice(7);
  const lastWeek = last14Dates.slice(0, 7);
  const thisWeekAvg = thisWeek.reduce((sum, d) => sum + (daily[d]?.size || 0), 0) / 7;
  const lastWeekAvg = lastWeek.reduce((sum, d) => sum + (daily[d]?.size || 0), 0) / 7;
  const wowDelta = deltaLabel(thisWeekAvg, lastWeekAvg);
  const yesterdayVsWeekAvg = deltaLabel(sessionsY.size, thisWeekAvg);

  // ─── 6. Source breakdown + per-source completion ───
  const sessionStarts = extY.filter(e => e.event_name === 'session_start');
  const seenInStart = new Set(sessionStarts.map(e => e.session_id));
  // Map session_id → source
  const sessionSource = new Map<string, string>();
  for (const e of sessionStarts) {
    const props = e.properties || {};
    sessionSource.set(e.session_id, classifySource((props.initial_referrer as string) || e.referrer, props.utm_source as string));
  }
  for (const sid of sessionsY) {
    if (seenInStart.has(sid)) continue;
    const first = extY.find(e => e.session_id === sid);
    sessionSource.set(sid, classifySource(first?.referrer || null, null));
  }
  // Sessions that reached "완주" (by event)
  const completionEvents = new Set(['flow_done', 'progressive_draft_promoted', 'loop_converged']);
  const completedSessions = new Set(extY.filter(e => completionEvents.has(e.event_name)).map(e => e.session_id));
  // Bucket counts + conversion
  const sourceStats: Record<string, { sessions: number; completions: number }> = {};
  for (const [sid, src] of sessionSource) {
    if (!sourceStats[src]) sourceStats[src] = { sessions: 0, completions: 0 };
    sourceStats[src].sessions++;
    if (completedSessions.has(sid)) sourceStats[src].completions++;
  }

  // ─── 7. New signups + drilldown ───
  const yStart = new Date(yesterday.start);
  const yEnd = new Date(yesterday.end);
  const newSignups = externalUsers.filter(u => {
    const created = new Date(u.created_at);
    return created >= yStart && created <= yEnd;
  });

  const MILESTONES = [
    { key: 'reframe_complete', label: 'Reframe' },
    { key: 'recast_complete', label: 'Recast' },
    { key: 'progressive_draft_added', label: '초안' },
    { key: 'progressive_draft_promoted', label: '드래프트 확정' },
    { key: 'feedback_complete', label: '페르소나 피드백' },
    { key: 'flow_done', label: '플로우 완주' },
  ] as const;

  const signupDetails = newSignups.map(u => {
    const userSessionIds = new Set(extY.filter(e => e.user_id === u.id).map(e => e.session_id));
    const userEvents = extY.filter(e => userSessionIds.has(e.session_id));
    const firstEvent = userEvents[0] ?? null;
    const lastEvent = userEvents.length > 0
      ? userEvents.reduce((max, e) => new Date(e.created_at) > new Date(max.created_at) ? e : max, userEvents[0])
      : null;
    const sessionStart = userEvents.find(e => e.event_name === 'session_start');
    const src = classifySource(
      (sessionStart?.properties?.initial_referrer as string) || firstEvent?.referrer || null,
      sessionStart?.properties?.utm_source as string
    );
    const reached = MILESTONES.filter(m => userEvents.some(e => e.event_name === m.key));
    const durationMin = firstEvent && lastEvent
      ? Math.round((new Date(lastEvent.created_at).getTime() - new Date(firstEvent.created_at).getTime()) / 60000)
      : 0;
    return {
      email: u.email || '',
      name: (u.user_metadata?.full_name as string) || '',
      source: src,
      sessionCount: userSessionIds.size,
      eventCount: userEvents.length,
      reached,
      durationMin,
      lastEventName: lastEvent?.event_name || null,
    };
  });

  // ─── 8. Top user of the week (most engaged non-owner, last 7 days) ───
  const weekStart = kstRange(7).start;
  const [projectsWk, judgmentsWk, progressiveWk, feedbackWk] = await Promise.all([
    supabase.from('projects').select('user_id, name, created_at').gte('created_at', weekStart).limit(500),
    supabase.from('judgment_records').select('user_id').gte('created_at', weekStart).limit(500),
    supabase.from('progressive_sessions').select('user_id, data, created_at').gte('created_at', weekStart).limit(500),
    supabase.from('feedback_records').select('user_id').gte('created_at', weekStart).limit(500),
  ]);
  const weekActivity: Record<string, { p: number; j: number; pg: number; f: number; completions: number; lastProjectName?: string; lastAt?: string }> = {};
  const bump = (uid: string | null, field: 'p' | 'j' | 'pg' | 'f') => {
    if (!uid || ownerIds.has(uid)) return;
    if (!weekActivity[uid]) weekActivity[uid] = { p: 0, j: 0, pg: 0, f: 0, completions: 0 };
    weekActivity[uid][field]++;
  };
  for (const r of projectsWk.data || []) {
    bump(r.user_id, 'p');
    if (r.user_id && !ownerIds.has(r.user_id)) {
      const a = weekActivity[r.user_id];
      if (!a.lastAt || r.created_at > a.lastAt) {
        a.lastAt = r.created_at;
        a.lastProjectName = r.name || '';
      }
    }
  }
  for (const r of judgmentsWk.data || []) bump(r.user_id, 'j');
  for (const r of feedbackWk.data || []) bump(r.user_id, 'f');
  for (const r of progressiveWk.data || []) {
    bump(r.user_id, 'pg');
    if (r.user_id && !ownerIds.has(r.user_id)) {
      const phase = (r.data as { phase?: string })?.phase;
      const fd = (r.data as { final_deliverable?: string })?.final_deliverable;
      if (phase === 'complete' || (fd && fd.length > 0)) weekActivity[r.user_id].completions++;
    }
  }
  const rankedUsers = Object.entries(weekActivity)
    .map(([uid, a]) => ({ uid, score: a.p + a.j * 2 + a.pg + a.f * 2 + a.completions * 5, ...a }))
    .sort((a, b) => b.score - a.score);
  const topUser = rankedUsers[0] ? userById.get(rankedUsers[0].uid) : null;
  const topUserActivity = rankedUsers[0];

  // ─── 9. Funnel ───
  const funnelStages = [
    { label: '세션 시작', keys: ['session_start', 'page_view'] },
    { label: '랜딩 CTA', keys: ['landing_hero_submit', 'landing_cta_click'] },
    { label: 'Workspace 진입', keys: ['workspace_enter', 'workspace_problem_submit'] },
    { label: 'Reframe/Recast', keys: ['reframe_complete', 'recast_complete'] },
    { label: '초안 생성', keys: ['progressive_draft_added'] },
    { label: '완주', keys: ['flow_done', 'progressive_draft_promoted', 'loop_converged'] },
  ];
  const funnelCounts = funnelStages.map(stage => {
    const sid = new Set(extY.filter(e => stage.keys.includes(e.event_name)).map(e => e.session_id));
    return { label: stage.label, sessions: sid.size };
  });
  const funnelTop = funnelCounts[0].sessions || 1;

  // ─── 10. Errors ───
  const errorEvents = new Set([
    'error',
    'unhandled_error',
    'unhandled_rejection',
    'llm_error',
    'server_llm_error',
    'workspace_start_error',
    'review_timeout',
    'server_rate_limited',
    'server_captcha_rejected',
  ]);
  const errorBreakdown = new Map<string, number>();
  for (const event of extYAll) {
    if (!errorEvents.has(event.event_name)) continue;
    errorBreakdown.set(event.event_name, (errorBreakdown.get(event.event_name) || 0) + 1);
  }
  const errorCount = [...errorBreakdown.values()].reduce((sum, count) => sum + count, 0);
  const errorSummary = [...errorBreakdown.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => `${name} ${count}`)
    .join(' · ');

  // ───── Build HTML ─────

  const kstDate = yesterday.label;
  const sourceEntries = Object.entries(sourceStats).sort(([, a], [, b]) => b.sessions - a.sessions).slice(0, 8);
  const trendMax = Math.max(...dailyTrend.map(d => d.sessions), 1);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 16px; color: ${C.text}; background: ${C.bg};">

  <!-- ════════ HERO ════════ -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.primary}; border-radius: 16px; margin-bottom: 20px; overflow: hidden;">
    <tr><td style="padding: 28px 24px;">
      <p style="color: rgba(255,255,255,0.6); font-size: 11px; margin: 0 0 2px; letter-spacing: 0.1em; text-transform: uppercase;">Argus Daily · ${kstDate} KST</p>
      <div style="display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; margin-top: 8px;">
        <div>
          <p style="color: #fff; font-size: 40px; font-weight: 800; margin: 0; letter-spacing: -0.02em; line-height: 1;">${usersY.size}<span style="color: rgba(255,255,255,0.5); font-size: 20px; font-weight: 600;"> 유저</span></p>
        </div>
        <div>
          <p style="color: rgba(255,255,255,0.9); font-size: 28px; font-weight: 700; margin: 0; line-height: 1;">${sessionsY.size}<span style="color: rgba(255,255,255,0.5); font-size: 16px; font-weight: 600;"> 세션</span></p>
        </div>
        <div>
          <p style="color: rgba(255,255,255,0.9); font-size: 28px; font-weight: 700; margin: 0; line-height: 1;">${signupDetails.length}<span style="color: rgba(255,255,255,0.5); font-size: 16px; font-weight: 600;"> 신규</span></p>
        </div>
      </div>
      <p style="color: rgba(255,255,255,0.75); font-size: 13px; margin: 16px 0 0;">
        <span style="color: ${yesterdayVsWeekAvg.color === C.growth ? '#86efac' : yesterdayVsWeekAvg.color === C.decline ? '#fca5a5' : 'rgba(255,255,255,0.6)'}; font-weight: 700;">${yesterdayVsWeekAvg.arrow}${yesterdayVsWeekAvg.text}</span>
        <span style="color: rgba(255,255,255,0.6);"> 지난 7일 평균 세션 대비</span>
      </p>
    </td></tr>
  </table>

  <!-- ════════ CUMULATIVE ════════ -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 20px;">
      <p style="font-size: 10px; font-weight: 700; color: ${C.faint}; margin: 0 0 14px; letter-spacing: 0.12em; text-transform: uppercase;">누적 · All-Time</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="width: 33.33%; text-align: center; padding: 0 8px;">
            <p style="font-size: 32px; font-weight: 800; color: ${C.primary}; margin: 0; letter-spacing: -0.02em;">${cumulativeUsers}</p>
            <p style="font-size: 11px; color: ${C.muted}; margin: 4px 0 0; font-weight: 600;">가입 유저</p>
          </td>
          <td style="width: 33.33%; text-align: center; padding: 0 8px; border-left: 1px solid ${C.borderSubtle}; border-right: 1px solid ${C.borderSubtle};">
            <p style="font-size: 32px; font-weight: 800; color: ${C.primary}; margin: 0; letter-spacing: -0.02em;">${cumulativeProjects ?? 0}</p>
            <p style="font-size: 11px; color: ${C.muted}; margin: 4px 0 0; font-weight: 600;">프로젝트</p>
          </td>
          <td style="width: 33.33%; text-align: center; padding: 0 8px;">
            <p style="font-size: 32px; font-weight: 800; color: ${C.growth}; margin: 0; letter-spacing: -0.02em;">${cumulativeCompletions}</p>
            <p style="font-size: 11px; color: ${C.muted}; margin: 4px 0 0; font-weight: 600;">완주</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>

  <!-- ════════ NEW SIGNUPS ════════ -->
  ${signupDetails.length > 0 ? `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 20px;">
      <p style="font-size: 10px; font-weight: 700; color: ${C.faint}; margin: 0 0 12px; letter-spacing: 0.12em; text-transform: uppercase;">신규 가입자 · 어제의 여정</p>
      ${signupDetails.map(s => `
      <div style="border-left: 3px solid ${s.reached.length > 0 ? C.primary : C.border}; padding: 8px 0 8px 14px; margin-bottom: 14px;">
        <p style="font-size: 14px; font-weight: 700; margin: 0; color: ${C.text};">${escHtml(s.name || '(이름 없음)')}</p>
        <p style="font-size: 12px; color: ${C.muted}; margin: 2px 0 0;">${escHtml(s.email)} · <span style="color: ${C.primary}; font-weight: 600;">${escHtml(s.source)}</span></p>
        <p style="font-size: 12px; color: ${C.muted}; margin: 6px 0 0;">세션 ${s.sessionCount} · 이벤트 ${s.eventCount} · 체류 ${s.durationMin}분</p>
        <p style="font-size: 12px; margin: 8px 0 0;">
          ${s.reached.length > 0
            ? s.reached.map(m => `<span style="display: inline-block; background: ${C.primaryLight}; color: ${C.primary}; padding: 3px 9px; border-radius: 10px; margin: 2px 3px 0 0; font-size: 11px; font-weight: 600;">${escHtml(m.label)}</span>`).join('')
            : `<span style="color: ${C.faint}; font-size: 11px;">진입만 — 본격적인 단계 도달 X</span>`
          }
        </p>
        ${s.lastEventName ? `<p style="font-size: 11px; color: ${C.faint}; margin: 4px 0 0;">마지막 이벤트: <code style="font-size: 10px; color: ${C.muted};">${escHtml(s.lastEventName)}</code></p>` : ''}
      </div>`).join('')}
    </td></tr>
  </table>` : ''}

  <!-- ════════ TOP USER OF WEEK ════════ -->
  ${topUser && topUserActivity ? `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, ${C.primary} 0%, ${C.accent} 100%); border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 20px 22px;">
      <p style="font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.6); margin: 0 0 10px; letter-spacing: 0.12em; text-transform: uppercase;">🏆 이번 주 Top 유저</p>
      <p style="font-size: 18px; font-weight: 800; color: #fff; margin: 0;">${escHtml((topUser.user_metadata?.full_name as string) || topUser.email?.split('@')[0] || '(이름 없음)')}</p>
      <p style="font-size: 12px; color: rgba(255,255,255,0.7); margin: 3px 0 0;">${escHtml(topUser.email || '')}</p>
      ${topUserActivity.lastProjectName ? `<p style="font-size: 13px; color: rgba(255,255,255,0.95); margin: 10px 0 0; font-style: italic;">"${escHtml(topUserActivity.lastProjectName.slice(0, 60))}${topUserActivity.lastProjectName.length > 60 ? '…' : ''}"</p>` : ''}
      <table role="presentation" width="100%" style="margin-top: 14px;"><tr>
        <td style="text-align: center; padding: 0 4px;"><p style="font-size: 20px; font-weight: 800; color: #fff; margin: 0;">${topUserActivity.p}</p><p style="font-size: 10px; color: rgba(255,255,255,0.6); margin: 2px 0 0;">프로젝트</p></td>
        <td style="text-align: center; padding: 0 4px;"><p style="font-size: 20px; font-weight: 800; color: #fff; margin: 0;">${topUserActivity.pg}</p><p style="font-size: 10px; color: rgba(255,255,255,0.6); margin: 2px 0 0;">세션</p></td>
        <td style="text-align: center; padding: 0 4px;"><p style="font-size: 20px; font-weight: 800; color: #fff; margin: 0;">${topUserActivity.j}</p><p style="font-size: 10px; color: rgba(255,255,255,0.6); margin: 2px 0 0;">판단</p></td>
        <td style="text-align: center; padding: 0 4px;"><p style="font-size: 20px; font-weight: 800; color: #fff; margin: 0;">${topUserActivity.f}</p><p style="font-size: 10px; color: rgba(255,255,255,0.6); margin: 2px 0 0;">피드백</p></td>
        <td style="text-align: center; padding: 0 4px;"><p style="font-size: 20px; font-weight: 800; color: #86efac; margin: 0;">${topUserActivity.completions}</p><p style="font-size: 10px; color: rgba(255,255,255,0.6); margin: 2px 0 0;">완주</p></td>
      </tr></table>
    </td></tr>
  </table>` : ''}

  <!-- ════════ FUNNEL (visual bars) ════════ -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 20px;">
      <p style="font-size: 10px; font-weight: 700; color: ${C.faint}; margin: 0 0 14px; letter-spacing: 0.12em; text-transform: uppercase;">깔때기 · 어제 세션 기준</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 12px;">
        ${funnelCounts.map((f, i) => {
          const pct = Math.round((f.sessions / funnelTop) * 100);
          const prevPct = i > 0 ? Math.round((f.sessions / (funnelCounts[i - 1].sessions || 1)) * 100) : 100;
          const barWidth = Math.max(pct, f.sessions > 0 ? 8 : 3);
          const isDrop = i > 0 && prevPct < 50;
          const barColor = f.sessions === 0 ? C.borderSubtle : isDrop ? C.decline : C.primary;
          return `<tr>
            <td style="padding: 6px 0; width: 130px; font-weight: 600; color: ${f.sessions > 0 ? C.text : C.faint};">${escHtml(f.label)}</td>
            <td style="padding: 6px 0;">
              <div style="background: ${C.borderSubtle}; border-radius: 4px; height: 20px; position: relative;">
                <div style="background: ${barColor}; border-radius: 4px; height: 20px; width: ${barWidth}%; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; box-sizing: border-box;">
                  ${f.sessions > 0 ? `<span style="color: #fff; font-size: 11px; font-weight: 700;">${f.sessions}</span>` : ''}
                </div>
              </div>
            </td>
            <td style="padding: 6px 0 6px 10px; width: 70px; text-align: right; font-size: 11px; color: ${isDrop ? C.decline : C.muted};">${i === 0 ? `<strong>${pct}%</strong>` : `↓${100 - prevPct}%`}</td>
          </tr>`;
        }).join('')}
      </table>
      <p style="font-size: 10px; color: ${C.faint}; margin: 10px 0 0;">바 길이는 세션 시작 대비 %, 우측은 직전 단계에서의 이탈률 (빨강: 50% 이상 이탈)</p>
    </td></tr>
  </table>

  <!-- ════════ 7-DAY TREND (today highlighted) ════════ -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 14px;">
        <p style="font-size: 10px; font-weight: 700; color: ${C.faint}; margin: 0; letter-spacing: 0.12em; text-transform: uppercase;">지난 7일 세션</p>
        <p style="font-size: 11px; color: ${wowDelta.color}; font-weight: 700; margin: 0;">${wowDelta.arrow} ${wowDelta.text} <span style="color: ${C.faint}; font-weight: 500;">vs 지난주</span></p>
      </div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        ${dailyTrend.map(d => {
          const pct = Math.round((d.sessions / trendMax) * 100);
          const isYesterday = d.date === kstDate;
          const barColor = isYesterday ? C.primary : C.accent;
          const bg = isYesterday ? C.primaryLight : C.borderSubtle;
          return `<tr>
            <td style="padding: 4px 0; width: 88px; font-family: 'SF Mono', Menlo, monospace; font-size: 11px; color: ${isYesterday ? C.primary : C.muted}; font-weight: ${isYesterday ? 700 : 500};">${d.date}${isYesterday ? ' ●' : ''}</td>
            <td style="padding: 4px 10px;">
              <div style="background: ${bg}; border-radius: 4px; height: 14px;">
                <div style="background: ${barColor}; border-radius: 4px; height: 14px; width: ${pct}%;"></div>
              </div>
            </td>
            <td style="padding: 4px 0; text-align: right; width: 36px; font-weight: 700; color: ${isYesterday ? C.primary : C.muted};">${d.sessions}</td>
          </tr>`;
        }).join('')}
      </table>
      <p style="font-size: 11px; color: ${C.muted}; margin: 14px 0 0;">이번주 평균 <strong style="color: ${C.text};">${thisWeekAvg.toFixed(1)}</strong>세션/일 · 지난주 평균 <strong style="color: ${C.text};">${lastWeekAvg.toFixed(1)}</strong>세션/일</p>
    </td></tr>
  </table>

  <!-- ════════ SOURCES (with conversion) ════════ -->
  ${sourceEntries.length > 0 ? `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 20px;">
      <p style="font-size: 10px; font-weight: 700; color: ${C.faint}; margin: 0 0 12px; letter-spacing: 0.12em; text-transform: uppercase;">유입 소스 · 완주 전환율</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 12px;">
        <tr style="color: ${C.faint}; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;">
          <td style="padding: 4px 0; font-weight: 700;">소스</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 700;">세션</td>
          <td style="padding: 4px 12px; text-align: right; font-weight: 700;">완주</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 700;">전환</td>
        </tr>
        ${sourceEntries.map(([src, s]) => {
          const conv = s.sessions > 0 ? Math.round((s.completions / s.sessions) * 100) : 0;
          return `<tr style="border-top: 1px solid ${C.borderSubtle};">
            <td style="padding: 8px 0; font-weight: 600;">${escHtml(src)}</td>
            <td style="padding: 8px 0; text-align: right; color: ${C.muted};">${s.sessions}</td>
            <td style="padding: 8px 12px; text-align: right; font-weight: 700; color: ${s.completions > 0 ? C.growth : C.faint};">${s.completions}</td>
            <td style="padding: 8px 0; text-align: right; font-weight: 700; color: ${conv > 0 ? C.growth : C.faint};">${conv}%</td>
          </tr>`;
        }).join('')}
      </table>
    </td></tr>
  </table>` : ''}

  <!-- ════════ ERRORS ════════ -->
  ${errorCount > 0 ? `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.declineBg}; border: 1px solid #fecaca; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 16px 20px;">
      <p style="font-size: 14px; color: ${C.decline}; margin: 0 0 4px; font-weight: 700;">에러 ${errorCount}건</p>
      <p style="font-size: 12px; color: ${C.muted}; margin: 0;">${escHtml(errorSummary)}</p>
    </td></tr>
  </table>` : ''}

  <p style="font-size: 10px; color: ${C.faint}; text-align: center; margin: 20px 0 8px;">
    Argus Daily · KST 09:00 · 본인 세션 자동 제외
  </p>
</body>
</html>
  `.trim();

  try {
    const { error: sendError } = await resend.emails.send({
      from: `Argus <hello@${process.env.EMAIL_FROM_DOMAIN || 'argus.voyage'}>`,
      to: REPORT_EMAIL,
      subject: `[Argus] ${kstDate} — 유저 ${usersY.size} · 신규 ${signupDetails.length} · 누적 완주 ${cumulativeCompletions}`,
      html,
    });
    if (sendError) throw new Error(`Resend rejected the daily report: ${sendError.message}`);
    return NextResponse.json({
      ok: true,
      date: kstDate,
      users_yesterday: usersY.size,
      sessions_yesterday: sessionsY.size,
      anon_sessions_yesterday: anonSessionsY.size,
      signups: signupDetails.length,
      cumulative_users: cumulativeUsers,
      cumulative_projects: cumulativeProjects ?? 0,
      cumulative_completions: cumulativeCompletions,
      wow_delta: wowDelta.text,
      top_user: topUser?.email || null,
    });
  } catch (err) {
    console.error('[daily-report] email send error:', err);
    return NextResponse.json({ error: 'Failed to send report' }, { status: 500 });
  }
}
