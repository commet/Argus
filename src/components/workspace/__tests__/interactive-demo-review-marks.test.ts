import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../InteractiveDemo.tsx', import.meta.url), 'utf8');

describe('InteractiveDemo review marks', () => {
  it('uses one quiet functional mark instead of persona emoji avatars', () => {
    expect(source).toContain('function ReviewMark');
    expect(source).toContain('<ScanSearch');
    expect(source).not.toContain('{worker.persona.emoji}');
    expect(source).not.toContain('{thirdWorker.persona.emoji}');
    expect(source).not.toContain('{effectiveThirdWorker.persona.emoji}');
  });
});
