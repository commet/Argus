/**
 * Thin binary-format extractor (design doc §"입력 아키텍처" Tier 1/2).
 *
 * Goal is NOT a perfect parser — it's honest text + the one anchor each format
 * naturally carries (docx section, pdf page, pptx slide), so a finding can take
 * the user back to the source. When a format yields too little (scanned PDF,
 * image-only deck) we return low quality and let the flow degrade honestly
 * rather than fake a confident review.
 *
 * The pure, platform-agnostic parsing helpers (pdf line/column reconstruction,
 * pptx XML parsing, shared caps) live in extract-core.ts and are shared verbatim
 * with the MCP Node extractor (drift-pinned). This file owns only the
 * browser-specific glue: File/ArrayBuffer + the dynamically-imported parsers.
 *
 * Parsers are dynamically imported so they never enter the main bundle — the
 * ~500KB of pdf.js/mammoth loads only when a user actually uploads a binary.
 * Browser-only (uses File/ArrayBuffer); never import from server code.
 */

import { type ArtifactUnit, type ExtractionQuality, type SourceKind } from './schema';
import { stableId } from './ids';
import {
  MAX_UNITS,
  PAGE_CAP,
  type PdfItem,
  reconstructPage,
  emitPdfUnits,
  paragraphsFromSlideXml,
  slideNum,
} from './extract-core';

/** Optional vision payload for the multimodal review path (opt-in). PDFs ride
 *  as a single native document block (Claude renders pages + reads text itself);
 *  decks ride as their embedded images (charts/diagrams the text extractor can't
 *  see). Kept OFF the persisted artifact — threaded transiently to the pipeline
 *  only when the user opts in, never written to localStorage/Supabase. */
export interface VisionSource {
  kind: 'pdf' | 'images';
  /** kind 'pdf' — the whole PDF, base64. */
  pdf_base64?: string;
  /** kind 'images' — deck-embedded images, base64. */
  images?: Array<{ media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string }>;
  /** total pages/slides in the source. */
  page_count?: number;
  /** how many pages were actually sent to the model (the 'images' path may stop
   *  at the page/byte budget). When < page_count, the review saw only a prefix —
   *  disclosed honestly on the receipt. Undefined for the native 'pdf' path,
   *  where the model renders every page itself. */
  pages_seen?: number;
}

// Vision caps. The binding constraint is the server body ceiling (~4.4MB), so a
// PDF only rides as a native document block when the RAW file is small enough
// that its base64 fits; a bigger or scanned PDF is rendered to downscaled page
// images instead (a fraction of the raw size), which is also the only way to
// review a scanned PDF that carries no text layer at all.
const VISION_DOC_BLOCK_MAX_BYTES = 3_200_000;   // raw PDF → base64 ~4.3MB, under the body cap
const VISION_RENDER_MAX_PAGES = 40;             // bound cost/latency of a rendered review
const VISION_RENDER_MAX_B64 = 3_600_000;        // total base64 budget for rendered pages (< body cap)
const VISION_RENDER_TARGET_WIDTH = 1100;        // px — legible to the model, small on the wire
const VISION_MAX_IMAGES = 40;
const VISION_IMG_MAX_BYTES = 5_000_000;    // ~5 MB per embedded deck image

/** ArrayBuffer/Uint8Array → base64, chunked so a large buffer doesn't blow the
 *  call stack (String.fromCharCode(...bigArray) throws on ~100k+ elements). */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export interface ExtractedText {
  /** flattened text (docx path) — fed to ingest's markdown-aware extractor. */
  text: string;
  /** pre-anchored units (pdf/pptx) — carry page/slide numbers ingest can't recover. */
  units?: ArtifactUnit[];
  quality: ExtractionQuality;
  /** honest one-liner shown to the user. */
  note?: string;
  /** why extraction could not proceed (empty / too_large / encrypted / corrupt /
   *  wrong_format) — set only on failure, for specific UX + programmatic checks. */
  error_kind?: ExtractErrorKind;
  /** opt-in multimodal payload (PDF document / deck images) — see VisionSource. */
  vision?: VisionSource;
  /** extractor-side caps → feeds ReviewCoverage so a page/unit-capped file can't
   *  masquerade as fully reviewed (see lib/review/coverage.ts). */
  pages_total?: number;
  pages_read?: number;
  slides_total?: number;
  slides_read?: number;
  units_capped?: boolean;
}

