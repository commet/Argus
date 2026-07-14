/**
 * Node binary-format extractor — the MCP twin of the webapp's browser
 * extract-file.ts. Same honest goal (text + one anchor per format, degrade
 * honestly on scanned/empty input), same pure parsing helpers from extract-core
 * (drift-pinned), but reads a file PATH into a Buffer instead of a browser File.
 *
 * Parsers are dynamically imported so the MCP process only pays for pdf.js /
 * mammoth / jszip when a binary is actually reviewed. Node-only (uses fs +
 * Buffer); the browser copy lives at src/lib/review/extract-file.ts.
 */

import fs from 'fs';
import { type ArtifactUnit, type ExtractionQuality, type SourceKind } from './schema.js';
import { stableId } from './ids.js';
import {
  MAX_UNITS,
  PAGE_CAP,
  type PdfItem,
  reconstructPage,
  emitPdfUnits,
  paragraphsFromSlideXml,
  slideNum,
} from './extract-core.js';

export interface ExtractedText {
  text: string;
  units?: ArtifactUnit[];
  quality: ExtractionQuality;
  note?: string;
  pages_total?: number;
  pages_read?: number;
  slides_total?: number;
  slides_read?: number;
  units_capped?: boolean;
}

/** Extract a binary document at `filePath`. Only pdf/docx/pptx are handled here;
 *  text formats are read directly by the caller (review.ts). */
export async function extractFileFromPath(filePath: string, kind: SourceKind): Promise<ExtractedText> {
  const buf = fs.readFileSync(filePath);
  if (kind === 'docx') return extractDocx(buf);
  if (kind === 'pptx') return extractPptx(buf);
  if (kind === 'pdf') return extractPdf(buf);
  return { text: '', quality: 'unsupported' };
}

// --------------------------------------------------------------------------
// DOCX — mammoth to raw text.
// --------------------------------------------------------------------------

async function extractDocx(buf: Buffer): Promise<ExtractedText> {
  const mammoth = await import('mammoth');
  // Markdown (not raw text) so Word headings/lists/tables survive into the same
  // markdown-aware ingest path (parity with the browser extractor). convertToMarkdown
  // exists at runtime (mammoth 1.x) but is missing from the shipped types.
  const toMarkdown = (mammoth as unknown as {
    convertToMarkdown?: (i: { buffer: Buffer }) => Promise<{ value: string; messages: { type: string }[] }>;
  }).convertToMarkdown;
  let messages: { type: string }[] = [];
  let text = '';
  if (toMarkdown) {
    const r = await toMarkdown({ buffer: buf });
    messages = r.messages;
    text = stripDocxMarkdownNoise(r.value || '');
  }
  if (text.length < 40) {
    const raw = await mammoth.extractRawText({ buffer: buf });
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

async function extractPptx(buf: Buffer): Promise<ExtractedText> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buf);

  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => slideNum(a) - slideNum(b));

  const notesByNum = new Map<number, string[]>();
  for (const p of Object.keys(zip.files)) {
    const m = /^ppt\/notesSlides\/notesSlide(\d+)\.xml$/.exec(p);
    if (!m) continue;
    const xml = await zip.files[p].async('string');
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

  const slidesRead = new Set(units.map((u) => u.source_anchor.slide)).size;
  const caps = { slides_total: slidePaths.length, slides_read: slidesRead, units_capped: capped };
  const total = units.reduce((n, u) => n + u.text.length, 0);
  if (total < 40) return { text: '', units: [], quality: 'low', note: '슬라이드에서 텍스트를 거의 찾지 못했습니다 (이미지 위주의 deck일 수 있습니다).', ...caps };
  return { text: units.map((u) => u.text).join('\n'), units, quality: 'medium', ...caps };
}

// --------------------------------------------------------------------------
// PDF — pdf.js (legacy Node build, main-thread), column-aware line rebuild.
// --------------------------------------------------------------------------

async function extractPdf(buf: Buffer): Promise<ExtractedText> {
  // Legacy build runs without a browser/worker (pdf.js falls back to a
  // main-thread fake worker in Node) — text extraction needs no canvas.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(buf);
  const doc = await pdfjs.getDocument({ data }).promise;

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
    // Line-level segmentation (see extract-core.emitPdfUnits): pdf.js emits no
    // blank lines, so a whole page used to collapse into one unit with every
    // heading buried. This splits per line — headings become their own units.
    currentSection = emitPdfUnits(layout.lines, p, units, currentSection, () => { capped = true; });
    if (capped) break;
  }

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
