import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import {
  classifyAnalyticsSignal,
  classifySource,
  classifyAnonSession,
  referrerHost,
  type AnonBucket,
} from '@/lib/analytics-reporting';
import { loopPulse } from '@/lib/loop-pulse';
import { distinctReturnProjects } from '@/lib/return-analytics';
import { sealCostLine, sealCostSummary } from '@/lib/seal-cost';
import { loopClosure, loopClosureLine } from '@/lib/loop-closure';
import { conversion, weeklyVerdict } from '@/lib/report-verdict';
import { summarizeAnswerReflections } from '@/lib/answer-reflection-analytics';
import { logServerEvent } from '@/lib/server-events';

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

function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

// Events that mean the visitor actually did decision work (not just browsed).
const REAL_WORK_EVENTS = new Set([
  'workspace_problem_submit',
  'first_project_created',
  'progressive_draft_promoted',
  'flow_done',
  'loop_converged',
  'decision_sealed',
  'review_completed',
  'record_connection_opened',
]);
// Subset that specifically means "reached the finish line".
const COMPLETION_EVENTS = new Set(['flow_done', 'progressive_draft_promoted', 'loop_converged']);

type SessionAgg = {
  sessionId: string;
  userId: string | null;
  events: number;
  eventNames: Set<string>;
  pages: Set<string>;
  locales: Set<string>;
  entryPage: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  visitedAdmin: boolean;
  visitedPrivacy: boolean;
  visitedTerms: boolean;
  /** Any event in the session declared itself an automated run. */
  synthetic: boolean;
  didRealWork: boolean;
  reachedWorkspace: boolean;
  completed: boolean;
  firstAt: string;
  lastAt: string;
};

/**
 * Fold an event list (ordered oldest-first) into per-session aggregates rich
 * enough to classify traffic. Works for any window whose rows carry
 * page_path / referrer / properties.
 */
function aggregateSessions(events: EventRow[]): Map<string, SessionAgg> {
  const map = new Map<string, SessionAgg>();
  for (const e of events) {
    let a = map.get(e.session_id);
    if (!a) {
      a = {
        sessionId: e.session_id,
        userId: e.user_id ?? null,
        events: 0,
        eventNames: new Set(),
        pages: new Set(),
        locales: new Set(),
        entryPage: e.page_path ?? null,
        referrer: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmContent: null,
        visitedAdmin: false,
        visitedPrivacy: false,
        visitedTerms: false,
        synthetic: false,
        didRealWork: false,
        reachedWorkspace: false,
        completed: false,
        firstAt: e.created_at,
        lastAt: e.created_at,
      };
      map.set(e.session_id, a);
    }
    a.events++;
    if ((e.properties as Record<string, unknown> | null)?.synthetic === true) a.synthetic = true;
    a.eventNames.add(e.event_name);
    if (e.user_id && !a.userId) a.userId = e.user_id;
    if (e.page_path) {
      a.pages.add(e.page_path);
      const loc = e.page_path.match(/^\/(ko|en)(?:\/|$)/);
      if (loc) a.locales.add(loc[1]);
      if (e.page_path.includes('/admin')) a.visitedAdmin = true;
      if (e.page_path.includes('/privacy')) a.visitedPrivacy = true;
      if (e.page_path.includes('/terms')) a.visitedTerms = true;
    }
    const props = e.properties || {};
    if (e.event_name === 'session_start') {
      const ir = (props.initial_referrer as string) || e.referrer || null;
      if (ir) a.referrer = ir;
      if (props.utm_source) a.utmSource = String(props.utm_source);
      if (props.utm_medium) a.utmMedium = String(props.utm_medium);
      if (props.utm_campaign) a.utmCampaign = String(props.utm_campaign);
      if (props.utm_content) a.utmContent = String(props.utm_content);
    }
    if (!a.referrer && e.referrer) a.referrer = e.referrer;
    if (e.event_name === 'workspace_enter') a.reachedWorkspace = true;
    if (REAL_WORK_EVENTS.has(e.event_name)) a.didRealWork = true;
    if (COMPLETION_EVENTS.has(e.event_name)) a.completed = true;
    if (e.created_at < a.firstAt) a.firstAt = e.created_at;
    if (e.created_at > a.lastAt) a.lastAt = e.created_at;
  }
  return map;
}

/**
 * Final bucket for a session. Logged-in non-owner = a real human by definition
 * (they authenticated). Anonymous sessions go through the shared heuristic.
 */
function bucketSession(a: SessionAgg, ownerIds: Set<string>): AnonBucket {
  // Checked before the userId branch: the signed-in e2e mode logs into the
  // dogfood account, so without this a declared machine would be counted as a
  // person the moment it authenticated.
  if (a.synthetic) return 'internal';
  if (a.userId) return ownerIds.has(a.userId) ? 'internal' : 'human';
  return classifyAnonSession({
    events: a.events,
    distinctEvents: a.eventNames.size,
    distinctPages: a.pages.size,
    referrer: a.referrer,
    utmSource: a.utmSource,
    visitedAdmin: a.visitedAdmin,
    localesTouched: a.locales.size,
    visitedLegalPair: a.visitedPrivacy && a.visitedTerms,
    synthetic: a.synthetic,
  });
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

function serverEventProjects(
  events: EventRow[],
  eventName: string,
  ownerIds: Set<string>,
  channel?: 'email' | 'telegram',
): Set<string> {
  return new Set(events
    .filter(e => (
      e.session_id === 'server'
      && e.event_name === eventName
      && (!e.user_id || !ownerIds.has(e.user_id))
      && (!channel || e.properties?.channel === channel)
    ))
    .map(e => e.properties?.project_id)
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    .map(id => `project:${id}`));
}

function intersectionSize(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const value of left) if (right.has(value)) count++;
  return count;
}

type UserRow = { id: string; email: string | null; created_at: string; user_metadata: Record<string, unknown> | null; is_anonymous: boolean };

