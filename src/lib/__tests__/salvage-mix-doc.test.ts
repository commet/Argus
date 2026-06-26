/**
 * salvageMixDoc — graceful degrade for a truncated draft/final document.
 *
 * When the streamed mix/final JSON is cut off mid-structure (the document
 * exceeded the output budget), we must still recover the complete sections that
 * DID stream rather than losing the whole draft after minutes of work. The last,
 * partial section is dropped; every complete one is kept.
 */

import { describe, it, expect } from 'vitest';
import { salvageMixDoc } from '@/lib/partial-analysis';

describe('salvageMixDoc', () => {
  it('recovers title, summary, and the COMPLETE sections from a mid-section truncation', () => {
    // Valid JSON up to section 3, then cut off inside section 3's content.
    const truncated = `{
      "title": "퇴사 후 가게 창업 검토",
      "executive_summary": "검증을 퇴사 기준으로 삼되 GO 숫자를 먼저 정해야 합니다.",
      "sections": [
        {"heading": "상권 분석", "content": "유동인구와 소득 수준을 먼저 본다."},
        {"heading": "손익분기", "content": "월 고정비 대비 필요한 매출을 추정한다.", "contributors": ["혜연"]},
        {"heading": "수요 검증", "content": "이 콘셉트가 우리 동네에서 통하는`;

    const doc = salvageMixDoc(truncated);
    expect(doc).not.toBeNull();
    expect(doc!.title).toBe('퇴사 후 가게 창업 검토');
    expect(doc!.executive_summary).toContain('GO 숫자');
    // The two complete sections survive; the truncated third is dropped.
    expect(doc!.sections).toHaveLength(2);
    expect(doc!.sections[0].heading).toBe('상권 분석');
    expect(doc!.sections[1].heading).toBe('손익분기');
    expect(doc!.sections[1].contributors).toEqual(['혜연']);
  });

  it('parses a fully-complete document unchanged (incl. key_assumptions / next_steps)', () => {
    const full = JSON.stringify({
      title: 'T', executive_summary: 'S',
      sections: [{ heading: 'A', content: 'a' }, { heading: 'B', content: 'b' }],
      key_assumptions: ['k1', 'k2'], next_steps: ['n1'],
    });
    const doc = salvageMixDoc(full)!;
    expect(doc.sections).toHaveLength(2);
    expect(doc.key_assumptions).toEqual(['k1', 'k2']);
    expect(doc.next_steps).toEqual(['n1']);
  });

  it('returns null when there is nothing worth keeping', () => {
    expect(salvageMixDoc('')).toBeNull();
    expect(salvageMixDoc('{"title": "')).toBeNull();          // title not even closed, no sections
    expect(salvageMixDoc('garbage with no json at all')).toBeNull();
  });

  it('keeps a section that streamed heading+content even if later sections are cut', () => {
    const t = `{"title":"X","sections":[{"heading":"only","content":"done"},{"heading":"cut`;
    const doc = salvageMixDoc(t)!;
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0].content).toBe('done');
  });
});
