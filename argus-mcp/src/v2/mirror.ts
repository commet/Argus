/**
 * 단일 미러 관문 — dual-write의 근본 형태 (창업자 지시 "근본적으로 해결"의 2번).
 *
 * 이전 형태의 결함: dual-write가 "각 툴 핸들러가 기억해서 호출"하는 구조라
 * 경로 하나(defer)가 빠지자 조용히 샜다. 근본 수리: v1 원장 쓰기의 유일한
 * 관문인 appendLedger(ledger-append.ts)가 이 파일을 자동 호출한다 — 툴이
 * 기억할 것이 없으므로 **배선 누락이 구조적으로 불가능**하다. premises·
 * recheck·watch_capture까지 자동으로 미러된다.
 *
 * 매핑 원칙:
 *  - v2 인벤토리(정본 II-A)에 대응이 있는 v1 이벤트만 미러한다. 대응이 없는
 *    것(watch_anchor·gate_input·premise_reconsider)은 **계수하고 건너뛴다**
 *    (skipped_unmapped — 조용한 소실 금지; v1 원장·V1Extras에는 그대로 남는다).
 *  - v1 defer → v2 amend(check_by): v2에 defer 이벤트가 없고, 재무장의 v2
 *    의미는 확인일 전진이다.
 *  - watch_capture → candidate_created(verification=host_reported 고정 —
 *    byte 검증 없는 경로는 등급을 사칭할 수 없다).
 *  - provenance는 하향만: 미러 계층은 elicitation을 목격하지 못하므로 기본
 *    host_reported. 예외는 seal 힌트 — seal.ts가 elicit Keep을 직접 봤을 때만
 *    hints.seal.provenance='elicited_user'를 전달한다.
 *
 * 멱등 key: v1 이벤트 내용+ts의 지문. 같은 배치의 재시도(동일 ts)는 duplicate,
 * 다른 날의 같은 내용(예: 같은 finding의 재확인)은 fresh — ts가 가른다.
 *
 * 실패 격리: 여기서 무엇이 터져도 이미 성공한 v1 쓰기를 오염하지 않는다 —
 * appendLedger가 결과를 MirrorOutcome으로 반환하고, 툴은 data.v2_write로
 * 노출한다 (조용한 배선 단절 금지).
 */
import { createHash } from 'node:crypto';
import { gitCommonDirOf } from './git-discovery.js';
import { argusHome, lookupRepository } from './ledger.js';
import {
  amendV2, candidateCreatedV2, contextFor, dismissV2, harvestV2,
  premiseAddV2, premiseAmendV2, premiseRecheckV2, premiseResolveV2,
  sealV2, settleV2, ulid, type Provenanced, type V2Context,
} from './bridge.js';
import { packageMeta } from '../lib/package-meta.js';
import { loadState } from './reducer.js';
import { deriveBrief } from './brief.js';
import { writeLogbook } from './logbook.js';
import type { LedgerEventInput } from '../lib/ledger-append.js';
import type { Provenance } from './events.js';

/** stdio 프로세스 1개 = 세션 1개 (due-note의 session-once와 같은 가정). */
const PROCESS_SESSION_ID = `mcp-${ulid()}`;

const short = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);

export interface MirrorHints {
  /** seal에만 존재하는 원장-밖 정보: elicit 목격 여부와 영수증 필드. */
  seal?: {
    provenance: Provenance;
    realQuestion?: string;
    unverifiedAssumption?: string;
    humanOnly?: string;
    humanJudgment?: string;
  };
}

export interface MirrorOutcome {
  bound: boolean;
  repository_id?: string;
  /** bound=false의 사유 (비git / init 전 / 컨텍스트 오류). */
  reason?: string;
  mirrored: number;
  /** v2 인벤토리에 대응이 없어 건너뛴 v1 이벤트명 (v1에는 그대로 남는다). */
  skipped_unmapped: string[];
  /** 이벤트별 미러 실패 — v1 쓰기는 이미 성공했으므로 오류는 노출용이다. */
  errors: string[];
  /** LOGBOOK projection 갱신 여부 (규칙 10 — 실패해도 원장은 무사, 정직 노출). */
  logbook_refreshed?: boolean;
}

