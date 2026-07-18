'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, FileSearch, LoaderCircle, ZoomIn, ZoomOut } from 'lucide-react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import type { SourcePreview } from '@/lib/review/extract-file';
import type { SourceKind } from '@/lib/review';
import { useLocale } from '@/hooks/useLocale';

function previewSrc(preview: SourcePreview): string {
  return `data:${preview.media_type};base64,${preview.data}`;
}

function PdfEvidenceViewer({
  data,
  page,
  pageCount,
  anchorPages,
  onPageChange,
}: {
  data: Uint8Array;
  page: number;
  pageCount?: number;
  anchorPages: number[];
  onPageChange: (page: number) => void;
}) {
  const locale = useLocale();
  const L = (ko: string, en: string) => locale === 'ko' ? ko : en;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [resolvedPageCount, setResolvedPageCount] = useState(pageCount ?? 1);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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

  const go = (next: number) => onPageChange(Math.min(Math.max(1, next), resolvedPageCount));
  const visibleAnchors = anchorPages.slice(0, 14);

  return (
    <div className="flex min-h-[360px] flex-col md:h-[66vh] md:max-h-[720px]">
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
        </div>
      </div>

      {anchorPages.length > 0 && (
        <div className="flex min-h-9 items-center gap-1.5 overflow-x-auto border-b border-[var(--border-subtle)] px-2 py-1.5">
          <span className="shrink-0 text-[10px] font-semibold text-[var(--text-tertiary)]">{L('근거', 'Evidence')}</span>
          {visibleAnchors.map((anchorPage) => (
            <button key={anchorPage} type="button" onClick={() => go(anchorPage)} aria-pressed={page === anchorPage} className={`h-6 min-w-7 rounded border px-1.5 text-[10px] font-semibold tabular-nums ${page === anchorPage ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50'}`}>
              {L(`${anchorPage}쪽`, `p.${anchorPage}`)}
            </button>
          ))}
          {anchorPages.length > visibleAnchors.length && <span className="shrink-0 text-[10px] text-[var(--text-tertiary)]">+{anchorPages.length - visibleAnchors.length}</span>}
        </div>
      )}

      <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-auto bg-[#e8e6e0] p-3 dark:bg-[#11110f]">
        <canvas ref={canvasRef} className="mx-auto block bg-white shadow-[0_10px_28px_rgba(24,20,14,0.14)]" aria-label={L(`PDF ${page}쪽`, `PDF page ${page}`)} />
        {loading && <div className="absolute inset-0 grid place-items-center bg-[var(--surface)]/65"><LoaderCircle size={22} className="animate-spin text-[var(--accent)]" aria-label={L('페이지 불러오는 중', 'Loading page')} /></div>}
        {error && !loading && <div className="absolute inset-0 grid place-items-center px-8 text-center text-[12px] text-[var(--text-secondary)]">{L('이 페이지를 화면에 그리지 못했어요. 다른 페이지로 이동하거나 파일을 다시 올려주세요.', 'This page could not be rendered. Try another page or upload the file again.')}</div>}
      </div>
    </div>
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
    if (!pdfData) setPdfPage(pages[0]?.page ?? 1);
  }, [pdfData, pages]);

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
