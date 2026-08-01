/**
 * The loop only teaches if it knows how sure the person was.
 *
 * A settled record that says 맞았다 / 틀렸다 carries almost no information:
 * being wrong about a coin flip and being wrong about something you were
 * certain of are different events, and only the second is worth anyone's
 * attention. Pairing what they SAID with what happened is the mechanism —
 * feedback on stated confidence, not on outcomes alone.
 *
 * The spine constrains how far this may go: it is recorded, paired, and shown
 * back as their own two sentences. It is never scored, averaged, turned into a
 * rate or tier, or used to route anything — the moment it becomes a number
 * about the person it stops being feedback and becomes a verdict.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const seal = read('src/components/workspace/progressive/SealMoment.tsx');
const settle = read('src/components/projects/FoundationSettlementModal.tsx');
const types = read('src/stores/types.ts');

describe('asking, once, in their words', () => {
  it('offers three plain readings rather than a percentage', () => {
    expect(seal).toContain('반반이에요');
    expect(seal).toContain('그럴 것 같아요');
    expect(seal).toContain('거의 확실해요');
    // A percentage would be false precision and unfriendly to ask for.
    expect(seal).not.toMatch(/확률.*%|몇\s*%/);
  });

  it('is optional and can be un-picked', () => {
    expect(seal).toContain("L('선택', 'optional')");
    expect(seal).toContain('onChange(value === option.id ? null : option.id)');
  });

  it('is not asked when nothing will come back to compare it against', () => {
    expect(seal).toContain("selectedKind !== 'witness' && (");
  });

  it('rides along on the sealed predicate only when given', () => {
    expect(seal).toContain('...(statedConfidence ? { stated_confidence: statedConfidence } : {})');
  });
});

describe('showing it back without grading anyone', () => {
  it('pairs what they said with what happened', () => {
    expect(settle).toContain('ConfidencePairing');
    expect(settle).toContain('그때 이렇게 보셨어요');
    expect(settle).toContain('실제로는');
  });

  it('renders nothing at all when they skipped the question', () => {
    expect(settle).toContain('if (!said) return null;');
  });

  it('never turns it into a rate, a score, or a label about the person', () => {
    const block = settle.slice(settle.indexOf('function ConfidencePairing'));
    expect(block).not.toMatch(/정확도|적중률|calibration score|accuracy|\d+\s*%/);
  });

  it('the type says out loud that it is theirs, not an estimate of them', () => {
    expect(types).toContain('stated_confidence');
    expect(types).toContain('never Argus');
  });
});
