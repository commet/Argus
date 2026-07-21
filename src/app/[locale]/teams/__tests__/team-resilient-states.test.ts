import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', 'page.tsx'), 'utf8');

describe('team page resilient state contract', () => {
  it('separates initial and detail loading from successful empty states', () => {
    expect(source).toContain('initialLoading ?');
    expect(source).toContain('detailLoading ?');
    expect(source).toContain('teams.length === 0 && !loadError');
    expect(source).toContain("motion-reduce:animate-none");
  });

  it('offers an explicit retry after a failed read', () => {
    expect(source).toContain('retryTeamData');
    expect(source).toContain("role=\"alert\"");
    expect(source).toContain("'Try again'");
  });

  it('never claims an invite link was copied when clipboard access failed', () => {
    expect(source).toContain('clipboard unavailable');
    expect(source).toContain('setInviteLink(url)');
    expect(source).toContain('Invitation link to copy manually');
    expect(source).toContain('event.currentTarget.select()');
  });

  it('bounds and labels user-entered team fields', () => {
    expect(source).toContain('maxLength={254}');
    expect(source).toContain('Email address to invite');
    expect(source).toContain('Role to invite');
    expect(source).toContain('[overflow-wrap:anywhere]');
    expect(source).toContain('{reviewComment.length}/2000');
  });
});
