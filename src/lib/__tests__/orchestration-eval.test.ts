/**
 * orchestration-eval — decision-scenario eval for the lens/pattern redesign.
 *
 * Deterministic (no LLM): feeds realistic decisions through classifyInput →
 * planOrchestration and asserts the chosen collaboration pattern + verify depth.
 * This is the webapp analogue of the plugin's static-gate — it pins INTENT
 * (light questions stay light, heavy/biased ones get deep review) and guards
 * regressions. Actual LLM output quality (the +60% style A/B) needs live
 * dogfood + a judge and is tracked separately.
 */
import { describe, it, expect } from 'vitest';
import { classifyInput } from '../orchestrator-classify';
import { planOrchestration } from '../orchestration-pattern';
import type { InterviewSignals } from '../../stores/types';

interface Scenario {
  name: string;
  problem: string;
  workers: number;
  signals?: Partial<InterviewSignals>;
  leaning?: boolean;
  pattern: 'single' | 'parallel' | 'review_loop';
  verify: 'light' | 'standard' | 'deep';
}

const SCENARIOS: Scenario[] = [
  { name: 'trivial one-off', problem: '점심 메뉴 뭐 먹지', workers: 1, signals: { stakes: 'experiment' }, pattern: 'single', verify: 'light' },
  { name: 'light experiment, 2 angles', problem: '버튼 색 A/B 테스트', workers: 2, signals: { stakes: 'experiment' }, pattern: 'parallel', verify: 'light' },
  { name: 'normal plan', problem: '신규 기능 기획안', workers: 3, signals: { stakes: 'important' }, pattern: 'parallel', verify: 'standard' },
  { name: 'irreversible decision', problem: '회사 매각 결정', workers: 3, signals: { stakes: 'irreversible' }, pattern: 'review_loop', verify: 'deep' },
  { name: 'crisis (on_fire)', problem: '프로덕션 서버 장애 대응', workers: 3, signals: { nature: 'on_fire' }, pattern: 'review_loop', verify: 'deep' },
  { name: 'confirmation bias (already leaning)', problem: '이 후보 뽑기로 마음 굳혔어', workers: 3, signals: { stakes: 'important' }, leaning: true, pattern: 'review_loop', verify: 'deep' },
];

describe('orchestration eval — decisions route as intended', () => {
  for (const sc of SCENARIOS) {
    it(`${sc.name} → ${sc.pattern}/${sc.verify}`, () => {
      const steps = Array.from({ length: sc.workers }, () => ({ task: sc.problem, output: 'result' }));
      const cls = classifyInput(sc.problem, steps, sc.signals as InterviewSignals | undefined);
      const plan = planOrchestration(cls, sc.workers, { userLeaning: sc.leaning });
      expect(plan.pattern).toBe(sc.pattern);
      expect(plan.verifyDepth).toBe(sc.verify);
    });
  }

  it('verification is present in EVERY scenario (constant, never off)', () => {
    for (const sc of SCENARIOS) {
      const steps = Array.from({ length: sc.workers }, () => ({ task: sc.problem, output: 'result' }));
      const cls = classifyInput(sc.problem, steps, sc.signals as InterviewSignals | undefined);
      const plan = planOrchestration(cls, sc.workers, { userLeaning: sc.leaning });
      expect(['light', 'standard', 'deep']).toContain(plan.verifyDepth);
    }
  });
});
