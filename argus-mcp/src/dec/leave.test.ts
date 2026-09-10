import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyLeave, planLeave } from './leave.js';
import { runDecLeaveCli, runDecVerifyCli, runDecBlockCli, runDecBriefCli } from './dec-cli.js';
import { signDecision } from './write.js';
import { foldDecisions } from './fold.js';
import { BEGIN, END } from './export/emit.js';
import type { DecSignedPayload } from './types.js';

describe('출구 — 떠나면 전부 그냥 글이 된다', () => {
  let repo: string;
  let dir: string;

  const sign = (id: string, extra: Partial<DecSignedPayload> = {}): Promise<unknown> =>
    signDecision(dir, id, {
      type: 'pin', decision: `${id} 의 문장`, scope: 'repo', binds: '나', author: '나',
      provenance: 'user', adopted: '2026-08-01', unattended: 'park', watch: 'inject_only',
      review: '2026-08-10', ...extra,
    } as DecSignedPayload, '2026-08-21T00:00:00.000Z');

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'dec-leave-'));
    dir = path.join(repo, '.argus');
    fs.mkdirSync(path.join(dir, 'ledger'), { recursive: true });
  });
  afterEach(() => { fs.rmSync(repo, { recursive: true, force: true }); });

  const capture = async (run: () => Promise<void> | void): Promise<Record<string, unknown>> => {
    const chunks: string[] = [];
    const original = process.stdout.write.bind(process.stdout);
    (process.stdout as { write: unknown }).write = (c: string): boolean => { chunks.push(String(c)); return true; };
    try { await run(); } finally { (process.stdout as { write: unknown }).write = original; }
    return JSON.parse(chunks.join('').trim()) as Record<string, unknown>;
  };

  it('기본은 보여만 준다 — 아무 파일도 안 바뀐다', async () => {
    await sign('D-0001');
    const before = fs.readFileSync(path.join(repo, 'AGENTS.md'), 'utf8');

    const out = await capture(() => runDecLeaveCli(['--argus-dir', dir]));

    expect(out['dry_run']).toBe(true);
    expect(fs.readFileSync(path.join(repo, 'AGENTS.md'), 'utf8')).toBe(before);
    expect(foldDecisions(dir).left).toBeUndefined();
  });

  it('떠나면 규칙 파일에서 표시와 지문이 사라지고 글은 남는다', async () => {
    await sign('D-0001', { decision: '무료 티어는 안 만든다' });
    await capture(() => runDecLeaveCli(['--argus-dir', dir, '--yes']));

    const text = fs.readFileSync(path.join(repo, 'AGENTS.md'), 'utf8');
    expect(text).not.toContain(BEGIN);
    expect(text).not.toContain(END);
    expect(text).not.toContain('argus:fingerprint');
    // 글은 그대로 있다 — 떠남은 지움이 아니다.
    expect(text).toContain('무료 티어는 안 만든다');
    // 없는 기계를 가리키지 않는다.
    expect(text).not.toContain('dec-amend');
  });

  it('남의 글은 바이트 그대로 둔다 (방출할 때와 같은 규율)', async () => {
    const agents = path.join(repo, 'AGENTS.md');
    fs.writeFileSync(agents, '# 우리 팀 규칙\n\n커밋은 한국어로.\n', 'utf8');
    await sign('D-0001');
    await capture(() => runDecLeaveCli(['--argus-dir', dir, '--yes']));

    const text = fs.readFileSync(agents, 'utf8');
    expect(text).toContain('# 우리 팀 규칙');
    expect(text).toContain('커밋은 한국어로.');
  });

  it('결정 파일은 지문과 꼬리말을 잃고, 있는 사실이 대신 적힌다', async () => {
    await sign('D-0001');
    const file = path.join(repo, 'decisions', 'D-0001.md');
    expect(fs.readFileSync(file, 'utf8')).toContain('argus:fingerprint');

    await capture(() => runDecLeaveCli(['--argus-dir', dir, '--yes']));

    const text = fs.readFileSync(file, 'utf8');
    expect(text).not.toContain('argus:fingerprint');
    expect(text).not.toContain('이 파일은 기록에서 자동으로 만들어진다');
    expect(text).not.toContain('dec-amend');
    expect(text).toContain('D-0001 의 문장');
    expect(text).toContain('아르고스는 이 저장소에서 떠났고');
  });

  it('원장은 안 지운다 — 떠남은 지움이 아니다 (불변식 ③)', async () => {
    await sign('D-0001');
    await capture(() => runDecLeaveCli(['--argus-dir', dir, '--yes']));

    expect(fs.existsSync(path.join(dir, 'ledger'))).toBe(true);
    const left = foldDecisions(dir).left;
    expect(left).toBeTruthy();
    expect(left!.inlined).toBeGreaterThan(0);
  });

  it('떠난 이유는 적었을 때만 남는다 — 안 물어보고 안 지어낸다', async () => {
    await sign('D-0001');
    await capture(() => runDecLeaveCli(['--argus-dir', dir, '--yes']));
    expect(foldDecisions(dir).left!.why).toBeUndefined();

    // 적으면 남는다
    const repo2 = fs.mkdtempSync(path.join(os.tmpdir(), 'dec-leave2-'));
    const dir2 = path.join(repo2, '.argus');
    fs.mkdirSync(path.join(dir2, 'ledger'), { recursive: true });
    await signDecision(dir2, 'D-0001', {
      type: 'pin', decision: 'x 를 한다', scope: 'repo', binds: '나', author: '나',
      provenance: 'user', adopted: '2026-08-01', unattended: 'park', watch: 'inject_only',
      review: '2026-08-10',
    } as DecSignedPayload, '2026-08-21T00:00:00.000Z');
    await capture(() => runDecLeaveCli(['--argus-dir', dir2, '--yes', '--why', '팀이 흩어졌다']));
    expect(foldDecisions(dir2).left!.why).toBe('팀이 흩어졌다');
    fs.rmSync(repo2, { recursive: true, force: true });
  });

  it('저장소에 걸린 우리 훅만 뺀다 — 남의 훅은 그대로', async () => {
    fs.mkdirSync(path.join(repo, '.claude'), { recursive: true });
    fs.writeFileSync(path.join(repo, '.claude', 'settings.json'), JSON.stringify({
      permissions: { allow: ['x'] },
      hooks: {
        SessionStart: [{ hooks: [
          { type: 'command', command: 'node argus-plugin/hooks/dec-brief.js' },
          { type: 'command', command: 'bash scripts/our-own-thing.sh' },
        ] }],
      },
    }, null, 2), 'utf8');
    await sign('D-0001');

    await capture(() => runDecLeaveCli(['--argus-dir', dir, '--yes']));

    const settings = JSON.parse(fs.readFileSync(path.join(repo, '.claude', 'settings.json'), 'utf8')) as
      { permissions?: unknown; hooks?: { SessionStart?: { hooks: { command: string }[] }[] } };
    const commands = settings.hooks?.SessionStart?.[0]?.hooks.map((h) => h.command) ?? [];
    expect(commands).toEqual(['bash scripts/our-own-thing.sh']);
    expect(settings.permissions).toEqual({ allow: ['x'] });
  });

  it('못 하는 것을 말한다 — 안 적으면 다 한 것처럼 보인다', async () => {
    await sign('D-0001');
    const plan = planLeave(dir);
    expect(plan.cannot.length).toBeGreaterThan(0);
    expect(plan.cannot.join(' ')).toContain('플러그인');
    expect(plan.cannot.join(' ')).toContain('git');
  });

  // ── 소비 쪽: 떠난 사실을 읽는 자리가 실제로 있는가 ──────────────────────

  it('떠난 뒤 검사는 "전부 손으로 고쳤다"고 비명 지르지 않는다', async () => {
    await sign('D-0001');
    await capture(() => runDecLeaveCli(['--argus-dir', dir, '--yes']));

    const out = await capture(() => runDecVerifyCli(['--argus-dir', dir]));
    expect(out['ok']).toBe(true);
    expect(out['left']).toBeTruthy();
    expect(JSON.stringify(out['say'])).toContain('떠났다');
    expect(JSON.stringify(out['say'])).not.toContain('손으로 고쳤');
  });

  it('떠난 저장소를 계속 막지 않는다 — 안 그러면 출구가 있는 척만 하는 것이다', async () => {
    await sign('D-0001', { type: 'ban', watch: 'machine', decision: 'src/legacy 는 건드리지 않는다',
      watch_rule: { paths: ['src/legacy/**'], phrases: [], except_paths: [], except_phrases: [],
        blind_spots: ['다른 저장소에서 같은 파일을 건드리는 것은 못 잡는다'], mode: 'machine' } });

    const blocked = await capture(() => runDecBlockCli(['--argus-dir', dir, '--file', 'src/legacy/a.ts']));
    expect(blocked['block']).toBe(true);

    await capture(() => runDecLeaveCli(['--argus-dir', dir, '--yes']));

    const after = await capture(() => runDecBlockCli(['--argus-dir', dir, '--file', 'src/legacy/a.ts']));
    expect(after['block']).toBe(false);
    expect(after['why_not']).toBe('left');
  });

  it('떠난 저장소에서는 세션이 열려도 말을 걸지 않는다', async () => {
    await sign('D-0001');
    await capture(() => runDecLeaveCli(['--argus-dir', dir, '--yes']));

    const out = await capture(() => runDecBriefCli(['--argus-dir', dir, '--dry']));
    expect(out['say']).toEqual([]);
    expect(out['left']).toBeTruthy();
  });

  it('모르는 깃발은 조용히 무시하지 않는다', async () => {
    await expect(runDecLeaveCli(['--argus-dir', dir, '--force'])).rejects.toThrow(/모르는 깃발/);
  });

  it('두 번 떠나도 계획은 할 것이 없다고 말한다 (되풀이해도 안전)', async () => {
    await sign('D-0001');
    await capture(() => runDecLeaveCli(['--argus-dir', dir, '--yes']));
    const plan = planLeave(dir);
    expect(plan.rule_file?.action).toBe('skip');
    expect(plan.decisions.every((d) => d.action === 'skip')).toBe(true);
    const result = applyLeave(plan);
    expect(result.decisions_plain).toBe(0);
    expect(result.failed).toEqual([]);
  });
});
