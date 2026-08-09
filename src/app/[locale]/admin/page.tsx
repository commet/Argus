'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useLocale } from '@/hooks/useLocale';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { ChevronDown, Compass, RefreshCw } from 'lucide-react';

interface Metrics {
  generated_at: string;
  users_total: number;
  anonymous_users_total?: number;
  users_with_projects: number;
  anonymous_users_with_projects?: number;
  signups_7d: number;
  signups_30d: number;
  projects_total: number;
  projects_sealed: number;
  projects_settled: number;
  projects_7d: number;
  projects_30d: number;
  latest_project: string | null;
  return_loop: {
    sealed_total: number;
    sealed_anon: number;
    sealed_auth: number;
    seal_declined: number;
    settled_total: number;
    settled_anon: number;
    settled_auth: number;
    sessions_sealed: number;
    sessions_settled: number;
    sealed_7d: number;
    settled_7d: number;
    plugin_sealed?: number;
    plugin_settled?: number;
    verdicts: Record<string, number>;
  } | null;
  surface_funnel?: Record<'web' | 'mcp' | 'plugin', FunnelStageCounts>;
  storage_health?: {
    anonymous_projects: number;
    anonymous_sessions: number;
    anonymous_projects_missing_session: number;
    sync_failures_24h: number;
    sync_failures_7d: number;
  };
  /** LLM health (2026-07-31 truncation sensor). Optional: an older cached RPC
   *  result simply hides the section. */
  llm?: {
    truncation_7d: number;
    truncation_24h: number;
    stream_retry_7d: number;
    errors_7d: number;
    calls_7d: number;
    cache_read_7d: number;
    cache_write_7d: number;
  };
  tables: Record<string, number>;
}

interface FunnelStageCounts {
  opened: number;
  sealed: number;
  returned: number;
  settled: number;
}

