import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', 'page.tsx'), 'utf8');

const deferredModules = [
  '@/components/workspace/ReframeStep',
  '@/components/workspace/RecastStep',
  '@/components/workspace/RehearseStep',
  '@/components/workspace/SynthesizeStep',
  '@/components/workspace/progressive/ProgressiveFlow',
  '@/components/workspace/InteractiveDemo',
  '@/components/workspace/RetroSeal',
];

describe('workspace route code splitting', () => {
  it('defers state-specific workspace surfaces', () => {
    for (const modulePath of deferredModules) {
      expect(source).not.toMatch(new RegExp(`import \\{[^;]+\\} from ['"]${modulePath}['"]`));
      expect(source).toContain(`import('${modulePath}')`);
    }
  });

  it('loads the analysis engine only after a user submits work', () => {
    expect(source).not.toContain("from '@/lib/progressive-engine'");
    expect(source).toContain("import('@/lib/progressive-engine')");
  });

  it('keeps the deferred loading state accessible and motion-safe', () => {
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('motion-reduce:animate-none');
  });
});
