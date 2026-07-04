import { describe, it, expect } from 'vitest';
import {
  evaluateMateriality,
  type MaterialityRule,
  type MaterialityCtx,
  type PremiseValue,
  type Materiality,
} from '../numeric-drift.js';

/**
 * M2 drift-materiality test matrix (M2-RULE-TABLE §8), verbatim as a fixture.
 * Expected: M=material, U=uncertain (silent + notice, no auto-handle), N=unchanged.
 *
 * A few cases in §8 admit "M/U" or "U/N" depending on whether the premise opts
 * into a rule (stateful, complement axis). Those are split into the two concrete
 * variants below — the base (no rule → the under-fire default) and the opt-in.
 */

type Exp = 'M' | 'U' | 'N';
const EXP: Record<Exp, Materiality> = { M: 'material', U: 'uncertain', N: 'unchanged' };

interface Case {
  id: string;
  prev: PremiseValue;
  next: PremiseValue;
  rule?: MaterialityRule;
  ctx?: MaterialityCtx;
  expect: Exp;
  note?: string;
}

const lbl = (label: string): PremiseValue => ({ label });

// ── 8.1 금리·수익률 (RATE) ──────────────────────────────────────────────────
const RATE: Case[] = [
  { id: 'RATE-01', prev: 3.5, next: 3.25, expect: 'M', rule: { type: 'step', params: { S: 0.25, N: 1 } } },
  { id: 'RATE-02', prev: 4.3, next: 4.0, expect: 'M', rule: { type: 'threshold', params: { line: 4.0, direction: 'below' }, modifiers: { boundary: 'inclusive' } } },
  { id: 'RATE-03', prev: 3.6, next: 3.8, expect: 'M', rule: { type: 'delta', params: { D: 0.15 } } },
  { id: 'RATE-04', prev: 3.6, next: 3.61, expect: 'N', rule: { type: 'delta', params: { D: 0.15 }, modifiers: { resolution: 0.01 } } },
  { id: 'RATE-05', prev: 5.5, next: 5.0, expect: 'M', rule: { type: 'step', params: { S: 0.25, N: 1 } } },
  { id: 'RATE-06', prev: 3.5, next: 3.85, expect: 'M', rule: { type: 'band', params: { lo: 3.2, hi: 3.8 } } },
  { id: 'RATE-07', prev: 3.5, next: 3.05, expect: 'U', rule: { type: 'stateful', params: { mode: 'horizon' } }, note: 'parking horizon undefined → depends → U' },
  { id: 'RATE-08', prev: 3.0, next: 3.3, expect: 'M', rule: { type: 'delta', params: { D: 0.25 }, modifiers: { unit_axis: 'percentage_point' } } },
  { id: 'RATE-09', prev: 5.5, next: 5.5, expect: 'N' },
  { id: 'RATE-10a', prev: 3.5, next: 3.5, expect: 'N', note: 'two-snapshot compare, prev==next → silent' },
  { id: 'RATE-10b', prev: 3.5, next: 3.55, expect: 'U', rule: { type: 'stateful', params: { mode: 'crossings' } }, note: 'stateful opted-in, endpoints differ → path not decidable from snapshots' },
  { id: 'RATE-11', prev: lbl('A'), next: lbl('A-'), expect: 'M', rule: { type: 'step', params: { S: 1, N: 1 }, modifiers: { scale: 'sp_credit' } } },
  { id: 'RATE-12', prev: 0.5, next: -0.3, expect: 'M', rule: { type: 'delta', params: { D: 0.1 }, modifiers: { direction: 'sign_flip', zero_meaningful: true } }, note: 'real-rate zero-crossing' },
  { id: 'RATE-13', prev: 0.05, next: 0.25, expect: 'M', rule: { type: 'delta', params: { D: 0.1 } }, note: 'near-zero → delta, not relative' },
  { id: 'RATE-14', prev: 25, next: 75, expect: 'U', rule: { type: 'stateful', params: { mode: 'meta' } }, note: 'step-size itself changed = meta → rule-uncovered' },
];

