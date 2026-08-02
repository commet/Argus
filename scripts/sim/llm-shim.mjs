/**
 * Node-side stand-in for src/lib/llm.ts — SAME call surface (callLLM /
 * callLLMJson / callLLMStreamThenParse / LLMError), SAME tier→model map as
 * src/app/api/llm/route.ts MODEL_MAP, SAME parseJSON recovery strategies and
 * validateShape semantics, SAME corrective parse-retry (parseRetries default 1).
 *
 * Differences (deliberate, sim-only):
 *  - Talks to api.anthropic.com directly (the sim has no Next server / browser).
 *  - Records EVERY call into `callLog` (system, user, raw text, parsed, usage).
 *  - Enforces a hard global call budget (default 200) — the sim's cost guard.
 *  - callLLMStreamThenParse degrades to non-streaming (same request/parse path).
 *
 * The engine under test (light-engine.ts, and the heavy call shapes replicated
 * in sim-entry.ts) imports THIS module via the esbuild alias in run-sim.mjs.
 */

// ─── Tier → effective product default ───
// Browser calls always carry the settings-store choice. The store's current
// default is Sonnet 5, so using the route's legacy no-choice fallback here made
// the simulator grade a model new users do not actually run.
export const MODEL_MAP = {
  fast: 'claude-haiku-4-5-20251001',
  default: 'claude-sonnet-5',
  strong: 'claude-opus-4-8',
};

let apiKey = process.env.ANTHROPIC_API_KEY || '';
export function setApiKey(k) { apiKey = k; }

const budget = { used: 0, max: 200 };
export function setBudget(n) { budget.max = n; }
export function callsUsed() { return budget.used; }

/** Every LLM call in the run, in order. Entries:
 *  { seq, label, tier, modelId, maxTokens, system, user, rawText, parsed,
 *    usage, ms, attempt, error } */
export const callLog = [];
let currentLabel = 'unlabeled';
/** Tag subsequent calls with a scenario/phase label so the log maps to transcripts. */
export function setCallLabel(label) { currentLabel = label; }

export class LLMError extends Error {
  constructor(message, opts = {}) {
    super(message);
    this.name = 'LLMError';
    this.category = opts.category || 'unknown';
    this.status = opts.status;
    this.retryable = opts.retryable ?? false;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Raw Anthropic messages call with retry/backoff. Used by the shimmed
 *  callLLM* surface AND directly by the judge (temperature 0). */
export async function anthropicText({ system, messages, model = 'default', maxTokens = 2000, temperature, cacheSystem = false, thinkingDisabled = false }) {
  if (!apiKey) throw new LLMError('ANTHROPIC_API_KEY is not set', { category: 'auth' });
  if (budget.used >= budget.max) {
    throw new LLMError(`LLM call budget exhausted (${budget.used}/${budget.max})`, { category: 'budget' });
  }
  budget.used++;
  const modelId = MODEL_MAP[model] || MODEL_MAP.default;
  const body = {
    model: modelId,
    max_tokens: maxTokens,
    // cacheSystem mirrors the route's prompt-cache block for the big static
    // system prompts (initial analysis ≈7k tokens × 14 calls in this sim).
    system: cacheSystem
      ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
      : system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  };
  if (thinkingDisabled) body.thinking = { type: 'disabled' };
  // Sonnet/Opus/Fable 5 reject non-default sampling parameters. The old judge
  // requested temperature=0; carrying it across the model upgrade turns every
  // otherwise-valid evaluation into HTTP 400. Omitting it is also what the web
  // runtime does for these adaptive-thinking models.
  const rejectsSampling = /^claude-(?:sonnet|opus|fable)-5$/.test(modelId);
  if (temperature !== undefined && !rejectsSampling) body.temperature = temperature;

  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      lastErr = new LLMError(`network: ${e.message}`, { category: 'network', retryable: true });
      await sleep(1000 * Math.pow(2, attempt));
      continue;
    }
    if (res.status === 429 || res.status === 529 || res.status >= 500) {
      const t = await res.text().catch(() => '');
      lastErr = new LLMError(`API ${res.status}: ${t.slice(0, 200)}`, { category: res.status === 429 ? 'rate_limit' : 'overloaded', status: res.status, retryable: true });
      await sleep(Math.min(2000 * Math.pow(2, attempt), 15000));
      continue;
    }
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new LLMError(`API ${res.status}: ${t.slice(0, 300)}`, { category: 'unknown', status: res.status });
    }
    const data = await res.json();
    const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    return { text, usage: data.usage, modelId };
  }
  throw lastErr || new LLMError('API retries exhausted', { category: 'overloaded', retryable: true });
}

// ─── parseJSON — copy of src/lib/llm.ts strategies ───

const MAX_JSON_LENGTH = 200_000;

export function repairTruncatedJSON(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;
  const s = text.slice(start);
  let inStr = false;
  let esc = false;
  const stack = [];
  let cut = -1;
  let cutStack = [];
  const mark = (idx) => { cut = idx; cutStack = [...stack]; };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') { inStr = false; if (stack[stack.length - 1] === ']') mark(i + 1); }
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') stack.push('}');
    else if (c === '[') stack.push(']');
    else if (c === '}' || c === ']') { stack.pop(); mark(i + 1); }
    else if (c === ',') mark(i);
  }
  if (cut < 0) return null;
  let candidate = s.slice(0, cut);
  for (let k = cutStack.length - 1; k >= 0; k--) candidate += cutStack[k];
  try { return JSON.parse(candidate); } catch { return null; }
}