/** 툴 data.v2_write 필드용 축약 (기존 노출 shape 유지). */
export function asV2WriteField(o: MirrorOutcome):
  | { written: true; repository_id: string }
  | { written: false; reason?: string; error?: string } {
  if (o.mirrored > 0 && o.errors.length === 0) return { written: true, repository_id: o.repository_id! };
  if (o.errors.length > 0) return { written: false, error: o.errors.join(' · ') };
  return { written: false, reason: o.reason ?? (o.skipped_unmapped.length ? `no v2 mapping for: ${o.skipped_unmapped.join(', ')}` : 'nothing to mirror') };
}

export function mapSealProvenance(owner: unknown, elicitedKeep: boolean): Provenance {
  if (elicitedKeep) return 'elicited_user';
  if (owner === 'ai_surfaced') return 'ai_surfaced';
  return 'host_reported'; // 'user' 포함 — elicit 증거 없는 user 표시는 전언이다
}

const HOST = 'host_reported' as const;
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined);
const hostp = (value: string): Provenanced => ({ value, provenance: HOST });

const SETTLE_OUTCOMES = new Set(['held', 'avoided', 'partial', 'still_pending', 'missed']);
const PREMISE_KINDS = new Set(['premise', 'fact', 'question']);
const CANDIDATE_KINDS = new Set(['claim', 'premise', 'question', 'decision']);

/** 읽기 표면용: 바인딩이 있으면 v2 BriefState, 없으면 정직한 사유.
 *  check_in 등이 data에 병기한다 (v1 surface는 무접촉 — v1이 여전히 정본). */
