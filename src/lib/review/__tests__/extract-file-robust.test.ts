// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
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

  it('turns a small image into a vision payload (no text path)', async () => {
    // A small png rides verbatim — no canvas needed, so this runs in jsdom.
    const f = new File([new Uint8Array(512)], 'chart.png', { type: 'image/png' });
    const r = await extractFile(f, 'image');
    expect(r.quality).toBe('medium');
    expect(r.text).toBe('');
    expect(r.vision?.kind).toBe('images');
    expect(r.vision?.images?.[0].media_type).toBe('image/png');
    expect(r.vision?.images?.[0].page).toBe(1);
    expect(typeof r.vision?.images?.[0].data).toBe('string');
  });

  it('resolves media type from the extension when MIME is missing', async () => {
    const f = new File([new Uint8Array(300)], 'photo.JPG', { type: '' });
    const r = await extractFile(f, 'image');
    expect(r.vision?.images?.[0].media_type).toBe('image/jpeg');
  });

  it('refuses an unsupported image format honestly', async () => {
    const f = new File([new Uint8Array(64)], 'photo.heic', { type: 'image/heic' });
    const r = await extractFile(f, 'image');
    expect(r.quality).toBe('unsupported');
    expect(r.error_kind).toBe('wrong_format');
    expect(r.note).toMatch(/PNG|형식/);
  });

  it('extracts text from an HWPX (Contents/sectionN.xml, runs joined + entities decoded)', async () => {
    const zip = new JSZip();
    zip.file(
      'Contents/section0.xml',
      '<hml><hp:p><hp:run><hp:t>첫 번째 문단입니다. 이 문서는 검수 대상이 되는 충분한 본문을 담고 있습니다.</hp:t></hp:run></hp:p>' +
        '<hp:p><hp:t>두 번째 </hp:t><hp:t>문단 &amp; 인용을 포함합니다.</hp:t></hp:p></hml>',
    );
    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const r = await extractFile(new File([buf], 'plan.hwpx'), 'hwpx');
    expect(r.quality).toBe('medium');
    expect(r.text).toContain('첫 번째 문단입니다.');
    // adjacent <hp:t> runs join into one paragraph; &amp; decodes to &
    expect(r.text).toContain('두 번째 문단 & 인용을 포함합니다.');
    // paragraph boundaries become newlines
    expect(r.text.split('\n').length).toBeGreaterThanOrEqual(2);
  });

  it('refuses a mislabeled/old .hwp (zip with no Contents/section xml) honestly', async () => {
    const zip = new JSZip();
    zip.file('BodyText/Section0', 'not owpml');
    const buf = await zip.generateAsync({ type: 'arraybuffer' });
    const r = await extractFile(new File([buf], 'legacy.hwpx'), 'hwpx');
    expect(r.quality).toBe('unsupported');
    expect(r.error_kind).toBe('wrong_format');
    expect(r.note).toMatch(/한글|HWPX|손상/);
  });

  // Note: the corrupt/encrypted PARSER path is covered by classifyExtractError
  // above (every error kind) plus the extractFile try/catch that funnels every
  // parser throw through it — exercised end-to-end by the real-doc suites. We do
  // not drive a garbage binary through the real mammoth/pdf.js here because those
  // libraries emit internal floating rejections on malformed input (their noise,
  // not ours); the classifier contract is what guarantees the honest surface.
});
