import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Guard against the nested-worktree false-failure (other branches' copies under .claude).
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
    // Points the account API at a closed local port, so a test that sets
    // ARGUS_TOKEN and forgets to mock fetch cannot reach the real server.
    setupFiles: ['src/test-setup.ts'],
  },
});
