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
 * them (measured 2026-07-29). Verify eventually dies on a full disk with no
 * stack, and — worse — a self-test that dies mid-plant leaves the regression it
 * planted sitting in the source tree.
 *
 * `ARGUS_TEST_RUN_ID` keeps concurrent runs (verify spawns a whole suite per
 * mutation) from sharing a name; the retries cover a fixture a just-exited child
 * still holds on Windows. Removal is best-effort in both hooks: a cleanup
 * failure must never overwrite the actual test verdict.
 */
const testRunId = process.env['ARGUS_TEST_RUN_ID'] ?? `standalone-${process.pid}`;
const workerRoot = fs.mkdtempSync(path.join(os.tmpdir(), `argus-test-${testRunId}-worker-${process.pid}-`));
function sweep(): void {
  try {
    fs.rmSync(workerRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  } catch { /* keep the verdict */ }
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

/**
 * **앞으로의 날짜는 언제나 오늘로부터 센다.**
 *
 * `check_by` 는 봉인 시점의 **실제 시계**와 대조된다. 그래서 "미래"라고 적어
 * 둔 글자는 그 날이 지나는 순간 과거가 되고, 봉인이 **정당하게** 거절하면서
 * 시험이 빨간불이 된다 — 코드는 한 줄도 안 바뀐 채로.
 *
 * 2026-09 에 `evals/e2e-picker.mjs` 가 그렇게 무너졌고, 게이트는 "픽커 실발사
 * 실패"라고 **틀린 곳을 가리켰다**. 18일 걸렸다. 그 파일은 2026-08 에 이미
 * "Never pin this to a calendar date" 라고 적어 뒀는데도 한 자리만 고치고
 * 둘을 남겨 뒀다 — **교훈을 적는 것으로는 부족하고 쓰는 자리를 하나로 모아야
 * 반쪽 적용이 안 난다.** 그래서 이 헬퍼가 여기 하나만 있다.
 *
 * 남은 자리는 `npm run test:future` 가 찾는다 — 달력을 밀어 놓고 같은 스위트를
 * 돌리므로 글자를 훑는 검사와 달리 **놓치지도, 헛짚지도 않는다.**
 */
export const inDays = (n: number): string =>
  new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
