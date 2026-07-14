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
import { useLocale } from '@/hooks/useLocale';
import { useReviewStore } from '@/stores/useReviewStore';
import { ReceiptView } from './ReceiptView';
import { ReceiptList } from './ReceiptList';
import { PremiseTracker } from './PremiseTracker';
import { SealStamp } from '@/components/workspace/progressive/SealStamp';
import { SealModal } from './SealModal';
import { SettleModal } from './SettleModal';
import { extractFile, type ExtractedText } from '@/lib/review/extract-file';
import { useSettingsStore, hasOwnApiKey } from '@/stores/useSettingsStore';
import { getStorage, setStorage, STORAGE_KEYS } from '@/lib/storage';
import { track } from '@/lib/analytics';
import {
  ingest,
  runDocumentReview,
  DEFAULT_BUDGET,
  diffReceipts,
  type ReviewJob,
  type SourceKind,
  type ReviewConcern,
  type UserReviewContext,
} from '@/lib/review';

type Phase = 'list' | 'import' | 'running' | 'receipt' | 'failed';

const TEXT_EXT = ['md', 'markdown', 'txt', 'text'];
const BINARY_EXT: Record<string, SourceKind> = { pdf: 'pdf', docx: 'docx', pptx: 'pptx' };

/** Paste cap — matched to the server's MAX_MESSAGE_LENGTH (50_000, lib/llm-validation.ts)
 *  so a large paste degrades honestly (coverage note) instead of a hard 400. */
const PASTE_CHAR_CAP = 50_000;
/** Review-level wall-clock budget. The pipeline is internally bounded per call,
 *  but serial stages compound; this caps the worst case a user can wait. */
const REVIEW_DEADLINE_MS = 150_000;

