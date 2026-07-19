/**
 * P4-3 — 수명주기 연산 4종 (정본 규칙 21 / II-F)의 수용 기준.
 * 핵심 계약: export는 원본 무변화, import 충돌은 명시 거절(조용한 덮어쓰기
 * 불가능), purge는 원문 confirm 강제, 왕복(export→purge→import)이 무손실.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lookupRepository, projectDir, registerRepository } from './ledger.js';
import { loadState } from './reducer.js';
import {
  doctorBackup, exportBundle, exportPortableLocalArchive, importBundle,
  planOrPurgeRepository, planOrPurgeV1Store, purgeRepository, restorePortableLocalArchive,
} from './lifecycle.js';

let home: string;
let repoDir: string;
let repoId: string;
let bundle: string;

const T0 = '2026-07-11T12:00:00.000Z';
const LEDGER_LINE = JSON.stringify({
  event_id: '01JZXK5N8Q2W4E6R8T0Y2Z4A6B', v: 2, producer_version: 't',
  repository_id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', workspace_id: '9b2fd3a1-6c7e-4a2b-8d1f-2e3a4b5c6d7e',
  session_id: 's', occurred_at: T0, logical_date: '2026-07-11', tz: 'UTC',
  idempotency_key: 'k1', event: 'seal',
  decision_id: 'd1', predicate: { value: '왕복 후에도 남는다', provenance: 'elicited_user' },
  check_by: { value: '2026-08-01', provenance: 'elicited_user' },
}) + '\n';

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-lc-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-lc-repo-'));
  bundle = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-lc-bundle-'));
  fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
  repoId = registerRepository(home, path.join(repoDir, '.git'));
  fs.writeFileSync(path.join(projectDir(home, repoId), 'ledger.jsonl'), LEDGER_LINE);
});
afterEach(() => {
  for (const d of [home, repoDir, bundle]) fs.rmSync(d, { recursive: true, force: true });
});

describe('export → purge → import 왕복 (II-F의 본체)', () => {
  it('왕복 후 원장 내용과 결정 상태가 동일하다 — 무손실', () => {
    const manifest = exportBundle(home, repoId, bundle, T0);
    expect(manifest.files.map((f) => f.name)).toEqual(['ledger.jsonl']);

    const purged = purgeRepository(home, repoId, repoId);
    expect(purged).toEqual({ removed_project_dir: true, removed_registry_entries: 1 });
    expect(fs.existsSync(projectDir(home, repoId))).toBe(false);
    expect(lookupRepository(home, path.join(repoDir, '.git'))).toBeNull(); // registry에서도 사라짐

    const plan = importBundle(home, bundle, { dryRun: false });
    expect(plan.applied).toBe(true);
    expect(plan.writes).toEqual(['ledger.jsonl']);

    const state = loadState(home, repoId);
    expect(state.decisions.get('d1')?.predicate?.value).toBe('왕복 후에도 남는다');
  });

  it('export는 원본을 1바이트도 바꾸지 않는다', () => {
    const before = fs.readFileSync(path.join(projectDir(home, repoId), 'ledger.jsonl'), 'utf8');
    exportBundle(home, repoId, bundle, T0);
    expect(fs.readFileSync(path.join(projectDir(home, repoId), 'ledger.jsonl'), 'utf8')).toBe(before);
  });
});

describe('import — 충돌·파손의 명시 거절', () => {
  it('dryRun은 계획만 — 아무것도 쓰지 않는다', () => {
    exportBundle(home, repoId, bundle, T0);
    purgeRepository(home, repoId, repoId);
    const plan = importBundle(home, bundle, { dryRun: true });
    expect(plan.writes).toEqual(['ledger.jsonl']);
    expect(plan.applied).toBe(false);
    expect(fs.existsSync(projectDir(home, repoId))).toBe(false);
  });

  it('대상에 다른 내용이 실존하면 conflict — 실적용을 거절하고 덮어쓰지 않는다', () => {
    exportBundle(home, repoId, bundle, T0);
    const target = path.join(projectDir(home, repoId), 'ledger.jsonl');
    fs.appendFileSync(target, LEDGER_LINE.replace('k1', 'k2').replace('d1', 'd2')); // 원장이 그새 자랐다
    const grown = fs.readFileSync(target, 'utf8');

    const plan = importBundle(home, bundle, { dryRun: false });
    expect(plan.conflicts).toEqual(['ledger.jsonl']);
    expect(plan.applied).toBe(false);
    expect(fs.readFileSync(target, 'utf8')).toBe(grown); // 무손상 — 자란 원장이 이긴다
  });

  it('동일 내용이 이미 있으면 충돌도 쓰기도 아니다 (멱등 재적용)', () => {
    exportBundle(home, repoId, bundle, T0);
    const plan = importBundle(home, bundle, { dryRun: false });
    expect(plan).toMatchObject({ writes: [], conflicts: [], applied: true });
  });

  it('번들 파손(해시 불일치)은 corrupted로 명시 — 조용히 심지 않는다', () => {
    exportBundle(home, repoId, bundle, T0);
    purgeRepository(home, repoId, repoId);
    fs.appendFileSync(path.join(bundle, 'ledger.jsonl'), '{tampered}\n');
    const plan = importBundle(home, bundle, { dryRun: false });
    expect(plan.corrupted).toEqual(['ledger.jsonl']);
    expect(plan.applied).toBe(false);
    expect(fs.existsSync(path.join(projectDir(home, repoId), 'ledger.jsonl'))).toBe(false);
  });
});

describe('purge — confirm 원문 강제', () => {
  it('confirm이 repository_id 원문이 아니면 거절, 아무것도 삭제 안 됨', () => {
    expect(() => purgeRepository(home, repoId, 'yes')).toThrow('PURGE_CONFIRM_MISMATCH');
    expect(fs.existsSync(path.join(projectDir(home, repoId), 'ledger.jsonl'))).toBe(true);
  });
});

describe('planOrPurgeV1Store — v1 워크스페이스 스토어 (erasure coverage, 1.4.7)', () => {
  const mkV1 = (): string => {
    const v1 = path.join(home, 'v1-store');
    for (const d of ['ledger', 'calendar', path.join('sessions', 'd1')]) fs.mkdirSync(path.join(v1, d), { recursive: true });
    fs.writeFileSync(path.join(v1, 'ledger', 'ledger.jsonl'), '{"id":"d1"}\n');
    fs.writeFileSync(path.join(v1, 'calendar', 'd1.ics'), 'BEGIN:VCALENDAR\n');
    fs.writeFileSync(path.join(v1, 'sessions', 'd1', 'receipt.json'), '{}\n');
    fs.writeFileSync(path.join(v1, 'config.yaml'), 'locale: ko\n');
    return v1;
  };

  it('confirm 원문 불일치·상대경로는 거절, 아무것도 안 지움', () => {
    const v1 = mkV1();
    expect(() => planOrPurgeV1Store(v1, { dryRun: false, confirmation: 'yes' })).toThrow('PURGE_CONFIRM_MISMATCH');
    expect(() => planOrPurgeV1Store('relative/.argus', { dryRun: false, confirmation: 'relative/.argus' })).toThrow('V1_PURGE_DIR_NOT_ABSOLUTE');
    expect(fs.existsSync(path.join(v1, 'ledger', 'ledger.jsonl'))).toBe(true);
  });

  it('dryRun은 대상 목록만 보고하고 아무것도 지우지 않는다', () => {
    const v1 = mkV1();
    const plan = planOrPurgeV1Store(v1, { dryRun: true, confirmation: v1 });
    expect(plan.targets.length).toBe(3);
    expect(plan.removed).toBe(0);
    expect(fs.existsSync(path.join(v1, 'ledger'))).toBe(true);
  });

  it('실행은 ledger/calendar/sessions만 지우고 config.yaml은 남긴다', () => {
    const v1 = mkV1();
    const res = planOrPurgeV1Store(v1, { dryRun: false, confirmation: v1 });
    expect(res.removed).toBe(3);
    expect(fs.existsSync(path.join(v1, 'ledger'))).toBe(false);
    expect(fs.existsSync(path.join(v1, 'calendar'))).toBe(false);
    expect(fs.existsSync(path.join(v1, 'sessions'))).toBe(false);
    expect(fs.existsSync(path.join(v1, 'config.yaml'))).toBe(true);
  });
});

describe('doctorBackup — 마이그레이션 전 백업 부품', () => {
  it('원장 사본을 backups/에 남기고 원본은 무변화', () => {
    const p = doctorBackup(home, repoId, T0);
    expect(p).toContain(path.join('backups', 'ledger-'));
    expect(fs.readFileSync(p, 'utf8')).toBe(LEDGER_LINE);
    expect(fs.readFileSync(path.join(projectDir(home, repoId), 'ledger.jsonl'), 'utf8')).toBe(LEDGER_LINE);
  });
});

describe('JCR J8 portable archive v2', () => {
  it('dry-run → exact purge → restore preserves reducer state, legacy marker, and registry binding', () => {
    fs.writeFileSync(path.join(projectDir(home, repoId), 'v1-migration.json'), '{"status":"migrated"}\n');
    const manifest = exportPortableLocalArchive(home, repoId, bundle, T0);
    expect(manifest).toMatchObject({ bundle_version: 2, secrets_excluded: true });
    expect(manifest.files.map((file) => file.path)).toContain('legacy/v1-migration.json');

    const dryRestore = restorePortableLocalArchive(home, bundle, {
      dryRun: true, repositoryConfirmation: repoId,
    });
    expect(dryRestore).toMatchObject({ applied: false, conflicts: [], corrupted: [], unsupported: [] });

    const dryPurge = planOrPurgeRepository(home, repoId, { dryRun: true, confirmation: repoId });
    expect(dryPurge).toMatchObject({ dry_run: true, removed_project_dir: false });
    expect(dryPurge.registry_paths).toHaveLength(1);
    expect(dryPurge.registry_paths[0]).toMatch(/\.git$/);
    expect(fs.existsSync(path.join(projectDir(home, repoId), 'ledger.jsonl'))).toBe(true);

    const purged = planOrPurgeRepository(home, repoId, { dryRun: false, confirmation: repoId });
    expect(purged).toMatchObject({ removed_project_dir: true, removed_registry_entries: 1 });
    const restored = restorePortableLocalArchive(home, bundle, {
      dryRun: false, repositoryConfirmation: repoId, gitCommonDir: path.join(repoDir, '.git'),
    });
    expect(restored).toMatchObject({ applied: true, semantic_parity: true, registry_bound: true });
    expect(loadState(home, repoId).decisions.get('d1')?.predicate?.value).toBe('왕복 후에도 남는다');
    expect(fs.readFileSync(path.join(projectDir(home, repoId), 'v1-migration.json'), 'utf8')).toContain('migrated');
    expect(lookupRepository(home, path.join(repoDir, '.git'))).toBe(repoId);
  });

  it('rejects corrupt, symlinked, unmanifested, secret-bearing, and misconfirmed input', () => {
    exportPortableLocalArchive(home, repoId, bundle, T0);
    expect(() => restorePortableLocalArchive(home, bundle, {
      dryRun: true, repositoryConfirmation: 'wrong',
    })).toThrow('CONFIRMATION_MISMATCH');
    expect(() => planOrPurgeRepository(home, '../../outside', {
      dryRun: false, confirmation: '../../outside',
    })).toThrow('INVALID_REPOSITORY_ID');

    fs.appendFileSync(path.join(bundle, `events/projects/${encodeURIComponent(repoId)}.jsonl`), '{}\n');
    expect(restorePortableLocalArchive(home, bundle, {
      dryRun: true, repositoryConfirmation: repoId,
    }).corrupted).toContain(`events/projects/${encodeURIComponent(repoId)}.jsonl`);

    fs.rmSync(bundle, { recursive: true, force: true });
    fs.mkdirSync(bundle);
    exportPortableLocalArchive(home, repoId, bundle, T0);
    fs.writeFileSync(path.join(bundle, 'unexpected'), 'x');
    expect(() => restorePortableLocalArchive(home, bundle, {
      dryRun: true, repositoryConfirmation: repoId,
    })).toThrow('ARCHIVE_UNMANIFESTED_OR_MISSING_FILE');

    fs.rmSync(bundle, { recursive: true, force: true });
    fs.mkdirSync(bundle);
    exportPortableLocalArchive(home, repoId, bundle, T0);
    const archivedStream = path.join(bundle, `events/projects/${encodeURIComponent(repoId)}.jsonl`);
    fs.rmSync(archivedStream);
    // Windows는 무권한 프로세스가 symlink를 만들 수 없다(EPERM — 관리자/개발자
    // 모드 필요). 픽스처 생성이 불가능한 환경에서는 이 거부 케이스만 건너뛴다
    // — 검증 대상(restore의 symlink 거부)이 아니라 테스트 준비물이 막힌 것.
    let symlinkMade = false;
    try {
      fs.symlinkSync(path.join(projectDir(home, repoId), 'ledger.jsonl'), archivedStream);
      symlinkMade = true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EPERM') throw e;
      fs.writeFileSync(archivedStream, ''); // 다음 단계 준비를 위해 자리만 복원
    }
    if (symlinkMade) {
      expect(() => restorePortableLocalArchive(home, bundle, {
        dryRun: true, repositoryConfirmation: repoId,
      })).toThrow('ARCHIVE_SYMLINK_FORBIDDEN');
    }

    fs.rmSync(bundle, { recursive: true, force: true });
    fs.mkdirSync(bundle);
    fs.appendFileSync(path.join(projectDir(home, repoId), 'ledger.jsonl'), LEDGER_LINE
      .replace('k1', 'secret-key').replace('d1', 'secret-decision')
      .replace('왕복 후에도 남는다', 'sk-proj-12345678901234567890'));
    expect(() => exportPortableLocalArchive(home, repoId, bundle, T0)).toThrow('ARCHIVE_SECRET_BLOCKED');
  });
});
