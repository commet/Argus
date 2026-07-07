import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The Telegram webhook authenticates every update by comparing the
 * X-Telegram-Bot-Api-Secret-Token header against TELEGRAM_WEBHOOK_SECRET. A
 * comment in the route notes callback/token payloads are "attacker-typable", so
 * this gate is the front line. These tests cover it directly. Side-effecting
 * libs (LLM, telegram-api, DB) are mocked so importing the route is inert and no
 * network is touched — a rejected request must never reach them.
 */

vi.mock('@/lib/telegram-api', () => ({
  tgSendMessage: vi.fn(), tgSendChatAction: vi.fn(), tgAnswerCallback: vi.fn(),
}));
vi.mock('@/lib/llm-server', () => ({ callAnthropicJson: vi.fn() }));
vi.mock('@/lib/share-guard', () => ({ adminClient: () => ({ from: () => ({}) }) }));

import { POST } from '../route';

function req(body: unknown, secretHeader?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (secretHeader !== undefined) headers['x-telegram-bot-api-secret-token'] = secretHeader;
  return new Request('https://argus.voyage/api/telegram/webhook', {
    method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body),
  }) as never;
}

afterEach(() => vi.unstubAllEnvs());

describe('POST /api/telegram/webhook — secret gate', () => {
  it('no-ops with 200 ok:true when the secret is not configured (never 401-leaks config state)', async () => {
    vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', '');
    const res = await POST(req({ message: { text: 'hi' } }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true });
  });

  describe('with a configured secret', () => {
    beforeEach(() => vi.stubEnv('TELEGRAM_WEBHOOK_SECRET', 'tg-secret'));

    it('401s when the secret-token header is missing', async () => {
      const res = await POST(req({ message: { text: 'hi' } }));
      expect(res.status).toBe(401);
    });

    it('401s when the secret-token header is wrong', async () => {
      const res = await POST(req({ message: { text: 'hi' } }, 'not-the-secret'));
      expect(res.status).toBe(401);
    });

    it('passes the gate on a correct secret and swallows a malformed body as 200 ok', async () => {
      // Correct secret but non-JSON body → route returns { ok: true } without work.
      const res = await POST(req('not-json', 'tg-secret'));
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json).toEqual({ ok: true });
    });
  });
});
