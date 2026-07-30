import { getStorage, STORAGE_KEYS } from '@/lib/storage';
import type { Settings } from '@/stores/types';
import { DEFAULT_ANTHROPIC_MODEL, DEFAULT_GEMINI_MODEL, DEFAULT_OPENAI_MODEL } from '@/lib/llm-models';
import { DAILY_LIMIT } from '@/lib/quota-config';
import { track } from '@/lib/analytics';
import { PROVIDER_CREDITS_REQUIRED } from '@/lib/llm-provider-errors';

// ━━━ Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Anthropic-shaped content blocks — the vision/document path (review pipeline).
 *  A message's content is either a plain string (the overwhelming common case)
 *  or an ordered array of blocks. Images/documents come BEFORE text per
 *  Anthropic's best practice. Only forwarded to the Anthropic provider; the
 *  proxy passes them straight to the SDK, which renders PDF pages + reads text. */
export type LLMImageBlock = {
  type: 'image';
  source: { type: 'base64'; media_type: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string };
};
export type LLMDocumentBlock = {
  type: 'document';
  source: { type: 'base64'; media_type: 'application/pdf'; data: string };
};
export type LLMTextBlock = { type: 'text'; text: string };
export type LLMContentBlock = LLMTextBlock | LLMImageBlock | LLMDocumentBlock;

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string | LLMContentBlock[];
}

export type ModelTier = 'fast' | 'default' | 'strong';

export interface LLMOptions {
  system: string;
  maxTokens?: number;
  /** Model tier: 'fast' (Haiku — cheap/fast), 'default' (Sonnet), 'strong' (Opus — deep reasoning) */
  model?: ModelTier;
  /** AbortController signal for cancellation */
  signal?: AbortSignal;
  /**
   * Mark the system prompt as STATIC (identical across calls/users for a given
   * locale) so the Anthropic server routes wrap it in a prompt-cache block.
   * The heavy prompts this exists for (initial analysis ≈7k tokens) are
   * re-prefilled from scratch on every call otherwise — measured 2026-07-31.
   * Only set this where the system string truly is byte-identical between
   * calls: a dynamic system prompt would never hit and each write costs a 25%
   * premium over plain input. OpenAI/Gemini paths ignore it.
   */
  cacheSystem?: boolean;
}

