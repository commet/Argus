import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // The plugin (argus-plugin-v2) ships its own standalone Node test harness
    // (run directly + in CI). Its *.test.mjs files call process.exit and are not
    // vitest suites, so keep vitest's discovery to the webapp only.
    // .claude/worktrees/** are isolated git worktrees with their own (often
    // stale) node_modules — a duplicate React there throws "useState of null"
    // and would fail the gate on code that isn't even on this branch.
    exclude: [...configDefaults.exclude, 'argus-plugin-v2/**', '**/.claude/worktrees/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
