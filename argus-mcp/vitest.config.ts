import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // spikes/ = P0 스파이크 산출물 — npm 배송(files)·tsc build 대상이 아니고
    // vitest만 실행한다 (argus-mcp/spikes/p0/README.md 참조).
    include: ['src/**/*.test.ts', 'spikes/**/*.test.ts'],
    // Guard against the nested-worktree false-failure (other branches' copies under .claude).
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
    // Points the account API at a closed local port, so a test that sets
    // ARGUS_TOKEN and forgets to mock fetch cannot reach the real server.
    setupFiles: ['src/test-setup.ts'],
    // The protocol suite intentionally rebuilds dist and several durability
    // properties perform real filesystem I/O. Windows CI and busy developer
    // machines can exceed Vitest's 5s/30s defaults without being hung.
    testTimeout: 20_000,
    hookTimeout: 120_000,
    // Keep full-suite runs deterministic on Windows, where the protocol and
    // durability suites can otherwise exhaust worker-process resources.
    maxWorkers: 2,
  },
});