export function readV2Brief(argusDir: string, today: string):
  | { available: true; brief: ReturnType<typeof deriveBrief> }
  | { available: false; reason: string } {
  try {
    const commonDir = gitCommonDirOf(argusDir);
    if (!commonDir) return { available: false, reason: 'not a git repository' };
    const home = argusHome();
    const repositoryId = lookupRepository(home, commonDir);
    if (!repositoryId) return { available: false, reason: 'not bound — run argus_settings with action="status"' };
    return { available: true, brief: deriveBrief(loadState(home, repositoryId), today) };
  } catch (e) {
    return { available: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** appendLedger가 v1 쓰기 성공 직후 호출하는 유일한 진입점. 절대 던지지 않는다. */
export function mirrorV1Events(
  argusDir: string,
  events: LedgerEventInput[],
  now: string,
  hints?: MirrorHints,
): MirrorOutcome {
  const out: MirrorOutcome = { bound: false, mirrored: 0, skipped_unmapped: [], errors: [] };
  try {
    const commonDir = gitCommonDirOf(argusDir);
    if (!commonDir) { out.reason = 'not a git repository — v2 durable ledger not in play'; return out; }
    const home = argusHome();
    if (!lookupRepository(home, commonDir)) {
      out.reason = 'not bound to a repository_id — run argus_settings with action="status" once to repair the binding';
      return out;
    }
    const ctx = contextFor({
      home, gitCommonDir: commonDir, workspaceArgusDir: argusDir,
      sessionId: PROCESS_SESSION_ID, producerVersion: packageMeta().version,
      today: now.slice(0, 10),
    });
    out.bound = true;
    out.repository_id = ctx.repository_id;

    for (const ev of events) {
      try {
        if (mirrorOne(ctx, ev, now, hints)) out.mirrored++;
        else out.skipped_unmapped.push(ev.event);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // pre-dual-write 결정(v2에 생성 없음)의 후속 이벤트는 오류가 아니라 시대 차이.
        if (msg.startsWith('UNKNOWN_DECISION') || msg.startsWith('UNKNOWN_PREMISE')) {
          // 확신에 찬 오귀속 금지(F9): "바인딩 전"일 수도, "이전 미러가 실패한
          // 뒤"일 수도 있다 — 아는 만큼만 말한다.
          out.skipped_unmapped.push(`${ev.event}(no v2 record — sealed before binding, or an earlier mirror failed)`);
        } else {
          out.errors.push(`${ev.event}: ${msg}`);
        }
      }
    }

    // ── LOGBOOK projection 갱신 (P2-1) — v2 락 밖(규칙 11), 미러 성공분이
    // 있을 때만. projection 실패는 원장 쓰기를 오염하지 않고 플래그로 노출.
    if (out.mirrored > 0) {
      const brief = deriveBrief(loadState(home, ctx.repository_id), ctx.today);
      out.logbook_refreshed = writeLogbook(argusDir, brief, ctx.repository_id);
    }
    return out;
  } catch (e) {
    out.reason = e instanceof Error ? e.message : String(e);
    return out;
  }
}

/** 이벤트 1건 미러. true=미러됨, false=매핑 없음(계수용). 실패는 던진다(위에서 수거). */
function mirrorOne(ctx: V2Context, ev: LedgerEventInput, now: string, hints?: MirrorHints): boolean {
  // ts 포함 지문 — 같은 배치 재시도는 duplicate, 다른 시점의 같은 내용은 fresh.
  const key = short(JSON.stringify({ ...ev, ts: ev.ts || now }));

  switch (ev.event) {
    case 'harvest': {
      const text = str(ev.decision) ?? str((ev as { quote?: string }).quote);
      if (!text) return false;
      harvestV2(ctx, { decisionId: ev.id, text: hostp(text), idempotencyKey: key });
      return true;
    }
    case 'seal': {
      const predicate = str(ev.predicate);
      const checkBy = str(ev.check_by);
      if (!predicate || !checkBy) return false;
      const h = hints?.seal;
      const prov = h?.provenance ?? HOST;
      sealV2(ctx, {
        decisionId: ev.id,
        predicate: { value: predicate, provenance: prov },
        checkBy: { value: checkBy, provenance: prov },
        ...(ev.basis ? { basis: ev.basis as 'judgment' | 'luck' | 'mixed' | 'unsure' } : {}),
        ...(h?.realQuestion ? { realQuestion: h.realQuestion } : {}),
        ...(h?.unverifiedAssumption ? { unverifiedAssumption: h.unverifiedAssumption } : {}),
        ...(h?.humanOnly ? { humanOnly: h.humanOnly } : {}),
        // human_judgment는 Keep 픽커에 표시되지 않았다 — elicit이 목격한 것은
        // predicate/check_by뿐이므로 여기만은 항상 host_reported다 (F5: 승격
        // 규칙 "host_reported는 절대 자동 승격되지 않는다"의 필드 단위 적용).
        ...(h?.humanJudgment ? { humanJudgment: { value: h.humanJudgment, provenance: HOST } } : {}),
        idempotencyKey: key,
      });
      return true;
    }
    case 'amend': {
      const predicate = str(ev.predicate);
      const checkBy = str(ev.check_by);
      if (!predicate && !checkBy) return false;
      amendV2(ctx, {
        decisionId: ev.id,
        ...(predicate ? { predicate: hostp(predicate) } : {}),
        ...(checkBy ? { checkBy: hostp(checkBy) } : {}),
        idempotencyKey: key,
      });
      return true;
    }
    case 'defer': {
      // v1 재무장 = v2 amend(check_by 전진). 이력 상세는 v1 원장이 보존한다.
      const to = str(ev.check_by);
      if (!to) return false;
      amendV2(ctx, { decisionId: ev.id, checkBy: hostp(to), idempotencyKey: key });
      return true;
    }
    case 'dismiss': {
      const reason = [str(ev.dismiss_reason), str(ev.decision)].filter(Boolean).join(': ');
      dismissV2(ctx, { decisionId: ev.id, ...(reason ? { reason: reason.slice(0, 400) } : {}), idempotencyKey: key });
      return true;
    }
    case 'settle': {
      const outcome = str(ev.outcome);
      if (!outcome || !SETTLE_OUTCOMES.has(outcome)) return false;
      settleV2(ctx, {
        decisionId: ev.id,
        outcome: { value: outcome as 'held' | 'avoided' | 'partial' | 'still_pending' | 'missed', provenance: HOST },
        ...(str(ev.decision) ? { note: str(ev.decision) } : {}),
        idempotencyKey: key,
      });
      return true;
    }
    case 'premise_add': {
      const pid = str(ev.premise_id);
      const text = str(ev.text);
      if (!pid || !text) return false;
      premiseAddV2(ctx, {
        premiseId: pid, decisionId: ev.id,
        kind: (PREMISE_KINDS.has(String(ev.kind)) ? ev.kind : 'premise') as 'premise' | 'fact' | 'question',
        text: { value: text, provenance: ev.source === 'user' || ev.source === 'user_stated' ? HOST : 'ai_surfaced' },
        ...(ev.load_bearing !== undefined ? { loadBearing: ev.load_bearing } : {}),
        ...(ev.recheck_cadence_days !== undefined ? { recheckCadenceDays: ev.recheck_cadence_days } : {}),
        ...(str(ev.capture_id) ? { fromCandidate: str(ev.capture_id) } : {}),
        idempotencyKey: key,
      });
      return true;
    }
    case 'premise_amend': {
      const pid = str(ev.premise_id);
      const text = str(ev.to); // refine/replace의 새 문장
      if (!pid || (!text && ev.recheck_cadence_days === undefined)) return false; // external 토글 등 v2 무대응
      premiseAmendV2(ctx, {
        premiseId: pid,
        ...(text ? { text: hostp(text) } : {}),
        ...(ev.recheck_cadence_days !== undefined ? { recheckCadenceDays: ev.recheck_cadence_days } : {}),
        idempotencyKey: key,
      });
      return true;
    }
    case 'premise_recheck': {
      const pid = str(ev.premise_id);
      if (!pid) return false;
      premiseRecheckV2(ctx, {
        premiseId: pid,
        // v1은 drifted:boolean으로 말한다 — 셋째 값(broken)은 v1에 없다.
        result: ev.drifted === true ? 'drifted' : ev.drifted === false ? 'holds' : 'unknown',
        ...(str(ev.finding) ? { note: str(ev.finding) } : {}),
        idempotencyKey: key,
      });
      return true;
    }
    case 'premise_resolve': {
      const pid = str(ev.premise_id);
      if (!pid) return false;
      premiseResolveV2(ctx, {
        premiseId: pid,
        resolution: hostp(str(ev.decision) ?? 'resolved'),
        idempotencyKey: key,
      });
      return true;
    }
    case 'watch_capture': {
      const cid = str(ev.capture_id);
      const text = str(ev.text);
      if (!cid || !text) return false;
      candidateCreatedV2(ctx, {
        candidateId: cid,
        kind: (CANDIDATE_KINDS.has(String(ev.kind)) ? ev.kind : 'claim') as 'claim' | 'premise' | 'question' | 'decision',
        quote: text,
        quoteSpeaker: ev.source === 'user' || ev.source === 'user_stated' ? 'user' : 'unknown',
        source: 'user', // argus_watch는 사용자 호출 경로다
        idempotencyKey: key,
      });
      return true;
    }
    // v2 인벤토리에 대응 없음(watch_anchor·gate_input·premise_reconsider 등) —
    // v1 원장·V1Extras가 원문을 보존하므로 소실이 아니라 계수된 보류다.
    default:
      return false;
  }
}

/** v1↔v2 브리프 발산 감지 (읽기 전환 준비 — M-잔여-1).
 *
 *  읽기 전환의 조건은 "관찰 기간 동안 발산 0"이다. 이 함수는 check_in이
 *  매 호출마다 v1 due 전체(id 집합)와 v2 파생 due를 대조해 그 증거를
 *  data.v2_divergence로 병기하게 한다 — 사람이 지켜보지 않아도 실사용
 *  로그가 발산을 드러낸다 (조용한 다른-답 방지, LLM-glue invariant).
 *
 *  판정은 id 집합의 대칭차만 본다: 문구·순서·표시 상한은 renderer 몫이라
 *  발산이 아니다. 목록은 각 10건 캡 (조용한 truncation 아님 — 카운트가
 *  전수를 말한다). */
export function briefDivergence(
  v1DueIds: string[],
  v2: ReturnType<typeof readV2Brief>,
): {
  comparable: boolean;
  reason?: string;
  v1_due?: number;
  v2_due?: number;
  only_v1?: string[];
  only_v2?: string[];
  diverged?: boolean;
} {
  if (!v2.available) return { comparable: false, reason: v2.reason };
  const v1Set = new Set(v1DueIds);
  const v2Ids = v2.brief.due.map((d) => d.decision_id);
  const v2Set = new Set(v2Ids);
  const onlyV1 = v1DueIds.filter((id) => !v2Set.has(id));
  const onlyV2 = v2Ids.filter((id) => !v1Set.has(id));
  return {
    comparable: true,
    v1_due: v1Set.size,
    v2_due: v2Set.size,
    only_v1: onlyV1.slice(0, 10),
    only_v2: onlyV2.slice(0, 10),
    diverged: onlyV1.length > 0 || onlyV2.length > 0,
  };
}
