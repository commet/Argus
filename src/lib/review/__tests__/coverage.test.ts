import { describe, it, expect } from 'vitest';
import { packUnitsForPrompt, chunkUnitsForReview, computeCoverage, PROMPT_CHAR_BUDGET, PER_UNIT_CHAR_CAP, UNITS_PER_CHUNK } from '../coverage';
import { type ArtifactUnit, type CanonicalArtifact } from '../schema';

const unit = (id: string, text: string): ArtifactUnit => ({
  unit_id: id, kind: 'paragraph', text, source_anchor: { line_start: 1, line_end: 1 }, confidence: 1,
});

const artifact = (units: ArtifactUnit[], source_caps?: CanonicalArtifact['source_caps']): CanonicalArtifact => ({
  artifact_id: 'a', source_kind: 'paste', source_title: 't', source_fingerprint: 'fp',
  extraction_quality: 'high', privacy_mode: 'receipt_only', units,
  detected_structure: { is_deck: false }, extraction_notes: [], source_caps,
});

describe('packUnitsForPrompt', () => {
  it('caps by unit count', () => {
    const units = Array.from({ length: 300 }, (_, i) => unit(`u${i}`, 'x'.repeat(10)));
    const packed = packUnitsForPrompt(units, 160);
    expect(packed.units.length).toBe(160);
    expect(packed.total).toBe(300);
  });

  it('caps by cumulative char budget before the count cap', () => {
    // 100 units × 1000 chars = 100k > 40k budget → stops well before 160.
    const units = Array.from({ length: 100 }, (_, i) => unit(`u${i}`, 'y'.repeat(1000)));
    const packed = packUnitsForPrompt(units, 160);
    const chars = packed.units.reduce((n, u) => n + u.text.length, 0);
    expect(chars).toBeLessThanOrEqual(PROMPT_CHAR_BUDGET);
    expect(packed.units.length).toBeLessThan(100);
    expect(packed.total).toBe(100);
  });

  it('truncates a single oversized unit instead of dropping it (never emits zero)', () => {
    const giant = unit('big', 'z'.repeat(200_000));
    const packed = packUnitsForPrompt([giant], 160);
    expect(packed.units.length).toBe(1);
    expect(packed.units[0].text.length).toBe(PER_UNIT_CHAR_CAP);
    expect(packed.units[0].text.length).toBeLessThan(giant.text.length);
  });

  it('leaves a small document untouched', () => {
    const units = [unit('a', 'hello'), unit('b', 'world')];
    const packed = packUnitsForPrompt(units, 160);
    expect(packed.units).toEqual(units);
    expect(packed.total).toBe(2);
  });
});

describe('chunkUnitsForReview', () => {
  it('keeps a short document as a single chunk (single-pass path)', () => {
    const units = [unit('a', 'hello'), unit('b', 'world')];
    const r = chunkUnitsForReview(units, 10);
    expect(r.chunks.length).toBe(1);
    expect(r.unitsReviewed).toBe(2);
    expect(r.dropped).toBe(0);
  });

  it('splits a long document by the char budget so the WHOLE thing is covered', () => {
    // 300 units × ~1000 chars → far past one 40k prompt; must become many chunks
    // that together cover every unit (the old front-slice reviewed ~13%).
    const units = Array.from({ length: 300 }, (_, i) => unit(`u${i}`, 'y'.repeat(1000)));
    const r = chunkUnitsForReview(units, 20);
    expect(r.chunks.length).toBeGreaterThan(1);
    for (const c of r.chunks) {
      const chars = c.reduce((n, u) => n + u.text.length, 0);
      expect(chars).toBeLessThanOrEqual(PROMPT_CHAR_BUDGET);
    }
    expect(r.unitsReviewed).toBe(300);
    expect(r.dropped).toBe(0);
  });

  it('caps at maxChunks and reports the remainder as dropped (honest, never silent)', () => {
    const units = Array.from({ length: 500 }, (_, i) => unit(`u${i}`, 'z'.repeat(1000)));
    const r = chunkUnitsForReview(units, 3);
    expect(r.chunks.length).toBe(3);
    expect(r.unitsReviewed).toBeLessThan(500);
    expect(r.unitsReviewed + r.dropped).toBe(500);
    expect(r.dropped).toBeGreaterThan(0);
  });

  it('bounds units per chunk even when chars are tiny', () => {
    const units = Array.from({ length: UNITS_PER_CHUNK * 3 }, (_, i) => unit(`u${i}`, 'x'));
    const r = chunkUnitsForReview(units, 10);
    for (const c of r.chunks) expect(c.length).toBeLessThanOrEqual(UNITS_PER_CHUNK);
    expect(r.unitsReviewed).toBe(UNITS_PER_CHUNK * 3);
  });

  it('truncates a lone oversized unit instead of dropping it', () => {
    const r = chunkUnitsForReview([unit('big', 'q'.repeat(200_000))], 10);
    expect(r.chunks.length).toBe(1);
    expect(r.chunks[0][0].text.length).toBe(PER_UNIT_CHAR_CAP);
  });
});

describe('computeCoverage', () => {
  it('reports full coverage when nothing was dropped', () => {
    const art = artifact([unit('a', 'x'), unit('b', 'y')]);
    const cov = computeCoverage(art, 2);
    expect(cov.band).toBe('full');
    expect(cov.notes).toEqual([]);
    expect(cov.units_reviewed).toBe(2);
    expect(cov.units_total).toBe(2);
  });

  it('flags partial when a majority (but not all) units were reviewed', () => {
    const units = Array.from({ length: 200 }, (_, i) => unit(`u${i}`, 'x'));
    const cov = computeCoverage(artifact(units), 160);
    expect(cov.band).toBe('partial'); // 160/200 = 0.8
    expect(cov.notes.some((n) => n.includes('200개 항목 중 앞 160개'))).toBe(true);
  });

  it('flags low when only a minority was reviewed', () => {
    const units = Array.from({ length: 500 }, (_, i) => unit(`u${i}`, 'x'));
    const cov = computeCoverage(artifact(units), 160);
    expect(cov.band).toBe('low'); // 160/500 = 0.32
  });

  it('discloses a page-capped PDF (320 pages → 120 read) as low with a note', () => {
    const units = Array.from({ length: 100 }, (_, i) => unit(`u${i}`, 'x'));
    const cov = computeCoverage(
      artifact(units, { pages_total: 320, pages_read: 120, units_capped: true }),
      100,
    );
    expect(cov.band).toBe('low'); // 120/320 = 0.375
    expect(cov.pages_total).toBe(320);
    expect(cov.notes.some((n) => n.includes('320쪽 중 앞 120쪽'))).toBe(true);
  });

  it('discloses a slide-capped deck', () => {
    const units = Array.from({ length: 50 }, (_, i) => unit(`u${i}`, 'x'));
    const cov = computeCoverage(artifact(units, { slides_total: 80, slides_read: 60 }), 50);
    expect(cov.notes.some((n) => n.includes('80장 중 앞 60장'))).toBe(true);
    expect(cov.band).toBe('partial'); // 60/80 = 0.75
  });
});