// ── 8.2 가격·시장·환율 (PM) ────────────────────────────────────────────────
const PM: Case[] = [
  { id: 'PM-01', prev: 1350, next: 1408, expect: 'M', rule: { type: 'band', params: { lo: 1300, hi: 1400 } } },
  { id: 'PM-02', prev: 3.5, next: 3.75, expect: 'M', rule: { type: 'step', params: { S: 0.25, N: 1 } } },
  // §8 depends→U: the drawdown-from-entry framing is path-dependent (has the
  // dip persisted? is -20 the right line?), not a crisp single-snapshot threshold
  // — so the honest default is U, not a manufactured alert.
  { id: 'PM-03', prev: 0, next: -12, expect: 'U', rule: { type: 'stateful', params: { mode: 'drawdown' } }, note: 'stop-line not reached, path-dependent → U' },
  { id: 'PM-04', prev: 60000, next: 52800, expect: 'N', rule: { type: 'relative', params: { P: 0.30 } } },
  { id: 'PM-05', prev: 9000, next: 9850, expect: 'M', rule: { type: 'delta', params: { D: 500 } } },
  { id: 'PM-06', prev: 150, next: 158, expect: 'M', rule: { type: 'threshold', params: { line: 155, direction: 'above' }, modifiers: { boundary: 'inclusive', direction: 'harmful_only', harmful_dir: 'up' } } },
  { id: 'PM-07', prev: 1340, next: 1345, expect: 'N', rule: { type: 'relative', params: { P: 0.10 } } },
  { id: 'PM-08', prev: 5.2, next: 4.6, expect: 'M', rule: { type: 'threshold', params: { line: 5.0, direction: 'below' }, modifiers: { boundary: 'inclusive' } } },
  { id: 'PM-09a', prev: -3, next: -11, expect: 'U', rule: { type: 'stateful', params: { mode: 'drawdown' } }, note: 'running-peak needed; opt-in but snapshots can\'t give it' },
  { id: 'PM-10a', prev: 0.4, next: 1.6, expect: 'U', rule: { type: 'stateful', params: { mode: 'range' } }, note: 'volatility = 2nd moment' },
  { id: 'PM-11', prev: 100, next: 100, expect: 'N', note: 'nominal unchanged; real-rate derived axis needs separate premise' },
  { id: 'PM-12', prev: 0.85, next: 0.30, expect: 'U', rule: { type: 'stateful', params: { mode: 'derived' } }, note: 'correlation = bivariate, outside univariate rules' },
  { id: 'PM-13', prev: 12, next: 9, expect: 'M', rule: { type: 'threshold', params: { line: 10, direction: 'below' }, modifiers: { boundary: 'inclusive' } } },
  { id: 'PM-14', prev: 100, next: 113, expect: 'U', rule: { type: 'stateful', params: { mode: 'trend' } }, note: 'spike vs trend indistinguishable from snapshots' },
];

