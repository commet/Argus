'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Anchor, CheckCircle2, Compass, FileText, Upload } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useLocale } from '@/hooks/useLocale';
import { usePluginStore } from '@/stores/usePluginStore';
import { importPluginFiles, type ImportSummary } from '@/lib/plugin-import';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { McpInstallGuide } from '@/components/import/McpInstallGuide';
import type { PluginDecision } from '@/stores/types';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { fold } from '@/lib/decision-kernel';

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
  const { decisions, bearings, semantic, loadData, loaded, loadError, reforgeDecision, recordDecisionAnswer, deferDecision, closeDecisionRecord } = usePluginStore();

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
      await recordDecisionAnswer(id, outcome);
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

  const reforge = async (id: string) => {
    setActionError('');
    setActingId(id);
    try {
      await reforgeDecision(id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : L('정본 기록을 만들지 못했습니다.', 'Could not create the canonical record.'));
    } finally {
      setActingId(null);
    }
  };

  const closeSemantic = async (id: string) => {
    setActionError('');
    setActingId(id);
    try {
      await closeDecisionRecord(id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : L('기록을 종결하지 못했습니다.', 'Could not close the record.'));
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
            {L('기록 가져오기', 'Import records')}
          </h1>
          <p className="text-[14px] text-[var(--text-secondary)] mb-5">
            {L(
              'AI 대화에서 저장한 예측을 계정에 연결하면, 정한 날 이메일을 받고 여기서 실제 결과를 기록할 수 있습니다.',
              'Connect a prediction saved in an AI chat to your account, get an email on the date you chose, then record what happened here.',
            )}
          </p>
          <ol className="mb-5 space-y-2 text-[13px] text-[var(--text-secondary)]">
            <li>{L('1. AI 대화에서 argus_predict로 예측을 저장합니다.', '1. Save a prediction in an AI chat with argus_predict.')}</li>
            <li>{L('2. 정한 날 계정 이메일이 먼저 옵니다.', '2. On the date you chose, your account email arrives first.')}</li>
            <li>{L('3. 여기서 실제 결과만 기록합니다.', '3. Come back here and record only what reality did.')}</li>
          </ol>
          <details className="mb-5">
            <summary className="cursor-pointer text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              {L('처음이라면 — MCP 설치 안내', 'First time? — MCP install guide')}
            </summary>
            <div className="mt-3">
              <McpInstallGuide locale={locale} />
            </div>
          </details>
          <LocaleLink href="/login?redirect=/import">
            <Button variant="accent">{L('로그인', 'Log in')}</Button>
          </LocaleLink>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
        {L('기록 가져오기', 'Import records')}
      </h1>
      <p className="text-[14px] text-[var(--text-secondary)] mb-6">
        {L(
          'Claude Code·텔레그램 등 다른 곳에서 봉인한 결정이 이 계정으로 모입니다. 여기서 확인일이 온 결정을 정산할 수 있어요.',
          'Decisions sealed elsewhere — Claude Code, Telegram — gather into this account. Settle the ones whose check date has arrived, right here.',
        )}
      </p>

      {/* ① The one recommended path, in plain words. Everything technical folds below. */}
      <Card variant="muted" className="mb-4">
        <p className="text-[14px] font-semibold text-[var(--text-primary)] mb-2.5">
          {L('연결하기 (한 번만 하면 됩니다)', 'Connect once — that’s it')}
        </p>
        <ol className="space-y-2 text-[13px] text-[var(--text-secondary)]">
          <li className="flex gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold flex items-center justify-center">1</span>
            <span>
              <LocaleLink href="/settings" className="text-[var(--accent)] hover:underline font-medium">{L('설정에서 연결 토큰을 발급', 'Issue a connect token in Settings')}</LocaleLink>
              {L('합니다.', '.')}
            </span>
          </li>
          <li className="flex gap-2">
            <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-bold flex items-center justify-center">2</span>
            <span>
              {L('터미널에서 ', 'In your terminal, run ')}
              <code className="text-[11.5px] font-mono bg-[var(--surface)] px-1.5 py-0.5 rounded">/argus:settings connect</code>
              {L('를 한 번 실행합니다.', ' once.')}
            </span>
          </li>
        </ol>
        <p className="text-[12.5px] text-[var(--text-tertiary)] mt-3">
          {L('이후로는 ', 'From then on, ')}
          <code className="text-[11px] font-mono bg-[var(--surface)] px-1.5 py-0.5 rounded">/argus:settings sync</code>
          {L(' 한 번이면 로컬 기록과 이 화면이 왕복으로 맞춰집니다 — 파일을 올릴 필요가 없어요. 여기서 정산한 결과도 같은 명령으로 로컬에 돌아갑니다.', ' keeps your local records and this page in sync both ways — no file uploads needed. Settlements you record here travel back the same way.')}
        </p>
      </Card>

      {/* ② First-time install — folded; facts and commands only (BLUEPRINT §9.5 M4). */}
      <details className="mb-4 group/install">
        <summary className="cursor-pointer list-none flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg)] px-3.5 py-2.5">
          <span className="text-[13px] font-medium text-[var(--text-secondary)]">
            {L('처음이라면 — MCP 설치 안내', 'First time? — MCP install guide')}
          </span>
          <span className="text-[11px] text-[var(--text-tertiary)] group-open/install:hidden">{L('펼치기', 'Show')}</span>
        </summary>
        <div className="mt-3">
          <McpInstallGuide locale={locale} />
          <p className="text-[12px] text-[var(--text-tertiary)] px-1 -mt-3 mb-3">
            {L('더 깊이: 문서 검토는 ', 'Going deeper: document review starts with ')}
            <code className="text-[11px] font-mono bg-[var(--surface)] px-1.5 py-0.5 rounded">/argus:review</code>
            {L(', 과거 Claude Code 결정 회수는 ', '; recovering past Claude Code decisions starts with ')}
            <code className="text-[11px] font-mono bg-[var(--surface)] px-1.5 py-0.5 rounded">/argus:history scan</code>
            {L('입니다.', '.')}
          </p>
        </div>
      </details>

      {/* ③ Manual file upload — the legacy path, folded by default. */}
      <details className="mb-6 group/upload">
        <summary className="cursor-pointer list-none flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg)] px-3.5 py-2.5">
          <span className="text-[13px] font-medium text-[var(--text-secondary)] flex items-center gap-2">
            <Upload size={14} className="text-[var(--text-tertiary)]" />
            {L('파일로 직접 올리기 (연결 없이)', 'Upload files manually (without connecting)')}
          </span>
          <span className="text-[11px] text-[var(--text-tertiary)] group-open/upload:hidden">{L('펼치기', 'Show')}</span>
        </summary>
        <Card variant="muted" className="mt-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[13px] text-[var(--text-secondary)]">
                {L('플러그인 폴더의 ', 'From the plugin folder: ')}
                <code className="text-[11px] font-mono bg-[var(--surface)] px-1.5 py-0.5 rounded">.argus/ledger/ledger.jsonl</code>
                {L('과 ', ' and ')}
                <code className="text-[11px] font-mono bg-[var(--surface)] px-1.5 py-0.5 rounded">current_bearing.json</code>
              </p>
              <p className="text-[12px] text-[var(--text-tertiary)] mt-1">
                {L('여러 개 가능, 다시 올리면 중복 없이 갱신됩니다.', 'Multiple files ok; re-uploading updates without duplicates.')}
              </p>
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
                <p className="text-[var(--danger)] flex items-center gap-1.5"><AlertTriangle size={14} />{L('파일이 너무 큽니다. 15MB 이하로 올려주세요.', 'Files too large. Keep the upload under 15MB.')}</p>
              ) : summary.error && summary.error !== 'not_logged_in' ? (
                <p className="text-[var(--danger)] flex items-center gap-1.5"><AlertTriangle size={14} />{L('저장 오류: ', 'Save error: ')}{summary.error}</p>
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
      </details>

      <section className="mb-8">
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3 flex items-center gap-2">
          <Anchor size={14} />{L('결정', 'Decisions')} <span className="text-[var(--text-tertiary)]/70">({decisions.length})</span>
        </h2>
        {actionError && (
          <p className="mb-3 text-[12px] text-[var(--danger)]" role="alert">
            {actionError}
          </p>
        )}
        {loadError && (
          <p className="mb-3 text-[12px] text-[var(--danger)]">
            {L('서버 기록을 불러오지 못했습니다. 로컬 파일은 그대로이며 잠시 후 다시 시도할 수 있습니다.', 'Could not load server records. Your local files are unchanged; please try again shortly.')}
          </p>
        )}
        {loaded && !loadError && decisions.length === 0 ? (
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
                      ? L('확인할 차례', 'time to check')
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
                {d.status === 'sealed' && (() => {
                  const record = semantic[d.id];
                  const judgment = record ? fold(record.events).judgments.get(record.judgment_id) : undefined;
                  const closed = !!judgment?.closed;
                  const answered = !!judgment?.resolution;
                  return (
                    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                      {!record ? <>
                        <p className="text-[11.5px] text-[var(--text-tertiary)] mb-2">
                          {L('예전 플러그인 기록이에요. 자동으로 옮겨 적지 않습니다 — 아래 버튼은 이 내용을 오늘 내 판단으로 다시 채택하는 행동이에요.', 'A legacy plugin record. It is never copied over silently — the button below re-adopts it today as your own judgment.')}
                        </p>
                        <Button variant="accent" size="sm" onClick={() => reforge(d.id)} disabled={actingId === d.id}>{L('내 판단으로 다시 기록', 'Re-adopt as my judgment')}</Button>
                      </> : closed ? <>
                        <p className="text-[11.5px] text-[var(--text-tertiary)]">{L('답변과 별도 종결 확인이 모두 기록되었습니다.', 'The answer and the separate close confirmation are both recorded.')}</p>
                      </> : answered ? <>
                        <p className="text-[11.5px] text-[var(--text-tertiary)] mb-2">{L('답변은 기록됐지만 아직 종결되지 않았습니다.', 'The answer is recorded but the judgment is not closed.')}</p>
                        <Button variant="accent" size="sm" onClick={() => closeSemantic(d.id)} disabled={actingId === d.id}>{L('이 답변으로 기록 종결', 'Close with this answer')}</Button>
                      </> : <>
                        <p className="text-[11.5px] text-[var(--text-tertiary)] mb-2">{L('관찰과 답변은 남기되, 종결은 다음 단계에서 별도로 확인합니다.', 'Record an observation and answer now; closing is a separate later confirmation.')}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Button variant="secondary" size="sm" onClick={() => settle(d.id, 'happened')} disabled={actingId === d.id}>{L('발생했다고 답변', 'Record “happened”')}</Button>
                          <Button variant="secondary" size="sm" onClick={() => settle(d.id, 'avoided')} disabled={actingId === d.id}>{L('발생하지 않았다고 답변', 'Record “did not”')}</Button>
                          <Button variant="secondary" size="sm" onClick={() => settle(d.id, 'partial')} disabled={actingId === d.id}>{L('부분적 답변', 'Record “partial”')}</Button>
                          <Button variant="ghost" size="sm" onClick={() => later(d.id)} disabled={actingId === d.id}>{L('2주 뒤 다시 보기', 'Defer 2 weeks')}</Button>
                        </div>
                      </>}
                      <p className="text-[11px] text-[var(--text-tertiary)] mt-2">
                        {L('여기서 기록한 내용은 다음 /argus:settings sync 때 로컬 기록에도 그대로 더해집니다.', 'What you record here is appended to your local records on the next /argus:settings sync.')}
                      </p>
                    </div>
                  );
                })()}
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-[13px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3 flex items-center gap-2">
          <Compass size={14} />{L('항해 기록', 'Bearings')} <span className="text-[var(--text-tertiary)]/70">({bearings.length})</span>
        </h2>
        {loaded && !loadError && bearings.length === 0 ? (
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
