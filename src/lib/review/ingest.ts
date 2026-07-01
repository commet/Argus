/**
 * Artifact-first ingestion: every input normalizes into ONE CanonicalArtifact
 * before analysis (design doc §"입력 아키텍처: Artifact-first Ingestion").
 *
 * Support tiers (design doc §"MVP가 여전히 크다"):
 *  - Tier 0 (full): paste, markdown, txt, llm_answer, transcript, pr_diff.
 *    Real structural extraction with line/char/section anchors.
 *  - Tier 1/2 (data-model only): pdf, docx, pptx. The schema accepts them from
 *    day one, but until a real parser is wired we degrade HONESTLY to
 *    `unsupported` with a recovery hint — never a confident fake review.
 *    A caller that already has extracted text (a parser, or the MCP host) can
 *    pass `pre_extracted` and it flows through the same anchored pipeline.
 *
 * The honesty rule (design doc §"실패 UX"): a low/unsupported extraction is a
 * first-class state that reaches the UI, not a swallowed error.
 */

import {
  type CanonicalArtifact,
  type ArtifactUnit,
  type SourceKind,
  type UnitKind,
  type PrivacyMode,
  type ExtractionQuality,
  type SourceAnchor,
} from './schema';
import { fingerprint, stableId } from './ids';

export interface IngestInput {
  source_kind: SourceKind;
  title?: string;
  /** raw text for Tier-0 formats, or pre-extracted text for binary formats. */
  text?: string;
  /** already-extracted text for pdf/docx/pptx supplied by an external parser. */
  pre_extracted?: string;
  /**
   * Already-anchored units from a real binary parser (pdf page / pptx slide).
   * When present these are used verbatim — the parser knows page/slide numbers
   * we can't recover from flattened text.
   */
  pre_extracted_units?: ArtifactUnit[];
  /** override the inferred extraction quality (a parser reports its own). */
  extraction_quality?: ExtractionQuality;
  /** extra honesty notes from the parser, merged with the ingest defaults. */
  extraction_notes?: string[];
  privacy_mode?: PrivacyMode;
}

const TIER0: SourceKind[] = ['paste', 'markdown', 'txt', 'llm_answer', 'transcript', 'pr_diff'];
const BINARY: SourceKind[] = ['pdf', 'docx', 'pptx'];

export function ingest(input: IngestInput): CanonicalArtifact {
  const privacy_mode: PrivacyMode = input.privacy_mode ?? 'receipt_only';
  const title = (input.title || '').trim() || defaultTitle(input.source_kind);

  // Pre-anchored units from a real parser (pdf pages / pptx slides): trust the
  // parser's page/slide numbers rather than re-flattening to text.
  if (input.pre_extracted_units && input.pre_extracted_units.length > 0) {
    return fromUnits(input, title, privacy_mode);
  }

  // Binary format with no extracted text → honest degrade, data model intact.
  if (BINARY.includes(input.source_kind) && !input.pre_extracted && !input.text) {
    return degradedArtifact(input.source_kind, title, privacy_mode);
  }

  const text = (input.pre_extracted ?? input.text ?? '').replace(/\r\n/g, '\n');
  if (!text.trim()) {
    return degradedArtifact(input.source_kind, title, privacy_mode, 'empty');
  }

  const isDeck = input.source_kind === 'pptx';
  const units = input.source_kind === 'transcript'
    ? extractTranscript(text)
    : extractStructured(text, isDeck);

  const fp = fingerprint(text);

  // Extraction quality: Tier-0 text is high; binary-but-pre-extracted is medium
  // (we trust the caller's parser but can't verify layout fidelity).
  const quality: ExtractionQuality =
    input.extraction_quality ?? (TIER0.includes(input.source_kind) ? 'high' : 'medium');

  const notes: string[] = [...(input.extraction_notes ?? [])];
  if (BINARY.includes(input.source_kind) && notes.length === 0) {
    notes.push(
      input.source_kind === 'pptx'
        ? '이 deck은 슬라이드 텍스트와 순서를 기준으로 검수했습니다. 차트/이미지 해석은 제한적입니다.'
        : '텍스트를 기준으로 검수했습니다. 표/이미지 일부는 분석에서 빠질 수 있습니다.',
    );
  }

  return {
    artifact_id: `art_${fp}`,
    source_kind: input.source_kind,
    source_title: title,
    source_fingerprint: fp,
    extraction_quality: quality,
    privacy_mode,
    units,
    detected_structure: {
      page_count: undefined,
      slide_count: isDeck ? countKind(units, 'slide_title') || undefined : undefined,
      section_count: countKind(units, 'heading') || undefined,
      heading_count: countKind(units, 'heading') || undefined,
      table_count: countKind(units, 'table') || undefined,
      is_deck: isDeck,
    },
    extraction_notes: notes,
  };
}

