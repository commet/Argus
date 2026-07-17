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
import { projectDir, readRegistry, registerRepository, registryPath } from './ledger.js';
import { ArgusEventSchema } from './events.js';
import { loadState } from './reducer.js';

/** 번들에 담는 내구 파일 목록 — 프로젝트 디렉토리 기준 상대 이름.
 *  새 내구 파일이 생기면 여기 추가 (lifecycle.test가 실존 파일과 대조). */
export const DURABLE_FILES = ['ledger.jsonl', 'ledger.v1.jsonl', 'v1-migration.json'] as const;

const sha256 = (p: string): string =>
  crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

const assertRepositoryId = (value: string): void => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('INVALID_REPOSITORY_ID');
  }
};

export interface BundleManifest {
  bundle_version: 1;
  repository_id: string;
  exported_at: string;
  files: { name: string; sha256: string; bytes: number }[];
}

function validBundleFile(value: unknown): value is BundleManifest['files'][number] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const file = value as Record<string, unknown>;
  return typeof file.name === 'string' && DURABLE_FILES.includes(file.name as typeof DURABLE_FILES[number])
    && typeof file.sha256 === 'string' && /^[a-f0-9]{64}$/.test(file.sha256)
    && Number.isSafeInteger(file.bytes) && Number(file.bytes) >= 0;
}

export function exportBundle(
  home: string, repositoryId: string, bundleDir: string, nowIso: string,
): BundleManifest {
  assertRepositoryId(repositoryId);
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
  assertRepositoryId(manifest.repository_id);
  if (manifest.bundle_version !== 1 || !Array.isArray(manifest.files)
    || manifest.files.length > DURABLE_FILES.length
    || !manifest.files.every(validBundleFile)
    || new Set(manifest.files.map((file) => file.name)).size !== manifest.files.length
  ) {
    throw new Error('IMPORT_MANIFEST_INVALID');
  }
  const dst = projectDir(home, manifest.repository_id);
  const plan: ImportPlan = {
    repository_id: manifest.repository_id, writes: [], conflicts: [], corrupted: [], applied: false,
  };

  for (const f of manifest.files) {
    const src = path.join(bundleDir, f.name);
    if (!fs.existsSync(src)) { plan.corrupted.push(f.name); continue; }
    const sourceStat = fs.lstatSync(src);
    if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || sourceStat.size !== f.bytes
      || sha256(src) !== f.sha256) { plan.corrupted.push(f.name); continue; }
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
  assertRepositoryId(repositoryId);
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
  assertRepositoryId(repositoryId);
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

// JCR J8 portable local archive. The v1 helpers above remain readable for
// compatibility; new exports use the common archive layout and stricter gates.
export interface PortableLocalManifest {
  bundle_version: 2;
  schema_version: 1;
  minimum_reader_version: 1;
  repository_id: string;
  exported_at: string;
  stream: { count: number; cursor: string | null };
  semantic_checksum: string;
  files: Array<{ path: string; sha256: string; bytes: number; media_type: string }>;
  encryption_truth: 'plaintext_local_directory';
  signature: { status: 'unsigned_local' };
  secrets_excluded: true;
}

function validPortableFile(value: unknown): value is PortableLocalManifest['files'][number] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const file = value as Record<string, unknown>;
  return typeof file.path === 'string' && portablePathSafe(file.path)
    && typeof file.sha256 === 'string' && /^[a-f0-9]{64}$/.test(file.sha256)
    && Number.isSafeInteger(file.bytes) && Number(file.bytes) >= 0
    && typeof file.media_type === 'string' && file.media_type.length > 0;
}

const portablePathSafe = (name: string): boolean => name.length > 0 && name.length <= 512
  && !name.includes('\\') && !name.includes('\0') && !path.isAbsolute(name)
  && name.split('/').every((part) => part !== '' && part !== '.' && part !== '..');

