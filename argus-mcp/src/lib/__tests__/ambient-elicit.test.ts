/**
 * Out-of-band ambient elicitation — 발사 게이트 계약 (창업자 컨셉 2026-07-15).
 *
 * 여기서 고정하는 것 — 발사 판단이 형태보다 먼저다 (스파인 미러 조항):
 *  ① due 0건 = 발사 없음 (빈 질문은 표현 불가)
 *  ② 호스트가 elicitation 미선언 = 발사 없음
 *  ③ due>0 + 조용해짐 = 정확히 한 번 발사, 사용자의 예측을 그대로 되비춤,
 *     답(outcome + what_happened)은 실제 settle 경로로 원장에 기록
 *  ④ 거절 = 답이다: 아무것도 안 쓰고, 프로세스 예산 소진 (재질문 없음)
 *  ⑤ 디바운스: 연속 호출은 타이머를 리셋 — 대화 중에는 발사하지 않는다
 *  ⑥ argus_check_in 호출 = 예산 소진 (방금 due를 본 사용자에게 조르지 않는다)
 *  ⑦ ambient_mute: true = 침묵 (due-note와 같은 하나의 뮤트)
 *  ⑧ 4시간 쿨다운 (상태 파일) = 침묵
 *  ⑨ 종결 outcome인데 what_happened 거절 = 기록하지 않는다 (날조 금지)
 *  ⑩ still_pending은 settle 핸들러의 defer 물음이 같은 채널로 이어진다
 *  ⑪ 미배선(initAmbientElicit 안 됨) = 완전 no-op
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { tmpArgusDir } from '../../test-helpers.js';
import { seal } from '../../tools/seal.js';
import { settle } from '../../tools/settle.js';
import { setElicitor, type ElicitResult } from '../elicit.js';
import { initAmbientElicit, armAmbientElicit, resetAmbientElicit } from '../ambient-elicit.js';
import { replayLedger } from '../ledger-replay.js';

const PREDICATE = '이번 분기 이탈률이 3% 아래로 유지된다';
const TODAY_DUE = '2026-09-02'; // check_by 다음날 — due 상태

let dir: string;

beforeEach(() => {
  dir = tmpArgusDir();
  process.env['ARGUS_AMBIENT_DELAY_MS'] = '0';
  resetAmbientElicit();
});
afterEach(() => {
  resetAmbientElicit();
  setElicitor(null);
  delete process.env['ARGUS_AMBIENT_DELAY_MS'];
});

async function sealedDue(id = 'amb-1'): Promise<void> {
  await seal.handler({
    argus_dir: dir, id, predicate: PREDICATE,
    check_by: '2026-09-01', predicate_owner: 'user', today_override: '2026-07-01',
  });
}

/** 스크립트된 elicitor: 물음마다 순서대로 응답하고, 본 물음을 기록한다. */
function scriptElicitor(responses: Array<ElicitResult | ((msg: string) => ElicitResult)>): { seen: string[] } {
  const seen: string[] = [];
  setElicitor(async (message) => {
    seen.push(message);
    const next = responses[Math.min(seen.length - 1, responses.length - 1)];
    return typeof next === 'function' ? next(message) : (next ?? { action: 'decline' });
  }, () => true);
  return { seen };
}

function wire(): void {
  initAmbientElicit({ settleHandler: (a) => settle.handler(a) });
}

const settleFlush = (ms = 40) => new Promise((r) => setTimeout(r, ms));

function arm(toolName = 'argus_predict'): void {
  armAmbientElicit(toolName, { argus_dir: dir, today_override: TODAY_DUE });
}

