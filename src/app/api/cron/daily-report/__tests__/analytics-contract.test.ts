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
});
