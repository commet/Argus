import type { AdwinPrior, CusumPrior } from './detect';
import type { PortfolioPrior } from './portfolio';
import {
  appendReading,
  assessPremise,
  makePremise,
  measureM2,
  measureM3,
  referenceFrom,
  returnTriggers,
  type DurablePremise,
  type PremiseStance,
} from './premise';
import { measureM5, type AttributedSettlement, type OutcomeAttribution } from './attribution';
import { addElement, emptyFrame, makeElement, sealFrame, settleFrame } from './frame';
import { REQUIRED_AXES } from './axes';
import { retractCrossing, worldTrajectory } from './world';
import type { CognitiveFrame, Crossing, SignalReading } from './types';

/**
 * 시스템 시뮬레이션 — **루프 전체가 도는지** 흔든다.
 *
 * 1층 시뮬레이션(`simulate.ts`)은 프레임 하나의 불변식을 봤다. 그것으로는
 * 시스템이 서 있는지 알 수 없다. 시스템의 주장은 이것이다:
 *
 *   전제가 세계에서 흔들리면 → 그것을 참조한 **모든 살아있는 판단**이 깨어나고
 *   → 경보 이후에 내린 결정이 M2로 세어지고 → 귀환까지의 지연이 M3로 재어지고
 *   → 정산의 귀속 분포가 M5로 보이고 → 잘못 읽은 증거는 철회되어 원소가
 *   프레임 안으로 **되돌아온다.**
 *
 * 이 주장이 거짓이면 나머지 전부가 장식이다. 그래서 여기서 시나리오를 지어
 * 끝까지 돌리고, **양방향**으로 검사한다 (일어나야 할 일이 일어나는가, 그리고
 * 일어나선 안 될 일이 안 일어나는가).
 *
 * 결정론: `Date.now()`·난수 없음. 기준 시각과 시드에서 전부 파생된다.
 *
 * ── 이미 있는 것과의 관계 ───────────────────────────────────────────
 * 전제 모델 정본은 `src/lib/premises-core.ts` + `./premise.ts`. 하네스는 그것을
 * 호출할 뿐 자체 전제 표현을 만들지 않는다.
 */

const CUSUM_PRIOR: CusumPrior = {
  target: 3,
  slack: 0.25,
  decisionInterval: 1.5,
  rationale: '탐지하려는 이동폭 0.5의 절반을 여유로, 결정 구간은 그 3배 — 시뮬레이션용 고정값.',
};

const ADWIN_PRIOR: AdwinPrior = {
  delta: 0.05,
  minSplit: 3,
  rationale: 'ADWIN 관례 범위의 느슨한 쪽. 시뮬레이션에서는 경보 경로를 밟는 것이 목적이다.',
};

const PORTFOLIO_PRIOR: PortfolioPrior = {
  learningRate: 1.5,
  shareRate: 0.05,
  target: 3,
  scale: 1,
  rationale: '공유율 0.05 — 국면 전환 후 가설 부활에 필요한 최소치.',
};

export type SystemScenario =
  /** 전제가 끝까지 유지된다 → 경보 없음, 아무 판단도 깨어나지 않아야 한다. */
  | 'stable_world'
  /** 전제가 중간에 무너진다 → 경보 후 봉인한 판단이 M2에 세어져야 한다. */
  | 'premise_breaks'
  /** 경보가 떴는데 사용자가 정산했다 → M3에 지연이 기록돼야 한다. */
  | 'alert_then_settle'
  /** 판독이 전부 미판독 → 경보도 holds 도 아니고 unread 여야 한다. */
  | 'sensor_blind'
  /** 현실 접촉 증거를 잘못 읽어 철회한다 → 원소가 프레임 안으로 되돌아와야 한다. */
  | 'evidence_retracted';

export const SYSTEM_SCENARIOS: readonly SystemScenario[] = [
  'stable_world',
  'premise_breaks',
  'alert_then_settle',
  'sensor_blind',
  'evidence_retracted',
];

const iso = (base: number, hours: number): string => new Date(base + hours * 3_600_000).toISOString();

function reading(target: string, value: string | null, base: number, hours: number): SignalReading {
  return {
    binding_kind: 'metric',
    target,
    value,
    verdict: value === null ? 'unread' : 'holds',
    observed_at: iso(base, hours),
    ...(value === null ? { unread_reason: '신호원 도달 불가' } : {}),
  };
}

/** 필수 축을 사람 문장으로 채운 봉인 가능한 프레임. */
function humanFrame(id: string, base: number, sealHours: number): CognitiveFrame {
  let f = emptyFrame({ id, userId: 'sim', title: `판단 ${id}`, now: base });
  for (const axis of REQUIRED_AXES) {
    f = addElement(
      f,
      makeElement({ id: `${id}_${axis}`, axis, text: `${axis} 에 대한 내 문장`, touched: true, now: base }),
      base,
    );
  }
  const res = sealFrame({ frame: f, now: base + sealHours * 3_600_000 });
  if (!res.ok) throw new Error(`시뮬레이션 프레임 봉인 실패: ${res.messages.join(' / ')}`);
  return res.frame;
}