export interface StreamCallbacks {
  onToken: (text: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

const STREAM_MAX_TOKENS_CAP = 8192;

// ━━━ Error System (Claude Code 패턴: 에러 분류 + 재시도 가능 여부 판단) ━━━

export type LLMErrorCategory =
  | 'rate_limit'       // 429
  | 'overloaded'       // 529, 503
  | 'context_too_long' // 413
  | 'auth'             // 401, 403
  | 'service_unavailable' // provider account/configuration needs operator action
  | 'parse_failure'    // JSON 파싱 실패
  | 'network'          // 연결 실패
  | 'validation'       // 스키마 검증 실패
  | 'unknown';

export class LLMError extends Error {
  readonly category: LLMErrorCategory;
  readonly status?: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;

  constructor(message: string, opts: {
    category: LLMErrorCategory;
    status?: number;
    retryable?: boolean;
    retryAfterMs?: number;
    cause?: unknown;
  }) {
    super(message, { cause: opts.cause });
    this.name = 'LLMError';
    this.category = opts.category;
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
    this.retryAfterMs = opts.retryAfterMs;
  }
}

function categorizeError(status: number, body?: Record<string, unknown>): LLMError {
  const e = buildLlmError(status, body);
  // Launch sensor: every categorized LLM failure (rate_limit / overloaded / auth /
  // context_too_long / unknown) becomes a queryable event so a community-launch
  // traffic spike (429/529 floods, quota exhaustion) is visible, not just in logs.
  try { track('llm_error', { category: e.category, status: e.status, retryable: e.retryable }); } catch { /* analytics never breaks the call */ }
  return e;
}

function buildLlmError(status: number, body?: Record<string, unknown>): LLMError {
  if (body?.code === PROVIDER_CREDITS_REQUIRED) {
    return new LLMError('SERVICE_UNAVAILABLE:현재 분석 기능을 사용할 수 없습니다. 적어주신 내용은 그대로 남아 있습니다.', {
      category: 'service_unavailable', status, retryable: false,
    });
  }
  if (status === 429) {
    // 무료 체험 한도 소진(익명 사용자) — 서버가 needsLogin 플래그를 함께 내려줌.
    // 이 경우는 단순 rate limit이 아니라 "로그인하면 풀린다"는 별개의 UX 경로.
    const needsLogin = body?.needsLogin === true;
    if (needsLogin) {
      return new LLMError(`LOGIN_REQUIRED:무료 체험을 모두 사용했습니다. 로그인하면 하루 ${DAILY_LIMIT}회까지 무료로 사용할 수 있어요.`, {
        category: 'auth', status, retryable: false,
      });
    }
    const retryAfter = typeof body?.retry_after === 'number' ? body.retry_after * 1000 : 5000;
    return new LLMError('요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.', {
      category: 'rate_limit', status, retryable: true, retryAfterMs: retryAfter,
    });
  }
  if (status === 529 || status === 503) {
    return new LLMError('지금 서버가 붐비고 있어요 — 저희 쪽 사정이에요. 잠시 후 자동으로 다시 시도해요.', {
      category: 'overloaded', status, retryable: true, retryAfterMs: 3000,
    });
  }
  if (status === 413) {
    return new LLMError('입력이 너무 깁니다. 내용을 줄여주세요.', {
      category: 'context_too_long', status, retryable: false,
    });
  }
  if (status === 401 || status === 403) {
    const needsLogin = body?.needsLogin;
    const msg = needsLogin ? 'LOGIN_REQUIRED:로그인이 필요합니다.' : '인증에 실패했습니다.';
    return new LLMError(msg, { category: 'auth', status, retryable: false });
  }
  if (status >= 500) {
    return new LLMError(`서버가 잠깐 말을 잇지 못했어요 (오류 ${status}) — 저희 쪽 문제예요. 잠시 후 자동으로 다시 시도해요.`, {
      category: 'overloaded', status, retryable: true, retryAfterMs: 2000,
    });
  }
  const msg = typeof body?.error === 'string' ? body.error : `LLM 호출 실패 (${status})`;
  return new LLMError(msg, { category: 'unknown', status, retryable: false });
}

// ━━━ Circuit Breaker (프로바이더별 격리: Anthropic/OpenAI 교차 영향 방지) ━━━

interface CircuitState {
  failures: number;
  lastFailure: number;
  open: boolean;
}

const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 30_000;
const circuits = new Map<string, CircuitState>();

function getCircuit(provider: string): CircuitState {
  let c = circuits.get(provider);
  if (!c) {
    c = { failures: 0, lastFailure: 0, open: false };
    circuits.set(provider, c);
  }
  return c;
}

function checkCircuit(provider = 'anthropic'): void {
  const c = getCircuit(provider);
  if (!c.open) return;
  if (Date.now() - c.lastFailure > CIRCUIT_RESET_MS) {
    c.open = false;
    c.failures = 0;
    return;
  }
  throw new LLMError('연달아 막혀서 30초 쉬어가요. 자동으로 다시 이어져요 — 작업물은 그대로 있어요.', {
    category: 'overloaded', retryable: false,
  });
}

function recordSuccess(provider = 'anthropic'): void {
  const c = getCircuit(provider);
  c.failures = 0;
  c.open = false;
}

function recordFailure(provider = 'anthropic'): void {
  const c = getCircuit(provider);
  c.failures++;
  c.lastFailure = Date.now();
  if (c.failures >= CIRCUIT_THRESHOLD) {
    c.open = true;
  }
}

// ━━━ Enhanced Retry (Claude Code 패턴: 지수 백오프 + 에러별 지연) ━━━

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504, 529]);

// P1-C2 wall-clock ceiling across ALL attempts. Each attempt already caps at
// 120s, but 4 attempts × 120s + backoff waits could stack past 8 minutes.
// 180s sits in the same magnitude as ReviewFlow's 150s rationale and below
// the streaming HARD_CAP (300s) — non-streaming calls are shorter, structured.
const TOTAL_BUDGET_MS = 180_000;

/**
 * P1-C2 retry visibility: dispatched right before each backoff wait so the
 * 5–15s silent gap reads as "retrying (2/3)" in PhaseStatusBar / LoadingSteps
 * instead of a stalled spinner. Fact-only machine state — no drama.
 */
function emitRetryEvent(attempt: number, max: number, status?: number): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('argus:llm-retry', {
      detail: { attempt, max, status },
    }));
  }
}

