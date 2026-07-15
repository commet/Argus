// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { extractFile, classifyExtractError } from '../extract-file';

// The file-reading path must NEVER throw an unhandled error at the user — every
// bad file (empty, huge, encrypted, corrupt, mislabeled) returns an honest,
// specific reason. These lock that contract in.

describe('classifyExtractError — honest, specific reasons', () => {
  it('maps a password-protected PDF', () => {
    const r = classifyExtractError({ name: 'PasswordException', message: 'No password given' }, 'pdf');
    expect(r.error_kind).toBe('encrypted');
    expect(r.note).toMatch(/암호/);
  });
  it('maps a structurally broken PDF', () => {
    const r = classifyExtractError({ name: 'InvalidPDFException', message: 'Invalid PDF structure' }, 'pdf');
    expect(r.error_kind).toBe('corrupt');
  });
  it('maps a broken zip (docx/pptx)', () => {
    const r = classifyExtractError(new Error("Can't find end of central directory"), 'docx');
    expect(r.error_kind).toBe('corrupt');
  });
  it('falls back to an honest generic reason (never a raw stack)', () => {
    const r = classifyExtractError(new Error('some internal boom'), 'pptx');
    expect(r.error_kind).toBe('unknown');
    expect(r.note).not.toMatch(/boom/); // never leak the raw message
    expect(r.note).toMatch(/슬라이드|형식/);
  });
});

describe('extractFile — guards run before any parser, never throw', () => {
  it('rejects a 0-byte file honestly', async () => {
    const r = await extractFile(new File([], 'empty.pdf'), 'pdf');
    expect(r.quality).toBe('unsupported');
    expect(r.error_kind).toBe('empty');
    expect(r.note).toMatch(/빈 파일/);
  });

  it('rejects an oversized file honestly (no hang)', async () => {
    const f = new File([new Uint8Array(10)], 'huge.pdf');
    Object.defineProperty(f, 'size', { value: 61_000_000 }); // pretend 61MB
    const r = await extractFile(f, 'pdf');
    expect(r.quality).toBe('unsupported');
    expect(r.error_kind).toBe('too_large');
    expect(r.note).toMatch(/너무 커/);
  });

  it('returns unsupported for a non-binary kind', async () => {
    const r = await extractFile(new File(['hi'], 'x.txt'), 'txt');
    expect(r.quality).toBe('unsupported');
  });

  // Note: the corrupt/encrypted PARSER path is covered by classifyExtractError
  // above (every error kind) plus the extractFile try/catch that funnels every
  // parser throw through it — exercised end-to-end by the real-doc suites. We do
  // not drive a garbage binary through the real mammoth/pdf.js here because those
  // libraries emit internal floating rejections on malformed input (their noise,
  // not ours); the classifier contract is what guarantees the honest surface.
});
