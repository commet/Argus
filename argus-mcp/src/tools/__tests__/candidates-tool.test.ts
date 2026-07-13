/**
 * M-잔여-2 — argus_candidates 툴의 수용 기준.
 * 스파인: 목록은 무권유(사실+손잡이), promote는 연결만(결정 생성은 seal),
 * quote는 sanitize를 지나 렌더, terminal 후 재행동은 명시 거절.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { init } from '../init-config.js';
import { candidates } from '../candidates.js';
import { contextFor, candidateCreatedV2 } from '../../v2/bridge.js';

let home: string;
let repoDir: string;
let argusDir: string;
let savedHome: string | undefined;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-ct-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-ct-repo-'));
  fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
  argusDir = path.join(repoDir, '.argus');
  savedHome = process.env['ARGUS_HOME'];
  process.env['ARGUS_HOME'] = home;
});
afterEach(() => {
  if (savedHome === undefined) delete process.env['ARGUS_HOME'];
  else process.env['ARGUS_HOME'] = savedHome;
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
});

async function call(args: Record<string, unknown>, expectOk = true) {
  const res = (await candidates.handler(args)) as {
    structuredContent: { ok: boolean; surface: string; data: Record<string, unknown> };
  };
  if (expectOk) expect(res.structuredContent.ok, JSON.stringify(res.structuredContent)).toBe(true);
  return res.structuredContent;
}

function seedCandidate(id: string, quote: string): void {
  const ctx = contextFor({
    home, gitCommonDir: path.join(repoDir, '.git'), workspaceArgusDir: argusDir,
    sessionId: 's-ct', producerVersion: 't', today: '2026-07-11',
  });
  candidateCreatedV2(ctx, { candidateId: id, kind: 'decision', quote, quoteSpeaker: 'user', source: 'debrief' });
}

describe('argus_candidates', () => {
  it('목록: 후보를 sanitize된 quote와 검증 등급으로 보여주고, 아무것도 권하지 않는다', async () => {
    await init.handler({ argus_dir: argusDir });
    seedCandidate('c-1', '큐는 SQLite로 가기로 했다 \u001b[31m주입');
    const r = await call({ argus_dir: argusDir, action: 'list', today_override: '2026-07-11' });
    expect(r.surface).toContain('c-1');
    expect(r.surface).toContain('host_reported');
    expect(r.surface).not.toContain('\u001b'); // 규칙 19: 제어문자 미통과
    expect(r.surface).not.toMatch(/추천|권장|해야 합니다|좋겠/); // 무권유
    expect(r.surface).toMatch(/14일|14 days/); // 방치도 선택지로 명시 (locale 무관)
    const rows = r.data['candidates'] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(String(rows[0]!['quote'])).not.toContain('\u001b');
  });

  it('빈 목록은 그 사실만 말한다', async () => {
    await init.handler({ argus_dir: argusDir });
    const r = await call({ argus_dir: argusDir, action: 'list', today_override: '2026-07-11' });
    expect(r.surface).toMatch(/없습니다|No captured/);
  });

  it('promote는 연결만 하고, terminal 후 재행동은 명시 거절된다', async () => {
    await init.handler({ argus_dir: argusDir });
    seedCandidate('c-2', '봉인까지 간 후보입니다');
    const r = await call({
      argus_dir: argusDir, action: 'promote', candidate_id: 'c-2', decision_id: 'sealed-dec',
      today_override: '2026-07-11',
    });
    expect(r.surface).toContain('sealed-dec');
    expect(r.surface).toContain('argus_predict'); // 공개 저장 경로만 안내

    const dead = await call({
      argus_dir: argusDir, action: 'drop', candidate_id: 'c-2', today_override: '2026-07-11',
    }, false);
    expect(dead.ok).toBe(false); // CANDIDATE terminal 가드가 표면화
  });

  it('snooze는 날짜 필수 — 스키마가 결합을 강제한다', async () => {
    await init.handler({ argus_dir: argusDir });
    seedCandidate('c-3', '잠재울 후보입니다');
    const bad = await candidates.inputSchema.safeParse({ argus_dir: argusDir, action: 'snooze', candidate_id: 'c-3' });
    expect(bad.success).toBe(false);
    const r = await call({
      argus_dir: argusDir, action: 'snooze', candidate_id: 'c-3', snooze_until: '2026-08-01',
      today_override: '2026-07-11',
    });
    expect(r.surface).toContain('2026-08-01');
  });

  it('바인딩 없는 리포는 INIT_REQUIRED로 정직 거절', async () => {
    const r = await call({ argus_dir: argusDir, action: 'list' }, false);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).toContain('INIT_REQUIRED');
  });
});
