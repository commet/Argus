import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
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
