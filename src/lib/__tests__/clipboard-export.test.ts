// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyToClipboard } from '@/lib/export';

function setClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('copyToClipboard', () => {
  it('uses the async clipboard API when it succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });

    await copyToClipboard('project summary');

    expect(writeText).toHaveBeenCalledWith('project summary');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('falls back to a temporary selection when permission is rejected', async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });

    await copyToClipboard('# full markdown');

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('does not stay pending forever when an embedded browser defers permission', async () => {
    vi.useFakeTimers();
    setClipboard(vi.fn(() => new Promise<void>(() => undefined)));
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });

    const copying = copyToClipboard('still copies');
    await vi.advanceTimersByTimeAsync(1500);
    await copying;

    expect(execCommand).toHaveBeenCalledWith('copy');
  });
});