describe('out-of-band ambient elicit — 발사 게이트', () => {
  it('① due 0건 = 발사 없음', async () => {
    const { seen } = scriptElicitor([{ action: 'accept', content: { outcome: 'held' } }]);
    wire();
    armAmbientElicit('argus_predict', { argus_dir: dir, today_override: '2026-07-01' });
    await settleFlush();
    expect(seen).toEqual([]);
  });

  it('② elicitation 미선언 호스트 = 발사 없음', async () => {
    await sealedDue();
    const seen: string[] = [];
    setElicitor(async (m) => { seen.push(m); return { action: 'accept', content: { outcome: 'held' } }; }, () => false);
    wire();
    arm();
    await settleFlush();
    expect(seen).toEqual([]);
  });

  it('③ due + 조용해짐 = 한 번 발사, 예측 되비춤, 실제 settle 기록', async () => {
    await sealedDue();
    const { seen } = scriptElicitor([
      { action: 'accept', content: { outcome: 'held' } },
      { action: 'accept', content: { what_happened: '두 달 연속 2.8%로 유지됨' } },
    ]);
    wire();
    arm();
    await settleFlush(80);
    expect(seen.length).toBe(2);
    expect(seen[0]).toContain(PREDICATE); // 우정 1조 — 네가 한 말을 그대로
    expect(seen[0]).toContain('2026-09-01');
    const state = replayLedger(dir, TODAY_DUE);
    expect(state.contracts.get('amb-1')?.status).toBe('settled');
    expect(state.overdue.length).toBe(0);
    // 상태 파일이 남아 다음 발사의 쿨다운 근거가 된다
    expect(fs.existsSync(path.join(dir, 'ambient-elicit-state.json'))).toBe(true);
  });

  it('④ 거절 = 아무것도 안 쓰고 예산 소진 (재질문 없음)', async () => {
    await sealedDue();
    const { seen } = scriptElicitor([{ action: 'decline' }]);
    wire();
    arm();
    await settleFlush();
    expect(seen.length).toBe(1);
    expect(replayLedger(dir, TODAY_DUE).contracts.get('amb-1')?.status).toBe('sealed'); // 미기록
    arm(); // 같은 프로세스 재무장 시도
    await settleFlush();
    expect(seen.length).toBe(1); // 예산 소진 — 재질문 없음
  });

  it('⑤ 디바운스 — 연속 호출은 타이머를 리셋하고, 발사는 결국 한 번', async () => {
    await sealedDue();
    const { seen } = scriptElicitor([
      { action: 'accept', content: { outcome: 'held' } },
      { action: 'accept', content: { what_happened: '유지됨' } },
    ]);
    wire();
    arm(); arm(); arm(); // 대화가 이어지는 동안은 리셋
    await settleFlush(80);
    expect(seen.filter((m) => m.includes(PREDICATE)).length).toBe(1);
  });

  it('⑥ argus_check_in 호출 = 예산 소진', async () => {
    await sealedDue();
    const { seen } = scriptElicitor([{ action: 'accept', content: { outcome: 'held' } }]);
    wire();
    arm('argus_check_in');
    arm(); // 이후의 다른 호출도
    await settleFlush();
    expect(seen).toEqual([]);
  });

  it('⑦ ambient_mute: true = 침묵 (due-note와 같은 하나의 뮤트)', async () => {
    await sealedDue();
    fs.writeFileSync(path.join(dir, 'config.yaml'), 'ambient_mute: true\n');
    const { seen } = scriptElicitor([{ action: 'accept', content: { outcome: 'held' } }]);
    wire();
    arm();
    await settleFlush();
    expect(seen).toEqual([]);
  });

  it('⑧ 4시간 쿨다운 상태 파일 = 침묵 / 지나면 발사', async () => {
    await sealedDue();
    fs.writeFileSync(path.join(dir, 'ambient-elicit-state.json'), JSON.stringify({ last_fired_at: Date.now() - 60_000 }));
    const { seen } = scriptElicitor([
      { action: 'accept', content: { outcome: 'held' } },
      { action: 'accept', content: { what_happened: '유지됨' } },
    ]);
    wire();
    arm();
    await settleFlush();
    expect(seen).toEqual([]); // 1분 전 발사 이력 — 침묵

    resetAmbientElicit(); // 새 프로세스 시뮬레이션
    scriptElicitor([
      { action: 'accept', content: { outcome: 'held' } },
      { action: 'accept', content: { what_happened: '유지됨' } },
    ]);
    fs.writeFileSync(path.join(dir, 'ambient-elicit-state.json'), JSON.stringify({ last_fired_at: Date.now() - 5 * 3600_000 }));
    wire();
    arm();
    await settleFlush(80);
    expect(replayLedger(dir, TODAY_DUE).contracts.get('amb-1')?.status).toBe('settled');
  });

  it('⑨ 종결 outcome인데 what_happened 거절 = 기록하지 않는다 (날조 금지)', async () => {
    await sealedDue();
    const { seen } = scriptElicitor([
      { action: 'accept', content: { outcome: 'missed' } },
      { action: 'decline' },
    ]);
    wire();
    arm();
    await settleFlush(80);
    expect(seen.length).toBe(2);
    expect(replayLedger(dir, TODAY_DUE).contracts.get('amb-1')?.status).toBe('sealed'); // 정직한 공백
  });

  it('⑩ still_pending → settle 핸들러의 defer 물음이 같은 채널로 이어진다', async () => {
    await sealedDue();
    const { seen } = scriptElicitor([
      { action: 'accept', content: { outcome: 'still_pending' } },
      (msg) => /다시 볼까요|look again/i.test(msg)
        ? { action: 'accept', content: { when: 'month' } }
        : { action: 'decline' },
    ]);
    wire();
    arm();
    await settleFlush(80);
    expect(seen.length).toBe(2);
    const entry = replayLedger(dir, '2026-09-03').contracts.get('amb-1');
    expect(entry?.status).toBe('sealed'); // 여전히 살아있고
    expect(entry?.check_by).toBe('2026-10-02'); // 확인일이 한 달 뒤로 재무장됨
  });

  it('⑪ 미배선 = 완전 no-op', async () => {
    await sealedDue();
    const { seen } = scriptElicitor([{ action: 'accept', content: { outcome: 'held' } }]);
    // wire() 없음
    arm();
    await settleFlush();
    expect(seen).toEqual([]);
  });
});
