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
import { FileUp } from 'lucide-react';
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
import { extractFile, type ExtractedText, type SourcePreview } from '@/lib/review/extract-file';
import { SourceEvidencePane, countEvidenceByPage } from './SourceEvidencePane';
import { sealReviewObligation } from '@/lib/review-seal';
import { useSettingsStore, hasOwnApiKey } from '@/stores/useSettingsStore';
import { visionCapable } from '@/lib/llm';
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
  type JudgmentObligation,
} from '@/lib/review';

type Phase = 'list' | 'import' | 'running' | 'receipt' | 'failed';

const TEXT_EXT = ['md', 'markdown', 'txt', 'text'];
const BINARY_EXT: Record<string, SourceKind> = { pdf: 'pdf', docx: 'docx', pptx: 'pptx', hwpx: 'hwpx' };
/** Raster image formats Anthropic vision can read — reviewed purely visually (no
 *  text path), so they require a connected vision provider. */
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif'];

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
  // A file we can't turn into a review (image with no vision provider, unusable
  // image, legacy .hwp) — surfaced as an honest note instead of silently
  // disabling the button. `needsKey` adds the Settings link (vision-only case).
  const [uploadBlock, setUploadBlock] = useState<{ note: string; needsKey?: boolean } | null>(null);
  const [extracting, setExtracting] = useState(false);
  // Drag-and-drop onto the import card. dragDepth counts enter/leave across child
  // elements so the highlight doesn't flicker as the cursor crosses the textarea.
  const [dragOver, setDragOver] = useState(false);
  const dragDepth = useRef(0);
  const [preExtracted, setPreExtracted] = useState<ExtractedText | null>(null);
  const [concerns, setConcerns] = useState<ReviewConcern[]>(['full_judgment_review']);
  const [audienceHint, setAudienceHint] = useState('');
  const [worry, setWorry] = useState('');
  const [storeSource, setStoreSource] = useState(false);
  const [useVision, setUseVision] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [sourcePdfData, setSourcePdfData] = useState<Uint8Array | null>(null);
  const [sessionSource, setSessionSource] = useState<{ id: string; text: string; previews?: SourcePreview[]; sourceKind: SourceKind; title: string; pdfData?: Uint8Array; pageCount?: number } | null>(null);
  const [activeSourcePage, setActiveSourcePage] = useState<number | undefined>();
  const sourcePaneRef = useRef<HTMLDivElement>(null);
  const receiptPaneRef = useRef<HTMLDivElement>(null);
  const reattachFileRef = useRef<HTMLInputElement>(null);
  const [reattaching, setReattaching] = useState(false);
  const [reattachError, setReattachError] = useState<string | null>(null);
  const [job, setJob] = useState<ReviewJob | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [requestedReceiptId, setRequestedReceiptId] = useState<string | null>(null);
  const [requestedPremiseId, setRequestedPremiseId] = useState<string | null>(null);
  // Own & seal an obligation into the DKK ledger (unified action). null = closed.
  const [sealingObligation, setSealingObligation] = useState<JudgmentObligation | null>(null);
  const [sealBusy, setSealBusy] = useState(false);
  const [sealError, setSealError] = useState<string | null>(null);
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
    setRequestedReceiptId(requestedReceipt);
    setRequestedPremiseId(params.get('premise'));
    setPhase(receipts.length > 0 ? 'list' : 'import');
  }, []);

  // A signed-in receipt can arrive after the first local render when cloud
  // merge completes. Keep the deep link armed until that exact receipt exists;
  // then consume it once so later store updates do not pull the user back.
  useEffect(() => {
    if (!requestedReceiptId) return;
    if (!store.receipts.some((item) => item.receipt_id === requestedReceiptId)) return;
    setActiveId(requestedReceiptId);
    setPhase('receipt');
    setRequestedReceiptId(null);
  }, [requestedReceiptId, store.receipts]);

  useEffect(() => {
    if (phase !== 'receipt' || !activeId || !requestedPremiseId) return;
    const timer = window.setTimeout(() => {
      const premise = document.getElementById(`premise-${requestedPremiseId}`);
      premise?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      premise?.focus({ preventScroll: true });
      setRequestedPremiseId(null);
    }, 50);
    return () => window.clearTimeout(timer);
  }, [activeId, phase, requestedPremiseId]);

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
    setSourcePdfData(null);
    setTitle(file.name);
    setExtractNote(null);
    setPreExtracted(null);
    setUseVision(false);
    setUploadBlock(null);
    if (TEXT_EXT.includes(ext)) {
      const content = await file.text();
      setText(content);
      setSourceKind(ext.startsWith('md') ? 'markdown' : 'txt');
      setPendingBinary(null);
    } else if (ext === 'hwp') {
      // Legacy binary 한글 (.hwp, a CFB blob) has no in-browser parser. Degrade
      // honestly with the concrete fix (save as HWPX, or paste) instead of a
      // silent no-op that leaves the button dead.
      setSourceKind('paste');
      setPendingBinary(null);
      setUploadBlock({
        note: L(
          '구버전 한글(.hwp)은 바로 읽지 못해요. 한글에서 "다른 이름으로 저장 → HWPX(.hwpx)"로 저장해 올리거나, 본문을 붙여넣어 주세요.',
          'Legacy Hangul (.hwp) can\'t be read directly. Save it as HWPX (.hwpx) in Hancom Office and upload that, or paste the text.',
        ),
      });
    } else if (IMAGE_EXT.includes(ext)) {
      // A pure image has no text to extract — it's reviewed entirely by a vision
      // model. Without one connected there is NO path, so say so plainly rather
      // than run an empty review.
      setSourceKind('image');
      setPendingBinary(null);
      if (!visionCapable()) {
        setUploadBlock({
          note: L(
            '이미지 검수는 시각 모델이 필요해요. 설정에서 Anthropic API 키를 연결하면 이미지를 눈으로 검수할 수 있어요.',
            'Image review needs a vision model. Connect an Anthropic API key in Settings and the image can be reviewed visually.',
          ),
          needsKey: true,
        });
        return;
      }
      setExtracting(true);
      setText('');
      try {
        const extracted = await extractFile(file, 'image');
        if (extracted.vision) {
          setPreExtracted(extracted);
          setUseVision(true); // the only way to read an image
          setExtractNote(extracted.note ?? null);
        } else {
          // Unsupported format / too large to downscale → honest, specific reason.
          setUploadBlock({ note: extracted.note ?? L('이 이미지를 검수하지 못했어요.', 'Could not review this image.') });
        }
      } catch {
        setUploadBlock({ note: L('이미지를 읽지 못했어요. 다시 시도해 주세요.', 'Could not read the image. Please try again.') });
      } finally {
        setExtracting(false);
      }
    } else if (BINARY_EXT[ext]) {
      setSourceKind(BINARY_EXT[ext]);
      setExtracting(true);
      setText('');
      try {
        const extracted = await extractFile(file, BINARY_EXT[ext]);
        if (BINARY_EXT[ext] === 'pdf') setSourcePdfData(extracted.pdf_data ?? null);
        if (extracted.text.trim().length > 20) {
          // Parser succeeded — feed structured text straight into the pipeline.
          setPreExtracted(extracted);
          setPendingBinary(null);
          setExtractNote(extracted.note ?? null);
        } else if (extracted.vision && visionCapable()) {
          // No text (scanned PDF) BUT we can see it — route to vision instead of
          // a dead-end. Auto-enable the vision toggle: it's the only way to read it.
          setPreExtracted(extracted);
          setPendingBinary(null);
          setUseVision(true);
          setExtractNote(extracted.note ?? L('텍스트가 없어 비전 검수로 읽습니다.', 'No text — reading it with vision.'));
        } else {
          // Parser ran but got nothing usable and vision isn't available.
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

  // Drop a file straight onto the card — same path as the upload button. Only the
  // first file is taken (the flow reviews one document at a time).
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  };
  const onDragEnter = (e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
    e.preventDefault();
    dragDepth.current += 1;
    setDragOver(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) { dragDepth.current = 0; setDragOver(false); }
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
      locale,
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
    // call) but that compounds across serial stages. A long document runs more
    // chunk passes, so scale the deadline with its size (capped) instead of
    // timing out a genuine 40-page review at the short base budget.
    const sourceLength = (preExtracted?.text || text).length;
    // A vision pass sends many page images and the model reads them all — give it
    // real headroom (a scanned PDF has ~0 text length, so the size-scaled budget
    // below would otherwise time it out at the short base deadline).
    const visionOn = useVision && !!preExtracted?.vision;
    const deadlineMs = visionOn
      ? 300_000
      : Math.min(300_000, Math.max(REVIEW_DEADLINE_MS, 90_000 + Math.ceil(sourceLength / 1000) * 2000));
    const deadline = setTimeout(() => {
      if (abortRef.current) { abortReasonRef.current = 'deadline'; abortRef.current.abort(); }
    }, deadlineMs);
    const budget = sourceLength <= 6_000 && artifact.units.length <= 20
      ? DEFAULT_BUDGET.quick
      : DEFAULT_BUDGET.standard;
    const { job: finalJob, receipt: r } = await runDocumentReview(artifact, {
      context: ctx,
      budget,
      locale,
      onProgress: setJob,
      signal: controller.signal,
      // Opt-in multimodal pass: send the PDF/deck visuals so the model reads the
      // charts/tables/layout text extraction drops. Transient — never persisted.
      vision: useVision ? preExtracted?.vision : undefined,
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
      setSessionSource({
        id: r.receipt_id,
        text: effectiveText,
        previews: preExtracted?.previews,
        sourceKind,
        title: title || r.source_title,
        pdfData: sourceKind === 'pdf' ? sourcePdfData ?? undefined : undefined,
        pageCount: preExtracted?.pages_total,
      });
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
    setSourcePdfData(null);
    setText('');
    setTitle('');
    setSourceKind('paste');
    setPendingBinary(null);
    setExtractNote(null);
    setPreExtracted(null);
    setUploadBlock(null);
    setUseVision(false);
    setActiveSourcePage(undefined);
    setSessionSource(null);
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
    const sourcePreviews = sessionSource?.id === receipt.receipt_id ? sessionSource.previews : undefined;
    const pdfData = sessionSource?.id === receipt.receipt_id ? sessionSource.pdfData : undefined;
    const sourcePageCount = sessionSource?.id === receipt.receipt_id ? sessionSource.pageCount : undefined;
    const hasSourceEvidence = Boolean(original || sourcePreviews?.length || pdfData);
    const evidencePageCounts = countEvidenceByPage([
      ...receipt.findings,
      ...receipt.judgment_obligations,
      ...receipt.claim_ledger,
      ...receipt.hidden_assumptions,
      ...receipt.forks,
    ]);
    const anchorPages = Object.keys(evidencePageCounts).map(Number).sort((a, b) => a - b);
    const revealAnchor = (anchor: { page?: number; slide?: number }) => {
      setActiveSourcePage(anchor.page ?? anchor.slide);
      setShowOriginal(true);
      if (window.innerWidth < 768) {
        window.setTimeout(() => sourcePaneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
      }
    };
    const returnToReceipt = () => {
      setShowOriginal(false);
      window.setTimeout(() => receiptPaneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
    };
    const canReattach = receipt.source_kind === 'pdf' || receipt.source_kind === 'docx' || receipt.source_kind === 'pptx' || receipt.source_kind === 'hwpx';
    const reattachSource = async (file: File) => {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const kind = BINARY_EXT[ext];
      if (!kind || kind !== receipt.source_kind) {
        setReattachError(L(`이 영수증은 ${receipt.source_kind.toUpperCase()} 원문을 기다리고 있어요.`, `This receipt expects its original ${receipt.source_kind.toUpperCase()} file.`));
        return;
      }
      setReattaching(true);
      setReattachError(null);
      try {
        const extracted = await extractFile(file, kind);
        if (!extracted.text.trim() && !extracted.vision) throw new Error(extracted.note || 'EXTRACTION_FAILED');
        const candidate = ingest({
          source_kind: kind,
          title: receipt.source_title,
          text: '',
          locale,
          privacy_mode: 'receipt_only',
          pre_extracted: extracted.text,
          pre_extracted_units: extracted.units,
          extraction_quality: extracted.quality,
        });
        if (candidate.source_fingerprint !== receipt.source_fingerprint) {
          setReattachError(L('이 파일은 영수증을 만들 때 검수한 원문과 내용이 달라요.', 'This file does not match the source used to create this receipt.'));
          return;
        }
        setSourcePdfData(extracted.pdf_data ?? null);
        setSessionSource({
          id: receipt.receipt_id,
          text: extracted.text,
          previews: extracted.previews,
          sourceKind: kind,
          title: receipt.source_title,
          pdfData: extracted.pdf_data,
          pageCount: extracted.pages_total,
        });
        setActiveSourcePage(anchorPages[0] ?? 1);
        setShowOriginal(true);
        track('review_source_reattached', { source_kind: kind, receipt_id: receipt.receipt_id });
      } catch (cause) {
        setReattachError(cause instanceof Error && cause.message !== 'EXTRACTION_FAILED'
          ? cause.message
          : L('원문을 다시 읽지 못했어요. 파일을 확인하고 다시 시도해 주세요.', 'Could not read the source again. Check the file and try once more.'));
      } finally {
        setReattaching(false);
        if (reattachFileRef.current) reattachFileRef.current.value = '';
      }
    };
    const reReview = () => {
      if (original) setText(original);
      resetImport();
    };
    const receiptPane = (
      <>
        {receipt.version && receipt.version > 1 && receipt.drift_note && (
          <Card variant="checkpoint" className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--warning)] mb-1">
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
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)] mb-1">{L('기록됨', 'Recorded')}</div>
                  <p className="text-[13px] text-[var(--text-primary)]">
                    {L(
                      '판단을 기록했습니다. 확인일에 실제 결과를 돌아볼 때까지 이 기록은 이어집니다.',
                      'Your judgment is recorded. It stays active until you revisit the outcome on the check-in date.',
                    )}
                  </p>
                </div>
              </div>
            </Card>
          );
        })()}
        <ReceiptView
          receipt={receipt}
          onSealObligation={(o) => { setSealError(null); setSealingObligation(o); }}
          onSettle={(followupId) => setSettlingId(followupId)}
          onReReview={reReview}
          onAnchorSelect={hasSourceEvidence ? revealAnchor : undefined}
          activeSourcePage={activeSourcePage}
        />
        <div className="mt-4">
          <PremiseTracker receipt={receipt} />
        </div>
      </>
    );

    return (
      <div className={hasSourceEvidence ? 'max-w-6xl mx-auto w-full' : 'max-w-2xl mx-auto w-full'}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <button onClick={backToList} className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)]">
            {L('← 내 검수 기록', '← My review record')}
          </button>
          {!hasSourceEvidence && canReattach && (
            <>
              <input ref={reattachFileRef} type="file" accept={`.${receipt.source_kind}`} className="hidden" onChange={(event) => event.target.files?.[0] && void reattachSource(event.target.files[0])} />
              <Button variant="ghost" size="sm" disabled={reattaching} onClick={() => reattachFileRef.current?.click()}>
                <FileUp size={13} />
                {reattaching ? L('원문 확인 중', 'Checking source') : L('원문 다시 연결', 'Reconnect source')}
              </Button>
            </>
          )}
          {hasSourceEvidence && (
            <button
              onClick={() => {
                if (showOriginal) returnToReceipt();
                else {
                  setShowOriginal(true);
                  window.setTimeout(() => sourcePaneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
                }
              }}
              className="text-[12px] text-[var(--text-tertiary)] hover:text-[var(--accent)] md:hidden"
            >
              {showOriginal ? L('영수증으로', 'Back to receipt') : L('원문 보기', 'Show original')}
            </button>
          )}
        </div>
        {reattachError && <p role="alert" className="mb-3 text-right text-[12px] text-[var(--risk-critical)]">{reattachError}</p>}

        {hasSourceEvidence ? (
          <div className="flex flex-col md:flex-row gap-5">
            {/* left: original document (Review Workspace §837) */}
            <div ref={sourcePaneRef} className={`scroll-mt-3 md:w-1/2 ${showOriginal ? '' : 'hidden md:block'}`}>
              <div className="md:sticky md:top-4">
                <SourceEvidencePane
                  previews={sourcePreviews}
                  original={original}
                  title={receipt.source_title}
                  sourceKind={receipt.source_kind}
                  activePage={activeSourcePage}
                  pdfData={pdfData}
                  pageCount={sourcePageCount}
                  anchorPages={anchorPages}
                  evidenceCounts={evidencePageCounts}
                  onPageChange={setActiveSourcePage}
                />
                <button type="button" onClick={returnToReceipt} className="mt-2 w-full rounded border border-[var(--border-subtle)] py-2 text-[12px] font-semibold text-[var(--text-secondary)] md:hidden">
                  {L('영수증으로 돌아가기', 'Back to receipt')}
                </button>
              </div>
            </div>
            {/* right: receipt */}
            <div ref={receiptPaneRef} className="scroll-mt-3 md:w-1/2">{receiptPane}</div>
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

        {sealingObligation && (
          <SealModal
            obligation={{ statement: sealingObligation.statement }}
            followups={receipt.falsifiable_followups}
            busy={sealBusy}
            error={sealError}
            onClose={() => { if (!sealBusy) { setSealingObligation(null); setSealError(null); } }}
            onSeal={async (_followupId, patch) => {
              setSealBusy(true);
              setSealError(null);
              const res = await sealReviewObligation(receipt, sealingObligation, {
                predicate: patch.predicate,
                check_by: patch.check_by,
                pass_condition: patch.pass_condition,
                fail_condition: patch.fail_condition,
              });
              setSealBusy(false);
              if (res.ok) {
                store.markObligationSealed(receipt.receipt_id, sealingObligation.obligation_id, res.judgment_id, res.project_id);
                track('receipt_sealed', { receipt_id: receipt.receipt_id });
                setSealingObligation(null);
              } else if (res.code === 'NOT_SIGNED_IN') {
                setSealError(L('판단을 기록하려면 로그인이 필요해요. 로그인하면 이 판단이 내 판단 기록에 저장되고 확인일에 다시 볼 수 있습니다.', 'Sign in to record this judgment. It will be saved to your decision record and return on the check-in date.'));
              } else {
                setSealError(L('판단을 기록하지 못했어요. 잠시 후 다시 시도해 주세요.', 'The judgment could not be recorded. Please try again in a moment.'));
              }
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
    const longWait = elapsed >= 75;
    const longSource = (preExtracted?.text || text).length > 12_000
      || (preExtracted?.pages_read ?? 0) > 20
      || (preExtracted?.slides_read ?? 0) > 30;
    const mm = Math.floor(elapsed / 60);
    const ss = String(elapsed % 60).padStart(2, '0');
    // Short, honest names for the five real pipeline phases (order matches
    // stageIndex). The live progress_label above carries the detail; these are
    // the milestones so the user can see *where* in the review they are.
    const REVIEW_STAGES: { id: string; label: string }[] = [
      { id: 'profiling', label: L('읽기', 'Read') },
      { id: 'mapping', label: L('판단 지도', 'Map') },
      { id: 'routing', label: L('범위', 'Scope') },
      { id: 'reviewing', label: L('검수', 'Review') },
      { id: 'synthesizing', label: L('영수증', 'Receipt') },
    ];
    return (
      <div className="max-w-2xl mx-auto w-full">
        {preExtracted && (preExtracted.previews?.length || preExtracted.text) && (
          <div className="mb-3">
            <SourceEvidencePane
              previews={preExtracted.previews}
              original={preExtracted.text}
              title={title}
              sourceKind={sourceKind}
              compact
            />
          </div>
        )}
        <Card variant="elevated">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">{L('검수 중', 'Reviewing')}</div>
            <span className="text-[11px] tabular-nums text-[var(--text-tertiary)]">
              {mm > 0 ? `${mm}:${ss}` : L(`${elapsed}초`, `${elapsed}s`)}
            </span>
          </div>
          <p className="text-[15px] text-[var(--text-primary)]">{job?.progress_label ?? L('문서를 읽는 중', 'Reading the document')}…</p>
          {/* Honest stage stepper — each of the five bars is a *named* phase of
              the real pipeline (profiling→mapping→routing→reviewing→synthesizing),
              not a decorative fill. Finished phases sit solid; the phase in flight
              sweeps a light band (see .review-stage-active). This is what makes
              the wait legible instead of blank — specificity, not ornament. */}
          <div className="mt-4 flex gap-1.5">
            {REVIEW_STAGES.map(({ id, label }) => {
              const cur = job ? stageIndex(job.status) : -1;
              const done = cur > stageIndex(id);
              const active = cur === stageIndex(id);
              return (
                <div key={id} className="flex-1 min-w-0">
                  <div
                    className={`h-1 rounded-full ${
                      done ? 'bg-[var(--accent)]' : active ? 'review-stage-active' : 'bg-[var(--border-subtle)]'
                    }`}
                  />
                  <div
                    className={`mt-1.5 text-[9px] leading-tight truncate transition-colors ${
                      active
                        ? 'text-[var(--accent)] font-semibold'
                        : done
                          ? 'text-[var(--text-secondary)]'
                          : 'text-[var(--text-tertiary)]'
                    }`}
                  >
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
          {/* What's being examined — a few of the document's OWN premises (as
              the pipeline extracted them; currently Korean regardless of UI
              locale), rotated slowly so the wait shows specific work on the
              user's material. It names the *document's* premise (not an Argus
              verdict), and uses the approved tint-block quote treatment (no left
              accent bar). Target, not judgment. */}
          {job?.examining && job.examining.length > 0 && (() => {
            const items = job.examining;
            const idx = Math.floor(elapsed / 3) % items.length;
            return (
              <div className="mt-4">
                <div className="text-[11px] text-[var(--text-tertiary)] mb-1.5">
                  {L('지금 문서가 깔고 있는 전제를 살펴보는 중', 'Looking at a premise the document rests on')}
                </div>
                <div key={idx} className="animate-fade-in rounded-lg bg-[var(--accent)]/[0.04] px-4 py-3">
                  <p className="text-[13px] leading-[1.6] text-[var(--text-secondary)]">
                    &ldquo;{items[idx]}&rdquo;
                  </p>
                </div>
                {items.length > 1 && (
                  <div className="mt-1.5 flex gap-1" aria-hidden>
                    {items.map((_, i) => (
                      <div
                        key={i}
                        className={`h-0.5 w-4 rounded-full transition-colors ${
                          i === idx ? 'bg-[var(--accent)]' : 'bg-[var(--border-subtle)]'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          {/* Long-wait reassurance — a big real document can take a while to
              read. Says it's still working (not stuck) and offers a way out. */}
          {longWait && (
            <p className="mt-3 text-[12px] text-[var(--text-secondary)] leading-[1.6]">
              {L(
                longSource
                  ? '긴 문서를 계속 읽고 있어요. 기다리기 어렵다면 취소하고 더 짧게 나눠도 돼요.'
                  : '검수를 계속하고 있어요. 취소해도 입력 내용은 그대로 남아 있어요.',
                longSource
                  ? 'Still reading this longer document. You can cancel and review it in smaller pieces.'
                  : 'The review is still running. You can cancel without losing your input.',
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
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--danger)] mb-2">{L('검수 어려움', 'Unable to review')}</div>
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

      <Card
        onDragEnter={onDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative transition-shadow ${dragOver ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg)]' : ''}`}
      >
        {dragOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-[var(--accent)]/[0.06] pointer-events-none">
            <p className="text-[13px] font-semibold text-[var(--accent)]">
              {L('여기에 파일을 놓으세요 (pdf · docx · pptx · 이미지 · txt)', 'Drop your file here (pdf · docx · pptx · image · txt)')}
            </p>
          </div>
        )}
        {preExtracted ? (
          <SourceEvidencePane
            previews={preExtracted.previews}
            original={preExtracted.text}
            title={title}
            sourceKind={sourceKind}
            compact
          />
        ) : (
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (sourceKind !== 'paste' && sourceKind !== 'markdown') setSourceKind('paste');
              setPendingBinary(null);
              setPreExtracted(null);
              setExtractNote(null);
              setUploadBlock(null);
            }}
            maxLength={PASTE_CHAR_CAP}
            placeholder={L(
              '검수할 문서를 붙여넣으세요. (전략 메모, 기획안, Claude/ChatGPT 답변 등)',
              'Paste the document to review. (Strategy memo, proposal, Claude/ChatGPT answer, etc.)',
            )}
            className="w-full h-52 resize-y bg-transparent text-[14px] leading-[1.6] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
          />
        )}
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-2">
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,.txt,.text,.pdf,.docx,.pptx,.hwpx,.hwp,.png,.jpg,.jpeg,.webp,.gif"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()} disabled={extracting}>
            {extracting
              ? L('읽는 중…', 'Reading…')
              : L('파일 업로드 (md · txt · pdf · docx · pptx · 이미지)', 'Upload a file (md · txt · pdf · docx · pptx · image)')}
          </Button>
          <span className={`text-[11px] ${text.length >= PASTE_CHAR_CAP ? 'text-[var(--warning)] font-semibold' : 'text-[var(--text-tertiary)]'}`}>
            {text.length >= PASTE_CHAR_CAP
              ? L(
                  `최대 ${PASTE_CHAR_CAP.toLocaleString()}자 — 초과분은 잘립니다`,
                  `Max ${PASTE_CHAR_CAP.toLocaleString()} characters — anything over is cut off`,
                )
              : text.length > 0 ? L(`${text.length.toLocaleString()}자`, `${text.length.toLocaleString()} characters`) : ''}
          </span>
        </div>
        {preExtracted && sourceKind === 'image' && (
          <p className="mt-2 text-[12px] text-[var(--success)]">
            {L(
              `이미지를 눈으로 검수합니다${extractNote ? ` — ${extractNote}` : ''}.`,
              `This image will be reviewed visually${extractNote ? ` — ${extractNote}` : ''}.`,
            )}
          </p>
        )}
        {preExtracted && sourceKind !== 'image' && (() => {
          // Show the real scope pulled from the file so the user knows how much
          // will be reviewed (a whole 40-page report vs. a title slide).
          const parts: string[] = [];
          if (preExtracted.pages_read) parts.push(L(`${preExtracted.pages_read}쪽`, `${preExtracted.pages_read} pages`));
          if (preExtracted.slides_read) parts.push(L(`${preExtracted.slides_read}장`, `${preExtracted.slides_read} slides`));
          if (preExtracted.units?.length) parts.push(L(`${preExtracted.units.length}개 항목`, `${preExtracted.units.length} items`));
          const scope = parts.length ? ` (${parts.join(' · ')})` : '';
          return (
            <p className="mt-2 text-[12px] text-[var(--success)]">
              {L(
                `${sourceKind.toUpperCase()}에서 텍스트를 추출했습니다${scope}${extractNote ? ` — ${extractNote}` : ''}. 문서 전체를 검수합니다.`,
                `Extracted text from the ${sourceKind.toUpperCase()}${scope}${extractNote ? ` — ${extractNote}` : ''}. The whole document will be reviewed.`,
              )}
            </p>
          );
        })()}
        {pendingBinary && (
          <p className="mt-2 text-[12px] text-[var(--warning)]">
            {extractNote ? `${extractNote} ` : ''}
            {L(
              `${pendingBinary.toUpperCase()} 파일에서 충분한 텍스트를 얻지 못했습니다. 그대로 검수하면 “무엇이 빠졌는지”를 먼저 보여주고, 본문을 붙여넣으면 정식 검수합니다.`,
              `Not enough text could be read from the ${pendingBinary.toUpperCase()} file. Review it as is and Argus will first show what's missing; paste the text for a full review.`,
            )}
          </p>
        )}
        {uploadBlock && (
          <div className="mt-2">
            <p className="text-[12px] text-[var(--warning)]">{uploadBlock.note}</p>
            {uploadBlock.needsKey && (
              <a
                href={`/${locale}/settings`}
                className="inline-flex mt-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
              >
                {L('설정에서 API 키 연결하기 →', 'Connect an API key in Settings →')}
              </a>
            )}
          </div>
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

      {/* Opt-in vision review — only when the extractor produced a visual payload
          (a PDF, or a deck with embedded images) AND the provider can take it.
          An image skips this: vision is its ONLY path, not an option to toggle. */}
      {!!preExtracted?.vision && sourceKind !== 'image' && visionCapable() && (
        <label className="flex items-start gap-2 text-[12px] text-[var(--text-secondary)] cursor-pointer">
          <input type="checkbox" checked={useVision} onChange={(e) => setUseVision(e.target.checked)} className="mt-0.5" />
          <span>
            {preExtracted.vision.kind === 'pdf'
              ? L('이미지·차트·표까지 눈으로 정밀 검수 (비전)', 'Read images, charts and tables visually (vision)')
              : L('덱에 담긴 이미지·차트까지 함께 검수 (비전)', 'Also review the deck’s embedded images/charts (vision)')}
            <span className="block text-[11px] text-[var(--text-tertiary)]">
              {L(
                '문서를 이미지로도 모델에 보여줘, 텍스트만으로는 놓치는 그래프·표·레이아웃을 잡아냅니다. 토큰을 더 쓰니 무료 1회를 소모해요.',
                'The model also sees the document as images, catching graphs/tables/layout that text alone misses. Uses more tokens — spends your free review.',
              )}
            </span>
          </span>
        </label>
      )}

      {/* A deck only carries its embedded images to vision (no in-browser slide
          renderer). Nudge toward PDF export, which gets full-fidelity native
          vision — every slide, layout and all — for free. */}
      {sourceKind === 'pptx' && !!preExtracted && (
        <p className="text-[11px] leading-[1.6] text-[var(--text-tertiary)]">
          {L(
            '💡 덱을 PDF로 내보내 올리면 모든 슬라이드를 이미지로 더 정밀하게 검수해요 (지금은 덱에 박힌 이미지만 봅니다).',
            '💡 Export your deck to PDF and upload that for a full visual review of every slide — right now only the deck’s embedded images are seen.',
          )}
        </p>
      )}

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
