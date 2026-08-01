import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('public review taxonomy', () => {
  it('keeps landing, directory metadata, and real teams conceptually aligned', () => {
    const landing = read('../../landing/voyage/VoyagePhases.tsx');
    const directory = read('../../../app/[locale]/agents/page.tsx');
    const teams = read('../../../app/[locale]/teams/page.tsx');
    expect(landing).toContain('판단에 필요한 검토');
    expect(directory).toContain('AI 검토 방식 — Argus');
    expect(teams).toContain('AI 검토 방식과 달리');
    expect(landing).not.toContain('여러 AI 검토자가');
  });
});
