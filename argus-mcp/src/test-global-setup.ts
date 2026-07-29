import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Give every Vitest invocation an ownership token and remove only that run's
 * temp roots after all worker processes have stopped.
 *
 * Per-file afterAll hooks remain the fast path. This controller-level sweep is
 * the Windows fail-safe for workers that exit while antivirus/indexing still
 * holds a newly created directory. A random prefix prevents one concurrent
 * Argus test run from deleting another run's fixtures.
 */
export default function setup(): () => void {
  const runId = `${process.pid}-${randomUUID()}`;
  const prefix = `argus-test-${runId}-`;
  process.env['ARGUS_TEST_RUN_ID'] = runId;

  return () => {
    const tempRoot = path.resolve(os.tmpdir());
    for (const entry of fs.readdirSync(tempRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue;
      const target = path.resolve(tempRoot, entry.name);
      if (path.dirname(target) !== tempRoot) continue;
      fs.rmSync(target, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 50,
      });
    }
    delete process.env['ARGUS_TEST_RUN_ID'];
  };
}
