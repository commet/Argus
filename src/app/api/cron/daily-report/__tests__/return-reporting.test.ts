import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { distinctReturnProjects } from '@/lib/return-analytics';

const route = readFileSync(
  resolve(process.cwd(), 'src/app/api/cron/daily-report/route.ts'),
  'utf8'
);

describe('daily return-loop reporting', () => {
  it('counts each return outcome by project and only for human sessions', () => {
    const projects = distinctReturnProjects([
      { session_id: 'human-a', event_name: 'return_opened', properties: { project_id: 'voyage-1' } },
      { session_id: 'human-b', event_name: 'return_opened', properties: { project_id: 'voyage-1' } },
      { session_id: 'human-a', event_name: 'return_answered', properties: { project_id: 'voyage-1' } },
      { session_id: 'bot', event_name: 'return_opened', properties: { project_id: 'voyage-2' } },
      { session_id: 'legacy', event_name: 'return_opened', properties: null },
      { session_id: 'legacy', event_name: 'return_opened', properties: null },
    ], 'return_opened', new Set(['human-a', 'human-b', 'legacy']));

    expect([...projects]).toEqual(['project:voyage-1', 'session:legacy']);
  });

  it('keeps the longitudinal return loop separate from the acquisition funnel', () => {
    expect(route).toContain('판단 귀환 · 어제');
    expect(route).toContain('확인 완료율 = 답한 프로젝트 ÷ 어제 귀환 활동이 있었던 프로젝트');
    expect(route).toContain('returns_opened_yesterday: returnsOpenedY.size');
    expect(route).toContain('returns_answered_yesterday: returnsAnsweredY.size');
    expect(route).toContain('returns_deferred_yesterday: returnsDeferredY.size');
  });
});
