import * as fs from 'fs/promises';
import * as path from 'path';
import { versionDir } from '../lib/layout.js';
import { atomicWriteJson } from '../lib/atomic-write.js';

export interface Receipt {
  id: string;
  created_at: string;
  real_question: string;
  unverified_assumption: string;
  human_only: string;
  human_judgment: string;
  check_by: string;
  settled_at?: string;
  what_happened?: string;
  assumption_held?: boolean | null;
}

const RECEIPT_FILE = 'receipt.json';

export async function argus_receipt_write(args: {
  argus_dir: string;
  session_id: string;
  label: string;
  receipt: Partial<Receipt> & { id: string };
}): Promise<{ content: [{ type: 'text'; text: string }] }> {
  const { argus_dir, session_id, label, receipt } = args;
  const dir = versionDir(argus_dir, session_id, label);
  const filePath = path.join(dir, RECEIPT_FILE);

  let existing: Partial<Receipt> = {};
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    existing = JSON.parse(raw);
  } catch {
    // no existing receipt — fresh write
  }

  const merged: Receipt = {
    id: receipt.id,
    created_at: existing.created_at || new Date().toISOString(),
    real_question: receipt.real_question ?? existing.real_question ?? '',
    unverified_assumption: receipt.unverified_assumption ?? existing.unverified_assumption ?? '',
    human_only: receipt.human_only ?? existing.human_only ?? '',
    human_judgment: receipt.human_judgment ?? existing.human_judgment ?? '',
    check_by: receipt.check_by ?? existing.check_by ?? '',
    ...(receipt.settled_at || existing.settled_at ? { settled_at: receipt.settled_at ?? existing.settled_at } : {}),
    ...(receipt.what_happened || existing.what_happened ? { what_happened: receipt.what_happened ?? existing.what_happened } : {}),
    ...(receipt.assumption_held !== undefined || existing.assumption_held !== undefined
      ? { assumption_held: receipt.assumption_held !== undefined ? receipt.assumption_held : existing.assumption_held }
      : {}),
  };

  await atomicWriteJson(filePath, merged);

  return {
    content: [{ type: 'text', text: JSON.stringify({ ok: true, receipt: merged }) }],
  };
}

export async function argus_receipt_read(args: {
  argus_dir: string;
  session_id: string;
  label: string;
}): Promise<{ content: [{ type: 'text'; text: string }] }> {
  const { argus_dir, session_id, label } = args;
  const dir = versionDir(argus_dir, session_id, label);
  const filePath = path.join(dir, RECEIPT_FILE);

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const receipt = JSON.parse(raw) as Receipt;
    return {
      content: [{ type: 'text', text: JSON.stringify({ ok: true, receipt }) }],
    };
  } catch {
    return {
      content: [{ type: 'text', text: JSON.stringify({ ok: false, error: 'Receipt not found' }) }],
    };
  }
}
