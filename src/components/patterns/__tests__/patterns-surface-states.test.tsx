// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PatternsSurface } from '../PatternsSurface';

const auth = vi.hoisted(() => ({ session: null as { access_token: string } | null }));
vi.mock('@/lib/auth', () => ({ useAuth: () => auth }));
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'ko' }));

describe('PatternsSurface read states', () => {
  let host: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    auth.session = null;
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  });

  it('settles unauthenticated state without presenting successful-empty copy', async () => {
    await act(async () => {
      root.render(createElement(PatternsSurface));
      await Promise.resolve();
    });
    expect(host.textContent).toContain('기록을 불러오지 못했습니다.');
    expect(host.textContent).not.toContain('지금 검토할 표현이 없습니다.');
  });

  it('keeps a failed GET distinct from an empty successful snapshot', async () => {
    auth.session = { access_token: 'token' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'REVIEW_READ_FAILED' }),
    }));
    await act(async () => {
      root.render(createElement(PatternsSurface));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(host.textContent).toContain('빈 기록으로 표시하지 않았습니다.');
    expect(host.textContent).not.toContain('아직 채택한 기록이 없습니다.');
  });

  it('renders empty states only after a successful read', async () => {
    auth.session = { access_token: 'token' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        release_receipt_id: 'receipt:1', review_cards: [], patterns: [], exclusions: [], source_stream_count: 0,
      }),
    }));
    await act(async () => {
      root.render(createElement(PatternsSurface));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(host.textContent).toContain('지금 검토할 표현이 없습니다.');
    expect(host.textContent).toContain('아직 채택한 기록이 없습니다.');
  });
});
