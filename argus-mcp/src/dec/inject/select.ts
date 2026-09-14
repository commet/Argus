import { globToRegExp } from '../watch/glob.js';
import { parseScope } from '../scope.js';
import { dueDecisions } from '../review/due.js';
import type { DecisionRecord } from '../types.js';

/**
 * 세션이 열릴 때 **무엇을 펴 보일지** 고른다 (기획서 §4.5).
 *
 * 배급이 아니라 **회전**이다: 조용히 잘 지켜지는 법이 굶어서 은퇴 후보가 되는
 * 루프를 끊는다. 슬롯 넷 —
 *   ① 오늘 다시 볼 것 ≤3   ② 최근에 걸린 것 5
 *   ③ 가장 오래 안 펴 본 것 5   ④ 교훈 2
 *
 * **그런데 모든 슬롯은 지금 있는 자리(cwd)에 걸리는 것부터 채운다.**
 * 이 한 줄이 없으면 회전 보장이 그대로 누설이 된다 — 실측(합성 장부 78건·
 * repo 12·고객사 5·30세션): 세션당 남의 결정 9.40건이 창에 들어갔고, 창의
 * 81%였고, 안 샌 세션이 0/30 이었다. 최대 출처는 버그가 아니라 **회전 슬롯
 * 그 자체**였다.
 *
 * 슬롯 ②·④ 는 아직 재료가 없다(걸린 기록·교훈은 뒤 단계에서 생긴다).
 * **조용히 다른 것으로 메우지 않는다** — 몇 자리가 왜 비었는지 그대로 돌려준다.
 */

export interface InjectionInput {
  /** 저장소 뿌리 기준 현재 자리 (`''` 이면 뿌리). */
  cwd_rel: string;
  today: string;
  max?: number;
  /** id → 마지막으로 펴 본 시각. 없으면 "한 번도 안 펴 봤다"로 친다. */
  last_shown?: Record<string, string>;
}

export type SlotName = 'due' | 'recent_fire' | 'rotation' | 'lesson';

export interface InjectionPick {
  record: DecisionRecord;
  slot: SlotName;
}

export interface InjectionPlan {
  picks: InjectionPick[];
  /** 살아 있는데 이 창에 안 들어온 건수. **감추지 않는다.** */
  omitted: number;
  /** 지금 자리에 안 걸려서 아예 후보가 아니었던 건수. */
  out_of_scope: number;
  /** 재료가 없어 못 채운 슬롯과 이유. */
  empty_slots: Array<{ slot: SlotName; why: string }>;
}

const SLOT_SIZE: Record<SlotName, number> = { due: 3, recent_fire: 5, rotation: 5, lesson: 2 };

/**
 * 이 결정이 **지금 있는 자리**에 걸리나.
 *
 * `path:` 는 별표 앞의 고정 부분으로 견준다 — 한쪽이 다른 쪽의 앞부분이면
 * 걸린다. (`path:src/app/**` 는 `src` 에서도 `src/app/x` 에서도 걸리고,
 * `docs` 에서는 안 걸린다.) 규칙 하나로 설명되는 크기를 유지한다.
 */
