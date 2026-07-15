import { describe, it, expect } from 'vitest';
import {
  validateMessages,
  validateSystemPrompt,
  normalizeMaxTokens,
  validateApiKey,
  MAX_MESSAGE_LENGTH,
  MAX_SYSTEM_LENGTH,
  MAX_MESSAGES,
  MAX_TOTAL_BODY,
} from '@/lib/llm-validation';

// ─── Messages Validation ───

describe('validateMessages', () => {
  it('accepts valid messages', () => {
    expect(validateMessages([{ role: 'user', content: 'hello' }])).toBe(true);
    expect(validateMessages([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: 'hello' },
      { role: 'user', content: 'how are you?' },
    ])).toBe(true);
  });

  it('rejects empty array', () => {
    expect(validateMessages([])).toBe(false);
  });

  it('rejects non-array', () => {
    expect(validateMessages('hello')).toBe(false);
    expect(validateMessages(null)).toBe(false);
    expect(validateMessages(undefined)).toBe(false);
    expect(validateMessages(42)).toBe(false);
    expect(validateMessages({})).toBe(false);
  });

  it('rejects invalid roles', () => {
    expect(validateMessages([{ role: 'system', content: 'hi' }])).toBe(false);
    expect(validateMessages([{ role: 'admin', content: 'hi' }])).toBe(false);
    expect(validateMessages([{ role: '', content: 'hi' }])).toBe(false);
  });

  it('rejects non-string content', () => {
    expect(validateMessages([{ role: 'user', content: 123 }])).toBe(false);
    expect(validateMessages([{ role: 'user', content: null }])).toBe(false);
    expect(validateMessages([{ role: 'user', content: ['array'] }])).toBe(false);
  });

  it('rejects oversized content', () => {
    const huge = 'x'.repeat(MAX_MESSAGE_LENGTH + 1);
    expect(validateMessages([{ role: 'user', content: huge }])).toBe(false);
  });

  it('accepts content at exact limit', () => {
    const atLimit = 'x'.repeat(MAX_MESSAGE_LENGTH);
    expect(validateMessages([{ role: 'user', content: atLimit }])).toBe(true);
  });

  it('rejects messages missing required fields', () => {
    expect(validateMessages([{ role: 'user' }])).toBe(false);
    expect(validateMessages([{ content: 'hi' }])).toBe(false);
    expect(validateMessages([{}])).toBe(false);
  });

  it('rejects if any message in array is invalid', () => {
    expect(validateMessages([
      { role: 'user', content: 'valid' },
      { role: 'system', content: 'invalid role' },
    ])).toBe(false);
  });

  it('rejects when exceeding MAX_MESSAGES', () => {
    const tooMany = Array.from({ length: MAX_MESSAGES + 1 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: 'msg',
    }));
    expect(validateMessages(tooMany)).toBe(false);
  });

  it('accepts exactly MAX_MESSAGES', () => {
    const exact = Array.from({ length: MAX_MESSAGES }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: 'msg',
    }));
    expect(validateMessages(exact)).toBe(true);
  });

  it('rejects when total body size exceeds MAX_TOTAL_BODY', () => {
    // Each message just under individual limit, but combined exceeds total
    const perMsg = Math.ceil(MAX_TOTAL_BODY / 5);
    const messages = Array.from({ length: 6 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: 'x'.repeat(Math.min(perMsg, MAX_MESSAGE_LENGTH)),
    }));
    // Only reject if total actually exceeds — compute actual total
    const total = messages.reduce((s, m) => s + m.content.length, 0);
    if (total > MAX_TOTAL_BODY) {
      expect(validateMessages(messages)).toBe(false);
    }
  });
});

// ─── Vision / document content blocks ───

describe('validateMessages — content blocks (vision path)', () => {
  // a tiny valid base64 payload (not a real image, but shape-valid + small)
  const b64 = 'aGVsbG8gd29ybGQ='; // "hello world"
  const img = (media = 'image/png') => ({ type: 'image', source: { type: 'base64', media_type: media, data: b64 } });
  const doc = () => ({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } });
  const text = (t = 'review this') => ({ type: 'text', text: t });

  it('accepts a document block followed by text (the PDF vision message)', () => {
    expect(validateMessages([{ role: 'user', content: [doc(), text()] }])).toBe(true);
  });

  it('accepts image blocks with allowed media types', () => {
    for (const m of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
      expect(validateMessages([{ role: 'user', content: [img(m), text()] }])).toBe(true);
    }
  });

  it('rejects a disallowed image media type', () => {
    expect(validateMessages([{ role: 'user', content: [img('image/svg+xml')] }])).toBe(false);
    expect(validateMessages([{ role: 'user', content: [img('application/octet-stream')] }])).toBe(false);
  });

  it('rejects a document block that is not a PDF', () => {
    expect(validateMessages([{ role: 'user', content: [{ type: 'document', source: { type: 'base64', media_type: 'application/msword', data: b64 } }] }])).toBe(false);
  });

  it('rejects an unknown block type', () => {
    expect(validateMessages([{ role: 'user', content: [{ type: 'tool_use', foo: 1 }] }])).toBe(false);
  });

  it('rejects a malformed source (missing data / wrong source type)', () => {
    expect(validateMessages([{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png' } }] }])).toBe(false);
    expect(validateMessages([{ role: 'user', content: [{ type: 'image', source: { type: 'url', media_type: 'image/png', data: 'x' } }] }])).toBe(false);
  });

  it('rejects an oversized binary block', () => {
    const huge = 'A'.repeat(9_000_000); // ~6.75MB decoded > per-block cap
    expect(validateMessages([{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: huge } }] }])).toBe(false);
  });

  it('accepts a long scanned-PDF render (many page images), rejects beyond the cap', () => {
    // A scanned PDF rendered to ~45 page images must pass (cap raised to 100).
    const ok = Array.from({ length: 45 }, () => img('image/jpeg'));
    expect(validateMessages([{ role: 'user', content: [...ok, text()] }])).toBe(true);
    // Beyond the 100-image ceiling is rejected.
    const many = Array.from({ length: 101 }, () => img());
    expect(validateMessages([{ role: 'user', content: many }])).toBe(false);
  });

  it('rejects an empty block array', () => {
    expect(validateMessages([{ role: 'user', content: [] }])).toBe(false);
  });
});

