'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileSearch,
  LoaderCircle,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import type { SourcePreview } from '@/lib/review/extract-file';
import type { SourceKind } from '@/lib/review';
import { useLocale } from '@/hooks/useLocale';

function previewSrc(preview: SourcePreview): string {
  return `data:${preview.media_type};base64,${preview.data}`;
}

type AnchoredItem = { anchors: Array<{ page?: number }> };

/** Count receipt items per source page. Multiple anchors from one item on the
 * same page count once, so the badge means "judgments tied here", not raw spans. */
export function countEvidenceByPage(items: AnchoredItem[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const item of items) {
    const pages = new Set(item.anchors.map((anchor) => anchor.page).filter((page): page is number => typeof page === 'number' && page > 0));
    for (const page of pages) counts[page] = (counts[page] ?? 0) + 1;
  }
  return counts;
}

export function adjacentEvidencePage(pages: number[], current: number, direction: -1 | 1): number | undefined {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  return direction < 0
    ? [...sorted].reverse().find((page) => page < current)
    : sorted.find((page) => page > current);
}

function PdfThumbnail({
  doc,
  page,
  active,
  evidenceCount,
  onSelect,
  label,
}: {
  doc: PDFDocumentProxy;
  page: number;
  active: boolean;
  evidenceCount: number;
  onSelect: () => void;
  label: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (active) setVisible(true);
    const node = buttonRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '180px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: { cancel(): void; promise: Promise<void> } | null = null;
    void (async () => {
      const pdfPage = await doc.getPage(page);
      if (cancelled || !canvasRef.current) return;
      const base = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: 52 / Math.max(1, base.width) });
      const outputScale = Math.min(window.devicePixelRatio || 1, 1.5);
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      renderTask = pdfPage.render({
        canvas,
        canvasContext: context,
        viewport,
        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
      });
      await renderTask.promise;
    })().catch((cause) => {
      if ((cause as { name?: string })?.name !== 'RenderingCancelledException') setVisible(false);
    });
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, page, visible]);

  return (
    <button
      ref={buttonRef}
      type="button"
      data-pdf-page={page}
      onClick={onSelect}
      aria-label={evidenceCount > 0 ? `${label}, ${evidenceCount}` : label}
      aria-current={active ? 'page' : undefined}
      title={label}
      className={`relative grid h-[78px] w-[58px] shrink-0 place-items-center overflow-hidden rounded border bg-white transition-colors ${
        active ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/25' : 'border-black/10 hover:border-[var(--accent)]/55'
      }`}
    >
      {visible ? <canvas ref={canvasRef} className="max-h-full max-w-full" aria-hidden="true" /> : <span className="h-10 w-7 animate-pulse bg-black/[0.06]" />}
      {evidenceCount > 0 && (
        <span className="absolute right-0.5 top-0.5 min-w-4 rounded-sm bg-[var(--accent)] px-1 py-px text-[8px] font-bold leading-3 text-white tabular-nums" aria-hidden="true">
          {evidenceCount}
        </span>
      )}
      <span className="absolute bottom-0.5 right-0.5 min-w-4 rounded-sm bg-black/70 px-1 py-px text-[8px] font-semibold leading-3 text-white tabular-nums" aria-hidden="true">
        {page}
      </span>
    </button>
  );
}

