/**
 * P3-1 — 졸업한 캡처 게이트의 src 쪽 수용 기준.
 *
 * 판정 품질(over-fire 0, floor 재현율, 형식 일치)은 spikes/p0/
 * routing-eval.test.ts가 같은 detect 함수로 계속 잰다 (재수출 = 측정본과
 * 배송본이 같은 함수). 여기서 고정하는 것은 그 하네스가 못 보는 부분:
 *  ① 측정본=배송본 동일성 자체 (재수출이 끊기면 여기가 빨간불)
 *  ② runGate의 호출률 계측 — fired/silent 양쪽 모두 gate_result가 원장에
 *     남는다 (분모 없는 호출률은 측정이 아니다)
 *  ③ reason 위생 — 발화 원문이 원장에 새지 않는다 (매치된 패턴 문자열만)
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerRepository, readLedger } from './ledger.js';
import { contextFor, type V2Context } from './bridge.js';
import { detect as srcDetect, GATE_NAME, runGate, userUtterances } from './gate.js';
import { detect as spikeDetect } from '../../spikes/p0/routing-skeleton.js';

let home: string;
let repoDir: string;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-gate-home-'));
  repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-gate-repo-'));
  fs.mkdirSync(path.join(repoDir, '.git'), { recursive: true });
  registerRepository(home, path.join(repoDir, '.git'));
});
afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
});

function ctx(): V2Context {
  return contextFor({
    home, gitCommonDir: path.join(repoDir, '.git'),
    workspaceArgusDir: path.join(repoDir, '.argus'),
    sessionId: 's-gate', producerVersion: '2.0.0-p3', today: '2026-07-11',
  });
}

describe('졸업 계약 — 측정본 = 배송본', () => {
  it('스파이크 재수출과 src detect는 같은 함수 객체다', () => {
    // 재수출이 사본·재구현으로 바뀌는 순간 여기가 죽는다 — eval 하네스가
    // 재는 것과 서버가 배송하는 것이 갈라질 구조적 가능성의 봉쇄.
    expect(spikeDetect).toBe(srcDetect);
  });
});

describe('runGate — 호출률 계측 (Matrix Capture 행)', () => {
  it('fired와 silent 양쪽 모두 gate_result로 원장에 남는다 (분모 포함)', () => {
    const c = ctx();
    const fired = runGate(c, '세션 저장은 postgres로 가기로 했다.');
    const silent = runGate(c, '오늘 날씨가 좋네요.');
    expect(fired.fire).toBe(true);
    expect(silent.fire).toBe(false);

    const events = readLedger(home, c.repository_id).events
      .filter((e) => e['event'] === 'gate_result') as Array<Record<string, unknown>>;
    expect(events).toHaveLength(2);
    expect(events.every((e) => e['gate'] === GATE_NAME)).toBe(true);
    expect(events.map((e) => e['fired'])).toEqual([true, false]);
  });

  it('reason에 발화 원문이 새지 않는다 — 패턴/가드 이름만 (규칙 19 위생)', () => {
    const c = ctx();
    runGate(c, '비밀 프로젝트 SECRET-X는 postgres로 가기로 했다.');
    runGate(c, 'SECRET-Y를 살까 말까?');
    runGate(c, 'SECRET-Z 그냥 일상 잡담.');
    const reasons = readLedger(home, c.repository_id).events
      .filter((e) => e['event'] === 'gate_result')
      .map((e) => String((e as Record<string, unknown>)['reason']));
    expect(reasons.join(' ')).not.toContain('SECRET');
    expect(reasons[0]).toMatch(/^declarative:/);
    expect(reasons[1]).toBe('question');
    expect(reasons[2]).toBe('no_anchor');
  });
});

describe('userUtterances — transcript 리더 (호스트 데이터, crash 금지 계약)', () => {
  it('user 발화만 뽑고 파손·미지 줄은 조용히 건너뛴다', () => {
    const p = path.join(repoDir, 't.jsonl');
    fs.writeFileSync(p, [
      JSON.stringify({ type: 'user', message: { role: 'user', content: '발화 1' } }),
      '{broken',
      JSON.stringify({ type: 'unknown-future-line', message: { role: 'user', content: 'X' } }),
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [] } }),
      JSON.stringify({ type: 'user', message: { role: 'user', content: '발화 2' } }),
    ].join('\n') + '\n');
    expect(userUtterances(p)).toEqual(['발화 1', '발화 2']);
  });
});
