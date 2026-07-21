import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sources = [
  join(__dirname, '..', '..', 'review', 'ReceiptList.tsx'),
  join(__dirname, '..', '..', 'workspace', 'RehearseStep.tsx'),
  join(__dirname, '..', '..', 'projects', 'DecisionContractCard.tsx'),
  join(__dirname, '..', '..', '..', 'hooks', 'useLocaleSwitch.ts'),
].map((path) => readFileSync(path, 'utf8'));

describe('destructive confirmation contract', () => {
  it('does not fall back to browser-native confirmation dialogs', () => {
    for (const source of sources) {
      expect(source).not.toMatch(/(?:window\.)?confirm\s*\(/);
    }
  });

  it('routes every destructive surface through the app confirmation dialog', () => {
    for (const source of sources.slice(0, 3)) {
      expect(source).toContain('ConfirmDialog');
    }
    expect(sources[3]).toContain('pendingLocale');
  });
});