/** Hard ceiling for in-browser parsing. Beyond this a PDF/deck can hang or OOM
 *  the tab before the server ever sees it; refuse honestly instead. */
const MAX_EXTRACT_BYTES = 60_000_000; // 60 MB

/** Why an extraction could not proceed — surfaced so the user gets a specific,
 *  actionable reason instead of one generic "couldn't read this file". */
export type ExtractErrorKind = 'empty' | 'too_large' | 'encrypted' | 'corrupt' | 'wrong_format' | 'unknown';

/** Classify a thrown parser error into an honest, actionable note. pdf.js and
 *  jszip throw named/patterned errors we can map; everything else degrades to a
 *  generic-but-honest message. Never surfaces a raw stack to the user. */
export function classifyExtractError(e: unknown, kind: SourceKind): { note: string; error_kind: ExtractErrorKind } {
  const name = (e as { name?: string })?.name ?? '';
  const msg = String((e as { message?: string })?.message ?? e ?? '');
  const m = msg.toLowerCase();
  // pdf.js: password-protected (PasswordException / NEED_PASSWORD | INCORRECT_PASSWORD).
  if (name === 'PasswordException' || m.includes('password')) {
    return { note: '이 PDF는 암호로 보호되어 있어 열 수 없어요. 암호를 해제해 다시 저장한 뒤 올려주세요.', error_kind: 'encrypted' };
  }
  // pdf.js: structurally broken PDF.
  if (name === 'InvalidPDFException' || m.includes('invalid pdf') || m.includes('missing pdf')) {
    return { note: 'PDF 파일이 손상된 것 같아요. 원본을 다시 내려받아 올리거나, 핵심 본문을 붙여넣어 주세요.', error_kind: 'corrupt' };
  }
  // jszip: not a real zip / truncated (docx & pptx are zips).
  if (m.includes('end of central directory') || m.includes("can't find") || m.includes('corrupted zip') || m.includes('not a zip')) {
    return { note: '파일이 손상됐거나 형식이 올바르지 않아요 (열 수 없는 문서 구조). 다시 저장해 올리거나 본문을 붙여넣어 주세요.', error_kind: 'corrupt' };
  }
  // A file whose extension lies about its real format usually fails the parser here.
  const label = kind === 'pdf' ? 'PDF' : kind === 'docx' ? 'Word 문서' : kind === 'pptx' ? '슬라이드' : '문서';
  return { note: `이 ${label}에서 내용을 읽지 못했어요. 파일이 손상됐거나 형식이 확장자와 다를 수 있어요 — 다시 저장하거나 본문을 붙여넣어 주세요.`, error_kind: 'unknown' };
}

export async function extractFile(file: File, kind: SourceKind): Promise<ExtractedText> {
  if (kind !== 'docx' && kind !== 'pptx' && kind !== 'pdf') {
    return { text: '', quality: 'unsupported' };
  }
  // Guard size + emptiness BEFORE reading bytes into memory or invoking a parser,
  // so a 0-byte or 200MB drop can't hang the tab — an honest note, not a spinner.
  if (file.size === 0) {
    return { text: '', quality: 'unsupported', note: '빈 파일이에요 (0바이트). 내용이 있는 파일을 올려주세요.', error_kind: 'empty' };
  }
  if (file.size > MAX_EXTRACT_BYTES) {
    return {
      text: '', quality: 'unsupported', error_kind: 'too_large',
      note: `파일이 너무 커요 (${Math.round(file.size / 1_000_000)}MB, 한도 ${MAX_EXTRACT_BYTES / 1_000_000}MB). 핵심 부분만 잘라 올리거나 본문을 붙여넣어 주세요.`,
    };
  }
  let buf: ArrayBuffer;
  try {
    buf = await file.arrayBuffer();
  } catch {
    return { text: '', quality: 'unsupported', note: '파일을 읽는 중 문제가 생겼어요. 다시 시도하거나 본문을 붙여넣어 주세요.', error_kind: 'unknown' };
  }
  // Each parser is wrapped so a corrupt/encrypted/mislabeled file returns an
  // honest, specific reason — never an unhandled throw that reads as a crash.
  try {
    if (kind === 'docx') return await extractDocx(buf);
    if (kind === 'pptx') return await extractPptx(buf);
    return await extractPdf(buf);
  } catch (e) {
    const { note, error_kind } = classifyExtractError(e, kind);
    return { text: '', quality: 'unsupported', note, error_kind };
  }
}

