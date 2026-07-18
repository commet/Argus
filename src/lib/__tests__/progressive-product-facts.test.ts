import { describe, expect, it } from 'vitest';
import type { AnalysisSnapshot } from '@/stores/types';
import {
  buildDeepeningPrompt,
  buildExecutionPlanPrompt,
  buildInitialAnalysisPrompt,
  buildMixPrompt,
  buildWorkerTaskPrompt,
} from '../progressive-prompts';

const snapshot = {
  version: 1,
  real_question: '무엇을 먼저 확인해야 할까?',
  insight: '',
  hidden_assumptions: [],
  skeleton: ['먼저 확인한다'],
} as unknown as AnalysisSnapshot;

describe('workspace product facts — MCP sync is never invented', () => {
  it('pins local-first and explicit account sync across every generated workspace layer', () => {
    const systems = [
      buildInitialAnalysisPrompt('결정을 돕자', 'ko').system,
      buildDeepeningPrompt('결정을 돕자', snapshot, [], 1, 3, 'ko').system,
      buildExecutionPlanPrompt('결정을 돕자', snapshot, [], 1, undefined, 'ko').system,
      buildWorkerTaskPrompt(
        '기능 설명',
        '정확한 안내',
        'ai',
        { problemText: '결정을 돕자', realQuestion: '무엇을 확인할까?', skeleton: [], hiddenAssumptions: [], qaHistory: [] },
        undefined,
        'junior',
        undefined,
        undefined,
        undefined,
        'ko',
      ).system,
      buildMixPrompt('결정을 돕자', [snapshot], [], null, [], 'ko').system,
    ];

    for (const system of systems) {
      expect(system).toContain('argus_predict saves to the local .argus directory by default');
      expect(system).toContain('ARGUS_TOKEN');
      expect(system).toContain('argus_settings connect/sync');
    }
  });
});
