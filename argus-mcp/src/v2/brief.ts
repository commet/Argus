/**
 * BriefState — 모든 renderer가 소비하는 단일 파생 상태 (정본 규칙 6).
 *
 * 이 파일은 **순수 파생 계층**이다: fs 없음, 이벤트 없음, LedgerState + 오늘
 * 날짜(logical_date)만 받아 계산한다. brief/LOGBOOK/statusline/check_in이
 * 전부 이 함수의 출력을 렌더하면, 표면끼리 어긋날 방법이 구조적으로 없다
 * (renderer 수용 기준: 동일 BriefState 소비 + renderer별 골든 픽스처 —
 * byte-identical이 아니라).
 *
 * 파생 규칙 (정본 II-A "due는 파생 상태(이벤트 아님)"):
 *  - decision due: sealed && check_by <= today && (snooze 안 걸렸거나 풀림).
 *    snooze 2회 이상이면 dismiss 제안 플래그 (II-A snooze 전이의 "2회 snooze
 *    후 dismiss 제안" — 제안이지 자동 dismiss가 아니다. 강제는 스파인 위반).
 *  - premise recheck due: cadence가 있는 미해결 전제, 기준일(last_recheck.on
 *    또는 added_on) + cadence <= today. 한 번도 확인 안 된 전제도 added_on
 *    기준으로 도래한다 (웹 premises-core의 never-checked 분기와 같은 사상).
 *  - candidate expired: created_on + 14일 < today → 파생 소멸 (이벤트 아님,
 *    II-A). snoozed 후보는 snooze_until <= today면 다시 active.
 *
 * due 공정 큐 (정본 규칙 9 — 기아 방지):
 *  ① 한 번도 표시 안 된 due 중 check_by 최고령
 *  ② (전부 표시된 적 있으면) 가장 오래 미표시
 *  ③ 동률이면 check_by 최고령
 *  항상 "외 N건"을 병기할 수 있도록 others를 돌려준다. 표시 이력(shown)은
 *  표면(드라이버)의 소유다 — 원장 이벤트가 아니라 projection 상태 파일에 산다.
 */
import type { LedgerState } from './reducer.js';

export const CANDIDATE_EXPIRY_DAYS = 14;
export const SNOOZE_DISMISS_SUGGEST_AT = 2;

// ── 날짜 산술 (YYYY-MM-DD, UTC 고정 — 로컬 tz 오프바이원 방지) ──

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 86_400_000);
}

// ── 모형 ──────────────────────────────────────────────────

export interface DueItem {
  decision_id: string;
  predicate: string;
  check_by: string;
  overdue_days: number; // 0 = 오늘이 그날
  /** snooze 2회 이상 — dismiss를 "제안"할 근거 (자동 아님). */
  suggest_dismiss: boolean;
}

export interface PremiseRecheckDue {
  premise_id: string;
  text: string;
  due_since: string; // 도래일 (기준일 + cadence)
}

export interface UnsealedNetItem {
  decision_id: string;
  text: string;
  harvested_on: string;
}

export interface BriefState {
  logical_date: string;
  due: DueItem[]; // check_by 오름차순 전체 — 공정 큐 선별은 pickDueFairly
  /** 그물 (Matrix Capture 행): harvest 후 미봉인 결정, harvested_on이
   *  어제 이전인 것 전부. "다음날 1회"의 1회 보장은 pickNetOnce +
   *  드라이버의 표시 이력이 담당한다 — 파생은 후보 전체를 정직하게 센다. */
  unsealed_net: UnsealedNetItem[];
  premise_rechecks_due: PremiseRecheckDue[];
  open_questions: { premise_id: string; text: string }[];
  candidates_active: { candidate_id: string; kind: string; state: string }[];
  /** 파생 소멸 — 사라진 게 아니라 셌다 (조용한 truncation 금지). */
  candidates_expired: number;
  sealed_alive: number; // due 아닌 살아있는 봉인 수 (statusline "due 7/…" 류)
  /** 정직성 지표 — 0이 아니면 표면이 언급할 수 있어야 한다. */
  anomalies: number;
  skipped_unknown: number;
  dropped_corrupt: number;
  /** projection 커서 (I-1: 원장과 다르면 재생성). */
  last_event_id: string | null;
}

type LoadedState = LedgerState & {
  skipped_unknown: number;
  dropped_corrupt: number;
  last_event_id: string | null;
};

// ── 파생 ──────────────────────────────────────────────────

