/**
 * Live Skill Quality Eval v2 — .argus/ 실제 출력물 채점
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  evaluateSkillOutput,
  evaluatePipelineChaining,
  buildBatchJudgePrompt,
  formatEvalReport,
  type SkillName,
} from '@/lib/skill-quality-eval';

const ARGUS_DIR = join(process.cwd(), '.argus');

function readIfExists(filename: string): string | undefined {
  const filepath = join(ARGUS_DIR, filename);
  return existsSync(filepath) ? readFileSync(filepath, 'utf-8') : undefined;
}

const files = {
  reframe: readIfExists('reframe.md'),
  recast: readIfExists('recast.md'),
  rehearse: readIfExists('rehearse.md'),
  refine: readIfExists('refine.md'),
};

/* ── Per-stage eval ── */

const stages: [SkillName, string | undefined][] = [
  ['reframe', files.reframe],
  ['recast', files.recast],
  ['rehearse', files.rehearse],
  ['refine', files.refine],
];

for (const [skill, output] of stages) {
  const block = output ? describe : describe.skip;

  block(`Live: /${skill}`, () => {
    // `.argus/` holds private local dev outputs and is intentionally not committed,
    // so in CI (clean checkout) `output` is undefined and this block is skipped.
    // Guard the eager eval so a skipped describe never runs it on undefined input.
    const result = output ? evaluateSkillOutput(skill, output) : null;

    it('structural 100%', () => {
      const report = formatEvalReport(result!);
      console.log(report);
      expect(result!.structural.every(s => s.passed)).toBe(true);
    });

    it('batch judge prompt 생성', () => {
      const prompt = buildBatchJudgePrompt(skill, output!);
      expect(prompt.length).toBeGreaterThan(200);
      // Print first section for manual review
      console.log(`\n--- /${skill} Judge (${result!.content_evals.length}개 기준) ---`);
      console.log(prompt.slice(0, 300) + '...');
    });
  });
}

/* ── Pipeline chaining ── */

const hasAll = Object.values(files).every(Boolean);
const chainBlock = hasAll ? describe : describe.skip;

chainBlock('Live: Pipeline Chaining', () => {
  // Skipped in CI when not all `.argus/` outputs exist — guard the eager call so
  // the skipped block never evaluates undefined inputs.
  const chaining = hasAll ? evaluatePipelineChaining(files as Record<string, string>) : [];

  it('결과 보고', () => {
    console.log(`\nPipeline: ${chaining.filter(e => e.passed).length}/${chaining.length}`);
    for (const e of chaining) {
      console.log(`  ${e.passed ? '✓' : '✗'} ${e.id}`);
    }
    expect(chaining).toBeDefined();
  });

  it('전체 통과', () => {
    const failures = chaining.filter(e => !e.passed);
    if (failures.length > 0) console.log('Failures:', failures.map(f => f.id));
    expect(failures.length).toBe(0);
  });
});