async function fetchWithRetry(
  input: RequestInfo,
  init: RequestInit,
  maxRetries = 3,
  provider = 'anthropic'
): Promise<Response> {
  checkCircuit(provider);

  // P1-C3 offline honesty: when the device KNOWS it's offline, fail here in
  // 0ms instead of burning ~7s of futile retries. Single source — every
  // non-streaming caller passes through this function.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new LLMError('지금 오프라인이에요. 적어주신 내용은 이 기기에 그대로 있어요 — 연결이 돌아오면 다시 시도해 주세요.', {
      category: 'network', retryable: true,
    });
  }

  const startedAt = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0 && Date.now() - startedAt > TOTAL_BUDGET_MS) {
      recordFailure(provider);
      throw new LLMError('요청이 시간 내에 완료되지 않았어요. 잠시 후 다시 시도해 주세요.', {
        category: 'network', retryable: true,
      });
    }
    // Hard ceiling on each non-streaming attempt. Without it a dead socket / 529
    // overload leaves a user-facing call spinning for the SDK/browser default
    // (~minutes), and the caller's finally-loading-reset never runs. Mirrors the
    // streaming HARD_CAP watchdog. Combine with any caller-supplied abort signal.
    const timeoutCtl = new AbortController();
    const to = setTimeout(() => timeoutCtl.abort(), 120_000);
    const callerSignal = init.signal;
    if (callerSignal) {
      if (callerSignal.aborted) timeoutCtl.abort();
      else callerSignal.addEventListener('abort', () => timeoutCtl.abort(), { once: true });
    }
    try {
      const res = await fetch(input, { ...init, signal: timeoutCtl.signal });
      clearTimeout(to);

      if (res.ok) {
        recordSuccess(provider);
        return res;
      }

      if (!RETRYABLE_STATUS.has(res.status) || attempt === maxRetries) {
        recordFailure(provider);
        const body = await res.json().catch(() => ({}));
        throw categorizeError(res.status, body);
      }

      // 429 + needsLogin은 retry해도 절대 풀리지 않음 — 익명 쿼터 소진 상태.
      // 바로 LOGIN_REQUIRED로 분류해서 사용자에게 login 안내를 보여준다.
      const body = await res.json().catch(() => ({}));
      if (body?.code === PROVIDER_CREDITS_REQUIRED) {
        recordFailure(provider);
        throw categorizeError(res.status, body);
      }
      if (res.status === 429 && body?.needsLogin === true) {
        recordFailure(provider);
        throw categorizeError(res.status, body);
      }
      const baseDelay = res.status === 429
        ? (typeof body?.retry_after === 'number' ? body.retry_after * 1000 : 5000)
        : 1000 * Math.pow(2, attempt);
      // Jitter: ±25% to prevent thundering herd
      const jitter = baseDelay * (0.75 + Math.random() * 0.5);
      const delay = Math.min(jitter, 15_000);

      if (process.env.NODE_ENV === 'development') {
        console.warn(`[llm] 재시도 ${attempt + 1}/${maxRetries} (status ${res.status}, ${Math.round(delay)}ms 후)`);
      }
      emitRetryEvent(attempt + 1, maxRetries, res.status);
      await new Promise(r => setTimeout(r, delay));
    } catch (error) {
      clearTimeout(to);
      if (error instanceof LLMError) throw error;
      // AbortError: distinguish a real user-cancel (caller signal aborted) from
      // OUR hard-cap timeout. User cancel → don't retry. Timeout → treat as a
      // retryable network error so the loop can try again, then surface a clear
      // failure instead of "요청이 취소되었습니다" (which would be a lie on timeout).
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (callerSignal?.aborted) {
          throw new LLMError('요청이 취소되었습니다.', {
            category: 'network', retryable: false, cause: error,
          });
        }
        if (attempt === maxRetries) {
          throw new LLMError('요청이 시간 내에 완료되지 않았어요. 잠시 후 다시 시도해 주세요.', {
            category: 'network', retryable: true, cause: error,
          });
        }
        emitRetryEvent(attempt + 1, maxRetries);
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
        continue;
      }
      if (attempt === maxRetries) {
        recordFailure(provider);
        throw new LLMError('네트워크 연결에 실패했습니다.', {
          category: 'network', retryable: true, cause: error,
        });
      }
      emitRetryEvent(attempt + 1, maxRetries);
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  // Unreachable
  return fetch(input, init);
}

// ━━━ JSON Parsing (강화: partial recovery + markdown fence 처리) ━━━

const MAX_JSON_LENGTH = 200_000;

export function repairTruncatedJSON(text: string): unknown {
  const start = text.indexOf('{');
  if (start < 0) return null;
  const s = text.slice(start);
  let inStr = false;
  let esc = false;
  const stack: string[] = [];
  let cut = -1;
  let cutStack: string[] = [];
  const mark = (idx: number) => {
    cut = idx;
    cutStack = [...stack];
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') {
        inStr = false;
        if (stack[stack.length - 1] === ']') mark(i + 1);
      }
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') {
      stack.pop();
      mark(i + 1);
    } else if (c === ',') {
      mark(i);
    }
  }

  if (cut < 0) return null;
  let candidate = s.slice(0, cut);
  for (let k = cutStack.length - 1; k >= 0; k--) {
    candidate += cutStack[k];
  }
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

