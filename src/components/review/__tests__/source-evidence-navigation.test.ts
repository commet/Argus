import { describe, expect, it } from 'vitest';
import { adjacentEvidencePage, countEvidenceByPage, sourceAnchorPosition } from '../SourceEvidencePane';

describe('source evidence navigation', () => {
  it('counts each receipt item once per page', () => {
    expect(countEvidenceByPage([
      { anchors: [{ page: 2 }, { page: 2 }, { page: 5 }] },
      { anchors: [{ page: 2 }] },
      { anchors: [{ page: 0 }, {}, { page: 8 }] },
    ])).toEqual({ 2: 2, 5: 1, 8: 1 });
  });

  it('moves to the nearest evidence page in either direction', () => {
    const pages = [9, 2, 6, 6];
    expect(adjacentEvidencePage(pages, 6, -1)).toBe(2);
    expect(adjacentEvidencePage(pages, 6, 1)).toBe(9);
    expect(adjacentEvidencePage(pages, 1, -1)).toBeUndefined();
    expect(adjacentEvidencePage(pages, 10, 1)).toBeUndefined();
  });

  it('names the exact semantic position selected in the source', () => {
    expect(sourceAnchorPosition({ page: 6, section_path: ['예산', 'ROI'] }, 'ko')).toBe('6쪽 · 예산 › ROI');
    expect(sourceAnchorPosition({ page: 2, line_start: 14, line_end: 18 }, 'en')).toBe('Page 2 · L14–18');
  });
});
