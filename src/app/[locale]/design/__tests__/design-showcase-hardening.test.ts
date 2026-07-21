import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const designRoot = join(__dirname, '..');
const read = (path: string) => readFileSync(join(designRoot, path), 'utf8');

describe('internal design showcases', () => {
  it('are unavailable to production visitors and search crawlers', () => {
    const layout = read('layout.tsx');
    expect(layout).toContain("process.env.NODE_ENV === 'production'");
    expect(layout).toContain('notFound()');
    expect(layout).toContain('index: false');
    expect(layout).toContain('follow: false');
  });

  it('lets foundry grids shrink within a narrow container', () => {
    const foundry = read('foundry/page.tsx');
    expect(foundry.match(/minmax\(min\([0-9]+px,100%\),1fr\)/g)).toHaveLength(4);
    expect(foundry).toContain('flex: 1, minWidth: 0');
  });

  it('contains the fixed chart in a keyboard-scrollable region', () => {
    const workspace = read('workspace/page.tsx');
    expect(workspace).toContain('className="ds-chart-scroll"');
    expect(workspace).toContain('role="region"');
    expect(workspace).toContain('tabIndex={0}');
    expect(workspace).toContain("overflowX: 'auto'");
    expect(workspace).toContain("overscrollBehaviorInline: 'contain'");
  });
});