export function deriveBrief(state: LoadedState, today: string): BriefState {
  const due: DueItem[] = [];
  let sealedAlive = 0;

  const unsealedNet: UnsealedNetItem[] = [];

  for (const d of state.decisions.values()) {
    // 그물: harvest만 되고 봉인 안 된 결정 — 다음날(harvested_on < today)부터
    // 후보로 뜬다. 당일은 제외: 방금 잡은 결정을 같은 세션에서 다시 미는 건
    // 재촉이지 그물이 아니다.
    if (d.state === 'harvested' && d.harvested_on !== undefined && d.harvested_on < today) {
      unsealedNet.push({
        decision_id: d.id,
        text: d.text?.value ?? '',
        harvested_on: d.harvested_on,
      });
    }
    if (d.state !== 'sealed') continue;
    // check_by 없는 봉인(파손 v1 이전 등)은 due 계산에서만 빠진다 — 살아있는
    // 봉인 수에서 증발하면 조용한 소실이다 (F10a).
    if (!d.check_by?.value) { sealedAlive++; continue; }
    const snoozeHolds = d.snoozed_until !== undefined && d.snoozed_until > today;
    if (d.check_by.value <= today && !snoozeHolds) {
      due.push({
        decision_id: d.id,
        predicate: d.predicate?.value ?? d.text?.value ?? '',
        check_by: d.check_by.value,
        overdue_days: daysBetween(d.check_by.value, today),
        suggest_dismiss: d.snooze_count >= SNOOZE_DISMISS_SUGGEST_AT,
      });
    } else {
      sealedAlive++;
    }
  }
  due.sort((a, b) => (a.check_by < b.check_by ? -1 : a.check_by > b.check_by ? 1 : 0));

  const premiseRechecksDue: PremiseRecheckDue[] = [];
  const openQuestions: { premise_id: string; text: string }[] = [];
  for (const p of state.premises.values()) {
    if (p.resolved) continue;
    if (p.kind === 'question') openQuestions.push({ premise_id: p.id, text: p.text.value });
    if (p.recheck_cadence_days) {
      const base = p.last_recheck?.on || p.added_on;
      if (base) {
        const dueOn = addDays(base, p.recheck_cadence_days);
        if (dueOn <= today) premiseRechecksDue.push({ premise_id: p.id, text: p.text.value, due_since: dueOn });
      }
    }
  }

  const candidatesActive: BriefState['candidates_active'] = [];
  let candidatesExpired = 0;
  for (const c of state.candidates.values()) {
    if (c.state === 'promoted' || c.state === 'dropped') continue; // terminal — 셈 대상 아님
    if (addDays(c.created_on, CANDIDATE_EXPIRY_DAYS) < today) { candidatesExpired++; continue; }
    if (c.state === 'snoozed' && c.snooze_until !== undefined && c.snooze_until > today) continue; // 아직 잠듦
    candidatesActive.push({ candidate_id: c.id, kind: c.kind, state: c.state });
  }

  unsealedNet.sort((a, b) =>
    a.harvested_on < b.harvested_on ? -1 : a.harvested_on > b.harvested_on ? 1
      : a.decision_id < b.decision_id ? -1 : 1);

  return {
    logical_date: today,
    due,
    unsealed_net: unsealedNet,
    premise_rechecks_due: premiseRechecksDue,
    open_questions: openQuestions,
    candidates_active: candidatesActive,
    candidates_expired: candidatesExpired,
    sealed_alive: sealedAlive,
    anomalies: state.anomalies.length,
    skipped_unknown: state.skipped_unknown,
    dropped_corrupt: state.dropped_corrupt,
    last_event_id: state.last_event_id,
  };
}

// ── due 공정 큐 (정본 규칙 9) ─────────────────────────────

/** 표시 이력 — 표면(드라이버)이 projection 상태로 영속한다. 값은 마지막 표시일. */
export type ShownLog = ReadonlyMap<string, string>;

export interface FairPick {
  pick: DueItem | null;
  /** "외 N건" — 항상 병기, 전체 목록은 /argus:resolve. */
  others: number;
}

/** 그물 1회 보장 (Matrix Capture 행: "unsealed 다음날 그물 1회 후 후보 보관").
 *  표시 이력에 있는 항목은 **영원히** 다시 뽑히지 않는다 — 그물은 재촉이
 *  아니라 단 한 번의 되물음이고, 그 후 결정은 원장에 harvested로 조용히
 *  보관된다 (능동 표면은 침묵, /argus:resolve·debrief 류 pull 표면에서만
 *  보임). 표시 이력은 due 공정 큐와 같은 사상으로 드라이버가 영속한다. */
export function pickNetOnce(net: UnsealedNetItem[], shownNet: ShownLog): UnsealedNetItem[] {
  return net.filter((n) => !shownNet.has(n.decision_id));
}

export function pickDueFairly(due: DueItem[], shown: ShownLog): FairPick {
  if (due.length === 0) return { pick: null, others: 0 };
  const byOldestCheckBy = (a: DueItem, b: DueItem) =>
    a.check_by < b.check_by ? -1 : a.check_by > b.check_by ? 1 : a.decision_id < b.decision_id ? -1 : 1;

  // ① 한 번도 표시 안 된 due 중 최고령.
  const neverShown = due.filter((d) => !shown.has(d.decision_id)).sort(byOldestCheckBy);
  if (neverShown.length > 0) return { pick: neverShown[0], others: due.length - 1 };

  // ② 전부 표시된 적 있으면: 가장 오래 미표시 → ③ 동률이면 check_by 최고령.
  const sorted = [...due].sort((a, b) => {
    const sa = shown.get(a.decision_id)!;
    const sb = shown.get(b.decision_id)!;
    if (sa !== sb) return sa < sb ? -1 : 1;
    return byOldestCheckBy(a, b);
  });
  return { pick: sorted[0], others: due.length - 1 };
}
