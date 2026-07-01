'use client';

/**
 * Document Review flow (design doc §"제품 루프" + §"UI 화면 / 상태").
 * Import → progress → Judgment Receipt. The wedge is "기존 문서 검수하기": paste
 * or upload a strategy doc / plan / AI answer, get a receipt whose findings are
 * anchored to the source. Binary formats degrade honestly instead of faking.
 */

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useReviewStore } from '@/stores/useReviewStore';
import { ReceiptView } from './ReceiptView';
import { SealModal } from './SealModal';
import {
  ingest,
  runDocumentReview,
  type JudgmentReceipt,
  type ReviewJob,
  type SourceKind,
  type ReviewConcern,
  type UserReviewContext,
} from '@/lib/review';

type Phase = 'import' | 'running' | 'done' | 'failed';

const CONCERN_CHIPS: { id: ReviewConcern; label: string }[] = [
  { id: 'full_judgment_review', label: '전체 판단 검수' },
  { id: 'strategic_fit', label: '전략 적합성' },
  { id: 'evidence', label: '근거/주장 검증' },
  { id: 'stakeholder_objection', label: '이해관계자 반론' },
  { id: 'execution_risk', label: '실행 리스크' },
  { id: 'ai_answer_trust', label: 'AI 답변 신뢰성' },
];

const TEXT_EXT = ['md', 'markdown', 'txt', 'text'];
const BINARY_EXT: Record<string, SourceKind> = { pdf: 'pdf', docx: 'docx', pptx: 'pptx' };