export function parseJSON<T = unknown>(text: string): T {
  if (text.length > MAX_JSON_LENGTH) {
    throw new LLMError('LLM 응답이 너무 큽니다.', { category: 'parse_failure' });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Strategy 1: Extract from markdown code fences
    const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenced) {
      try { parsed = JSON.parse(fenced[1]); } catch { /* fall through */ }
    }

    // Strategy 2: Extract outermost JSON object
    if (!parsed) {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /* fall through */ }
      }
    }

    // Strategy 3: Extract JSON array
    if (!parsed) {
      const arrMatch = text.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        try { parsed = JSON.parse(arrMatch[0]); } catch { /* fall through */ }
      }
    }

    if (!parsed) {
      parsed = repairTruncatedJSON(text);
    }

    if (!parsed) {
      throw new LLMError('JSON 파싱 실패: LLM이 유효하지 않은 형식으로 응답했습니다.', {
        category: 'parse_failure',
      });
    }
  }

  if (parsed === null || typeof parsed !== 'object') {
    throw new LLMError('LLM이 객체가 아닌 값을 반환했습니다.', { category: 'parse_failure' });
  }

  return parsed as T;
}

// ━━━ Schema Validation (Claude Code 패턴: 타입 강제 변환 + 기본값) ━━━

type SchemaFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface FieldSchema {
  type: SchemaFieldType;
  default?: unknown;
  required?: boolean;
  /** Coerce string "true"→true, "123"→123 (Claude Code semanticNumber 패턴) */
  coerce?: boolean;
}

/**
 * Enhanced validateShape with defaults, coercion, and required checks.
 * Non-destructive: returns a new object with missing fields filled in.
 */
export function validateShape<T extends Record<string, unknown>>(
  obj: unknown,
  schema: Record<string, SchemaFieldType | FieldSchema>
): T {
  if (!obj || typeof obj !== 'object') {
    throw new LLMError('validateShape: 객체가 아닙니다.', { category: 'validation' });
  }

  const record = { ...(obj as Record<string, unknown>) };

  for (const [key, def] of Object.entries(schema)) {
    const fieldDef: FieldSchema = typeof def === 'string' ? { type: def } : def;
    let value = record[key];

    // Apply coercion (LLM sometimes returns "true" instead of true)
    if (fieldDef.coerce && value !== undefined && value !== null) {
      if (fieldDef.type === 'boolean' && typeof value === 'string') {
        value = value === 'true' || value === '1';
        record[key] = value;
      }
      if (fieldDef.type === 'number' && typeof value === 'string') {
        const num = Number(value);
        if (!isNaN(num)) { value = num; record[key] = value; }
      }
    }

    // Apply defaults for missing/null values
    if ((value === undefined || value === null) && fieldDef.default !== undefined) {
      record[key] = fieldDef.default;
      continue;
    }

    // Skip optional fields that are missing
    if (value === undefined || value === null) {
      if (fieldDef.required) {
        throw new LLMError(`필수 필드 "${key}"가 누락되었습니다.`, { category: 'validation' });
      }
      continue;
    }

    // Type check
    if (fieldDef.type === 'array') {
      if (!Array.isArray(value)) {
        if (fieldDef.default !== undefined) {
          record[key] = fieldDef.default;
        } else {
          throw new LLMError(`"${key}" 필드가 배열이어야 합니다.`, { category: 'validation' });
        }
      }
    } else if (typeof value !== fieldDef.type) {
      if (fieldDef.default !== undefined) {
        record[key] = fieldDef.default;
      } else {
        throw new LLMError(`"${key}" 필드의 타입이 올바르지 않습니다 (${fieldDef.type} 필요, ${typeof value} 받음).`, {
          category: 'validation',
        });
      }
    }
  }

  return record as T;
}

// ━━━ Settings ━━━

/** The vision/document review path only works on the Anthropic provider (the
 *  proxy or the user's direct Anthropic key) — OpenAI/Gemini use different image
 *  encodings, so a review there falls back to text-only. */
export function visionCapable(): boolean {
  const p = getSettings().llm_provider;
  return p !== 'openai' && p !== 'gemini';
}

function getSettings(): Settings {
  return getStorage<Settings>(STORAGE_KEYS.SETTINGS, {
    anthropic_api_key: '',
    openai_api_key: '',
    gemini_api_key: '',
    llm_provider: 'anthropic',
    anthropic_model: DEFAULT_ANTHROPIC_MODEL,
    openai_model: DEFAULT_OPENAI_MODEL,
    gemini_model: DEFAULT_GEMINI_MODEL,
    llm_mode: 'proxy',
    local_endpoint: '',
    language: 'ko',
    audio_enabled: false,
    audio_volume: 0.15,
  });
}

