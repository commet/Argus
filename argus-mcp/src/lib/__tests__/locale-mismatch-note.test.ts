import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { tmpArgusDir } from '../../test-helpers.js';
import { appendLocaleMismatchNote } from '../locale-mismatch.js';
import type { McpToolResult } from '../envelope.js';

/**
 * §9.7 O1 exit — 대화-언어 불일치 1회 확인.
 *
 * The 2026-06-15 incident: an eval run pinned `locale: en` into a real config
 * and a Korean founder got English surfaces for a month — the pin was never
 * silently overridden (correct) but also never QUESTIONED (the gap). Contract:
 * pin exists + user's own content speaks the other language → ONE note (fact +
 * argus_settings handle, in the user's spoken language), then silence forever.
 * Ignoring the note is a valid answer — never re-asked, never auto-updated.
 */

function okResult(surface = 'Saved.'): McpToolResult {
  const sc = { ok: true, tool: 'argus_predict', surface, data: {} };
  return { content: [{ type: 'text', text: JSON.stringify(sc) }], structuredContent: sc as unknown as Record<string, unknown> };
}

function pin(dir: string, locale: 'ko' | 'en'): void {
  fs.writeFileSync(path.join(dir, 'config.yaml'), `schema_version: 5\nlocale: ${locale}\n`, 'utf8');
}

const KO_ARGS = { predicate: '이번 분기 이탈률이 3% 아래로 유지된다' };
const EN_ARGS = { predicate: 'churn stays under 3 percent this quarter' };

describe('locale-mismatch once-note (§9.7 O1)', () => {
  it('pinned en + Korean words → ONE Korean note with the argus_settings handle, then permanent silence', () => {
    const dir = tmpArgusDir();
    pin(dir, 'en');
    const first = appendLocaleMismatchNote(dir, KO_ARGS, okResult());
    const s1 = String((first.structuredContent as Record<string, unknown>)['surface']);
    expect(s1).toContain('argus_settings');
    expect(s1).toContain('한국어'); // the note speaks the user's language
    // the content text (what a structured-hiding host shows) carries the same bytes
    expect(first.content[0]!.text).toContain('argus_settings');

    const second = appendLocaleMismatchNote(dir, KO_ARGS, okResult());
    expect(String((second.structuredContent as Record<string, unknown>)['surface'])).toBe('Saved.'); // asked once, ever
    expect(fs.existsSync(path.join(dir, 'locale-mismatch-noted'))).toBe(true);
  });

  it('pinned ko + English words → one English note', () => {
    const dir = tmpArgusDir();
    pin(dir, 'ko');
    const r = appendLocaleMismatchNote(dir, EN_ARGS, okResult());
    expect(String((r.structuredContent as Record<string, unknown>)['surface'])).toContain('locale="en"');
  });

  it('no pin → never notes (the text-detection chain already speaks the user\'s language)', () => {
    const dir = tmpArgusDir();
    const r = appendLocaleMismatchNote(dir, KO_ARGS, okResult());
    expect(String((r.structuredContent as Record<string, unknown>)['surface'])).toBe('Saved.');
    expect(fs.existsSync(path.join(dir, 'locale-mismatch-noted'))).toBe(false);
  });

  it('pin matches the spoken language → untouched, no marker spent', () => {
    const dir = tmpArgusDir();
    pin(dir, 'ko');
    const r = appendLocaleMismatchNote(dir, KO_ARGS, okResult());
    expect(String((r.structuredContent as Record<string, unknown>)['surface'])).toBe('Saved.');
    expect(fs.existsSync(path.join(dir, 'locale-mismatch-noted'))).toBe(false);
  });

  it('never decorates an error result, and does not spend the once-marker on one', () => {
    const dir = tmpArgusDir();
    pin(dir, 'en');
    const err: McpToolResult = { content: [{ type: 'text', text: '{}' }], structuredContent: { ok: false, error_code: 'X' }, isError: true };
    const r = appendLocaleMismatchNote(dir, KO_ARGS, err);
    expect(r.isError).toBe(true);
    expect(fs.existsSync(path.join(dir, 'locale-mismatch-noted'))).toBe(false);
  });

  it('no confident content signal (ids only) → untouched', () => {
    const dir = tmpArgusDir();
    pin(dir, 'en');
    const r = appendLocaleMismatchNote(dir, { id: '한글아이디' }, okResult());
    expect(String((r.structuredContent as Record<string, unknown>)['surface'])).toBe('Saved.');
  });
});
