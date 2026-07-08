/**
 * 공정 4 exit — 공유 링크 OG 카드 렌더 검증.
 *
 * OG 라우트는 브라우저 밖(크롤러)에서만 소비되어 깨져도 아무것도 빨개지지
 * 않는 표면이다 (LLM-glue invariant: 조용한 실패 금지). 여기서 실제로
 * ImageResponse를 렌더해 1200×630 PNG가 나오는지 고정한다. OG_CAPTURE_DIR가
 * 설정되면 캡처 PNG를 그 경로에 남긴다 (exit의 "렌더 캡처" 증빙용).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/share-guard', () => ({
  adminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { title: 'Hold the Q3 fundraise until rates settle', content: '# Judgment Receipt', context: 'review_receipt' },
          }),
        }),
      }),
    }),
  }),
}));

import OgImage, { size, contentType } from '../opengraph-image';

describe('shared-link OG card', () => {
  it('renders a 1200x630 PNG with the receipt DNA', async () => {
    const res = await OgImage({ params: Promise.resolve({ token: 'tok_test' }) });
    expect(res).toBeInstanceOf(Response);

    const bytes = new Uint8Array(await res.arrayBuffer());
    // PNG signature — the route really produced an image, not an error page.
    expect(Array.from(bytes.slice(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    // IHDR width/height (bytes 16..24, big-endian) match the declared OG size.
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(16)).toBe(size.width);
    expect(view.getUint32(20)).toBe(size.height);
    expect(contentType).toBe('image/png');

    // 증빙 캡처 (opt-in): OG_CAPTURE_DIR=... vitest run 으로 실행하면 남는다.
    if (process.env.OG_CAPTURE_DIR) {
      mkdirSync(process.env.OG_CAPTURE_DIR, { recursive: true });
      writeFileSync(join(process.env.OG_CAPTURE_DIR, 'og-shared-receipt.png'), bytes);
    }
  }, 30_000);
});
