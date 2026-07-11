/**
 * initV2 — 명시적 바인딩의 동사 (정본 II-D · II-F).
 *
 * INIT_REQUIRED가 안내하는 그 init이 하는 일 전부:
 *  1. registry에 git_common_dir → repository_id(UUID) 등록 (재실행 멱등 —
 *     이미 등록돼 있으면 같은 id를 돌려준다. 실경로 해시 금지 조항 그대로.)
 *  2. worktree .argus에 workspace 바인딩(project.json) 생성/재사용.
 *  3. v1 원장 자동 발견 + 내구 위치로 **복사** 이전 (II-F 명시 후보 2곳:
 *     <project>/.argus/ledger/ledger.jsonl · ~/.argus/ledger/ledger.jsonl).
 *     원본 무접촉, 재실행 no-op. 발견 결과는 전부 보고에 담는다 — 이전이
 *     일어났는지 사용자가 알 수 없으면 정직한 이전이 아니다.
 *
 * 여기 없는 것(의도): 원장 파일 생성 — 첫 이벤트가 만든다. 빈 원장 파일을
 * 미리 만들면 "결정 0건"과 "설치만 됨"이 파일 존재로 구분 불가능해진다.
 */
import path from 'node:path';
import { lookupRepository, registerRepository } from './ledger.js';
import { workspaceBinding } from './bridge.js';
import { migrateV1Ledger, v1CandidatePaths, type MigrationResult } from './v1-reader.js';

export interface InitReport {
  repository_id: string;
  workspace_id: string;
  /** true = 이 호출이 새로 등록했다. false = 이미 등록돼 있었다(멱등 재실행). */
  newly_registered: boolean;
  /** 후보 경로별 v1 이전 결과 — copied / already_migrated / source_missing. */
  v1_migration: Array<{ source: string } & MigrationResult>;
}

export function initV2(args: {
  home: string;
  gitCommonDir: string;
  /** worktree의 .argus (projection·바인딩 전용 — 원장은 여기 안 산다). */
  workspaceArgusDir: string;
  /** v1 원장 발견 기준이 되는 프로젝트 루트 (관례상 workspaceArgusDir의 부모). */
  projectRoot?: string;
}): InitReport {
  const existing = lookupRepository(args.home, args.gitCommonDir);
  const repositoryId = existing ?? registerRepository(args.home, args.gitCommonDir);
  const binding = workspaceBinding(args.workspaceArgusDir, repositoryId);

  const projectRoot = args.projectRoot ?? path.dirname(args.workspaceArgusDir);
  const v1_migration: InitReport['v1_migration'] = [];
  for (const source of v1CandidatePaths(projectRoot, args.home)) {
    // MIGRATION_CONFLICT는 삼키지 않는다 — 사람이 봐야 하는 상황이므로 그대로 던진다.
    v1_migration.push({ source, ...migrateV1Ledger(args.home, repositoryId, source) });
  }

  return {
    repository_id: repositoryId,
    workspace_id: binding.workspace_id,
    newly_registered: existing === null,
    v1_migration,
  };
}
