import { describe, it, expect, beforeEach } from 'vitest';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { premises } from '../premises.js';
import { seal } from '../seal.js';
import { recall } from '../recall.js';
import { setElicitor } from '../../lib/elicit.js';

/**
 * chat_confirmed — 재시도 계약의 빠져 있던 반쪽 (2026-07-30 실측에서).
 *
 * 실측: 헤드리스 Claude Code 는 elicitation 능력을 선언하고서 모든 확인창을
 * ~0ms 에 cancel 로 닫는다. no_answer 응답의 retry_hint 는 "대화로 확인받고
 * 다시 불러라"인데, 다시 부르면 같은 창이 또 떠서 또 cancel — AI 초안 전제를
 * 영영 기록할 수 없는 무한 루프였다. 이 막다른 길은 모델에게 초안을
 * user_stated 로 바꿔치기하는 출처 위조를 유도한다 — 이 표면이 막으려는 바로
 * 그 거짓말이다.
 *
 * 빨간불 조건:
 *   · chat_confirmed:true 인데 확인창이 또 뜨는 것 (이중 질문)
 *   · chat_confirmed 없이 기계-즉답 호스트에서 기록되는 것 (승인 없는 기록)
 *   · 기록된 전제의 출처가 ai_surfaced 가 아닌 것 (표기 세탁)
 */

const TODAY = '2026-07-30';
const DRAFT = '다음 분기 매출이 지금 수준을 유지한다.';

function machineCancelHost(log: { fired: number }): void {
  // 사람이 읽을 수 없는 속도로 모든 확인창을 닫는 호스트 (실측 재현).
  setElicitor(async () => { log.fired += 1; return { action: 'cancel' }; }, () => true);
}

async function sealedDecision(dir: string, id = 'd1'): Promise<void> {
  await seal.handler({
    argus_dir: dir, id, predicate: 'the launch ships this week without rollback',
    check_by: '2026-08-30', predicate_owner: 'user', today_override: TODAY,
  });
}

beforeEach(() => { setElicitor(null); });

describe('chat_confirmed — 대화에서 이미 승인된 초안', () => {
  it('확인창을 건너뛰고 기록하며, 출처는 ai_surfaced 그대로다', async () => {
    const dir = tmpArgusDir();
    const log = { fired: 0 };
    machineCancelHost(log);
    await sealedDecision(dir);

    const r = await premises.handler({
      argus_dir: dir, id: 'd1', op: 'add', today_override: TODAY,
      premises: [{ text: DRAFT, kind: 'premise', source: 'ai_surfaced', ai_original: DRAFT, chat_confirmed: true, external: true, load_bearing: true }],
    });
    expect(String(body(r)['surface'])).not.toContain('기록하지 않았');
    // 이미 받은 승인을 두 번 묻지 않는다 — 창이 아예 안 떠야 한다.
    expect(log.fired).toBe(0);

    const rows = (body(await recall.handler({ argus_dir: dir, view: 'premises', id: 'd1', today_override: TODAY }))['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    // 표기 세탁 금지 — 사용자가 고치지 않았으니 edited_by_user 가 아니다
    // (recall 은 false 를 생략하므로 true 부정으로 잰다).
    expect(rows[0]['edited_by_user']).not.toBe(true);
  });

  it('chat_confirmed 없으면 기계-즉답 호스트에서는 기록되지 않는다 (승인 없는 기록 금지)', async () => {
    const dir = tmpArgusDir();
    const log = { fired: 0 };
    machineCancelHost(log);
    await sealedDecision(dir);

    const r = await premises.handler({
      argus_dir: dir, id: 'd1', op: 'add', today_override: TODAY,
      premises: [{ text: DRAFT, kind: 'premise', source: 'ai_surfaced', ai_original: DRAFT }],
    });
    expect(log.fired).toBe(1);
    const data = body(r)['data'] as Record<string, unknown>;
    expect(data['premise_draft']).toBe(DRAFT); // 초안은 버리지 않는다
    // 재시도 지침이 이제 실행 가능해야 한다 — 없으면 같은 창이 또 뜨는 루프다.
    expect(String(data['retry_hint'])).toContain('chat_confirmed:true');

    const rows = (body(await recall.handler({ argus_dir: dir, view: 'premises', id: 'd1', today_override: TODAY }))['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>> | undefined;
    expect(rows ?? []).toHaveLength(0);
  });

  it('확인창이 살아 있는 호스트에서는 chat_confirmed 없이도 Accept 한 번으로 기록된다 (기존 계약 유지)', async () => {
    const dir = tmpArgusDir();
    let fired = 0;
    setElicitor(async () => { fired += 1; return { action: 'accept', content: {} }; }, () => true);
    await sealedDecision(dir);

    await premises.handler({
      argus_dir: dir, id: 'd1', op: 'add', today_override: TODAY,
      premises: [{ text: DRAFT, kind: 'premise', source: 'ai_surfaced', ai_original: DRAFT }],
    });
    expect(fired).toBe(1);
    const rows = (body(await recall.handler({ argus_dir: dir, view: 'premises', id: 'd1', today_override: TODAY }))['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
  });
});
