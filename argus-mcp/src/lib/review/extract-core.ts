/**
 * Pure, platform-agnostic extraction helpers shared by the browser extractor
 * (extract-file.ts, uses File/ArrayBuffer) and the Node extractor
 * (argus-mcp/.../extract-file-node.ts, uses Buffer). Kept verbatim in both trees
 * and pinned by review-mcp-drift.test.ts so the two parsers can never diverge
 * (CLAUDE.md §"Single Source of Truth").
 *
 * Nothing here touches fs, File, or a parser library — it operates only on the
 * data pdf.js / jszip already handed back (text items, slide XML strings), so it
 * runs identically in both runtimes.
 */

/** Hard caps shared by both extractors. */
export const MAX_UNITS = 400;
export const PAGE_CAP = 120;

// ==========================================================================
// PDF layout — reconstruct visual lines, detect columns + tables.
// ==========================================================================

export interface PdfItem {
  str: string;
  /** [a,b,c,d,e,f] — e (index 4) = x, f (index 5) = y. */
  transform: number[];
  /** horizontal advance of this text run, when pdf.js reports it. */
  width?: number;
  hasEOL?: boolean;
}

export interface PageLayout {
  /** reconstructed lines, in reading order (column-aware). */
  lines: string[];
  /** a vertical gutter split the page into columns (reading order was at risk). */
  multiColumn: boolean;
  /** at least one row looked tabular (≥3 gap-separated cells). */
  hasTable: boolean;
}

interface Part {
  x: number;
  xEnd: number;
  s: string;
}
interface Row {
  y: number;
  parts: Part[];
}

/** Same y-tolerance the original single-column reconstructor used. */
const Y_TOL = 3;

function partOf(it: PdfItem): Part {
  const x = it.transform[4];
  const w = typeof it.width === 'number' && Number.isFinite(it.width) ? it.width : 0;
  return { x, xEnd: x + w, s: it.str };
}

/** Cluster text items into visual rows by y-position (top-to-bottom order). */
function clusterRows(items: PdfItem[]): Row[] {
  const rows: Row[] = [];
  for (const it of items) {
    if (!it.str) continue;
    const y = it.transform[5];
    const row = rows.find((r) => Math.abs(r.y - y) < Y_TOL);
    if (row) row.parts.push(partOf(it));
    else rows.push({ y, parts: [partOf(it)] });
  }
  rows.sort((a, b) => b.y - a.y); // top to bottom
  return rows;
}

/**
 * Find a clean vertical gutter that splits the page into two columns: an x-band
 * that (almost) no text run crosses, wide enough to be a real gutter, with
 * substantial content on both sides. Returns the split x, or null for a normal
 * single-column page (then we reproduce the original behavior exactly).
 */