const pathInside = (root: string, relative: string): string => {
  if (!portablePathSafe(relative)) throw new Error(`ARCHIVE_UNSAFE_PATH:${relative}`);
  const target = path.resolve(root, relative);
  const prefix = `${path.resolve(root)}${path.sep}`;
  if (!target.startsWith(prefix)) throw new Error(`ARCHIVE_PATH_ESCAPE:${relative}`);
  return target;
};

function canonicalValue(value: unknown): unknown {
  if (value instanceof Map) return [...value.entries()]
    .map(([key, item]) => [String(key), canonicalValue(item)] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  if (value instanceof Set) return [...value].map(canonicalValue).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonicalValue(item)]),
  );
  return value;
}

function localSemanticChecksum(state: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalValue(state))).digest('hex');
}

function scanArchiveFiles(root: string, relative = ''): string[] {
  const dir = relative ? pathInside(root, relative) : root;
  const result: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const rel = relative ? `${relative}/${name}` : name;
    const target = pathInside(root, rel);
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) throw new Error(`ARCHIVE_SYMLINK_FORBIDDEN:${rel}`);
    if (stat.isDirectory()) result.push(...scanArchiveFiles(root, rel));
    else if (stat.isFile()) result.push(rel);
    else throw new Error(`ARCHIVE_NON_FILE_FORBIDDEN:${rel}`);
  }
  return result.sort();
}

function containsPortableSecret(text: string): boolean {
  return /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i.test(text)
    || /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}/i.test(text)
    || /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{16,}|AKIA[0-9A-Z]{16})\b/.test(text)
    || /\b(?:password|passwd|api[_-]?key|secret|token)\s*[:=]\s*[^\s,;]{8,}/i.test(text)
    || /["'](?:password|passwd|api[_-]?key|secret|token)["']\s*:\s*["'][^"']{8,}["']/i.test(text);
}

export function exportPortableLocalArchive(
  home: string, repositoryId: string, archiveDir: string, nowIso: string,
): PortableLocalManifest {
  assertRepositoryId(repositoryId);
  if (fs.existsSync(archiveDir) && fs.readdirSync(archiveDir).length > 0) {
    throw new Error('ARCHIVE_TARGET_NOT_EMPTY');
  }
  const source = ledgerPathFor(home, repositoryId);
  const raw = fs.readFileSync(source);
  if (raw.byteLength > 64 * 1024 * 1024) throw new Error('ARCHIVE_SOURCE_SIZE_LIMIT');
  const sourceText = raw.toString('utf8');
  if (containsPortableSecret(sourceText)) {
    throw new Error('ARCHIVE_SECRET_BLOCKED');
  }
  const parsed = sourceText.split('\n').flatMap((line) => {
    if (!line.trim()) return [];
    try { return [JSON.parse(line)]; } catch { throw new Error('ARCHIVE_SOURCE_CORRUPT'); }
  });
  for (const event of parsed) if (!ArgusEventSchema.safeParse(event).success) throw new Error('ARCHIVE_SOURCE_UNSUPPORTED_EVENT');
  const relative = `events/projects/${encodeURIComponent(repositoryId)}.jsonl`;
  const target = pathInside(archiveDir, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, raw);
  const exportReceipt = pathInside(archiveDir, 'receipts/export.json');
  fs.mkdirSync(path.dirname(exportReceipt), { recursive: true });
  fs.writeFileSync(exportReceipt, JSON.stringify({ repository_id: repositoryId, exported_at: nowIso }) + '\n');
  const archiveNames = [relative, 'receipts/export.json'];
  for (const legacyName of DURABLE_FILES.slice(1)) {
    const legacySource = path.join(projectDir(home, repositoryId), legacyName);
    if (!fs.existsSync(legacySource)) continue;
    const legacyBytes = fs.readFileSync(legacySource);
    if (containsPortableSecret(legacyBytes.toString('utf8'))) throw new Error(`ARCHIVE_SECRET_BLOCKED:${legacyName}`);
    const legacyRelative = `legacy/${legacyName}`;
    const legacyTarget = pathInside(archiveDir, legacyRelative);
    fs.mkdirSync(path.dirname(legacyTarget), { recursive: true });
    fs.copyFileSync(legacySource, legacyTarget);
    archiveNames.push(legacyRelative);
  }
  const files = archiveNames.map((name) => {
    const file = pathInside(archiveDir, name);
    return {
      path: name, sha256: sha256(file), bytes: fs.statSync(file).size,
      media_type: name.endsWith('.jsonl') ? 'application/x-ndjson' : 'application/json',
    };
  });
  const manifest: PortableLocalManifest = {
    bundle_version: 2, schema_version: 1, minimum_reader_version: 1,
    repository_id: repositoryId, exported_at: nowIso,
    stream: { count: parsed.length, cursor: String(parsed.at(-1)?.event_id ?? '') || null },
    semantic_checksum: localSemanticChecksum(loadState(home, repositoryId)),
    files, encryption_truth: 'plaintext_local_directory', signature: { status: 'unsigned_local' },
    secrets_excluded: true,
  };
  fs.mkdirSync(archiveDir, { recursive: true });
  const manifestTmp = path.join(archiveDir, 'manifest.json.tmp');
  fs.writeFileSync(manifestTmp, JSON.stringify(manifest, null, 2) + '\n');
  fs.renameSync(manifestTmp, path.join(archiveDir, 'manifest.json'));
  return manifest;
}

