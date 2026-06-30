import fs from 'fs/promises';
import path from 'path';
import { versionDir } from '../lib/layout.js';
import { atomicWriteJson } from '../lib/atomic-write.js';
import { ok, err, type ToolResult } from './types.js';

export async function argus_version_write(args: {
  argus_dir: string;
  session_id: string;
  label: string;
  filename: string;
  content: unknown;
  overwrite?: boolean;
}): Promise<ToolResult> {
  try {
    const dir = versionDir(args.argus_dir, args.session_id, args.label);
    const filePath = path.join(dir, args.filename);
    if (!args.overwrite) {
      try {
        await fs.access(filePath);
        return err('file_exists', `${filePath} already exists. Pass overwrite:true to replace.`);
      } catch { /* doesn't exist, proceed */ }
    }
    const data = typeof args.content === 'string' ? JSON.parse(args.content) : args.content;
    await atomicWriteJson(filePath, data);
    return ok({ written: true, path: filePath });
  } catch (e) {
    return err('version_write_failed', String(e));
  }
}

export async function argus_version_read(args: {
  argus_dir: string;
  session_id: string;
  label: string;
  filename: string;
}): Promise<ToolResult> {
  const filePath = path.join(versionDir(args.argus_dir, args.session_id, args.label), args.filename);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    try {
      return ok({ content: JSON.parse(raw) });
    } catch {
      return ok({ content: raw });
    }
  } catch (e) {
    const msg = String(e);
    if (msg.includes('ENOENT')) return ok({ error: 'missing', path: filePath });
    return err('version_read_failed', String(e));
  }
}

export async function argus_version_list(args: {
  argus_dir: string;
  session_id: string;
}): Promise<ToolResult> {
  const sessDir = path.join(args.argus_dir, 'sessions', args.session_id, 'versions');
  try {
    let labels: string[];
    try { labels = await fs.readdir(sessDir); } catch { return ok({ versions: [] }); }
    const versions = await Promise.all(labels.map(async (label) => {
      const vDir = path.join(sessDir, label);
      try {
        const files = await fs.readdir(vDir);
        return { label, files };
      } catch {
        return { label, files: [] };
      }
    }));
    return ok({ versions });
  } catch (e) {
    return err('version_list_failed', String(e));
  }
}
