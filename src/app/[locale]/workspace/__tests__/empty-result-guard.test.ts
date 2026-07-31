/**
 * The entry screen's empty-result guard, pinned as source (2026-07-31).
 *
 * This guard shipped broken to production for ~20 minutes: it read "no plan and
 * no premises" as a failed analysis, and the v2 judgment harness makes BOTH of
 * those legitimately empty — a conversation turn never writes a plan, and a
 * first turn with nothing grounded in the user's words honestly carries no
 * premise. Every open decision whose opening produced no premise died on
 * "분석에 실패했어요" while the model had in fact answered perfectly.
 *
 * The guard is inline in a large client component, so this test reads the
 * source and asserts the SHAPE of the condition: emptiness must be judged by
 * "is there something to show and something to continue with", never by the
 * length of the premise or plan arrays.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(process.cwd(), 'src/app/[locale]/workspace/page.tsx'),
  'utf8',
);
// The guard block: from its marker comment to the throw.
const guard = source.slice(source.indexOf('// ADD-4'), source.indexOf('분석 결과를 받지 못했어요'));

describe('entry-screen empty-result guard', () => {
  it('never treats an empty premise list or an empty plan as a failure', () => {
    expect(guard).not.toMatch(/hidden_assumptions\.length\s*===\s*0/);
    expect(guard).not.toMatch(/skeleton\.length\s*===\s*0/);
  });

  it('fails only when there is nothing to show and nothing to continue with', () => {
    expect(guard).toContain('real_question');
    expect(guard).toContain('insight');
    expect(guard).toContain('result.question');
  });

  it('keeps the crisis and non-open routes on the valid-terminal side', () => {
    expect(guard).toContain('crisis');
    expect(guard).toContain("request_type !== 'open'");
  });
});
