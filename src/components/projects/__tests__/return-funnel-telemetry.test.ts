import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const modal = readFileSync(new URL('../SettlementModal.tsx', import.meta.url), 'utf8');

describe('return funnel telemetry', () => {
  it('connects a checkpoint answer or deferral to the project without recording prose', () => {
    expect(modal).toContain("track('return_answered'");
    expect(modal).toContain("track('return_deferred'");
    expect(modal).toContain('project_id: project.id');
    expect(modal).toContain('primary_checkpoint: isPrimaryCheckpoint');
    expect(modal).not.toContain('what_happened: whatHappened');
  });
});