export interface SystemEpisode {
  scenario: SystemScenario;
  premise: DurablePremise;
  frames: CognitiveFrame[];
  attributions: Map<string, OutcomeAttribution>;
  /** 철회 시나리오에서 쓰는 건넘 (다른 시나리오는 빈 배열). */
  crossings: Crossing[];
}

export function buildSystemEpisode(scenario: SystemScenario, base: number): SystemEpisode {
  let premise = makePremise({
    id: `prem_${scenario}`,
    userId: 'sim',
    text: '전환율이 3 근처로 유지된다',
    bindings: [
      {
        kind: 'metric',
        target: 'conversion',
        threshold: 'CUSUM 결정 구간 1.5 · ADWIN δ 0.05',
        threshold_rationale: '이동폭 0.5를 탐지하려는 설정. 시뮬레이션 고정값이며 실제 사용에서는 사용자가 정한다.',
        threshold_owner: 'user',
      },
    ],
    cusumPrior: scenario === 'sensor_blind' ? CUSUM_PRIOR : CUSUM_PRIOR,
    adwinPrior: ADWIN_PRIOR,
    portfolioPrior: PORTFOLIO_PRIOR,
    now: base,
  });

  // 판독 열을 시나리오별로 만든다. 40건 — ADWIN 경계가 유효해지는 크기.
  for (let h = 0; h < 40; h += 1) {
    if (scenario === 'sensor_blind') {
      premise = appendReading(premise, reading('conversion', null, base, h), base);
      continue;
    }
    if (scenario === 'stable_world' || scenario === 'evidence_retracted') {
      premise = appendReading(premise, reading('conversion', String(3 + (h % 2 ? 0.02 : -0.02)), base, h), base);
      continue;
    }
    // premise_breaks · alert_then_settle: 20시간 지점에서 수준이 옮긴다.
    premise = appendReading(premise, reading('conversion', String(h < 20 ? 3 : 8), base, h), base);
  }

  const frames: CognitiveFrame[] = [];
  const attributions = new Map<string, OutcomeAttribution>();

  // 경보(20h)보다 먼저 봉인한 판단 하나, 나중에 봉인한 판단 하나 — M2의 양쪽.
  const early = humanFrame(`${scenario}_early`, base, 5);
  const late = humanFrame(`${scenario}_late`, base, 30);
  frames.push(early, late);
  premise = referenceFrom(premise, early.id, base);
  premise = referenceFrom(premise, late.id, base);

  if (scenario === 'alert_then_settle') {
    // 경보 후 귀환: late 를 35h 에 정산한다 → M3 지연 약 15시간.
    const settled = settleFrame({
      frame: late,
      settlement: {
        falsifier_observed: true,
        observed: '전환율이 절반 밑으로 갔다',
        evidence_ref: `sim:settle:${late.id}`,
        observed_at: iso(base, 35),
        retrospective: '돌아보면 신호가 먼저 있었다',
      },
      now: base + 35 * 3_600_000,
    });
    frames[1] = settled;
    attributions.set(settled.id, 'luck');

    // M5 를 계산 가능하게 만들려면 성공·실패 양쪽이 각 3건 필요하다.
    for (let i = 0; i < 3; i += 1) {
      const win = settleFrame({
        frame: humanFrame(`${scenario}_win${i}`, base, 2),
        settlement: {
          falsifier_observed: false,
          observed: '반증 조건이 오지 않았다',
          evidence_ref: `sim:win${i}`,
          observed_at: iso(base, 40 + i),
          retrospective: '',
        },
        now: base + (40 + i) * 3_600_000,
      });
      frames.push(win);
      attributions.set(win.id, 'judgment');
    }
    for (let i = 0; i < 2; i += 1) {
      const loss = settleFrame({
        frame: humanFrame(`${scenario}_loss${i}`, base, 2),
        settlement: {
          falsifier_observed: true,
          observed: '반증 조건이 관찰됐다',
          evidence_ref: `sim:loss${i}`,
          observed_at: iso(base, 45 + i),
          retrospective: '',
        },
        now: base + (45 + i) * 3_600_000,
      });
      frames.push(loss);
      attributions.set(loss.id, 'luck');
    }
  }

  const crossings: Crossing[] =
    scenario === 'evidence_retracted'
      ? [
          retractCrossing(
            {
              kind: 'signal_reading',
              evidence_ref: 'conversion@wrong',
              observed_at: iso(base, 10),
              observed: '전환율 3.0 확인 — 이라고 읽었다',
            },
            iso(base, 25),
            '이 지표는 이 전제의 증거가 아니었다 (다른 세그먼트를 봤다)',
          ),
        ]
      : [];

  return { scenario, premise, frames, attributions, crossings };
}

