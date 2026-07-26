import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const projectRecord = [
  'src/components/projects/SemanticDecisionCard.tsx',
  'src/components/projects/DecisionContractCard.tsx',
].map((file) => readFileSync(join(ROOT, file), 'utf8')).join('\n');

describe('project follow-up language contract', () => {
  it('keeps wire-format jargon out of the Korean and English UI', () => {
    for (const leakedTerm of [
      'Canonical decision record',
      'Start canonical decision record',
      '정본 판단 기록',
      '판단을 정본 기록',
      'Judgment sealed',
      'Return promised',
      "L('관찰 기록'",
      "L('답의 종류'",
    ]) {
      expect(projectRecord).not.toContain(leakedTerm);
    }
  });

  it('uses the same plain return vocabulary in both locales', () => {
    expect(projectRecord).toContain("L('돌아올 기록', 'Return record')");
    expect(projectRecord).toContain("L('근거 추가', 'Add evidence')");
    expect(projectRecord).toContain("L('돌아온 답을 확인했어요', 'Your return is saved')");
  });
});