function ledgerPathFor(home: string, repositoryId: string): string {
  return path.join(projectDir(home, repositoryId), 'ledger.jsonl');
}

export interface PortableRestorePlan extends ImportPlan {
  unsupported: string[];
  semantic_parity: boolean;
  registry_bound: boolean;
}

export function restorePortableLocalArchive(
  home: string,
  archiveDir: string,
  opts: { dryRun: boolean; gitCommonDir?: string; repositoryConfirmation: string },
): PortableRestorePlan {
  const manifestFile = path.join(archiveDir, 'manifest.json');
  const manifestStat = fs.lstatSync(manifestFile);
  if (!manifestStat.isFile() || manifestStat.isSymbolicLink() || manifestStat.size > 2_000_000) {
    throw new Error('ARCHIVE_MANIFEST_INVALID');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')) as PortableLocalManifest;
  assertRepositoryId(manifest.repository_id);
  if (manifest.bundle_version !== 2 || manifest.schema_version !== 1 || manifest.minimum_reader_version > 1
    || opts.repositoryConfirmation !== manifest.repository_id || !Array.isArray(manifest.files)
    || !manifest.files.every(validPortableFile)
    || !manifest.stream || !Number.isSafeInteger(manifest.stream.count) || manifest.stream.count < 0
    || !/^[a-f0-9]{64}$/.test(manifest.semantic_checksum)) {
    throw new Error('ARCHIVE_MANIFEST_UNSUPPORTED_OR_CONFIRMATION_MISMATCH');
  }
  const plan: PortableRestorePlan = {
    repository_id: manifest.repository_id, writes: [], conflicts: [], corrupted: [], unsupported: [],
    applied: false, semantic_parity: false, registry_bound: false,
  };
  if (manifest.files.length > 10_000 || new Set(manifest.files.map((entry) => entry.path)).size !== manifest.files.length) {
    throw new Error('ARCHIVE_FILE_MANIFEST_INVALID');
  }
  const actualFiles = scanArchiveFiles(archiveDir);
  const expectedFiles = ['manifest.json', ...manifest.files.map((entry) => entry.path)].sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) throw new Error('ARCHIVE_UNMANIFESTED_OR_MISSING_FILE');
  let total = 0;
  for (const entry of manifest.files) {
    if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      plan.corrupted.push(entry.path); continue;
    }
    const source = pathInside(archiveDir, entry.path);
    let stat: fs.Stats;
    try { stat = fs.lstatSync(source); } catch { plan.corrupted.push(entry.path); continue; }
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== entry.bytes || stat.size > 64 * 1024 * 1024) {
      plan.corrupted.push(entry.path); continue;
    }
    total += stat.size;
    if (total > 128 * 1024 * 1024 || sha256(source) !== entry.sha256) plan.corrupted.push(entry.path);
  }
  const streamPath = `events/projects/${encodeURIComponent(manifest.repository_id)}.jsonl`;
  const stream = pathInside(archiveDir, streamPath);
  if (!manifest.files.some((file) => file.path === streamPath)) plan.corrupted.push(streamPath);
  if (plan.corrupted.length === 0) {
    const rows = fs.readFileSync(stream, 'utf8').split('\n').flatMap((line) => {
      if (!line.trim()) return [];
      try { return [JSON.parse(line)]; } catch { plan.unsupported.push('invalid_json'); return []; }
    });
    if (rows.length !== manifest.stream.count) plan.corrupted.push(streamPath);
    for (const row of rows) {
      const parsed = ArgusEventSchema.safeParse(row);
      if (!parsed.success) plan.unsupported.push(String(row?.event_id ?? 'unknown'));
    }
  }
  if (plan.corrupted.length || plan.unsupported.length) return plan;
  const target = ledgerPathFor(home, manifest.repository_id);
  if (fs.existsSync(target)) {
    if (sha256(target) !== sha256(stream)) plan.conflicts.push('ledger.jsonl');
  } else plan.writes.push('ledger.jsonl');
  for (const entry of manifest.files.filter((file) => file.path.startsWith('legacy/'))) {
    const name = entry.path.slice('legacy/'.length);
    if (!DURABLE_FILES.slice(1).includes(name as typeof DURABLE_FILES[number])) {
      plan.unsupported.push(entry.path); continue;
    }
    const legacyTarget = path.join(projectDir(home, manifest.repository_id), name);
    if (fs.existsSync(legacyTarget)) {
      if (sha256(legacyTarget) !== entry.sha256) plan.conflicts.push(name);
    } else plan.writes.push(name);
  }
  if (opts.dryRun || plan.conflicts.length || plan.corrupted.length || plan.unsupported.length) return plan;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (plan.writes.length) {
    for (const name of plan.writes) {
      const destination = path.join(projectDir(home, manifest.repository_id), name);
      const source = name === 'ledger.jsonl' ? stream : pathInside(archiveDir, `legacy/${name}`);
      const tmp = `${destination}.restore-tmp`;
      fs.copyFileSync(source, tmp);
      fs.renameSync(tmp, destination);
    }
  }
  if (opts.gitCommonDir) {
    registerRepository(home, opts.gitCommonDir, manifest.repository_id);
    plan.registry_bound = true;
  }
  plan.semantic_parity = localSemanticChecksum(loadState(home, manifest.repository_id)) === manifest.semantic_checksum;
  plan.applied = plan.semantic_parity;
  return plan;
}

export interface RepositoryPurgePlan extends PurgeResult {
  repository_id: string;
  project_path: string;
  registry_paths: string[];
  dry_run: boolean;
}

export function planOrPurgeRepository(
  home: string, repositoryId: string, opts: { dryRun: boolean; confirmation: string },
): RepositoryPurgePlan {
  assertRepositoryId(repositoryId);
  if (opts.confirmation !== repositoryId) throw new Error('PURGE_CONFIRM_MISMATCH');
  const target = projectDir(home, repositoryId);
  const registry = readRegistry(home);
  const registryPaths = Object.entries(registry.repositories).filter(([, id]) => id === repositoryId).map(([p]) => p);
  if (opts.dryRun) return {
    repository_id: repositoryId, project_path: target, registry_paths: registryPaths,
    removed_project_dir: false, removed_registry_entries: 0, dry_run: true,
  };
  const result = purgeRepository(home, repositoryId, repositoryId);
  return { repository_id: repositoryId, project_path: target, registry_paths: registryPaths, ...result, dry_run: false };
}
