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

export interface ExtractedText {
  /** flattened text (docx path) — fed to ingest's markdown-aware extractor. */
  text: string;
  /** pre-anchored units (pdf/pptx) — carry page/slide numbers ingest can't recover. */
  units?: ArtifactUnit[];
  quality: ExtractionQuality;
  /** honest one-liner shown to the user. */
  note?: string;
  /** extractor-side caps → feeds ReviewCoverage so a page/unit-capped file can't
   *  masquerade as fully reviewed (see lib/review/coverage.ts). */
  pages_total?: number;
  pages_read?: number;
  slides_total?: number;
  slides_read?: number;
  units_capped?: boolean;
}

export async function extractFile(file: File, kind: SourceKind): Promise<ExtractedText> {
  const buf = await file.arrayBuffer();
  if (kind === 'docx') return extractDocx(buf);
  if (kind === 'pptx') return extractPptx(buf);
  if (kind === 'pdf') return extractPdf(buf);
  return { text: '', quality: 'unsupported' };
}

// --------------------------------------------------------------------------
// DOCX — mammoth to markdown, so headings/lists become section anchors.
// --------------------------------------------------------------------------

async function extractDocx(buf: ArrayBuffer): Promise<ExtractedText> {
  const mammoth = await import('mammoth');
  const { value, messages } = await mammoth.extractRawText({ arrayBuffer: buf });
  const text = (value || '').trim();
  const lost = messages.some((m: { type: string }) => m.type === 'warning');
  return {
    text,
    quality: text.length > 40 ? 'medium' : 'low',
    note: lost ? '일부 표/이미지 서식은 텍스트로 변환되지 않았습니다.' : undefined,
  };
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
  const total = units.reduce((n, u) => n + u.text.length, 0);
  if (total < 40) return { text: '', units: [], quality: 'low', note: '슬라이드에서 텍스트를 거의 찾지 못했습니다 (이미지 위주의 deck일 수 있습니다).', ...caps };
  return { text: units.map((u) => u.text).join('\n'), units, quality: 'medium', ...caps };
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
  const total = units.reduce((n, u) => n + u.text.length, 0);
  if (total < 40) {
    return { text: '', units: [], quality: 'low', note: '이 PDF에서 텍스트를 거의 추출하지 못했습니다 (스캔 이미지 PDF일 수 있습니다).', ...caps };
  }
  const layoutNote = multiColumn || hasTable
    ? '다단·표가 있어 일부 순서가 어긋날 수 있어요 — 핵심 본문은 붙여넣기가 더 정확합니다.'
    : undefined;
  return {
    text: units.map((u) => u.text).join('\n'),
    units,
    quality: 'medium',
    note: total < 400 ? '추출된 텍스트가 적습니다. 핵심 본문은 붙여넣으면 더 정확합니다.' : layoutNote,
    ...caps,
  };
}
