'use client';

// ARGUS METHOD v1.0 — R3-B pilot channel (BLUEPRINT §9.12 단일 예외).
// 초대 전용·비공개·폐기 전제. 이 페이지는 method-harness를 읽기 전용으로
// 사용하는 유일한 src/ 지점이다 (isolation guard의 명시적 예외).
//
// 이 페이지가 하는 일: 여섯 문장 문법(§2.1)을 그대로 화면 뼈대로 삼아
// 한 결정을 UNDERSTAND → IMPROVE → MOVE → RETURN까지 완주시킨다.
// LLM 호출은 이 페이지에 없다 — 컴파일된 packet을 아무 모델에나 주고
// envelope JSON을 붙여넣으면 validator가 눈앞에서 판정한다. (데모 시나리오
// 버튼은 모델 없이 전체 루프를 60초에 보여준다.)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SessionEngine } from '../../../method-harness/surfaces/engine';
import { renderTurn, SIX_SENTENCES, type WebView } from '../../../method-harness/surfaces/web';
import { restoreLedger } from '../../../method-harness/ledger';
import { RECALL_PROBE_WORDING, isMaterialEdit } from '../../../method-harness/influence';
import { projectCard } from '../../../method-harness/projection';
import {
  type ArgusTurn,
  type CaseState,
  type DecisionCardDraft,
  type LedgerEvent,
} from '../../../method-harness/types';
import { STORAGE_KEYS, getStorage, setStorage } from '@/lib/storage';

const CASE_ID = 'pilot_case';
const now = () => new Date().toISOString();
const plusDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

// ---------------------------------------------------------------------------
// Baseline extraction — 추출이지 심문이 아니다 (§2.2). 휴리스틱은 미기록을
// 허용하지만, 추출 실패는 결함이므로 사용자가 확인·수정한다.
// ---------------------------------------------------------------------------

function extractBaseline(text: string): { lean: string | 'none_stated'; statedReasons: string[] } {
  const sentences = text.split(/[.!?\n]/).map((s) => s.trim()).filter(Boolean);
  const leanSentence = sentences.find((s) => /(싶어|싶은데|기울|쪽으로|하려고|할까 해|려는 중)/.test(s));
  const reasons = sentences.filter((s) => s !== leanSentence && /(때문|아서요?$|어서요?$|고 싶|니까)/.test(s)).slice(0, 3);
  return { lean: leanSentence ?? 'none_stated', statedReasons: reasons };
}

// ---------------------------------------------------------------------------
// 데모 시나리오 — 모델 없이 유효한 envelope 하나. validator를 통과하는 형태
// 그대로이며, 붙여넣기 경로와 완전히 같은 코드 경로를 지난다.
// ---------------------------------------------------------------------------

function demoTurn(utteranceEventId: string, utterance: string): ArgusTurn {
  const quoted = utterance.slice(0, 40);
  return {
    phase: 'understand',
    route: 'decision',
    caseFit: 'in_scope',
    primaryMove: {
      type: 'reframe',
      content:
        '지금 결정은 두 선택지 중 고르기보다, 이번 행동으로 무엇을 확인하고 싶은지 정하는 문제로 보입니다. 확인하려는 것 하나를 고정하면 범위와 시점이 따라옵니다.',
      whyNow: '검증 목표와 실행 범위가 섞여 있어 frame이 병목입니다',
      falsifier: '만약 이번 선택이 학습이 아니라 확정된 약속(계약·일정) 이행을 위한 것이라면 이 재구성은 틀렸습니다',
    },
    question: {
      text: '이번에 가장 먼저 확인하고 싶은 건 무엇인가요 — 반응의 존재인가요, 지속인가요?',
      materialEffect: '답에 따라 공개 범위와 관찰 기간이 달라집니다',
      branches: [
        { responseShape: '반응의 존재', expectedNextMove: '짧고 좁은 공개로 첫 신호 관찰' },
        { responseShape: '반응의 지속', expectedNextMove: '핵심 흐름 중심 공개로 재방문 관찰' },
      ],
    },
    decisionRecordCandidate: {
      question: quoted + (utterance.length > 40 ? '…' : ''),
      stakes: { weight: 'significant', reversibility: 'costly' },
      adoptedState: 'test',
      choiceOrPolicy: '핵심 범위만 소수 대상에게 2주간 제한 실행하고 신호를 관찰한다',
      rationale: {
        values: ['빠른 현실 신호 확보'],
        materialBeliefs: [{ belief: '소수 대상이 전체 반응을 대표한다', confidence: 'uncertain' }],
        rejectedAlternative: { alternative: '전체 완성 후 일괄 실행', reason: '학습이 늦고 범위가 계속 자란다' },
      },
      nextAction: { action: '대상 목록과 최소 기준 확정', owner: '나', byOrWhen: '내일까지' },
      returnContract: {
        kind: 'commitment',
        trigger: { type: 'date', date: plusDays(3) },
        nextInChain: {
          kind: 'outcome',
          trigger: { type: 'signal', expectedSignal: '2주간의 핵심 신호(재방문/응답)', dateBackstop: plusDays(21) },
          expectedSignal: '2주간의 핵심 신호(재방문/응답)',
        },
      },
    },
    claims: [{ text: quoted, source: 'user', authority: 'said', citation: utteranceEventId }],
  };
}