export interface SystemViolation {
  scenario: SystemScenario;
  invariant: string;
  detail: string;
}

/**
 * 시스템 불변식 — **루프의 주장이 참인가.**
 *
 * 양방향 검사: 일어나야 할 일이 일어나고, 일어나선 안 될 일이 안 일어난다.
 * 후자를 빼면 "전부 경보"하는 시스템이 만점을 받는다.
 */
export function checkSystemInvariants(ep: SystemEpisode): SystemViolation[] {
  const v: SystemViolation[] = [];
  const push = (invariant: string, detail: string) => v.push({ scenario: ep.scenario, invariant, detail });

  const assessment = assessPremise(ep.premise);
  const triggers = returnTriggers([ep.premise], ep.frames);
  const m2 = measureM2([ep.premise], ep.frames);
  const m3 = measureM3([ep.premise], ep.frames);

  const expectedStance: Record<SystemScenario, PremiseStance[]> = {
    stable_world: ['holds'],
    premise_breaks: ['shaken', 'contested'],
    alert_then_settle: ['shaken', 'contested'],
    // 판독이 전부 미판독이면 "괜찮다"가 아니라 "아직 모른다"다.
    sensor_blind: ['unread'],
    evidence_retracted: ['holds'],
  };

  // S1. 전제의 처지가 시나리오와 맞는가.
  if (!expectedStance[ep.scenario].includes(assessment.stance)) {
    push('S1 전제 처지', `기대 ${expectedStance[ep.scenario].join('|')} 인데 ${assessment.stance} 가 나왔다`);
  }

  // S2. 미판독은 경보도 holds 도 아니다 — 조용한 초록이 가장 위험한 상태다.
  if (ep.scenario === 'sensor_blind') {
    if (assessment.stance === 'holds') push('S2 미판독 보존', '판독이 전부 미판독인데 holds 로 판정됐다');
    if (!assessment.statement.includes('아직 모른다')) {
      push('S2 미판독 보존', '미판독 상태의 문장이 "아직 모른다"를 밝히지 않았다');
    }
  }

  // S3. 전제가 흔들리면 봉인된 판단이 깨어난다. 안 흔들리면 깨어나지 않는다.
  const shaken = assessment.stance === 'shaken' || assessment.stance === 'contested';
  if (shaken && triggers.length === 0) push('S3 귀환 트리거', '전제가 흔들렸는데 깨어난 판단이 없다');
  if (!shaken && triggers.length > 0) push('S3 귀환 트리거', '전제가 멀쩡한데 판단이 깨어났다 (과발화)');

  // S4. 이미 정산된 판단은 깨우지 않는다 — 닫힌 결정을 다시 여는 것은 과발화다.
  for (const t of triggers) {
    for (const fid of t.wake_frame_ids) {
      const f = ep.frames.find((x) => x.id === fid);
      if (f?.status === 'settled') push('S4 과발화 금지', `정산된 판단 ${fid} 을 깨웠다`);
    }
  }

  // S5. M2 — 경보 이후 봉인은 분자에, 이전 봉인은 분모에만.
  if (shaken && assessment.alerted_at) {
    if (m2.state !== 'measured') {
      push('S5 M2', '경보가 있는데 M2가 measured 가 아니다');
    } else {
      const alertMs = Date.parse(assessment.alerted_at);
      for (const c of m2.cases) {
        if (Date.parse(c.sealed_at) <= alertMs) push('S5 M2', `경보 이전 봉인 ${c.frame_id} 이 분자에 들었다`);
      }
      if (m2.numerator > m2.denominator) push('S5 M2', '분자가 분모보다 크다');
    }
  }
  // 분모가 0이면 비율을 내지 않는다 (0%는 "괜찮다"로 읽힌다).
  if (m2.state === 'no_denominator' && m2.ratio !== null) push('S5 M2', '분모 0인데 비율을 냈다');

  // S6. M3 — 정산 전이면 pending, 정산 후면 지연이 양수.
  if (ep.scenario === 'premise_breaks') {
    if (m3.pending.length === 0) push('S6 M3', '경보 후 열린 판단이 있는데 pending 이 비었다');
    if (m3.median_delay_ms !== null) push('S6 M3', '정산이 없는데 중위 지연이 숫자로 나왔다');
  }
  if (ep.scenario === 'alert_then_settle') {
    if (m3.resolved_delays_ms.length === 0) push('S6 M3', '정산했는데 지연이 기록되지 않았다');
    for (const d of m3.resolved_delays_ms) if (d < 0) push('S6 M3', `음수 지연 ${d} 이 기록됐다`);
  }

  // S7. M5 — 양쪽 표본이 차면 measured, 아니면 "아직 모릅니다".
  const settlements: AttributedSettlement[] = ep.frames
    .filter((f) => f.status === 'settled' && f.settlement && ep.attributions.has(f.id))
    .map((f) => ({
      frame_id: f.id,
      succeeded: !f.settlement!.falsifier_observed,
      attribution: ep.attributions.get(f.id)!,
      evidence_ref: f.settlement!.evidence_ref,
      observed_at: f.settlement!.observed_at,
    }));
  const m5 = measureM5(settlements);
  const wins = settlements.filter((s) => s.succeeded).length;
  const losses = settlements.length - wins;
  if (wins >= 3 && losses >= 3 && m5.state !== 'measured') {
    push('S7 M5', `성공 ${wins} 실패 ${losses} 인데 measured 가 아니다`);
  }
  if ((wins < 3 || losses < 3) && m5.state === 'measured') {
    push('S7 M5', `표본이 모자란데(${wins}/${losses}) 숫자를 냈다`);
  }
  if (m5.state === 'measured' && /경향|성향|편향이 있습니다/.test(m5.statement)) {
    push('S7 M5', `성향 판정 어휘가 문장에 들어갔다: ${m5.statement}`);
  }

  // S8. 철회 — 증거가 철회되면 원소는 프레임 안으로 되돌아온다 (넘나듦).
  if (ep.scenario === 'evidence_retracted') {
    const traj = worldTrajectory(ep.crossings);
    if (traj.length < 2) push('S8 넘나듦', `철회했는데 궤적이 ${traj.length} 개다 (승격→복귀 2개여야 한다)`);
    else if (traj[traj.length - 1].to !== 'in_frame') push('S8 넘나듦', '철회 후에도 현실 접촉으로 남아 있다');
  }

  // S9. 모든 판정 문장에 사람에 대한 주장이 없다.
  const allStatements = [assessment.statement, m2.statement, m3.statement, m5.state === 'measured' ? m5.statement : m5.reason];
  for (const s of allStatements) {
    if (/^당신은|당신의 성향|경향이 있습니다|등급/.test(s)) push('S9 무판정', `사람에 대한 판정 문장: ${s}`);
  }

  // S10. 경보 결과에는 임계가 동봉된다 — 숨긴 임계는 거짓말이다.
  for (const d of assessment.detections) {
    if (d.prior === null || d.prior === undefined) push('S10 임계 공시', `${d.method} 결과에 사전 믿음이 없다`);
  }

  return v;
}

