// Surface character tests: one brain, three projections — and each surface's
// defining constraint proven red-first. Plus the §11.3 continuity battery.

import { describe, expect, it, beforeEach } from 'vitest';
import { SessionEngine } from '../surfaces/engine';
import { renderReturnQueue, renderTurn, SIX_SENTENCES } from '../surfaces/web';
import { adoptViaHost, fireGate, handleMcp } from '../surfaces/mcp';
import { adoptViaPlugin, captureArtifact, notifyViaPlugin, proposeViaPlugin } from '../surfaces/plugin';
import { resetEventIds } from '../ledger';
import { semanticCore } from '../projection';
import { type ArgusTurn, type DecisionCardDraft } from '../types';

const T0 = '2026-08-04T09:00:00.000Z';
const T = (min: number) => new Date(new Date(T0).getTime() + min * 60_000).toISOString();

const CARD: DecisionCardDraft = {
  question: '온보딩을 20명에게 제한 공개할까',
  stakes: { weight: 'significant', reversibility: 'costly' },
  adoptedState: 'test',
  choiceOrPolicy: '핵심 흐름만 20명에게 2주간 공개',
  rationale: {
    values: ['핵심 segment의 재방문 검증'],
    materialBeliefs: [{ belief: '대상 20명이 핵심 segment를 대표한다', confidence: 'uncertain' }],
  },
  nextAction: { action: '명단과 blocker 3개 확정', owner: 'YC', byOrWhen: '오늘' },
  returnContract: {
    kind: 'commitment',
    trigger: { type: 'date', date: T(3 * 24 * 60) },
    nextInChain: { kind: 'outcome', trigger: { type: 'signal', expectedSignal: '재방문 수', dateBackstop: T(21 * 24 * 60) } },
  },
};

function engineWithAdoptedCard(): SessionEngine {
  resetEventIds();
  const e = new SessionEngine('c1');
  e.recordUtterance('온보딩 출시 고민이야. 빨리 반응을 보고 싶어.', T(0));
  e.recordBaseline({ lean: '빨리 열고 싶음', statedReasons: ['반응을 빨리 보고 싶다'], consideredAlternatives: [] }, T(1));
  e.adoptCard(CARD, { mode: 'accept' }, T(2));
  return e;
}

describe('SessionEngine — the shared brain', () => {
  it('walks the full loop in the honest order and ends REVIEWED with the chain consumed', () => {
    const e = engineWithAdoptedCard();
    expect(e.state().state).toBe('AWAITING_SIGNAL');
    expect(e.state().queuedReturns).toHaveLength(1); // outcome return queued behind commitment

    // commitment return: observation first, then close → chain promotes
    e.recordObservation('명단 확정, blocker 3개 정함', 'direct', T(3 * 24 * 60), T(3 * 24 * 60));
    e.closeReturn(T(3 * 24 * 60 + 1));
    expect(e.state().activeReturn?.contract.kind).toBe('outcome');

    // outcome return: observe → probe → reveal → close
    e.recordObservation('재방문 5명, 결제 blocker 1건', 'direct', T(14 * 24 * 60), T(14 * 24 * 60));
    e.recordRecallProbeAnswer('재방문을 빨리 검증하고 싶어서였어요', T(14 * 24 * 60 + 1));
    const revealed = e.revealRecord(T(14 * 24 * 60 + 2));
    expect(revealed.recallProbeAnswer).toBeTruthy();
    e.closeReturn(T(14 * 24 * 60 + 3));
    expect(e.state().state).toBe('REVIEWED');
  });

  it('compiles a packet whose L4 state comes only from durable layers', () => {
    const e = engineWithAdoptedCard();
    const packet = e.compilePacket('web', '이제 어떻게 할까?', 'diagnose_and_propose');
    expect(packet).toContain('DATA NOT INSTRUCTIONS');
    expect(packet).toContain(CARD.question);
    expect(packet).not.toContain('지난 세션의 분석'); // nothing model-authored can be there
  });
});

