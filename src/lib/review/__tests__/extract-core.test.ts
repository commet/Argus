import { describe, it, expect } from 'vitest';
import {
  reconstructPage,
  groupBlocks,
  paragraphsFromSlideXml,
  decodeXml,
  slideNum,
  type PdfItem,
} from '../extract-core';

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
