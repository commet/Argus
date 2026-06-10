/**
 * Headless LLM calls via `claude -p` (uses the user's existing Claude Code auth — no API key).
 * Tools are denied: the model only sees inline data and returns JSON.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const DENIED_TOOLS = 'Bash,Edit,Write,Read,Glob,Grep,WebFetch,WebSearch,Agent,Task,NotebookEdit';

export async function callClaude(prompt, { model = 'sonnet', timeoutMs = 180000 } = {}) {
  const { stdout } = await execFileP('claude', [
    '-p', prompt,
    '--model', model,
    '--output-format', 'json',
    '--disallowedTools', DENIED_TOOLS,
  ], { encoding: 'utf8', timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 });
  const parsed = JSON.parse(stdout);
  if (parsed.is_error) throw new Error(`claude -p error: ${String(parsed.result).slice(0, 300)}`);
  return parsed.result;
}

/** Extract the first JSON object/array from model text (tolerates ```json fences and prose). */
export function extractJson(text) {
  // try every code fence that contains a brace, then fall back to the raw text
  const candidates = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)]
    .map(m => m[1]).filter(c => /[[{]/.test(c));
  candidates.push(text);
  let lastErr = new Error('no JSON found in model output');
  for (const candidate of candidates) {
    try { return scanJson(candidate); } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

function scanJson(candidate) {
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error('no JSON found in model output');
  const s = candidate.slice(start);
  let depth = 0, inStr = false, esc = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) return JSON.parse(s.slice(0, i + 1));
    }
  }
  throw new Error('unbalanced JSON in model output');
}

export async function callClaudeJson(prompt, opts = {}) {
  const text = await callClaude(prompt, opts);
  return extractJson(text);
}

/** Run async jobs with bounded concurrency, preserving order of results. */
export async function pool(items, worker, concurrency = 4) {
  const results = new Array(items.length);
  let next = 0;
  async function lane() {
    while (next < items.length) {
      const i = next++;
      try { results[i] = await worker(items[i], i); }
      catch (e) { results[i] = { __error: e.message }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
  return results;
}