export function ReviewFlow() {
  const store = useReviewStore();
  // Load persisted receipts once on mount (load() is idempotent via its guard).
  useEffect(() => { useReviewStore.getState().load(); }, []);

  const [phase, setPhase] = useState<Phase>('import');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [sourceKind, setSourceKind] = useState<SourceKind>('paste');
  const [pendingBinary, setPendingBinary] = useState<SourceKind | null>(null);
  const [concerns, setConcerns] = useState<ReviewConcern[]>(['full_judgment_review']);
  const [audienceHint, setAudienceHint] = useState('');
  const [worry, setWorry] = useState('');
  const [job, setJob] = useState<ReviewJob | null>(null);
  const [receipt, setReceipt] = useState<JudgmentReceipt | null>(null);
  const [sealing, setSealing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    setTitle(file.name);
    if (TEXT_EXT.includes(ext)) {
      const content = await file.text();
      setText(content);
      setSourceKind(ext.startsWith('md') ? 'markdown' : 'txt');
      setPendingBinary(null);
    } else if (BINARY_EXT[ext]) {
      // No in-browser parser yet — keep the format, degrade honestly on submit.
      setText('');
      setSourceKind(BINARY_EXT[ext]);
      setPendingBinary(BINARY_EXT[ext]);
    } else {
      setText('');
      setSourceKind('txt');
      setPendingBinary(null);
    }
  };

  const toggleConcern = (id: ReviewConcern) => {
    setConcerns((prev) => {
      if (id === 'full_judgment_review') return ['full_judgment_review'];
      const without = prev.filter((c) => c !== 'full_judgment_review');
      return without.includes(id) ? without.filter((c) => c !== id) : [...without, id];
    });
  };

  const run = async () => {
    const ctx: UserReviewContext = {
      audience_hint: audienceHint.trim() || undefined,
      biggest_worry: worry.trim() || undefined,
      concerns,
    };
    const artifact = ingest({ source_kind: sourceKind, title, text, privacy_mode: 'receipt_only' });
    setPhase('running');
    setReceipt(null);
    const { job: finalJob, receipt: r } = await runDocumentReview(artifact, {
      context: ctx,
      onProgress: setJob,
    });
    setJob(finalJob);
    if (r && (finalJob.status === 'ready' || finalJob.status === 'needs_context')) {
      store.saveReceipt(r);
      setReceipt(r);
      setPhase('done');
    } else {
      setPhase('failed');
    }
  };

  const reset = () => {
    setPhase('import');
    setText('');
    setTitle('');
    setSourceKind('paste');
    setPendingBinary(null);
    setJob(null);
    setReceipt(null);
  };

  const canRun = text.trim().length > 20 || pendingBinary !== null;

  if (phase === 'done' && receipt) {
    const sealed = receipt.state === 'sealed';
    return (
      <div className="max-w-2xl mx-auto w-full">
        {sealed && (
          <Card variant="success" className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-green-700 mb-1">봉인됨</div>
            <p className="text-[13px] text-[var(--text-primary)]">
              예측을 봉인했습니다. 확인일에 현실이 답할 때까지 이 판단은 살아 있습니다.
            </p>
          </Card>
        )}
        <ReceiptView
          receipt={receipt}
          onOwn={(o, owned) => {
            store.setObligationOwned(receipt.receipt_id, o.obligation_id, owned);
            const updated = store.getReceipt(receipt.receipt_id);
            if (updated) setReceipt(updated);
          }}
          onSeal={() => setSealing(true)}
        />
        <div className="mt-6">
          <Button variant="ghost" size="sm" onClick={reset}>
            다른 문서 검수하기
          </Button>
        </div>
        {sealing && receipt.falsifiable_followups.length > 0 && (
          <SealModal
            followups={receipt.falsifiable_followups}
            onClose={() => setSealing(false)}
            onSeal={(followupId, patch) => {
              store.sealFollowup(receipt.receipt_id, followupId, patch);
              const updated = store.getReceipt(receipt.receipt_id);
              if (updated) setReceipt(updated);
              setSealing(false);
            }}
          />
        )}
      </div>
    );
  }

  if (phase === 'running') {
    return (
      <div className="max-w-2xl mx-auto w-full">
        <Card variant="elevated">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)] mb-2">검수 중</div>
          <p className="text-[15px] text-[var(--text-primary)]">{job?.progress_label ?? '문서를 읽는 중'}…</p>
          <div className="mt-3 flex gap-1">
            {['profiling', 'mapping', 'routing', 'reviewing', 'synthesizing'].map((s) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full ${
                  job && stageIndex(job.status) >= stageIndex(s) ? 'bg-[var(--accent)]' : 'bg-[var(--border-subtle)]'
                }`}
              />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (phase === 'failed') {
    return (
      <div className="max-w-2xl mx-auto w-full">
        <Card variant="danger">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-700 mb-2">검수 어려움</div>
          <p className="text-[14px] text-[var(--text-primary)]">
            {job?.error?.message ?? '이 문서는 지금 상태로는 검수하기 어렵습니다.'}
          </p>
          {job?.error?.recovery && (
            <p className="mt-2 text-[13px] text-[var(--text-secondary)]">{job.error.recovery}</p>
          )}
          <div className="mt-4">
            <Button variant="accent" size="sm" onClick={reset}>
              본문 붙여넣어 다시 검수
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // import screen
  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col gap-4">
      <div>
        <h1 className="text-[20px] font-bold text-[var(--text-primary)]">기존 문서 검수하기</h1>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          전략안·기획안·PRD·AI 답변을 넣으면, 사람이 책임져야 할 판단과 근거 약한 주장을 원문 위치와 함께 짚어드립니다.
        </p>
      </div>

      <Card>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (sourceKind !== 'paste' && sourceKind !== 'markdown') setSourceKind('paste');
            setPendingBinary(null);
          }}
          maxLength={60000}
          placeholder="검수할 문서를 붙여넣으세요. (전략 메모, 기획안, Claude/ChatGPT 답변 등)"
          className="w-full h-52 resize-y bg-transparent text-[14px] leading-[1.6] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
        />
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2">
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,.txt,.text,.pdf,.docx,.pptx"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            파일 업로드 (md · txt · pdf · docx · pptx)
          </Button>
          <span className="text-[11px] text-[var(--text-tertiary)]">{text.length > 0 ? `${text.length}자` : ''}</span>
        </div>
        {pendingBinary && (
          <p className="mt-2 text-[12px] text-amber-700">
            {pendingBinary.toUpperCase()} 파일은 아직 자동 텍스트 추출을 지원하지 않습니다. 그대로 검수하면 “무엇이 빠졌는지”를
            먼저 보여주고, 본문을 붙여넣으면 정식 검수합니다.
          </p>
        )}
      </Card>

      {/* concern chips */}
      <div>
        <div className="text-[11px] font-bold text-[var(--text-secondary)] mb-1.5">어떤 검수를 원하세요?</div>
        <div className="flex flex-wrap gap-1.5">
          {CONCERN_CHIPS.map((c) => (
            <button
              key={c.id}
              onClick={() => toggleConcern(c.id)}
              className={`px-2.5 py-1 text-[12px] rounded-full border transition-colors ${
                concerns.includes(c.id)
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)]'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* optional minimal context */}
      <details className="text-[13px]">
        <summary className="cursor-pointer text-[var(--text-tertiary)]">맥락 3가지 (선택 — 비워도 됩니다)</summary>
        <div className="mt-2 flex flex-col gap-2">
          <input
            value={audienceHint}
            onChange={(e) => setAudienceHint(e.target.value)}
            maxLength={120}
            placeholder="누구에게 보여줄 문서인가요? (예: 경영진, 투자자)"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none"
          />
          <input
            value={worry}
            onChange={(e) => setWorry(e.target.value)}
            maxLength={200}
            placeholder="지금 가장 불안한 부분은 무엇인가요?"
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none"
          />
        </div>
      </details>

      <div>
        <Button variant="accent" size="md" onClick={run} disabled={!canRun} style={canRun ? undefined : { opacity: 0.5 }}>
          검수 시작
        </Button>
      </div>
    </div>
  );
}

function stageIndex(status: string): number {
  return ['queued', 'extracting', 'profiling', 'mapping', 'routing', 'reviewing', 'synthesizing', 'ready'].indexOf(status);
}
