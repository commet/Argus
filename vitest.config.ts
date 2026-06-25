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
    exclude: [...configDefaults.exclude, 'argus-plugin-v2/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
