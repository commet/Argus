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
});
