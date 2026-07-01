import { describe, it, expect } from 'vitest';
import { ingest } from '../ingest';

describe('ingest — text/markdown structural extraction', () => {
  const md = `# 전략 메모\n\n온보딩을 3주 안에 리빌드한다.\n\n## 근거\n\n- retention이 낮다\n- 경쟁사가 빠르다\n\n> 예산은 이번 분기 안에만 있다`;

  it('splits into units with line + char + section anchors', () => {
    const a = ingest({ source_kind: 'markdown', title: '온보딩 전략', text: md });
    expect(a.extraction_quality).toBe('high');
    expect(a.units.length).toBeGreaterThan(3);

    const heading = a.units.find((u) => u.kind === 'heading' && u.text === '근거');
    expect(heading).toBeTruthy();
    expect(heading!.source_anchor.line_start).toBeGreaterThan(0);

    // bullets carry the parent heading in section_path
    const bullet = a.units.find((u) => u.kind === 'bullet' && u.text.includes('retention'));
    expect(bullet).toBeTruthy();
    expect(bullet!.source_anchor.section_path).toContain('근거');

    const quote = a.units.find((u) => u.kind === 'quote');
    expect(quote!.text).toContain('예산');
  });

  it('gives every unit a stable, unique id and full anchor coverage', () => {
    const a = ingest({ source_kind: 'markdown', text: md });
    const ids = a.units.map((u) => u.unit_id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(a.units.every((u) => u.source_anchor.line_start !== undefined)).toBe(true);
  });

  it('is deterministic — same text yields same fingerprint', () => {
    const a = ingest({ source_kind: 'markdown', text: md });
    const b = ingest({ source_kind: 'markdown', text: md });
    expect(a.source_fingerprint).toBe(b.source_fingerprint);
  });
});

describe('ingest — deck slide anchors', () => {
  it('assigns slide numbers to pptx units', () => {
    const deck = `# 시장 규모\n\n- TAM 10조\n\n---\n\n# GTM\n\n- 인바운드 먼저`;
    const a = ingest({ source_kind: 'pptx', text: deck });
    expect(a.detected_structure.is_deck).toBe(true);
    const slideTitles = a.units.filter((u) => u.kind === 'slide_title');
    expect(slideTitles.length).toBe(2);
    expect(slideTitles[0].source_anchor.slide).toBe(1);
    expect(slideTitles[1].source_anchor.slide).toBe(2);
    expect(a.extraction_notes[0]).toContain('슬라이드');
  });
});

describe('ingest — honest degrade for unparsed binary + empty', () => {
  it('returns unsupported (not a fake review) for a pdf with no text', () => {
    const a = ingest({ source_kind: 'pdf', title: '보고서.pdf' });
    expect(a.extraction_quality).toBe('unsupported');
    expect(a.units.length).toBe(0);
    expect(a.extraction_notes[0]).toContain('붙여넣');
  });

  it('accepts pre-extracted text for a pdf and reviews it (medium quality)', () => {
    const a = ingest({ source_kind: 'pdf', pre_extracted: '# 제목\n\n본문 문단입니다.' });
    expect(a.extraction_quality).toBe('medium');
    expect(a.units.length).toBeGreaterThan(0);
  });

  it('degrades empty paste', () => {
    const a = ingest({ source_kind: 'paste', text: '   ' });
    expect(a.extraction_quality).toBe('unsupported');
  });
});