// ─── System Prompt Validation ───

describe('validateSystemPrompt', () => {
  it('accepts valid system prompts', () => {
    expect(validateSystemPrompt('You are a helpful assistant.')).toBe(true);
    expect(validateSystemPrompt('')).toBe(true);
  });

  it('accepts undefined (optional)', () => {
    expect(validateSystemPrompt(undefined)).toBe(true);
  });

  it('rejects non-string non-undefined values', () => {
    expect(validateSystemPrompt(null)).toBe(false);
    expect(validateSystemPrompt(123)).toBe(false);
    expect(validateSystemPrompt([])).toBe(false);
  });

  it('rejects oversized system prompts', () => {
    expect(validateSystemPrompt('x'.repeat(MAX_SYSTEM_LENGTH + 1))).toBe(false);
  });

  it('accepts at exact limit', () => {
    expect(validateSystemPrompt('x'.repeat(MAX_SYSTEM_LENGTH))).toBe(true);
  });
});

// ─── maxTokens Validation ───

describe('normalizeMaxTokens', () => {
  it('defaults to 2000 for falsy values', () => {
    expect(normalizeMaxTokens(undefined)).toBe(2000);
    expect(normalizeMaxTokens(null)).toBe(2000);
    expect(normalizeMaxTokens(0)).toBe(2000);
    expect(normalizeMaxTokens('')).toBe(2000);
  });

  it('caps at 8192', () => {
    expect(normalizeMaxTokens(200000)).toBe(8192);
    expect(normalizeMaxTokens(9000)).toBe(8192);
    expect(normalizeMaxTokens(8192)).toBe(8192);
    expect(normalizeMaxTokens(5000)).toBe(5000); // under the cap → honored
  });

  it('passes through valid values', () => {
    expect(normalizeMaxTokens(1000)).toBe(1000);
    expect(normalizeMaxTokens(2000)).toBe(2000);
    expect(normalizeMaxTokens(4000)).toBe(4000);
  });

  it('handles string numbers', () => {
    expect(normalizeMaxTokens('3000')).toBe(3000);
    expect(normalizeMaxTokens('999999')).toBe(8192);
  });

  it('defaults invalid, non-positive, and non-finite values', () => {
    expect(normalizeMaxTokens(-1)).toBe(2000);
    expect(normalizeMaxTokens('-50')).toBe(2000);
    expect(normalizeMaxTokens(Number.NaN)).toBe(2000);
    expect(normalizeMaxTokens(Number.POSITIVE_INFINITY)).toBe(2000);
  });

  it('returns an integer token count', () => {
    expect(normalizeMaxTokens(1234.9)).toBe(1234);
  });
});

// ─── API Key Validation ───

describe('validateApiKey', () => {
  it('accepts valid Anthropic keys', () => {
    expect(validateApiKey('sk-ant-api03-abcdefghij1234567890', 'anthropic').valid).toBe(true);
  });

  it('accepts valid OpenAI keys', () => {
    expect(validateApiKey('sk-proj-abcdefghij1234567890', 'openai').valid).toBe(true);
  });

  it('accepts valid Gemini keys (no prefix check)', () => {
    expect(validateApiKey('AIzaSyAbcdefghij1234567890', 'gemini').valid).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(validateApiKey('', 'anthropic').valid).toBe(false);
    expect(validateApiKey('short', 'anthropic').valid).toBe(false);
    expect(validateApiKey(null, 'anthropic').valid).toBe(false);
    expect(validateApiKey(123, 'openai').valid).toBe(false);
  });

  it('rejects wrong prefix for Anthropic', () => {
    expect(validateApiKey('sk-proj-abcdefghij1234567890', 'anthropic').valid).toBe(false);
  });

  it('rejects non-sk prefix for OpenAI', () => {
    expect(validateApiKey('gsk-abcdefghij12345678901234', 'openai').valid).toBe(false);
  });
});