// ── 8.3 확률·백분율·비율 (PCT) ────────────────────────────────────────────
const PCT: Case[] = [
  { id: 'PCT-01', prev: 3.0, next: 2.6, expect: 'M', rule: { type: 'relative', params: { P: 0.10 } } },
  { id: 'PCT-02a', prev: 99.9, next: 99.5, expect: 'U', note: 'success-rate axis (no rule) → ratio axis undefined' },
  { id: 'PCT-02b', prev: 0.1, next: 0.5, expect: 'M', rule: { type: 'relative', params: { P: 0.10 }, modifiers: { unit_axis: 'complement' } }, note: 'failure rate 0.1%→0.5% = 5x' },
  { id: 'PCT-03', prev: 52, next: 49, expect: 'M', rule: { type: 'threshold', params: { line: 50, direction: 'below' }, modifiers: { boundary: 'exclusive' } } },
  { id: 'PCT-04', prev: 0.048, next: 0.052, expect: 'M', rule: { type: 'threshold', params: { line: 0.05, direction: 'above' }, modifiers: { boundary: 'inclusive' } } },
  { id: 'PCT-05', prev: 1.0, next: 1.3, expect: 'U', rule: { type: 'relative', params: { P: 0.10 }, modifiers: { unit_axis: 'ratio' } }, note: '%-value, small sample; axis (rel vs %p) undeclared → U' },
  { id: 'PCT-06', prev: 5, next: 5.4, expect: 'U', rule: { type: 'relative', params: { P: 0.10 }, modifiers: { unit_axis: 'ratio' } }, note: 'rel 8% < 10% %-value, axis undeclared → U' },
  { id: 'PCT-07', prev: 40, next: 31, expect: 'M', rule: { type: 'relative', params: { P: 0.10 } } },
  { id: 'PCT-08', prev: 0.70, next: 0.63, expect: 'U', rule: { type: 'relative', params: { P: 0.10 } }, note: 'exactly 10.00% → knife-edge' },
  { id: 'PCT-09', prev: 2, next: -1, expect: 'M', rule: { type: 'delta', params: { D: 0.5 }, modifiers: { direction: 'sign_flip', zero_meaningful: true } } },
  // §8 PCT-10 note sanctions "명시축이면 5.9%<10% 침묵": with a plain absolute axis
  // and no complement declared, 85→90 is below threshold → silent (N). The U is
  // the "declare a complement axis" nudge, not a mechanical verdict.
  { id: 'PCT-10', prev: 85, next: 90, expect: 'N', note: 'rejection-rate, no complement declared, 5.9% < 10% → silent (§8 note)' },
  { id: 'PCT-10b', prev: 90, next: 95, expect: 'U', note: 'near-ceiling (≥90) → complement-ambiguous → U' },
  { id: 'PCT-11', prev: 0.5, next: -0.3, expect: 'U', rule: { type: 'delta', params: { D: 0.1 }, modifiers: { direction: 'sign_flip' } }, note: 'growth-rate sign flip but zero_meaningful undeclared → U (no forced alert)' },
  { id: 'PCT-12a', prev: 95, next: 90, expect: 'U', note: 'efficacy axis ambiguous, no rule → U' },
  { id: 'PCT-12b', prev: 5, next: 10, expect: 'M', rule: { type: 'relative', params: { P: 0.10 }, modifiers: { unit_axis: 'complement' } }, note: 'undefended 5%→10% = 2x' },
  { id: 'PCT-13a', prev: 80, next: 72, expect: 'M', rule: { type: 'threshold', params: { line: 75, direction: 'below' }, modifiers: { boundary: 'inclusive' } }, note: 'lower-bound breach' },
  { id: 'PCT-13b', prev: 80, next: 72, expect: 'U', note: 'band undefined → U' },
  { id: 'PCT-14', prev: 0.02, next: 0.05, expect: 'M', rule: { type: 'relative', params: {}, modifiers: { unit_axis: 'absolute', near_zero_cut: 1 } }, note: 'near-zero 2.5x absolute, no safety_floor → multiplier fires M' },
];