export function inScopeForCwd(scope: string, cwdRel: string): boolean {
  const parsed = parseScope(scope);
  if (!parsed) return false;                 // 범위가 틀린 결정은 창에 안 넣는다
  if (parsed.kind === 'global') return true;
  if (parsed.kind === 'repo') return true;
  const fixed = parsed.glob.split(/[*?]/)[0]!.replace(/\/+$/, '');
  const here = cwdRel.replace(/^\.?\/*/, '').replace(/\/+$/, '');
  if (!fixed || !here) return true;
  return fixed === here || fixed.startsWith(`${here}/`) || here.startsWith(`${fixed}/`);
}

/** 이 결정이 이 파일에 걸리나 — 범위만 본다 (걸렸는지 판정은 watch 쪽 일). */
export function scopeCoversPath(scope: string, filePath: string): boolean {
  const parsed = parseScope(scope);
  if (!parsed) return false;
  if (parsed.kind !== 'path') return true;
  return globToRegExp(parsed.glob).test(filePath.replace(/\\/g, '/'));
}

export function planInjection(
  records: readonly DecisionRecord[], input: InjectionInput,
): InjectionPlan {
  const max = input.max ?? 15;
  const alive = records.filter((r) => r.status === 'active');
  const here = alive.filter((r) => inScopeForCwd(r.scope, input.cwd_rel));
  const outOfScope = alive.length - here.length;

  const picks: InjectionPick[] = [];
  const taken = new Set<string>();
  const add = (record: DecisionRecord, slot: SlotName): void => {
    if (taken.has(record.id) || picks.length >= max) return;
    taken.add(record.id);
    picks.push({ record, slot });
  };

  // ① 오늘 다시 볼 것 — **때가 됐나는 한 군데서만 판정한다** (review/due.ts).
  //    여기 같은 조건을 다시 쓰면 달력만 보고 계기·조용함을 놓친다.
  dueDecisions(here, input.today)
    .slice(0, SLOT_SIZE.due)
    .forEach((d) => add(d.record, 'due'));

  // ② 최근에 걸린 것 — 실제로 일하고 있는 법을 앞에 둔다.
  //    이 슬롯은 §4.5 에 선언만 돼 있고 안 채워지고 있었다. 그동안 빈 칸 사유는
  //    걸린 기록이 쌓인 뒤에도 "아직 걸린 기록이 없다"고 **거짓말했다.**
  const lastFire = (r: DecisionRecord): string => r.fires.at(-1)?.at ?? '';
  const fired = here
    .filter((r) => !taken.has(r.id) && r.fires.length > 0)
    .sort((a, b) => {
      const fa = lastFire(a); const fb = lastFire(b);
      return fa === fb ? a.id.localeCompare(b.id) : fa < fb ? 1 : -1;
    })
    .slice(0, SLOT_SIZE.recent_fire);
  fired.forEach((r) => add(r, 'recent_fire'));

  // ③ 가장 오래 안 펴 본 것 — 한 번도 안 펴 본 것이 먼저다.
  const shown = input.last_shown ?? {};
  here
    .filter((r) => !taken.has(r.id))
    .sort((a, b) => {
      const sa = shown[a.id] ?? '';
      const sb = shown[b.id] ?? '';
      return sa === sb ? a.id.localeCompare(b.id) : sa < sb ? -1 : 1;
    })
    .slice(0, SLOT_SIZE.rotation)
    .forEach((r) => add(r, 'rotation'));

  // ④ 교훈 — 다시 보고 닫을 때 사람이 적은 한 줄이 있는 것. 최근 것부터.
  const withLesson = here
    .filter((r) => !taken.has(r.id) && r.reviews.some((v) => v.lesson))
    .sort((a, b) => {
      const la = a.reviews.filter((v) => v.lesson).at(-1)?.at ?? '';
      const lb = b.reviews.filter((v) => v.lesson).at(-1)?.at ?? '';
      return la === lb ? 0 : la < lb ? 1 : -1;
    })
    .slice(0, SLOT_SIZE.lesson);
  withLesson.forEach((r) => add(r, 'lesson'));

  // 빈 칸 사유는 **정말 비었을 때만** 적는다 — 안 그러면 정직한 공백이 거짓말이 된다.
  const empty: InjectionPlan['empty_slots'] = [];
  if (fired.length === 0) {
    empty.push({ slot: 'recent_fire', why: '아직 걸린 기록이 없다 (어긋남 알리기를 켜면 채워진다)' });
  }
  if (withLesson.length === 0) {
    empty.push({ slot: 'lesson', why: '아직 쌓인 교훈이 없다 (닫을 때 한 줄씩 쌓인다)' });
  }

  return {
    picks,
    omitted: here.length - picks.length,
    out_of_scope: outOfScope,
    empty_slots: empty,
  };
}
