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
  },
});