// ── 8.4 개수·규모 (INV/CNT/HC/REV) ────────────────────────────────────────
const CNT: Case[] = [
  { id: 'INV-01', prev: 500, next: 380, expect: 'M', rule: { type: 'delta', params: { D: 100 } } },
  { id: 'INV-02', prev: 44, next: 40, expect: 'M', rule: { type: 'threshold', params: { line: 40, direction: 'below' }, modifiers: { boundary: 'inclusive' } } },
  { id: 'INV-03', prev: 12000, next: 11050, expect: 'N', rule: { type: 'delta', params: { D: 2000 } } },
  { id: 'CNT-04', prev: 8, next: 9, expect: 'M', rule: { type: 'delta', params: { D: 1 } } },
  { id: 'CNT-05', prev: 3, next: 6, expect: 'U', note: 'near-zero 100% explosion, no rule → U' },
  { id: 'HC-06', prev: 5, next: 4, expect: 'M', rule: { type: 'delta', params: { D: 1 } } },
  { id: 'HC-07', prev: 6, next: 5, expect: 'U', rule: { type: 'stateful', params: { mode: 'nonlinear_floor' } }, note: 'delta 1 but nonlinear below 5 — depends, needs a declared floor → U' },
  { id: 'REV-08', prev: 3200000, next: 3050000, expect: 'N', rule: { type: 'relative', params: { P: 0.10 } } },
  { id: 'REV-09', prev: 40, next: 55, expect: 'M', rule: { type: 'delta', params: { D: 10 }, modifiers: { unit_axis: 'percentage_point' } } },
  { id: 'INV-10', prev: 0, next: 3, expect: 'M', rule: { type: 'threshold', params: { line: 0, direction: 'above' }, modifiers: { boundary: 'exclusive' } }, note: '0 → non-0 state change' },
  // §8 CNT-11 note: "대규모라 일상변동" — 4% could be routine or signal depending on
  // the scale-derived noise floor the premise hasn't declared → depends → U.
  { id: 'CNT-11', prev: 10000, next: 10400, expect: 'U', rule: { type: 'stateful', params: { mode: 'scale_floor' } }, note: '4% large-scale, scale-derived floor undeclared → depends → U' },
  { id: 'INV-12', prev: 200, next: 195, expect: 'N', note: 'non-monotone path, no stateful → net snapshot small = silent' },
  { id: 'INV-12b', prev: 200, next: 180, expect: 'U', rule: { type: 'stateful', params: { mode: 'crossings' } }, note: 'stateful opted-in → path not decidable from snapshots' },
  { id: 'HC-13', prev: 12, next: 11, expect: 'U', rule: { type: 'stateful', params: { mode: 'qualitative' } }, note: '8.3% < 10% but real signal is qualitative (who left) → outside numeric → U (§5)' },
  { id: 'REV-14', prev: 0, next: 0, expect: 'N', note: 'watched value unchanged; proxy moved (separate premise)' },
];

// ── 8.5 부호·수지·성장 (SBG) ───────────────────────────────────────────────
const SBG: Case[] = [
  { id: 'SBG-01', prev: 8, next: -2, expect: 'M', rule: { type: 'delta', params: { D: 1 }, modifiers: { direction: 'sign_flip', zero_meaningful: true } } },
  { id: 'SBG-02', prev: 1200, next: -300, expect: 'M', rule: { type: 'delta', params: { D: 100 }, modifiers: { direction: 'sign_flip', zero_meaningful: true } } },
  { id: 'SBG-03', prev: 3, next: -1, expect: 'M', rule: { type: 'delta', params: { D: 0.5 }, modifiers: { direction: 'sign_flip', zero_meaningful: true } } },
  { id: 'SBG-04', prev: 30, next: 26, expect: 'N', rule: { type: 'relative', params: { P: 0.20 } }, note: '13% robust plus, direction held' },
  { id: 'SBG-05', prev: 0.5, next: -0.4, expect: 'N', rule: { type: 'band', params: { lo: -1, hi: 1 } }, note: 'dead-band round-trip; sign flip must NOT fire' },
  { id: 'SBG-06', prev: -1, next: -6, expect: 'M', rule: { type: 'delta', params: { D: 3 } } },
  { id: 'SBG-07', prev: -50, next: -53, expect: 'N', rule: { type: 'delta', params: { D: 10 } }, note: 'big division; D from scale' },
  // §8 SBG-08: the M comes from delta(15억), not the threshold (−320 not yet crossed).
  { id: 'SBG-08', prev: -300, next: -318, expect: 'M', rule: { type: 'delta', params: { D: 15 } }, note: 'Δ18 ≥ 15 near approval line → M (threshold −320 not yet crossed)' },
  { id: 'SBG-09', prev: 2.1, next: 0.2, expect: 'U', rule: { type: 'stateful', params: { mode: 'trend' } }, note: 'recession-line not reached, ambiguous' },
  { id: 'SBG-10', prev: 4, next: -1, expect: 'M', rule: { type: 'threshold', params: { line: 0, direction: 'below' }, modifiers: { boundary: 'inclusive' } } },
  { id: 'SBG-11', prev: 3, next: -2, expect: 'U', rule: { type: 'stateful', params: { mode: 'event' } }, note: 'freeze-event condition, depends' },
  { id: 'SBG-12', prev: 40, next: 2, expect: 'M', rule: { type: 'threshold', params: { line: 10, direction: 'below' }, modifiers: { boundary: 'inclusive' } } },
  { id: 'SBG-13', prev: 50, next: -20, expect: 'U', rule: { type: 'stateful', params: { mode: 'meta' } }, note: 'accounting standard change = meta' },
  { id: 'SBG-14', prev: 12, next: 11, expect: 'N', rule: { type: 'relative', params: { P: 0.20 } }, note: 'direction & magnitude held' },
  { id: 'SBG-15', prev: 500, next: 500, expect: 'N', note: 'non-monotone, prev==next → N' },
  { id: 'SBG-15b', prev: 500, next: 480, expect: 'U', rule: { type: 'stateful', params: { mode: 'crossings' } }, note: 'stateful opted-in, endpoints differ → path not decidable' },
];

