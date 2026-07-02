'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Anchor, CheckCircle2, Compass, FileText, Upload } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLocale } from '@/hooks/useLocale';
import { usePluginStore } from '@/stores/usePluginStore';
import { importPluginFiles, type ImportSummary } from '@/lib/plugin-import';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { PluginDecision } from '@/stores/types';

const STATUS_TONE: Record<string, string> = {
  candidate: 'var(--text-tertiary)',
  sealed: 'var(--accent)',
  settled: 'var(--primary)',
  dismissed: 'var(--text-tertiary)',
};

const STATUS_LABELS = {
  ko: { candidate: '후보', sealed: '봉인됨', settled: '정산됨', dismissed: '제외됨' },
  en: { candidate: 'candidate', sealed: 'sealed', settled: 'settled', dismissed: 'dismissed' },
} as const;

const OUTCOME_LABELS = {
  ko: { happened: '예측대로', avoided: '빗나감', partial: '부분 적중', pending: '보류' },
  en: { happened: 'happened', avoided: 'avoided', partial: 'partial', pending: 'pending' },
} as const;

function todayISO(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function isOverdue(d: PluginDecision): boolean {
  return d.status === 'sealed' && !!d.check_by && d.check_by <= todayISO();
}

export default function ImportPage() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
  const { user, loading: authLoading } = useAuth();
  const { decisions, bearings, loadData, loaded, settleDecision, deferDecision } = usePluginStore();

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (user) void loadData();
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

  const settle = async (id: string, outcome: 'happened' | 'avoided' | 'partial') => {
    setActionError('');
    setActingId(id);
    try {
      await settleDecision(id, outcome);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : L('정산을 저장하지 못했습니다.', 'Could not save the settlement.'));
    } finally {
      setActingId(null);
    }
  };

  const later = async (id: string) => {
    setActionError('');
    setActingId(id);
    try {
      await deferDecision(id, addDaysISO(14));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : L('확인일을 바꾸지 못했습니다.', 'Could not defer the check date.'));
    } finally {
      setActingId(null);
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
            {L(
              '플러그인에서 봉인한 결정과 항해 기록을 계정으로 가져오려면 먼저 로그인하세요. 가져온 기록은 본인 계정에만 저장됩니다.',
              'Log in first to pull decisions sealed in the plugin into your account. Imported records are stored only under your account.',
            )}
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
        {L('플러그인 기록', 'Plugin records')}
      </h1>
      <p className="text-[14px] text-[var(--text-secondary)] mb-3">
        {L(
          'Claude Code 플러그인의 .argus/ledger/ledger.jsonl과 current_bearing.json을 이 화면에서 열 수 있습니다.',
          "Upload your Claude Code plugin's .argus/ledger/ledger.jsonl and current_bearing.json files to open them here.",
        )}
      </p>

      <div className="mb-6 px-3.5 py-3 rounded-lg bg-[var(--bg)] border border-[var(--border-subtle)]">
        <p className="text-[12.5px] text-[var(--text-secondary)]">
          {L('권장 흐름: 설정에서 push token을 발급한 뒤 플러그인에서 ', 'Recommended flow: issue a push token in Settings, then run ')}
          <code className="text-[11.5px] font-mono bg-[var(--surface)] px-1.5 py-0.5 rounded">/argus:connect</code>
          {L(' 후 ', ' and ')}
          <code className="text-[11.5px] font-mono bg-[var(--surface)] px-1.5 py-0.5 rounded">/argus:sync</code>
          {L('를 실행하세요. 파일을 직접 올리지 않아도 웹앱과 로컬 ledger가 왕복 동기화됩니다.', ' to sync both ways without manual upload.')}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
          <Link href="/settings" className="text-[var(--accent)] hover:underline">
            {L('토큰 발급하러 가기', 'Issue a token')}
          </Link>
          <span className="text-[var(--text-tertiary)]">{L('정산 후에는 로컬에서 ', 'After settling here, run ')}</span>
          <code className="text-[11px] font-mono bg-[var(--surface)] px-1.5 py-0.5 rounded">/argus:sync</code>
          <span className="text-[var(--text-tertiary)]">{L('를 실행하면 됩니다.', ' locally.')}</span>
        </div>
        <p className="text-[12px] text-[var(--text-tertiary)] mt-2">
          {L('새 결정은 ', 'New decisions start with ')}
          <code className="text-[11px] font-mono bg-[var(--surface)] px-1.5 py-0.5 rounded">/argus:sail</code>
          {L(', 과거 Claude Code 결정 회수는 ', '; past Claude Code decisions start with ')}
          <code className="text-[11px] font-mono bg-[var(--surface)] px-1.5 py-0.5 rounded">/argus:scan</code>
          {L(' 후 ', ', then ')}
          <code className="text-[11px] font-mono bg-[var(--surface)] px-1.5 py-0.5 rounded">/argus:seal</code>
          {L('입니다.', '.')}
        </p>
      </div>

      <Card variant="muted" className="mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Upload size={18} className="text-[var(--accent)]" />
            <div>
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                {L('파일 선택', 'Choose files')}
              </p>
              <p className="text-[12px] text-[var(--text-tertiary)]">
                {L('.jsonl / .json, 여러 개 가능, 다시 올리면 중복 없이 갱신됩니다.', '.jsonl / .json, multiple files ok, re-upload updates without duplicates.')}
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
            {busy ? L('가져오는 중...', 'Importing...') : L('파일 올리기', 'Upload')}
          </Button>
        </div>

        {summary && (
          <div className="mt-4 pt-4 border-t border-[var(--border-subtle)] text-[13px]">
            {summary.error === 'too_large' ? (
              <p className="text-red-600 flex items-center gap-1.5"><AlertTriangle size={14} />{L('파일이 너무 큽니다. 15MB 이하로 올려주세요.', 'Files too large. Keep the upload under 15MB.')}</p>
            ) : summary.error && summary.error !== 'not_logged_in' ? (
              <p className="text-red-600 flex items-center gap-1.5"><AlertTriangle size={14} />{L('저장 오류: ', 'Save error: ')}{summary.error}</p>
            ) : (
              <p className="text-[var(--text-primary)] flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-[var(--primary)]" />
                {L(
                  `결정 ${summary.decisions.written}건, 항해 기록 ${summary.bearings.written}건을 가져왔습니다.`,
                  `Imported ${summary.decisions.written} decisions, ${summary.bearings.written} bearings.`,
                )}
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

      <section className="mb-8">
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3 flex items-center gap-2">
          <Anchor size={14} />{L('결정', 'Decisions')} <span className="text-[var(--text-tertiary)]/70">({decisions.length})</span>
        </h2>
        {actionError && (
          <p className="mb-3 text-[12px] text-red-600" role="alert">
            {actionError}
          </p>
        )}
        {loaded && decisions.length === 0 ? (
          <p className="text-[13px] text-[var(--text-tertiary)]">{L('아직 가져온 결정이 없어요. 플러그인·텔레그램에서 봉인한 결정이 이 계정으로 모여요.', 'No decisions imported yet. Decisions sealed in the plugin or Telegram gather into this account here.')}</p>
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
                    {isOverdue(d)
                      ? L('기한 지남', 'overdue')
                      : d.status
                        ? STATUS_LABELS[locale === 'ko' ? 'ko' : 'en'][d.status]
                        : ''}
                  </span>
                </div>
                {d.predicate && (
                  <p className="text-[12.5px] text-[var(--text-secondary)] mt-1.5">
                    <span className="text-[var(--text-tertiary)]">{L('베팅: ', 'Bet: ')}</span>{d.predicate}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2 text-[11.5px] text-[var(--text-tertiary)] flex-wrap">
                  {d.check_by && <span>{L('확인: ', 'Check: ')}{d.check_by}</span>}
                  {d.outcome && <span className="text-[var(--primary)]">{L('결과: ', 'Outcome: ')}{OUTCOME_LABELS[locale === 'ko' ? 'ko' : 'en'][d.outcome]}</span>}
                  {d.project && <span>{d.project}</span>}
                  {d.stakes && <span>{d.stakes}</span>}
                </div>
                {d.status === 'sealed' && (
                  <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                    <p className="text-[11.5px] text-[var(--text-tertiary)] mb-2">
                      {isOverdue(d)
                        ? L('확인일이 지났습니다. 실제로 어떻게 됐나요?', 'This is due. How did it go?')
                        : L('아직 확인일 전입니다. 필요하면 지금 정산하거나 2주 뒤로 미룰 수 있습니다.', 'Not due yet. You can settle now or push it two weeks.')}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="secondary" size="sm" onClick={() => settle(d.id, 'happened')} disabled={actingId === d.id}>
                        {L('예측대로', 'Happened')}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => settle(d.id, 'avoided')} disabled={actingId === d.id}>
                        {L('빗나감', 'Did not')}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => settle(d.id, 'partial')} disabled={actingId === d.id}>
                        {L('부분', 'Partial')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => later(d.id)} disabled={actingId === d.id}>
                        {L('2주 뒤', 'Later')}
                      </Button>
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] mt-2">
                      {L('웹앱에서 한 정산은 다음 /argus:pull 또는 /argus:sync 때 로컬 ledger에 붙습니다.', 'Web settlements are appended to the local ledger on the next /argus:pull or /argus:sync.')}
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3 flex items-center gap-2">
          <Compass size={14} />{L('항해 기록', 'Bearings')} <span className="text-[var(--text-tertiary)]/70">({bearings.length})</span>
        </h2>
        {loaded && bearings.length === 0 ? (
          <p className="text-[13px] text-[var(--text-tertiary)]">{L('아직 가져온 항해 기록이 없습니다.', 'No bearings imported yet.')}</p>
        ) : (
          <div className="space-y-2.5">
            {bearings.map((b) => (
              <Card key={b.id} variant="default" className="!p-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText size={13} className="text-[var(--accent)]" />
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">{b.label || b.version_label || L('항해', 'Voyage')}</span>
                  {b.current_course?.status && (
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{b.current_course.status}</span>
                  )}
                </div>
                {b.current_course?.summary && (
                  <p className="text-[13px] text-[var(--text-secondary)] leading-snug">{b.current_course.summary}</p>
                )}
                {b.contract_seed?.predicate && (
                  <p className="text-[12px] text-[var(--text-tertiary)] mt-1.5">{L('씨앗 베팅: ', 'Seed bet: ')}{b.contract_seed.predicate}</p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