function Stat({ label, value, hint, accent }: { label: string; value: number | string; hint?: string; accent?: boolean }) {
  return (
    <Card variant={accent ? 'elevated' : 'default'} className="!p-4">
      <p className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</p>
      <p className={`mt-1 text-[28px] font-bold leading-none ${accent ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{value}</p>
      {hint && <p className="mt-1 text-[12.5px] text-[var(--text-tertiary)]">{hint}</p>}
    </Card>
  );
}

function SurfaceFunnel({ rows, L }: { rows: Record<'web' | 'mcp' | 'plugin', FunnelStageCounts>; L: (ko: string, en: string) => string }) {
  const surfaces: Array<{ key: 'web' | 'mcp' | 'plugin'; label: string; hint: string }> = [
    { key: 'web', label: L('웹', 'Web'), hint: L('항구·이메일 귀환', 'harbor/email returns') },
    { key: 'mcp', label: 'MCP', hint: L('review_receipts mcp_file', 'review_receipts mcp_file') },
    { key: 'plugin', label: L('플러그인', 'Plugin'), hint: 'plugin_decisions' },
  ];
  const stages: Array<{ key: keyof FunnelStageCounts; label: string }> = [
    { key: 'opened', label: L('열어봄', 'Opened') },
    { key: 'sealed', label: L('결정 기록', 'Decision recorded') },
    { key: 'returned', label: L('다시 방문', 'Returned') },
    { key: 'settled', label: L('결과 확인', 'Outcome recorded') },
  ];

  return (
    <div className="mb-6 overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
      <table className="w-full min-w-[560px] text-left">
        <thead>
          <tr className="border-b border-[var(--border-subtle)]">
            <th className="px-3 py-2 text-[12.5px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{L('표면', 'Surface')}</th>
            {stages.map((s) => (
              <th key={s.key} className="px-3 py-2 text-[12.5px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {surfaces.map((surface) => {
            const counts = rows[surface.key] || { opened: 0, sealed: 0, returned: 0, settled: 0 };
            return (
              <tr key={surface.key} className="border-b border-[var(--border-subtle)] last:border-b-0">
                <td className="px-3 py-3">
                  <p className="text-[13px] font-semibold text-[var(--text-primary)]">{surface.label}</p>
                  <p className="text-[12.5px] text-[var(--text-tertiary)]">{surface.hint}</p>
                </td>
                {stages.map((s) => (
                  <td key={s.key} className="px-3 py-3 text-[18px] font-bold tabular-nums text-[var(--text-primary)]">{counts[s.key] ?? 0}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const { user, loading: authLoading } = useAuth();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<'forbidden' | 'other' | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('argus_metrics');
    if (error) setError(error.message?.includes('not authorized') ? 'forbidden' : 'other');
    else setMetrics(data as Metrics);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (authLoading) return null;
  if (!user || error === 'forbidden') {
    return (
      <div className="max-w-xl mx-auto px-6 py-20 text-center">
        <p className="text-[14px] text-[var(--text-secondary)]">{L('이 페이지는 운영자 전용입니다.', 'This page is for the operator only.')}</p>
      </div>
    );
  }

  const fmtDate = (s: string | null) => (s ? new Date(s).toISOString().slice(0, 10) : '—');
  const outcomeLabels: Record<string, string> = {
    happened: L('예상한 일이 일어남', 'Expected event happened'),
    partial: L('일부만 일어남', 'Partly happened'),
    avoided: L('피하려던 일을 피함', 'Avoided the unwanted event'),
    condition_met: L('기준을 충족함', 'Standard met'),
    condition_not_met: L('기준을 충족하지 못함', 'Standard not met'),
    mixed: L('결과가 엇갈림', 'Mixed outcome'),
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{L('운영 현황', 'Operations')}</h1>
          {metrics && (
            <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">
              {L('기준', 'as of')} {new Date(metrics.generated_at).toLocaleString()}
            </p>
          )}
        </div>
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-1.5 py-2 px-2 -mx-2 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{L('새로고침', 'Refresh')}
        </button>
      </div>

      {error === 'other' && (
        <p className="text-[13px] text-[var(--danger)] mb-4">{L('불러오기 실패. 새로고침 해보세요.', 'Failed to load. Try refresh.')}</p>
      )}

      {metrics && (
        <>
          <h2 className="mb-2 text-[12px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
            {L('전체 흐름', 'Overall journey')}
          </h2>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={L('가입 계정', 'Registered accounts')} value={metrics.users_total} hint={`+${metrics.signups_7d} ${L('최근 7일', 'last 7d')}`} />
            <Stat label={L('프로젝트를 시작한 계정', 'Accounts that started a project')} value={metrics.users_with_projects} />
            <Stat label={L('결정을 기록한 프로젝트', 'Projects with a recorded decision')} value={metrics.projects_sealed} accent />
            <Stat label={L('결과를 확인한 프로젝트', 'Projects with a recorded outcome')} value={metrics.projects_settled} accent />
          </div>

          <h2 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">{L('프로젝트 진행', 'Project activity')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
            <Stat label={L('전체 프로젝트', 'All projects')} value={metrics.projects_total} />
            <Stat label={L('최근 7일 시작', 'Started in 7d')} value={metrics.projects_7d} />
            <Stat label={L('최근 30일 시작', 'Started in 30d')} value={metrics.projects_30d} />
            <Stat label={L('최근 프로젝트', 'Latest project')} value={fmtDate(metrics.latest_project)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <Stat label={L('익명 사용자', 'Anonymous users')} value={metrics.anonymous_users_total ?? 0} hint={`${L('프로젝트 보유', 'with project')} ${metrics.anonymous_users_with_projects ?? 0}`} />
            <Stat label={L('결정 기록 · 계정 기준', 'Decisions · accounts')} value={metrics.projects_sealed} />
            <Stat label={L('결과 확인 · 계정 기준', 'Outcomes · accounts')} value={metrics.projects_settled} />
            <Stat label={L('플러그인 결정', 'Plugin decisions')} value={metrics.tables.plugin_decisions ?? 0} />
          </div>

          {metrics.return_loop && (() => {
            const r = metrics.return_loop!;
            const verdictPairs = Object.entries(r.verdicts || {}).filter(([k]) => k !== '(none)');
            return (
              <>
                <h2 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 mt-2">
                  {L('결정 이후 확인 흐름 · 행동 기록 기준', 'After-decision follow-up · based on activity records')}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                  <Stat label={L('봉인 (seal)', 'Sealed')} value={r.sealed_total} accent
                    hint={`${L('익명', 'anon')} ${r.sealed_anon} · ${L('로그인', 'auth')} ${r.sealed_auth} · +${r.sealed_7d} ${L('7일', '7d')}`} />
                  <Stat label={L('봉인 포기', 'Seal declined')} value={r.seal_declined} />
                  <Stat label={L('정산 (settle)', 'Settled')} value={r.settled_total} accent
                    hint={`${L('익명', 'anon')} ${r.settled_anon} · ${L('로그인', 'auth')} ${r.settled_auth} · +${r.settled_7d} ${L('7일', '7d')}`} />
                  <Stat label={L('정산한 세션', 'Sessions settled')} value={r.sessions_settled}
                    hint={`${L('봉인 세션', 'sealed sess')} ${r.sessions_sealed}`} />
                </div>

                {/* Plugin-cohort moat (argus-watch seal/settle via the bridge tables) */}
                {(r.plugin_sealed != null || r.plugin_settled != null) && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                    <Stat label={L('플러그인 봉인', 'Plugin sealed')} value={r.plugin_sealed ?? 0}
                      hint={L('argus-watch seal', 'argus-watch seal')} />
                    <Stat label={L('플러그인 정산', 'Plugin settled')} value={r.plugin_settled ?? 0}
                      hint={L('현실과 대조됨', 'checked vs reality')} />
                  </div>
                )}

                {r.settled_total > 0 && verdictPairs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {verdictPairs.map(([verdict, n]) => (
                      <span key={verdict} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1 text-[12px] text-[var(--text-secondary)]">
                        <span className="font-semibold text-[var(--text-primary)]">{outcomeLabels[verdict] ?? verdict}</span> {n}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-[12.5px] text-[var(--text-tertiary)] mb-6 leading-snug">
                  {L('결정 기록과 결과 확인은 서로 다른 방문에서 일어날 수 있어 전환율로 계산하지 않습니다. 익명 기록을 포함한 행동 횟수입니다.',
                     'Decision recording and outcome review can happen in different visits, so these are activity counts rather than a conversion rate.')}
                </p>
              </>
            );
          })()}

          {metrics.surface_funnel && (
            <>
              <h2 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                {L('사용 경로별 흐름', 'Journey by entry point')}
              </h2>
              <SurfaceFunnel rows={metrics.surface_funnel} L={L} />
            </>
          )}

          {/* LLM health — the silent-degradation sensors (2026-07-31). A cut-at-cap
              generation errors NOWHERE (the client fallback recovers it), which is
              how a 2x-latency double-call ran at 44% of big calls for months with
              every dashboard green. Truncation should sit at 0; a rising number
              means some prompt outgrew its budget and users are paying twice. */}
          {metrics.llm && (
            <>
              <h2 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
                {L('LLM 건강 (7일)', 'LLM health (7d)')}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                <Stat label={L('절단', 'Truncations')} value={metrics.llm.truncation_7d}
                  accent={metrics.llm.truncation_7d > 0}
                  hint={`${L('24시간', '24h')} ${metrics.llm.truncation_24h} · ${L('0이 정상', '0 is healthy')}`} />
                <Stat label={L('스트림 재시도', 'Stream retries')} value={metrics.llm.stream_retry_7d}
                  hint={L('사용자가 2배로 기다린 횟수', 'double-wait moments')} />
                <Stat label={L('오류', 'Errors')} value={metrics.llm.errors_7d}
                  hint={`${L('호출', 'calls')} ${metrics.llm.calls_7d}`} />
                <Stat label={L('캐시 적중', 'Cache reads')} value={`${Math.round(metrics.llm.cache_read_7d / 1000)}k`}
                  hint={`${L('기록', 'writes')} ${Math.round(metrics.llm.cache_write_7d / 1000)}k ${L('토큰', 'tokens')}`} />
              </div>
            </>
          )}

          {metrics.storage_health && (
            <>
              <h2 className="mt-6 mb-2 text-[12px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">
                {L('익명 기록 저장 상태', 'Anonymous backup health')}
              </h2>
              <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <Stat label={L('익명 프로젝트', 'Anon projects')} value={metrics.storage_health.anonymous_projects} />
                <Stat label={L('익명 진행 기록', 'Anon sessions')} value={metrics.storage_health.anonymous_sessions} />
                <Stat
                  label={L('진행 기록 없는 프로젝트', 'Projects missing session')}
                  value={metrics.storage_health.anonymous_projects_missing_session}
                  accent={metrics.storage_health.anonymous_projects_missing_session > 0}
                  hint={L('0이 정상', '0 is healthy')}
                />
                <Stat
                  label={L('저장 실패', 'Write failures')}
                  value={metrics.storage_health.sync_failures_24h}
                  accent={metrics.storage_health.sync_failures_24h > 0}
                  hint={`${L('7일', '7d')} ${metrics.storage_health.sync_failures_7d}`}
                />
              </div>
            </>
          )}

          <details className="group mb-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)]">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[13px] font-semibold text-[var(--text-secondary)]">
              <span>{L('시스템 데이터 상세', 'System data details')}</span>
              <ChevronDown size={16} className="transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid grid-cols-2 gap-2 border-t border-[var(--border-subtle)] p-3 md:grid-cols-3">
              {Object.entries(metrics.tables).map(([key, count]) => ({ key, count })).map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg)] px-3 py-2">
                  <span className="min-w-0 text-[12px] text-[var(--text-secondary)] truncate flex items-center gap-1.5">
                    {item.key.startsWith('plugin_') && <Compass size={11} className="text-[var(--accent)] shrink-0" />}
                    {item.key}
                  </span>
                  <span className="shrink-0 text-[13px] font-semibold text-[var(--text-primary)]">{item.count}</span>
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