// ━━━ Auth Helper ━━━

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const { supabase } = await import('./supabase');
    // Defense in depth: getSession() sits in the critical path of every proxied
    // LLM call. If token retrieval ever stalls (a hung refresh, a contended auth
    // lock), we must NOT freeze the whole pipeline behind an infinite await —
    // that's the "spinner forever / session won't start" failure. Cap it: on
    // timeout we proceed WITHOUT the bearer token. The proxy then either serves
    // the anonymous free tier or returns a clean 401/429 the UI can surface,
    // instead of the analysis hanging.
    const session = await Promise.race([
      supabase.auth.getSession().then(r => r.data.session),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
    ]);
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch {
    // Token unavailable — proceed unauthenticated rather than blocking the call.
  }
  return headers;
}

// ━━━ Non-streaming calls ━━━

export async function callLLM(
  messages: LLMMessage[],
  options: LLMOptions
): Promise<string> {
  const settings = getSettings();

  // OpenAI provider — always direct (user's own key)
  if (settings.llm_provider === 'openai') {
    if (!settings.openai_api_key) {
      throw new LLMError('OpenAI API 키가 설정되지 않았습니다. 설정에서 키를 입력해주세요.', { category: 'auth' });
    }
    return callOpenAI(settings.openai_api_key, settings.openai_model || DEFAULT_OPENAI_MODEL, messages, options);
  }

  // Gemini provider — always direct (user's own key)
  if (settings.llm_provider === 'gemini') {
    if (!settings.gemini_api_key) {
      throw new LLMError('Google AI API 키가 설정되지 않았습니다. 설정에서 키를 입력해주세요.', { category: 'auth' });
    }
    return callGemini(settings.gemini_api_key, settings.gemini_model || DEFAULT_GEMINI_MODEL, messages, options);
  }

  if (settings.llm_mode === 'direct' && settings.anthropic_api_key) {
    return callServerWithUserKey(settings.anthropic_api_key, settings.anthropic_model || DEFAULT_ANTHROPIC_MODEL, messages, options);
  }

  return callProxy(settings.anthropic_model || DEFAULT_ANTHROPIC_MODEL, messages, options);
}

/**
 * Real provider handshake for Settings. This intentionally performs a tiny
 * generation through the exact same provider/model/key routing used by the
 * product; format-only validation would let revoked or credit-starved keys look
 * "connected" until a deep run failed minutes later.
 */
export async function verifyCurrentLlmConnection(): Promise<void> {
  const text = await callLLM(
    [{ role: 'user', content: 'Reply with exactly: OK' }],
    {
      system: 'This is a connection check. Reply with exactly OK and nothing else.',
      maxTokens: 8,
      model: 'fast',
    },
  );
  if (!text.trim()) {
    throw new LLMError('The provider returned an empty response.', {
      category: 'service_unavailable',
      retryable: false,
    });
  }
}

// ━━━ Provider tier mapping (업무 성격에 따라 모델 자동 선택) ━━━

function resolveOpenAIModel(baseModel: string, tier?: ModelTier): string {
  void tier;
  return baseModel;
}

function resolveGeminiModel(baseModel: string, tier?: ModelTier): string {
  void tier;
  return baseModel;
}

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: LLMMessage[],
  options: LLMOptions
): Promise<string> {
  const resolvedModel = resolveOpenAIModel(model, options.model);
  const res = await fetchWithRetry('/api/llm/openai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      model: resolvedModel,
      messages,
      system: options.system,
      maxTokens: options.maxTokens,
    }),
    signal: options.signal,
  }, 3, 'openai');

  const data = await res.json();
  return data.text;
}

async function callGemini(
  apiKey: string,
  model: string,
  messages: LLMMessage[],
  options: LLMOptions
): Promise<string> {
  const resolvedModel = resolveGeminiModel(model, options.model);
  const res = await fetchWithRetry('/api/llm/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      model: resolvedModel,
      messages,
      system: options.system,
      maxTokens: options.maxTokens,
    }),
    signal: options.signal,
  }, 3, 'gemini');

  const data = await res.json();
  return data.text;
}

async function callServerWithUserKey(
  apiKey: string,
  anthropicModel: string,
  messages: LLMMessage[],
  options: LLMOptions
): Promise<string> {
  const res = await fetchWithRetry('/api/llm/direct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey,
      messages,
      system: options.system,
      maxTokens: options.maxTokens,
      model: options.model,
      anthropicModel,
      cacheSystem: options.cacheSystem,
    }),
    signal: options.signal,
  });

  const data = await res.json();
  return data.text;
}

