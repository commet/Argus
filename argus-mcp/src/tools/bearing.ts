import fs from 'fs/promises';
import path from 'path';
import { versionDir } from '../lib/layout.js';
import { atomicWriteJson } from '../lib/atomic-write.js';
import { ok, err, type ToolResult } from './types.js';

const BEARING_NAMES = ['current_bearing.json', 'current-bearing.json'];

export async function argus_bearing_write(args: {
  argus_dir: string;
  session_id: string;
  label: string;
  bearing: Record<string, unknown>;
}): Promise<ToolResult> {
  try {
    const dir = versionDir(args.argus_dir, args.session_id, args.label);
    const filePath = path.join(dir, 'current_bearing.json');
    await atomicWriteJson(filePath, args.bearing);
    const contractSeed = args.bearing['contract_seed'] as Record<string, unknown> | undefined;
    return ok({
      written: true,
      path: filePath,
      has_contract_seed: !!contractSeed,
      contract_seed: contractSeed ?? null,
    });
  } catch (e) {
    return err('bearing_write_failed', String(e));
  }
}

export async function argus_bearing_read(args: {
  argus_dir: string;
  session_id: string;
  label: string | null;
}): Promise<ToolResult> {
  try {
    const dirs = args.label
      ? [versionDir(args.argus_dir, args.session_id, args.label)]
      : [path.join(args.argus_dir, 'sessions', args.session_id)];

    for (const dir of dirs) {
      for (const name of BEARING_NAMES) {
        try {
          const raw = await fs.readFile(path.join(dir, name), 'utf8');
          return ok({ bearing: JSON.parse(raw), filename: name });
        } catch { /* try next */ }
      }
    }
    return ok({ error: 'missing' });
  } catch (e) {
    return err('bearing_read_failed', String(e));
  }
}
