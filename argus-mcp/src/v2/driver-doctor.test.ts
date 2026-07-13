/**
 * P2-6 — /argus-driver:doctor 스크립트 spawn e2e.
 *
 * doctor의 계약: 읽기 전용(아무것도 만들거나 고치지 않음), 어떤 파손에도
 * exit 0으로 사실 보고, 절대 경로 평문(규칙 18), predicate 본문 미출력
 * (규칙 19), 수리 손잡이는 공개 목적형 도구로만 안내.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DOCTOR = path.resolve(here, '..', '..', '..', 'argus-driver', 'scripts', 'doctor.js');

const REPO_ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const ULID = '01JZXK5N8Q2W4E6R8T0Y2Z4A6B';

let home: string;
let repoDir: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-doc-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-doc-repo-'));
});
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
});

function run(): string {
  return execFileSync('node', [DOCTOR], {
    cwd: repoDir, env: { ...process.env, ARGUS_HOME: home }, encoding: 'utf8',
  });
}

function snapshotTree(dir: string): string[] {
  const acc: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      acc.push(p);
      if (e.isDirectory()) walk(p);
    }
  };
  walk(dir);
  return acc.sort();
}

function bind(): void {
  fs.mkdirSync(path.join(repoDir, '.argus'), { recursive: true });
  fs.writeFileSync(path.join(repoDir, '.argus', 'project.json'),
    JSON.stringify({ repository_id: REPO_ID, workspace_id: 'w' }));
  fs.writeFileSync(path.join(home, 'registry.json'),
    JSON.stringify({ repositories: { '/some/git/common/dir': REPO_ID } }));
  fs.mkdirSync(path.join(home, 'projects', REPO_ID), { recursive: true });
}

describe('argus-driver doctor (P2-6)', () => {
  it('미바인딩 워크스페이스 — 사실 보고 + argus_settings 손잡이, exit 0', () => {
    fs.mkdirSync(home, { recursive: true });
    const out = run();
    expect(out).toContain('바인딩 없음');
    expect(out).toContain('argus_settings');
    expect(out).not.toContain('argus_init');
    expect(out).toContain(repoDir); // 절대 경로 평문 (규칙 18)
  });

  it('정상 설치 — 원장 줄수·fresh 커서·registry 등록을 보고하고, 아무것도 만들지 않는다', () => {
    bind();
    fs.writeFileSync(path.join(home, 'projects', REPO_ID, 'ledger.jsonl'), [
      JSON.stringify({ event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4A6A', v: 2, event: 'seal', predicate: { value: 'SECRET-PRED' } }),
      '{broken line',
      JSON.stringify({ event_id: ULID, v: 2, event: 'settle' }),
    ].join('\n') + '\n');
    fs.writeFileSync(path.join(repoDir, '.argus', 'LOGBOOK.md'),
      `# ARGUS LOGBOOK\n<!-- argus:last_event_id=${ULID} -->\n`);

    const before = [...snapshotTree(home), ...snapshotTree(repoDir)];
    const out = run();
    const after = [...snapshotTree(home), ...snapshotTree(repoDir)];

    expect(out).toContain('이벤트 3줄');
    expect(out).toContain('파손 1줄');
    expect(out).toContain(`마지막 event_id ${ULID}`);
    expect(out).toContain('fresh — 커서가 원장과 일치');
    expect(out).toContain('registry에 등록됨');
    expect(out).not.toContain('SECRET-PRED'); // 규칙 19: 본문 미출력
    expect(after).toEqual(before); // 읽기 전용 — 파일시스템 무변화
  });

  it('stale LOGBOOK + 죽은 pid 락 + 파손 registry — 전부 사실로 보고, 절대 던지지 않는다', () => {
    bind();
    fs.writeFileSync(path.join(home, 'registry.json'), '{corrupt');
    fs.writeFileSync(path.join(home, 'projects', REPO_ID, 'ledger.jsonl'),
      JSON.stringify({ event_id: ULID, v: 2, event: 'seal' }) + '\n');
    fs.writeFileSync(path.join(repoDir, '.argus', 'LOGBOOK.md'),
      '# ARGUS LOGBOOK\n<!-- argus:last_event_id=none -->\n');
    fs.writeFileSync(path.join(home, 'projects', REPO_ID, 'ledger.jsonl.lock'),
      JSON.stringify({ nonce: 'n', pid: 999999, started_at: '2026-07-11T00:00:00Z' }));

    const out = run();
    expect(out).toContain('registry 파손');
    expect(out).toContain('stale — 커서 none');
    expect(out).toContain('argus_check_in');
    expect(out).toContain('죽은 pid 999999');
    expect(out).toContain('자동 탈취');
  });

  it('[8] 자동 포착 큐 — opt-in OFF면 흔적 0이 정상으로, exhausted는 ⚠로 보고된다', () => {
    bind();
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-doc-data-'));
    try {
      // OFF + 큐 없음 = 정상
      let out = execFileSync('node', [DOCTOR], {
        cwd: repoDir, env: { ...process.env, ARGUS_HOME: home, CLAUDE_PLUGIN_DATA: dataDir }, encoding: 'utf8',
      });
      expect(out).toContain('opt-in OFF');
      expect(out).toContain('opt-in 전 흔적 0 (정상)');

      // ON + exhausted 항목 = ⚠ 수동 재개 안내
      fs.writeFileSync(path.join(home, 'config.json'), JSON.stringify({ harvest: { opt_in: true } }));
      fs.writeFileSync(path.join(dataDir, 'harvest-queue.json'), JSON.stringify({
        items: [{ item_id: 'a', kind: 'harvest', transcript_path: '/t', session_id: 's', enqueued_at: 'x', attempts: 3, exhausted: true }],
      }));
      fs.writeFileSync(path.join(dataDir, 'harvest-last-run.json'), JSON.stringify({ date: '2026-07-10' }));
      out = execFileSync('node', [DOCTOR], {
        cwd: repoDir, env: { ...process.env, ARGUS_HOME: home, CLAUDE_PLUGIN_DATA: dataDir }, encoding: 'utf8',
      });
      expect(out).toContain('opt-in ON');
      expect(out).toContain('큐 1건 대기');
      expect(out).toContain('1건은 3회 실패로 자동 재시도 제외');
      expect(out).toContain('마지막 자동 포착 실행일: 2026-07-10');
    } finally {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  it('v1 이전 marker 유무를 구분해 보고한다', () => {
    bind();
    expect(run()).toContain('marker 없음');
    fs.writeFileSync(path.join(home, 'projects', REPO_ID, 'v1-migration.json'),
      JSON.stringify({ source: '/x', migrated_at: '2026-07-11' }));
    fs.writeFileSync(path.join(home, 'projects', REPO_ID, 'ledger.v1.jsonl'), '\n');
    const out = run();
    expect(out).toContain('이전 완료');
    expect(out).toContain('ledger.v1.jsonl');
  });
});