// ───── Handler ─────

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`;
  if (!process.env.CRON_SECRET || !safeCompare(authHeader, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // A report nobody can look at without SENDING it is a report nobody iterates
  // on — which is how fifteen blocks accumulated with the load-bearing numbers
  // rendered as grey footnotes. `?preview=1` returns the same HTML, builds the
  // same way, and sends nothing.
  const preview = new URL(req.url).searchParams.get('preview') === '1';

  const missingConfig = [
    ['NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL],
    ['SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY],
    ...(preview ? [] : [['RESEND_API_KEY', process.env.RESEND_API_KEY] as [string, string | undefined]]),
    ['REPORT_EMAIL', isValidEmailAddress(REPORT_EMAIL) ? 'configured' : ''],
    ['OWNER_EMAILS', OWNER_EMAILS.length > 0 && OWNER_EMAILS.every(isValidEmailAddress) ? 'configured' : ''],
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
  const previousDay = kstRange(2);
  const twoWeeksAgo = kstRange(14);

  // ─── 1. Auth users + owner ids ───
  // Paginate — a single perPage:1000 page silently undercounts past 1000 users.
  const authUsers: { id: string; email?: string; created_at: string; user_metadata?: Record<string, unknown>; is_anonymous?: boolean }[] = [];
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
    is_anonymous: u.is_anonymous === true,
  }));
  const ownerIds = new Set(allUsers.filter(u => OWNER_EMAILS.includes((u.email || '').toLowerCase())).map(u => u.id));
  // Anonymous auth users are durable identities for logged-out voyagers, NOT
  // signups — exclude them from "가입 유저"/신규/Top-user counts. Their sessions
  // still surface as anonymous humans (their events carry user_id = null).
  const externalUsers = allUsers.filter(u => !ownerIds.has(u.id) && !u.is_anonymous);
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

  let twoWeekRaw: Record<string, unknown>[];
  try {
    // One fortnight query is enough: yesterday is a slice of the same rows.
    // The previous implementation scanned and transferred yesterday twice.
    twoWeekRaw = await loadEvents(
      'session_id, event_name, properties, user_id, page_path, referrer, created_at',
      twoWeeksAgo.start,
      yesterday.end,
    );
  } catch (err) {
    console.error('[daily-report] analytics query error:', err);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }

  const twoWeekEvents = twoWeekRaw as unknown as EventRow[];
  const yesterdayEvents = twoWeekEvents.filter(
    e => e.created_at >= yesterday.start && e.created_at <= yesterday.end,
  );

  // Owner session filter: any session that has an owner user_id event
  const ownerSessionIds = new Set<string>();
  for (const e of yesterdayEvents) if (e.session_id !== 'server' && e.user_id && ownerIds.has(e.user_id)) ownerSessionIds.add(e.session_id);
  for (const e of twoWeekEvents) if (e.session_id !== 'server' && e.user_id && ownerIds.has(e.user_id)) ownerSessionIds.add(e.session_id);

  const extYAll = yesterdayEvents.filter(e => !ownerSessionIds.has(e.session_id));
  // Server-side telemetry uses one synthetic "server" session. Keep it for the
  // error digest, but never count it as a person, session, source, or funnel hit.
  const extY = extYAll.filter(e => e.session_id !== 'server');
  const ext14 = twoWeekEvents.filter(e => !ownerSessionIds.has(e.session_id) && e.session_id !== 'server');

  // ─── 3. All-time cumulative stats ───
  const cumulativeUsers = externalUsers.length;

  const { count: cumulativeProjects } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .not('user_id', 'in', `(${[...ownerIds].map(id => `"${id}"`).join(',') || '""'})`);

  // Completions: progressive_sessions where phase=complete OR final_deliverable is set
  const { data: allProgressive } = await supabase
    .from('progressive_sessions')
    .select('project_id, user_id, phase, final_deliverable:data->>final_deliverable')
    .limit(5000);
  const cumulativeCompletions = (allProgressive || []).filter(s => {
    if (s.user_id && ownerIds.has(s.user_id)) return false;
    const phase = s.phase;
    const fd = s.final_deliverable;
    return phase === 'complete' || (fd && fd.length > 0);
  }).length;

  // ─── Did the loop close? ───
  // Not an event count. Seals and returns belong to different cohorts days or
  // weeks apart, so no ratio between them means anything; the question is
  // per-decision and lives on the contract. Owner rows are dropped for the same
  // reason they are everywhere else in this report — dogfooding is not demand.
  const { data: contractRows, error: contractError } = await supabase
    .from('projects')
    .select('user_id, decision_contract')
    .not('decision_contract', 'is', null)
    .limit(5000);
  if (contractError) {
    throw new Error(`loop closure query failed: ${contractError.message}`);
  }
  const closure = loopClosure(
    (contractRows || [])
      .filter(r => !ownerIds.has(r.user_id))
      .map(r => {
        const c = r.decision_contract as { check_in_at?: string; settled_at?: string } | null;
        return { check_in_at: c?.check_in_at ?? null, settled_at: c?.settled_at ?? null };
      }),
    Date.now(),
  );

  // Daily persistence truth comes from the product tables, not from browser
  // events. This exposes the exact "project exists, voyage backup does not"
  // gap that used to be invisible in the founder email.
  const [{ data: recentProjects, error: projectsError }, { data: recentSessions, error: sessionsError }] = await Promise.all([
    supabase
      .from('projects')
      .select('id, user_id, created_at')
      .gte('created_at', previousDay.start)
      .lte('created_at', yesterday.end)
      .limit(5000),
    supabase
      .from('progressive_sessions')
      .select('project_id, user_id, created_at')
      .gte('created_at', previousDay.start)
      .lte('created_at', yesterday.end)
      .limit(5000),
  ]);
  if (projectsError || sessionsError) {
    throw new Error(`persistence health query failed: ${projectsError?.message || sessionsError?.message}`);
  }
  const externalRecentProjects = (recentProjects || []).filter(r => !ownerIds.has(r.user_id));
  const externalRecentSessions = (recentSessions || []).filter(r => !ownerIds.has(r.user_id));
  const projectsYesterday = externalRecentProjects.filter(r => r.created_at >= yesterday.start && r.created_at <= yesterday.end);
  const projectsPrevious = externalRecentProjects.filter(r => r.created_at >= previousDay.start && r.created_at <= previousDay.end);
  const sessionsYesterday = externalRecentSessions.filter(r => r.created_at >= yesterday.start && r.created_at <= yesterday.end);
  const sessionsPrevious = externalRecentSessions.filter(r => r.created_at >= previousDay.start && r.created_at <= previousDay.end);
  const allSessionProjectIds = new Set((allProgressive || []).map(s => s.project_id).filter(Boolean));
  const projectsMissingSession = projectsYesterday.filter(p => !allSessionProjectIds.has(p.id));

  // ─── 3.5 Classify every external session: human / bot / internal ───
  // Referrer-spam crawlers and the founder's own anonymous QA sweeps used to be
  // counted as people. Bucket them once here; humans drive the top line and
  // funnel, bots/internal are quarantined into a diagnostic line.
  const aggY = aggregateSessions(extY);
  const bucketY = new Map<string, AnonBucket>();
  for (const [sid, a] of aggY) bucketY.set(sid, bucketSession(a, ownerIds));

  const humanAggY = [...aggY.values()].filter(a => bucketY.get(a.sessionId) === 'human');
  const humanSessionIds = new Set(humanAggY.map(a => a.sessionId));

  // Anonymous-only slices (no user_id), split three ways for the detail card.
  const anonAggY = [...aggY.values()].filter(a => !a.userId);
  const anonHuman = anonAggY.filter(a => bucketY.get(a.sessionId) === 'human');
  const anonBot = anonAggY.filter(a => bucketY.get(a.sessionId) === 'bot');
  const anonInternal = anonAggY.filter(a => bucketY.get(a.sessionId) === 'internal');

  const previousEvents = ext14.filter(e => e.created_at >= previousDay.start && e.created_at <= previousDay.end);
  const previousServerEvents = twoWeekEvents.filter(e => (
    e.session_id === 'server'
    && e.created_at >= previousDay.start
    && e.created_at <= previousDay.end
  ));
  const previousAgg = aggregateSessions(previousEvents);
  const humanAggPrevious = [...previousAgg.values()].filter(a => bucketSession(a, ownerIds) === 'human');
  const humanPreviousSessionIds = new Set(humanAggPrevious.map(a => a.sessionId));

  // ─── 4. Yesterday top-line (humans only) ───
  const sessionsY = humanSessionIds;
  const usersY = new Set(humanAggY.filter(a => a.userId).map(a => a.userId!));
  const anonSessionsY = new Set(anonHuman.map(a => a.sessionId));
  const submittedY = humanAggY.filter(a => a.eventNames.has('workspace_problem_submit')).length;
  const submittedPrevious = humanAggPrevious.filter(a => a.eventNames.has('workspace_problem_submit')).length;
  const completedY = humanAggY.filter(a => a.completed).length;
  const completedPrevious = humanAggPrevious.filter(a => a.completed).length;
  const sealedY = humanAggY.filter(a => a.eventNames.has('decision_sealed')).length;
  const sealedPrevious = humanAggPrevious.filter(a => a.eventNames.has('decision_sealed')).length;
  const recordConnectionsY = humanAggY.filter(a => a.eventNames.has('record_connection_opened')).length;
  const recordConnectionsPrevious = humanAggPrevious.filter(a => a.eventNames.has('record_connection_opened')).length;

  // A return can span sessions and days, so count distinct projects instead of
  // clicks. Older events without project_id fall back to one count per session.
  const returnsOpenedY = distinctReturnProjects(extY, 'return_opened', humanSessionIds);
  const returnsOpenedFromEmailY = distinctReturnProjects(
    extY.filter(e => e.properties?.source === 'email_cta'),
    'return_opened',
    humanSessionIds,
  );
  const returnsAnsweredY = new Set([
    ...distinctReturnProjects(extY, 'return_answered', humanSessionIds),
    ...serverEventProjects(yesterdayEvents, 'return_answered', ownerIds),
  ]);
  const returnsDeferredY = new Set([
    ...distinctReturnProjects(extY, 'return_deferred', humanSessionIds),
    ...serverEventProjects(yesterdayEvents, 'return_deferred', ownerIds),
  ]);
  const returnsOpenedPrevious = distinctReturnProjects(previousEvents, 'return_opened', humanPreviousSessionIds);
  const returnsAnsweredPrevious = new Set([
    ...distinctReturnProjects(previousEvents, 'return_answered', humanPreviousSessionIds),
    ...serverEventProjects(previousServerEvents, 'return_answered', ownerIds),
  ]);
  const returnsDeferredPrevious = new Set([
    ...distinctReturnProjects(previousEvents, 'return_deferred', humanPreviousSessionIds),
    ...serverEventProjects(previousServerEvents, 'return_deferred', ownerIds),
  ]);
  const emailRemindersSentY = serverEventProjects(yesterdayEvents, 'return_reminder_sent', ownerIds, 'email');
  const telegramRemindersSentY = serverEventProjects(yesterdayEvents, 'return_reminder_sent', ownerIds, 'telegram');
  const telegramAnswersY = serverEventProjects(yesterdayEvents, 'return_answered', ownerIds, 'telegram');
  const emailReturnsY = intersectionSize(emailRemindersSentY, returnsOpenedFromEmailY);
  const telegramReturnsY = intersectionSize(telegramRemindersSentY, telegramAnswersY);
  const emailReturnRateY = emailRemindersSentY.size ? Math.round((emailReturnsY / emailRemindersSentY.size) * 100) : 0;
  const telegramReturnRateY = telegramRemindersSentY.size ? Math.round((telegramReturnsY / telegramRemindersSentY.size) * 100) : 0;
  const returnProjectsTouchedY = new Set([...returnsOpenedY, ...returnsAnsweredY, ...returnsDeferredY]);
  const returnCompletionRateY = returnProjectsTouchedY.size
    ? Math.round((returnsAnsweredY.size / returnProjectsTouchedY.size) * 100)
    : 0;

  // ─── 5. 7-day trend (daily HUMAN session count) + WoW comparison ───
  // Classify the whole fortnight the same way, then count each human session
  // once on the day it started — so bot/QA spikes don't distort the trend.
  const agg14 = aggregateSessions(ext14);
  const daily: Record<string, Set<string>> = {};
  for (const a of agg14.values()) {
    if (bucketSession(a, ownerIds) !== 'human') continue;
    const date = kstDateString(new Date(a.firstAt));
    if (!daily[date]) daily[date] = new Set();
    daily[date].add(a.sessionId);
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

  // Hoisted above the verdict: a missing collector outranks every demand
  // number below it, so the verdict has to be able to see it.
  const pulse = loopPulse(yesterdayEvents.map((e) => e.event_name));

  /**
   * The day synthetic runs began declaring themselves.
   *
   * Everything written before it includes our own e2e traffic with no way to
   * separate it — 64 of 88 production sessions in the fortnight to 2026-08-05
   * were fixtures, and they sealed, so the seal rate above is inflated by them.
   * A prettier layout over polluted numbers is a more convincing wrong answer,
   * which is worse than the version that was hard to read.
   *
   * The banner retires itself: once the seven-day window starts after this
   * date, the comparison is false and nothing renders. No cleanup needed.
   */
  const SYNTHETIC_MARKING_SINCE = '2026-08-05';

  // ─── 5b. The seven-day verdict ───
  // Everything above is yesterday-vs-the-day-before. At this volume that delta
  // is noise, so the block that LEADS the email is computed over seven days
  // from data already in memory (ext14) — no extra queries.
  const thisWeekSet = new Set(thisWeek);
  const human7 = new Set<string>();
  for (const a of agg14.values()) {
    if (bucketSession(a, ownerIds) !== 'human') continue;
    if (thisWeekSet.has(kstDateString(new Date(a.firstAt)))) human7.add(a.sessionId);
  }
  const ext7 = ext14.filter(e => human7.has(e.session_id));
  const reach7 = (names: string[]) => new Set(
    ext7.filter(e => names.includes(e.event_name)).map(e => e.session_id),
  ).size;
  const entered7 = reach7(['workspace_enter', 'workspace_problem_submit']);
  const completed7 = reach7(['flow_done', 'progressive_draft_promoted', 'loop_converged']);
  const sealed7 = reach7(['decision_sealed']);
  const loginTried7 = reach7(['login_attempt']);
  const loginOk7 = reach7(['login_success']);
  const sealCost7 = sealCostSummary(ext7, human7);
  const weekStartIso = kstRange(7).start;
  const signups7 = allUsers.filter(u => !u.is_anonymous && u.created_at >= weekStartIso
    && !ownerIds.has(u.id)).length;
  const verdict = weeklyVerdict({
    sessions: human7.size,
    signups: signups7,
    completed: completed7,
    sealed: sealed7,
    due: closure.due,
    settled: closure.settled,
    undateable: closure.undateable,
    missingCrons: pulse.missing.length,
  });

  // ─── 6. Source breakdown + per-source completion (humans only) ───
  const sourceStats: Record<string, { sessions: number; completions: number }> = {};
  const campaignStats: Record<string, {
    source: string;
    medium: string;
    campaign: string;
    content: string;
    sessions: number;
    submissions: number;
    completions: number;
  }> = {};
  for (const a of humanAggY) {
    const src = classifySource(a.referrer, a.utmSource);
    if (!sourceStats[src]) sourceStats[src] = { sessions: 0, completions: 0 };
    sourceStats[src].sessions++;
    if (a.completed) sourceStats[src].completions++;
    if (a.utmSource || a.utmMedium || a.utmCampaign || a.utmContent) {
      const key = [a.utmSource || '(none)', a.utmMedium || '(none)', a.utmCampaign || '(none)', a.utmContent || '(none)'].join('\u001f');
      if (!campaignStats[key]) {
        campaignStats[key] = {
          source: a.utmSource || '(none)',
          medium: a.utmMedium || '(none)',
          campaign: a.utmCampaign || '(none)',
          content: a.utmContent || '(none)',
          sessions: 0,
          submissions: 0,
          completions: 0,
        };
      }
      campaignStats[key].sessions++;
      if (a.eventNames.has('workspace_problem_submit')) campaignStats[key].submissions++;
      if (a.completed) campaignStats[key].completions++;
    }
  }

  // ─── 7. New signups + drilldown ───
  const yStart = new Date(yesterday.start);
  const yEnd = new Date(yesterday.end);
  const newSignups = externalUsers.filter(u => {
    const created = new Date(u.created_at);
    return created >= yStart && created <= yEnd;
  });
  const previousSignups = externalUsers.filter(u => {
    const created = new Date(u.created_at);
    return created >= new Date(previousDay.start) && created <= new Date(previousDay.end);
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
  // Only real accounts (in userById) can be the week's top user — an anonymous
  // voyager's activity is real but has no identity to surface.
  const topRanked = rankedUsers.find(r => userById.has(r.uid)) ?? null;
  const topUser = topRanked ? userById.get(topRanked.uid) : null;
  const topUserActivity = topRanked;

  // ─── 9. Product-value funnel ───
  // This must describe the product people use NOW. Reframe/Recast and draft
  // generation were implementation milestones from the old workflow; counting
  // them made a healthy report possible even when nobody experienced Argus's
  // actual contract: own view → useful question → visible change → own record.
  const funnelStages = [
    { label: '상황 제출', keys: ['workspace_problem_submit'] },
    // bind_resolved includes both a captured baseline and an explicit skip;
    // the contract permits either, and the committed property separates them
    // when we need the finer cut. A silent missing baseline is not counted.
    { label: '검토 전 생각 확인', keys: ['bind_resolved'] },
    { label: '질문에 답함', keys: ['flow_answer', 'light_question_answered'] },
    { label: '변화까지 받음', keys: ['answer_reflected', 'light_seal_offered'] },
    { label: '판단 기록', keys: ['decision_sealed', 'light_seal_accepted'] },
  ];
  const funnelCounts = funnelStages.map(stage => {
    const sid = new Set(extY
      .filter(e => stage.keys.includes(e.event_name) && humanSessionIds.has(e.session_id))
      .map(e => e.session_id));
    return { label: stage.label, sessions: sid.size };
  });
  const funnelTop = funnelCounts[0].sessions || 1;
  // What the last stage COST. A conversion rate into the seal says how many
  // got there; this says how far away it was.
  // The front door, now that it can be measured at all. Until 2026-08-05
  // `login_success` did not exist, so this rate could not be computed and the
  // report showed attempts and failures with no arrival to put them against.
  const authSessions = (name: string) => new Set(extY
    .filter(e => e.event_name === name && humanSessionIds.has(e.session_id))
    .map(e => e.session_id)).size;
  const loginTried = authSessions('login_attempt');
  const loginOk = authSessions('login_success');
  const loginBad = authSessions('login_failure');
  const loginLine = loginTried === 0
    ? '정문 · 어제 로그인 시도 없음'
    : `정문 · 로그인 시도 ${loginTried} → 성공 ${loginOk} · 실패 ${loginBad}`
      + ` (${Math.round((loginOk / loginTried) * 100)}%)`;
  const answerReflections = summarizeAnswerReflections(extY, humanSessionIds);

  // ─── 10. Errors ───
  const errorBreakdown = new Map<string, number>();
  const guardrailBreakdown = new Map<string, number>();
  for (const event of extYAll) {
    const signal = classifyAnalyticsSignal(event.event_name, event.properties);
    if (signal === 'operational_error') {
      errorBreakdown.set(event.event_name, (errorBreakdown.get(event.event_name) || 0) + 1);
    } else if (signal === 'guardrail') {
      guardrailBreakdown.set(event.event_name, (guardrailBreakdown.get(event.event_name) || 0) + 1);
    }
  }
  const errorCount = [...errorBreakdown.values()].reduce((sum, count) => sum + count, 0);
  const errorSummary = [...errorBreakdown.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => `${name} ${count}`)
    .join(' · ');
  const guardrailCount = [...guardrailBreakdown.values()].reduce((sum, count) => sum + count, 0);
  const guardrailSummary = [...guardrailBreakdown.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => `${name} ${count}`)
    .join(' · ');
  const syncWriteFailures = extYAll.filter(e => e.event_name === 'sync_write_failure');

  // ─── 11. Anonymous-visit detail (finer sensor) ───
  const anonHumanCount = anonHuman.length;
  const anonHumanSources: Record<string, number> = {};
  const anonEntryPages: Record<string, number> = {};
  let anonReachedWorkspace = 0;
  let anonSubmitted = 0;
  let anonCompleted = 0;
  let anonBounced = 0;
  let anonEventsTotal = 0;
  for (const a of anonHuman) {
    const src = classifySource(a.referrer, a.utmSource);
    anonHumanSources[src] = (anonHumanSources[src] || 0) + 1;
    const entry = a.entryPage || '(unknown)';
    anonEntryPages[entry] = (anonEntryPages[entry] || 0) + 1;
    if (a.reachedWorkspace) anonReachedWorkspace++;
    if (a.eventNames.has('workspace_problem_submit')) anonSubmitted++;
    if (a.completed) anonCompleted++;
    if (a.events <= 2) anonBounced++;
    anonEventsTotal += a.events;
  }
  const anonAvgEvents = anonHumanCount ? anonEventsTotal / anonHumanCount : 0;
  const anonSourceEntries = Object.entries(anonHumanSources).sort(([, a], [, b]) => b - a).slice(0, 6);
  const anonEntryEntries = Object.entries(anonEntryPages).sort(([, a], [, b]) => b - a).slice(0, 6);
  const anonBotHosts = [...new Set(anonBot.map(a => referrerHost(a.referrer)).filter(Boolean))].slice(0, 8);

  // ─── 11.5 루프 맥박 — 어제 심장이 뛰었나 (2026-07-30) ───
  // 크론 흔적은 session_id 'server' 로 남으므로 사람 필터 전의 전체 이벤트로
  // 잰다. 빠진 크론이 있으면 메일 맨 위에 소리 내어 올린다 — 지금까지는
  // 사람이 DB를 열어봐야만 알 수 있던 사실이었다.
  logServerEvent('loop_pulse', { ok: pulse.ok, missing: pulse.missing, seen: pulse.seen.length }, { path: '/api/cron/daily-report' });

  // ───── Build HTML ─────

  const kstDate = yesterday.label;
  const sourceEntries = Object.entries(sourceStats).sort(([, a], [, b]) => b.sessions - a.sessions).slice(0, 8);
  const campaignEntries = Object.values(campaignStats).sort((a, b) => b.sessions - a.sessions).slice(0, 10);
  const trendMax = Math.max(...dailyTrend.map(d => d.sessions), 1);
  const dailyChanges = [
    { label: '사람 세션', current: sessionsY.size, previous: humanAggPrevious.length },
    { label: '상황 제출', current: submittedY, previous: submittedPrevious },
    { label: '완주', current: completedY, previous: completedPrevious },
    { label: '결정 확정', current: sealedY, previous: sealedPrevious },
    { label: '과거 기록 다시 봄', current: recordConnectionsY, previous: recordConnectionsPrevious },
    { label: '현실 확인 열림', current: returnsOpenedY.size, previous: returnsOpenedPrevious.size },
    { label: '현실 확인 답변', current: returnsAnsweredY.size, previous: returnsAnsweredPrevious.size },
    { label: '현실 확인 미룸', current: returnsDeferredY.size, previous: returnsDeferredPrevious.size },
    { label: '신규 가입', current: signupDetails.length, previous: previousSignups.length },
    { label: '서버 프로젝트', current: projectsYesterday.length, previous: projectsPrevious.length },
    { label: '서버 진행 기록', current: sessionsYesterday.length, previous: sessionsPrevious.length },
  ];

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
          <p style="color: #fff; font-size: 40px; font-weight: 800; margin: 0; letter-spacing: -0.02em; line-height: 1;">${sessionsY.size}<span style="color: rgba(255,255,255,0.5); font-size: 20px; font-weight: 600;"> 사람 세션</span></p>
        </div>
        <div>
          <p style="color: rgba(255,255,255,0.9); font-size: 28px; font-weight: 700; margin: 0; line-height: 1;">${usersY.size}<span style="color: rgba(255,255,255,0.5); font-size: 16px; font-weight: 600;"> 로그인</span></p>
        </div>
        <div>
          <p style="color: rgba(255,255,255,0.9); font-size: 28px; font-weight: 700; margin: 0; line-height: 1;">${signupDetails.length}<span style="color: rgba(255,255,255,0.5); font-size: 16px; font-weight: 600;"> 신규</span></p>
        </div>
      </div>
      <p style="color: rgba(255,255,255,0.75); font-size: 13px; margin: 16px 0 0;">
        <span style="color: ${yesterdayVsWeekAvg.color === C.growth ? '#86efac' : yesterdayVsWeekAvg.color === C.decline ? '#fca5a5' : 'rgba(255,255,255,0.6)'}; font-weight: 700;">${yesterdayVsWeekAvg.arrow}${yesterdayVsWeekAvg.text}</span>
        <span style="color: rgba(255,255,255,0.6);"> 지난 7일 평균 사람 세션 대비</span>
      </p>
      <p style="color: rgba(255,255,255,0.55); font-size: 11px; margin: 8px 0 0;">
        이 중 익명 사람 ${anonHuman.length} · 로그인 ${usersY.size} · <span style="color: rgba(255,255,255,0.4);">봇 ${anonBot.length} · 내부/QA ${anonInternal.length} 제외됨</span>
      </p>
    </td></tr>
  </table>

  <!-- ════════ THE WEEK, AND WHAT IT SAYS ════════
       The email's fifteen blocks are almost all yesterday-vs-the-day-before,
       which at this volume is noise wearing a percentage. This one is seven
       days, and it carries the four numbers that actually decide the product —
       each of which used to be 11px grey text underneath something else. -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.card}; border: 2px solid ${verdict.stage === 'broken' ? C.decline : C.primary}; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 20px;">
      <p style="font-size: 10px; font-weight: 800; color: ${verdict.stage === 'broken' ? C.decline : C.primary}; margin: 0 0 6px; letter-spacing: 0.12em; text-transform: uppercase;">지난 7일 · 지금 사실인 것</p>
      ${thisWeek[0] < SYNTHETIC_MARKING_SINCE ? `<p style="font-size: 11px; line-height: 1.5; color: ${C.decline}; background: ${C.declineBg}; border-radius: 8px; padding: 8px 10px; margin: 0 0 12px; font-weight: 700;">이 창에는 ${SYNTHETIC_MARKING_SINCE} 이전의 자동 실행(E2E)이 섞여 있습니다 — 봉인·완주 숫자는 부풀려져 있습니다. 표식 이후 데이터만으로 채워지면 이 줄은 저절로 사라집니다.</p>` : ''}
      <p style="font-size: 15px; line-height: 1.5; font-weight: 750; color: ${C.text}; margin: 0 0 16px;">${escHtml(verdict.headline)}</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 12px;">
        <tr style="border-top: 1px solid ${C.borderSubtle};">
          <td style="padding: 9px 0; color: ${C.muted}; width: 92px;">왔나</td>
          <td style="padding: 9px 0; color: ${C.text}; font-weight: 700;">사람 세션 ${human7.size} · 가입 ${signups7}</td>
        </tr>
        <tr style="border-top: 1px solid ${C.borderSubtle};">
          <td style="padding: 9px 0; color: ${C.muted};">정문</td>
          <td style="padding: 9px 0; color: ${C.text}; font-weight: 700;">로그인 ${escHtml(conversion(loginTried7, loginOk7))}</td>
        </tr>
        <tr style="border-top: 1px solid ${C.borderSubtle};">
          <td style="padding: 9px 0; color: ${C.muted};">깊은 길</td>
          <td style="padding: 9px 0; color: ${C.text}; font-weight: 700;">입장 ${entered7} → 완주 ${escHtml(conversion(entered7, completed7))} → 봉인 ${escHtml(conversion(completed7, sealed7))}</td>
        </tr>
        <tr style="border-top: 1px solid ${C.borderSubtle};">
          <td style="padding: 9px 0; color: ${C.muted};">봉인 비용</td>
          <td style="padding: 9px 0; color: ${C.text}; font-weight: 700;">${escHtml(sealCostLine(sealCost7))}</td>
        </tr>
        <tr style="border-top: 1px solid ${C.borderSubtle};">
          <td style="padding: 9px 0; color: ${C.muted};">고리</td>
          <td style="padding: 9px 0; color: ${C.text}; font-weight: 700;">${escHtml(loopClosureLine(closure))}</td>
        </tr>
      </table>
      <p style="font-size: 10px; color: ${C.faint}; margin: 12px 0 0;">7일 창 · 사람으로 분류한 세션만 · 자동 실행(synthetic) 제외 · 고리는 누적</p>
    </td></tr>
  </table>

  <!-- ════════ LOOP PULSE ════════ -->
  ${pulse.ok
    ? `<p style="font-size: 11px; color: ${C.faint}; margin: 0 0 16px; text-align: center;">루프 맥박 정상 — 어제 크론 ${pulse.seen.length}/${pulse.seen.length}개 실행 흔적 확인</p>`
    : `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.declineBg}; border: 1px solid ${C.decline}; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 16px 20px;">
      <p style="font-size: 12px; font-weight: 800; color: ${C.decline}; margin: 0 0 6px;">루프 맥박 이상 — 어제 실행 흔적이 없는 크론 ${pulse.missing.length}개</p>
      <p style="font-size: 12px; color: ${C.text}; margin: 0;">${pulse.missing.map(escHtml).join(' · ')}</p>
      <p style="font-size: 11px; color: ${C.muted}; margin: 6px 0 0;">흔적은 꺼짐(disabled)이어도 남습니다 — 흔적 없음은 실행 자체가 없었다는 뜻입니다. Vercel Crons 상태를 확인하세요.</p>
    </td></tr>
  </table>`}

  <!-- ════════ DAILY CHANGE ════════ -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 20px;">
      <p style="font-size: 10px; font-weight: 800; color: ${C.primary}; margin: 0 0 4px; letter-spacing: 0.12em; text-transform: uppercase;">어제의 변화</p>
      <p style="font-size: 12px; color: ${C.muted}; margin: 0 0 14px;">${previousDay.label}와 비교 · 사람으로 분류한 세션 기준</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 12px;">
        ${dailyChanges.map((item) => {
          const d = deltaLabel(item.current, item.previous);
          return `<tr style="border-top: 1px solid ${C.borderSubtle};">
            <td style="padding: 9px 0; color: ${C.text}; font-weight: 650;">${item.label}</td>
            <td style="padding: 9px 8px; text-align: right; color: ${C.faint};">${item.previous}</td>
            <td style="padding: 9px 8px; text-align: right; color: ${C.text}; font-size: 15px; font-weight: 800;">${item.current}</td>
            <td style="padding: 9px 0; width: 72px; text-align: right; color: ${d.color}; font-weight: 750;">${d.arrow} ${d.text}</td>
          </tr>`;
        }).join('')}
      </table>
      <p style="font-size: 10px; color: ${C.faint}; margin: 10px 0 0; text-align: right;">전일 → 어제 → 증감</p>
    </td></tr>
  </table>

  <!-- ════════ RETURN LOOP ════════ -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.primaryLight}; border: 1px solid #bfdbfe; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 20px;">
      <p style="font-size: 10px; font-weight: 800; color: ${C.primary}; margin: 0 0 4px; letter-spacing: 0.12em; text-transform: uppercase;">판단 귀환 · 어제</p>
      <p style="font-size: 12px; color: ${C.muted}; margin: 0 0 12px;">예전에 남긴 판단을 다시 열어 현실과 대조한 프로젝트입니다.</p>
      <!-- Loop closure — per-decision and cumulative, not an event count.
           Everything else in this block is "yesterday"; this is the only line
           that says whether a sealed decision ever gets answered at all. -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.card}; border: 1px solid #bfdbfe; border-radius: 10px; margin-bottom: 16px;">
        <tr>
          <td style="padding: 11px 12px; font-size: 11px; color: ${C.text}; font-weight: 700;">이메일</td>
          <td style="padding: 11px 8px; font-size: 11px; color: ${C.muted}; text-align: right;">발송 ${emailRemindersSentY.size}</td>
          <td style="padding: 11px 8px; font-size: 11px; color: ${C.text}; text-align: right;">→ 열림 ${emailReturnsY}</td>
          <td style="padding: 11px 12px; font-size: 12px; color: ${C.primary}; font-weight: 800; text-align: right;">${emailReturnRateY}%</td>
        </tr>
        <tr>
          <td style="padding: 11px 12px; font-size: 11px; color: ${C.text}; font-weight: 700; border-top: 1px solid ${C.borderSubtle};">Telegram</td>
          <td style="padding: 11px 8px; font-size: 11px; color: ${C.muted}; text-align: right; border-top: 1px solid ${C.borderSubtle};">발송 ${telegramRemindersSentY.size}</td>
          <td style="padding: 11px 8px; font-size: 11px; color: ${C.text}; text-align: right; border-top: 1px solid ${C.borderSubtle};">→ 답변 ${telegramReturnsY}</td>
          <td style="padding: 11px 12px; font-size: 12px; color: ${C.primary}; font-weight: 800; text-align: right; border-top: 1px solid ${C.borderSubtle};">${telegramReturnRateY}%</td>
        </tr>
      </table>
      <p style="font-size: 10px; color: ${C.faint}; margin: -8px 0 14px;">같은 날 발송한 프로젝트만 연결한 전환 · 내부 계정 제외</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="width: 25%; text-align: center;"><p style="font-size: 25px; font-weight: 800; color: ${C.text}; margin: 0;">${returnsOpenedY.size}</p><p style="font-size: 10px; color: ${C.muted}; margin: 3px 0 0;">열어봄</p></td>
          <td style="width: 25%; text-align: center; border-left: 1px solid #bfdbfe;"><p style="font-size: 25px; font-weight: 800; color: ${C.growth}; margin: 0;">${returnsAnsweredY.size}</p><p style="font-size: 10px; color: ${C.muted}; margin: 3px 0 0;">답함</p></td>
          <td style="width: 25%; text-align: center; border-left: 1px solid #bfdbfe;"><p style="font-size: 25px; font-weight: 800; color: ${C.warm}; margin: 0;">${returnsDeferredY.size}</p><p style="font-size: 10px; color: ${C.muted}; margin: 3px 0 0;">다음으로 미룸</p></td>
          <td style="width: 25%; text-align: center; border-left: 1px solid #bfdbfe;"><p style="font-size: 25px; font-weight: 800; color: ${C.primary}; margin: 0;">${returnCompletionRateY}%</p><p style="font-size: 10px; color: ${C.muted}; margin: 3px 0 0;">확인 완료율</p></td>
        </tr>
      </table>
      <p style="font-size: 10px; color: ${C.faint}; margin: 12px 0 0;">프로젝트 기준 중복 제거 · 확인 완료율 = 답한 프로젝트 ÷ 어제 귀환 활동이 있었던 프로젝트</p>
    </td></tr>
  </table>

  <!-- ════════ PERSISTENCE HEALTH ════════ -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${projectsMissingSession.length > 0 || syncWriteFailures.length > 0 ? C.declineBg : C.growthBg}; border: 1px solid ${projectsMissingSession.length > 0 || syncWriteFailures.length > 0 ? '#fecaca' : '#a7f3d0'}; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 18px 20px;">
      <p style="font-size: 10px; font-weight: 800; color: ${projectsMissingSession.length > 0 || syncWriteFailures.length > 0 ? C.decline : C.growth}; margin: 0 0 10px; letter-spacing: 0.12em; text-transform: uppercase;">서버 저장 건전성 · 어제</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="width: 25%; text-align: center;"><p style="font-size: 24px; font-weight: 800; margin: 0;">${projectsYesterday.length}</p><p style="font-size: 10px; color: ${C.muted}; margin: 3px 0 0;">프로젝트</p></td>
          <td style="width: 25%; text-align: center;"><p style="font-size: 24px; font-weight: 800; margin: 0;">${sessionsYesterday.length}</p><p style="font-size: 10px; color: ${C.muted}; margin: 3px 0 0;">진행 기록</p></td>
          <td style="width: 25%; text-align: center;"><p style="font-size: 24px; font-weight: 800; color: ${projectsMissingSession.length > 0 ? C.decline : C.growth}; margin: 0;">${projectsMissingSession.length}</p><p style="font-size: 10px; color: ${C.muted}; margin: 3px 0 0;">짝 없는 프로젝트</p></td>
          <td style="width: 25%; text-align: center;"><p style="font-size: 24px; font-weight: 800; color: ${syncWriteFailures.length > 0 ? C.decline : C.growth}; margin: 0;">${syncWriteFailures.length}</p><p style="font-size: 10px; color: ${C.muted}; margin: 3px 0 0;">감지된 쓰기 실패</p></td>
        </tr>
      </table>
      <p style="font-size: 10px; color: ${C.muted}; margin: 12px 0 0; line-height: 1.5;">프로젝트와 진행 기록은 Supabase 행을 직접 확인합니다. 쓰기 실패 수집은 이 배포 이후 발생분부터 집계됩니다.</p>
    </td></tr>
  </table>

  <!-- ════════ CUMULATIVE (SECONDARY) ════════ -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 20px;">
      <p style="font-size: 10px; font-weight: 700; color: ${C.faint}; margin: 0 0 14px; letter-spacing: 0.12em; text-transform: uppercase;">참고 · 전체 누적</p>
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

  <!-- ════════ ANONYMOUS DETAIL ════════ -->
  ${anonAggY.length > 0 ? `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 20px;">
      <p style="font-size: 10px; font-weight: 700; color: ${C.faint}; margin: 0 0 14px; letter-spacing: 0.12em; text-transform: uppercase;">익명 방문 상세 · 어제</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td style="width: 33.33%; text-align: center; padding: 0 8px;">
            <p style="font-size: 30px; font-weight: 800; color: ${C.primary}; margin: 0; letter-spacing: -0.02em;">${anonHumanCount}</p>
            <p style="font-size: 11px; color: ${C.muted}; margin: 4px 0 0; font-weight: 600;">사람 (추정)</p>
          </td>
          <td style="width: 33.33%; text-align: center; padding: 0 8px; border-left: 1px solid ${C.borderSubtle}; border-right: 1px solid ${C.borderSubtle};">
            <p style="font-size: 30px; font-weight: 800; color: ${C.faint}; margin: 0; letter-spacing: -0.02em;">${anonBot.length}</p>
            <p style="font-size: 11px; color: ${C.muted}; margin: 4px 0 0; font-weight: 600;">봇 / 스팸</p>
          </td>
          <td style="width: 33.33%; text-align: center; padding: 0 8px;">
            <p style="font-size: 30px; font-weight: 800; color: ${C.faint}; margin: 0; letter-spacing: -0.02em;">${anonInternal.length}</p>
            <p style="font-size: 11px; color: ${C.muted}; margin: 4px 0 0; font-weight: 600;">내부 / QA</p>
          </td>
        </tr>
      </table>
      ${anonHumanCount > 0 ? `
      <div style="margin-top: 16px; padding: 12px 14px; background: ${C.borderSubtle}; border-radius: 10px;">
        <p style="font-size: 12px; color: ${C.text}; margin: 0; line-height: 1.7;">
          <strong>익명 사람 참여</strong> · 워크스페이스 진입 <strong>${anonReachedWorkspace}</strong>
          · 문제 제출 <strong>${anonSubmitted}</strong>
          · 완주 <strong style="color: ${anonCompleted > 0 ? C.growth : C.text};">${anonCompleted}</strong>
          · 바운스 <strong>${anonBounced}</strong>
          · 평균 <strong>${anonAvgEvents.toFixed(1)}</strong> 이벤트
        </p>
      </div>
      ${anonSourceEntries.length > 0 ? `
      <p style="font-size: 10px; font-weight: 700; color: ${C.faint}; margin: 16px 0 6px; letter-spacing: 0.1em; text-transform: uppercase;">유입 소스 (익명 사람)</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 12px;">
        ${anonSourceEntries.map(([src, n]) => `<tr style="border-top: 1px solid ${C.borderSubtle};">
          <td style="padding: 6px 0; font-weight: 600; color: ${src === 'Bot/Spam' || src === 'Internal' || src === 'Google OAuth' ? C.faint : C.text};">${escHtml(src)}</td>
          <td style="padding: 6px 0; text-align: right; color: ${C.muted};">${n}</td>
        </tr>`).join('')}
      </table>` : ''}
      ${anonEntryEntries.length > 0 ? `
      <p style="font-size: 10px; font-weight: 700; color: ${C.faint}; margin: 16px 0 6px; letter-spacing: 0.1em; text-transform: uppercase;">진입 페이지 (익명 사람)</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 12px;">
        ${anonEntryEntries.map(([pg, n]) => `<tr style="border-top: 1px solid ${C.borderSubtle};">
          <td style="padding: 6px 0; font-family: 'SF Mono', Menlo, monospace; font-size: 11px; color: ${C.muted};">${escHtml(pg)}</td>
          <td style="padding: 6px 0; text-align: right; color: ${C.muted};">${n}</td>
        </tr>`).join('')}
      </table>` : ''}
      ` : `<p style="font-size: 12px; color: ${C.faint}; margin: 14px 0 0;">어제 익명 사람 세션은 없었습니다.</p>`}
      ${anonBotHosts.length > 0 ? `<p style="font-size: 11px; color: ${C.faint}; margin: 14px 0 0;">봇 리퍼러: ${anonBotHosts.map(h => escHtml(h)).join(' · ')}</p>` : ''}
      <p style="font-size: 10px; color: ${C.faint}; margin: 12px 0 0; line-height: 1.5;">봇 = 알려진 리퍼러 스팸 도메인. 내부/QA = localhost·/admin·다중 로케일·전 페이지 훑기 등 개발/합성 시그니처. 사람 수치에서 제외됨.</p>
    </td></tr>
  </table>` : ''}

  <!-- ════════ NEW SIGNUPS ════════ -->
  ${signupDetails.length > 0 ? `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 20px;">
      <p style="font-size: 10px; font-weight: 700; color: ${C.faint}; margin: 0 0 12px; letter-spacing: 0.12em; text-transform: uppercase;">신규 가입자 · 어제의 여정</p>
      ${signupDetails.map(s => `
      <div style="background: ${C.bg}; padding: 10px 14px; border-radius: 10px; margin-bottom: 14px;">
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

  <!-- ════════ PRODUCT-VALUE FUNNEL (visual bars) ════════ -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 20px;">
      <p style="font-size: 10px; font-weight: 700; color: ${C.faint}; margin: 0 0 4px; letter-spacing: 0.12em; text-transform: uppercase;">첫 가치 깔때기 · 어제 세션 기준</p>
      <p style="font-size: 11px; color: ${C.muted}; margin: 0 0 14px;">상황을 낸 뒤, 자기 생각과 질문을 거쳐 실제 판단 기록까지 간 사람</p>
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
      <p style="font-size: 10px; color: ${C.faint}; margin: 10px 0 0;">바 길이는 상황 제출 대비 %, 우측은 직전 단계에서의 이탈률 (빨강: 50% 이상 이탈) · 가벼운 길과 깊은 길의 동등한 순간을 함께 셈</p>
      <p style="font-size: 11px; color: ${C.muted}; margin: 4px 0 0; font-weight: 600;">${escHtml(loginLine)}</p>
    </td></tr>
  </table>

  ${answerReflections.total > 0 ? `
  <!-- ════════ QUESTION VALUE ════════ -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 18px 20px;">
      <p style="font-size: 10px; font-weight: 700; color: ${C.faint}; margin: 0 0 10px; letter-spacing: 0.12em; text-transform: uppercase;">질문이 실제로 한 일</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
        <td style="padding-right: 8px;"><p style="font-size: 24px; font-weight: 800; color: ${answerReflections.movedRate >= 60 ? C.growth : C.warm}; margin: 0;">${answerReflections.movedRate}%</p><p style="font-size: 11px; color: ${C.muted}; margin: 3px 0 0;">판단 상태를 움직임 · ${answerReflections.moved}/${answerReflections.total}</p></td>
        <td style="padding: 0 8px; text-align: center;"><p style="font-size: 20px; font-weight: 800; color: ${answerReflections.unchanged > 0 ? C.warm : C.text}; margin: 0;">${answerReflections.unchanged}</p><p style="font-size: 11px; color: ${C.muted}; margin: 3px 0 0;">변화 없음</p></td>
        <td style="padding-left: 8px; text-align: right;"><p style="font-size: 16px; font-weight: 800; color: ${C.text}; margin: 0;">${answerReflections.p50Ms === null ? '—' : `${(answerReflections.p50Ms / 1000).toFixed(1)}초`} / ${answerReflections.p95Ms === null ? '—' : `${(answerReflections.p95Ms / 1000).toFixed(1)}초`}</p><p style="font-size: 11px; color: ${C.muted}; margin: 3px 0 0;">반영 p50 / p95</p></td>
      </tr></table>
      <p style="font-size: 10px; color: ${C.faint}; margin: 10px 0 0;">문구만 바뀐 전제는 변화로 세지 않음 · 사용자 원문은 수집하지 않음</p>
    </td></tr>
  </table>` : ''}

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

  <!-- ════════ UTM CAMPAIGNS ════════ -->
  ${campaignEntries.length > 0 ? `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.card}; border: 1px solid ${C.border}; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 20px;">
      <p style="font-size: 10px; font-weight: 700; color: ${C.faint}; margin: 0 0 4px; letter-spacing: 0.12em; text-transform: uppercase;">UTM 캠페인 · 어제</p>
      <p style="font-size: 11px; color: ${C.muted}; margin: 0 0 12px;">소스 / 매체 / 캠페인 / 콘텐츠별 실제 전환</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 11px;">
        <tr style="color: ${C.faint}; font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em;">
          <td style="padding: 4px 0; font-weight: 700;">경로</td>
          <td style="padding: 4px 5px; text-align: right; font-weight: 700;">세션</td>
          <td style="padding: 4px 5px; text-align: right; font-weight: 700;">제출</td>
          <td style="padding: 4px 0; text-align: right; font-weight: 700;">완주</td>
        </tr>
        ${campaignEntries.map((c) => `<tr style="border-top: 1px solid ${C.borderSubtle};">
          <td style="padding: 8px 8px 8px 0; line-height: 1.45;">
            <strong style="color: ${C.text};">${escHtml(c.source)}</strong>
            <span style="color: ${C.faint};"> / ${escHtml(c.medium)}</span><br>
            <span style="color: ${C.muted};">${escHtml(c.campaign)} · ${escHtml(c.content)}</span>
          </td>
          <td style="padding: 8px 5px; text-align: right;">${c.sessions}</td>
          <td style="padding: 8px 5px; text-align: right; font-weight: 700;">${c.submissions}</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 800; color: ${c.completions > 0 ? C.growth : C.faint};">${c.completions}</td>
        </tr>`).join('')}
      </table>
    </td></tr>
  </table>` : `
  <p style="font-size: 11px; color: ${C.faint}; margin: 0 0 16px; text-align: center;">어제 UTM이 붙은 사람 세션은 없었습니다. 홍보 링크에 UTM을 붙여야 캠페인별로 나뉩니다.</p>`}

  <!-- ════════ ERRORS ════════ -->
  ${errorCount > 0 ? `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.declineBg}; border: 1px solid #fecaca; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 16px 20px;">
      <p style="font-size: 14px; color: ${C.decline}; margin: 0 0 4px; font-weight: 700;">에러 ${errorCount}건</p>
      <p style="font-size: 12px; color: ${C.muted}; margin: 0;">${escHtml(errorSummary)}</p>
    </td></tr>
  </table>` : ''}

  ${guardrailCount > 0 ? `
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${C.warmBg}; border: 1px solid #fde68a; border-radius: 14px; margin-bottom: 16px;">
    <tr><td style="padding: 16px 20px;">
      <p style="font-size: 14px; color: ${C.warm}; margin: 0 0 4px; font-weight: 700;">정상 보호 동작 ${guardrailCount}건</p>
      <p style="font-size: 12px; color: ${C.muted}; margin: 0;">${escHtml(guardrailSummary)}</p>
    </td></tr>
  </table>` : ''}

  <p style="font-size: 10px; color: ${C.faint}; text-align: center; margin: 20px 0 8px;">
    Argus Daily · KST 09:00 · 본인 세션 자동 제외
  </p>
</body>
</html>
  `.trim();

  if (preview) {
    // Same HTML, same build path, no delivery. The alternative — reading the
    // template in source — is how a block ends up 11px grey and nobody notices.
    return new NextResponse(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  }

  try {
    const { error: sendError } = await resend.emails.send({
      from: `Argus <hello@${process.env.EMAIL_FROM_DOMAIN || 'argus.voyage'}>`,
      to: REPORT_EMAIL,
      subject: `[Argus] ${kstDate} — ${verdict.headline.slice(0, 46)}`,
      html,
    });
    if (sendError) throw new Error(`Resend rejected the daily report: ${sendError.message}`);
    return NextResponse.json({
      ok: true,
      date: kstDate,
      users_yesterday: usersY.size,
      sessions_yesterday: sessionsY.size,
      anon_sessions_yesterday: anonSessionsY.size,
      anon_human_yesterday: anonHuman.length,
      anon_bot_yesterday: anonBot.length,
      anon_internal_yesterday: anonInternal.length,
      signups: signupDetails.length,
      cumulative_users: cumulativeUsers,
      cumulative_projects: cumulativeProjects ?? 0,
      cumulative_completions: cumulativeCompletions,
      projects_yesterday: projectsYesterday.length,
      progressive_sessions_yesterday: sessionsYesterday.length,
      returns_opened_yesterday: returnsOpenedY.size,
      returns_answered_yesterday: returnsAnsweredY.size,
      returns_deferred_yesterday: returnsDeferredY.size,
      return_completion_rate_yesterday: returnCompletionRateY,
      // Cumulative and per-decision. `loop_closure_rate` is null when nothing
      // has come due — a rate that was never measured must not read as zero.
      loop_closure_due: closure.due,
      loop_closure_settled: closure.settled,
      loop_closure_rate: closure.rate,
      loop_closure_still_open: closure.stillOpen,
      loop_closure_undateable: closure.undateable,
      login_attempts_yesterday: loginTried,
      login_success_yesterday: loginOk,
      login_failures_yesterday: loginBad,
      week_sessions: human7.size,
      week_signups: signups7,
      week_entered: entered7,
      week_completed: completed7,
      week_sealed: sealed7,
      week_login_attempts: loginTried7,
      week_login_success: loginOk7,
      verdict_stage: verdict.stage,
      verdict: verdict.headline,
      email_reminders_sent_yesterday: emailRemindersSentY.size,
      email_returns_yesterday: emailReturnsY,
      telegram_reminders_sent_yesterday: telegramRemindersSentY.size,
      telegram_returns_yesterday: telegramReturnsY,
      projects_missing_session: projectsMissingSession.length,
      sync_write_failures: syncWriteFailures.length,
      campaigns: campaignEntries.length,
      wow_delta: wowDelta.text,
      top_user: topUser?.email || null,
    });
  } catch (err) {
    console.error('[daily-report] email send error:', err);
    return NextResponse.json({ error: 'Failed to send report' }, { status: 500 });
  }
}
