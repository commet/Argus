'use client';

/**
 * Document Review flow (design doc §"제품 루프" + §"UI 화면 / 상태").
 * Import → progress → Judgment Receipt, plus the Active Course list that lets a
 * user *return* to a saved receipt to seal/settle it. The wedge is "기존 문서
 * 검수하기": paste or upload a strategy doc / plan / AI answer, get a receipt
 * whose findings are anchored to the source. Binary formats extract when a
 * parser is available and degrade honestly when not.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useReviewStore } from '@/stores/useReviewStore';
import { ReceiptView } from './ReceiptView';
import { ReceiptList } from './ReceiptList';
import { SealModal } from './SealModal';
import { SettleModal } from './SettleModal';
import { extractFile, type ExtractedText } from '@/lib/review/extract-file';
import { track } from '@/lib/analytics';
import {
  ingest,
  runDocumentReview,
  diffReceipts,
  type ReviewJob,
  type SourceKind,
  type ReviewConcern,
  type UserReviewContext,
} from '@/lib/review';

type Phase = 'list' | 'import' | 'running' | 'receipt' | 'failed';

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
  const [phase, setPhase] = useState<Phase>('list');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [sourceKind, setSourceKind] = useState<SourceKind>('paste');
  const [pendingBinary, setPendingBinary] = useState<SourceKind | null>(null);
  const [extractNote, setExtractNote] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [preExtracted, setPreExtracted] = useState<ExtractedText | null>(null);
  const [concerns, setConcerns] = useState<ReviewConcern[]>(['full_judgment_review']);
  const [audienceHint, setAudienceHint] = useState('');
  const [worry, setWorry] = useState('');
  const [storeSource, setStoreSource] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [sessionSource, setSessionSource] = useState<{ id: string; text: string } | null>(null);
  const [job, setJob] = useState<ReviewJob | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sealing, setSealing] = useState(false);
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  // Lets the user cancel an in-flight review. Without it a long extraction on a
  // large document reads as a frozen "분석 중" screen with no way out.
  const abortRef = useRef<AbortController | null>(null);

  // Load persisted receipts once; open on the list when any exist, else import.
  useEffect(() => {
    useReviewStore.getState().load();
    const has = useReviewStore.getState().receipts.length > 0;
    setPhase(has ? 'list' : 'import');
  }, []);

  // Elapsed counter while a review runs — turns the otherwise static spinner
  // into live feedback (and gates the "오래 걸리고 있어요" reassurance below).
  useEffect(() => {
    if (phase !== 'running') { setElapsed(0); return; }
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Derive the active receipt from the store so seal/settle/own reflect live.
  const receipt = useMemo(
    () => (activeId ? store.receipts.find((r) => r.receipt_id === activeId) ?? null : null),
    [activeId, store.receipts],
  );

  const onFile = async (file: File) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    setTitle(file.name);
    setExtractNote(null);
    setPreExtracted(null);
    if (TEXT_EXT.includes(ext)) {
      const content = await file.text();
      setText(content);
      setSourceKind(ext.startsWith('md') ? 'markdown' : 'txt');
      setPendingBinary(null);
    } else if (BINARY_EXT[ext]) {
      setSourceKind(BINARY_EXT[ext]);
      setExtracting(true);
      setText('');
      try {
        const extracted = await extractFile(file, BINARY_EXT[ext]);
        if (extracted.text.trim().length > 20) {
          // Parser succeeded — feed structured text straight into the pipeline.
          setPreExtracted(extracted);
          setPendingBinary(null);
          setExtractNote(extracted.note ?? null);
        } else {
          // Parser ran but got nothing usable (scanned PDF, image-only deck).
          setPendingBinary(BINARY_EXT[ext]);
          setExtractNote(extracted.note ?? '텍스트를 거의 추출하지 못했습니다.');
        }
      } catch {
        setPendingBinary(BINARY_EXT[ext]);
        setExtractNote('이 파일에서 텍스트를 추출하지 못했습니다.');
      } finally {
        setExtracting(false);
      }
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
    const artifact = ingest({
      source_kind: sourceKind,
      title,
      text,
      privacy_mode: storeSource ? 'store_source' : 'receipt_only',
      pre_extracted: preExtracted?.text,
      pre_extracted_units: preExtracted?.units,
      extraction_quality: preExtracted?.quality,
      extraction_notes: preExtracted?.note ? [preExtracted.note] : undefined,
    });
    const controller = new AbortController();
    abortRef.current = controller;
    setElapsed(0);
    setPhase('running');
    const { job: finalJob, receipt: r } = await runDocumentReview(artifact, {
      context: ctx,
      onProgress: setJob,
      signal: controller.signal,
    });
    abortRef.current = null;
    // User cancelled mid-run → return to the import screen quietly (their text
    // is still there), no error card. The pipeline swallows the abort into a
    // 'failed' job, so check the signal rather than the job status.
    if (controller.signal.aborted) {
      setJob(null);
      setPhase('import');
      track('review_cancelled', { elapsed_s: elapsed });
      return;
    }
    setJob(finalJob);
    if (r && (finalJob.status === 'ready' || finalJob.status === 'needs_context')) {
      // store_source: keep the original for the side-by-side workspace on return.
      const effectiveText = preExtracted?.text || text;
      if (storeSource) r.source_text = effectiveText;

      // Version drift (Loop B §747): link a re-review of the same source.
      const prev = store.receipts.find(
        (x) => x.source_fingerprint === r.source_fingerprint && x.receipt_id !== r.receipt_id,
      );
      if (prev) {
        r.previous_receipt_id = prev.receipt_id;
        r.version = (prev.version ?? 1) + 1;
        r.drift_note = diffReceipts(prev, r).note;
      } else {
        r.version = 1;
      }

      store.saveReceipt(r);
      setSessionSource({ id: r.receipt_id, text: effectiveText });
      setActiveId(r.receipt_id);
      setShowOriginal(false);
      track('review_completed', {
        source_kind: r.source_kind,
        reviewability: r.reviewability.score,
        findings: r.findings.length,
        obligations: r.judgment_obligations.length,
        version: r.version,
        needs_context: finalJob.status === 'needs_context',
      });
      setPhase('receipt');
    } else {
      setPhase('failed');
    }
  };

  const resetImport = () => {
    setText('');
    setTitle('');
    setSourceKind('paste');
    setPendingBinary(null);
    setExtractNote(null);
    setPreExtracted(null);
    setJob(null);
    setPhase('import');
  };

  const backToList = () => {
    setActiveId(null);
    setJob(null);
    setPhase('list');
  };

  const canRun = text.trim().length > 20 || pendingBinary !== null || Boolean(preExtracted);

  // ---- receipt view (freshly reviewed OR reopened from the list) ----
  if (phase === 'receipt' && receipt) {
    const sealed = receipt.state === 'sealed';
    const original = receipt.source_text || (sessionSource?.id === receipt.receipt_id ? sessionSource.text : '');
    const reReview = () => {
      if (original) setText(original);
      resetImport();
    };
    const receiptPane = (
      <>
        {receipt.version && receipt.version > 1 && receipt.drift_note && (
          <Card variant="checkpoint" className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-700 mb-1">
              버전 {receipt.version} · 재검수
            </div>
            <p className="text-[13px] text-[var(--text-primary)]">{receipt.drift_note}</p>
          </Card>
        )}
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
            if (owned) track('judgment_obligation_selected', { receipt_id: receipt.receipt_id });
          }}
          onSeal={() => setSealing(true)}
          onSettle={(followupId) => setSettlingId(followupId)}
          onReReview={reReview}
        />
      </>
    );

    return (
      <div className={original ? 'max-w-6xl mx-auto w-full' : 'max-w-2xl mx-auto w-full'}>
        <div className="mb-3 flex items-center justify-between">
          <button onClick={backToList} className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)]">
            ← 내 판단 항로
          </button>
          {original && (
            <button
              onClick={() => setShowOriginal((v) => !v)}
              className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] md:hidden"
            >
              {showOriginal ? '원문 숨기기' : '원문 보기'}
            </button>
          )}
        </div>

        {original ? (
          <div className="flex flex-col md:flex-row gap-5">
            {/* left: original document (Review Workspace §837) */}
            <div className={`md:w-1/2 ${showOriginal ? '' : 'hidden md:block'}`}>
              <Card variant="muted" className="md:sticky md:top-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-tertiary)] mb-2">원문</div>
                <pre className="whitespace-pre-wrap break-words text-[12px] leading-[1.7] text-[var(--text-secondary)] max-h-[70vh] overflow-y-auto font-sans">
                  {original}
                </pre>
              </Card>
            </div>
            {/* right: receipt */}
            <div className="md:w-1/2">{receiptPane}</div>
          </div>
        ) : (
          receiptPane
        )}

        <div className="mt-6 flex gap-2">
          <Button variant="ghost" size="sm" onClick={resetImport}>
            다른 문서 검수하기
          </Button>
          <Button variant="ghost" size="sm" onClick={backToList}>
            목록으로
          </Button>
        </div>

        {sealing && receipt.falsifiable_followups.length > 0 && (
          <SealModal
            followups={receipt.falsifiable_followups}
            onClose={() => setSealing(false)}
            onSeal={(followupId, patch) => {
              store.sealFollowup(receipt.receipt_id, followupId, patch);
              track('receipt_sealed', { receipt_id: receipt.receipt_id });
              setSealing(false);
            }}
          />
        )}
        {settlingId && (() => {
          const fu = receipt.falsifiable_followups.find((f) => f.followup_id === settlingId);
          return fu ? (
            <SettleModal
              followup={fu}
              onClose={() => setSettlingId(null)}
              onSettle={(outcome, whatHappened, learned) => {
                store.settleFollowup(receipt.receipt_id, settlingId, outcome, whatHappened, learned);
                track('settled', { receipt_id: receipt.receipt_id, outcome });
                setSettlingId(null);
              }}
              onRevise={(newCheckBy) => {
                store.reviseFollowup(receipt.receipt_id, settlingId, newCheckBy);
                track('reopened_or_revised', { receipt_id: receipt.receipt_id, kind: 'revise' });
                setSettlingId(null);
              }}
            />
          ) : null;
        })()}
      </div>
    );
  }

  if (phase === 'running') {
    const longWait = elapsed >= 25;
    const mm = Math.floor(elapsed / 60);
    const ss = String(elapsed % 60).padStart(2, '0');
    return (
      <div className="max-w-2xl mx-auto w-full">
        <Card variant="elevated">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">검수 중</div>
            <span className="text-[11px] tabular-nums text-[var(--text-tertiary)]">
              {mm > 0 ? `${mm}:${ss}` : `${elapsed}초`}
            </span>
          </div>
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
          {/* Long-wait reassurance — a big real document can take a while to
              read. Says it's still working (not stuck) and offers a way out. */}
          {longWait && (
            <p className="mt-3 text-[12px] text-[var(--text-secondary)] leading-[1.6]">
              긴 문서라 평소보다 오래 걸리고 있어요 — 계속 읽는 중입니다. 너무 길면 취소하고 더 짧게 나눠서 검수해 보세요.
            </p>
          )}
          <div className="mt-4">
            <Button variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
              취소
            </Button>
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
          <div className="mt-4 flex gap-2">
            <Button variant="accent" size="sm" onClick={resetImport}>
              본문 붙여넣어 다시 검수
            </Button>
            {store.receipts.length > 0 && (
              <Button variant="ghost" size="sm" onClick={backToList}>
                목록으로
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  if (phase === 'list') {
    return (
      <ReceiptList
        receipts={store.receipts}
        onOpen={(id) => {
          setActiveId(id);
          setShowOriginal(false);
          setPhase('receipt');
          track('return_opened', { receipt_id: id, source: 'active_course' });
        }}
        onNew={resetImport}
        onRemove={(id) => store.remove(id)}
      />
    );
  }

  // import screen
  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--text-primary)]">기존 문서 검수하기</h1>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            전략안·기획안·PRD·AI 답변을 넣으면, 사람이 책임져야 할 판단과 근거 약한 주장을 원문 위치와 함께 짚어드립니다.
          </p>
        </div>
        {store.receipts.length > 0 && (
          <Button variant="ghost" size="sm" onClick={backToList}>
            내 항로
          </Button>
        )}
      </div>

      <Card>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (sourceKind !== 'paste' && sourceKind !== 'markdown') setSourceKind('paste');
            setPendingBinary(null);
            setPreExtracted(null);
            setExtractNote(null);
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
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={extracting}>
            {extracting ? '텍스트 추출 중…' : '파일 업로드 (md · txt · pdf · docx · pptx)'}
          </Button>
          <span className="text-[11px] text-[var(--text-tertiary)]">{text.length > 0 ? `${text.length}자` : ''}</span>
        </div>
        {preExtracted && (
          <p className="mt-2 text-[12px] text-green-700">
            {sourceKind.toUpperCase()}에서 텍스트를 추출했습니다{extractNote ? ` — ${extractNote}` : ''}. 그대로 검수를 시작할 수 있습니다.
          </p>
        )}
        {pendingBinary && (
          <p className="mt-2 text-[12px] text-amber-700">
            {extractNote ? `${extractNote} ` : ''}
            {pendingBinary.toUpperCase()} 파일에서 충분한 텍스트를 얻지 못했습니다. 그대로 검수하면 “무엇이 빠졌는지”를 먼저
            보여주고, 본문을 붙여넣으면 정식 검수합니다.
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

      {/* storage privacy (design doc §저장 원칙) — receipt_only is the default */}
      <label className="flex items-start gap-2 text-[12px] text-[var(--text-secondary)] cursor-pointer">
        <input type="checkbox" checked={storeSource} onChange={(e) => setStoreSource(e.target.checked)} className="mt-0.5" />
        <span>
          원문도 함께 저장하기
          <span className="block text-[11px] text-[var(--text-tertiary)]">
            {storeSource
              ? '원문을 저장해 검수 결과 옆에서 나란히 볼 수 있습니다.'
              : '기본은 원문을 저장하지 않습니다 — 판단과 확인 조건만 남깁니다. (receipt_only)'}
          </span>
        </span>
      </label>

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