// ── 8.6 범주형·상태 (CAT) ──────────────────────────────────────────────────
const CAT: Case[] = [
  { id: 'CAT-01', prev: lbl('A'), next: lbl('BBB'), expect: 'M', rule: { type: 'step', params: { S: 1, N: 1 }, modifiers: { scale: 'sp_credit' } } },
  { id: 'CAT-02', prev: lbl('BBB-'), next: lbl('BB+'), expect: 'M', rule: { type: 'threshold', params: { line: 10, direction: 'above' }, modifiers: { scale: 'sp_credit', boundary: 'exclusive' } }, note: 'BBB- rank 10, BB+ rank 11 crosses investment-grade line' },
  { id: 'CAT-03', prev: lbl('AAA'), next: lbl('AA+'), expect: 'N', rule: { type: 'step', params: { S: 1, N: 2 }, modifiers: { scale: 'sp_credit' } }, note: '1 notch, N>=2 → silent' },
  { id: 'CAT-04', prev: lbl('A'), next: lbl('AA-'), expect: 'N', rule: { type: 'band', params: { lo: 4, hi: 6 }, modifiers: { scale: 'sp_credit' } }, note: 'A-=7? band A-(7)..AA(3); A=6 AA-=4 both inside' },
  { id: 'CAT-05', prev: lbl('BBB'), next: lbl('BBB+'), expect: 'N', rule: { type: 'step', params: { S: 1, N: 1 }, modifiers: { scale: 'sp_credit', direction: 'harmful_only', harmful_dir: 'up' } }, note: 'upgrade (rank down) ignored' },
  { id: 'CAT-06', prev: lbl('Baa2'), next: lbl('BBB'), expect: 'N', rule: { type: 'step', params: { S: 1, N: 1 }, modifiers: { scale: 'sp_credit' } }, note: 'alias equal after normalization' },
  { id: 'CAT-07', prev: lbl('Enterprise'), next: lbl('Business'), expect: 'M', rule: { type: 'step', params: { S: 1, N: 1 }, modifiers: { scale: 'tier' } } },
  { id: 'CAT-08', prev: lbl('available'), next: lbl('deprecated'), expect: 'M', rule: { type: 'map', params: { material_states: ['deprecated', 'removed', 'eol'] } } },
  { id: 'CAT-09', prev: lbl('under review'), next: lbl('CRL'), expect: 'M', rule: { type: 'map', params: { material_states: ['CRL', 'rejected'] } } },
  { id: 'CAT-10', prev: lbl('in force'), next: lbl('under challenge'), expect: 'U', rule: { type: 'map', params: { material_states: ['revoked', 'invalidated'] } }, note: 'not in material set → U' },
  { id: 'CAT-11', prev: lbl('Active'), next: lbl('Maintenance'), expect: 'U', rule: { type: 'map', params: { material_states: ['EOL'] } }, note: 'only EOL hard-material' },
  { id: 'CAT-12', prev: lbl('재직'), next: lbl('이임'), expect: 'M', rule: { type: 'map', params: { material_states: ['이임', 'departing', 'resigned'] } } },
];

