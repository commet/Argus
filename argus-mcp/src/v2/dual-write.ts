/**
 * v2 dual-write — 수술 2단계의 원칙 (P1).
 *
 * v1 원장이 **정본인 채로**, v1 쓰기가 성공한 뒤 같은 사건을 v2 내구 원장에도
 * 기록한다. 읽기 전환(P2)까지 v2 원장은 채워지기만 하고 아무 표면도 읽지
 * 않으므로, 여기가 실패해도 사용자 기능은 하나도 죽지 않는다 — 그래서 실패는
 * 삼키되(도구 응답을 죽이지 않고) **반드시 data.v2_write로 노출**한다
 * (조용한 배선 단절 금지 — LLM-glue 불변식).
 *
 * 바인딩이 없으면(비git·init 전) written:false + 사유 — dual-write가 스스로
 * 바인딩을 만들지 않는다 (II-D: 명시적 바인딩은 init의 동사).
 *
 * provenance 매핑 (II-B — 위로 위조 금지):
 *  - elicit Keep으로 확인된 predicate → elicited_user (서버가 직접 수신했다)
 *  - 호출자가 predicate_owner='user'를 그냥 전달 → host_reported (모델이 전한 말)
 *  - 'ai_surfaced' → ai_surfaced
 */
import { createHash } from 'node:crypto';
import { gitCommonDirOf } from './git-discovery.js';
import { argusHome, lookupRepository } from './ledger.js';
import { amendV2, contextFor, dismissV2, sealV2, settleV2, ulid, type Provenanced } from './bridge.js';
import { packageMeta } from '../lib/package-meta.js';
import type { Provenance } from './events.js';

/** 멱등 key는 128자 캡(II-A) — 긴 predicate는 지문으로 줄인다. */
const short = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 12);

/** stdio 프로세스 1개 = 세션 1개 (due-note의 session-once와 같은 가정). */
const PROCESS_SESSION_ID = `mcp-${ulid()}`;

export type DualWriteResult =
  | { written: true; repository_id: string }
  | { written: false; reason: string }
  | { written: false; error: string };

/** UNKNOWN_DECISION은 오류가 아니라 시대 차이다: dual-write 도입 전에 봉인된
 *  결정은 v2 원장에 없는 게 정상이다 — error로 겁주지 않고 reason으로 말한다. */
function asResult(e: unknown): DualWriteResult {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.startsWith('UNKNOWN_DECISION')) {
    return { written: false, reason: 'decision predates the v2 durable ledger (sealed before dual-write) — recorded in v1 only' };
  }
  return { written: false, error: msg };
}

export function mapSealProvenance(owner: unknown, elicitedKeep: boolean): Provenance {
  if (elicitedKeep) return 'elicited_user';
  if (owner === 'ai_surfaced') return 'ai_surfaced';
  return 'host_reported'; // 'user' 포함 — elicit 증거 없는 user 표시는 전언이다
}

function contextOrReason(argusDir: string, today: string):
  | { ok: true; ctx: ReturnType<typeof contextFor> }
  | { ok: false; reason: string } {
  const commonDir = gitCommonDirOf(argusDir);
  if (!commonDir) return { ok: false, reason: 'not a git repository — v2 durable ledger not in play' };
  const home = argusHome();
  if (!lookupRepository(home, commonDir)) {
    return { ok: false, reason: 'not bound to a repository_id — run argus_init once to open the durable ledger' };
  }
  return {
    ok: true,
    ctx: contextFor({
      home, gitCommonDir: commonDir, workspaceArgusDir: argusDir,
      sessionId: PROCESS_SESSION_ID, producerVersion: packageMeta().version, today,
    }),
  };
}

export function dualWriteSeal(args: {
  argusDir: string;
  today: string;
  decisionId: string;
  predicate: string;
  checkBy: string;
  provenance: Provenance;
  basis?: 'judgment' | 'luck' | 'mixed' | 'unsure';
  realQuestion?: string;
  unverifiedAssumption?: string;
  humanOnly?: string;
  humanJudgment?: string;
}): DualWriteResult {
  try {
    const c = contextOrReason(args.argusDir, args.today);
    if (!c.ok) return { written: false, reason: c.reason };
    const p = (value: string): Provenanced => ({ value, provenance: args.provenance });
    sealV2(c.ctx, {
      decisionId: args.decisionId,
      predicate: p(args.predicate),
      checkBy: p(args.checkBy),
      ...(args.basis ? { basis: args.basis } : {}),
      ...(args.realQuestion ? { realQuestion: args.realQuestion } : {}),
      ...(args.unverifiedAssumption ? { unverifiedAssumption: args.unverifiedAssumption } : {}),
      ...(args.humanOnly ? { humanOnly: args.humanOnly } : {}),
      // human_judgment는 정의상 사용자의 말 — 전달 경로 provenance를 따른다(II-B).
      ...(args.humanJudgment ? { humanJudgment: p(args.humanJudgment) } : {}),
      idempotencyKey: `${args.decisionId}:${args.checkBy}`, // v1 재시도와 같은 축
    });
    return { written: true, repository_id: c.ctx.repository_id };
  } catch (e) {
    return asResult(e);
  }
}

export function dualWriteAmend(args: {
  argusDir: string;
  today: string;
  decisionId: string;
  predicate?: string;
  checkBy?: string;
}): DualWriteResult {
  if (args.predicate === undefined && args.checkBy === undefined) {
    return { written: false, reason: 'no field change — v2 amend requires at least one' };
  }
  try {
    const c = contextOrReason(args.argusDir, args.today);
    if (!c.ok) return { written: false, reason: c.reason };
    // amend 인자는 모델이 전달한 값 — host_reported (II-B).
    const p = (value: string): Provenanced => ({ value, provenance: 'host_reported' });
    amendV2(c.ctx, {
      decisionId: args.decisionId,
      ...(args.predicate !== undefined ? { predicate: p(args.predicate) } : {}),
      ...(args.checkBy !== undefined ? { checkBy: p(args.checkBy) } : {}),
      idempotencyKey: `${args.decisionId}:${short(`${args.predicate ?? ''}|${args.checkBy ?? ''}`)}`,
    });
    return { written: true, repository_id: c.ctx.repository_id };
  } catch (e) {
    return asResult(e);
  }
}

export function dualWriteDismiss(args: {
  argusDir: string;
  today: string;
  decisionId: string;
  reason?: string;
}): DualWriteResult {
  try {
    const c = contextOrReason(args.argusDir, args.today);
    if (!c.ok) return { written: false, reason: c.reason };
    dismissV2(c.ctx, {
      decisionId: args.decisionId,
      ...(args.reason ? { reason: args.reason.slice(0, 400) } : {}),
      idempotencyKey: `${args.decisionId}:dismiss`,
    });
    return { written: true, repository_id: c.ctx.repository_id };
  } catch (e) {
    return asResult(e);
  }
}

export function dualWriteSettle(args: {
  argusDir: string;
  today: string;
  decisionId: string;
  outcome: 'held' | 'avoided' | 'partial' | 'still_pending' | 'missed';
  provenance: Provenance;
  note?: string;
}): DualWriteResult {
  try {
    const c = contextOrReason(args.argusDir, args.today);
    if (!c.ok) return { written: false, reason: c.reason };
    settleV2(c.ctx, {
      decisionId: args.decisionId,
      outcome: { value: args.outcome, provenance: args.provenance },
      ...(args.note ? { note: args.note } : {}),
      idempotencyKey: `${args.decisionId}:${args.outcome}`,
    });
    return { written: true, repository_id: c.ctx.repository_id };
  } catch (e) {
    return asResult(e);
  }
}
