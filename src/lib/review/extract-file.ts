/**
 * Thin binary-format extractor (design doc §"입력 아키텍처" Tier 1/2).
 *
 * Goal is NOT a perfect parser — it's honest text + the one anchor each format
 * naturally carries (docx section, pdf page, pptx slide), so a finding can take
 * the user back to the source. When a format yields too little (scanned PDF,
 * image-only deck) we return low quality and let the flow degrade honestly
 * rather than fake a confident review.
 *
 * Parsers are dynamically imported so they never enter the main bundle — the
 * ~500KB of pdf.js/mammoth loads only when a user actually uploads a binary.
 * Browser-only (uses File/ArrayBuffer); never import from server code.
 */

import { type ArtifactUnit, type ExtractionQuality, type SourceKind } from './schema';
import { stableId } from './ids';

export interface ExtractedText {
  /** flattened text (docx path) — fed to ingest's markdown-aware extractor. */
  text: string;
  /** pre-anchored units (pdf/pptx) — carry page/slide numbers ingest can't recover. */
  units?: ArtifactUnit[];
  quality: ExtractionQuality;
  /** honest one-liner shown to the user. */
  note?: string;
}

const MAX_UNITS = 400;

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

  const units: ArtifactUnit[] = [];
  let slideNo = 0;
  for (const path of slidePaths) {
    slideNo++;
    const xml = await zip.files[path].async('string');
    const paras = paragraphsFromSlideXml(xml);
    let first = true;
    for (const para of paras) {
      if (units.length >= MAX_UNITS) break;
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
  }

  const total = units.reduce((n, u) => n + u.text.length, 0);
  if (total < 40) return { text: '', units: [], quality: 'low', note: '슬라이드에서 텍스트를 거의 찾지 못했습니다 (이미지 위주의 deck일 수 있습니다).' };
  return { text: units.map((u) => u.text).join('\n'), units, quality: 'medium' };
}

function slideNum(path: string): number {
  const m = /slide(\d+)\.xml$/.exec(path);
  return m ? Number(m[1]) : 0;
}

/** Extract one joined string per <a:p> paragraph from slide XML. */
function paragraphsFromSlideXml(xml: string): string[] {
  const out: string[] = [];
  const paraRe = /<a:p\b[\s\S]*?<\/a:p>/g;
  let pm: RegExpExecArray | null;
  while ((pm = paraRe.exec(xml))) {
    const runs: string[] = [];
    const tRe = /<a:t>([\s\S]*?)<\/a:t>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(pm[0]))) runs.push(decodeXml(tm[1]));
    const joined = runs.join('').trim();
    if (joined) out.push(joined);
  }
  return out;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// --------------------------------------------------------------------------
// PDF — pdf.js text content, reconstructed into lines per page (page anchor).
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
  const pageCount = Math.min(doc.numPages, 120);

  for (let p = 1; p <= pageCount; p++) {
    if (units.length >= MAX_UNITS) break;
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const lines = reconstructLines(content.items as PdfItem[]);
    // group lines into paragraph-ish blocks separated by blank/short gaps
    const blocks = groupBlocks(lines);
    for (const block of blocks) {
      if (units.length >= MAX_UNITS) break;
      const t = block.trim();
      if (t.length < 2) continue;
      units.push({
        unit_id: stableId('u', 'pdf', p, t.slice(0, 40)),
        kind: 'paragraph',
        text: t,
        source_anchor: { page: p },
        confidence: 0.8,
      });
    }
  }

  const total = units.reduce((n, u) => n + u.text.length, 0);
  if (total < 40) {
    return { text: '', units: [], quality: 'low', note: '이 PDF에서 텍스트를 거의 추출하지 못했습니다 (스캔 이미지 PDF일 수 있습니다).' };
  }
  return {
    text: units.map((u) => u.text).join('\n'),
    units,
    quality: 'medium',
    note: total < 400 ? '추출된 텍스트가 적습니다. 핵심 본문은 붙여넣으면 더 정확합니다.' : undefined,
  };
}

interface PdfItem {
  str: string;
  transform: number[]; // [a,b,c,d,e,f] — e=x, f=y
  hasEOL?: boolean;
}

/** Reconstruct visual lines by grouping text items with similar y-position. */
function reconstructLines(items: PdfItem[]): string[] {
  const rows: { y: number; parts: { x: number; s: string }[] }[] = [];
  for (const it of items) {
    if (!it.str) continue;
    const x = it.transform[4];
    const y = it.transform[5];
    const row = rows.find((r) => Math.abs(r.y - y) < 3);
    if (row) row.parts.push({ x, s: it.str });
    else rows.push({ y, parts: [{ x, s: it.str }] });
  }
  rows.sort((a, b) => b.y - a.y); // top to bottom
  return rows.map((r) =>
    r.parts
      .sort((a, b) => a.x - b.x)
      .map((p) => p.s)
      .join('')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

/** Join consecutive non-empty lines into blocks; blank line = block break. */
function groupBlocks(lines: string[]): string[] {
  const blocks: string[] = [];
  let cur: string[] = [];
  for (const line of lines) {
    if (!line) {
      if (cur.length) blocks.push(cur.join(' '));
      cur = [];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) blocks.push(cur.join(' '));
  return blocks;
}
