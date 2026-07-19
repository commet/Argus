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

/** Why extraction could not proceed — mirrors the browser extractor so review.ts
 *  can give an honest, specific reason (and NOT offer a "read it visually"
 *  scaffold for a file the host can't open either, e.g. an encrypted PDF). */
export type ExtractErrorKind = 'empty' | 'encrypted' | 'corrupt' | 'unknown';

export interface ExtractedText {
  text: string;
  units?: ArtifactUnit[];
  quality: ExtractionQuality;
  note?: string;
  error_kind?: ExtractErrorKind;
  pages_total?: number;
  pages_read?: number;
  slides_total?: number;
  slides_read?: number;
  units_capped?: boolean;
}

function classifyExtractError(e: unknown, kind: SourceKind): { note: string; error_kind: ExtractErrorKind } {
  const name = (e as { name?: string })?.name ?? '';
  const m = String((e as { message?: string })?.message ?? e ?? '').toLowerCase();
  if (name === 'PasswordException' || m.includes('password')) {
    return { note: '이 PDF는 암호로 보호되어 있어 열 수 없습니다. 암호를 해제해 다시 저장한 뒤 검수하세요.', error_kind: 'encrypted' };
  }
  if (name === 'InvalidPDFException' || m.includes('invalid pdf') || m.includes('missing pdf')) {
    return { note: 'PDF 파일이 손상된 것 같습니다. 원본을 다시 받아 검수하거나 본문을 붙여넣으세요.', error_kind: 'corrupt' };
  }
  if (m.includes('end of central directory') || m.includes("can't find") || m.includes('corrupted zip') || m.includes('not a zip')) {
    return { note: '파일이 손상됐거나 형식이 올바르지 않습니다 (열 수 없는 문서 구조).', error_kind: 'corrupt' };
  }
  const label = kind === 'pdf' ? 'PDF' : kind === 'docx' ? 'Word 문서' : kind === 'pptx' ? '슬라이드' : kind === 'hwpx' ? '한글 문서' : '문서';
  return { note: `이 ${label}에서 내용을 읽지 못했습니다. 파일이 손상됐거나 형식이 확장자와 다를 수 있습니다.`, error_kind: 'unknown' };
}

/** Extract a binary document at `filePath`. Only pdf/docx/pptx are handled here;
 *  text formats are read directly by the caller (review.ts). Never throws — a
 *  corrupt/encrypted/empty file returns an honest quality:'unsupported' + reason. */
export async function extractFileFromPath(filePath: string, kind: SourceKind): Promise<ExtractedText> {
  if (kind !== 'docx' && kind !== 'pptx' && kind !== 'pdf' && kind !== 'hwpx') {
    return { text: '', quality: 'unsupported' };
  }
  let buf: Buffer;
  try {
    buf = fs.readFileSync(filePath);
  } catch {
    return { text: '', quality: 'unsupported', note: '파일을 읽지 못했습니다.', error_kind: 'unknown' };
  }
  if (buf.length === 0) {
    return { text: '', quality: 'unsupported', note: '빈 파일입니다 (0바이트).', error_kind: 'empty' };
  }
  try {
    if (kind === 'docx') return await extractDocx(buf);
    if (kind === 'pptx') return await extractPptx(buf);
    if (kind === 'hwpx') return await extractHwpx(buf);
    return await extractPdf(buf);
  } catch (e) {
    const { note, error_kind } = classifyExtractError(e, kind);
    return { text: '', quality: 'unsupported', note, error_kind };
  }
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
// HWPX — Hancom OWPML: a zip of Contents/sectionN.xml. Text runs live in <hp:t>
// grouped by <hp:p> paragraphs. Walk runs + paragraph closings in document order
// so each paragraph becomes a line (parity with the browser extractor). Old
// binary .hwp is a CFB blob with no Node parser — degrade honestly.
// --------------------------------------------------------------------------

async function extractHwpx(buf: Buffer): Promise<ExtractedText> {
  const JSZip = (await import('jszip')).default;
  const zip = await JSZip.loadAsync(buf);
  const sectionPaths = Object.keys(zip.files)
    .filter((p) => /^Contents\/section\d+\.xml$/i.test(p))
    .sort((a, b) => hwpxSectionNum(a) - hwpxSectionNum(b));
  if (!sectionPaths.length) {
    return {
      text: '', quality: 'unsupported', error_kind: 'corrupt',
      note: '한글 문서 구조를 찾지 못했습니다. 구버전 .hwp이거나 파일이 손상됐을 수 있습니다. HWPX로 다시 저장하거나 본문을 붙여넣으세요.',
    };
  }
  const lines: string[] = [];
  for (const path of sectionPaths) {
    const xml = await zip.files[path].async('string');
    lines.push(...hwpxParagraphs(xml));
    if (lines.length >= MAX_UNITS) break;
  }
  const text = lines.join('\n').trim();
  if (text.length < 40) {
    return { text: '', quality: 'low', note: '한글 문서에서 텍스트를 거의 찾지 못했습니다 (이미지 위주일 수 있습니다).' };
  }
  return { text, quality: 'medium', note: text.length < 400 ? '추출된 텍스트가 적습니다. 핵심 본문은 붙여넣으면 더 정확합니다.' : undefined };
}

function hwpxSectionNum(p: string): number {
  return parseInt(/section(\d+)/i.exec(p)?.[1] ?? '0', 10);
}

function hwpxParagraphs(xml: string): string[] {
  const lines: string[] = [];
  let cur = '';
  const re = /<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>|<\/(?:\w+:)?p>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[1] !== undefined) {
      cur += decodeXmlEntities(m[1]);
    } else {
      const line = cur.replace(/\s+/g, ' ').trim();
      if (line) lines.push(line);
      cur = '';
    }
  }
  const tail = cur.replace(/\s+/g, ' ').trim();
  if (tail) lines.push(tail);
  return lines;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => codePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => codePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}

function codePoint(n: number): string {
  return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
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
    ? '다단·표가 있어 일부 순서가 어긋날 수 있어요. 핵심 본문은 붙여넣기가 더 정확합니다.'
    : undefined;
  return {
    text: units.map((u) => u.text).join('\n'),
    units,
    quality: 'medium',
    note: total < 400 ? '추출된 텍스트가 적습니다. 핵심 본문은 붙여넣으면 더 정확합니다.' : layoutNote,
    ...caps,
  };
}
