import { globToRegExp } from '../watch/glob.js';
import { parseScope } from '../scope.js';
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

  // ① 오늘 다시 볼 것 — 날짜가 지났거나 오늘인 것부터, 오래된 순.
  here
    .filter((r) => r.review && r.review <= input.today)
    .sort((a, b) => (a.review! < b.review! ? -1 : 1))
    .slice(0, SLOT_SIZE.due)
    .forEach((r) => add(r, 'due'));

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

  return {
    picks,
    omitted: here.length - picks.length,
    out_of_scope: outOfScope,
    empty_slots: [
      { slot: 'recent_fire', why: '아직 걸린 기록이 없다 (어긋남 알리기를 켜면 채워진다)' },
      { slot: 'lesson', why: '아직 쌓인 교훈이 없다 (닫을 때 한 줄씩 쌓인다)' },
    ],
  };
}
