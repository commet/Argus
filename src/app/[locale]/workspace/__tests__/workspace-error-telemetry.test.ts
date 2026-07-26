import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('workspace failure telemetry', () => {
  const source = readFileSync(resolve('src/app/[locale]/workspace/page.tsx'), 'utf8');

  it('keeps provider error text in the UI but out of analytics storage', () => {
    expect(source).toContain('setError(errMsg');
    expect(source).toContain("? 'login_required'");
    expect(source).toContain("? 'service_unavailable'");
    expect(source).not.toContain("track('workspace_start_error', { error: errMsg");
  });
});
