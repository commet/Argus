// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/hooks/useLocale', () => ({ useLocale: () => 'en' }));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, loading: false }),
  hasKnownUser: () => true,
}));

import { SyncStatus } from '@/components/ui/SyncStatus';

describe('SyncStatus recovery action', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('turns a failed backup into an explicit retry control', () => {
    const retry = vi.fn();
    window.addEventListener('argus:sync-retry', retry);
    act(() => root.render(createElement(SyncStatus)));
    act(() => {
      window.dispatchEvent(new CustomEvent('argus:sync', {
        detail: { status: 'error', context: 'upsert:projects', message: 'network unavailable' },
      }));
    });

    const button = container.querySelector('button');
    expect(button?.textContent).toContain('Retry');
    act(() => button?.click());
    expect(retry).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Syncing');
    window.removeEventListener('argus:sync-retry', retry);
  });

  it('does not claim the project retry can repair an unrelated failed write', () => {
    act(() => root.render(createElement(SyncStatus)));
    act(() => {
      window.dispatchEvent(new CustomEvent('argus:sync', {
        detail: { status: 'error', context: 'upsert:agents', message: 'network unavailable' },
      }));
    });

    expect(container.textContent).toContain('Sync failed');
    expect(container.querySelector('button')).toBeNull();
  });
});