/**
 * Build a CanonicalArtifact from a parser's already-anchored units (pdf pages /
 * pptx slides). The parser carries page/slide numbers that a flattened-text
 * re-extraction would lose, so we keep them verbatim and only derive structure.
 */
function fromUnits(input: IngestInput, title: string, privacy_mode: PrivacyMode): CanonicalArtifact {
  const units = input.pre_extracted_units!;
  const joined = units.map((u) => u.text).join('\n');
  const fp = fingerprint(joined || title);
  const isDeck = input.source_kind === 'pptx' || units.some((u) => u.source_anchor.slide !== undefined);
  const pages = new Set<number>();
  const slides = new Set<number>();
  for (const u of units) {
    if (u.source_anchor.page !== undefined) pages.add(u.source_anchor.page);
    if (u.source_anchor.slide !== undefined) slides.add(u.source_anchor.slide);
  }
  const notes = [...(input.extraction_notes ?? [])];
  if (notes.length === 0) {
    notes.push(
      isDeck
        ? '이 deck은 슬라이드 텍스트와 순서를 기준으로 검수했습니다. 차트/이미지 해석은 제한적입니다.'
        : '텍스트를 기준으로 검수했습니다. 표/이미지 일부는 분석에서 빠질 수 있습니다.',
    );
  }
  return {
    artifact_id: `art_${fp}`,
    source_kind: input.source_kind,
    source_title: title,
    source_fingerprint: fp,
    extraction_quality: input.extraction_quality ?? 'medium',
    privacy_mode,
    units,
    detected_structure: {
      page_count: pages.size || undefined,
      slide_count: slides.size || undefined,
      section_count: countKind(units, 'heading') || undefined,
      heading_count: countKind(units, 'heading') || undefined,
      table_count: countKind(units, 'table') || undefined,
      is_deck: isDeck,
    },
    extraction_notes: notes,
  };
}

function defaultTitle(kind: SourceKind): string {
  const map: Record<SourceKind, string> = {
    paste: '붙여넣은 문서',
    markdown: 'Markdown 문서',
    txt: '텍스트 문서',
    pdf: 'PDF 문서',
    docx: 'DOCX 문서',
    pptx: '슬라이드 덱',
    transcript: '회의록',
    mcp_file: '파일',
    pr_diff: 'PR diff',
    llm_answer: 'AI 답변',
  };
  return map[kind];
}

function degradedArtifact(
  kind: SourceKind,
  title: string,
  privacy_mode: PrivacyMode,
  reason: 'unsupported' | 'empty' = 'unsupported',
): CanonicalArtifact {
  const note =
    reason === 'empty'
      ? '문서에서 텍스트를 찾지 못했습니다.'
      : kind === 'pdf'
        ? '이 PDF는 아직 자동 텍스트 추출을 지원하지 않습니다. 본문 텍스트를 붙여넣으면 검수할 수 있습니다.'
        : kind === 'pptx'
          ? '이 deck은 아직 자동 추출을 지원하지 않습니다. 슬라이드 텍스트를 붙여넣으면 검수할 수 있습니다.'
          : '이 파일은 아직 자동 텍스트 추출을 지원하지 않습니다. 본문을 붙여넣어 주세요.';
  return {
    artifact_id: `art_${stableId(kind, title, reason)}`,
    source_kind: kind,
    source_title: title,
    source_fingerprint: stableId('fp', kind, title),
    extraction_quality: 'unsupported',
    privacy_mode,
    units: [],
    detected_structure: { is_deck: kind === 'pptx' },
    extraction_notes: [note],
  };
}

function countKind(units: ArtifactUnit[], kind: UnitKind): number {
  return units.filter((u) => u.kind === kind).length;
}

// ---------------------------------------------------------------------------
// Structured (markdown-aware) extraction with anchors.
// ---------------------------------------------------------------------------

interface Block {
  kind: UnitKind;
  text: string;
  line_start: number;
  line_end: number;
  char_start: number;
  char_end: number;
  section_path: string[];
}