function findColumnGutter(rows: Row[]): number | null {
  const xs: number[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  for (const r of rows) {
    for (const p of r.parts) {
      xs.push(p.x);
      if (p.x < minX) minX = p.x;
      if (p.xEnd > maxX) maxX = p.xEnd;
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || maxX <= minX) return null;
  const pageWidth = maxX - minX;
  if (rows.length < 6) return null; // too little to judge a column structure

  // Candidate split lines: evaluate positions across the middle 60% of the page.
  const minGutter = Math.max(pageWidth * 0.05, 18);
  let best: { x: number; crossings: number } | null = null;
  const lo = minX + pageWidth * 0.2;
  const hi = minX + pageWidth * 0.8;
  const step = Math.max(pageWidth / 60, 2);
  for (let c = lo; c <= hi; c += step) {
    let crossings = 0;
    let leftRows = 0;
    let rightRows = 0;
    for (const r of rows) {
      let hasLeft = false;
      let hasRight = false;
      for (const p of r.parts) {
        // a run that straddles the candidate line by more than the gutter margin
        if (p.x < c - minGutter / 2 && p.xEnd > c + minGutter / 2) crossings++;
        if (p.xEnd <= c) hasLeft = true;
        else if (p.x >= c) hasRight = true;
      }
      if (hasLeft) leftRows++;
      if (hasRight) rightRows++;
    }
    // require both columns to carry real content and almost nothing to cross.
    const enoughBothSides = leftRows >= rows.length * 0.3 && rightRows >= rows.length * 0.3;
    if (enoughBothSides && crossings <= rows.length * 0.05) {
      if (!best || crossings < best.crossings) best = { x: c, crossings };
    }
  }
  return best ? best.x : null;
}

/** Split a single row's parts into cells by wide horizontal gaps (table signal).
 *  Within a cell, parts are joined with '' — the original single-column behavior,
 *  since pdf.js runs already carry their own trailing spaces. */
function segmentRow(parts: Part[], pageWidth: number): { cells: string[]; tabular: boolean } {
  const sorted = [...parts].sort((a, b) => a.x - b.x);
  const gapCut = Math.max(pageWidth * 0.04, 14);
  const cells: string[] = [];
  let cur: Part[] = [];
  let prevEnd: number | null = null;
  for (const p of sorted) {
    if (prevEnd !== null && p.x - prevEnd > gapCut) {
      cells.push(cur.map((q) => q.s).join(''));
      cur = [];
    }
    cur.push(p);
    prevEnd = Math.max(prevEnd ?? p.xEnd, p.xEnd);
  }
  if (cur.length) cells.push(cur.map((q) => q.s).join(''));
  const clean = cells.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  return { cells: clean, tabular: clean.length >= 3 };
}

function rowsToLines(rows: Row[], pageWidth: number): { lines: string[]; hasTable: boolean } {
  const lines: string[] = [];
  let hasTable = false;
  for (const r of rows) {
    const { cells, tabular } = segmentRow(r.parts, pageWidth);
    if (cells.length === 0) continue;
    if (tabular) {
      hasTable = true;
      lines.push(cells.join(' | '));
    } else {
      // non-tabular: preserve the original join (single reading line).
      lines.push(cells.join(' '));
    }
  }
  return { lines, hasTable };
}

/**
 * Reconstruct a page's reading-order lines from pdf.js text items, splitting
 * multi-column layouts by their gutter (left column fully, then right) and
 * preserving table cell separation. Single-column pages reproduce the original
 * y-cluster + x-sort behavior.
 */
export function reconstructPage(items: PdfItem[]): PageLayout {
  const rows = clusterRows(items);
  if (rows.length === 0) return { lines: [], multiColumn: false, hasTable: false };

  let minX = Infinity;
  let maxX = -Infinity;
  for (const r of rows) {
    for (const p of r.parts) {
      if (p.x < minX) minX = p.x;
      if (p.xEnd > maxX) maxX = p.xEnd;
    }
  }
  const pageWidth = maxX > minX ? maxX - minX : 1;

  const gutter = findColumnGutter(rows);
  if (gutter === null) {
    const { lines, hasTable } = rowsToLines(rows, pageWidth);
    return { lines, multiColumn: false, hasTable };
  }

  // Two columns: partition each row's parts, keep each column's own row order.
  const leftRows: Row[] = [];
  const rightRows: Row[] = [];
  for (const r of rows) {
    const left = r.parts.filter((p) => p.xEnd <= gutter);
    const right = r.parts.filter((p) => p.x >= gutter);
    if (left.length) leftRows.push({ y: r.y, parts: left });
    if (right.length) rightRows.push({ y: r.y, parts: right });
  }
  const l = rowsToLines(leftRows, pageWidth);
  const r = rowsToLines(rightRows, pageWidth);
  return { lines: [...l.lines, ...r.lines], multiColumn: true, hasTable: l.hasTable || r.hasTable };
}

/** Join consecutive non-empty lines into blocks; a blank line breaks the block. */
export function groupBlocks(lines: string[]): string[] {
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

// ==========================================================================
// PPTX slide XML — pure string parsing (jszip already gave us the XML text).
// ==========================================================================

/** Extract one joined string per <a:p> paragraph from slide XML. */
export function paragraphsFromSlideXml(xml: string): string[] {
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

export function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export function slideNum(path: string): number {
  const m = /slide(\d+)\.xml$/.exec(path);
  return m ? Number(m[1]) : 0;
}
