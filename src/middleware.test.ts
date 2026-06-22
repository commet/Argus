import { describe, it, expect } from 'vitest';
import { isPublicPath } from './lib/public-paths';

/**
 * Tests for route-access classification.
 * Verifies PUBLIC_PATHS stays aligned with the soft-wall policy in LayoutShell.
 */

describe('public path classification', () => {
  // Public routes — should NOT require auth
  it.each([
    '/',
    '/login',
    '/auth/callback',
    '/guide',
    '/guide/getting-started',
    '/workspace',
    '/boss',
    '/settings',
    '/privacy',
    '/terms',
    // /project is public so the anon cohort that SEALED a decision can reach
    // their promised return (seal + .ics point here). See public-paths.ts.
    '/project',
    '/api/llm',
    '/api/llm/direct',
    '/_next/static/chunk.js',
    '/favicon.ico',
  ])('"%s" is public', (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  // Protected routes — should require auth
  it.each([
    '/agents',
    '/teams',
    '/voyage-preview', // removed temporary QA route — must never silently return to PUBLIC_PATHS
    '/tools/reframe',
    '/tools/recast',
    '/tools/rehearse',
    '/tools/refine',
    '/tools/synthesize',
  ])('"%s" is protected', (path) => {
    expect(isPublicPath(path)).toBe(false);
  });

  // Edge cases
  it('"/login-admin" is not matched as public (not an exact match or subpath)', () => {
    expect(isPublicPath('/login-admin')).toBe(false);
  });

  it('"/guidepost" is not matched as public', () => {
    expect(isPublicPath('/guidepost')).toBe(false);
  });
});
