import fs from 'node:fs';
import path from 'node:path';

/**
 * 오늘·이번 세션에 무엇을 말했나 — **과발화를 막는 재료.**
 *
 * 원장에 안 쓴다. 말한 사실 자체는 원장의 `dec_fired` 가 갖고, 이 파일은
 * "이번 세션에 이미 말했나"를 세는 값싼 계수기다. 날짜가 바뀌면 통째로
 * 리셋되므로 무한히 자라지 않고, 잃어도 하루치 자제가 느슨해질 뿐이다.
 */

const FILE = 'dec-spoken.json';

export interface SpokenState {
  date: string;
  /** 오늘 이 저장소에서 말한 총 횟수. */
  count: number;
  /** 세션 id → 그 세션에 말한 결정 id들. */
  sessions: Record<string, string[]>;
}

const empty = (date: string): SpokenState => ({ date, count: 0, sessions: {} });

export function readSpoken(argusDir: string, today: string): SpokenState {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(argusDir, FILE), 'utf8')) as Partial<SpokenState>;
    if (parsed.date !== today) return empty(today);   // 날짜가 바뀌면 새 하루다
    return {
      date: today,
      count: typeof parsed.count === 'number' ? parsed.count : 0,
      sessions: typeof parsed.sessions === 'object' && parsed.sessions !== null
        ? Object.fromEntries(Object.entries(parsed.sessions)
            .filter(([, v]) => Array.isArray(v))
            .map(([k, v]) => [k, (v as unknown[]).filter((x): x is string => typeof x === 'string')]))
        : {},
    };
  } catch { return empty(today); }
}

export function markSpoken(argusDir: string, today: string, sessionId: string, id: string): void {
  const state = readSpoken(argusDir, today);
  state.count += 1;
  state.sessions[sessionId] = [...new Set([...(state.sessions[sessionId] ?? []), id])];
  try {
    fs.mkdirSync(argusDir, { recursive: true });
    const target = path.join(argusDir, FILE);
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 1), 'utf8');
    fs.renameSync(tmp, target);
  } catch { /* 못 남기면 자제가 느슨해질 뿐, 세션을 막지는 않는다 */ }
}
