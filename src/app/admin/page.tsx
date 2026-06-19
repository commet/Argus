'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useLocale } from '@/hooks/useLocale';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Anchor, Compass, RefreshCw } from 'lucide-react';

interface Metrics {
  generated_at: string;
  users_total: number;
  users_with_projects: number;
  signups_7d: number;
  signups_30d: number;
  projects_total: number;
  projects_sealed: number;
  projects_settled: number;
  projects_7d: number;
  projects_30d: number;
  latest_project: string | null;
  tables: Record<string, number>;
}

function Stat({ label, value, hint, accent }: { label: string; value: number | string; hint?: string; accent?: boolean }) {
  return (
    <Card variant={accent ? 'elevated' : 'default'} className="!p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</p>
      <p className={`mt-1 text-[28px] font-bold leading-none ${accent ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">{hint}</p>}
    </Card>
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

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{L('계기판', 'Dashboard')}</h1>
          {metrics && (
            <p className="text-[12px] text-[var(--text-tertiary)] mt-0.5">
              {L('기준', 'as of')} {new Date(metrics.generated_at).toLocaleString()}
            </p>
          )}
        </div>
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />{L('새로고침', 'Refresh')}
        </button>
      </div>

      {error === 'other' && (
        <p className="text-[13px] text-red-600 mb-4">{L('불러오기 실패. 새로고침 해보세요.', 'Failed to load. Try refresh.')}</p>
      )}

      {metrics && (
        <>
          {/* The funnel — the spine: signup → uses it → makes a project → SEALS → settles */}
          <h2 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">{L('깔때기', 'Funnel')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-2">
            <Stat label={L('가입', 'Signups')} value={metrics.users_total} hint={`+${metrics.signups_30d} ${L('30일', '30d')}`} />
            <Stat label={L('프로젝트 보유', 'With project')} value={metrics.users_with_projects} />
            <Stat label={L('프로젝트', 'Projects')} value={metrics.projects_total} hint={`+${metrics.projects_30d} ${L('30일', '30d')}`} />
            <Stat label={L('봉인된 결정', 'Sealed')} value={metrics.projects_sealed} accent hint={L('핵심 지표', 'the spine')} />
            <Stat label={L('정산됨', 'Settled')} value={metrics.projects_settled} accent />
          </div>

          {metrics.projects_sealed === 0 && (
            <Card variant="muted" className="!p-3 mb-6 flex items-start gap-2">
              <Anchor size={14} className="mt-0.5 shrink-0 text-[var(--accent)]" />
              <p className="text-[12.5px] text-[var(--text-secondary)] leading-snug">
                {L('아직 봉인된 결정이 0건입니다 — 제품의 핵심 루프(결정 봉인→정산)가 실사용자에게서 한 번도 작동한 적이 없다는 뜻. 로그인해서 결정 한 건을 직접 봉인하면 이 숫자가 0→1이 됩니다.',
                   'Zero sealed decisions yet — the core loop (seal→settle) has never run for a real user. Seal one decision while logged in to move this 0→1.')}
              </p>
            </Card>
          )}

          {/* Per-table row counts — "did the data actually arrive" */}
          <h2 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">{L('테이블별 행수', 'Rows per table')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6">
            {Object.entries(metrics.tables).map(([name, count]) => (
              <div key={name} className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2">
                <span className="text-[12px] text-[var(--text-secondary)] truncate flex items-center gap-1.5">
                  {name.startsWith('plugin_') && <Compass size={11} className="text-[var(--accent)]" />}
                  {name}
                </span>
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">{count}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label={L('최근 프로젝트', 'Latest project')} value={fmtDate(metrics.latest_project)} />
            <Stat label={L('가입 7일', 'Signups 7d')} value={metrics.signups_7d} />
            <Stat label={L('프로젝트 7일', 'Projects 7d')} value={metrics.projects_7d} />
            <Stat label={L('플러그인 결정', 'Plugin decisions')} value={metrics.tables.plugin_decisions ?? 0} />
          </div>
        </>
      )}
    </div>
  );
}
