// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('pdfjs-dist/webpack.mjs', () => ({
  getDocument: ({ data }: { data: ArrayBuffer }) => {
    // Match the real worker contract: ownership transfers and the caller's
    // buffer is detached as soon as parsing starts.
    structuredClone(data, { transfer: [data] });
    return {
      promise: Promise.resolve({
        numPages: 1,
        getPage: async () => ({
          getTextContent: async () => ({
            items: [
              {
                str: 'A sufficiently long decision memo keeps the PDF extraction path above the low-text threshold.',
                transform: [1, 0, 0, 1, 36, 720],
                width: 520,
                height: 12,
              },
            ],
          }),
          getViewport: () => ({ width: 612, height: 792 }),
          render: () => ({ promise: Promise.resolve() }),
        }),
      }),
    };
  },
}));

import { extractFile } from '../extract-file';

describe('extractFile — PDF worker buffer ownership', () => {
  beforeAll(() => {
    // jsdom does not implement canvas encoding. The production path treats an
    // unavailable page renderer as optional while retaining the native PDF.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('retains a native PDF vision payload after pdf.js detaches its parse buffer', async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const result = await extractFile(new File([pdfBytes], 'decision.pdf', { type: 'application/pdf' }), 'pdf');

    expect(result.quality).toBe('medium');
    expect(result.vision?.kind).toBe('pdf');
    expect(result.vision?.pdf_base64).toBe('JVBERi0xLjc=');
    expect(Array.from(result.pdf_data ?? [])).toEqual(Array.from(pdfBytes));
    expect(result.pages_total).toBe(1);
    expect(result.error_kind).toBeUndefined();
  });
});
