import os from 'os';
import path from 'path';
import fs from 'fs';
import { afterAll } from 'vitest';
import type { McpToolResult } from './lib/envelope.js';

let counter = 0;
// Keep a worker's fixtures under one disposable root. The previous helper put
// every fixture directly in os.tmpdir() and never removed it; repeated verify
// and mutation runs left tens of thousands of directories behind until Windows
// reported ENOSPC and unrelated gates failed in a cascade.
const workerRoot = fs.mkdtempSync(path.join(os.tmpdir(), `argus-test-${process.pid}-`));
process.once('exit', () => {
  try {
    fs.rmSync(workerRoot, { recursive: true, force: true });
  } catch {
    // Process shutdown must not hide the test result. A later temp cleanup can
    // remove a fixture still held by an abruptly terminated child.
  }
});
afterAll(() => {
  fs.rmSync(workerRoot, { recursive: true, force: true });
});

/** Create a fresh, isolated .argus directory for a test. */
export function tmpArgusDir(): string {
  counter += 1;
  const dir = path.join(workerRoot, `${counter}-${Math.floor(performance.now())}`, '.argus');
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
