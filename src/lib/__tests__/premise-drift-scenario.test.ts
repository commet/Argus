import { describe, it, expect } from 'vitest';
import { createItem, registerDismissal, type DecisionItem } from '../decision-items';
import { evaluateDrift, shouldFireAlert } from '../premise-drift';

/**
 * End-to-end scenario for the living-premises re-check — the exact decision path
 * the plugin `/argus:track check` skill mirrors in prose (select → evaluateDrift →
 * shouldFireAlert → record). The live LLM+WebSearch run can't be exercised here, so
 * this pins the LOGIC the plugin depends on: baseline → frequency cap → real drift
 * fires → no-drift stays silent → dismissals back off.
 */

const T0 = Date.parse('2026-07-01T00:00:00Z');
const D = 86_400_000;
const at = (ms: number) => new Date(ms).toISOString();

/** Apply a recorded re-check: stamp the confirmed value + time (the `recheck` event). */
function recheck(item: DecisionItem, value: string, now: number): DecisionItem {
  return { ...item, alert: { ...item.alert, last_value: value, last_checked: at(now) } };
}

describe('premise re-check scenario (the /argus:track check path)', () => {
  it('runs the full lifecycle correctly', () => {
    // A load-bearing external premise → defaults to on_change (monitored).
    let item = createItem(
      { decision_id: 'd', type: 'premise', text: '금리가 올해 동결된다', source: 'ai', external: true, load_bearing: true },
      T0,
    );
    expect(item.alert.mode).toBe('on_change');

    // 1) First check: no baseline yet → record baseline, never alert.
    const d1 = evaluateDrift({ last_value: item.alert.last_value, current_value: '기준금리 3.50%' });
    expect(d1.baseline_only).toBe(true);
    expect(shouldFireAlert(item, d1, T0).fire).toBe(false);
    item = recheck(item, '기준금리 3.50%', T0);

    // 2) 3 days later a big move — but within the 7-day frequency cap → no fire.
    const d2 = evaluateDrift({ last_value: item.alert.last_value, current_value: '기준금리 4.50%' });
    expect(d2.drifted).toBe(true);
    expect(shouldFireAlert(item, d2, T0 + 3 * D).fire).toBe(false);

    // 3) 8 days later, same real drift, cap elapsed → FIRES.
    const d3 = evaluateDrift({ last_value: item.alert.last_value, current_value: '기준금리 4.50%' });
    expect(shouldFireAlert(item, d3, T0 + 8 * D).fire).toBe(true);
    item = recheck(item, '기준금리 4.50%', T0 + 8 * D);

    // 4) 16 days later, only a trivial move (<10%) → no drift → silent.
    const d4 = evaluateDrift({ last_value: item.alert.last_value, current_value: '기준금리 4.52%' });
    expect(d4.drifted).toBe(false);
    expect(shouldFireAlert(item, d4, T0 + 16 * D).fire).toBe(false);

    // 5) After two dismissals (adaptive back-off), even a large drift stays quiet.
    item = registerDismissal(registerDismissal(item, T0 + 16 * D), T0 + 17 * D);
    const d5 = evaluateDrift({ last_value: '기준금리 4.50%', current_value: '기준금리 9.00%' });
    expect(shouldFireAlert(item, d5, T0 + 40 * D).fire).toBe(false);
  });

  it('a text premise fires when the fact flips, and only then', () => {
    let item = createItem(
      { decision_id: 'd', type: 'premise', text: '동탄 공급이 많다', source: 'ai', external: true, load_bearing: true },
      T0,
    );
    item = recheck(item, '3년간 공급 과잉', T0);

    const unchanged = evaluateDrift({ last_value: '3년간 공급 과잉', current_value: '  3년간   공급 과잉 ' });
    expect(shouldFireAlert(item, unchanged, T0 + 30 * D).fire).toBe(false);

    const flipped = evaluateDrift({ last_value: '3년간 공급 과잉', current_value: '공급 급감, 물량 부족' });
    expect(shouldFireAlert(item, flipped, T0 + 30 * D).fire).toBe(true);
  });
});
