/**
 * Claude Code JSONL transcript → human-visible conversation digest segments.
 * Shared by `argus-watch scan` and the backtest pipeline.
 * Privacy: outputs contain personal conversation data — keep out of git.
 */
import fs from 'node:fs';
import path from 'node:path';

const ASSISTANT_SNIPPET = 700;

/** Parse one JSONL transcript into merged conversation turns. */
export function parseTranscript(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
  const turns = [];
  let sessionId = path.basename(file, '.jsonl');

  for (const line of lines) {
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e.sessionId) sessionId = e.sessionId;
    if (e.isSidechain) continue;
    if (e.type === 'attachment' || e.isMeta) continue;

    if (e.type === 'user' && e.message) {
      const c = e.message.content;
      let text = '';
      if (typeof c === 'string') text = c;
      else if (Array.isArray(c)) {
        text = c.filter(p => p.type === 'text').map(p => p.text).join('\n');
        if (!text && c.some(p => p.type === 'tool_result')) continue;
      }
      text = text.trim();
      if (!text) continue;
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

  const merged = [];
  for (const t of turns) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === 'ASSISTANT' && t.role === 'ASSISTANT') {
      if (prev.text.length < 2 * ASSISTANT_SNIPPET) prev.text += '\n' + t.text;
    } else merged.push({ ...t });
  }
  return { sessionId, turns: merged, rawLines: lines.length };
}

/** Chunk turns into segments (~maxChars), breaking at USER turns. */
export function segmentTurns(turns, maxChars = 9000) {
  const segments = [];
  let cur = [], curLen = 0;
  for (const t of turns) {
    const len = t.text.length + 30;
    if (curLen + len > maxChars && cur.length > 0 && t.role === 'USER') {
      segments.push(cur); cur = []; curLen = 0;
    }
    cur.push(t); curLen += len;
  }
  if (cur.length) segments.push(cur);
  return segments.filter(seg => seg.some(t => t.role === 'USER'));
}

/** Render a segment as the digest text fed to the detector. */
export function renderSegment(seg) {
  return seg.map(t => `**[${t.role}${t.ts ? ' ' + t.ts.slice(0, 16) : ''}]** ${t.text}`).join('\n\n');
}

/** Discover Claude Code transcript files for a project dir (or all projects). */
export function discoverTranscripts({ all = false, projectDir = process.cwd() } = {}) {
  const root = path.join(process.env.HOME, '.claude', 'projects');
  if (!fs.existsSync(root)) return [];
  const dirs = all
    ? fs.readdirSync(root).map(d => path.join(root, d))
    : [path.join(root, projectDir.replace(/[/.]/g, '-'))];
  const files = [];
  for (const d of dirs) {
    if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d)) {
      if (f.endsWith('.jsonl')) {
        const full = path.join(d, f);
        files.push({ file: full, project: path.basename(d), mtime: fs.statSync(full).mtimeMs, size: fs.statSync(full).size });
      }
    }
  }
  return files.sort((a, b) => a.mtime - b.mtime);
}
