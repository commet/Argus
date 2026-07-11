/**
 * 데이터 수명주기 (P4-3) — 정본 규칙 21 / II-F: "데이터 수명주기는 출시 조건".
 *
 * 이 모듈은 CLI 껍데기가 아니라 순수 파일 연산 4종이다 (껍데기는 나중에
 * 이 함수들을 그대로 감싼다 — 두뇌를 CLI 파싱과 섞지 않는다):
 *
 *  - exportBundle: 프로젝트의 내구 파일 전부(원장·v1 스냅샷·이전 marker)를
 *    번들 디렉토리로 **사본** 복사 + manifest.json(파일별 sha256). 원본은
 *    절대 건드리지 않는다.
 *  - importBundle(dryRun): manifest 대조 → 충돌(대상에 다른 내용 실존)은
 *    **명시 거절** — 조용한 덮어쓰기 금지. dryRun은 계획만 돌려준다
 *    (무엇이 쓰일지/충돌인지). 실적용은 tmp+rename.
 *  - purgeRepository: confirm에 repository_id 원문을 요구한다 (II-F의
 *    --confirm — 실수 삭제 방지는 UI 경고가 아니라 API 형태로 강제).
 *    프로젝트 디렉토리 삭제 + registry 항목 제거.
 *  - doctorBackup: 원장 사본을 backups/에 남긴다 (마이그레이션 전 자동
 *    백업의 재사용 부품).
 *
 * 공통 원칙: 어떤 함수도 조용히 실패하지 않는다 — 결과 객체에 한 일과
 * 못 한 일을 전부 적는다 (honest-gap). 시간은 호출자 주입(nowIso).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { projectDir, readRegistry, registryPath } from './ledger.js';

/** 번들에 담는 내구 파일 목록 — 프로젝트 디렉토리 기준 상대 이름.
 *  새 내구 파일이 생기면 여기 추가 (lifecycle.test가 실존 파일과 대조). */
export const DURABLE_FILES = ['ledger.jsonl', 'ledger.v1.jsonl', 'v1-migration.json'] as const;

const sha256 = (p: string): string =>
  crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

export interface BundleManifest {
  bundle_version: 1;
  repository_id: string;
  exported_at: string;
  files: { name: string; sha256: string; bytes: number }[];
}

export function exportBundle(
  home: string, repositoryId: string, bundleDir: string, nowIso: string,
): BundleManifest {
  const src = projectDir(home, repositoryId);
  if (!fs.existsSync(path.join(src, 'ledger.jsonl'))) {
    throw new Error(`EXPORT_NOTHING: ${path.join(src, 'ledger.jsonl')} does not exist — nothing durable to export`);
  }
  fs.mkdirSync(bundleDir, { recursive: true });
  const manifest: BundleManifest = {
    bundle_version: 1, repository_id: repositoryId, exported_at: nowIso, files: [],
  };
  for (const name of DURABLE_FILES) {
    const from = path.join(src, name);
    if (!fs.existsSync(from)) continue; // v1 스냅샷·marker는 없을 수 있다 — 있는 것만
    const to = path.join(bundleDir, name);
    fs.copyFileSync(from, to);
    manifest.files.push({ name, sha256: sha256(to), bytes: fs.statSync(to).size });
  }
  const tmp = path.join(bundleDir, 'manifest.json.tmp');
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2));
  fs.renameSync(tmp, path.join(bundleDir, 'manifest.json'));
  return manifest;
}

export interface ImportPlan {
  repository_id: string;
  /** 그대로 쓸 파일 (대상 부재 또는 동일 내용). */
  writes: string[];
  /** 대상에 **다른** 내용이 실존 — 명시 거절 대상. */
  conflicts: string[];
  /** 번들 내용물이 manifest 해시와 다름 — 파손/변조. */
  corrupted: string[];
  applied: boolean;
}

export function importBundle(
  home: string, bundleDir: string, opts: { dryRun: boolean },
): ImportPlan {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(bundleDir, 'manifest.json'), 'utf8'),
  ) as BundleManifest;
  const dst = projectDir(home, manifest.repository_id);
  const plan: ImportPlan = {
    repository_id: manifest.repository_id, writes: [], conflicts: [], corrupted: [], applied: false,
  };

  for (const f of manifest.files) {
    const src = path.join(bundleDir, f.name);
    if (!fs.existsSync(src) || sha256(src) !== f.sha256) { plan.corrupted.push(f.name); continue; }
    const target = path.join(dst, f.name);
    if (fs.existsSync(target)) {
      if (sha256(target) === f.sha256) continue; // 이미 동일 — 쓸 것도 충돌도 아님
      plan.conflicts.push(f.name);
      continue;
    }
    plan.writes.push(f.name);
  }

  if (opts.dryRun || plan.conflicts.length > 0 || plan.corrupted.length > 0) return plan;

  fs.mkdirSync(dst, { recursive: true });
  for (const name of plan.writes) {
    const tmp = path.join(dst, `${name}.import-tmp`);
    fs.copyFileSync(path.join(bundleDir, name), tmp);
    fs.renameSync(tmp, path.join(dst, name));
  }
  plan.applied = true;
  return plan;
}

export interface PurgeResult {
  removed_project_dir: boolean;
  removed_registry_entries: number;
}

/** confirm에 repository_id 원문을 요구 — 실수 삭제 방지를 API 형태로 강제. */
export function purgeRepository(home: string, repositoryId: string, confirm: string): PurgeResult {
  if (confirm !== repositoryId) {
    throw new Error(`PURGE_CONFIRM_MISMATCH: pass the repository_id verbatim as confirm to delete ${repositoryId}`);
  }
  const dir = projectDir(home, repositoryId);
  const existed = fs.existsSync(dir);
  if (existed) fs.rmSync(dir, { recursive: true, force: true });

  let removed = 0;
  try {
    const registry = readRegistry(home);
    const entries = Object.entries(registry.repositories).filter(([, id]) => id === repositoryId);
    if (entries.length > 0) {
      for (const [key] of entries) { delete registry.repositories[key]; removed += 1; }
      const rPath = registryPath(home);
      const tmp = `${rPath}.purge-tmp`;
      fs.writeFileSync(tmp, JSON.stringify(registry, null, 2));
      fs.renameSync(tmp, rPath);
    }
  } catch { /* registry 부재/파손 — 프로젝트 삭제는 이미 끝났고, registry는 doctor가 보고한다 */ }
  return { removed_project_dir: existed, removed_registry_entries: removed };
}

/** 원장 사본 백업 — backups/ledger-<ts>.jsonl. 마이그레이션 전 자동 백업의 부품. */
export function doctorBackup(home: string, repositoryId: string, nowIso: string): string {
  const src = path.join(projectDir(home, repositoryId), 'ledger.jsonl');
  if (!fs.existsSync(src)) {
    throw new Error(`BACKUP_NOTHING: ${src} does not exist`);
  }
  const dir = path.join(projectDir(home, repositoryId), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `ledger-${nowIso.replace(/[:.]/g, '-')}.jsonl`);
  fs.copyFileSync(src, target);
  return target;
}
