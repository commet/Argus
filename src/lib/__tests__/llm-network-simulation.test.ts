/**
 * LLM Network Simulation — callLLM / callLLMJson / callLLMStream
 *
 * 핵심 검증:
 * 1. callLLM — proxy/direct 라우팅, 인증 헤더, 에러 처리
 * 2. callLLMJson — JSON 파싱 + shape 검증 통합
 * 3. callLLMStream — SSE 스트리밍, 토큰 콜백, 에러 핸들링
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (before module import) ──

const mockSettings = {
  anthropic_api_key: '',
  openai_api_key: '',
  gemini_api_key: '',
  llm_provider: 'anthropic' as const,
  llm_mode: 'proxy' as const,
  local_endpoint: '',
  language: 'ko',
  audio_enabled: false,
  audio_volume: 0.15,
};

vi.mock('@/lib/storage', () => ({
  getStorage: vi.fn(() => ({ ...mockSettings })),
  setStorage: vi.fn(),
  STORAGE_KEYS: { SETTINGS: 'sot_settings' },
}));

vi.mock('@/lib/db', () => ({
  insertToSupabase: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() =>
        Promise.resolve({
          data: { session: { access_token: 'test-token' } },
        })
      ),
    },
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { callLLM, callLLMJson, callLLMStream } from '@/lib/llm';

// ── Helpers ──

const MESSAGES = [{ role: 'user' as const, content: 'Hello' }];
const OPTIONS = { system: 'You are helpful.', maxTokens: 1024 };

function mockResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    body: null,
  } as unknown as Response;
}

function mockStreamResponse(lines: string[]) {
  const encoder = new TextEncoder();
  const chunks = lines.map((l) => encoder.encode(l + '\n'));
  let index = 0;
  const reader = {
    read: vi.fn(() => {
      if (index >= chunks.length)
        return Promise.resolve({ done: true, value: undefined });
      return Promise.resolve({ done: false, value: chunks[index++] });
    }),
  };
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    body: { getReader: () => reader },
  } as unknown as Response;
}

beforeEach(() => {
  mockFetch.mockReset();
  Object.assign(mockSettings, {
    llm_mode: 'proxy',
    anthropic_api_key: '',
    openai_api_key: '',
    gemini_api_key: '',
    llm_provider: 'anthropic',
    local_endpoint: '',
    language: 'ko',
    audio_enabled: false,
    audio_volume: 0.15,
  });
});

// ═══════════════════════════════════════
// callLLM
// ═══════════════════════════════════════
describe('callLLM', () => {
  it('proxy 모드: /api/llm 에 Authorization 헤더와 함께 POST', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ text: 'proxy reply' }));

    const result = await callLLM(MESSAGES, OPTIONS);

    expect(result).toBe('proxy reply');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/llm');
    expect(init.method).toBe('POST');
    expect(init.headers['Authorization']).toBe('Bearer test-token');
  });

  it('direct 모드: /api/llm/direct 에 apiKey를 body에 포함하여 POST', async () => {
    mockSettings.llm_mode = 'direct';
    mockSettings.anthropic_api_key = 'sk-test-key';
    mockFetch.mockResolvedValueOnce(mockResponse({ text: 'direct reply' }));

    const result = await callLLM(MESSAGES, OPTIONS);

    expect(result).toBe('direct reply');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/llm/direct');
    const body = JSON.parse(init.body);
    expect(body.apiKey).toBe('sk-test-key');
    expect(body.messages).toEqual(MESSAGES);
    expect(body.system).toBe(OPTIONS.system);
  });

  it('direct 모드이지만 API key 없으면 proxy로 fallback', async () => {
    mockSettings.llm_mode = 'direct';
    mockSettings.anthropic_api_key = '';
    mockFetch.mockResolvedValueOnce(mockResponse({ text: 'fallback proxy' }));

    await callLLM(MESSAGES, OPTIONS);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/llm');
  });

  it('non-ok 응답 시 에러 메시지와 함께 throw', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: '잘못된 요청' }, 400)
    );

    await expect(callLLM(MESSAGES, OPTIONS)).rejects.toThrow('잘못된 요청');
  });

  it('provider credit outage is terminal and is not retried', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        code: 'PROVIDER_CREDITS_REQUIRED',
        error: 'The analysis service is temporarily unavailable.',
        retryable: false,
      }, 503)
    );

    await expect(callLLM(MESSAGES, OPTIONS)).rejects.toMatchObject({
      category: 'service_unavailable',
      retryable: false,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('proxy에서 needsLogin 응답 시 LOGIN_REQUIRED throw', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ needsLogin: true, error: '인증 만료' }, 401)
    );

    await expect(callLLM(MESSAGES, OPTIONS)).rejects.toThrow('LOGIN_REQUIRED');
  });

  it('429 + needsLogin 응답 시 retry 없이 즉시 LOGIN_REQUIRED throw', async () => {
    // 익명 무료 체험 소진 시 서버가 429 + needsLogin:true를 내려줌.
    // retry해도 절대 풀리지 않으므로 바로 LOGIN_REQUIRED로 분류해야 함.
    mockFetch.mockResolvedValueOnce(
      mockResponse(
        {
          needsLogin: true,
          error: '무료 체험을 모두 사용했습니다. 로그인하면 하루 10회까지 무료로 계속 사용할 수 있어요!',
        },
        429
      )
    );

    await expect(callLLM(MESSAGES, OPTIONS)).rejects.toThrow('LOGIN_REQUIRED');
    // retry 안 함 — 첫 응답에서 즉시 throw
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('성공 응답에서 text 반환', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ text: '분석 완료: 위험 요소 3개 발견' })
    );

    const result = await callLLM(MESSAGES, OPTIONS);
    expect(result).toBe('분석 완료: 위험 요소 3개 발견');
  });

  it('fetchWithRetry: 429 시 재시도 후 성공', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ error: 'rate limit', retry_after: 0 }, 429))
      .mockResolvedValueOnce(mockResponse({ text: 'retried ok' }));

    const result = await callLLM(MESSAGES, OPTIONS);
    expect(result).toBe('retried ok');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════
// callLLMJson
// ═══════════════════════════════════════
describe('callLLMJson', () => {
  it('LLM 응답에서 JSON 파싱하여 객체 반환', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ text: '{"score": 85, "label": "good"}' })
    );

    const result = await callLLMJson<{ score: number; label: string }>(
      MESSAGES,
      OPTIONS
    );
    expect(result).toEqual({ score: 85, label: 'good' });
  });

  it('shape 스키마 제공 시 검증 통과', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ text: '{"findings": ["a","b"], "count": 2}' })
    );

    const result = await callLLMJson(MESSAGES, {
      ...OPTIONS,
      shape: { findings: 'array', count: 'number' },
    });
    expect(result).toEqual({ findings: ['a', 'b'], count: 2 });
  });

  it('shape 검증 실패 시 throw', async () => {
    // callLLMJson now retries once on parse/validation failure,
    // so we need to mock 2 responses (original + retry)
    mockFetch
      .mockResolvedValueOnce(mockResponse({ text: '{"findings": "not-array"}' }))
      .mockResolvedValueOnce(mockResponse({ text: '{"findings": "still-not-array"}' }));

    await expect(
      callLLMJson(MESSAGES, {
        ...OPTIONS,
        shape: { findings: 'array' },
        parseRetries: 1,
      })
    ).rejects.toThrow('배열');
  });

  it('markdown 펜스로 감싼 JSON도 파싱', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ text: '```json\n{"result": "ok"}\n```' })
    );

    const result = await callLLMJson<{ result: string }>(MESSAGES, OPTIONS);
    expect(result).toEqual({ result: 'ok' });
  });
});

// ═══════════════════════════════════════
// callLLMStream
// ═══════════════════════════════════════
describe('callLLMStream', () => {
  it('SSE data 라인마다 누적 텍스트로 onToken 호출', async () => {
    const tokens: string[] = [];
    mockFetch.mockResolvedValueOnce(
      mockStreamResponse([
        'data: {"text":"Hello"}',
        'data: {"text":" world"}',
      ])
    );

    await callLLMStream(MESSAGES, OPTIONS, {
      onToken: (t) => tokens.push(t),
      onComplete: vi.fn(),
      onError: vi.fn(),
    });

    expect(tokens).toEqual(['Hello', 'Hello world']);
  });

  it('스트림 종료 시 onComplete에 전체 텍스트 전달', async () => {
    let completed = '';
    mockFetch.mockResolvedValueOnce(
      mockStreamResponse([
        'data: {"text":"A"}',
        'data: {"text":"B"}',
      ])
    );

    await callLLMStream(MESSAGES, OPTIONS, {
      onToken: vi.fn(),
      onComplete: (t) => {
        completed = t;
      },
      onError: vi.fn(),
    });

    expect(completed).toBe('AB');
  });

  it('fetch 실패 시 onError 호출', async () => {
    let caughtError: Error | null = null;
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));

    await callLLMStream(MESSAGES, OPTIONS, {
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError: (e) => {
        caughtError = e;
      },
    });

    expect(caughtError).not.toBeNull();
    expect(caughtError!.message).toBe('Network failure');
  });

  it('[DONE] 라인은 무시', async () => {
    const tokens: string[] = [];
    mockFetch.mockResolvedValueOnce(
      mockStreamResponse([
        'data: {"text":"final"}',
        'data: [DONE]',
      ])
    );

    await callLLMStream(MESSAGES, OPTIONS, {
      onToken: (t) => tokens.push(t),
      onComplete: vi.fn(),
      onError: vi.fn(),
    });

    expect(tokens).toEqual(['final']);
  });

  it('malformed SSE data가 있어도 크래시 없이 건너뜀', async () => {
    const tokens: string[] = [];
    mockFetch.mockResolvedValueOnce(
      mockStreamResponse([
        'data: {"text":"ok"}',
        'data: {{{invalid json',
        'data: {"text":" more"}',
      ])
    );

    await callLLMStream(MESSAGES, OPTIONS, {
      onToken: (t) => tokens.push(t),
      onComplete: vi.fn(),
      onError: vi.fn(),
    });

    expect(tokens).toEqual(['ok', 'ok more']);
  });

  it('proxy 모드: /api/llm 에 stream:true, Authorization 포함', async () => {
    mockFetch.mockResolvedValueOnce(
      mockStreamResponse(['data: {"text":"s"}'])
    );

    await callLLMStream(MESSAGES, OPTIONS, {
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/llm');
    const body = JSON.parse(init.body);
    expect(body.stream).toBe(true);
    expect(init.headers['Authorization']).toBe('Bearer test-token');
  });

  it('direct 모드: /api/llm/direct 에 apiKey + stream:true', async () => {
    mockSettings.llm_mode = 'direct';
    mockSettings.anthropic_api_key = 'sk-stream-key';
    mockFetch.mockResolvedValueOnce(
      mockStreamResponse(['data: {"text":"d"}'])
    );

    await callLLMStream(MESSAGES, OPTIONS, {
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    });

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/llm/direct');
    const body = JSON.parse(init.body);
    expect(body.apiKey).toBe('sk-stream-key');
    expect(body.stream).toBe(true);
  });

  it('non-ok 스트림 응답 시 onError 호출', async () => {
    let caughtError: Error | null = null;
    mockFetch.mockResolvedValueOnce(
      mockResponse({ error: '서버 오류 (500)' }, 500)
    );

    await callLLMStream(MESSAGES, OPTIONS, {
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError: (e) => {
        caughtError = e;
      },
    });

    expect(caughtError).not.toBeNull();
    // Voice sweep (10 S7): 5xx surfaces the where-safe-handle sentence, not a bare code.
    expect(caughtError!.message).toBe('서버가 잠깐 말을 잇지 못했어요 (오류 500) — 저희 쪽 문제예요. 잠시 후 자동으로 다시 시도해요.');
  });

  it('SSE provider credit outage is terminal and reaches onError', async () => {
    let caughtError: Error | null = null;
    mockFetch.mockResolvedValueOnce(
      mockStreamResponse([
        'data: {"code":"PROVIDER_CREDITS_REQUIRED","error":"The analysis service is temporarily unavailable.","retryable":false,"status":503}',
      ])
    );

    await callLLMStream(MESSAGES, OPTIONS, {
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError: (error) => {
        caughtError = error;
      },
    });

    expect(caughtError).toMatchObject({
      message: expect.stringContaining('SERVICE_UNAVAILABLE'),
      category: 'service_unavailable',
      retryable: false,
    });
  });
});