// --------------------------------------------------------------------------
// DOCX — mammoth to markdown, so headings/lists become section anchors.
// --------------------------------------------------------------------------

async function extractDocx(buf: ArrayBuffer): Promise<ExtractedText> {
  const mammoth = await import('mammoth');
  // Markdown (not raw text) so Word headings/lists/tables survive into the same
  // markdown-aware ingest path. extractRawText flattened every docx into
  // structureless prose — headings lost, findings anchorable only to a line.
  // convertToMarkdown exists at runtime (mammoth 1.x) but is missing from the
  // shipped types, so reach it through a typed cast and fall back to raw text.
  const toMarkdown = (mammoth as unknown as {
    convertToMarkdown?: (i: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string; messages: { type: string }[] }>;
  }).convertToMarkdown;
  let messages: { type: string }[] = [];
  let text = '';
  if (toMarkdown) {
    const r = await toMarkdown({ arrayBuffer: buf });
    messages = r.messages;
    text = stripDocxMarkdownNoise(r.value || '');
  }
  if (text.length < 40) {
    const raw = await mammoth.extractRawText({ arrayBuffer: buf });
    text = (raw.value || '').trim();
    messages = raw.messages;
  }
  const lost = messages.some((m) => m.type === 'warning');
  return {
    text,
    quality: text.length > 40 ? 'medium' : 'low',
    note: lost ? '일부 표/이미지 서식은 텍스트로 변환되지 않았습니다.' : undefined,
  };
}

/** Clean mammoth markdown: drop embedded image data-URIs, unescape the
 *  backslash escapes mammoth adds to punctuation (else a heading reads
 *  "1\. 개요"), and collapse blank runs. */
function stripDocxMarkdownNoise(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// --------------------------------------------------------------------------
// PPTX — a zip of slide XML; pull <a:t> runs per <a:p>, keep slide order.
// --------------------------------------------------------------------------

async function extractPptx(buf: ArrayBuffer): Promise<ExtractedText> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buf);

  // slide files: ppt/slides/slide1.xml, slide2.xml … — order numerically.
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => slideNum(a) - slideNum(b));

  // Speaker notes live in ppt/notesSlides/notesSlideN.xml. N is not guaranteed
  // to equal the slide number, but on decks authored linearly it usually does —
  // good enough for a thin slice, and better than dropping notes entirely.
  const notesByNum = new Map<number, string[]>();
  for (const p of Object.keys(zip.files)) {
    const m = /^ppt\/notesSlides\/notesSlide(\d+)\.xml$/.exec(p);
    if (!m) continue;
    const xml = await zip.files[p].async('string');
    // notes XML repeats the slide number placeholder; keep only real note text.
    const paras = paragraphsFromSlideXml(xml).filter((t) => t.trim() && !/^\d+$/.test(t.trim()));
    if (paras.length) notesByNum.set(Number(m[1]), paras);
  }

  const units: ArtifactUnit[] = [];
  let slideNo = 0;
  let capped = false;
  for (const path of slidePaths) {
    if (units.length >= MAX_UNITS) { capped = true; break; }
    slideNo++;
    const xml = await zip.files[path].async('string');
    const paras = paragraphsFromSlideXml(xml);
    let first = true;
    for (const para of paras) {
      if (units.length >= MAX_UNITS) { capped = true; break; }
      const kind = first ? ('slide_title' as const) : ('slide_body' as const);
      first = false;
      units.push({
        unit_id: stableId('u', kind, slideNo, para.slice(0, 40)),
        kind,
        text: para,
        source_anchor: { slide: slideNo },
        confidence: 0.85,
      });
    }
    // speaker notes → their own units, still anchored to the slide.
    for (const note of notesByNum.get(slideNo) ?? []) {
      if (units.length >= MAX_UNITS) { capped = true; break; }
      units.push({
        unit_id: stableId('u', 'note', slideNo, note.slice(0, 40)),
        kind: 'speaker_note',
        text: note,
        source_anchor: { slide: slideNo },
        confidence: 0.75,
      });
    }
  }

  // slides actually turned into units (capped runs stop mid-deck).
  const slidesRead = new Set(units.map((u) => u.source_anchor.slide)).size;
  const caps = { slides_total: slidePaths.length, slides_read: slidesRead, units_capped: capped };

  // Opt-in vision payload: a deck has no browser renderer, but its embedded media
  // (ppt/media/*) ARE the charts/diagrams the text extractor can't read. Send
  // those images so the model sees them — imperfect (no slide layout) but real.
  const vision = await extractPptxImages(zip);

  const total = units.reduce((n, u) => n + u.text.length, 0);
  if (total < 40) return { text: '', units: [], quality: 'low', note: '슬라이드에서 텍스트를 거의 찾지 못했습니다 (이미지 위주의 deck일 수 있습니다).', vision, ...caps };
  return { text: units.map((u) => u.text).join('\n'), units, quality: 'medium', vision, ...caps };
}

