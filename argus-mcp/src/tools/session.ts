import fs from 'fs/promises';
import path from 'path';
import { sessionDir, sessionsRoot } from '../lib/layout.js';
import { atomicWriteJson } from '../lib/atomic-write.js';
import { ok, err, type ToolResult } from './types.js';

async function quarantine(filePath: string): Promise<void> {
  try {
    await fs.rename(filePath, filePath + `.corrupt.${Date.now()}`);
  } catch { /* best effort */ }
}

export async function argus_session_create(args: {
  argus_dir: string;
  session: {
    id: string;
    problem_text: string;
    phase?: string;
    round?: number;
    max_rounds?: number;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
  };
}): Promise<ToolResult> {
  try {
    const dir = sessionDir(args.argus_dir, args.session.id);
    await fs.mkdir(dir, { recursive: true });
    const session = {
      phase: 'analyzing',
      round: 0,
      max_rounds: 3,
      ...args.session,
    };
    await atomicWriteJson(path.join(dir, 'session.json'), session);
    // Ensure .argus/.gitignore covers sessions/ and ledger/
    const gitignorePath = path.join(args.argus_dir, '.gitignore');
    try {
      const existing = await fs.readFile(gitignorePath, 'utf8').catch(() => '');
      const lines = new Set(existing.split('\n').map(l => l.trim()));
      const needed = ['sessions/', 'ledger/'];
      const toAdd = needed.filter(n => !lines.has(n));
      if (toAdd.length) await fs.appendFile(gitignorePath, '\n' + toAdd.join('\n') + '\n');
    } catch { /* non-critical */ }
    return ok({ created: true, id: args.session.id });
  } catch (e) {
    return err('session_create_failed', String(e));
  }
}

export async function argus_session_read(args: { argus_dir: string; session_id: string }): Promise<ToolResult> {
  const filePath = path.join(sessionDir(args.argus_dir, args.session_id), 'session.json');
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const session = JSON.parse(raw);
    return ok({ session });
  } catch (e) {
    const msg = String(e);
    if (msg.includes('ENOENT')) return ok({ error: 'missing' });
    await quarantine(filePath);
    return ok({ error: 'corrupt', quarantined_to: filePath + `.corrupt.${Date.now()}` });
  }
}

export async function argus_session_update(args: {
  argus_dir: string;
  session_id: string;
  patch: Record<string, unknown>;
}): Promise<ToolResult> {
  const filePath = path.join(sessionDir(args.argus_dir, args.session_id), 'session.json');
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const session = JSON.parse(raw) as Record<string, unknown>;
    const ALLOWED = ['phase', 'round', 'updated_at', 'classification', 'active_draft_id', 'repo_path', 'repo_branch'];
    for (const key of ALLOWED) {
      if (key in args.patch) session[key] = args.patch[key];
    }
    await atomicWriteJson(filePath, session);
    return ok({ updated: true });
  } catch (e) {
    return err('session_update_failed', String(e));
  }
}

export async function argus_session_list(args: { argus_dir: string }): Promise<ToolResult> {
  const root = sessionsRoot(args.argus_dir);
  try {
    let ids: string[];
    try { ids = await fs.readdir(root); } catch { return ok({ sessions: [] }); }
    const sessions = await Promise.all(ids.map(async (id) => {
      try {
        const raw = await fs.readFile(path.join(root, id, 'session.json'), 'utf8');
        const s = JSON.parse(raw) as Record<string, unknown>;
        return { id, problem_text: s['problem_text'], phase: s['phase'], created_at: s['created_at'] };
      } catch {
        return { id, error: 'corrupt' };
      }
    }));
    return ok({ sessions });
  } catch (e) {
    return err('session_list_failed', String(e));
  }
}
