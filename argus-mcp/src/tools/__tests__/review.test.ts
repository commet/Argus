import { describe, it, expect } from 'vitest';
import path from 'path';
import { fileURLToPath } from 'url';
import { review } from '../review.js';

const DOC = `# 온보딩 리빌드 전략

## 문제
retention이 낮다. 첫 주 이탈이 60%다.

## 제안
온보딩을 3단계로 리빌드한다.

## 근거
- 경쟁사도 3단계를 쓴다
- 사용자 인터뷰에서 복잡하다는 피드백이 있었다`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function data(res: any): any {
  return res.structuredContent?.data ?? {};
}

describe('argus_review', () => {
  it('returns reviewability, routed lenses, and points at seal', async () => {
    const res = await review.handler({ text: DOC, source_kind: 'markdown', concerns: ['evidence'] });
    expect(res.isError).toBeFalsy();
    const d = data(res);
    expect(d.reviewability.score).toBeGreaterThan(0);
    expect(d.lenses.length).toBeGreaterThan(0);
    // base spine lenses always present
    const ids = d.lenses.map((l: { id: string }) => l.id);
    expect(ids).toContain('claim_evidence');
    expect(ids).toContain('human_judgment');
    expect(res.structuredContent?.next_actions).toContain('argus_predict');
  });

  it('does not dump the source units twice (they ride in extraction_prompt only)', async () => {
    const d = data(await review.handler({ text: DOC, source_kind: 'markdown' }));
    expect(d.extraction_prompt).toBeTruthy();
    expect('units' in d).toBe(false); // no standalone duplicate of the heavy text
    expect(typeof d.units_total).toBe('number');
  });

  it('surfaces no verdict and leaks no internal unit_id into prose', async () => {
    const res = await review.handler({ text: DOC });
    const surface = String(res.structuredContent?.surface ?? '');
    expect(surface).not.toMatch(/진행하세요|틀렸|맞습니다|추천/);
    expect(surface).not.toMatch(/\bu_[0-9a-f]/); // unit ids stay in the units block
  });

  it('hands a scanned PDF (no extractable text) a VISION scaffold, not a dead-end', async () => {
    // A real 0-text PDF (vector shapes only) — the text extractor is blind, but
    // the host is a vision model, so the tool must tell it to READ THE FILE by eye
    // with the same lenses/spine, never just "paste the text".
    const fixture = fileURLToPath(new URL('fixtures/scanned-no-text.pdf', import.meta.url));
    const res = await review.handler({ file_path: fixture });
    expect(res.isError).toBeFalsy();
    const d = data(res);
    expect(d.vision_required).toBe(true);         // not needs_context/skip
    expect(d.file_path).toBe(fixture);            // the host opens THIS path
    expect(d.anchors_by).toBe('page');
    // same judgment spine the text path hands over
    const ids = d.lenses.map((l: { id: string }) => l.id);
    expect(ids).toContain('claim_evidence');
    expect(ids).toContain('human_judgment');
    // the protocol explicitly tells the host to open + read the file visually
    expect(Array.isArray(d.protocol)).toBe(true);
    expect(d.protocol.join(' ')).toMatch(/눈으로|열어|read|visually/);
    // and it still routes to the same seal loop
    expect(res.structuredContent?.next_actions).toContain('argus_predict');
    // never a verdict in the surface
    expect(String(res.structuredContent?.surface ?? '')).not.toMatch(/진행하세요|틀렸|추천/);
  });

  it('does NOT offer a vision scaffold for a corrupt PDF — the host can\'t read it either', async () => {
    // A structurally broken PDF is a HARD failure: the host cannot open it by eye,
    // so the tool must report an honest reason, not tell the host to "read it visually".
    const fixture = fileURLToPath(new URL('fixtures/corrupt.pdf', import.meta.url));
    const res = await review.handler({ file_path: fixture });
    expect(res.isError).toBeFalsy();
    const d = data(res);
    expect(d.vision_required).toBeFalsy();       // NOT the vision path
    expect(d.needs_context).toBe(true);          // honest degrade
    expect(d.error_kind).toBe('corrupt');
    expect(res.structuredContent?.next_actions).toContain('skip');
  });

  it('degrades honestly on empty input', async () => {
    const res = await review.handler({ text: '' });
    expect(res.isError).toBe(true);
    expect(res.structuredContent?.error_code).toBe('EMPTY');
  });

  it('fails honestly on an unreadable binary path instead of faking a review', async () => {
    // Binaries are now parsed (mammoth / pdf.js / jszip); a path that does not
    // exist must still fail honestly, never fabricate a review. The path sits
    // INSIDE the project root so it clears the read boundary and actually
    // exercises the read failure (an out-of-root path is a different refusal).
    const res = await review.handler({ file_path: path.join(process.cwd(), 'nonexistent-deck.pptx') });
    expect(res.isError).toBe(true);
    expect(res.structuredContent?.error_code).toBe('READ_FAILED');
  });

  it('refuses a path outside every project the user opted into', async () => {
    const res = await review.handler({ file_path: path.resolve('/tmp/somewhere-else/deck.pptx') });
    expect(res.isError).toBe(true);
    expect(res.structuredContent?.error_code).toBe('PATH_NOT_ALLOWED');
  });

  it('refuses a non-document, so a document cannot talk it into reading a secret', async () => {
    for (const p of ['.env', '.env.local', 'id_rsa', 'key.pem', 'creds.json']) {
      const res = await review.handler({ file_path: path.join(process.cwd(), p) });
      expect(res.isError, p).toBe(true);
      expect(res.structuredContent?.error_code, p).toBe('UNSUPPORTED_FILE_TYPE');
    }
  });

  it('refuses a document inside a secrets directory even within the project', async () => {
    const res = await review.handler({ file_path: path.join(process.cwd(), '.ssh', 'notes.md') });
    expect(res.isError).toBe(true);
    expect(res.structuredContent?.error_code).toBe('PATH_NOT_ALLOWED');
  });
});