/** Pull a deck's embedded raster images (ppt/media/*.png|jpg|jpeg|gif) as base64
 *  vision blocks — capped in count and per-image size. Returns undefined when a
 *  deck has no usable embedded images. */
async function extractPptxImages(
  zip: { files: Record<string, { async(t: 'uint8array'): Promise<Uint8Array> }> },
): Promise<VisionSource | undefined> {
  const MEDIA: Record<string, 'image/png' | 'image/jpeg' | 'image/gif'> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  };
  const paths = Object.keys(zip.files)
    .filter((p) => /^ppt\/media\/[^/]+\.(png|jpe?g|gif)$/i.test(p))
    .sort();
  const images: NonNullable<VisionSource['images']> = [];
  for (const p of paths) {
    if (images.length >= VISION_MAX_IMAGES) break;
    const ext = (p.split('.').pop() || '').toLowerCase();
    const media_type = MEDIA[ext === 'jpg' ? 'jpg' : ext];
    if (!media_type) continue;
    const bytes = await zip.files[p].async('uint8array');
    if (bytes.length === 0 || bytes.length > VISION_IMG_MAX_BYTES) continue;
    images.push({ media_type, data: toBase64(bytes) });
  }
  return images.length ? { kind: 'images', images, pages_seen: images.length } : undefined;
}

// --------------------------------------------------------------------------
// PDF — pdf.js text content, reconstructed into column-aware lines per page.
// --------------------------------------------------------------------------

