/**
 * 공정 M4 exit — /import에 Windows 블록 렌더 테스트 (BLUEPRINT §9.5).
 * The web finally carries the OS doors the README fixed in M0: zero-config
 * ~/.argus, Desktop's unexpanded ${...}, and the Windows cmd /c launch form.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { McpInstallGuide } from '../McpInstallGuide';

describe('McpInstallGuide', () => {
  it('ko: renders install command, ~/.argus default, Desktop ${...} warning, and the Windows cmd /c block', () => {
    const html = renderToStaticMarkup(<McpInstallGuide locale="ko" />);
    expect(html).toContain('claude mcp add argus -- npx -y argus-decision-mcp');
    expect(html).toContain('~/.argus');
    expect(html).toContain('${...}');
    expect(html).toContain('&quot;command&quot;: &quot;cmd&quot;');
    expect(html).toContain('ARGUS_TOKEN');
    expect(html).toContain('로컬로만 동작');
  });

  it('en: same doors in English', () => {
    const html = renderToStaticMarkup(<McpInstallGuide locale="en" />);
    expect(html).toContain('On Windows');
    expect(html).toContain('does not expand');
    expect(html).toContain('fully local');
  });

  /**
   * The hand-copied install command must ask for @latest — never a bare name and
   * never a range. npx reuses a cached install, so a sticky spec can serve an old
   * build for weeks: exactly the failure that froze a dogfood wire on 1.2.0 while
   * seven releases sat published on npm (2026-07-26). This is the mirror of the
   * bundled plugin's EXACT pin (that one ships a tested pair and is guarded by
   * argus-mcp/src/v2/one-install.test.ts) — opposite mechanism, same invariant:
   * the version a user ends up running must never be decided by a stale cache.
   *
   * What makes this red: the guide drops `@latest`, or pins `@^1`/`@~1`/a literal
   * version that will silently rot as releases land.
   */
  it('install commands ask for @latest, never a bare or range spec', () => {
    for (const locale of ['ko', 'en']) {
      const html = renderToStaticMarkup(<McpInstallGuide locale={locale} />);
      const specs = [...html.matchAll(/argus-decision-mcp(@[\w.^~*-]+)?/g)].map((m) => m[1] ?? '');
      expect(specs.length, `${locale}: install command missing`).toBeGreaterThan(0);
      for (const spec of specs) {
        expect(spec, `${locale}: "${spec || '(bare)'}" can be served from a stale npx cache`).toBe('@latest');
      }
    }
  });
});