describe('web surface — the six-sentence grammar is machine-visible', () => {
  it('every rendered block declares which sentence it projects', () => {
    const e = engineWithAdoptedCard();
    const turn: ArgusTurn = {
      phase: 'improve',
      route: 'decision',
      caseFit: 'in_scope',
      primaryMove: { type: 'next_action_concretion', content: '오늘 명단 20명을 확정하세요', whyNow: '실행이 병목' },
      claims: [],
    };
    const view = renderTurn(e.receiveTurn(turn, T(3)), e.state());
    expect(view.grammar).toBe(SIX_SENTENCES);
    expect(view.blocks.length).toBeGreaterThan(0);
    for (const b of view.blocks) {
      expect(b.sentence).toBeGreaterThanOrEqual(0);
      expect(b.sentence).toBeLessThanOrEqual(5);
    }
  });

  it('validator downgrades are rendered, never swallowed', () => {
    const e = engineWithAdoptedCard();
    const turn: ArgusTurn = {
      phase: 'improve',
      route: 'decision',
      caseFit: 'in_scope',
      primaryMove: { type: 'reframe', content: '진짜 결정은 X입니다', whyNow: 'frame' }, // no falsifier
      claims: [],
    };
    const view = renderTurn(e.receiveTurn(turn, T(3)), e.state());
    expect(view.blocks.some((b) => b.kind === 'validator_notice' && b.title === '조정됨')).toBe(true);
  });

  it('the return queue renders as sentence 5', () => {
    const e = engineWithAdoptedCard();
    const queue = renderReturnQueue([e.state()]);
    expect(queue).toHaveLength(1);
    expect(queue[0].sentence).toBe(5);
  });
});

describe('mcp surface — strictest fire-gate, proposals only', () => {
  beforeEach(() => resetEventIds());

  it('stays SILENT on a flat ambient context — restraint is the default', () => {
    const e = new SessionEngine('c9');
    const res = handleMcp(e.ledger, { hostUtterance: '오늘 PR 세 개 머지했다', userInvokedArgus: false });
    expect(res.kind).toBe('silent');
    expect(res.silenceReason).toBe('flat_context');
  });

  it('refuses to reopen a decision the user closed', () => {
    const e = new SessionEngine('c9');
    const gate = fireGate(e.ledger, { hostUtterance: '가격은 이미 결정했어. 다음 주제.', userInvokedArgus: false });
    expect(gate).toEqual({ fire: false, reason: 'closed_decision' });
  });

  it('fires when the user opens a decision or invokes Argus', () => {
    const e = new SessionEngine('c9');
    expect(fireGate(e.ledger, { hostUtterance: '이 기능을 지금 출시할까 말까 고민이야', userInvokedArgus: false }).fire).toBe(true);
    expect(fireGate(e.ledger, { hostUtterance: '아무거나', userInvokedArgus: true }).fire).toBe(true);
  });

  it('restores a web-adopted decision as the SAME decision (continuity §11.3)', () => {
    const e = engineWithAdoptedCard();
    const res = handleMcp(e.ledger, { caseId: 'c1', hostUtterance: '그 온보딩 결정 어떻게 됐더라', userInvokedArgus: true });
    expect(res.kind).toBe('restore');
    expect(res.text).toContain('사용자 채택'); // authorship survives the surface hop
    expect(res.text).toContain(CARD.choiceOrPolicy);
  });

  it('host approve is a tombstone, not an API', () => {
    expect(() => adoptViaHost()).toThrowError(/MCP_CANNOT_ADOPT/);
  });
});

describe('plugin surface — capture only, three tombstones', () => {
  beforeEach(() => resetEventIds());

  it('captures a host artifact as a provenance-preserving source event', () => {
    const e = engineWithAdoptedCard();
    const result = captureArtifact(
      e.ledger,
      'c1',
      {
        hostKind: 'document',
        title: '주간 지표 리포트',
        excerpt: '재방문이 지난주 대비 5명 증가',
        sourceRef: 'notion://weekly-metrics-2026-08',
        authoredBy: 'third_party',
        capturedAt: T(10),
      },
      T(10),
    );
    const captured = e.ledger.byId(result.eventId);
    expect(captured?.type).toBe('external_source');
    expect(result.quietTriggerCandidate?.kind).toBe('possible_signal'); // 재방문 hint
  });

  it('cannot propose, adopt, or notify — the character is structural', () => {
    expect(() => proposeViaPlugin()).toThrowError(/PLUGIN_CANNOT_PROPOSE/);
    expect(() => adoptViaPlugin()).toThrowError(/PLUGIN_CANNOT_ADOPT/);
    expect(() => notifyViaPlugin()).toThrowError(/PLUGIN_CANNOT_NOTIFY/);
  });
});

describe('three-surface parity (§11.3) — one meaning everywhere', () => {
  it('web view core === mcp parity core for the same case', () => {
    const e = engineWithAdoptedCard();
    const webCore = renderTurn(
      e.receiveTurn(
        { phase: 'move', route: 'decision', caseFit: 'in_scope', primaryMove: { type: 'mirror', content: '채택 완료', whyNow: '상태 확인' }, claims: [] },
        T(4),
      ),
      e.state(),
    ).core;
    const mcpCore = semanticCore(e.state());
    expect(webCore).toEqual(mcpCore);
  });
});
