/**
 * Incremental JSON parser for streaming InitialAnalysisResponse / DeepeningResponse.
 *
 * LLM tokens arrive as partial JSON. This extracts what's readable so far:
 * - `real_question` (with in-progress suffix for cursor blink)
 * - `hidden_assumptions` (only completed strings)
 * - `skeleton` (only completed strings)
 * - `stage` — which field the stream is currently writing
 *
 * Shared between HeroFlow's full-screen analysis card and ProgressiveFlow's
 * inline deepening snippet.
 */

export type PartialStage = 'reading' | 'question' | 'assumptions' | 'skeleton';

export interface PartialAnalysis {
  real_question: string;
  real_question_complete: boolean;
  hidden_assumptions: string[];
  skeleton: string[];
  stage: PartialStage;
  /** STEP-0 classification — streams FIRST, so the UI knows the route within
   *  the opening seconds. Empty string until the field has streamed. */
  request_type: string;
  /** The model's direct answer. For non-open routes this IS the deliverable
   *  (2026-07-31: it used to stream dead last and never render — a vent/info
   *  user stared at their own echoed sentence for the whole wait). For OPEN
   *  routes the engine discards it (structural neutrality), so the UI must
   *  not render it there. */
  insight: string;
  insight_complete: boolean;
}

function unescapeJsonString(s: string): string {
  return s.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
}

function extractCompleteStrings(text: string, key: string): string[] {
  const m = text.match(new RegExp(`"${key}"\\s*:\\s*\\[`));
  if (!m || m.index === undefined) return [];
  const start = m.index + m[0].length;
  const items: string[] = [];
  let i = start;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i])) i++;
    if (i >= text.length || text[i] === ']') break;
    if (text[i] !== '"') break;
    i++;
    let s = '';
    let completed = false;
    while (i < text.length) {
      const c = text[i];
      if (c === '\\' && i + 1 < text.length) {
        const nx = text[i + 1];
        s += nx === 'n' ? '\n' : nx === 't' ? '\t' : nx === '"' ? '"' : nx === '\\' ? '\\' : nx;
        i += 2;
      } else if (c === '"') { completed = true; i++; break; }
      else { s += c; i++; }
    }
    if (completed) items.push(s);
    else break;
  }
  return items;
}

function extractStringField(text: string, key: string): { value: string; complete: boolean } {
  const m = text.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)("?)`));
  if (!m) return { value: '', complete: false };
  return { value: unescapeJsonString(m[1]), complete: m[2] === '"' };
}

function countArrayItems(text: string, key: string): number {
  // Count opening { or " inside the array for this key — approximates how many
  // items have started (complete or not) without parsing fully.
  const m = text.match(new RegExp(`"${key}"\\s*:\\s*\\[`));
  if (!m || m.index === undefined) return 0;
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  let items = 0;
  let inString = false;
  let prevWasComma = true; // start of array counts as position-for-item
  while (i < text.length && depth > 0) {
    const c = text[i];
    if (inString) {
      if (c === '\\' && i + 1 < text.length) { i += 2; continue; }
      if (c === '"') inString = false;
      i++;
      continue;
    }
    if (c === '"') {
      inString = true;
      if (depth === 1 && prevWasComma) { items++; prevWasComma = false; }
      i++;
      continue;
    }
    if (c === '{') {
      if (depth === 1 && prevWasComma) { items++; prevWasComma = false; }
      depth++;
      i++;
      continue;
    }
    if (c === '}') { depth--; i++; continue; }
    if (c === '[') { depth++; i++; continue; }
    if (c === ']') { depth--; i++; continue; }
    if (c === ',' && depth === 1) { prevWasComma = true; i++; continue; }
    i++;
  }
  return items;
}

/** Premise candidates stream as objects; the screen only ever shows their text.
 *  Pull out each COMPLETE "text": "…" so a half-written one never flickers. */
function extractCandidateTexts(text: string): string[] {
  const start = text.indexOf('"premise_candidates"');
  if (start < 0) return [];
  const out: string[] = [];
  const re = new RegExp('"text"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"', 'g');
  re.lastIndex = start;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    try { out.push(JSON.parse(`"${m[1]}"`)); } catch { /* not yet closed */ }
  }
  return out;
}

