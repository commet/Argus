import os from 'os';
import path from 'path';
import fs from 'fs';
import type { McpToolResult } from './lib/envelope.js';

let counter = 0;

/** Create a fresh, isolated .argus directory for a test. */
export function tmpArgusDir(): string {
  counter += 1;
  const dir = path.join(os.tmpdir(), `argus-test-${process.pid}-${counter}-${Math.floor(performance.now())}`, '.argus');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Pull the parsed envelope/error object out of a tool result. */
export function body(result: McpToolResult): Record<string, unknown> {
  if (result.structuredContent) return result.structuredContent;
  return JSON.parse(result.content[0].text) as Record<string, unknown>;
}

export function isError(result: McpToolResult): boolean {
  return result.isError === true;
}
