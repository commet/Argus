/**
 * Closed-decision capture guard — the repair for the 2026-08-10 over-fire
 * finding (a model acknowledged a closed decision and captured it anyway,
 * twice, across two instruction-level repairs). The surviving fix lives at
 * the point of temptation: the tool description (read when the tool is
 * considered) and the premise text field (read when the premise is written).
 * This test keeps both from silently vanishing in a refactor.
 * Receipt: docs/receipts/2026-08-10-m1-overfire-eval/.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from '../public-tools.js';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public-tools.ts'),
  'utf8'
);

describe('closed decisions are never capture material', () => {
  it('argus_capture tool description carries the rule (runtime surface)', () => {
    expect(decide.description).toContain('closed or told you not to revisit');
    expect(decide.description).toContain('never capture material');
  });

  it('premise text field description carries the rule in both languages (call-time surface)', () => {
    expect(source).toContain('사용자가 닫은 결정');
    expect(source).toContain('Never build a premise from a decision the user closed');
  });
});
