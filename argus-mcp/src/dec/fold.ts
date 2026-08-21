import { readLedgerRaw } from '../lib/ledger-replay.js';
import { isValidScope } from './scope.js';
import type {
  Amendment, DecAmendedPayload, DecRepealedPayload, DecSignedPayload,
  DecisionRecord, DecisionType, Unattended, WatchMode,
} from './types.js';

/** 결정 장부가 원장에 쓰는 사건 이름 셋. 옛 예측 상태기계 밖이라 그 전이 검사를
 *  거치지 않는다 (`gate_input`·`watch_*` 와 같은 자리). */
export const DEC_EVENT_TYPES = ['dec_signed', 'dec_amended', 'dec_repealed'] as const;
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
      byId.set(id, {
        id, type: p.type, decision: p.decision!, scope: p.scope!, binds: p.binds!,
        author: p.author!, provenance: p.provenance === 'ai_surfaced' ? 'ai_surfaced' : 'user',
        adopted: p.adopted!, unattended: p.unattended, watch: p.watch, status: 'active',
        ...(str(p.review) ? { review: p.review! } : {}),
        ...(str(p.review_on_event) ? { review_on_event: p.review_on_event! } : {}),
        ...(str(p.because) ? { because: p.because! } : {}),
        ...(str(p.quote) ? { quote: p.quote! } : {}),
        ...(str(p.quote_at) ? { quote_at: p.quote_at! } : {}),
        ...(str(p.check) ? { check: p.check! } : {}),
        ...(str(p.falsified_if) ? { falsified_if: p.falsified_if! } : {}),
        ...(str(p.source) ? { source: p.source! } : {}),
        ...(str(p.source_origin) ? { source_origin: p.source_origin! } : {}),
        amendments: [],
      });
      continue;
    }

    const record = byId.get(id);
    if (!record) { dropped++; continue; } // 서명 없는 결정에 대한 개정·폐지

    if (event === 'dec_amended') {
      if (record.status === 'repealed') continue; // 닫힌 결정을 다시 열지 않는다
      const p = payload as Partial<DecAmendedPayload>;
      const why = str(p.why);
      if (!why) { dropped++; continue; } // 이유 없는 개정은 조용한 표류와 구분이 안 된다
      const changed = diffFor(record, p as DecAmendedPayload);
      for (const c of changed) (record as unknown as Record<string, unknown>)[c.field] = c.to;
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
