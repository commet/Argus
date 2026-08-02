import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const webhook = readFileSync(resolve(process.cwd(), 'src/app/api/telegram/webhook/route.ts'), 'utf8');
const semantic = readFileSync(resolve(process.cwd(), 'src/lib/telegram-semantic.ts'), 'utf8');

describe('Telegram return telemetry contract', () => {
  it('records answers and deferrals only after their durable write succeeds', () => {
    expect(webhook).toContain("persistServerEvent(result.deferred ? 'return_deferred' : 'return_answered'");
    expect(webhook.indexOf("persistServerEvent(result.deferred ? 'return_deferred' : 'return_answered'"))
      .toBeGreaterThan(webhook.indexOf(".update({ decision_contract: result.contract })"));
    expect(webhook).toContain('if (deferError)');
    expect(webhook).toContain('if (settleError)');
  });

  it('covers semantic foundation answers without exposing answer prose', () => {
    expect(semantic).toContain("deps.recordReturn?.('return_answered'");
    expect(semantic).toContain("deps.recordReturn?.('return_deferred'");
    expect(semantic).toContain("channel: 'telegram'");
    expect(semantic).not.toContain('response_text: responseText,\n      channel:');
  });
});
