import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const UI_FILES = [
  'src/components/review/ReviewFlow.tsx',
  'src/components/review/ReceiptView.tsx',
  'src/components/review/ReceiptList.tsx',
  'src/components/landing/voyage/Act2DecisionVoyage.tsx',
  'src/components/workspace/InteractiveDemo.tsx',
  'src/components/workspace/progressive/SealMoment.tsx',
  'src/components/projects/VoyageSea.tsx',
  'src/components/workspace/VoyageEta.tsx',
  'src/app/[locale]/project/page.tsx',
  'src/app/[locale]/import/page.tsx',
].map((file) => readFileSync(join(ROOT, file), 'utf8')).join('\n');

describe('plain product-language contract', () => {
  it('does not expose internal lifecycle metaphors through localized UI copy', () => {
    expect(UI_FILES).not.toMatch(/L\(\s*['"`]([^'"`]*(?:판단 영수증|봉인|정산|정본|해도에서|도착 예정))/);
    expect(UI_FILES).not.toContain('\n            Judgment Receipt\n');
  });

  it('keeps the main record and follow-up terms explicit', () => {
    expect(UI_FILES).toContain("L('문서 검수 기록', 'Document Review Record')");
    expect(UI_FILES).toContain("L('판단과 확인일 기록', 'Save decision and review date')");
    expect(UI_FILES).toContain("L('실제 결과 기록', 'Record actual outcome')");
    expect(UI_FILES).toContain("L('파일 지원 범위', 'File support')");
  });
});
