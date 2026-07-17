import path from 'node:path';
import { argusHome } from './ledger.js';
import {
  exportPortableLocalArchive,
  planOrPurgeRepository,
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
    const confirmation = flag(args, '--confirm-repository');
    if (!repositoryId || !confirmation) throw new Error('--repository-id and --confirm-repository are required');
    const result = planOrPurgeRepository(home, repositoryId, {
      dryRun: args.includes('--dry-run'), confirmation,
    });
    process.stdout.write(JSON.stringify(result) + '\n');
    return;
  }
  throw new Error(`unknown lifecycle command: ${command}`);
}
