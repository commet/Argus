import { readLedgerRaw } from '../lib/ledger-replay.js';
import { isValidScope } from './scope.js';
import { watchProblems, type WatchRule } from './watch/rule.js';
import type {
  Amendment, DecAmendedPayload, DecFiredPayload, DecPausedPayload, DecRepealedPayload, DecReviewedPayload, DecSignedPayload,
  DecisionRecord, DecisionType, OriginPointer, Unattended, WatchMode,
} from './types.js';

/**
 * `provenance`(사용자가 쓴 문장인가, 아르고스가 꺼낸 것인가)는 앱 존의
 * `src/lib/judgment-authorship.ts` 와 **같은 질문**이다. 안 쓰는 이유는 하나뿐:
 * 여기는 MIT 존이고 앱 존을 import 하면 라이선스 경계가 무너진다. 뜻은 같게
 * 두되(사용자 `user` · 기계가 꺼낸 것 `ai_surfaced`) 코드는 각자 산다.
 */

/** 결정 장부가 원장에 쓰는 사건 이름 셋. 옛 예측 상태기계 밖이라 그 전이 검사를
 *  거치지 않는다 (`gate_input`·`watch_*` 와 같은 자리). */
export const DEC_EVENT_TYPES = ['dec_signed', 'dec_amended', 'dec_repealed', 'dec_fired', 'dec_misfire', 'dec_reviewed', 'dec_paused'] as const;
export type DecEventType = (typeof DEC_EVENT_TYPES)[number];

export interface DecFoldResult {
  records: DecisionRecord[];
  /** 파스가 안 된 줄 수 — 조용히 0으로 만들지 않는다. */
  dropped: number;
  /** 원장을 못 읽었을 때의 errno. 있으면 결과는 "비었다"가 아니라 "모른다"다. */
  unreadable?: string;
}

const isType = (v: unknown): v is DecisionType =>
  v === 'pin' || v === 'ban' || v === 'open' || v === 'pred';
const isUnattended = (v: unknown): v is Unattended => v === 'park' || v === 'log' || v === 'deny';
const isWatch = (v: unknown): v is WatchMode => v === 'machine' || v === 'inject_only';
const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined);

/** 개정이 실제로 바꾼 것만 골라낸다 — 파일이 "무엇이 무엇으로" 를 보여주려면 필요하다. */
const AMENDABLE = ['decision', 'scope', 'binds', 'review', 'review_on_event', 'unattended', 'watch', 'because'] as const;

/** 원장에 직접 쓰인 나쁜 규칙을 조용히 받지 않는다. */
function usableWatchRule(value: unknown): WatchRule | null {
  if (typeof value !== 'object' || value === null) return null;
  const r = value as Partial<WatchRule>;
  const list = (v: unknown): string[] | null =>
    Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null;
  const paths = list(r.paths); const phrases = list(r.phrases);
  const exceptPaths = list(r.except_paths ?? []); const exceptPhrases = list(r.except_phrases ?? []);
  const blind = list(r.blind_spots);
  if (!paths || !phrases || !exceptPaths || !exceptPhrases || !blind) return null;
  if (r.mode !== 'machine' && r.mode !== 'inject_only') return null;
  const rule: WatchRule = {
    paths, phrases, except_paths: exceptPaths, except_phrases: exceptPhrases,
    blind_spots: blind, mode: r.mode,
  };
  return watchProblems(rule).length === 0 ? rule : null;
}

function usableOrigin(value: unknown): OriginPointer | null {
  if (typeof value !== 'object' || value === null) return null;
  const o = value as Partial<OriginPointer>;
  if (o.kind !== 'rule_file' && o.kind !== 'conversation') return null;
  if (typeof o.ref !== 'string' || !o.ref) return null;
  return {
    kind: o.kind, ref: o.ref,
    ...(typeof o.line_start === 'number' ? { line_start: o.line_start } : {}),
    ...(typeof o.line_end === 'number' ? { line_end: o.line_end } : {}),
  };
}

