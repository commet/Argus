import { describe, it, expect } from 'vitest';
import {
  reconstructPage,
  groupBlocks,
  paragraphsFromSlideXml,
  decodeXml,
  slideNum,
  pdfHeadingTitle,
  emitPdfUnits,
  type PdfItem,
} from '../extract-core';
import { type ArtifactUnit } from '../schema';

/** Build a pdf.js-shaped text item at (x,y) with an explicit advance width. */
function item(str: string, x: number, y: number, width = str.length * 5): PdfItem {
  return { str, transform: [1, 0, 0, 1, x, y], width };
}

describe('reconstructPage — single column', () => {
  it('keeps normal prose in top-to-bottom reading order, no column/table flags', () => {
    const items = [
      item('First line', 50, 700),
      item('Second line', 50, 680),
      item('Third line', 50, 660),
      item('Fourth line', 50, 640),
      item('Fifth line', 50, 620),
      item('Sixth line', 50, 600),
    ];
    const out = reconstructPage(items);
    expect(out.multiColumn).toBe(false);
    expect(out.hasTable).toBe(false);
    expect(out.lines).toEqual([
      'First line', 'Second line', 'Third line', 'Fourth line', 'Fifth line', 'Sixth line',
    ]);
  });
});

describe('reconstructPage — two columns', () => {
  it('reads the whole left column before the right, never interleaving', () => {
    const items: PdfItem[] = [];
    // left column at x=50 (ends ~90), right column at x=300 (ends ~340).
    for (let i = 0; i < 6; i++) {
      const y = 700 - i * 20;
      items.push(item(`L${i}`, 50, y, 40));
      items.push(item(`R${i}`, 300, y, 40));
    }
    const out = reconstructPage(items);
    expect(out.multiColumn).toBe(true);
    // left column first (L0..L5), then right column (R0..R5) — not L0 R0 L1 R1 …
    expect(out.lines).toEqual(['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'R0', 'R1', 'R2', 'R3', 'R4', 'R5']);
  });
});

describe('reconstructPage — table row', () => {
  it('preserves 3+ gap-separated cells with a separator instead of flattening', () => {
    const items = [
      item('Region', 50, 500, 30),
      item('Q1', 250, 500, 20),
      item('Q2', 450, 500, 20),
    ];
    const out = reconstructPage(items);
    expect(out.hasTable).toBe(true);
    expect(out.lines[0]).toBe('Region | Q1 | Q2');
  });
});

describe('groupBlocks', () => {
  it('joins consecutive lines and breaks on blanks', () => {
    expect(groupBlocks(['a', 'b', '', 'c'])).toEqual(['a b', 'c']);
  });
});

describe('pdfHeadingTitle', () => {
  it('detects numbered/keyword headers incl. spaced Korean, not prose', () => {
    for (const h of ['1. 개요', '2.1 현황 분석', '제 3 장 결론', 'Executive Summary', 'Ⅱ. 시장 규모', '3) 실행 계획', '부록 A', '요약'])
      expect(pdfHeadingTitle(h), h).toBe(h);
    for (const body of ['우리는 매출이 크게 늘었다고 본다.', '개요를 정리하면 다음과 같다', '요약하자면 우리는 성장했다', ''])
      expect(pdfHeadingTitle(body), body).toBeNull();
  });
});

describe('emitPdfUnits', () => {
  const bigLine = '이 문단은 본문 서술이다. '.repeat(120); // > PDF_PARA_CHARS

  it('splits a page with NO blank lines into granular units (not one blob) and detects headings', () => {
    // Mimics reconstructPage output: headings are their own short lines, body is
    // long unbroken lines — exactly the shape that collapsed a whole page into
    // one unit before line-level segmentation.
    const lines = ['1. 개요', bigLine, bigLine, '2. 현황 분석', bigLine];
    const units: ArtifactUnit[] = [];
    const section = emitPdfUnits(lines, 3, units, null, () => {});

    expect(units.length).toBeGreaterThan(3); // NOT a single page-sized blob
    const headings = units.filter((u) => u.kind === 'heading');
    expect(headings.map((h) => h.text)).toEqual(['1. 개요', '2. 현황 분석']);
    // every unit anchors to the page; paragraphs carry the running section.
    for (const u of units) expect(u.source_anchor.page).toBe(3);
    const firstPara = units.find((u) => u.kind === 'paragraph')!;
    expect(firstPara.source_anchor.section_path).toEqual(['1. 개요']);
    const lastPara = units[units.length - 1];
    expect(lastPara.source_anchor.section_path).toEqual(['2. 현황 분석']);
    expect(section).toBe('2. 현황 분석'); // running section carries to the next page
  });

  it('breaks a long section body by size even with no heading', () => {
    const units: ArtifactUnit[] = [];
    emitPdfUnits([bigLine, bigLine, bigLine], 1, units, null, () => {});
    expect(units.length).toBeGreaterThan(1);
    expect(units.every((u) => u.kind === 'paragraph')).toBe(true);
  });

  it('honors the unit ceiling and reports it via onCap', () => {
    let capped = false;
    const units: ArtifactUnit[] = [];
    emitPdfUnits([bigLine, bigLine, bigLine, bigLine], 1, units, null, () => { capped = true; }, 2);
    expect(capped).toBe(true);
    expect(units.length).toBeLessThanOrEqual(2);
  });
});

describe('pptx xml helpers', () => {
  it('extracts one string per paragraph and decodes entities', () => {
    const xml = '<a:p><a:r><a:t>Hello &amp; </a:t></a:r><a:r><a:t>world</a:t></a:r></a:p><a:p><a:t>Second</a:t></a:p>';
    expect(paragraphsFromSlideXml(xml)).toEqual(['Hello & world', 'Second']);
  });
  it('decodeXml unescapes the five entities', () => {
    expect(decodeXml('&lt;a&gt; &quot;b&quot; &amp; c&#39;')).toBe('<a> "b" & c\'');
  });
  it('slideNum reads the slide ordinal from the path', () => {
    expect(slideNum('ppt/slides/slide12.xml')).toBe(12);
  });
});
