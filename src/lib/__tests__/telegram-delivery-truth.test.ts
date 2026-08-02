import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tgSendMessage } from '../telegram-api';

const response = (body: { ok: boolean; description?: string }) => ({
  json: vi.fn().mockResolvedValue(body),
});

describe('Telegram delivery truth', () => {
  beforeEach(() => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', 'test-token');
    vi.restoreAllMocks();
  });

  it('returns true when the HTML message is accepted', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(tgSendMessage('chat-1', '<b>hello</b>')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns true only if the plain-text fallback is accepted', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ ok: false, description: 'bad html' }))
      .mockResolvedValueOnce(response({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(tgSendMessage('chat-1', '<b>hello</b>')).resolves.toBe(true);
    const secondBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(secondBody.text).toBe('hello');
    expect(secondBody).not.toHaveProperty('parse_mode');
  });

  it('returns false when Telegram rejects both attempts', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ ok: false, description: 'bad html' }))
      .mockResolvedValueOnce(response({ ok: false, description: 'blocked chat' }));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(tgSendMessage('chat-1', '<b>hello</b>')).resolves.toBe(false);
  });
});
