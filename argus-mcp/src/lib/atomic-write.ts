import fs from 'fs/promises';
import path from 'path';

export async function atomicWriteJson(filePath: string, data: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = filePath + '.tmp.' + process.pid;
  const json = JSON.stringify(data, null, 2);
  // Verify it round-trips before committing
  JSON.parse(json);
  await fs.writeFile(tmp, json, 'utf8');
  await fs.rename(tmp, filePath);
}
