import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Dummy Supabase env so modules that construct the client at import time
    // (lib/supabase.ts) don't throw during full-import-chain tests. No real
    // network call is made in unit tests.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    },
    // The plugin (argus-plugin-v2) ships its own standalone Node test harness
    // (run directly + in CI). Its *.test.mjs files call process.exit and are not
    // vitest suites, so keep vitest's discovery to the webapp only.
    // .claude/worktrees/** are isolated git worktrees with their own (often
    // stale) node_modules — a duplicate React there throws "useState of null"
    // and would fail the gate on code that isn't even on this branch.
    exclude: [...configDefaults.exclude, 'argus-plugin-v2/**', '**/.claude/worktrees/**'],
    coverage: {
      provider: 'v8',
      // text → console summary; json-summary → machine-readable for a future CI
      // ratchet; html → local drill-down. No global threshold yet: we start by
      // MEASURING (so coverage can't silently erode) and ratchet once a baseline
      // is agreed — see docs/TEST-COVERAGE-ANALYSIS.md (Gap 4).
      reporter: ['text', 'json-summary', 'html'],
      // The webapp is the coverage surface. argus-mcp / argus-plugin-v2 ship their
      // own standalone harnesses, and generated/asset-like modules would only
      // dilute the signal.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
        'src/**/*.d.ts',
        'src/lib/demo-data*.ts',        // large hardcoded fixture data
        'src/lib/agent-skills-data.ts', // generated/asset-like data
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
