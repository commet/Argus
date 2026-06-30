import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Guard against the nested-worktree false-failure (other branches' copies under .claude).
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
  },
});
