import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // The full app suite is large enough that Vitest's CPU-count default can
    // exhaust Windows worker memory after all assertions have passed. Keep the
    // official gate deterministic locally and in CI.
    maxWorkers: 1,
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
    // argus-mcp is likewise a separate package with its OWN vitest config,
    // setupFiles (env/home isolation, API egress block), and dedicated CI step
    // ("Argus decision MCP package") — the root sweep was running its tests a
    // second time WITHOUT that setup, so the package's isolation canaries
    // correctly failed under the wrong runner (§9.7 O1 방1). One suite, one
    // runner, one setup.
    // .claude/worktrees/** are isolated git worktrees with their own (often
    // stale) node_modules — a duplicate React there throws "useState of null"
    // and would fail the gate on code that isn't even on this branch.
    exclude: [...configDefaults.exclude, 'argus-plugin-v2/**', 'argus-mcp/**', '**/.claude/worktrees/**'],
    coverage: {
      provider: 'v8',
      // text → console summary; json-summary → machine-readable ratchet; html →
      // local drill-down. See internal design notes (Gap 4).
      reporter: ['text', 'json-summary', 'html'],
      // RATCHET (not a target): a floor a few points below the measured baseline
      // (2026-07-07: lines 32.4 / stmts 31.4 / funcs 26.5 / branch 24.5). It only
      // prevents *erosion* — when new tests land, raise these numbers so the floor
      // follows coverage up. Deliberately NOT set near 80%: that would fail today
      // and pressure people to test trivia. The point is "can't go backwards".
      thresholds: {
        lines: 30,
        statements: 29,
        functions: 24,
        branches: 22,
      },
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