async function callProxy(
  anthropicModel: string,
  messages: LLMMessage[],
  options: LLMOptions
): Promise<string> {
  const headers = await getAuthHeaders();

  const res = await fetchWithRetry('/api/llm', {
    method: 'POST',
    headers,
    body: JSON.stringify({ messages, system: options.system, maxTokens: options.maxTokens, model: options.model, anthropicModel, cacheSystem: options.cacheSystem }),
    signal: options.signal,
  });

  const data = await res.json();
  return data.text;
}

// ━━━ JSON call (enhanced: schema validation + parse retry) ━━━

export async function callLLMJson<T = unknown>(
  messages: LLMMessage[],
  options: LLMOptions & {
    shape?: Record<string, SchemaFieldType | FieldSchema>;
    /** Auto-retry with corrective prompt on parse failure (default: 1) */
    parseRetries?: number;
  } = { system: '' }
): Promise<T> {
  const maxParseRetries = options.parseRetries ?? 1;

  for (let attempt = 0; attempt <= maxParseRetries; attempt++) {
    try {
      const currentMessages = attempt === 0
        ? messages
        : [
            ...messages,
            {
              role: 'assistant' as const,
              content: '죄송합니다. JSON 형식으로 다시 응답하겠습니다.',
            },
            {
              role: 'user' as const,
              content: '반드시 유효한 JSON 객체만 응답하세요. 마크다운, 설명, 코드 블록 없이 { } 로 시작하고 끝나는 순수 JSON만.',
            },
          ];

      const text = await callLLM(currentMessages, options);
      const parsed = parseJSON<T>(text);

      if (options.shape) {
        return validateShape<T & Record<string, unknown>>(parsed, options.shape) as T;
      }
      return parsed;
    } catch (error) {
      const isParseError = error instanceof LLMError &&
        (error.category === 'parse_failure' || error.category === 'validation');

      if (isParseError && attempt < maxParseRetries) {
        if (process.env.NODE_ENV === 'development') {
          console.warn(`[llm] JSON 파싱 재시도 ${attempt + 1}/${maxParseRetries}`);
        }
        continue;
      }
      throw error;
    }
  }

  // Unreachable
  throw new LLMError('JSON 파싱에 실패했습니다.', { category: 'parse_failure' });
}

// ━━━ Parallel calls (Claude Code StreamingToolExecutor 패턴) ━━━

export interface ParallelCallOptions<T> extends LLMOptions {
  shape?: Record<string, SchemaFieldType | FieldSchema>;
  /** Called when each individual call completes */
  onItemComplete?: (index: number, result: T) => void;
  /** Called when an individual call fails */
  onItemError?: (index: number, error: Error) => void;
}

export interface ParallelResult<T> {
  results: (T | null)[];
  errors: (Error | null)[];
  successCount: number;
  failureCount: number;
}

/**
 * Run multiple LLM calls concurrently with Promise.allSettled.
 * Each call gets its own messages but shares the system prompt.
 * Failed calls don't block others.
 */
export async function callLLMParallel<T = unknown>(
  calls: Array<{ messages: LLMMessage[] }>,
  options: ParallelCallOptions<T>
): Promise<ParallelResult<T>> {
  const promises = calls.map(async (call, index) => {
    const result = await callLLMJson<T>(call.messages, {
      system: options.system,
      maxTokens: options.maxTokens,
      model: options.model,
      signal: options.signal,
      shape: options.shape,
    });
    options.onItemComplete?.(index, result);
    return result;
  });

  const settled = await Promise.allSettled(promises);

  const results: (T | null)[] = [];
  const errors: (Error | null)[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < settled.length; i++) {
    const outcome = settled[i];
    if (outcome.status === 'fulfilled') {
      results.push(outcome.value);
      errors.push(null);
      successCount++;
    } else {
      results.push(null);
      const err = outcome.reason instanceof Error ? outcome.reason : new Error(String(outcome.reason));
      errors.push(err);
      options.onItemError?.(i, err);
      failureCount++;
    }
  }

  return { results, errors, successCount, failureCount };
}

// ━━━ Streaming (enhanced: abort + better SSE parsing + rate limit) ━━━

