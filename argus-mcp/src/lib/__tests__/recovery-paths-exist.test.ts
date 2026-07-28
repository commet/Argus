import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOLS } from '../../tools/index.js';

/**
 * A recovery line must never point at something that does not exist.
 *
 * I nearly shipped one on 2026-07-28: the new CONNECTION_EXPIRED copy told the
 * user to run `argus_settings action="connect"`. There is no `connect` action —
 * connecting is a CLI command (`npx argus-decision-mcp connect`). A user
 * following that sentence lands on INVALID_INPUT, which is the exact dead end
 * this whole audit was about, introduced by the fix FOR that class of dead end.
 *
 * So: every tool name and every `action="…"` that appears in shipped copy is
 * checked against what the server actually exposes. Derived, never hard-coded —
 * a copied list is the drift one layer up.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', '..');

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue;
      sourceFiles(p, out);
    } else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) {
      out.push(p);
    }
  }
  return out;
}

/** Every action literal each tool's schema actually accepts. */
function actionsFor(toolName: string): Set<string> {
  const tool = TOOLS.find((t) => t.name === toolName);
  if (!tool) return new Set();
  // The schemas are zod; read the JSON Schema the server publishes instead of
  // reaching into zod internals, so this sees exactly what a host sees.
  const json = JSON.stringify(tool.inputSchema);
  const found = new Set<string>();
  for (const m of json.matchAll(/"const":"([a-z_]+)"/g)) found.add(m[1]);
  for (const m of json.matchAll(/"enum":\["([^"]*(?:","[^"]*)*)"\]/g)) {
    for (const v of m[1].split('","')) found.add(v);
  }
  return found;
}

const files = sourceFiles(SRC);
const toolNames = new Set(TOOLS.map((t) => t.name));
/** `argus_*` identifiers that are NOT tools: parameters, env vars, token
 *  prefixes. Listed explicitly so a genuinely stale tool name can never hide
 *  behind a loose pattern. */
const NOT_TOOLS = new Set(['argus_dir']);

describe('복구 안내는 실재하는 것만 가리킨다', () => {
  it('안내문이 부르는 도구 이름은 전부 실제로 노출된다', () => {
    const bad: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      // Only lines that are user/model-facing guidance, not comments or code.
      for (const line of text.split('\n')) {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
        if (!/recovery|message|surface/.test(line)) continue;
        for (const m of line.matchAll(/\bargus_[a-z_]+\b/g)) {
          const name = m[0];
          // Internal module names appear in code paths (tool: 'argus_settle');
          // only flag names inside guidance prose, i.e. followed by a space or
          // punctuation that is not a quote-close of a `tool:` field.
          if (toolNames.has(name) || NOT_TOOLS.has(name)) continue;
          if (/tool:\s*'/.test(line)) continue;
          bad.push(`${path.relative(SRC, file)}: ${name}`);
        }
      }
    }
    expect(bad, '안내문이 노출되지 않는 도구 이름을 부른다').toEqual([]);
  });

  it('안내문이 부르는 action 값은 그 도구가 실제로 받는다', () => {
    const bad: string[] = [];
    for (const file of files) {
      const text = fs.readFileSync(file, 'utf8');
      for (const line of text.split('\n')) {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
        for (const m of line.matchAll(/(argus_[a-z_]+)\s+action=["']?([a-z_]+)["']?/g)) {
          const [, tool, action] = m;
          if (!toolNames.has(tool)) { bad.push(`${path.relative(SRC, file)}: ${tool} is not a tool`); continue; }
          const allowed = actionsFor(tool);
          if (allowed.size === 0) continue; // the tool takes no action field
          if (!allowed.has(action)) {
            bad.push(`${path.relative(SRC, file)}: ${tool} action="${action}" (허용: ${[...allowed].sort().join(' · ')})`);
          }
        }
      }
    }
    expect(bad, '없는 action을 안내하면 사용자는 INVALID_INPUT에 도착한다').toEqual([]);
  });
});
