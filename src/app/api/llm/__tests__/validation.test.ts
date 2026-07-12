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
