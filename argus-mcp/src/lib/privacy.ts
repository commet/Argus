import fs from 'fs/promises';
import path from 'path';

/**
 * Ensure the `.argus/.gitignore` keeps private decision data out of git
 * (SECURITY.md: ".argus holds private decisions, gitignored"). Idempotent.
 */
export async function ensurePrivacyGitignore(argusDir: string): Promise<void> {
  const gitignorePath = path.join(argusDir, '.gitignore');
  try {
    const existing = await fs.readFile(gitignorePath, 'utf8').catch(() => '');
    const lines = new Set(existing.split('\n').map((l) => l.trim()));
    const needed = ['sessions/', 'ledger/', 'config.yaml', '.bound'];
    const toAdd = needed.filter((n) => !lines.has(n));
    if (toAdd.length) {
      await fs.mkdir(argusDir, { recursive: true });
      await fs.appendFile(gitignorePath, (existing && !existing.endsWith('\n') ? '\n' : '') + toAdd.join('\n') + '\n');
    }
  } catch {
    /* non-critical */
  }
}
