import { describe, it, expect, afterEach } from 'vitest';
import { tmpArgusDir, body } from '../../test-helpers.js';
import { openDecision } from '../open-decision.js';
import { premises } from '../premises.js';
import { setElicitor } from '../../lib/elicit.js';

/**
 * ai_surfaced 전제의 원탭 확인 (seal 픽커의 미러 — 창업자 확인 구조 2026-07-23).
 *
 * 계약:
 *  - 딱 한 건의 ai_surfaced 초안 + 픽커 가능 호스트 → Accept/Decline 확인 픽커가 뜬다.
 *  - Keep = 기록 승인이지 저작 이전이 아니다 — provenance는 ai_surfaced 그대로
 *    (예측과 의도적으로 다름: 베팅은 사용자의 것이 되어야 하지만 전제는 거울
 *    관찰이고 정직한 태그가 곧 invariant다).
 *  - Reword(폼에 직접 입력) = 그 말 그대로 user_stated로, AI 초안은 ai_original로 보존.
 *  - Skip/거절 = 초안만 버린다. 같은 콜의 user_stated 전제는 그대로 기록.
 *  - 픽커 미지원 호스트 = 기존 그대로 진행 (마찰 탈출구 — 강제 타이핑은 invariant가 아니다).
 */

const TODAY = '2026-07-02';

afterEach(() => setElicitor(null));

async function openWithDecision(id: string) {
  const dir = tmpArgusDir();
  await openDecision.handler({
    argus_dir: dir, id, decision: '요금제 개편을 이번 분기에 강행', stakes: 'high',
    reversibility: 'one_way_door', status_quo: '현행 유지', today_override: TODAY,
  });
  return dir;
}

const aiDraft = { text: 'squeezed free users convert to paid at the assumed rate', kind: 'premise', external: true, load_bearing: true, source: 'ai_surfaced', ai_original: 'squeezed free users convert to paid at the assumed rate' };

describe('premise one-tap confirm (ai_surfaced draft)', () => {
  it('Accept 빈칸: 기록되고 provenance는 ai_surfaced 그대로 (저작 이전 없음)', async () => {
    const dir = await openWithDecision('kp1');
    setElicitor(async () => ({ action: 'accept', content: {} }));
    const r = body(await premises.handler({ argus_dir: dir, id: 'kp1', op: 'add', premises: [{ ...aiDraft }], today_override: TODAY }));
    expect(r['ok']).toBe(true);
    const echo = (r['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>;
    expect(echo[0]['source']).toBe('ai_surfaced');
  });

  it('Accept + reword: 그 말 그대로 user_stated, 초안은 ai_original로 보존', async () => {
    const dir = await openWithDecision('rw1');
    setElicitor(async () => ({ action: 'accept', content: { reword: '무료층 압박 시 유료 전환율이 3%를 넘는다' } }));
    const r = body(await premises.handler({ argus_dir: dir, id: 'rw1', op: 'add', premises: [{ ...aiDraft }], today_override: TODAY }));
    expect(r['ok']).toBe(true);
    const echo = (r['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>;
    expect(echo[0]['text']).toBe('무료층 압박 시 유료 전환율이 3%를 넘는다');
    expect(echo[0]['source']).toBe('user_stated');
    expect(echo[0]['ai_original']).toBe(aiDraft.text);
  });

  it('Accept + 너무 짧은 reword: 아무것도 기록 안 하고 대화로 되묻는 2단계 폴백', async () => {
    const dir = await openWithDecision('rw2');
    setElicitor(async () => ({ action: 'accept', content: { reword: '음' } }));
    const r = body(await premises.handler({ argus_dir: dir, id: 'rw2', op: 'add', premises: [{ ...aiDraft }], today_override: TODAY }));
    expect((r['data'] as Record<string, unknown>)['recorded']).toBe(false);
    expect((r['data'] as Record<string, unknown>)['choice']).toBe('reword');
  });

  it('Decline: 초안만 버리고, 같은 콜의 user_stated 전제는 기록된다', async () => {
    const dir = await openWithDecision('sk1');
    setElicitor(async () => ({ action: 'decline' }));
    const r = body(await premises.handler({
      argus_dir: dir, id: 'sk1', op: 'add', today_override: TODAY,
      premises: [{ ...aiDraft }, { text: '경쟁사는 이 분기에 가격을 못 바꾼다', kind: 'premise', external: true, load_bearing: false, source: 'user_stated' }],
    }));
    expect(r['ok']).toBe(true);
    const echo = (r['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>;
    expect(echo.length).toBe(1);
    expect(echo[0]['source']).toBe('user_stated');
  });

  it('Decline이 유일한 항목이면 "기록 안 함"으로 정직하게 끝난다', async () => {
    const dir = await openWithDecision('sk2');
    setElicitor(async () => ({ action: 'decline' }));
    const r = body(await premises.handler({ argus_dir: dir, id: 'sk2', op: 'add', premises: [{ ...aiDraft }], today_override: TODAY }));
    expect((r['data'] as Record<string, unknown>)['recorded']).toBe(false);
  });

  it('픽커 미지원 호스트: 기존과 동일하게 기록 진행 (마찰 탈출구 보존)', async () => {
    const dir = await openWithDecision('nf1');
    setElicitor(null);
    const r = body(await premises.handler({ argus_dir: dir, id: 'nf1', op: 'add', premises: [{ ...aiDraft }], today_override: TODAY }));
    expect(r['ok']).toBe(true);
    const echo = (r['data'] as Record<string, unknown>)['premises'] as Array<Record<string, unknown>>;
    expect(echo[0]['source']).toBe('ai_surfaced');
  });

  it('ai_surfaced 초안이 둘 이상이면 픽커 없이 기존 흐름 (구조화 플로우는 자기 대화에서 확인)', async () => {
    const dir = await openWithDecision('mp1');
    let fired = 0;
    setElicitor(async () => { fired++; return { action: 'decline' }; });
    const r = body(await premises.handler({
      argus_dir: dir, id: 'mp1', op: 'add', today_override: TODAY,
      premises: [
        { ...aiDraft },
        { text: 'churn from the price change stays under 2%', kind: 'premise', external: true, load_bearing: true, source: 'ai_surfaced', ai_original: 'churn from the price change stays under 2%' },
      ],
    }));
    expect(r['ok']).toBe(true);
    expect(fired).toBe(0);
    expect(((r['data'] as Record<string, unknown>)['premises'] as unknown[]).length).toBe(2);
  });
});
