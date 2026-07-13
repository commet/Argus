/**
 * LOGBOOK projection 테스트 (P2-1) — 규칙 10·6·I-1의 수용 기준.
 *  - 렌더는 순수 함수(BriefState만) — 골든 단면으로 고정.
 *  - 커서(event_id)가 원장과 다르면 stale — 자동 재생성 신호.
 *  - 관문 배선: 툴 호출만으로 worktree .argus/LOGBOOK.md가 태어나고 갱신된다.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { init } from '../tools/init-config.js';
import { seal } from '../tools/seal.js';
import { settle } from '../tools/settle.js';
import { loadState } from './reducer.js';
import { logbookIsStale, logbookPath, renderLogbook } from './logbook.js';
import type { BriefState } from './brief.js';

let home: string;
let repoDir: string;
let argusDir: string;
let savedHome: string | undefined;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-lb-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-lb-repo-'));
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

async function call(tool: { handler: (a: Record<string, unknown>) => Promise<unknown> }, args: Record<string, unknown>) {
  const res = (await tool.handler(args)) as { structuredContent: { ok: boolean; data: Record<string, unknown> } };
  expect(res.structuredContent.ok, JSON.stringify(res.structuredContent)).toBe(true);
  return res.structuredContent.data;
}

const REPO_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

function briefWith(over: Partial<BriefState>): BriefState {
  return {
    logical_date: '2026-07-11', due: [], unsealed_net: [], premise_rechecks_due: [], open_questions: [],
    candidates_active: [], candidates_expired: 0, sealed_alive: 0,
    anomalies: 0, skipped_unknown: 0, dropped_corrupt: 0,
    last_event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4A6B', ...over,
  };
}

describe('renderLogbook — 순수 렌더 (골든 단면)', () => {
  it('due·전제·질문·정직성 카운터·커서가 전부 제 자리에 있다', () => {
    const md = renderLogbook(briefWith({
      due: [{ decision_id: 'q3-cutover', predicate: 'downtime < 5 min', check_by: '2026-07-01', overdue_days: 10, suggest_dismiss: true }],
      unsealed_net: [{ decision_id: 'u1', text: '캐시 레이어는 redis로', harvested_on: '2026-07-09' }],
      premise_rechecks_due: [{ premise_id: 'p1', text: 'TTL은 UTC 기준', due_since: '2026-07-08' }],
      open_questions: [{ premise_id: 'q1', text: '캐시를 언제 켤 것인가' }],
      sealed_alive: 3, anomalies: 1, dropped_corrupt: 2, skipped_unknown: 4,
    }), REPO_ID);
    expect(md).toContain('# ARGUS LOGBOOK');
    expect(md).toContain('결과를 확인할 예측 (1)');
    expect(md).toContain('| q3-cutover | downtime < 5 min | 2026-07-01 | +10일 (2회 미룸, 계속 볼지 확인 가능) |');
    expect(md).toContain('진행 중인 예측: 3건');
    expect(md).toContain('예측으로 남길지 확인할 판단 (1)');
    expect(md).toContain('캐시 레이어는 redis로 · 2026-07-09 포착 (남기려면 `argus_save_prediction`)');
    expect(md).toContain('TTL은 UTC 기준 · 2026-07-08부터');
    expect(md).toContain('캐시를 언제 켤 것인가');
    expect(md).toContain('전이 이상 1건');
    expect(md).toContain('파손 줄 2건');
    expect(md).toContain('미지 이벤트 4건');
    expect(md).toContain('<!-- argus:last_event_id=01JZXK5N8Q2W4E6R8T0Y2Z4A6B -->');
    // 스파인: 평결·조언 어휘 부재 (사실 + 손잡이만)
    expect(md).not.toMatch(/추천|권장|잘했|못했|점수/);
    // 하우스 스타일(창업자 확정): em-dash cadence 금지 (도그푸딩 F13).
    // 픽스처 텍스트가 전부 em-dash-free이므로, 렌더 결과의 em-dash는 곧
    // 템플릿 자신의 것 — 0이어야 한다. LOGBOOK은 copy-audit이 안 걷는
    // 사용자 대면 파일이라 이 렌더 단면이 그 사각을 메운다.
    expect(md, 'LOGBOOK projection에 em-dash cadence가 남음').not.toContain('—');
  });

  it('빈 상태는 빈 잔소리 없이 조용하다', () => {
    const md = renderLogbook(briefWith({ last_event_id: null }), REPO_ID);
    expect(md).toContain('오늘은 없습니다');
    expect(md).not.toContain('재확인 도래');
    expect(md).not.toContain('원장 상태'); // 카운터 전부 0 → 섹션 자체가 없다
    expect(md).toContain('<!-- argus:last_event_id=none -->');
  });

  it('개행·파이프가 든 predicate도 표를 깨지 못한다', () => {
    const md = renderLogbook(briefWith({
      due: [{ decision_id: 'x', predicate: 'multi\nline | with pipe', check_by: '2026-07-01', overdue_days: 0, suggest_dismiss: false }],
    }), REPO_ID);
    const row = md.split('\n').find((l) => l.includes('multi'))!;
    expect(row).not.toContain('\n');
    expect(row.split('|').length).toBe(6); // 셀 4개 + 양끝 — 파이프 주입이 셀을 못 늘린다
  });
});

describe('커서 staleness (I-1)', () => {
  it('파일 부재·커서 불일치·커서 훼손 전부 stale, 일치만 fresh', async () => {
    expect(logbookIsStale(argusDir, null)).toBe(true); // 부재

    await call(init, { argus_dir: argusDir });
    const sealed = await call(seal, {
      argus_dir: argusDir, id: 'lb-1', predicate: 'logbook is born', check_by: '2099-01-01', predicate_owner: 'user',
    });
    const repoId = (sealed['v2_write'] as { repository_id: string }).repository_id;
    const lastId = loadState(home, repoId).last_event_id;
    expect(logbookIsStale(argusDir, lastId)).toBe(false); // 방금 관문이 갱신 — fresh

    // 원장이 전진하면 stale (여기서는 커서만 비교하는 성질을 죽은 커서로 재현)
    expect(logbookIsStale(argusDir, '01JZXK5N8Q2W4E6R8T0Y2Z4A6B')).toBe(true);

    fs.writeFileSync(logbookPath(argusDir), '# 손으로 고친 LOGBOOK\n');
    expect(logbookIsStale(argusDir, lastId)).toBe(true); // 커서 훼손 = stale
  });
});

describe('관문 배선 — 툴 호출만으로 LOGBOOK이 산다', () => {
  it('seal이 due를 낳고, settle이 그것을 지운다 — 파일이 원장을 따라간다', async () => {
    await call(init, { argus_dir: argusDir });
    await call(seal, {
      argus_dir: argusDir, id: 'lb-2', predicate: 'due today shows up', check_by: '2026-07-11',
      predicate_owner: 'user', today_override: '2026-07-10',
    });
    const afterSeal = fs.readFileSync(logbookPath(argusDir), 'utf8');
    expect(afterSeal).toContain('진행 중인 예측: 1건'); // 확인일 전 — due 아님, 살아있음

    await call(settle, {
      argus_dir: argusDir, id: 'lb-2', outcome: 'held', what_happened: '됐다', today_override: '2026-07-11',
    });
    const afterSettle = fs.readFileSync(logbookPath(argusDir), 'utf8');
    expect(afterSettle).toContain('오늘은 없습니다'); // 정산됨 — due에서 사라짐
    expect(afterSettle).not.toContain('due today shows up');
  });
});
