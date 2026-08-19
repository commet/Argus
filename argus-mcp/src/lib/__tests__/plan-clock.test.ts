import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
// @ts-expect-error — 계측기 모듈은 .mjs 이고 타입 선언이 없다. 여기서 재는 것은
// 타입이 아니라 동작이다 (model-channel.mjs 와 같은 지위).
import { collectPlanDues, earliestPlanDue } from '../../../evals/plan-clock.mjs';

/**
 * 여정 하네스의 시계 (계측기 결함 6호, 2026-08-18).
 *
 * 이 테스트가 존재하는 이유가 결함 자체의 교훈이다: 이 계산이 하네스 안에
 * 인라인이면 **API 키가 있는 환경에서 라이브 여정을 돌릴 때만 실행된다.**
 * 그러면 시계가 틀렸을 때 나오는 빨간불을 제품 결함으로 오독하게 되고,
 * 그것이 정확히 이 시계가 고치려는 병이다. 모델 없이 재는 것이 요점이다.
 */

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-clock-')); });
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const write = (rel: string, lines: unknown[]) => {
  const fp = path.join(dir, rel);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n'));
};

describe('여정 시계 — 어느 날짜로 가는가', () => {
  it('채택된 계획의 가장 이른 확인일을 고른다 (그 단계는 언제나 예약된다)', () => {
    write('ledger/ledger.jsonl', [
      { id: 'd1', event: 'seal', ts: '2026-08-01T12:00:00.000Z' },
      { id: 'd1', event: 'plan_adopt', steps: [
        { what: '비교표를 만든다', due: '2026-08-25' },
        { what: '로그를 센다', due: '2026-08-19' },
        { what: '옮겨 본다', due: '2026-09-05' },
      ] },
    ]);
    expect(earliestPlanDue(dir)).toBe('2026-08-19');
    expect(collectPlanDues(dir)).toHaveLength(3);
  });

  it('여러 결정의 계획을 가로질러 가장 이른 것을 고른다', () => {
    write('ledger/ledger.jsonl', [
      { id: 'a', event: 'plan_adopt', steps: [{ what: 'A', due: '2026-09-01' }] },
      { id: 'b', event: 'plan_adopt', steps: [{ what: 'B', due: '2026-08-20' }] },
    ]);
    expect(earliestPlanDue(dir)).toBe('2026-08-20');
  });

  it('날짜 없는 채택에는 시계를 옮기지 않는다 (null)', () => {
    write('ledger/ledger.jsonl', [
      { id: 'd1', event: 'plan_adopt', steps: [{ what: '언젠가 한다' }] },
    ]);
    expect(earliestPlanDue(dir)).toBeNull();
  });

  it('계획이 아예 없으면 null', () => {
    write('ledger/ledger.jsonl', [{ id: 'd1', event: 'seal' }]);
    expect(earliestPlanDue(dir)).toBeNull();
  });

  it('원장이 없어도 던지지 않는다 — 시계가 여정을 죽이면 안 된다', () => {
    expect(earliestPlanDue(path.join(dir, '없는폴더'))).toBeNull();
  });

  it('파싱 불가 줄과 모양이 틀린 due 는 증거로 쓰지 않는다', () => {
    write('ledger/ledger.jsonl', [
      '{ 이건 JSON 이 아니다',
      { id: 'd1', event: 'plan_adopt', steps: [
        { what: '모양 틀림', due: '내일' },
        { what: '숫자', due: 20260819 },
        { what: '정상', due: '2026-08-30' },
      ] },
    ]);
    expect(earliestPlanDue(dir)).toBe('2026-08-30');
  });

  it('중첩 폴더의 원장도 찾는다 (v2 거울처럼 하위에 쓰이는 경우)', () => {
    write('ledger/ledger.jsonl', [{ id: 'a', event: 'seal' }]);
    write('nested/deep/other.jsonl', [
      { id: 'b', event: 'plan_adopt', steps: [{ what: 'B', due: '2026-08-21' }] },
    ]);
    expect(earliestPlanDue(dir)).toBe('2026-08-21');
  });

  it('.jsonl 이 아닌 파일은 읽지 않는다', () => {
    write('notes.txt', [{ id: 'x', event: 'plan_adopt', steps: [{ what: 'X', due: '2026-01-01' }] }]);
    expect(earliestPlanDue(dir)).toBeNull();
  });
});
