/**
 * P1-4 체크포인트 다이어트 — blob interning round-trip.
 * Checkpoints store @cpblob: refs for large strings; restore resolves them;
 * legacy full-string checkpoints pass through untouched.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(() => Promise.resolve({ data: { session: null } })) } },
  getCurrentUserId: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('@/lib/db', () => ({ upsertToSupabase: vi.fn(), loadAndMerge: vi.fn(() => Promise.resolve([])) }));

import { cpBlobKey, internCpString, resolveCpString } from '@/stores/useProgressiveStore';

const BIG = '결과 문서 '.repeat(100); // ≥200 chars — intern-eligible
const SMALL = '짧은 한 줄';

describe('intern/resolve round-trip', () => {
  it('interns a large string once and resolves it back identically', () => {
    const blobs: Record<string, string> = {};
    const ref = internCpString(blobs, BIG)!;
    expect(ref.startsWith('@cpblob:')).toBe(true);
    expect(Object.keys(blobs)).toHaveLength(1);
    expect(resolveCpString(blobs, ref)).toBe(BIG);
  });

  it('dedups: the same content interned twice stores ONE blob (the 8x fix)', () => {
    const blobs: Record<string, string> = {};
    const r1 = internCpString(blobs, BIG);
    const r2 = internCpString(blobs, BIG);
    expect(r1).toBe(r2);
    expect(Object.keys(blobs)).toHaveLength(1);
  });

  it('small strings and null pass through uninterned', () => {
    const blobs: Record<string, string> = {};
    expect(internCpString(blobs, SMALL)).toBe(SMALL);
    expect(internCpString(blobs, null)).toBeNull();
    expect(Object.keys(blobs)).toHaveLength(0);
  });

  it('an already-interned ref is never double-interned', () => {
    const blobs: Record<string, string> = {};
    const ref = internCpString(blobs, BIG)!;
    expect(internCpString(blobs, ref)).toBe(ref);
    expect(Object.keys(blobs)).toHaveLength(1);
  });

  it('legacy full strings resolve unchanged (no blobs needed)', () => {
    expect(resolveCpString(undefined, BIG)).toBe(BIG);
    expect(resolveCpString({}, SMALL)).toBe(SMALL);
    expect(resolveCpString(undefined, null)).toBeNull();
  });

  it('a missing blob resolves to the visible ref marker, never silent empty', () => {
    const ref = '@cpblob:' + cpBlobKey(BIG);
    expect(resolveCpString({}, ref)).toBe(ref);
  });

  it('keys differ for different content, match for equal content', () => {
    expect(cpBlobKey(BIG)).toBe(cpBlobKey('결과 문서 '.repeat(100)));
    expect(cpBlobKey(BIG)).not.toBe(cpBlobKey(BIG + '!'));
  });
});
