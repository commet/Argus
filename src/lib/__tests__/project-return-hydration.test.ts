import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('project return hydration guard', () => {
  const source = fs.readFileSync(path.resolve('src/app/[locale]/project/page.tsx'), 'utf8');
  const flowSource = fs.readFileSync(path.resolve('src/components/workspace/progressive/ProgressiveFlow.tsx'), 'utf8');

  it('does not claim the project list is empty before local storage has loaded', () => {
    expect(source).toContain('const [storesLoaded, setStoresLoaded] = useState(false)');
    expect(source).toMatch(/!storesLoaded[\s\S]*projects\.length === 0 && fromCheckin/);
    expect(source).toContain("L('항해 기록을 불러오는 중이에요', 'Loading your voyages')");
  });

  it('names a completed document independently from the optional check-in loop', () => {
    expect(source).toContain("? L('문서 완료', 'Document ready')");
    expect(source).toContain('title={cardStatusLabel}');
  });

  it('does not force the optional stress test after stakeholder review', () => {
    expect(flowSource).toMatch(/<DMFeedback[\s\S]*onFinalize=\{onFinalize\}/);
    expect(flowSource).not.toMatch(/<DMFeedback[\s\S]*onFinalize=\{onTest\}[\s\S]*\/>/);
  });

  it('keeps the resumed final result below the fixed mobile header', () => {
    expect(flowSource).toContain('<div ref={finalRef} className="scroll-mt-20">');
  });
});
