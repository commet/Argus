import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('daily analytics contract', () => {
  it('records every landing CTA named by the email funnel', () => {
    const hero = source('src/components/landing/SirenHero.tsx');
    expect(hero).toContain("track('landing_hero_submit'");
    expect(hero).toContain("cta: 'hero_document_review'");
    expect(source('src/components/landing/voyage/Act2DecisionVoyage.tsx')).toContain("track('landing_cta_click'");
    const header = source('src/components/landing/LandingHeader.tsx');
    expect(header).toContain("cta: 'header_workspace'");
    expect(header).toContain("track('landing_signin_click'");
  });

  it('does not treat the synthetic server session as a user session', () => {
    expect(source('src/app/api/cron/daily-report/route.ts')).toContain("e.session_id !== 'server'");
  });

  it('separates expected guardrails from operational failures', () => {
    const route = source('src/app/api/cron/daily-report/route.ts');
    expect(route).toContain('classifyAnalyticsSignal(event.event_name, event.properties)');
    expect(route).toContain('정상 보호 동작');
  });

  it('requires delivery and owner-filter configuration before sending', () => {
    const route = source('src/app/api/cron/daily-report/route.ts');
    expect(route).toContain("['REPORT_EMAIL', isValidEmailAddress(REPORT_EMAIL) ? 'configured' : '']");
    expect(route).toContain('OWNER_EMAILS.every(isValidEmailAddress)');
  });

  it('turns provider-level email rejection into a failed cron response', () => {
    expect(source('src/app/api/cron/daily-report/route.ts')).toContain('if (sendError) throw new Error');
  });

  it('paginates event rows instead of silently truncating the report', () => {
    const route = source('src/app/api/cron/daily-report/route.ts');
    expect(route).toContain('.range(offset, offset + pageSize - 1)');
    expect(route).not.toContain('.limit(20000)');
    expect(route).not.toContain('.limit(200000)');
  });

  it('loads the fortnight once and avoids transferring full voyage JSON for metrics', () => {
    const route = source('src/app/api/cron/daily-report/route.ts');
    expect(route.match(/twoWeekRaw = await loadEvents/g)).toHaveLength(1);
    expect(route).toContain("final_deliverable:data->>final_deliverable");
    expect(route).not.toContain(".select('project_id, user_id, data, created_at, updated_at')");
    expect(route).not.toContain(".select('project_id, user_id, created_at, updated_at, phase, data')");
  });

  it('classifies traffic through the shared, unit-tested helpers', () => {
    const route = source('src/app/api/cron/daily-report/route.ts');
    // No copy-pasted classifier in the route — it imports the single source.
    expect(route).toContain("from '@/lib/analytics-reporting'");
    expect(route).toContain('classifyAnonSession');
    expect(route).not.toContain('function classifySource(');
  });

  it('drives the top line and funnel off human sessions, quarantining bots/internal', () => {
    const route = source('src/app/api/cron/daily-report/route.ts');
    expect(route).toContain('bucketSession(');
    expect(route).toContain('const sessionsY = humanSessionIds');
    // Funnel must be scoped to human sessions, not all external traffic.
    expect(route).toContain('humanSessionIds.has(e.session_id)');
  });

  it('renders the anonymous-visit detail section in the email', () => {
    const route = source('src/app/api/cron/daily-report/route.ts');
    expect(route).toContain('익명 방문 상세');
    // The three-way split is surfaced to the founder, nothing silently dropped.
    expect(route).toContain('봇 / 스팸');
    expect(route).toContain('내부 / QA');
    expect(route).toContain('유입 소스 (익명 사람)');
    expect(route).toContain('진입 페이지 (익명 사람)');
  });
});