export async function callLLMStream(
  messages: LLMMessage[],
  options: LLMOptions,
  callbacks: StreamCallbacks
): Promise<void> {
  const settings = getSettings();
  const isOpenAI = settings.llm_provider === 'openai';
  const isGemini = settings.llm_provider === 'gemini';
  if (isOpenAI && !settings.openai_api_key) {
    callbacks.onError(new LLMError('OpenAI API 키가 설정되지 않았습니다.', { category: 'auth' }));
    return;
  }
  if (isGemini && !settings.gemini_api_key) {
    callbacks.onError(new LLMError('Google AI API 키가 설정되지 않았습니다.', { category: 'auth' }));
    return;
  }
  const isDirect = !isOpenAI && !isGemini && settings.llm_mode === 'direct' && settings.anthropic_api_key;
  const url = isGemini ? '/api/llm/gemini' : isOpenAI ? '/api/llm/openai' : isDirect ? '/api/llm/direct' : '/api/llm';

  let headers: Record<string, string>;
  if (isOpenAI || isGemini || isDirect) {
    headers = { 'Content-Type': 'application/json' };
  } else {
    headers = await getAuthHeaders();
  }

  const bodyObj: Record<string, unknown> = {
    messages,
    system: options.system,
    maxTokens: options.maxTokens,
    model: options.model,
    stream: true,
    cacheSystem: options.cacheSystem,
  };
  if (isGemini) {
    bodyObj.apiKey = settings.gemini_api_key;
    bodyObj.model = resolveGeminiModel(settings.gemini_model || DEFAULT_GEMINI_MODEL, options.model);
  } else if (isOpenAI) {
    bodyObj.apiKey = settings.openai_api_key;
    bodyObj.model = resolveOpenAIModel(settings.openai_model || DEFAULT_OPENAI_MODEL, options.model);
  } else if (isDirect) {
    bodyObj.apiKey = settings.anthropic_api_key;
    bodyObj.anthropicModel = settings.anthropic_model || DEFAULT_ANTHROPIC_MODEL;
  } else {
    bodyObj.anthropicModel = settings.anthropic_model || DEFAULT_ANTHROPIC_MODEL;
  }

  const provider = isGemini ? 'gemini' : isOpenAI ? 'openai' : 'anthropic';

  try {
    checkCircuit(provider);

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyObj),
      signal: options.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      recordFailure(provider);
      throw categorizeError(res.status, body);
    }

    recordSuccess(provider);
    const reader = res.body?.getReader();
    if (!reader) throw new LLMError('스트림을 사용할 수 없습니다.', { category: 'network' });

    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = ''; // Buffer for incomplete SSE lines

    // ── UI flush throttle ────────────────────────────────────────────────
    // SSE delivers dozens of chunks per second, and every onToken call
    // re-renders the whole subscriber tree (ProgressiveFlow + framer-motion;
    // 3 workers stream concurrently). ~80ms batches are imperceptible to the
    // eye but cut render work by an order of magnitude. The trailing timeout
    // guarantees the latest text always lands; onComplete delivers the final.
    const FLUSH_MS = 80;
    let lastFlush = 0;
    let trailing: ReturnType<typeof setTimeout> | null = null;
    let unflushed = false; // text accumulated since the last onToken
    const emitToken = () => {
      const now = Date.now();
      if (now - lastFlush >= FLUSH_MS) {
        lastFlush = now;
        unflushed = false;
        if (trailing) { clearTimeout(trailing); trailing = null; }
        callbacks.onToken(fullText);
      } else {
        unflushed = true;
        if (!trailing) {
          trailing = setTimeout(() => {
            trailing = null;
            lastFlush = Date.now();
            unflushed = false;
            callbacks.onToken(fullText);
          }, FLUSH_MS - (now - lastFlush));
        }
      }
    };

    // ── Inactivity watchdog ──────────────────────────────────────────────
    // A zombie connection (socket open, no final chunk) otherwise hangs the UI
    // forever — the only recovery is a page reload. Abort if no chunk arrives
    // for IDLE_MS, or the whole stream exceeds HARD_CAP_MS. We cancel the reader
    // (which resolves the pending read as `done`) and raise a DISTINCT timeout
    // LLMError below — NOT an AbortError, which the ProgressiveFlow handler
    // suppresses (so the spinner would never clear). User cancellation via
    // options.signal is unaffected and still surfaces as the existing AbortError.
    const IDLE_MS = 30_000;
    // 300s (was 180s): a full 8k-token document legitimately streams longer than
    // 3 min. The 30s IDLE watchdog still kills a genuinely dead connection fast;
    // HARD_CAP is only the absolute backstop, so a larger value won't hang the UI.
    const HARD_CAP_MS = 300_000;
    let timedOut: 'idle' | 'cap' | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const triggerTimeout = (kind: 'idle' | 'cap') => {
      if (!timedOut) timedOut = kind;
      reader.cancel().catch(() => {});
    };
    const armIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => triggerTimeout('idle'), IDLE_MS);
    };
    const capTimer = setTimeout(() => triggerTimeout('cap'), HARD_CAP_MS);
    armIdle();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        armIdle(); // reset idle timer on every chunk

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              // 서버가 스트림 내부에서 보낸 에러 이벤트
              recordFailure(provider);
              if (parsed.code === PROVIDER_CREDITS_REQUIRED) {
                throw buildLlmError(typeof parsed.status === 'number' ? parsed.status : 503, parsed);
              }
              throw new LLMError(typeof parsed.error === 'string' ? parsed.error : 'Stream error', {
                category: 'unknown',
                retryable: parsed.retryable === true,
              });
            }
            if (parsed.text) {
              fullText += parsed.text;
              emitToken();
            }
            if (parsed.rateLimit !== undefined && typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('argus:ratelimit', {
                detail: { remaining: parsed.rateLimit },
              }));
            }
          } catch (e) {
            if (e instanceof LLMError) throw e;
            // Skip malformed chunks
          }
        }
      }

      // Process any remaining buffer
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6).trim();
        if (data && data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              fullText += parsed.text;
              emitToken();
            }
          } catch { /* skip */ }
        }
      }
    } finally {
      if (idleTimer) clearTimeout(idleTimer);
      clearTimeout(capTimer);
      // Don't let a queued trailing flush fire after completion/error.
      if (trailing) { clearTimeout(trailing); trailing = null; }
    }

    if (timedOut) {
      recordFailure(provider);
      throw new LLMError(
        timedOut === 'idle'
          ? '응답이 지연되어 요청을 중단했습니다. 다시 시도해 주세요.'
          : '응답이 너무 오래 걸려 요청을 중단했습니다. 다시 시도해 주세요.',
        { category: 'network' },
      );
    }

    // Synchronous final flush: text deferred by the throttle must reach
    // onToken before completion (callers render from onToken; onComplete is
    // the parse/cleanup signal). The trailing timer was cleared in `finally`.
    if (unflushed) {
      unflushed = false;
      callbacks.onToken(fullText);
    }
    callbacks.onComplete(fullText);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      callbacks.onError(new LLMError('요청이 취소되었습니다.', { category: 'network', cause: error }));
      return;
    }
    // 스트림 중 실패 → circuit breaker에 기록
    if (!(error instanceof LLMError)) recordFailure(provider);
    callbacks.onError(error instanceof Error ? error : new Error(String(error)));
  }
}