export function parseJSON(text) {
  if (text.length > MAX_JSON_LENGTH) throw new LLMError('LLM 응답이 너무 큽니다.', { category: 'parse_failure' });
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenced) { try { parsed = JSON.parse(fenced[1]); } catch { /* fall through */ } }
    if (!parsed) {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) { try { parsed = JSON.parse(match[0]); } catch { /* fall through */ } }
    }
    if (!parsed) {
      const arrMatch = text.match(/\[[\s\S]*\]/);
      if (arrMatch) { try { parsed = JSON.parse(arrMatch[0]); } catch { /* fall through */ } }
    }
    if (!parsed) parsed = repairTruncatedJSON(text);
    if (!parsed) throw new LLMError('JSON 파싱 실패: LLM이 유효하지 않은 형식으로 응답했습니다.', { category: 'parse_failure' });
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new LLMError('LLM이 객체가 아닌 값을 반환했습니다.', { category: 'parse_failure' });
  }
  return parsed;
}

// ─── validateShape — same semantics as src/lib/llm.ts ───

export function validateShape(obj, schema) {
  if (!obj || typeof obj !== 'object') throw new LLMError('validateShape: 객체가 아닙니다.', { category: 'validation' });
  const record = { ...obj };
  for (const [key, def] of Object.entries(schema)) {
    const fieldDef = typeof def === 'string' ? { type: def } : def;
    let value = record[key];
    if (fieldDef.coerce && value !== undefined && value !== null) {
      if (fieldDef.type === 'boolean' && typeof value === 'string') { value = value === 'true' || value === '1'; record[key] = value; }
      if (fieldDef.type === 'number' && typeof value === 'string') { const num = Number(value); if (!isNaN(num)) { value = num; record[key] = value; } }
    }
    if ((value === undefined || value === null) && fieldDef.default !== undefined) { record[key] = fieldDef.default; continue; }
    if (value === undefined || value === null) {
      if (fieldDef.required) throw new LLMError(`필수 필드 "${key}"가 누락되었습니다.`, { category: 'validation' });
      continue;
    }
    if (fieldDef.type === 'array') {
      if (!Array.isArray(value)) {
        if (fieldDef.default !== undefined) record[key] = fieldDef.default;
        else throw new LLMError(`"${key}" 필드가 배열이어야 합니다.`, { category: 'validation' });
      }
    } else if (typeof value !== fieldDef.type) {
      if (fieldDef.default !== undefined) record[key] = fieldDef.default;
      else throw new LLMError(`"${key}" 필드의 타입이 올바르지 않습니다.`, { category: 'validation' });
    }
  }
  return record;
}

// ─── The shimmed public surface (what the bundled engine imports) ───

export async function callLLM(messages, options) {
  const { text } = await anthropicText({
    system: options.system,
    messages,
    model: options.model || 'default',
    maxTokens: options.maxTokens ?? 2000,
    cacheSystem: options.cacheSystem === true,
  });
  return text;
}

export async function callLLMJson(messages, options = { system: '' }) {
  const maxParseRetries = options.parseRetries ?? 1;
  for (let attempt = 0; attempt <= maxParseRetries; attempt++) {
    const currentMessages = attempt === 0
      ? messages
      : [
          ...messages,
          { role: 'assistant', content: '죄송합니다. JSON 형식으로 다시 응답하겠습니다.' },
          { role: 'user', content: '반드시 유효한 JSON 객체만 응답하세요. 마크다운, 설명, 코드 블록 없이 { } 로 시작하고 끝나는 순수 JSON만.' },
        ];
    const entry = {
      seq: callLog.length,
      label: currentLabel,
      tier: options.model || 'default',
      maxTokens: options.maxTokens,
      attempt,
      system: options.system,
      user: currentMessages.map((m) => `[${m.role}] ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n---\n'),
    };
    const started = Date.now();
    try {
      const { text, usage, modelId } = await anthropicText({
        system: options.system,
        messages: currentMessages,
        model: options.model || 'default',
        maxTokens: options.maxTokens ?? 2000,
        cacheSystem: options.cacheSystem === true,
      });
      entry.rawText = text;
      entry.usage = usage;
      entry.modelId = modelId;
      entry.ms = Date.now() - started;
      const parsed = parseJSON(text);
      const out = options.shape ? validateShape(parsed, options.shape) : parsed;
      entry.parsed = out;
      callLog.push(entry);
      return out;
    } catch (error) {
      entry.error = String(error && error.message);
      entry.ms = Date.now() - started;
      callLog.push(entry);
      const isParseError = error instanceof LLMError && (error.category === 'parse_failure' || error.category === 'validation');
      if (isParseError && attempt < maxParseRetries) continue;
      throw error;
    }
  }
  throw new LLMError('JSON 파싱에 실패했습니다.', { category: 'parse_failure' });
}

/** Sim: no browser streaming — same request, same parse path, no onToken drip. */
export async function callLLMStreamThenParse(messages, options, _onToken) {
  return callLLMJson(messages, options);
}

export async function callLLMParallel(calls, options) {
  const results = []; const errors = []; let successCount = 0; let failureCount = 0;
  for (const call of calls) {
    try { results.push(await callLLMJson(call.messages, options)); errors.push(null); successCount++; }
    catch (e) { results.push(null); errors.push(e); failureCount++; }
  }
  return { results, errors, successCount, failureCount };
}