function diffFor(before: DecisionRecord, patch: DecAmendedPayload): Amendment['changed'] {
  const changed: Amendment['changed'] = [];
  for (const field of AMENDABLE) {
    const next = (patch as unknown as Record<string, unknown>)[field];
    if (typeof next !== 'string' || next === '') continue;
    const prev = (before as unknown as Record<string, unknown>)[field];
    if (typeof prev === 'string' && prev === next) continue;
    changed.push({ field, from: typeof prev === 'string' ? prev : '', to: next });
  }
  return changed;
}

/**
 * 원장을 접어 **지금의 결정들**을 낸다. 파일은 이 결과만 보고 그려진다.
 *
 * 규율 셋:
 *  - **서명 없이는 아무것도 태어나지 않는다.** 개정·폐지가 먼저 와도 무시한다
 *    (불변식 ②의 접기 판 — 서명이 유일한 탄생 경로다).
 *  - **두 번째 서명은 무시한다.** 같은 id 의 재서명은 개정으로 오는 것이지
 *    조용히 덮어쓰는 것이 아니다.
 *  - **폐지 뒤의 개정은 무시한다.** 닫힌 결정을 다시 열지 않는다 (거울 조항).
 */
export function foldDecisions(argusDir: string): DecFoldResult {
  const read = readLedgerRaw(argusDir);
  if (read.unreadable) return { records: [], dropped: 0, unreadable: read.unreadable };

  const byId = new Map<string, DecisionRecord>();
  let dropped = 0;

  for (const line of read.lines) {
    if (!line.trim()) continue;
    let ev: Record<string, unknown>;
    try { ev = JSON.parse(line) as Record<string, unknown>; } catch { dropped++; continue; }
    const event = ev['event'];
    if (typeof event !== 'string' || !(DEC_EVENT_TYPES as readonly string[]).includes(event)) continue;

    const id = str(ev['id']);
    const payload = ev['dec'];
    if (!id || typeof payload !== 'object' || payload === null) { dropped++; continue; }
    const at = str(ev['ts']) ?? '';

    if (event === 'dec_signed') {
      if (byId.has(id)) continue; // 재서명은 개정으로 온다
      const p = payload as Partial<DecSignedPayload>;
      // 필수 필드가 빠진 서명은 **조용히 기본값으로 메우지 않는다** — 버린다.
      if (!isType(p.type) || !str(p.decision) || !str(p.scope) || !isValidScope(p.scope!) || !str(p.binds) ||
          !str(p.author) || !str(p.adopted) || !isUnattended(p.unattended) || !isWatch(p.watch)) {
        dropped++; continue;
      }
      if (!str(p.review) && !str(p.review_on_event)) { dropped++; continue; } // 불변식 ⑤
      const watchRule = p.watch_rule === undefined ? null : usableWatchRule(p.watch_rule);
      // 기계가 잡는다고 해놓고 규칙이 없거나 망가졌으면 받지 않는다 — 잡는 척이
      // 제일 나쁜 거짓말이다.
      if (p.watch === 'machine' && (!watchRule || watchRule.mode !== 'machine')) { dropped++; continue; }
      byId.set(id, {
        id, type: p.type, decision: p.decision!, scope: p.scope!, binds: p.binds!,
        author: p.author!, provenance: p.provenance === 'ai_surfaced' ? 'ai_surfaced' : 'user',
        adopted: p.adopted!, unattended: p.unattended, watch: p.watch, status: 'active',
        ...(watchRule ? { watch_rule: watchRule } : {}),
        ...(usableOrigin(p.origin) ? { origin: usableOrigin(p.origin)! } : {}),
        ...(str(p.review) ? { review: p.review! } : {}),
        ...(str(p.review_on_event) ? { review_on_event: p.review_on_event! } : {}),
        ...(str(p.because) ? { because: p.because! } : {}),
        ...(str(p.quote) ? { quote: p.quote! } : {}),
        ...(str(p.quote_at) ? { quote_at: p.quote_at! } : {}),
        ...(str(p.check) ? { check: p.check! } : {}),
        ...(str(p.falsified_if) ? { falsified_if: p.falsified_if! } : {}),
        ...(str(p.source) ? { source: p.source! } : {}),
        ...(str(p.source_origin) ? { source_origin: p.source_origin! } : {}),
        ...(p.effective_now === true ? { effective_now: true } : {}),
        amendments: [], fires: [], misfires: 0, reviews: [], pauses: [],
      });
      continue;
    }

    const record = byId.get(id);
    if (!record) { dropped++; continue; } // 서명 없는 결정에 대한 개정·폐지

    if (event === 'dec_fired') {
      // 걸린 기록은 폐지된 결정에도 남는다 — 지난 일은 지나간 대로 둔다.
      const p = payload as Partial<DecFiredPayload>;
      const matched = str(p.matched);
      if (!matched || (p.channel !== 'file' && p.channel !== 'word')) { dropped++; continue; }
      record.fires.push({ at, channel: p.channel, matched, where: str(p.where) ?? '' });
      continue;
    }

    if (event === 'dec_misfire') {
      record.misfires += 1;
      continue;
    }

    if (event === 'dec_paused') {
      const p = payload as Partial<DecPausedPayload>;
      const until = str(p.until);
      // 이유 없는 정지도, 끝날 날 없는 정지도 안 받는다 — 무기한 정지는
      // 이름만 다른 폐지이고, 폐지는 폐지의 문으로 가야 한다.
      if (!until || !str(p.why) || !/^\d{4}-\d{2}-\d{2}$/.test(until)) { dropped++; continue; }
      record.paused_until = until;
      record.pauses.push({ at, until, why: p.why!, by_tty: p.by_tty === true });
      continue;
    }

    if (event === 'dec_reviewed') {
      const p = payload as Partial<DecReviewedPayload>;
      const next = str(p.next_review);
      // 날짜 없는 "그대로"는 다시 안 묻겠다는 뜻이라 받지 않는다 (불변식 ⑤).
      if ((p.outcome !== 'keep' && p.outcome !== 'later') || !next) { dropped++; continue; }
      record.reviews.push({
        at, outcome: p.outcome, next_review: next,
        ...(str(p.lesson) ? { lesson: p.lesson! } : {}),
        ...(str(p.prevented) ? { prevented: p.prevented! } : {}),
      });
      record.review = next;   // 다음에 볼 날이 앞당겨지거나 밀린다
      continue;
    }

    if (event === 'dec_amended') {
      if (record.status === 'repealed') continue; // 닫힌 결정을 다시 열지 않는다
      const p = payload as Partial<DecAmendedPayload>;
      const why = str(p.why);
      if (!why) { dropped++; continue; } // 이유 없는 개정은 조용한 표류와 구분이 안 된다
      const changed = diffFor(record, p as DecAmendedPayload);
      for (const c of changed) (record as unknown as Record<string, unknown>)[c.field] = c.to;
      // 감지기만 고치는 개정 (§4.7) — 법 문장은 그대로 두고 규칙만 바꾼다.
      if (p.watch_rule !== undefined) {
        const next = usableWatchRule(p.watch_rule);
        if (next) {
          record.watch_rule = next;
          if (!changed.some((c) => c.field === 'watch')) record.watch = next.mode;
          changed.push({ field: 'watch_rule', from: '', to: '고침' });
        }
      }
      record.amendments.push({ at, why, from_hand_edit: p.from_hand_edit === true, changed });
      continue;
    }

    // dec_repealed
    if (record.status === 'repealed') continue;
    const p = payload as Partial<DecRepealedPayload>;
    const why = str(p.why);
    if (!why) { dropped++; continue; }
    record.status = 'repealed';
    record.repealed_at = at;
    record.repealed_why = why;
    if (str(p.succeeded_by)) record.succeeded_by = p.succeeded_by!;
  }

  return { records: [...byId.values()].sort((a, b) => a.id.localeCompare(b.id)), dropped };
}