// ━━━ Streaming JSON (new: stream + parse at end) ━━━

/**
 * Stream LLM output for UX (show progress), then parse as JSON at the end.
 * Best of both worlds: real-time UX + structured output.
 */
export async function callLLMStreamThenParse<T = unknown>(
  messages: LLMMessage[],
  options: LLMOptions & {
    shape?: Record<string, SchemaFieldType | FieldSchema>;
    /** Internal recursion guard for the streaming retry below. */
    _streamRetried?: boolean;
  },
  onToken: (text: string) => void
): Promise<T> {
  // Stream first (for the live UX), collecting the full text.
  const fullText = await new Promise<string>((resolve, reject) => {
    callLLMStream(messages, options, {
      onToken,
      onComplete: resolve,
      onError: reject,
    });
  });

  try {
    const parsed = parseJSON<T>(fullText);
    return options.shape
      ? validateShape<T & Record<string, unknown>>(parsed, options.shape) as T
      : parsed;
  } catch (error) {
    // The streamed text didn't parse — almost always a mid-JSON truncation.
    // Only recover from parse/validation failures — never from abort / auth /
    // rate-limit, which must surface unchanged.
    const recoverable = error instanceof LLMError &&
      (error.category === 'parse_failure' || error.category === 'validation');
    if (recoverable) {
      // The user is about to pay for the same generation twice. Counted so the
      // funnel can SEE how often the double-payment path fires (it ran at 44%
      // of big calls for months with zero signal). Pairs with the server-side
      // llm_truncation event, which records the usual root cause.
      try { track('llm_stream_retry', { category: error.category, attempt: options._streamRetried ? 2 : 1 }); } catch { /* analytics never breaks the call */ }
      // A truncated stream is the likeliest cause, so a same-budget retry would
      // hit the same ceiling. Give the clean retry extra room (the server clamps
      // to its own cap), turning genuine length overflow into a recoverable case
      // too — not just markdown-wrapped / preamble malformations.
      const retryTokens = Math.min((options.maxTokens ?? 2000) + 2000, 8192);
      // Retry STREAMING first. The old fallback went straight to a
      // non-streaming call, so the user's screen froze for the entire second
      // attempt — measured 49 seconds of dead UI on a production submit
      // (2026-07-30, the 81-second question). Same request, same recovery,
      // but the progress stays visible. One recursion only; a second parse
      // failure falls through to callLLMJson, whose corrective-prompt retry
      // handles the non-truncation malformations.
      if (!options._streamRetried) {
        return callLLMStreamThenParse<T>(
          messages,
          { ...options, maxTokens: retryTokens, _streamRetried: true },
          onToken,
        );
      }
      return callLLMJson<T>(messages, { ...options, maxTokens: retryTokens });
    }
    throw error;
  }
}
