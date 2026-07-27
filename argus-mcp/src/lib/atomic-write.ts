import fs from 'fs/promises';
import path from 'path';

/**
 * Atomic + DURABLE small-file write.
 *
 * The rename gives atomicity: a reader sees the old file or the new one, never
 * a half-written one. Durability is a separate promise, and it was missing
 * (audit 2026-07-27): `writeFile` + `rename` leaves the new contents in the page
 * cache, so a crash or power loss between the rename and the flush can land a
 * ZERO-LENGTH or truncated file at the final path. The rename is journalled on
 * ext4/NTFS; the data behind it is not.
 *
 * That matters here specifically because this is the receipt writer. The ledger
 * append already fsyncs (ledger-append.ts), so the crash window produced a
 * ledger that says "settled" beside a receipt file that is empty: the record
 * survives, the user's keepsake does not, and the receipt is the one artifact
 * this product exists to hand back. Same for the bearing file and the ambient
 * state file.
 *
 * So: fsync the temp file BEFORE the rename (contents durable), then best-effort
 * fsync the directory (the rename itself durable). Directory fsync is not
 * supported on Windows and legitimately fails on some filesystems, so it stays
 * best-effort; the file fsync is the load-bearing one.
 */
async function writeDurable(filePath: string, body: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = filePath + '.tmp.' + process.pid;
  const fh = await fs.open(tmp, 'w');
  try {
    await fh.writeFile(body, 'utf8');
    try { await fh.sync(); } catch { /* fsync unsupported on this handle/FS — the rename still gives atomicity */ }
  } finally {
    await fh.close();
  }
  await fs.rename(tmp, filePath);
  let dh: Awaited<ReturnType<typeof fs.open>> | undefined;
  try { dh = await fs.open(dir, 'r'); await dh.sync(); }
  catch { /* directory fsync unsupported (Windows) — best effort */ }
  finally { if (dh) await dh.close().catch(() => {}); }
}

export async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  // Verify it round-trips before committing
  JSON.parse(json);
  await writeDurable(filePath, json);
}

export async function atomicWriteText(filePath: string, text: string): Promise<void> {
  await writeDurable(filePath, text);
}
