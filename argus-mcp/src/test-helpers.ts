import os from 'os';
import path from 'path';
import fs from 'fs';
import { afterAll } from 'vitest';
import type { McpToolResult } from './lib/envelope.js';

let counter = 0;

/**
 * One disposable root per worker, removed when the worker finishes.
 *
 * Every fixture used to be created straight in os.tmpdir() and never removed.
 * One `vitest run` leaves 386 directories behind; a machine that had been
 * running verify and its mutation self-tests for a while was holding 28,203 of
 * them (measured 2026-07-29). Verify eventually died on a full disk with no
 * stack, and — worse — a self-test that dies mid-plant leaves the regression it
 * planted sitting in the source tree.
 *
 * Removal is best-effort in both hooks: a fixture can still be held by a child
 * that was terminated abruptly, and a cleanup failure must never overwrite the
 * actual test verdict.
 */
const workerRoot = fs.mkdtempSync(path.join(os.tmpdir(), `argus-test-${process.pid}-`));
function sweep(): void {
  try { fs.rmSync(workerRoot, { recursive: true, force: true }); } catch { /* keep the verdict */ }
}
process.once('exit', sweep);
afterAll(sweep);

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