function extractStructured(text: string, isDeck: boolean): ArtifactUnit[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];
  const sectionStack: { level: number; title: string }[] = [];

  // char offset of the start of each line
  const lineOffsets: number[] = [];
  let running = 0;
  for (const line of lines) {
    lineOffsets.push(running);
    running += line.length + 1; // + newline
  }

  let paragraphBuf: string[] = [];
  let paraStartLine = 0;

  const flushParagraph = (endLine: number) => {
    const joined = paragraphBuf.join('\n').trim();
    if (joined) {
      blocks.push(
        makeBlock('paragraph', joined, paraStartLine, endLine, lineOffsets, lines, currentPath(sectionStack)),
      );
    }
    paragraphBuf = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    // Deck slide separator (--- / ===): a boundary only; the slide's title and
    // body are captured by the heading/paragraph branches below.
    if (isDeck && /^(-{3,}|={3,})$/.test(line)) {
      flushParagraph(i - 1);
      continue;
    }

    if (!line) {
      flushParagraph(i - 1);
      continue;
    }

    // Heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushParagraph(i - 1);
      const level = h[1].length;
      const titleText = h[2].trim();
      while (sectionStack.length && sectionStack[sectionStack.length - 1].level >= level) {
        sectionStack.pop();
      }
      const path = currentPath(sectionStack);
      const kind: UnitKind = isDeck ? 'slide_title' : 'heading';
      blocks.push(makeBlock(kind, titleText, i, i, lineOffsets, lines, path));
      sectionStack.push({ level, title: titleText });
      continue;
    }

    // Bullet
    if (/^([-*+]|\d+[.)])\s+/.test(line)) {
      flushParagraph(i - 1);
      const bulletText = line.replace(/^([-*+]|\d+[.)])\s+/, '');
      const kind: UnitKind = isDeck ? 'slide_body' : 'bullet';
      blocks.push(makeBlock(kind, bulletText, i, i, lineOffsets, lines, currentPath(sectionStack)));
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      flushParagraph(i - 1);
      blocks.push(
        makeBlock('quote', line.replace(/^>\s?/, ''), i, i, lineOffsets, lines, currentPath(sectionStack)),
      );
      continue;
    }

    // Table row
    if (line.includes('|') && line.replace(/[^|]/g, '').length >= 2) {
      flushParagraph(i - 1);
      // skip markdown separator rows (|---|---|)
      if (!/^\|?[\s:|-]+\|?$/.test(line)) {
        blocks.push(makeBlock('table', line, i, i, lineOffsets, lines, currentPath(sectionStack)));
      }
      continue;
    }

    // Paragraph accumulation
    if (paragraphBuf.length === 0) paraStartLine = i;
    paragraphBuf.push(raw);
  }
  flushParagraph(lines.length - 1);

  let paraIndex = 0;
  return blocks.map((b) => {
    const anchor: SourceAnchor = {
      line_start: b.line_start + 1, // 1-based for humans
      line_end: b.line_end + 1,
      char_start: b.char_start,
      char_end: b.char_end,
      section_path: b.section_path.length ? b.section_path : undefined,
    };
    if (b.kind === 'paragraph') anchor.paragraph_index = paraIndex++;
    if (isDeck && (b.kind === 'slide_title' || b.kind === 'slide_body')) {
      anchor.slide = slideNumberFor(blocks, b);
    }
    return {
      unit_id: stableId('u', b.kind, b.char_start, b.text.slice(0, 40)),
      kind: b.kind,
      text: b.text,
      source_anchor: anchor,
      confidence: 1,
    } satisfies ArtifactUnit;
  });
}

function slideNumberFor(blocks: Block[], target: Block): number {
  let n = 0;
  for (const b of blocks) {
    if (b.kind === 'slide_title') n++;
    if (b === target) return Math.max(1, n);
  }
  return Math.max(1, n);
}

function makeBlock(
  kind: UnitKind,
  text: string,
  lineStart: number,
  lineEnd: number,
  lineOffsets: number[],
  lines: string[],
  section_path: string[],
): Block {
  const safeEnd = Math.max(lineStart, lineEnd);
  const char_start = lineOffsets[lineStart] ?? 0;
  const lastLen = (lines[safeEnd] ?? '').length;
  const char_end = (lineOffsets[safeEnd] ?? char_start) + lastLen;
  return { kind, text, line_start: lineStart, line_end: safeEnd, char_start, char_end, section_path };
}

function currentPath(stack: { level: number; title: string }[]): string[] {
  return stack.map((s) => s.title);
}

// ---------------------------------------------------------------------------
// Transcript extraction: one unit per speaker turn.
// ---------------------------------------------------------------------------

function extractTranscript(text: string): ArtifactUnit[] {
  const lines = text.split('\n');
  const units: ArtifactUnit[] = [];
  let offset = 0;
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    const start = offset;
    offset += line.length + 1;
    if (!trimmed) return;
    units.push({
      unit_id: stableId('u', 'turn', start, trimmed.slice(0, 40)),
      kind: 'transcript_turn',
      text: trimmed,
      source_anchor: { line_start: i + 1, line_end: i + 1, char_start: start, char_end: start + line.length },
      confidence: 1,
    });
  });
  return units;
}