export interface SystemReport {
  base_time: string;
  scenarios: SystemScenario[];
  /** 시나리오별 전제 처지 — 전 경로를 밟았는지 확인. */
  stances: Record<string, PremiseStance>;
  /** 시나리오별 깨어난 판단 수. */
  woken: Record<string, number>;
  m2: Record<string, string>;
  m3: Record<string, string>;
  m5: Record<string, string>;
  violations: SystemViolation[];
}

export function runSystemSimulation(baseTime: number): SystemReport {
  const stances: Record<string, PremiseStance> = {};
  const woken: Record<string, number> = {};
  const m2: Record<string, string> = {};
  const m3: Record<string, string> = {};
  const m5: Record<string, string> = {};
  const violations: SystemViolation[] = [];

  for (const scenario of SYSTEM_SCENARIOS) {
    const ep = buildSystemEpisode(scenario, baseTime);
    stances[scenario] = assessPremise(ep.premise).stance;
    woken[scenario] = returnTriggers([ep.premise], ep.frames).reduce((s, t) => s + t.wake_frame_ids.length, 0);
    m2[scenario] = measureM2([ep.premise], ep.frames).statement;
    m3[scenario] = measureM3([ep.premise], ep.frames).statement;
    const settlements: AttributedSettlement[] = ep.frames
      .filter((f) => f.status === 'settled' && f.settlement && ep.attributions.has(f.id))
      .map((f) => ({
        frame_id: f.id,
        succeeded: !f.settlement!.falsifier_observed,
        attribution: ep.attributions.get(f.id)!,
        evidence_ref: f.settlement!.evidence_ref,
        observed_at: f.settlement!.observed_at,
      }));
    const r5 = measureM5(settlements);
    m5[scenario] = r5.state === 'measured' ? r5.statement : r5.reason;
    violations.push(...checkSystemInvariants(ep));
  }

  return {
    base_time: new Date(baseTime).toISOString(),
    scenarios: [...SYSTEM_SCENARIOS],
    stances,
    woken,
    m2,
    m3,
    m5,
    violations,
  };
}
