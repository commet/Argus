import { describe, expect, it } from 'vitest';
import { buildProjectReturnUrl, buildReturnEmail, returnEmailSubject } from '../return-email';
import { selectDueReturnProject } from '../project-return';
import type { Project } from '@/stores/types';

function project(patch: Partial<Project> = {}): Project {
  return {
    id: 'p1',
    name: 'Pricing launch',
    description: '',
    refs: [],
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    decision_contract: {
      id: 'c1',
      project_id: 'p1',
      created_at: '2026-01-01T00:00:00.000Z',
      check_in_at: '2026-01-08T00:00:00.000Z',
      predicates: [
        { id: 'pred_1', source: 'governing_idea', text: 'conversion stays above 4%' },
      ],
    },
    ...patch,
  };
}

describe('return CTA deep links', () => {
  it('builds the canonical locale project return URL with the decision id', () => {
    expect(buildProjectReturnUrl('https://argus.voyage/', 'ko', 'c1:pred_1')).toBe(
      'https://argus.voyage/ko/project?from=checkin&return=c1%3Apred_1',
    );
  });

  it('uses the user decision sentence as the email subject and points at the exact return id', () => {
    const draft = buildReturnEmail({
      id: 'c1:pred_1',
      decision: '가격을 올린다',
      predicate: 'conversion stays above 4%',
      check_by: '2026-01-08',
    }, 'https://argus.voyage', 'ko');

    expect(draft.subject).toBe('가격을 올린다');
    expect(draft.body).toContain('"가격을 올린다"');
    expect(draft.url).toBe('https://argus.voyage/ko/project?from=checkin&return=c1%3Apred_1');
  });

  it('keeps the inbox subject as the sealed sentence, not a reminder prompt', () => {
    expect(returnEmailSubject('  가격을 올린다   ', '그 결정')).toBe('가격을 올린다');
    expect(returnEmailSubject('', '그 결정')).toBe('그 결정');
    expect(returnEmailSubject('가격을 올린다', '그 결정')).not.toContain('그래서');
  });

  it('selects only the due matching project so one click opens the settle surface', () => {
    const now = new Date('2026-01-09T09:00:00.000Z').getTime();
    expect(selectDueReturnProject([project()], 'p1', now)?.id).toBe('p1');
    expect(selectDueReturnProject([project()], 'c1', now)?.id).toBe('p1');
    expect(selectDueReturnProject([project()], 'pred_1', now)?.id).toBe('p1');
    expect(selectDueReturnProject([project()], 'c1:pred_1', now)?.id).toBe('p1');
  });

  it('does not open a non-due matching project', () => {
    const beforeCheckIn = new Date('2026-01-07T09:00:00.000Z').getTime();
    expect(selectDueReturnProject([project()], 'c1:pred_1', beforeCheckIn)).toBeNull();
  });
});
