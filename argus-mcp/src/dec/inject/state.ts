import fs from 'node:fs';
import path from 'node:path';

/**
 * 무엇을 언제 마지막으로 펴 봤나 — **회전 슬롯의 재료.**
 *
 * 원장에 안 쓴다. 펴 보는 것은 결정이 아니고, 세션마다 원장에 줄이 쌓이면
 * 진짜 기록이 잡음에 묻힌다. 덮어쓰는 작은 파일 하나면 충분하고, 잃어도
 * "한 번도 안 펴 봤다"로 안전하게 되돌아간다.
 */

const FILE = 'dec-shown.json';

export function shownPath(argusDir: string): string {
  return path.join(argusDir, FILE);
}

export function readShown(argusDir: string): Record<string, string> {
  try {
    const parsed = JSON.parse(fs.readFileSync(shownPath(argusDir), 'utf8')) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: Record<string, string> = {};
    for (const [id, at] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof at === 'string') out[id] = at;
    }
    return out;
  } catch { return {}; }
}

/** 이번에 편 것들의 시각을 남긴다. 원장에 없는 id 는 정리해서 무한히 안 자란다. */
export function markShown(
  argusDir: string, ids: readonly string[], now: string, aliveIds: readonly string[],
): void {
  const alive = new Set(aliveIds);
  const next: Record<string, string> = {};
  for (const [id, at] of Object.entries(readShown(argusDir))) if (alive.has(id)) next[id] = at;
  for (const id of ids) next[id] = now;
  try {
    fs.mkdirSync(argusDir, { recursive: true });
    const target = shownPath(argusDir);
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(next, null, 1), 'utf8');
    fs.renameSync(tmp, target);
  } catch { /* 못 남겨도 다음 세션이 "한 번도 안 봤다"로 안전하게 돈다 */ }
}