export function parsePartialAnalysis(text: string): PartialAnalysis {
  const rq = extractStringField(text, 'real_question');
  const insight = extractStringField(text, 'insight');
  // The v2 harness emits premise_candidates (objects) and a permanently empty
  // skeleton. Reading only the old key names meant the whole first analysis
  // streamed with nothing visible while premises were actually arriving.
  const legacyAssumptions = extractCompleteStrings(text, 'hidden_assumptions');
  const hidden_assumptions = legacyAssumptions.length > 0
    ? legacyAssumptions
    : extractCandidateTexts(text);
  const skeleton = extractCompleteStrings(text, 'skeleton');
  let stage: PartialStage = 'reading';
  // Not the skeleton key: it is always present and always empty now, so it
  // fired instantly and pinned the label to the last stage from the first byte.
  if (text.includes('"next_question"')) stage = 'skeleton';
  else if (hidden_assumptions.length > 0 || text.includes('"premise_candidates"')) stage = 'assumptions';
  else if (rq.value) stage = 'question';
  return {
    real_question: rq.value,
    real_question_complete: rq.complete,
    hidden_assumptions,
    skeleton,
    stage,
    request_type: extractStringField(text, 'request_type').value,
    insight: insight.value,
    insight_complete: insight.complete,
  };
}

/* ─── Shared doc snippet for Mix / Final responses ─── */
export interface PartialDoc {
  title: string;
  executive_summary: string;
  summary_complete: boolean;
  sections_count: number;
}
export function parsePartialDoc(text: string): PartialDoc {
  const title = extractStringField(text, 'title');
  const summary = extractStringField(text, 'executive_summary');
  return {
    title: title.value,
    executive_summary: summary.value,
    summary_complete: summary.complete,
    sections_count: countArrayItems(text, 'sections'),
  };
}

/* ─── Salvage a truncated mix/final document (graceful degrade) ───
 *
 * When the streamed document JSON is cut off mid-structure and BOTH the parse and
 * the corrective retry fail, we still have the text that DID stream — usually a
 * title, summary, and several complete sections, with only the last section
 * partial. Recovering those beats throwing the whole draft away after minutes of
 * streaming. Drops the trailing incomplete section; keeps every complete one. */

/** Walk `"key": [ {...}, {...}, ... ]` and return every COMPLETE `{...}` object
 *  (JSON.parse'd). Stops at the first incomplete/truncated object. */
function extractCompleteObjects(text: string, key: string): Record<string, unknown>[] {
  const m = text.match(new RegExp(`"${key}"\\s*:\\s*\\[`));
  if (!m || m.index === undefined) return [];
  const out: Record<string, unknown>[] = [];
  let i = m.index + m[0].length;
  while (i < text.length) {
    while (i < text.length && /[\s,]/.test(text[i])) i++;   // skip whitespace / commas
    if (i >= text.length || text[i] === ']') break;
    if (text[i] !== '{') break;
    // Collect one balanced object, respecting strings and escapes.
    let depth = 0, inStr = false, esc = false;
    const start = i;
    for (; i < text.length; i++) {
      const c = text[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    if (depth !== 0) break; // trailing object was truncated → stop here
    try {
      const o = JSON.parse(text.slice(start, i));
      if (o && typeof o === 'object') out.push(o as Record<string, unknown>);
    } catch { break; }
  }
  return out;
}

export interface SalvagedDoc {
  title: string;
  executive_summary: string;
  sections: Array<{ heading?: string; content?: string; contributors?: string[]; sentences?: unknown[] }>;
  key_assumptions: string[];
  next_steps: string[];
}

/** Recover a usable document from truncated mix/final JSON, or null if there's
 *  nothing worth keeping (no title and no complete section). */
export function salvageMixDoc(text: string): SalvagedDoc | null {
  if (!text || text.length < 20) return null;
  const title = extractStringField(text, 'title').value;
  const summary = extractStringField(text, 'executive_summary');
  const sections = extractCompleteObjects(text, 'sections')
    .filter(o => typeof o.heading === 'string' || typeof o.content === 'string') as SalvagedDoc['sections'];
  if (!title && sections.length === 0) return null;
  return {
    title,
    executive_summary: summary.value,
    sections,
    key_assumptions: extractCompleteStrings(text, 'key_assumptions'),
    next_steps: extractCompleteStrings(text, 'next_steps'),
  };
}

/* ─── Shared feedback snippet for DMFeedback responses ─── */
export interface PartialFeedback {
  first_reaction: string;
  reaction_complete: boolean;
  concerns_count: number;
  good_parts_count: number;
}
export function parsePartialFeedback(text: string): PartialFeedback {
  const fr = extractStringField(text, 'first_reaction');
  return {
    first_reaction: fr.value,
    reaction_complete: fr.complete,
    concerns_count: countArrayItems(text, 'concerns'),
    good_parts_count: countArrayItems(text, 'good_parts'),
  };
}