// ── 8.7 날짜·마감 (DATE) — dates as day-numbers (ordinal ints) ─────────────
const DATE: Case[] = [
  { id: 'DATE-01', prev: 1, next: 10, expect: 'N', rule: { type: 'threshold', params: { line: 15, direction: 'above' }, modifiers: { boundary: 'inclusive' } }, note: '3-01→3-10, deadline 3-15 not crossed' },
  { id: 'DATE-02', prev: 1, next: 20, expect: 'M', rule: { type: 'threshold', params: { line: 15, direction: 'above' }, modifiers: { boundary: 'inclusive' } } },
  { id: 'DATE-03', prev: 30, next: 40, expect: 'M', rule: { type: 'delta', params: { D: 7 } } },
  { id: 'DATE-04', prev: 30, next: 32, expect: 'N', rule: { type: 'delta', params: { D: 7 }, modifiers: { resolution: 1 } } },
  { id: 'DATE-05', prev: 15, next: 8, expect: 'N', rule: { type: 'delta', params: { D: 3 }, modifiers: { direction: 'harmful_only', harmful_dir: 'up' } }, note: 'pulled earlier = beneficial → silent' },
  { id: 'DATE-06', prev: -1, next: 27, expect: 'M', rule: { type: 'threshold', params: { line: 0, direction: 'above' }, modifiers: { boundary: 'inclusive' } }, note: '6-30→7-28 crossing 7-01 sale date' },
  { id: 'DATE-07', prev: 15, next: -30, expect: 'M', rule: { type: 'threshold', params: { line: 0, direction: 'below' }, modifiers: { boundary: 'inclusive' } }, note: 'flips relative to our Aug date' },
  { id: 'DATE-08', prev: -11, next: 5, expect: 'M', rule: { type: 'threshold', params: { line: 0, direction: 'above' }, modifiers: { boundary: 'inclusive' } }, note: 'year-end boundary' },
  { id: 'DATE-09', prev: 90, next: 99, expect: 'U', rule: { type: 'relative', params: { P: 0.10 } }, note: 'exactly 10.0% → knife-edge' },
  { id: 'DATE-10', prev: 0, next: -7, expect: 'M', rule: { type: 'threshold', params: { line: -1, direction: 'below' }, modifiers: { boundary: 'inclusive' } }, note: 'legal renewal line, direction-agnostic; 8-31→8-24 pulled earlier past line' },
  { id: 'DATE-11', prev: 1, next: 1, expect: 'N', note: '6-01→(6-10)→6-01 round-trip' },
  { id: 'DATE-12', prev: -1, next: 5, expect: 'M', rule: { type: 'threshold', params: { line: 0, direction: 'above' }, modifiers: { boundary: 'inclusive' } }, note: 'Q3-end→Q4-start' },
  { id: 'DATE-13', prev: 45, next: 41, expect: 'U', rule: { type: 'stateful', params: { mode: 'buffer' } }, note: 'within buffer, depends' },
  { id: 'DATE-14', prev: 15, next: 16, expect: 'N', rule: { type: 'delta', params: { D: 7 }, modifiers: { resolution: 1 } }, note: 'TZ 1-day noise' },
];