async function extractPdf(buf: ArrayBuffer): Promise<ExtractedText> {
  const pdfjs = await import('pdfjs-dist');
  // Worker asset resolved by the bundler; new URL keeps webpack/Turbopack happy.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const units: ArtifactUnit[] = [];
  const pageCount = Math.min(doc.numPages, PAGE_CAP);
  let pagesRead = 0;
  let capped = false;
  let multiColumn = false;
  let hasTable = false;
  let currentSection: string | null = null;

  for (let p = 1; p <= pageCount; p++) {
    if (units.length >= MAX_UNITS) { capped = true; break; }
    pagesRead = p;
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const layout = reconstructPage(content.items as PdfItem[]);
    if (layout.multiColumn) multiColumn = true;
    if (layout.hasTable) hasTable = true;
    // Segment the page at the LINE level, not with groupBlocks. pdf.js emits no
    // blank lines between paragraphs, so groupBlocks collapsed a whole page into
    // ONE giant unit — burying every heading and leaving findings only a bare
    // page number. Splitting per line lets us (a) detect a heading line and give
    // it its own unit + section_path, and (b) keep paragraph units granular.
    currentSection = emitPdfUnits(layout.lines, p, units, currentSection, () => { capped = true; });
    if (capped) break;
  }

  // `units_capped` folds the >120-page limit in too: a longer PDF was truncated
  // to `pagesRead` pages, which computeCoverage discloses ("N쪽 중 앞 M쪽").
  const caps = {
    pages_total: doc.numPages,
    pages_read: pagesRead,
    units_capped: capped || doc.numPages > PAGE_CAP,
  };
  // Opt-in vision payload — computed the same way whether or not the PDF has a
  // text layer. A SCANNED PDF (no text) is exactly what vision is for, so it is
  // attached here too; the pipeline can review purely from the page images.
  const vision = await buildPdfVision(doc as unknown as PdfDocLike, buf);

  const total = units.reduce((n, u) => n + u.text.length, 0);
  if (total < 40) {
    // No text layer. If vision is available the flow can still review it (from
    // the rendered pages); the note tells the user that's the only path.
    const note = vision
      ? '이 PDF는 텍스트가 없어(스캔 이미지) 비전 검수로만 읽을 수 있어요. "이미지까지 정밀 검수"를 켜고 실행하세요.'
      : '이 PDF에서 텍스트를 거의 추출하지 못했습니다 (스캔 이미지 PDF일 수 있습니다).';
    return { text: '', units: [], quality: 'low', note, vision, ...caps };
  }
  const layoutNote = multiColumn || hasTable
    ? '다단·표가 있어 일부 순서가 어긋날 수 있어요 — 핵심 본문은 붙여넣기가 더 정확합니다.'
    : undefined;
  return {
    text: units.map((u) => u.text).join('\n'),
    units,
    quality: 'medium',
    note: total < 400 ? '추출된 텍스트가 적습니다. 핵심 본문은 붙여넣으면 더 정확합니다.' : layoutNote,
    vision,
    ...caps,
  };
}

/** Build the opt-in vision payload for a PDF. Small PDFs ride as one native
 *  document block (best fidelity — Claude reads text + renders pages itself);
 *  a PDF too large for the request body is rendered client-side to downscaled
 *  page images instead (the only way to fit — and the only way to review a
 *  scanned, text-less PDF at all). Returns undefined if neither path fits. */
interface PdfDocLike { numPages: number; getPage(n: number): Promise<PdfPageLike> }
interface PdfPageLike {
  getViewport(o: { scale: number }): { width: number; height: number };
  // pdf.js RenderParameters vary by version (some require `canvas`, some
  // `canvasContext`); pass both and keep this loose so we don't pin a version.
  render(o: Record<string, unknown>): { promise: Promise<void> };
}

async function buildPdfVision(doc: PdfDocLike, buf: ArrayBuffer): Promise<VisionSource | undefined> {
  if (buf.byteLength <= VISION_DOC_BLOCK_MAX_BYTES) {
    return { kind: 'pdf', pdf_base64: toBase64(new Uint8Array(buf)), page_count: doc.numPages };
  }
  try {
    const images = await renderPdfPages(doc);
    return images.length
      ? { kind: 'images', images, page_count: doc.numPages, pages_seen: images.length }
      : undefined;
  } catch {
    return undefined; // rendering unavailable (no canvas) → text-only, honest
  }
}

/** Render up to VISION_RENDER_MAX_PAGES pages to downscaled JPEGs via canvas,
 *  stopping at the base64 budget. Browser-only (needs a canvas). */
async function renderPdfPages(doc: PdfDocLike): Promise<NonNullable<VisionSource['images']>> {
  const images: NonNullable<VisionSource['images']> = [];
  let b64Total = 0;
  const n = Math.min(doc.numPages, VISION_RENDER_MAX_PAGES);
  for (let p = 1; p <= n; p++) {
    const page = await doc.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, VISION_RENDER_TARGET_WIDTH / Math.max(1, base.width));
    const viewport = page.getViewport({ scale });
    const w = Math.max(1, Math.round(viewport.width));
    const h = Math.max(1, Math.round(viewport.height));
    let blob: Blob;
    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.62 });
    } else if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
      blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/jpeg', 0.62));
    } else {
      throw new Error('no canvas');
    }
    const data = toBase64(new Uint8Array(await blob.arrayBuffer()));
    if (b64Total + data.length > VISION_RENDER_MAX_B64) break; // budget spent — stop, disclose via page_count
    b64Total += data.length;
    images.push({ media_type: 'image/jpeg', data });
  }
  return images;
}
