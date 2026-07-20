import path from 'node:path';
import { argusHome } from './ledger.js';
import {
  exportPortableLocalArchive,
  planOrPurgeRepository,
  planOrPurgeV1Store,
  restorePortableLocalArchive,
} from './lifecycle.js';

const flag = (args: readonly string[], name: string): string | null => {
  const index = args.indexOf(name);
  return index >= 0 && typeof args[index + 1] === 'string' ? args[index + 1] : null;
};

function absolute(args: readonly string[], name: string): string {
  const value = flag(args, name);
  if (!value || !path.isAbsolute(value)) throw new Error(`${name} must be an absolute path`);
  return value;
}

export function runLifecycleCli(command: string, args: readonly string[]): void {
  const home = argusHome();
  if (command === 'archive-export') {
    const repositoryId = flag(args, '--repository-id');
    if (!repositoryId) throw new Error('--repository-id is required');
    const result = exportPortableLocalArchive(home, repositoryId, absolute(args, '--archive-dir'), new Date().toISOString());
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }
  if (command === 'archive-restore') {
    const confirmation = flag(args, '--confirm-repository');
    if (!confirmation) throw new Error('--confirm-repository is required');
    const gitCommonDir = flag(args, '--git-common-dir');
    if (gitCommonDir && !path.isAbsolute(gitCommonDir)) throw new Error('--git-common-dir must be absolute');
    const result = restorePortableLocalArchive(home, absolute(args, '--archive-dir'), {
      dryRun: args.includes('--dry-run'), repositoryConfirmation: confirmation,
      ...(gitCommonDir ? { gitCommonDir } : {}),
    });
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }
  if (command === 'local-purge') {
    const repositoryId = flag(args, '--repository-id');
    const v1Dir = flag(args, '--argus-dir');
    // v1 store coverage (1.4.6 backlog): purging only the v2 durable home left
    // the v1 `.argus/` ledger/receipts/calendar behind. Either target may be
    // purged alone, or both in one call; each keeps its own confirm-verbatim.
    if (!repositoryId && !v1Dir) throw new Error('--repository-id (v2 home) and/or --argus-dir (v1 store) is required');
    const dryRun = args.includes('--dry-run');
    const out: Record<string, unknown> = {};
    if (repositoryId) {
      const confirmation = flag(args, '--confirm-repository');
      if (!confirmation) throw new Error('--confirm-repository is required');
      out['repository'] = planOrPurgeRepository(home, repositoryId, { dryRun, confirmation });
    }
    if (v1Dir) {
      const v1Confirm = flag(args, '--confirm-argus-dir');
      if (!v1Confirm) throw new Error('--confirm-argus-dir is required (repeat the exact absolute path)');
      out['v1_store'] = planOrPurgeV1Store(v1Dir, { dryRun, confirmation: v1Confirm });
    }
    // Back-compat: a repository-only call keeps the original flat output shape.
    process.stdout.write(JSON.stringify(repositoryId && !v1Dir ? out['repository'] : out) + '\n');
    return;
  }
  throw new Error(`unknown lifecycle command: ${command}`);
}
