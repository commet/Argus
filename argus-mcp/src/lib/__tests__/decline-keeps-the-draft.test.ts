import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setElicitor } from '../elicit.js';
import { seal } from '../../tools/seal.js';

/**
 * A DECLINE MAY END THE ASK. IT MAY NOT DELETE THE USER'S SENTENCE.
 *
 * This is what was left standing after the latency argument was dropped, and it
 * is the part that never depended on it.
 *
 * The question "did the person decline, or did their host decline for them?"
 * cannot be answered from inside an MCP server: the protocol carries an action
 * and no render receipt, and response time is a machine-dependent proxy, not
 * provenance — a threshold calibrated on an idle laptop measurably broke on a
 * loaded CI runner. That argument was had three times and it is settled: the
 * wire action is preserved exactly as MCP defines it.
 *
 * But the INJURY was never the label. It was this response:
 *
 *     surface: "기록하지 않았습니다."   next_actions: ["stop"]
 *     data:    { sealed: false, choice: "declined" }
 *
 * The prediction the user had just written was not in it. When a Codex approval
 * policy answers `decline` on its own — drawing nothing, so the user sees no
 * dialog at all — their sentence was simply gone, and neither they nor the
 * assistant could get it back.
 *
 * There is no reading of that response under which discarding the draft is
 * correct. If the person declined, they may still want to reword it. If their
 * host declined, they never even saw it. Either way the words are theirs.
 *
 * So: silence is kept (terse surface, `stop`, never a second picker — pushing
 * after a "no" is the over-fire violation), and the draft rides along.
 *
 * 무엇이 이걸 빨간불로 만드나: 거절 분기의 data에서 predicate/check_by를 빼면,
 * 또는 거절 뒤에 픽커를 다시 띄우면 빨개진다.
 */

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-decline-draft-')); });
afterEach(() => { setElicitor(null); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } });

/** A host that declines every ask — a real user saying no, or a policy saying it
 *  for them. The server cannot tell, and this test does not ask it to. */
function declineEverything(): { asks: () => number } {
  let asks = 0;
  setElicitor(async () => { asks += 1; return { action: 'decline' }; }, () => true);
  return { asks: () => asks };
}

const PREDICATE = '이 기능을 다음 주 금요일까지 출시한다';
const CHECK_BY = '2099-12-31';

async function sealDeclined() {
  const res = await seal.handler({
    argus_dir: dir, id: 'draft-1', predicate: PREDICATE, check_by: CHECK_BY,
    predicate_owner: 'ai_surfaced', confirm_draft: true, locale: 'ko',
  } as Record<string, unknown>);
  return (res as { structuredContent?: { data?: Record<string, unknown>; surface?: string; next_actions?: string[] } }).structuredContent ?? {};
}

describe('거절해도 사용자가 쓴 문장은 남는다', () => {
  it('① 거절 응답이 사용자의 술어를 그대로 담고 있다', async () => {
    declineEverything();
    const out = await sealDeclined();
    // 한 글자도 바뀌지 않은 채로
    expect(out.data?.['predicate']).toBe(PREDICATE);
    expect(out.data?.['check_by']).toBe(CHECK_BY);
  });

  it('② 그래도 기록은 되지 않았고, 거절은 거절로 남는다', async () => {
    declineEverything();
    const out = await sealDeclined();
    expect(out.data?.['sealed']).toBe(false);
    // 프로토콜 행위는 그대로 보존한다 — 시간으로 뒤집지 않는다.
    expect(out.data?.['choice']).toBe('declined');
  });

  it('③ 거절 뒤에 픽커를 다시 띄우지 않는다 (밀어붙이지 않는다)', async () => {
    const h = declineEverything();
    await sealDeclined();
    expect(h.asks()).toBe(1);
  });

  it('④ 화면 문구는 짧게 유지된다 — 되찾는 길은 data로만 준다', async () => {
    declineEverything();
    const out = await sealDeclined();
    expect(out.surface).toBe('기록하지 않았습니다.');
    expect(out.next_actions).toEqual(['stop']);
    // 사람에게 조르지 않되, 어시스턴트는 되살릴 방법을 안다.
    expect(String(out.data?.['retry_hint'] ?? '')).toContain('argus_predict');
  });
});
