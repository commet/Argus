/**
 * Prompt single-source parity (plugin 잔여 — sail 재배선 acceptance).
 *
 * The probe prompts exist in two places by necessity (web imports TS; plugin
 * skills read markdown at runtime). This test is what makes them ONE source:
 * every canonical Korean block must appear VERBATIM in both. Edit one side
 * without the other → fail. (복붙 드리프트 차단 — CLAUDE.md single-source.)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GROUND_RULES,
  C_SAMPLE_BLOCK,
  C_FORK_RULES_BLOCK,
  D_ABLATION_BLOCK,
  cSamplePrompt,
  cForkPrompt,
  dPrompt,
} from '../prompts/probe-prompts';

// JS template literals are LF-normalized at parse time (ECMAScript spec), but
// readFileSync returns whatever line endings git checked out (CRLF on Windows
// with autocrlf). Normalize both sides so parity compares CONTENT, not checkout
// config — without this the suite fails on Windows despite zero drift.
const lf = (s: string) => s.replace(/\r\n/g, '\n');

const PLUGIN_MD = lf(readFileSync(
  join(process.cwd(), 'argus-plugin-v2/data/prompts/probe-prompts.md'),
  'utf8',
));

describe('probe prompt parity: web TS ⇄ plugin md', () => {
  it.each([
    ['GROUND_RULES', GROUND_RULES],
    ['C_SAMPLE_BLOCK', C_SAMPLE_BLOCK],
    ['C_FORK_RULES_BLOCK', C_FORK_RULES_BLOCK],
    ['D_ABLATION_BLOCK', D_ABLATION_BLOCK],
  ])('%s appears verbatim in the plugin prompt file', (_name, block) => {
    expect(PLUGIN_MD).toContain(lf(block).trim());
  });

  it('the plugin file declares the parity contract (so a skill editor sees it)', () => {
    expect(PLUGIN_MD).toContain('probe-prompts.ts');
    expect(PLUGIN_MD).toContain('재발명 금지');
  });

  it('fork→question mechanical rules are mirrored (cap + write-my-own + flipped claim)', () => {
    // The plugin's conversion section must state the same invariants
    // fork-to-question.ts enforces in code.
    expect(PLUGIN_MD).toContain('≤2');
    expect(PLUGIN_MD).toContain('직접 입력');
    expect(PLUGIN_MD).toContain('flipped_user_claim');
    expect(PLUGIN_MD).toContain('purpose_reading');
  });
});

describe('web builders still assemble from the canonical blocks', () => {
  const sample = {
    week1_action: 'a',
    key_resource: 'b',
    success_test: 'c',
    purpose_reading: 'd',
  };

  it('every builder embeds GROUND_RULES and the user-data wrapper', () => {
    for (const prompt of [cSamplePrompt('문단'), cForkPrompt('문단', [sample]), dPrompt('문단')]) {
      expect(prompt).toContain(GROUND_RULES.trim());
      expect(prompt).toContain('<user-data>');
    }
  });

  it('cForkPrompt carries the drop rule and the field-scoped re-probe variant', () => {
    expect(cForkPrompt('문단', [sample])).toContain('버려라');
    expect(cForkPrompt('문단', [sample], ['week1_action'])).toContain('이번에는 다음 필드만 보라: week1_action');
  });
});