export function ReviewFlow() {
  const locale = useLocale();
  const L = (ko: string, en: string) => (locale === 'ko' ? ko : en);
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
  // BYOK gate: a full-document review burns tokens, so a user NOT on their own
  // API key gets one lifetime free review. `freeUsed` is the local soppy flag;
  // the server-side daily rate limit is the real cost backstop.
  const settings = useSettingsStore((s) => s.settings);
  const ownKey = hasOwnApiKey(settings);
  const [freeUsed, setFreeUsed] = useState(false);
  const gateBlocked = !ownKey && freeUsed;
  const fileRef = useRef<HTMLInputElement>(null);
  // Lets the user cancel an in-flight review. Without it a long extraction on a
  // large document reads as a frozen "분석 중" screen with no way out.
  const abortRef = useRef<AbortController | null>(null);
  // Why the current run was aborted: 'user' (cancel button → back to import) vs
  // 'deadline' (wall-clock budget → a clear failure). Distinguishing them keeps
  // a genuine cancel silent and a timeout honest.
  const abortReasonRef = useRef<'user' | 'deadline' | null>(null);

  const CONCERN_CHIPS: { id: ReviewConcern; label: string }[] = [
    { id: 'full_judgment_review', label: L('전체 판단 검수', 'Full judgment review') },
    { id: 'strategic_fit', label: L('전략 적합성', 'Strategic fit') },
    { id: 'evidence', label: L('근거/주장 검증', 'Evidence & claims') },
    { id: 'stakeholder_objection', label: L('이해관계자 반론', 'Stakeholder objections') },
    { id: 'execution_risk', label: L('실행 리스크', 'Execution risk') },
    { id: 'ai_answer_trust', label: L('AI 답변 신뢰성', 'AI answer reliability') },
  ];

  // Load persisted receipts once; open on the list when any exist, else import.
  useEffect(() => {
    useReviewStore.getState().load();
    useSettingsStore.getState().loadSettings();
    setFreeUsed(getStorage<boolean>(STORAGE_KEYS.REVIEW_FREE_USED, false));
    const receipts = useReviewStore.getState().receipts;
    const params = new URLSearchParams(window.location.search);
    const requestedReceipt = params.get('receipt');
    if (requestedReceipt && receipts.some((r) => r.receipt_id === requestedReceipt)) {
      setActiveId(requestedReceipt);
      setPhase('receipt');
      return;
    }
    setPhase(receipts.length > 0 ? 'list' : 'import');
  }, []);

  useEffect(() => {
    if (phase !== 'receipt') return;
    const premiseId = new URLSearchParams(window.location.search).get('premise');
    if (!premiseId) return;
    window.setTimeout(() => {
      document.getElementById(`premise-${premiseId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 50);
  }, [phase]);

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
          setExtractNote(extracted.note ?? L('텍스트를 거의 추출하지 못했습니다.', 'Almost no text could be extracted.'));
        }
      } catch {
        setPendingBinary(BINARY_EXT[ext]);
        setExtractNote(L('이 파일에서 텍스트를 추출하지 못했습니다.', 'Could not extract text from this file.'));
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
    // Defense in depth (the button is also disabled): never start a review once
    // the one free use is spent and no personal key is connected.
    if (!hasOwnApiKey(useSettingsStore.getState().settings)
        && getStorage<boolean>(STORAGE_KEYS.REVIEW_FREE_USED, false)) {
      setFreeUsed(true);
      return;
    }
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
      // Carry the extractor's page/slide/unit caps so the receipt discloses how
      // much of the source was actually reviewed (honest coverage).
      source_caps: preExtracted
        ? {
            pages_total: preExtracted.pages_total,
            pages_read: preExtracted.pages_read,
            slides_total: preExtracted.slides_total,
            slides_read: preExtracted.slides_read,
            units_capped: preExtracted.units_capped,
          }
        : undefined,
    });
    const controller = new AbortController();
    abortRef.current = controller;
    abortReasonRef.current = null;
    setElapsed(0);
    setPhase('running');
    // Wall-clock budget: the pipeline is internally bounded (120s × retries per
    // call) but that compounds across serial stages into many minutes. A single
    // review-level deadline caps the worst case to ~REVIEW_DEADLINE_MS.
    const deadline = setTimeout(() => {
      if (abortRef.current) { abortReasonRef.current = 'deadline'; abortRef.current.abort(); }
    }, REVIEW_DEADLINE_MS);
    const sourceLength = (preExtracted?.text || text).length;
    const budget = sourceLength <= 6_000 && artifact.units.length <= 20
      ? DEFAULT_BUDGET.quick
      : DEFAULT_BUDGET.standard;
    const { job: finalJob, receipt: r } = await runDocumentReview(artifact, {
      context: ctx,
      budget,
      onProgress: setJob,
      signal: controller.signal,
    });
    clearTimeout(deadline);
    abortRef.current = null;
    if (controller.signal.aborted) {
      if (abortReasonRef.current === 'deadline') {
        // Timed out → an honest failure with a way forward, not a silent hang.
        setJob({
          job_id: finalJob.job_id, artifact_id: finalJob.artifact_id, status: 'failed',
          progress_label: L('검수 시간 초과', 'Review timed out'),
          error: {
            kind: 'model_error',
            message: L('검수가 예상보다 오래 걸려 중단했어요.', 'The review took longer than expected, so we stopped it.'),
            recovery: L(
              '문서를 더 짧게 나눠서 넣거나, 핵심 부분만 붙여넣어 다시 시도해 주세요.',
              'Try splitting the document into shorter pieces, or paste just the key section and run it again.',
            ),
          },
        });
        setPhase('failed');
        track('review_timeout', { elapsed_s: elapsed });
        return;
      }
      // User cancelled → return to import quietly (their text is preserved).
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
      // Consume the one free document review (only on a completed review, only
      // for users without their own key) — a full review's token cost is why.
      if (!hasOwnApiKey(useSettingsStore.getState().settings)) {
        setStorage(STORAGE_KEYS.REVIEW_FREE_USED, true);
        setFreeUsed(true);
      }
      setSessionSource({ id: r.receipt_id, text: effectiveText });
      setActiveId(r.receipt_id);
      setShowOriginal(false);
      track('review_completed', {
        source_kind: r.source_kind,
        reviewability: r.reviewability?.score ?? null,
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
              {L(`버전 ${receipt.version} · 재검수`, `Version ${receipt.version} · Re-review`)}
            </div>
            <p className="text-[13px] text-[var(--text-primary)]">{receipt.drift_note}</p>
          </Card>
        )}
        {sealed && (() => {
          // Certificate miniature (P1-A3 S5): the same ink seal as the voyage's
          // sealing ceremony, small stage — one aesthetic across both surfaces
          // (the green form-saved badge used to read like a different product).
          const sealedFu = receipt.falsifiable_followups.find((f) => f.sealed_at) ?? receipt.falsifiable_followups[0];
          const stampDate = sealedFu?.check_by
            ? `${Number(sealedFu.check_by.slice(5, 7))}.${Number(sealedFu.check_by.slice(8, 10))}`
            : '';
          return (
            <Card variant="elevated" className="mb-4">
              <div className="flex items-center gap-3">
                {stampDate && <SealStamp date={stampDate} size={44} className="shrink-0" />}
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)] mb-1">{L('봉인됨', 'Sealed')}</div>
                  <p className="text-[13px] text-[var(--text-primary)]">
                    {L(
                      '예측을 봉인했습니다. 확인일에 현실이 답할 때까지 이 판단은 살아 있습니다.',
                      'Your prediction is sealed. This judgment stays live until reality answers on the check-in date.',
                    )}
                  </p>
                </div>
              </div>
            </Card>
          );
        })()}
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
        <div className="mt-4">
          <PremiseTracker receipt={receipt} />
        </div>
      </>
    );

    return (
      <div className={original ? 'max-w-6xl mx-auto w-full' : 'max-w-2xl mx-auto w-full'}>
        <div className="mb-3 flex items-center justify-between">
          <button onClick={backToList} className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)]">
            {L('← 내 검수 기록', '← My review record')}
          </button>
          {original && (
            <button
              onClick={() => setShowOriginal((v) => !v)}
              className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] md:hidden"
            >
              {showOriginal ? L('원문 숨기기', 'Hide original') : L('원문 보기', 'Show original')}
            </button>
          )}
        </div>

        {original ? (
          <div className="flex flex-col md:flex-row gap-5">
            {/* left: original document (Review Workspace §837) */}
            <div className={`md:w-1/2 ${showOriginal ? '' : 'hidden md:block'}`}>
              <Card variant="muted" className="md:sticky md:top-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-tertiary)] mb-2">{L('원문', 'Original')}</div>
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
            {L('다른 문서 검수하기', 'Review another document')}
          </Button>
          <Button variant="ghost" size="sm" onClick={backToList}>
            {L('목록으로', 'Back to list')}
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
              onRevise={(newCheckBy, reason) => {
                store.reviseFollowup(receipt.receipt_id, settlingId, newCheckBy, reason);
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
    const longSource = (preExtracted?.text || text).length > 12_000
      || (preExtracted?.pages_read ?? 0) > 20
      || (preExtracted?.slides_read ?? 0) > 30;
    const mm = Math.floor(elapsed / 60);
    const ss = String(elapsed % 60).padStart(2, '0');
    return (
      <div className="max-w-2xl mx-auto w-full">
        <Card variant="elevated">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">{L('검수 중', 'Reviewing')}</div>
            <span className="text-[11px] tabular-nums text-[var(--text-tertiary)]">
              {mm > 0 ? `${mm}:${ss}` : L(`${elapsed}초`, `${elapsed}s`)}
            </span>
          </div>
          <p className="text-[15px] text-[var(--text-primary)]">{job?.progress_label ?? L('문서를 읽는 중', 'Reading the document')}…</p>
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
              {L(
                longSource
                  ? '긴 문서라 평소보다 오래 걸리고 있어요 — 계속 읽는 중입니다. 기다리기 어렵다면 취소하고 더 짧게 나눠도 돼요.'
                  : '예상보다 오래 걸리고 있지만 계속 검수 중이에요. 기다리기 어렵다면 취소해도 입력 내용은 그대로 남아 있어요.',
                longSource
                  ? "This is a long document, so it's taking longer than usual. You can cancel and review it in smaller pieces."
                  : "This is taking longer than expected, but the review is still running. You can cancel without losing your input.",
              )}
            </p>
          )}
          <div className="mt-4">
            <Button variant="ghost" size="sm" onClick={() => { abortReasonRef.current = 'user'; abortRef.current?.abort(); }}>
              {L('취소', 'Cancel')}
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
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-700 mb-2">{L('검수 어려움', 'Unable to review')}</div>
          <p className="text-[14px] text-[var(--text-primary)]">
            {job?.error?.message ?? L('이 문서는 지금 상태로는 검수하기 어렵습니다.', 'This document is hard to review in its current form.')}
          </p>
          {job?.error?.recovery && (
            <p className="mt-2 text-[13px] text-[var(--text-secondary)]">{job.error.recovery}</p>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="accent" size="sm" onClick={resetImport}>
              {L('본문 붙여넣어 다시 검수', 'Paste the text and retry')}
            </Button>
            {store.receipts.length > 0 && (
              <Button variant="ghost" size="sm" onClick={backToList}>
                {L('목록으로', 'Back to list')}
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
          <h1 className="text-[20px] font-bold text-[var(--text-primary)]">{L('기존 문서 검수하기', 'Review an existing document')}</h1>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            {L(
              '전략안·기획안·PRD·AI 답변을 넣으면, 사람이 책임져야 할 판단과 근거 약한 주장을 원문 위치와 함께 짚어드립니다.',
              'Drop in a strategy doc, proposal, PRD, or AI answer — Argus points out the judgments a human must own and the weakly supported claims, anchored to where they appear in the source.',
            )}
          </p>
        </div>
        {store.receipts.length > 0 && (
          <Button variant="ghost" size="sm" onClick={backToList}>
            {L('내 검수 기록', 'My review record')}
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
          maxLength={PASTE_CHAR_CAP}
          placeholder={L(
            '검수할 문서를 붙여넣으세요. (전략 메모, 기획안, Claude/ChatGPT 답변 등)',
            'Paste the document to review. (Strategy memo, proposal, Claude/ChatGPT answer, etc.)',
          )}
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
            {extracting
              ? L('텍스트 추출 중…', 'Extracting text…')
              : L('파일 업로드 (md · txt · pdf · docx · pptx)', 'Upload a file (md · txt · pdf · docx · pptx)')}
          </Button>
          <span className={`text-[11px] ${text.length >= PASTE_CHAR_CAP ? 'text-amber-700 font-semibold' : 'text-[var(--text-tertiary)]'}`}>
            {text.length >= PASTE_CHAR_CAP
              ? L(
                  `최대 ${PASTE_CHAR_CAP.toLocaleString()}자 — 초과분은 잘립니다`,
                  `Max ${PASTE_CHAR_CAP.toLocaleString()} characters — anything over is cut off`,
                )
              : text.length > 0 ? L(`${text.length.toLocaleString()}자`, `${text.length.toLocaleString()} characters`) : ''}
          </span>
        </div>
        {preExtracted && (
          <p className="mt-2 text-[12px] text-green-700">
            {L(
              `${sourceKind.toUpperCase()}에서 텍스트를 추출했습니다${extractNote ? ` — ${extractNote}` : ''}. 그대로 검수를 시작할 수 있습니다.`,
              `Extracted text from the ${sourceKind.toUpperCase()}${extractNote ? ` — ${extractNote}` : ''}. You can start the review as is.`,
            )}
          </p>
        )}
        {pendingBinary && (
          <p className="mt-2 text-[12px] text-amber-700">
            {extractNote ? `${extractNote} ` : ''}
            {L(
              `${pendingBinary.toUpperCase()} 파일에서 충분한 텍스트를 얻지 못했습니다. 그대로 검수하면 “무엇이 빠졌는지”를 먼저 보여주고, 본문을 붙여넣으면 정식 검수합니다.`,
              `Not enough text could be read from the ${pendingBinary.toUpperCase()} file. Review it as is and Argus will first show what's missing; paste the text for a full review.`,
            )}
          </p>
        )}
      </Card>

      {/* concern chips */}
      <div>
        <div className="text-[11px] font-bold text-[var(--text-secondary)] mb-1.5">{L('어떤 검수를 원하세요?', 'What kind of review do you want?')}</div>
        <div className="flex flex-wrap gap-1.5">
          {CONCERN_CHIPS.map((c) => (
            <button
              key={c.id}
              onClick={() => toggleConcern(c.id)}
              className={`min-h-[36px] px-2.5 py-1 text-[12px] rounded-full border transition-colors ${
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
        <summary className="cursor-pointer text-[var(--text-tertiary)]">
          {L('맥락 3가지 (선택 — 비워도 됩니다)', 'A little context (optional — fine to leave blank)')}
        </summary>
        <div className="mt-2 flex flex-col gap-2">
          <input
            value={audienceHint}
            onChange={(e) => setAudienceHint(e.target.value)}
            maxLength={120}
            placeholder={L('누구에게 보여줄 문서인가요? (예: 경영진, 투자자)', 'Who will see this document? (e.g. leadership, investors)')}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none"
          />
          <input
            value={worry}
            onChange={(e) => setWorry(e.target.value)}
            maxLength={200}
            placeholder={L('지금 가장 불안한 부분은 무엇인가요?', 'What worries you most right now?')}
            className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-transparent text-[13px] outline-none"
          />
        </div>
      </details>

      {/* storage privacy (design doc §저장 원칙) — receipt-only storage is the default */}
      <label className="flex items-start gap-2 text-[12px] text-[var(--text-secondary)] cursor-pointer">
        <input type="checkbox" checked={storeSource} onChange={(e) => setStoreSource(e.target.checked)} className="mt-0.5" />
        <span>
          {L('원문도 함께 저장하기', 'Also store the original text')}
          <span className="block text-[11px] text-[var(--text-tertiary)]">
            {storeSource
              ? L(
                  '원문을 저장해 검수 결과 옆에서 나란히 볼 수 있습니다.',
                  'The original is stored so you can view it side by side with the review.',
                )
              : L(
                  '기본은 결과 요약만 저장해요(원문은 저장 안 함) — 판단과 확인 조건만 남깁니다.',
                  'By default only the receipt is stored — never your document text. Just the judgments and check conditions remain.',
                )}
          </span>
        </span>
      </label>

      {gateBlocked && (
        <Card variant="muted" className="border border-[var(--border-subtle)]">
          <div className="text-[13px] font-medium text-[var(--text-primary)] mb-1">
            {L('무료 문서 검수 1회를 모두 사용했어요', 'You’ve used your one free document review')}
          </div>
          <p className="text-[12px] leading-[1.6] text-[var(--text-secondary)] mb-3">
            {L(
              '문서 전체 검수는 토큰을 많이 써서, 자기 API 키를 연결하지 않으면 평생 1회로 제한돼요. 설정에서 API 키를 연결하면 횟수 제한 없이 계속 검수할 수 있어요(요금은 본인 키로 청구됩니다).',
              'A full-document review uses a lot of tokens, so without your own API key it’s limited to one lifetime review. Connect an API key in Settings to keep reviewing with no limit (billed to your own key).',
            )}
          </p>
          <a
            href={`/${locale}/settings`}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
          >
            {L('설정에서 API 키 연결하기 →', 'Connect an API key in Settings →')}
          </a>
        </Card>
      )}

      <div>
        <Button variant="accent" size="md" onClick={run} disabled={!canRun || gateBlocked}>
          {L('검수 시작', 'Start review')}
        </Button>
      </div>
    </div>
  );
}

function stageIndex(status: string): number {
  return ['queued', 'extracting', 'profiling', 'mapping', 'routing', 'reviewing', 'synthesizing', 'ready'].indexOf(status);
}