// ── 8.8 물리·측정 (PHY) ────────────────────────────────────────────────────
const PHY: Case[] = [
  { id: 'PHY-01', prev: -0.5, next: 0.3, expect: 'M', rule: { type: 'threshold', params: { line: 0, direction: 'above' }, modifiers: { boundary: 'exclusive' } }, note: 'CI lower bound crosses 0' },
  { id: 'PHY-02', prev: 37.4, next: 38.1, expect: 'M', rule: { type: 'threshold', params: { line: 38.0, direction: 'above' }, modifiers: { boundary: 'inclusive' } } },
  { id: 'PHY-03', prev: 70.4, next: 70.6, expect: 'N', ctx: { resolution: 0.1 }, note: 'no explicit D; 0.2 move is resolution-scale noise → N' },
  { id: 'PHY-04', prev: 20, next: 25, expect: 'U', rule: { type: 'stateful', params: { mode: 'axis' } }, note: '℃ delta vs K relative trap → axis must be declared' },
  { id: 'PHY-05', prev: 2, next: 4, expect: 'M', rule: { type: 'relative', params: { P: 0.50 } }, note: '+100% relative' },
  { id: 'PHY-06', prev: 4.001, next: 4.0011, expect: 'N', note: 'significant-figure noise' },
  { id: 'PHY-07', prev: lbl('A'), next: lbl('B'), expect: 'M', rule: { type: 'step', params: { S: 1, N: 1 }, modifiers: { scale: 'quality' } } },
  { id: 'PHY-08', prev: 800, next: 820, expect: 'U', rule: { type: 'stateful', params: { mode: 'time_ratio' } }, note: 'time-fraction not instantaneous' },
  { id: 'PHY-09', prev: 0.01, next: 0.03, expect: 'N', rule: { type: 'delta', params: { D: 0.5 }, modifiers: { safety_floor: 0.5 } }, note: 'small vs regulatory safety floor' },
  { id: 'PHY-10', prev: 60, next: 66, expect: 'M', rule: { type: 'threshold', params: { line: 65, direction: 'above' }, modifiers: { boundary: 'inclusive' } }, note: 'dB log; threshold, not %' },
  { id: 'PHY-11', prev: 40, next: 40, expect: 'N', note: 'mpg→mpg unit unchanged' },
  { id: 'PHY-12', prev: 2, next: -3, expect: 'M', rule: { type: 'delta', params: { D: 1 }, modifiers: { direction: 'sign_flip', zero_meaningful: true } } },
  { id: 'PHY-13', prev: 6, next: 7, expect: 'U', rule: { type: 'stateful', params: { mode: 'meta' } }, note: '10-pt→11-pt scale revision = meta' },
  { id: 'PHY-14', prev: 10.0, next: 10.06, expect: 'M', rule: { type: 'band', params: { lo: 9.95, hi: 10.05 } } },
];

const ALL: Case[] = [...RATE, ...PM, ...PCT, ...CNT, ...SBG, ...CAT, ...DATE, ...PHY];

describe('M2 evaluateMateriality — §8 matrix', () => {
  for (const c of ALL) {
    it(`${c.id}${c.note ? ` — ${c.note}` : ''}`, () => {
      const r = evaluateMateriality(c.prev, c.next, c.rule, c.ctx);
      expect(r.status, `${c.id}: got "${r.status}" (${r.reason}), expected ${EXP[c.expect]}`).toBe(EXP[c.expect]);
    });
  }

  it('§8.9 depends→U never auto-fires material (spine): every U case is uncertain', () => {
    const us = ALL.filter((c) => c.expect === 'U');
    for (const c of us) {
      const r = evaluateMateriality(c.prev, c.next, c.rule, c.ctx);
      expect(r.status, c.id).not.toBe('material');
    }
  });

  it('§8.9 false-alert defense: no N case comes back material', () => {
    const ns = ALL.filter((c) => c.expect === 'N');
    for (const c of ns) {
      const r = evaluateMateriality(c.prev, c.next, c.rule, c.ctx);
      expect(r.status, c.id).not.toBe('material');
    }
  });
});
