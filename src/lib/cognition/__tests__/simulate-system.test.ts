import { describe, it, expect } from 'vitest';
import {
  SYSTEM_SCENARIOS,
  buildSystemEpisode,
  checkSystemInvariants,
  runSystemSimulation,
} from '../simulate-system';

const T0 = Date.parse('2026-08-17T00:00:00Z');

describe('시스템 시뮬레이션 — 루프 전체가 도는가', () => {
  const report = runSystemSimulation(T0);

  it('시스템 불변식 위반이 0이다', () => {
    expect(report.violations, JSON.stringify(report.violations, null, 2)).toEqual([]);
  });

  it('다섯 시나리오를 전부 밟는다', () => {
    expect(report.scenarios).toHaveLength(SYSTEM_SCENARIOS.length);
    for (const s of SYSTEM_SCENARIOS) expect(report.stances[s]).toBeTruthy();
  });

  it('세계가 안정하면 전제는 holds 이고 아무 판단도 깨어나지 않는다 (과발화 금지)', () => {
    expect(report.stances.stable_world).toBe('holds');
    expect(report.woken.stable_world).toBe(0);
  });

  it('전제가 무너지면 그것을 참조한 봉인 판단들이 깨어난다', () => {
    expect(report.stances.premise_breaks).toBe('shaken');
    expect(report.woken.premise_breaks).toBeGreaterThan(0);
  });

  it('센서가 실명이면 holds 가 아니라 unread 다 — 조용한 초록이 가장 위험하다', () => {
    expect(report.stances.sensor_blind).toBe('unread');
    expect(report.woken.sensor_blind).toBe(0);
  });

  it('이미 정산된 판단은 깨우지 않는다 — 닫힌 결정을 다시 여는 것은 과발화다', () => {
    // alert_then_settle 은 두 판단 중 하나를 정산했으므로 하나만 깨어나야 한다.
    expect(report.woken.alert_then_settle).toBe(1);
  });

  it('증거가 철회되면 전제는 흔들리지 않은 채로 원소만 프레임 안으로 되돌아온다', () => {
    expect(report.stances.evidence_retracted).toBe('holds');
    expect(report.woken.evidence_retracted).toBe(0);
  });

  it('같은 기준 시각은 같은 보고를 낸다 (결정론)', () => {
    expect(JSON.stringify(runSystemSimulation(T0))).toBe(JSON.stringify(runSystemSimulation(T0)));
  });

  it('M2 는 분모가 0일 때 비율을 내지 않고, 경보가 있으면 센다', () => {
    expect(report.m2.stable_world).toContain('분모가 0');
    expect(report.m2.premise_breaks).toMatch(/봉인 판단 \d+건 중/);
  });

  it('M3 는 정산 전이면 0으로 적지 않고, 정산 후면 지연을 낸다', () => {
    expect(report.m3.premise_breaks).toContain('0으로 적지 않습니다');
    expect(report.m3.alert_then_settle).toContain('중위 지연');
  });

  it('M5 는 양쪽 표본이 찰 때만 숫자를 낸다', () => {
    expect(report.m5.stable_world).toContain('아직 모릅니다');
    expect(report.m5.alert_then_settle).toContain('귀속됐습니다');
  });

  it('시나리오별로 개별 검사도 위반 0이다 (집계에 가려지지 않게)', () => {
    for (const s of SYSTEM_SCENARIOS) {
      const v = checkSystemInvariants(buildSystemEpisode(s, T0));
      expect(v, `${s}: ${JSON.stringify(v)}`).toEqual([]);
    }
  });
});
