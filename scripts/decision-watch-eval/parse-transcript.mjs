#!/usr/bin/env node
/**
 * Claude Code JSONL transcript → conversation digest segments.
 *
 * Extracts the human-visible conversation (user prompts + assistant text),
 * skipping tool results, sidechains (subagent traffic), hooks, and meta entries.
 * Chunks into segments suitable for decision-moment detection.
 *
 * Usage:
 *   node parse-transcript.mjs <transcript.jsonl> [--out <dir>] [--max-seg-chars N]
 *
 * Output: <out>/<sessionId>-seg-<NNN>.md  (one digest segment per file)
 * Privacy: output contains personal conversation data — keep gitignored.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const file = args[0];
// --out is REQUIRED: output contains personal conversation data and must land
// in a gitignored directory, never the cwd (this repo is public).
if (!file || !args.includes('--out')) {
  console.error('usage: parse-transcript.mjs <transcript.jsonl> --out <gitignored-dir> [--max-seg-chars N]');
  process.exit(1);
}
const outDir = args[args.indexOf('--out') + 1];
const MAX_SEG = Number(args.includes('--max-seg-chars') ? args[args.indexOf('--max-seg-chars') + 1] : 9000);
const ASSISTANT_SNIPPET = 700; // chars kept per assistant message

fs.mkdirSync(outDir, { recursive: true });

const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
const turns = [];
let sessionId = path.basename(file, '.jsonl');

for (const line of lines) {
  let e;
  try { e = JSON.parse(line); } catch { continue; }
  if (e.sessionId) sessionId = e.sessionId;
  if (e.isSidechain) continue;            // subagent traffic
  if (e.type === 'attachment' || e.isMeta) continue;

  if (e.type === 'user' && e.message) {
    const c = e.message.content;
    let text = '';
    if (typeof c === 'string') text = c;
    else if (Array.isArray(c)) {
      text = c.filter(p => p.type === 'text').map(p => p.text).join('\n');
      if (!text && c.some(p => p.type === 'tool_result')) continue; // pure tool result
    }
    text = text.trim();
    if (!text) continue;
    // skip harness-injected user content
    if (/^<(local-command-caveat|command-name|system-reminder)/.test(text)) continue;
    if (/^Caveat: The messages below/.test(text)) continue;
    turns.push({ role: 'USER', ts: e.timestamp, branch: e.gitBranch, text });
  } else if (e.type === 'assistant' && e.message) {
    const c = e.message.content;
    if (!Array.isArray(c)) continue;
    const text = c.filter(p => p.type === 'text').map(p => p.text).join('\n').trim();
    if (!text) continue;
    const clipped = text.length > ASSISTANT_SNIPPET
      ? text.slice(0, ASSISTANT_SNIPPET) + ` …[+${text.length - ASSISTANT_SNIPPET} chars]`
      : text;
    turns.push({ role: 'ASSISTANT', ts: e.timestamp, branch: e.gitBranch, text: clipped });
  }
}

// merge consecutive assistant turns (streamed messages arrive as multiple entries)
const merged = [];
for (const t of turns) {
  const prev = merged[merged.length - 1];
  if (prev && prev.role === 'ASSISTANT' && t.role === 'ASSISTANT') {
    if (prev.text.length < 2 * ASSISTANT_SNIPPET) prev.text += '\n' + t.text;
  } else merged.push({ ...t });
}

// chunk into segments, breaking at USER turns when possible
const segments = [];
let cur = [];
let curLen = 0;
for (const t of merged) {
  const len = t.text.length + 30;
  if (curLen + len > MAX_SEG && cur.length > 0 && t.role === 'USER') {
    segments.push(cur); cur = []; curLen = 0;
  }
  cur.push(t); curLen += len;
}
if (cur.length) segments.push(cur);

let written = 0;
segments.forEach((seg, i) => {
  const userTurns = seg.filter(t => t.role === 'USER').length;
  if (userTurns === 0) return; // no human content, useless for decision detection
  const head = [
    `# Segment ${String(i + 1).padStart(3, '0')} / session ${sessionId}`,
    `- time: ${seg[0].ts ?? '?'} → ${seg[seg.length - 1].ts ?? '?'}`,
    `- branch: ${seg[0].branch ?? '?'}`,
    `- turns: ${seg.length} (user: ${userTurns})`,
    '',
  ].join('\n');
  const body = seg.map(t => `**[${t.role}${t.ts ? ' ' + t.ts.slice(5, 16) : ''}]** ${t.text}`).join('\n\n');
  const name = `${sessionId.slice(0, 8)}-seg-${String(i + 1).padStart(3, '0')}.md`;
  fs.writeFileSync(path.join(outDir, name), head + body + '\n');
  written++;
});

console.log(JSON.stringify({ session: sessionId, rawLines: lines.length, turns: merged.length, segments: written }));