// ---------------------------------------------------------------------------
// UI 원자 — 배경 틴트 블록(왼쪽 세로 악센트 바 금지 규약 준수)
// ---------------------------------------------------------------------------

function Panel({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'accent' | 'warn' }) {
  const toneClass =
    tone === 'accent'
      ? 'bg-[var(--accent)]/[0.05]'
      : tone === 'warn'
        ? 'bg-amber-500/[0.07]'
        : 'bg-[var(--surface)] border border-black/[0.06] dark:border-white/[0.08] shadow-sm';
  return <div className={`rounded-xl px-5 py-4 ${toneClass}`}>{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[var(--text-tertiary)] mb-1.5">{children}</div>;
}

function Btn({ children, onClick, kind = 'primary', disabled }: { children: React.ReactNode; onClick: () => void; kind?: 'primary' | 'ghost' | 'quiet'; disabled?: boolean }) {
  const cls =
    kind === 'primary'
      ? 'bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90'
      : kind === 'ghost'
        ? 'border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)]/[0.06]'
        : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]';
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------

type FlowStep = 'listen' | 'baseline' | 'coach' | 'acting' | 'return_observe' | 'return_probe' | 'return_reveal' | 'reviewed';

export default function MethodPilotPage() {
  const engineRef = useRef<SessionEngine | null>(null);
  const [version, setVersion] = useState(0);
  const [step, setStep] = useState<FlowStep>('listen');
  const [loaded, setLoaded] = useState(false);

  // inputs
  const [utterance, setUtterance] = useState('');
  const [baselineLean, setBaselineLean] = useState('');
  const [baselineReasons, setBaselineReasons] = useState('');
  const [envelopeJson, setEnvelopeJson] = useState('');
  const [view, setView] = useState<WebView | null>(null);
  const [pendingCard, setPendingCard] = useState<DecisionCardDraft | null>(null);
  const [editingCard, setEditingCard] = useState(false);
  const [editChoice, setEditChoice] = useState('');
  const [observation, setObservation] = useState('');
  const [obsKind, setObsKind] = useState<'direct' | 'relayed'>('direct');
  const [probeAnswer, setProbeAnswer] = useState('');
  const [lessonText, setLessonText] = useState('');
  const [lessonScope, setLessonScope] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  const persist = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setStorage(STORAGE_KEYS.METHOD_PILOT_LEDGER, engine.ledger.all());
    setVersion((v) => v + 1);
  }, []);

  // restore on mount
  useEffect(() => {
    try {
      const events = getStorage<LedgerEvent[]>(STORAGE_KEYS.METHOD_PILOT_LEDGER, []);
      if (events.length > 0) {
        engineRef.current = new SessionEngine(CASE_ID, restoreLedger(events));
        setStep(deriveStep(engineRef.current.state(), events));
      } else {
        engineRef.current = new SessionEngine(CASE_ID);
      }
    } catch {
      engineRef.current = new SessionEngine(CASE_ID); // 손상된 저장 → 새로 시작 (조용한 복원 없음)
    }
    setLoaded(true);
  }, []);

  const state: CaseState | null = useMemo(() => {
    void version;
    return loaded && engineRef.current ? engineRef.current.state() : null;
  }, [version, loaded]);

  if (!loaded || !state) {
    return <main className="min-h-screen bg-[var(--bg)]" />;
  }
  const engine = engineRef.current!;

  // ----- handlers ----------------------------------------------------------

  const submitUtterance = () => {
    const text = utterance.trim();
    if (!text) return;
    engine.recordUtterance(text, now());
    const extracted = extractBaseline(text);
    setBaselineLean(extracted.lean === 'none_stated' ? '' : extracted.lean);
    setBaselineReasons(extracted.statedReasons.join('\n'));
    persist();
    setStep('baseline');
  };

  const confirmBaseline = (skip: boolean) => {
    if (skip) {
      engine.recordBaseline(undefined, now());
    } else {
      engine.recordBaseline(
        {
          lean: baselineLean.trim() || 'none_stated',
          statedReasons: baselineReasons.split('\n').map((s) => s.trim()).filter(Boolean),
          consideredAlternatives: [],
        },
        now(),
      );
    }
    persist();
    setStep('coach');
  };

  const applyTurn = (turn: ArgusTurn) => {
    setPasteError(null);
    const result = engine.receiveTurn(turn, now());
    persist();
    setView(renderTurn(result, engine.state()));
    if (result.ok && result.turn.decisionRecordCandidate) {
      setPendingCard(result.turn.decisionRecordCandidate);
      setEditChoice(result.turn.decisionRecordCandidate.choiceOrPolicy);
    }
  };

  const runDemo = () => {
    const utteranceEvent = [...engine.ledger.forCase(CASE_ID)].reverse().find((e) => e.type === 'user_utterance');
    if (!utteranceEvent || utteranceEvent.type !== 'user_utterance') return;
    applyTurn(demoTurn(utteranceEvent.id, utteranceEvent.text));
  };

  const pasteEnvelope = () => {
    try {
      applyTurn(JSON.parse(envelopeJson) as ArgusTurn);
    } catch {
      setPasteError('JSON을 해석할 수 없습니다 — envelope 전체를 붙여넣어 주세요.');
    }
  };

  const adopt = (mode: 'accept' | 'edit' | 'decline') => {
    if (!pendingCard) return;
    if (mode === 'decline') {
      engine.adoptCard(pendingCard, { mode: 'decline' }, now());
      persist();
      setPendingCard(null);
      return; // 세션 가치는 유지, continuity는 정직하게 미성립
    }
    const finalCard = mode === 'edit' ? { ...pendingCard, choiceOrPolicy: editChoice.trim() || pendingCard.choiceOrPolicy } : pendingCard;
    const adoption =
      mode === 'edit'
        ? { mode: 'edit_then_accept' as const, editedFields: ['choiceOrPolicy'], materialEdit: isMaterialEdit(pendingCard.choiceOrPolicy, finalCard.choiceOrPolicy) }
        : { mode: 'accept' as const };
    engine.adoptCard(finalCard, adoption, now());
    persist();
    setPendingCard(null);
    setEditingCard(false);
    setStep('acting');
  };

  const submitObservation = () => {
    const text = observation.trim();
    if (!text) return;
    engine.recordObservation(text, obsKind, now(), now());
    setObservation('');
    persist();
    setStep('return_probe');
  };

  const submitProbe = (skip: boolean) => {
    if (!skip && probeAnswer.trim()) {
      engine.recordRecallProbeAnswer(probeAnswer.trim(), now());
    }
    engine.revealRecord(now());
    persist();
    setStep('return_reveal');
  };

  const closeReturn = () => {
    if (lessonText.trim()) {
      const id = `les_${Date.now().toString(36)}`;
      engine.ledger.append({ id, caseId: CASE_ID, at: now(), type: 'lesson_candidate', text: lessonText.trim(), scope: lessonScope.trim() || '이 결정 유형' });
    }
    engine.closeReturn(now());
    persist();
    setLessonText('');
    const s = engine.state();
    setStep(s.state === 'REVIEWED' ? 'reviewed' : 'acting');
  };

  const resetAll = () => {
    if (!window.confirm('pilot ledger를 완전히 삭제합니다 (폐기 전제 계약). 계속할까요?')) return;
    if (typeof window !== 'undefined') localStorage.removeItem(STORAGE_KEYS.METHOD_PILOT_LEDGER);
    window.location.reload();
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(engine.ledger.all(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `argus-pilot-ledger-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ----- derived -----------------------------------------------------------

  const sentenceIndex = stepSentence(step);
  const activeReturn = state.activeReturn;
  const returnDue = activeReturn && activeReturn.contract.trigger.type === 'date' ? new Date(activeReturn.contract.trigger.date).getTime() <= Date.now() : true;

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text-primary,#1c1917)]">
      <div className="mx-auto max-w-2xl px-5 py-10 space-y-6">
        {/* header */}
        <header className="space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight">Argus Method Pilot</h1>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="rounded-full bg-[var(--accent)]/[0.1] text-[var(--accent)] px-2.5 py-1 font-medium">R3-B 채널</span>
              <span className="rounded-full bg-black/[0.05] dark:bg-white/[0.08] px-2.5 py-1 text-[var(--text-tertiary)]">비공개 · 폐기 전제</span>
            </div>
          </div>
          {/* 여섯 문장 — 화면의 뼈대 (§2.1) */}
          <ol className="space-y-0.5">
            {SIX_SENTENCES.map((s, i) => (
              <li key={s} className={`text-[13px] leading-relaxed transition-colors ${i === sentenceIndex ? 'text-[var(--accent)] font-medium' : 'text-[var(--text-tertiary)]/60'}`}>
                {s}
              </li>
            ))}
          </ol>
        </header>

        {/* STEP 1 — 말해 주세요 */}
        {step === 'listen' && (
          <Panel>
            <Label>말해 주세요</Label>
            <textarea
              value={utterance}
              onChange={(e) => setUtterance(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="지금 앞에 있는 결정을 평소 말투 그대로 적어 주세요. 기울어진 쪽이 있다면 그것도요."
              className="w-full resize-none rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-transparent px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-[var(--accent)]/50"
            />
            <div className="mt-3 flex justify-end">
              <Btn onClick={submitUtterance} disabled={!utterance.trim()}>시작</Btn>
            </div>
          </Panel>
        )}

        {/* STEP 1.5 — baseline 확인 (추출, 심문 아님) */}
        {step === 'baseline' && (
          <Panel tone="accent">
            <Label>시작 상태 보존 — AI가 돕기 전의 당신</Label>
            <p className="text-[13px] text-[var(--text-secondary)] mb-3 leading-relaxed">
              말씀에서 추출한 것입니다. 고치거나, 기록 없이 진행할 수 있습니다. 이 스냅샷은 나중에 &ldquo;AI가 나를 얼마나 움직였는가&rdquo;를 잴 유일한 기준점입니다.
            </p>
            <div className="space-y-3">
              <div>
                <Label>현재 기울기 (없으면 비워두세요)</Label>
                <input value={baselineLean} onChange={(e) => setBaselineLean(e.target.value)} maxLength={200} className="w-full rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]/50" />
              </div>
              <div>
                <Label>말한 이유 (줄바꿈으로 구분)</Label>
                <textarea value={baselineReasons} onChange={(e) => setBaselineReasons(e.target.value)} maxLength={600} rows={2} className="w-full resize-none rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]/50" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Btn kind="quiet" onClick={() => confirmBaseline(true)}>기록 없이 진행 (미기록으로 남습니다)</Btn>
              <Btn onClick={() => confirmBaseline(false)}>이대로 보존</Btn>
            </div>
          </Panel>
        )}

        {/* STEP 2 — 코칭 턴 */}
        {step === 'coach' && (
          <>
            <Panel>
              <Label>지금 가장 도움이 되는 한 가지</Label>
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
                아래 packet을 아무 모델에나 주고 envelope JSON을 붙여넣으면, validator가 그 출력을 눈앞에서 판정합니다. 모델 없이 보려면 데모 시나리오를 여세요.
              </p>
              <details className="mb-4 group">
                <summary className="cursor-pointer text-[13px] font-medium text-[var(--accent)] select-none">컴파일된 prompt packet (L0–L6) 열기</summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-black/[0.04] dark:bg-white/[0.05] p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
                  {engine.compilePacket('web', utterance || '(이번 턴 입력)', 'diagnose_and_propose')}
                </pre>
              </details>
              <textarea
                value={envelopeJson}
                onChange={(e) => setEnvelopeJson(e.target.value)}
                maxLength={20000}
                rows={4}
                placeholder='모델이 반환한 ArgusTurn envelope JSON을 붙여넣으세요 — {"phase":"understand", ...}'
                className="w-full resize-none rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-transparent px-3 py-2.5 font-mono text-[12px] outline-none focus:border-[var(--accent)]/50"
              />
              {pasteError && <p className="mt-2 text-[13px] text-amber-600 dark:text-amber-400">{pasteError}</p>}
              <div className="mt-3 flex items-center justify-between">
                <Btn kind="ghost" onClick={runDemo}>데모 시나리오로 보기</Btn>
                <Btn onClick={pasteEnvelope} disabled={!envelopeJson.trim()}>검증하고 반영</Btn>
              </div>
            </Panel>

            {view && (
              <div className="space-y-3">
                {view.blocks.filter((b) => b.kind !== 'adoption' && b.kind !== 'card').map((b, i) => (
                  <Panel key={i} tone={b.kind === 'validator_notice' ? 'warn' : b.kind === 'adoption' ? 'accent' : 'default'}>
                    <Label>{b.title}</Label>
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{b.body}</p>
                    {b.meta?.falsifier && (
                      <p className="mt-2 rounded-lg bg-[var(--accent)]/[0.06] px-3 py-2 text-[12px] text-[var(--text-secondary)] leading-relaxed">
                        이 재구성이 틀리려면: {b.meta.falsifier}
                      </p>
                    )}
                    {b.meta?.authority && <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">{b.meta.authority}</p>}
                  </Panel>
                ))}
              </div>
            )}

            {pendingCard && (
              <Panel tone="accent">
                <Label>Decision Card 후보 — 채택은 한 번의 행위입니다</Label>
                <dl className="space-y-2 text-[14px] leading-relaxed">
                  <CardRow k="결정" v={pendingCard.question} />
                  {editingCard ? (
                    <div>
                      <Label>선택 (수정 중 — 수정분은 당신의 것이 됩니다)</Label>
                      <textarea value={editChoice} onChange={(e) => setEditChoice(e.target.value)} maxLength={500} rows={2} className="w-full resize-none rounded-lg border border-[var(--accent)]/40 bg-[var(--surface)] px-3 py-2 text-sm outline-none" />
                    </div>
                  ) : (
                    <CardRow k="선택" v={pendingCard.choiceOrPolicy} />
                  )}
                  <CardRow k="기준" v={pendingCard.rationale.values.join(' · ')} />
                  {pendingCard.rationale.materialBeliefs.map((b) => (
                    <CardRow key={b.belief} k="중요 가정" v={`${b.belief} [${b.confidence}]`} />
                  ))}
                  {pendingCard.rationale.rejectedAlternative && (
                    <CardRow k="기각한 대안" v={`${pendingCard.rationale.rejectedAlternative.alternative} — ${pendingCard.rationale.rejectedAlternative.reason}`} />
                  )}
                  {pendingCard.nextAction && <CardRow k="다음 행동" v={`${pendingCard.nextAction.action} (${pendingCard.nextAction.owner}, ${pendingCard.nextAction.byOrWhen})`} />}
                </dl>
                <div className="mt-4 flex items-center justify-between">
                  <Btn kind="quiet" onClick={() => adopt('decline')}>보류 — 카드 없이 끝내기</Btn>
                  <div className="flex gap-2">
                    {editingCard ? (
                      <Btn onClick={() => adopt('edit')}>수정해서 채택</Btn>
                    ) : (
                      <>
                        <Btn kind="ghost" onClick={() => setEditingCard(true)}>고쳐서 채택</Btn>
                        <Btn onClick={() => adopt('accept')}>이대로 채택</Btn>
                      </>
                    )}
                  </div>
                </div>
              </Panel>
            )}
          </>
        )}

        {/* STEP 3 — 채택 후: 카드 + 귀환 대기 + 행동 보고 */}
        {(step === 'acting' || step === 'return_observe' || step === 'return_probe') && state.card && (
          <Panel>
            <Label>채택된 결정 {state.baseline && state.baseline !== 'not_captured' ? '· 처음과의 delta 포함' : ''}</Label>
            {step === 'return_observe' || step === 'return_probe' ? (
              <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
                {/* 관찰 전에는 질문과 기다리던 signal만 (§7.3) — 선택·이유는 잠겨 있습니다 */}
                <span className="font-medium text-[var(--text-primary,inherit)]">{engine.openReturn().question}</span>
                <br />기다리던 것: {engine.openReturn().awaitedSignal}
                <br /><span className="text-[12px] text-[var(--text-tertiary)]">당시의 선택과 이유는 관찰을 들은 뒤에 열립니다.</span>
              </p>
            ) : (
              <pre className="whitespace-pre-wrap text-[14px] leading-relaxed font-sans">{projectCard(state, 'web').text}</pre>
            )}
          </Panel>
        )}

        {step === 'acting' && state.card && (
          <Panel>
            <Label>현실에서 — 상태: {state.state}</Label>
            {activeReturn ? (
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-3">
                귀환 대기 · {activeReturn.contract.kind}
                {state.queuedReturns.length > 0 && ` (이후 ${state.queuedReturns.length}건 연쇄 대기)`}
              </p>
            ) : (
              <p className="text-[13px] text-[var(--text-secondary)] mb-3">활성 귀환이 없습니다.</p>
            )}
            <div className="flex items-center justify-between">
              <Btn kind="ghost" onClick={() => { engine.reportAction('행동 시작 보고', now()); persist(); }}>행동 시작을 보고</Btn>
              {activeReturn && (
                <Btn onClick={() => setStep('return_observe')} disabled={false}>
                  {returnDue ? '귀환 열기' : '지금 미리 귀환 열기'}
                </Btn>
              )}
            </div>
          </Panel>
        )}

        {/* STEP 4 — RETURN: 관찰이 기록보다 먼저 */}
        {step === 'return_observe' && (
          <Panel tone="accent">
            <Label>먼저, 실제로 무슨 일이 있었나요</Label>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="일어난 일을 그대로 적어 주세요 — 숫자·사건·출처. 해석은 다음 단계에서."
              className="w-full resize-none rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-[var(--surface)] px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-[var(--accent)]/50"
            />
            <div className="mt-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                <select value={obsKind} onChange={(e) => setObsKind(e.target.value as 'direct' | 'relayed')} className="rounded-md border border-black/[0.08] dark:border-white/[0.1] bg-[var(--surface)] px-2 py-1 text-[13px]">
                  <option value="direct">직접 관찰</option>
                  <option value="relayed">전달받음</option>
                </select>
              </label>
              <Btn onClick={submitObservation} disabled={!observation.trim()}>관찰 기록</Btn>
            </div>
          </Panel>
        )}

        {step === 'return_probe' && (
          <Panel tone="accent">
            <Label>기록을 열기 전에, 하나만</Label>
            <p className="text-[15px] leading-relaxed mb-3">{RECALL_PROBE_WORDING}</p>
            <textarea
              value={probeAnswer}
              onChange={(e) => setProbeAnswer(e.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full resize-none rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-[var(--surface)] px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-[var(--accent)]/50"
            />
            <div className="mt-3 flex items-center justify-between">
              <Btn kind="quiet" onClick={() => submitProbe(true)}>건너뛰기</Btn>
              <Btn onClick={() => submitProbe(false)} disabled={!probeAnswer.trim()}>기억을 남기고 기록 열기</Btn>
            </div>
          </Panel>
        )}

        {step === 'return_reveal' && state.card && (
          <>
            <Panel>
              <Label>이제 — 당시의 기록</Label>
              <pre className="whitespace-pre-wrap text-[14px] leading-relaxed font-sans">{projectCard(state, 'web').text}</pre>
              {state.recallProbeAnswer && (
                <div className="mt-3 rounded-lg bg-[var(--accent)]/[0.06] px-4 py-3">
                  <Label>방금의 기억 vs 당시의 기록</Label>
                  <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">기억: {state.recallProbeAnswer}</p>
                </div>
              )}
              {state.observations.length > 0 && (
                <div className="mt-3">
                  <Label>관찰</Label>
                  {state.observations.map((o) => (
                    <p key={o.id} className="text-[13px] leading-relaxed text-[var(--text-secondary)]">{o.text}</p>
                  ))}
                </div>
              )}
            </Panel>
            <Panel>
              <Label>Debrief — 순서대로 하나씩</Label>
              <ol className="list-decimal ml-4 space-y-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                <li>이 관찰은 당시의 어떤 가정에 답했나요? (해석은 당신의 몫입니다)</li>
                <li>당시 알 수 있던 것 기준으로, 과정은 충분했나요?</li>
                <li>운이나 환경 변화는 무엇이었나요?</li>
                {state.card.rationale.rejectedAlternative && (
                  <li>이 관찰이 기각했던 대안({state.card.rationale.rejectedAlternative.alternative})의 전제도 건드리나요?</li>
                )}
                <li>다음 유사 결정에서 유지·수정할 규칙이 있다면 아래에 남기세요 — 없으면 비워두세요. 정직한 &lsquo;no lesson&rsquo;도 결과입니다.</li>
              </ol>
              <div className="mt-3 space-y-2">
                <input value={lessonText} onChange={(e) => setLessonText(e.target.value)} maxLength={300} placeholder="lesson 후보 (선택) — 범위가 제한된 한 문장" className="w-full rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]/50" />
                {lessonText.trim() && (
                  <input value={lessonScope} onChange={(e) => setLessonScope(e.target.value)} maxLength={120} placeholder="적용 범위 — 어떤 결정에서만 유효한가요?" className="w-full rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]/50" />
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <Btn onClick={closeReturn}>귀환 닫기{state.queuedReturns.length > 0 ? ' — 다음 귀환이 활성화됩니다' : ''}</Btn>
              </div>
            </Panel>
          </>
        )}

        {step === 'reviewed' && (
          <Panel tone="accent">
            <Label>루프 완주</Label>
            <p className="text-[15px] leading-relaxed">
              한 결정이 현실까지 다녀왔습니다. 기록·관찰·기억이 전부 시간 순서 그대로 보존되어 있습니다 — 아무것도 덮어쓰이지 않았습니다.
            </p>
            {state.lessons.length > 0 && (
              <div className="mt-3">
                <Label>남긴 lesson 후보</Label>
                {state.lessons.map((l) => (
                  <p key={l.id} className="text-[13px] text-[var(--text-secondary)]">{l.text} <span className="text-[var(--text-tertiary)]">— {l.scope}</span></p>
                ))}
              </div>
            )}
          </Panel>
        )}

        {/* footer */}
        <footer className="flex items-center justify-between pt-2 text-[12px] text-[var(--text-tertiary)]">
          <span>ledger {engine.ledger.all().length} events · 상태 {state.state}</span>
          <span className="flex gap-3">
            <button type="button" onClick={exportJson} className="hover:text-[var(--text-secondary)]">내보내기</button>
            <button type="button" onClick={resetAll} className="hover:text-[var(--text-secondary)]">폐기</button>
          </span>
        </footer>
      </div>
    </main>
  );
}

function CardRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-[12px] pt-0.5 text-[var(--text-tertiary)]">{k}</dt>
      <dd className="flex-1">{v}</dd>
    </div>
  );
}

function stepSentence(step: FlowStep): number {
  switch (step) {
    case 'listen': return 0;
    case 'baseline': return 1;
    case 'coach': return 2;
    case 'acting': return 4;
    case 'return_observe':
    case 'return_probe':
    case 'return_reveal': return 5;
    case 'reviewed': return 3;
  }
}

function deriveStep(s: CaseState, events: LedgerEvent[]): FlowStep {
  if (s.state === 'REVIEWED') return 'reviewed';
  if (s.recordRevealed) return 'return_reveal';
  if (s.card) return 'acting';
  const hasBaseline = s.baseline !== undefined;
  const hasUtterance = events.some((e) => e.type === 'user_utterance');
  if (hasBaseline) return 'coach';
  if (hasUtterance) return 'baseline';
  return 'listen';
}
