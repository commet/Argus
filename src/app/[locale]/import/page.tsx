'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useLocale } from '@/hooks/useLocale';
import { usePluginStore } from '@/stores/usePluginStore';
import { importPluginFiles, type ImportSummary } from '@/lib/plugin-import';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Upload, Compass, FileText, Anchor, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { PluginDecision } from '@/stores/types';

const STATUS_TONE: Record<string, string> = {
  candidate: 'var(--text-tertiary)',
  sealed: 'var(--accent)',
  settled: 'var(--primary)',
  dismissed: 'var(--text-tertiary)',
};

function todayISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function isOverdue(d: PluginDecision): boolean {
  return d.status === 'sealed' && !!d.check_by && d.check_by <= todayISO();
}

export default function ImportPage() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const { user, loading: authLoading } = useAuth();
  const { decisions, bearings, loadData, loaded } = usePluginStore();

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    setBusy(true);
    setSummary(null);
    try {
      const files = await Promise.all(
        Array.from(list).map(async (f) => ({ name: f.name, content: await f.text() })),
      );
      const result = await importPluginFiles(files);
      setSummary(result);
      if (result.decisions.written > 0 || result.bearings.written > 0) await loadData();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Card variant="elevated">
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            {L('플러그인 기록 가져오기', 'Import plugin records')}
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)] mb-5">
            {L('플러그인에서 봉인한 결정을 계정에 불러오려면 먼저 로그인하세요. 가져온 기록은 본인 계정에만 저장됩니다.',
               'Log in first to pull decisions sealed in the plugin into your account. Imported records are stored only under your account.')}
          </p>
          <Link href="/login?redirect=/import">
            <Button variant="accent">{L('로그인', 'Log in')}</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
        {L('플러그인 기록 가져오기', 'Import plugin records')}
      </h1>
      <p className="text-[14px] text-[var(--text-secondary)] mb-6">
        {L('Claude Code 플러그인의 .argus/ledger/ledger.jsonl 과 current_bearing.json 파일을 올리면 여기서 열어볼 수 있어요.',
           'Upload your Claude Code plugin’s .argus/ledger/ledger.jsonl and current_bearing.json files to open them here.')}
      </p>

      {/* Upload */}
      <Card variant="muted" className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Upload size={18} className="text-[var(--accent)]" />
            <div>
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                {L('파일 선택', 'Choose files')}
              </p>
              <p className="text-[12px] text-[var(--text-tertiary)]">
                {L('.jsonl / .json · 여러 개 가능 · 다시 올리면 갱신(중복 없음)', '.jsonl / .json · multiple ok · re-upload updates (no duplicates)')}
              </p>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".jsonl,.json,application/json"
            multiple
            onChange={handleFiles}
            className="hidden"
            id="plugin-files"
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? L('가져오는 중…', 'Importing…') : L('파일 올리기', 'Upload')}
          </Button>
        </div>

        {summary && (
          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] text-[13px]">
            {summary.error === 'too_large' ? (
              <p className="text-red-600 flex items-center gap-1.5"><AlertTriangle size={14} />{L('파일이 너무 큽니다 (15MB 초과).', 'Files too large (over 15MB).')}</p>
            ) : summary.error && summary.error !== 'not_logged_in' ? (
              <p className="text-red-600 flex items-center gap-1.5"><AlertTriangle size={14} />{L('저장 중 오류: ', 'Save error: ')}{summary.error}</p>
            ) : (
              <p className="text-[var(--text-primary)] flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-[var(--primary)]" />
                {L(`결정 ${summary.decisions.written}건, 항해기록 ${summary.bearings.written}건 가져옴.`,
                   `Imported ${summary.decisions.written} decisions, ${summary.bearings.written} bearings.`)}
              </p>
            )}
            {summary.skipped.length > 0 && (
              <ul className="mt-2 text-[12px] text-[var(--text-tertiary)] list-disc pl-5">
                {summary.skipped.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
          </div>
        )}
      </Card>

      {/* Decisions */}
      <section className="mb-8">
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3 flex items-center gap-2">
          <Anchor size={14} />{L('결정', 'Decisions')} <span className="text-[var(--text-tertiary)]/70">({decisions.length})</span>
        </h2>
        {loaded && decisions.length === 0 ? (
          <p className="text-[13px] text-[var(--text-tertiary)]">{L('아직 가져온 결정이 없어요.', 'No decisions imported yet.')}</p>
        ) : (
          <div className="space-y-2.5">
            {decisions.map((d) => (
              <Card key={d.id} variant="default" className="!p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] font-semibold text-[var(--text-primary)] leading-snug">
                    {d.decision || d.quote || d.predicate || L('(제목 없음)', '(untitled)')}
                  </p>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider shrink-0 px-2 py-0.5 rounded-full border"
                    style={{ color: STATUS_TONE[d.status ?? 'candidate'], borderColor: 'var(--border-subtle)' }}
                  >
                    {isOverdue(d) ? L('확인기한 지남', 'overdue') : (d.status ?? '')}
                  </span>
                </div>
                {d.predicate && (
                  <p className="text-[12.5px] text-[var(--text-secondary)] mt-1.5">
                    <span className="text-[var(--text-tertiary)]">{L('내기: ', 'Bet: ')}</span>{d.predicate}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-[11.5px] text-[var(--text-tertiary)]">
                  {d.check_by && <span>{L('확인: ', 'Check: ')}{d.check_by}</span>}
                  {d.outcome && <span className="text-[var(--primary)]">{L('결과: ', 'Outcome: ')}{d.outcome}</span>}
                  {d.project && <span>· {d.project}</span>}
                  {d.stakes && <span>· {d.stakes}</span>}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Bearings */}
      <section>
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3 flex items-center gap-2">
          <Compass size={14} />{L('항해 기록', 'Bearings')} <span className="text-[var(--text-tertiary)]/70">({bearings.length})</span>
        </h2>
        {loaded && bearings.length === 0 ? (
          <p className="text-[13px] text-[var(--text-tertiary)]">{L('아직 가져온 항해 기록이 없어요.', 'No bearings imported yet.')}</p>
        ) : (
          <div className="space-y-2.5">
            {bearings.map((b) => (
              <Card key={b.id} variant="default" className="!p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={13} className="text-[var(--accent)]" />
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">{b.label || b.version_label || L('항해', 'Voyage')}</span>
                  {b.current_course?.status && (
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">· {b.current_course.status}</span>
                  )}
                </div>
                {b.current_course?.summary && (
                  <p className="text-[13px] text-[var(--text-secondary)] leading-snug">{b.current_course.summary}</p>
                )}
                {b.contract_seed?.predicate && (
                  <p className="text-[12px] text-[var(--text-tertiary)] mt-1.5">{L('씨앗 내기: ', 'Seed bet: ')}{b.contract_seed.predicate}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
