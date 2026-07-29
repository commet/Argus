import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { translate } from '@/lib/i18n';

const read = (relativePath: string) => fs.readFileSync(path.resolve(relativePath), 'utf8');

describe('promotion-critical web basics', () => {
  it('preserves intentional empty English affixes instead of leaking Korean', () => {
    expect(translate('en', 'boss.yearSuffix')).toBe('');
    expect(translate('en', 'boss.monthSuffix')).toBe('');
    expect(translate('en', 'boss.zodiacSuffix')).toBe('');
  });

  it('keeps the document language synchronized after client locale navigation', () => {
    const source = read('src/contexts/LocaleProvider.tsx');
    expect(source).toContain('document.documentElement.lang = locale');
    expect(source).toMatch(/document\.documentElement\.lang = locale;[\s\S]*\[locale\]/);
  });

  it('uses localized boss identity data and names the chat controls', () => {
    const source = read('src/components/boss/BossChat.tsx');
    expect(source).toContain('getLocalizedPersonalityType(typeCode, locale)');
    expect(source).toContain("aria-label={L('팀장에게 보낼 답변', 'Reply to manager')}");
    expect(source).toContain("aria-label={L('답변 보내기', 'Send reply')}");
  });

  it('enforces the advertised eight-character sign-up password contract', () => {
    const source = read('src/app/[locale]/login/page.tsx');
    expect(source).toContain('if (password.length < 8)');
    expect(source).toContain('Password must be at least 8 characters.');
  });

  it('gives every settings switch an accessible name', () => {
    const source = read('src/app/[locale]/settings/page.tsx');
    expect(source).toContain("aria-label={L('전환음', 'Transition Sound')}");
    expect(source).toContain('aria-label={lab.label}');
  });

  it('degrades unavailable and missing share links to not-found instead of crashing', () => {
    const page = read('src/app/d/[token]/page.tsx');
    expect(page).toContain('.maybeSingle()');
    expect(page).toContain("console.error('[d/token] lookup unavailable:'");
    expect(page).toContain('if (!row) notFound();');
  });

  it('does not expose a first-analysis verdict before neutrality scanning', () => {
    // Whole flow surface, not one path: the presentational half now lives in
    // flow-parts/ (E-1, 2026-07-29) and a path-pinned guard would go quietly blind.
    const flow = [
      read('src/components/workspace/progressive/ProgressiveFlow.tsx'),
      ...['stream-cards', 'phase-chrome', 'voyage-prep', 'framing']
        .map((f) => read(`src/components/workspace/progressive/flow-parts/${f}.tsx`)),
    ].join('\n');
    const card = read('src/components/workspace/progressive/shared/AnalysisCard.tsx');
    const engine = read('src/lib/progressive-engine.ts');
    expect(flow).toContain('scanLean(session.problem_text');
    expect(flow).toContain('neutralizeLeanText(cur.insight, leanFlags)');
    expect(flow).toContain("!(snapshot.request_type && snapshot.request_type !== 'open')");
    expect(flow).toContain('snapshot.lean_flags === undefined || snapshot.honesty_flags === undefined');
    expect(flow).toContain("latest?.version !== 0 && latest?.honesty_flags !== undefined");
    expect(card).toContain("!(snapshot.request_type && snapshot.request_type !== 'open')");
    expect(card).toContain('snapshot.lean_flags === undefined || snapshot.honesty_flags === undefined');
    expect(flow).toContain('latestSnapshotVersion, store]);');
    expect(flow).not.toContain('Promise.all([\n      needsHonesty');
    expect(card).toContain('const visibleSkeleton = snapshot.version === 0 ? [] : snapshot.skeleton');
    expect(card).toContain('const visibleAssumptions = snapshot.version === 0 ? [] : snapshot.hidden_assumptions');
    expect(engine.match(/result\.request_type && result\.request_type !== 'open'/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('authenticates protected API callers before checking service configuration', () => {
    for (const file of [
      'src/app/api/account/delete/route.ts',
      'src/app/api/account/export/route.ts',
      'src/app/api/decisions/telegram-sync/route.ts',
    ]) {
      const source = read(file);
      expect(source.indexOf("req.headers.get('authorization')")).toBeLessThan(source.indexOf('SUPABASE_SERVICE_ROLE_KEY'));
    }
  });
});