function PdfEvidenceViewer({
  data,
  page,
  pageCount,
  anchorPages,
  evidenceCounts,
  onPageChange,
}: {
  data: Uint8Array;
  page: number;
  pageCount?: number;
  anchorPages: number[];
  evidenceCounts: Record<number, number>;
  onPageChange: (page: number) => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const thumbnailRailRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [resolvedPageCount, setResolvedPageCount] = useState(pageCount ?? 1);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let active = true;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    let workerPort: Worker | null = null;
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        if (!active) return;
        workerPort = new Worker(
          new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
          { type: 'module' },
        );
        const worker = pdfjs.PDFWorker.create({ port: workerPort });
        loadingTask = pdfjs.getDocument({ data: data.slice().buffer, worker });
        const loaded = await loadingTask.promise;
        if (!active) return;
        setDoc(loaded);
        setResolvedPageCount(loaded.numPages);
        setError(false);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      if (loadingTask) void loadingTask.destroy();
      else workerPort?.terminate();
    };
  }, [data]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const update = () => setViewportWidth(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!doc || !canvasRef.current || viewportWidth <= 0) return;
    let cancelled = false;
    let renderTask: { cancel(): void; promise: Promise<void> } | null = null;
    setLoading(true);
    void (async () => {
      try {
        const safePage = Math.min(Math.max(1, page), doc.numPages);
        const pdfPage = await doc.getPage(safePage);
        if (cancelled || !canvasRef.current) return;
        const base = pdfPage.getViewport({ scale: 1 });
        const fitScale = Math.max(0.2, (viewportWidth - 24) / Math.max(1, base.width));
        const viewport = pdfPage.getViewport({ scale: fitScale * zoom });
        const outputScale = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('canvas unavailable');
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        renderTask = pdfPage.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        });
        await renderTask.promise;
        if (!cancelled) setError(false);
      } catch (cause) {
        if (!cancelled && (cause as { name?: string })?.name !== 'RenderingCancelledException') setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [doc, page, viewportWidth, zoom]);

  useEffect(() => {
    if (!doc) return;
    thumbnailRailRef.current?.querySelector(`[data-pdf-page="${page}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [doc, page]);

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', close);
    };
  }, [fullscreen]);

  const go = (next: number) => onPageChange(Math.min(Math.max(1, next), resolvedPageCount));
  const previousEvidence = adjacentEvidencePage(anchorPages, page, -1);
  const nextEvidence = adjacentEvidencePage(anchorPages, page, 1);
  const currentEvidenceCount = evidenceCounts[page] ?? 0;
  const thumbnailPages = useMemo(() => Array.from({ length: resolvedPageCount }, (_, index) => index + 1), [resolvedPageCount]);

  const onViewerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault();
      go(page - 1);
    }
    if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      event.preventDefault();
      go(page + 1);
    }
  };

  return (
    <>
      {fullscreen && <div className="fixed inset-0 z-[70] bg-black/70" aria-hidden="true" onClick={() => setFullscreen(false)} />}
      <div
        role={fullscreen ? 'dialog' : undefined}
        aria-modal={fullscreen ? true : undefined}
        aria-label={fullscreen ? L('PDF 원문 전체화면', 'PDF source fullscreen') : undefined}
        onKeyDown={onViewerKeyDown}
        className={`flex min-h-[360px] flex-col bg-[var(--surface)] ${
          fullscreen
            ? 'fixed inset-2 z-[80] h-[calc(100dvh-1rem)] overflow-hidden rounded-lg border border-[var(--border)] shadow-2xl md:inset-5 md:h-[calc(100dvh-2.5rem)]'
            : 'md:h-[66vh] md:max-h-[720px]'
        }`}
      >
      <div className="flex min-h-10 flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg)]/65 px-2 py-1.5">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(page - 1)} disabled={page <= 1} aria-label={L('이전 페이지', 'Previous page')} title={L('이전 페이지', 'Previous page')} className="grid h-7 w-7 place-items-center rounded border border-[var(--border-subtle)] text-[var(--text-secondary)] disabled:opacity-35">
            <ChevronLeft size={15} />
          </button>
          <label className="flex h-7 items-center gap-1 rounded border border-[var(--border-subtle)] bg-[var(--surface)] px-1.5 text-[11px] text-[var(--text-tertiary)]">
            <span className="sr-only">{L('현재 페이지', 'Current page')}</span>
            <input type="number" min={1} max={resolvedPageCount} value={page} onChange={(event) => go(Number(event.target.value) || 1)} className="w-8 bg-transparent text-center font-semibold tabular-nums text-[var(--text-primary)] outline-none" />
            <span>/ {resolvedPageCount}</span>
          </label>
          <button type="button" onClick={() => go(page + 1)} disabled={page >= resolvedPageCount} aria-label={L('다음 페이지', 'Next page')} title={L('다음 페이지', 'Next page')} className="grid h-7 w-7 place-items-center rounded border border-[var(--border-subtle)] text-[var(--text-secondary)] disabled:opacity-35">
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setZoom((value) => Math.max(0.7, value - 0.15))} disabled={zoom <= 0.7} aria-label={L('축소', 'Zoom out')} title={L('축소', 'Zoom out')} className="grid h-7 w-7 place-items-center rounded border border-[var(--border-subtle)] text-[var(--text-secondary)] disabled:opacity-35"><ZoomOut size={14} /></button>
          <span className="w-10 text-center text-[10px] tabular-nums text-[var(--text-tertiary)]">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(1.75, value + 0.15))} disabled={zoom >= 1.75} aria-label={L('확대', 'Zoom in')} title={L('확대', 'Zoom in')} className="grid h-7 w-7 place-items-center rounded border border-[var(--border-subtle)] text-[var(--text-secondary)] disabled:opacity-35"><ZoomIn size={14} /></button>
          <button type="button" onClick={() => setFullscreen((value) => !value)} aria-label={fullscreen ? L('전체화면 닫기', 'Exit fullscreen') : L('전체화면으로 보기', 'View fullscreen')} title={fullscreen ? L('전체화면 닫기', 'Exit fullscreen') : L('전체화면으로 보기', 'View fullscreen')} className="ml-1 grid h-7 w-7 place-items-center rounded border border-[var(--border-subtle)] text-[var(--text-secondary)]">
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {anchorPages.length > 0 && (
        <div className="flex min-h-9 items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-2 py-1.5">
          <span className="min-w-0 truncate text-[10px] font-semibold text-[var(--text-tertiary)]">
            {currentEvidenceCount > 0
              ? L(`이 페이지에 연결된 판단 ${currentEvidenceCount}개`, `${currentEvidenceCount} judgments tied to this page`)
              : L(`근거가 표시된 페이지 ${anchorPages.length}곳`, `Evidence marked on ${anchorPages.length} pages`)}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => previousEvidence && go(previousEvidence)} disabled={!previousEvidence} aria-label={L('이전 근거 페이지', 'Previous evidence page')} title={L('이전 근거 페이지', 'Previous evidence page')} className="grid h-6 w-6 place-items-center rounded border border-[var(--border-subtle)] text-[var(--text-secondary)] disabled:opacity-30"><ChevronLeft size={13} /></button>
            <button type="button" onClick={() => nextEvidence && go(nextEvidence)} disabled={!nextEvidence} aria-label={L('다음 근거 페이지', 'Next evidence page')} title={L('다음 근거 페이지', 'Next evidence page')} className="grid h-6 w-6 place-items-center rounded border border-[var(--border-subtle)] text-[var(--text-secondary)] disabled:opacity-30"><ChevronRight size={13} /></button>
          </div>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[70px_minmax(0,1fr)]">
        <div ref={thumbnailRailRef} className="flex min-h-0 flex-col items-center gap-2 overflow-y-auto border-r border-[var(--border-subtle)] bg-[var(--bg)]/65 px-1.5 py-2" aria-label={L('PDF 페이지 썸네일', 'PDF page thumbnails')}>
          {doc ? thumbnailPages.map((thumbnailPage) => (
            <PdfThumbnail
              key={thumbnailPage}
              doc={doc}
              page={thumbnailPage}
              active={page === thumbnailPage}
              evidenceCount={evidenceCounts[thumbnailPage] ?? 0}
              onSelect={() => go(thumbnailPage)}
              label={L(`${thumbnailPage}쪽`, `Page ${thumbnailPage}`)}
            />
          )) : (
            Array.from({ length: Math.min(resolvedPageCount, 4) }, (_, index) => <div key={index} className="h-[78px] w-[58px] animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.07]" />)
          )}
        </div>
        <div ref={viewportRef} tabIndex={0} className="relative min-h-0 overflow-auto bg-[#e8e6e0] p-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] dark:bg-[#11110f]">
          <canvas ref={canvasRef} className="mx-auto block bg-white shadow-[0_10px_28px_rgba(24,20,14,0.14)]" aria-label={L(`PDF ${page}쪽`, `PDF page ${page}`)} />
          {loading && <div className="absolute inset-0 grid place-items-center bg-[var(--surface)]/65"><LoaderCircle size={22} className="animate-spin text-[var(--accent)] motion-reduce:animate-none" aria-label={L('페이지 불러오는 중', 'Loading page')} /></div>}
          {error && !loading && <div className="absolute inset-0 grid place-items-center px-8 text-center text-[12px] text-[var(--text-secondary)]">{L('이 페이지를 화면에 그리지 못했어요. 다른 페이지로 이동하거나 파일을 다시 올려주세요.', 'This page could not be rendered. Try another page or upload the file again.')}</div>}
        </div>
      </div>
      </div>
    </>
  );
}

export function SourceEvidencePane({
  previews,
  original,
  title,
  sourceKind,
  activePage,
  compact = false,
  pdfData,
  pageCount,
  anchorPages = [],
  evidenceCounts = {},
  onPageChange,
}: {
  previews?: SourcePreview[];
  original?: string;
  title?: string;
  sourceKind: SourceKind;
  activePage?: number;
  compact?: boolean;
  pdfData?: Uint8Array;
  pageCount?: number;
  anchorPages?: number[];
  evidenceCounts?: Record<number, number>;
  onPageChange?: (page: number) => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const pages = useMemo(() => previews ?? [], [previews]);
  const [selected, setSelected] = useState(0);
  const [pdfPage, setPdfPage] = useState(activePage ?? pages[0]?.page ?? 1);

  useEffect(() => {
    if (activePage === undefined) return;
    setPdfPage(activePage);
    const index = pages.findIndex((page) => page.page === activePage);
    if (index >= 0) setSelected(index);
  }, [activePage, pages]);

  useEffect(() => {
    if (!pdfData) setPdfPage(activePage ?? pages[0]?.page ?? 1);
  }, [activePage, pdfData, pages]);

  const current = pages[selected] ?? pages[0];
  const pageLabel = (preview: SourcePreview, index: number) => {
    if (sourceKind === 'image') return pages.length > 1 ? L(`이미지 ${index + 1}`, `Image ${index + 1}`) : L('원본 이미지', 'Source image');
    if (sourceKind === 'pptx' && preview.page === undefined) return L(`시각 자료 ${index + 1}`, `Visual ${index + 1}`);
    return L(`${preview.page ?? index + 1}쪽`, `Page ${preview.page ?? index + 1}`);
  };

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)]" aria-label={L('원문 증거', 'Source evidence')}>
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileSearch size={14} className="shrink-0 text-[var(--accent)]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{L('Argus가 본 원문', 'Source Argus saw')}</p>
            {title && <p className="truncate text-[12px] font-semibold text-[var(--text-primary)]">{title}</p>}
          </div>
        </div>
        {(current || pdfData) && <span className="shrink-0 text-[10px] tabular-nums text-[var(--text-tertiary)]">{pdfData && sourceKind === 'pdf' ? L(`${pdfPage} / ${pageCount ?? (pages.length || 1)}쪽`, `Page ${pdfPage} / ${pageCount ?? (pages.length || 1)}`) : current ? pageLabel(current, selected) : ''}</span>}
      </div>

      {pdfData && sourceKind === 'pdf' && !compact ? (
        <PdfEvidenceViewer
          data={pdfData}
          page={pdfPage}
          pageCount={pageCount}
          anchorPages={anchorPages}
          evidenceCounts={evidenceCounts}
          onPageChange={(nextPage) => {
            setPdfPage(nextPage);
            onPageChange?.(nextPage);
          }}
        />
      ) : current ? (
        <div className={`grid ${compact ? 'h-52 grid-cols-[60px_minmax(0,1fr)]' : 'min-h-[360px] grid-cols-[68px_minmax(0,1fr)] md:h-[66vh] md:max-h-[720px]'}`}>
          <div className="flex flex-col gap-1.5 overflow-y-auto border-r border-[var(--border-subtle)] bg-[var(--bg)]/65 p-1.5">
            {pages.map((preview, index) => (
              <button
                type="button"
                key={`${preview.page ?? 'visual'}-${index}`}
                onClick={() => {
                  setSelected(index);
                  setPdfPage(preview.page ?? index + 1);
                  onPageChange?.(preview.page ?? index + 1);
                }}
                aria-label={pageLabel(preview, index)}
                aria-pressed={selected === index}
                title={pageLabel(preview, index)}
                className={`relative aspect-[3/4] shrink-0 overflow-hidden rounded border bg-white transition-colors ${
                  selected === index ? 'border-[var(--accent)] ring-1 ring-[var(--accent)]/20' : 'border-[var(--border-subtle)] hover:border-[var(--accent)]/45'
                }`}
              >
                <Image src={previewSrc(preview)} alt="" fill unoptimized sizes="56px" className="object-cover" />
                <span className="absolute bottom-0.5 right-0.5 min-w-4 rounded-sm bg-black/65 px-1 py-px text-[8px] font-semibold text-white tabular-nums">
                  {preview.page ?? index + 1}
                </span>
              </button>
            ))}
          </div>
          <figure className="relative min-h-0 overflow-hidden bg-[#e8e6e0] p-3 dark:bg-[#11110f]">
            <div className="relative h-full w-full overflow-hidden border border-black/10 bg-white shadow-[0_10px_28px_rgba(24,20,14,0.14)]">
              <Image
                key={`${current.page ?? 'visual'}-${selected}`}
                src={previewSrc(current)}
                alt={pageLabel(current, selected)}
                fill
                unoptimized
                sizes={compact ? '520px' : '(max-width: 767px) 80vw, 480px'}
                className="object-contain animate-fade-in"
              />
            </div>
          </figure>
        </div>
      ) : original ? (
        <pre className={`${compact ? 'h-52' : 'max-h-[70vh] min-h-[360px]'} overflow-y-auto whitespace-pre-wrap break-words bg-[var(--bg)]/45 p-4 font-sans text-[12px] leading-[1.75] text-[var(--text-secondary)]`}>
          {original}
        </pre>
      ) : (
        <div className="flex h-40 items-center justify-center px-6 text-center text-[12px] text-[var(--text-tertiary)]">
          {L('원문은 저장하지 않았어요. 판단과 근거 위치만 영수증에 남아 있습니다.', 'The source was not stored. The receipt keeps only the judgment and evidence locations.')}
        </div>
      )}
    </section>
  );
}
