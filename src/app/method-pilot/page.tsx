'use client';

// ARGUS METHOD v1.0 — R3-B pilot channel (BLUEPRINT §9.12 단일 예외).
// 초대 전용·비공개·폐기 전제. 이 페이지는 method-harness를 읽기 전용으로
// 사용하는 유일한 src/ 지점이다 (isolation guard의 명시적 예외).
//
// 2026-08-04 방향성 검토(창업자 세션) 반영: 화면의 언어는 방법론이 아니라
// 사람의 언어다. 사용자가 보는 것은 "기록 → 점검 → 현실 → 대조" 네 걸음뿐이고,
// 계기판(ledger 카운터, prompt packet, envelope JSON)은 엔지니어 패널 뒤로
// 접힌다. 하네스 의미론은 그대로다 — 바뀐 것은 투영(presentation)뿐이다.
//
// LLM 호출: 이 페이지가 **최소 러너**로서 소유한다 (engine.ts는 오프라인을
// 유지하고, 호출은 R3-A/B 러너의 몫이라는 §11.1 배치를 그대로 따른다).
// runLive가 packet을 컴파일해 모델에 주고, 돌아온 envelope은 예외 없이
// validator를 통과한다. 모델 없이 보려면 예시 시나리오, 직접 붙여넣으려면
// 엔지니어 패널.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SessionEngine } from '../../../method-harness/surfaces/engine';
import { renderTurn, type WebView } from '../../../method-harness/surfaces/web';
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
import { callLLMJson } from '@/lib/llm';

const CASE_ID = 'pilot_case';

// ArgusTurn envelope 스키마 지시.
// 대부분은 출력 형태지만, 마지막 두 줄(합법 claim 쌍·평평하면 stop/mirror)은
// 방법 규칙의 재진술이다 — OPERATING_CONSTITUTION이 이미 말한 것을 모델이
// 형태와 함께 보도록 옮겨둔 것이고, 새 규범을 만들지 않는다. 둘이 어긋나면
// constitution이 이기며, 최종 심판은 어느 쪽도 아닌 validator다.
const ENVELOPE_INSTRUCTION = `위 packet의 방법을 따라 이번 턴을 수행하고, 아래 TypeScript 형태의 ArgusTurn JSON 하나만 출력하세요. 마크다운·설명 없이 { 로 시작해 } 로 끝나는 순수 JSON. 모든 문자열 내용은 한국어로.

{
  "phase": "understand" | "improve" | "move" | "return",
  "route": "decision" | "information" | "sensemaking" | "emotional" | "safety",
  "caseFit": "in_scope" | "light_help" | "out_of_scope" | "safety_route",
  "primaryMove": {
    "type": "mirror"|"reframe"|"value_clarification"|"alternative_generation"|"research"|"claim_source_split"|"competing_hypotheses"|"outside_view"|"premortem"|"tradeoff_comparison"|"experiment_design"|"recommendation"|"next_action_concretion"|"deliberate_defer"|"stop",
    "content": "이번 턴의 한 가지 기여 (2~4문장)",
    "whyNow": "왜 지금 이것인가 (1문장)",
    "falsifier": "type이 reframe이면 필수 — 이 재구성이 틀렸음을 보여줄 관찰 가능한 사실"
  },
  "question": { "text": "...", "materialEffect": "...", "branches": [{"responseShape":"...","expectedNextMove":"..."}, ...] } (선택 — 답이 다음 수를 실제로 바꿀 때만, 가지 2개 이상),
  "decisionRecordCandidate": {
    "question": "결정 질문 (사용자 표현 유지)",
    "stakes": { "weight": "minor"|"significant"|"major", "reversibility": "reversible"|"costly"|"one_way" },
    "adoptedState": "decide"|"test"|"research"|"defer"|"reframe"|"stop",
    "choiceOrPolicy": "제안하는 선택/정책 한 문장",
    "rationale": { "values": ["..."], "materialBeliefs": [{"belief":"...","confidence":"confident"|"uncertain"|"contested"}], "rejectedAlternative": {"alternative":"...","reason":"..."} },
    "nextAction": { "action": "...", "owner": "...", "byOrWhen": "..." },
    "returnContract": { "kind": "commitment", "trigger": {"type":"date","date":"<ISO, 지금+3일>"}, "nextInChain": { "kind":"outcome", "trigger": {"type":"signal","expectedSignal":"...","dateBackstop":"<ISO, 지금+21일>"}, "expectedSignal":"..." } }
  } (선택 — 결정이 실제로 열려 있을 때만),
  "claims": [{"text":"...","source":"user"|"ai","authority":"said"|"proposed"|"inferred","citation":"이벤트 id (없으면 생략)"}],
  "abstentions": ["근거가 없어 비워둔 것"] (선택)
}

규칙: (user,said)·(ai,proposed)·(ai,inferred)만 유효한 claim 조합. 사용자가 말하지 않은 것을 user로 표시하지 말 것. 평평한 상황이면 primaryMove.type을 "stop" 또는 "mirror"로 하고 카드를 제안하지 말 것.`;
const now = () => new Date().toISOString();
const plusDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

// ---------------------------------------------------------------------------
// 사람의 언어 — 내부 상태·용어를 화면에 그대로 흘리지 않는다 (방향성 검토).
// 의미는 하네스가 정본이고, 여기는 표시만 바꾼다.
// ---------------------------------------------------------------------------

const STATE_LABELS: Record<CaseState['state'], string> = {
  OPEN: '진행 중',
  DECIDED: '결정함',
  TESTING: '시험해보는 중',
  RESEARCHING: '조사하기로 함',
  DEFERRED: '기한 있는 보류',
  REFRAMED: '질문을 다시 잡음',
  STOPPED: '여기서 멈춤',
  ACTING: '실행 중',
  AWAITING_SIGNAL: '결과를 기다리는 중',
  RETURNED: '돌아봄',
  REVIEWED: '한 바퀴 완료',
  DORMANT: '잠시 접어둠',
};

const RETURN_KIND_LABELS: Record<string, string> = {
  commitment: '행동을 시작했는지 확인',
  signal: '기다리던 신호 확인',
  outcome: '결과 확인',
  learning: '배운 것 확인',
};

// 하네스 투영 텍스트의 내부 표기를 화면용 한국어로 치환 (표시 전용).
function koDisplay(text: string): string {
  return text
    .replace(/none_stated/g, '기울기 없이 시작')
    .replace(/not_captured/g, '기록하지 않고 시작')
    .replace(/\[uncertain\]/g, '(확신 낮음)')
    .replace(/\[confident\]/g, '(확신 있음)')
    .replace(/\[contested\]/g, '(이견 있음)')
    .replace(/— owner: /g, '— 담당: ')
    .replace(/귀환: commitment/g, '돌아보기: 행동 확인부터')
    .replace(/귀환: outcome/g, '돌아보기: 결과 확인')
    .replace(/귀환: signal/g, '돌아보기: 신호 확인')
    .replace(/귀환: learning/g, '돌아보기: 배움 확인');
}

const BELIEF_CONFIDENCE_KO: Record<string, string> = {
  confident: '확신 있음',
  uncertain: '확신 낮음',
  contested: '이견 있음',
};

// 네 걸음 — 화면의 뼈대. 여섯 문장 문법(web.ts SIX_SENTENCES)은 이 파일럿에서
// 사용자에게 노출하지 않는다: 방법론 어휘를 화면에서 걷어내는 것이 평문화의
// 목적이었다. 문법 자체는 web 표면의 정본으로 남아 있다.
const JOURNEY = ['결정을 기록', 'AI가 한 가지만 점검', '현실에서 실행', '기억과 기록을 대조'] as const;

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
// 예시 시나리오 — 모델 없이 유효한 envelope 하나. validator를 통과하는 형태
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
      whyNow: '무엇을 확인하려는지와 얼마나 완성할지가 한 덩어리로 섞여 있는 것이 지금의 걸림돌입니다',
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
    <button type="button" disabled={disabled} onClick={onClick} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${cls}`}>
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
  const [entryMode, setEntryMode] = useState<'decision' | 'conversation'>('decision');
  const [utterance, setUtterance] = useState('');
  const [lastTurn, setLastTurn] = useState<ArgusTurn | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
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
    if (entryMode === 'conversation') {
      // 붙여넣은 대화는 사용자의 말이 아니다 — AI 발화가 섞여 있다. 이것을
      // user_utterance 로 넣으면 세 가지가 동시에 망가진다: (1) 화면이 AI
      // 문장을 "당신에게서 온 것"으로 표시하고, (2) claimTracesToUser 가
      // 전사본의 아무 AI 문장이나 user_said 로 통과시켜 계보 검사가 무력화되고,
      // (3) userPulledRecommendation 이 전사본 속 "추천"에 걸려 initiative 를
      // pulled 로 뒤집어 major/one_way 방어를 끈다. 그래서 외부 출처로 기록한다.
      engine.ledger.append({
        id: `ext_${Date.now().toString(36)}`,
        caseId: CASE_ID,
        at: now(),
        type: 'external_source',
        description: `붙여넣은 AI 대화 (${text.length}자)`,
        sourceRef: 'pasted_conversation',
      });
      // 기준선 자동 추출도 금지 — AI가 이미 말한 뒤의 전사본에서 "AI가 말하기
      // 전의 내 생각"을 뽑는 것은 정의상 불가능하다. 빈 칸으로 두고 사용자가
      // 직접 적게 한다.
      setBaselineLean('');
      setBaselineReasons('');
      persist();
      setStep('baseline');
      return;
    }
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
    // 거부된 턴의 내용은 저자 패널에 올리지 않는다 — check 6이 막은 laundering
    // 을 렌더 층에서 되살리는 꼴이 된다. 거부 사유는 view가 이미 보여준다.
    setLastTurn(result.ok ? result.turn : null);
    if (result.ok && result.turn.decisionRecordCandidate) {
      setPendingCard(result.turn.decisionRecordCandidate);
      setEditChoice(result.turn.decisionRecordCandidate.choiceOrPolicy);
    }
  };

  // 실모델 점검 — 기존 LLM 설정(프록시 또는 본인 키)을 그대로 탄다. 실패하면
  // 정직하게 이유를 보여주고 예시 응답 경로를 남긴다 (조용한 대체 없음).
  const runLive = async () => {
    setLiveError(null);
    setLiveLoading(true);
    try {
      const packet = engine.compilePacket('web', utterance || '(이번 턴 입력)', 'diagnose_and_propose');
      const turn = await callLLMJson<ArgusTurn>(
        [{ role: 'user', content: ENVELOPE_INSTRUCTION }],
        { system: packet, maxTokens: 3000 },
      );
      applyTurn(turn);
    } catch (e) {
      setLiveError(e instanceof Error ? e.message : 'AI 호출에 실패했습니다.');
    } finally {
      setLiveLoading(false);
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
    // armReturn 은 백스톱 없는 event/signal 트리거에 HarnessViolation 을 던진다.
    // validateTurn 은 카드 '안'의 returnContract 를 보지 않으므로 모델이 그 필드를
    // 빠뜨린 카드가 여기까지 올 수 있다. 잡지 않으면 card_adopted 는 원장에
    // 들어갔는데 persist 도 화면 전환도 안 되고, 다시 누르면 중복 채택이 된다.
    try {
      engine.adoptCard(finalCard, adoption, now());
    } catch (e) {
      persist(); // 이미 append 된 채택 사건을 잃지 않는다
      setPendingCard(null);
      setEditingCard(false);
      setLiveError(
        `결정은 기록됐지만 돌아보기 예약에 실패했습니다: ${e instanceof Error ? e.message : String(e)} — 아래에서 직접 예약할 수 있습니다.`,
      );
      setStep('acting');
      return;
    }
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
    if (!window.confirm('지금까지의 기록을 전부 삭제합니다. 되돌릴 수 없어요. 계속할까요?')) return;
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

  const journeyIndex = stepJourney(step);
  const activeReturn = state.activeReturn;
  const returnDue = activeReturn && activeReturn.contract.trigger.type === 'date' ? new Date(activeReturn.contract.trigger.date).getTime() <= Date.now() : true;

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text-primary,#1c1917)]">
      <div className="mx-auto max-w-2xl px-5 py-10 space-y-6">
        {/* header */}
        <header className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-y-2">
            <h1 className="text-xl font-semibold tracking-tight">Argus</h1>
            <div className="flex items-center gap-2 text-[11px]">
              <span className="rounded-full bg-[var(--accent)]/[0.1] text-[var(--accent)] px-2.5 py-1 font-medium">초대판</span>
              <span className="rounded-full bg-black/[0.05] dark:bg-white/[0.08] px-2.5 py-1 text-[var(--text-tertiary)]">비공개 · 이 기기에만 저장</span>
            </div>
          </div>
          <p className="text-[15px] leading-relaxed text-[var(--text-secondary)]">
            AI를 아무리 써도, 결정은 당신의 것으로.
            <br />
            <span className="text-[13px] text-[var(--text-tertiary)]">
              결정을 짧게 기록해두면 — 결과가 나왔을 때, 그때의 기억과 기록을 나란히 보여드립니다.
            </span>
          </p>
          {/* 네 걸음 진행 표시 */}
          <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
            {JOURNEY.map((label, i) => (
              <li key={label} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden className="text-[var(--text-tertiary)]/40">→</span>}
                <span
                  className={`rounded-full px-2.5 py-1 transition-colors ${
                    i === journeyIndex
                      ? 'bg-[var(--accent)]/[0.12] text-[var(--accent)] font-medium'
                      : i < journeyIndex || step === 'reviewed'
                        ? 'text-[var(--text-secondary)]'
                        : 'text-[var(--text-tertiary)]/60'
                  }`}
                >
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </header>

        {/* STEP 1 — 결정을 기록 (직접 쓰기 또는 이미 있는 AI 대화 붙여넣기) */}
        {step === 'listen' && (
          <Panel>
            <div className="mb-3 flex gap-1.5 text-[12px]">
              <button
                type="button"
                onClick={() => setEntryMode('decision')}
                className={`rounded-full px-3 py-1.5 transition-colors ${entryMode === 'decision' ? 'bg-[var(--accent)]/[0.12] text-[var(--accent)] font-medium' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
              >
                결정 적기
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('conversation')}
                className={`rounded-full px-3 py-1.5 transition-colors ${entryMode === 'conversation' ? 'bg-[var(--accent)]/[0.12] text-[var(--accent)] font-medium' : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'}`}
              >
                AI 대화 붙여넣기
              </button>
            </div>
            {entryMode === 'conversation' ? (
              <>
                <Label>방금 AI와 나눈 대화, 결정은 누가 한 걸까요?</Label>
                <p className="text-[13px] text-[var(--text-secondary)] mb-2 leading-relaxed">
                  ChatGPT·Claude와 나눈 대화를 그대로 붙여넣으세요. 어디까지가 당신 생각이고 어디부터가 AI 생각인지, 바로 나눠서 보여드립니다.
                </p>
              </>
            ) : (
              <Label>지금 앞에 있는 결정</Label>
            )}
            <textarea
              value={utterance}
              onChange={(e) => setUtterance(e.target.value)}
              maxLength={entryMode === 'conversation' ? 20000 : 2000}
              rows={entryMode === 'conversation' ? 8 : 5}
              placeholder={
                entryMode === 'conversation'
                  ? '대화 전체를 복사해서 붙여넣으세요 — 편집하지 않아도 됩니다.'
                  : '평소 말투 그대로 적어 주세요. 마음이 기운 쪽이 있다면 그것도요. (예: 새 온보딩을 다듬어서 다음 달에 열지, 지금 일부에게 먼저 열지 고민이야)'
              }
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
            <Label>AI가 말하기 전, 지금의 내 생각</Label>
            <p className="text-[13px] text-[var(--text-secondary)] mb-3 leading-relaxed">
              방금 쓰신 글에서 뽑아봤어요. 다르면 고쳐 주세요. 이걸 남겨두는 이유는 하나 —
              나중에 &ldquo;이 결정이 정말 내 생각이었나&rdquo;를 확인할 수 있는 유일한 출발점이기 때문입니다.
            </p>
            <div className="space-y-3">
              <div>
                <Label>지금 기운 쪽 (없으면 비워두세요)</Label>
                <input value={baselineLean} onChange={(e) => setBaselineLean(e.target.value)} maxLength={200} className="w-full rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]/50" />
              </div>
              <div>
                <Label>그 이유 (줄바꿈으로 구분)</Label>
                <textarea value={baselineReasons} onChange={(e) => setBaselineReasons(e.target.value)} maxLength={600} rows={2} className="w-full resize-none rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]/50" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Btn kind="quiet" onClick={() => confirmBaseline(true)}>남기지 않고 진행</Btn>
              <Btn onClick={() => confirmBaseline(false)}>이대로 남기기</Btn>
            </div>
          </Panel>
        )}

        {/* STEP 2 — 코칭 턴 */}
        {step === 'coach' && (
          <>
            {!view && (
              <Panel>
                <Label>AI가 한 가지만 점검합니다</Label>
                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-4">
                  조언을 쏟아내지 않습니다. 지금 이 결정에서 가장 무게가 실리는 한 지점만 짚고,
                  그 짚기가 틀렸다면 언제 틀린 것인지도 함께 말합니다. 마지막 선택은 언제나 당신이 합니다.
                </p>
                {liveError && (
                  <p className="mb-3 rounded-lg bg-amber-500/[0.08] px-3 py-2 text-[12px] leading-relaxed text-amber-700 dark:text-amber-400">
                    AI 연결 실패: {liveError}
                    <br />설정에서 AI 연결을 확인하거나, 예시 응답으로 흐름을 먼저 볼 수 있습니다.
                  </p>
                )}
                <div className="flex items-center justify-end gap-2">
                  {liveError && <Btn kind="ghost" onClick={runDemo}>예시 응답으로 보기</Btn>}
                  <Btn onClick={runLive} disabled={liveLoading}>{liveLoading ? '점검 중… 몇 초 걸립니다' : '점검 받기'}</Btn>
                </div>
              </Panel>
            )}

            {/* 턴이 끝났는데 카드 후보가 없으면(평평한 상황·거부된 턴) 여기가
                막다른 길이 된다 — 점검 패널은 view가 생기면 사라지기 때문이다.
                다시 점검하거나 기록 없이 끝낼 길을 항상 남긴다. */}
            {view && !pendingCard && (
              <Panel>
                <Label>다음</Label>
                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-3">
                  이번 턴에는 남길 결정 후보가 없습니다. 더 볼 것이 있으면 다시 점검하고, 없으면 여기서 끝내도 됩니다.
                </p>
                <div className="flex items-center justify-between">
                  <Btn kind="quiet" onClick={() => { setView(null); setLastTurn(null); }}>다시 쓰기</Btn>
                  <Btn onClick={runLive} disabled={liveLoading}>{liveLoading ? '점검 중…' : '한 번 더 점검'}</Btn>
                </div>
              </Panel>
            )}

            {view && (
              <div className="space-y-3" aria-live="polite">
                {view.blocks.filter((b) => b.kind !== 'adoption' && b.kind !== 'card').map((b, i) => (
                  <Panel key={i} tone={b.kind === 'validator_notice' ? 'warn' : b.kind === 'adoption' ? 'accent' : 'default'}>
                    <Label>{b.title}</Label>
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{b.body}</p>
                    {b.meta?.falsifier && (
                      <p className="mt-2 rounded-lg bg-[var(--accent)]/[0.06] px-3 py-2 text-[12px] text-[var(--text-secondary)] leading-relaxed">
                        이 짚기가 틀리려면: {b.meta.falsifier}
                      </p>
                    )}
                    {b.meta?.authority && <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">{b.meta.authority}</p>}
                  </Panel>
                ))}
              </div>
            )}

            {view && lastTurn && (
              <Panel>
                <Label>저자 구분 — 지금까지 누가 무엇을 말했나</Label>
                <div className="space-y-3 text-[13px] leading-relaxed">
                  <div>
                    <p className="font-medium text-[var(--text-primary,inherit)] mb-1">당신에게서 온 것</p>
                    {state.baseline && state.baseline !== 'not_captured' && state.baseline.lean !== 'none_stated' && (
                      <p className="text-[var(--text-secondary)]">기울기: {state.baseline.lean}</p>
                    )}
                    {(lastTurn.claims || []).filter((c) => c.source === 'user').map((c, i) => (
                      <p key={i} className="text-[var(--text-secondary)]">&ldquo;{c.text}&rdquo;</p>
                    ))}
                    {(!state.baseline || state.baseline === 'not_captured' || state.baseline.lean === 'none_stated') &&
                      (lastTurn.claims || []).filter((c) => c.source === 'user').length === 0 && (
                        <p className="text-[var(--text-tertiary)]">아직 기울기 없이 시작했습니다 — 그것도 정직한 출발점입니다.</p>
                      )}
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text-primary,inherit)] mb-1">AI가 얹은 것 (제안일 뿐)</p>
                    <p className="text-[var(--text-secondary)]">{lastTurn.primaryMove.content}</p>
                    {(lastTurn.claims || []).filter((c) => c.source === 'ai').map((c, i) => (
                      <p key={i} className="text-[var(--text-secondary)]">{c.text}</p>
                    ))}
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text-primary,inherit)] mb-1">아직 아무도 정하지 않은 것</p>
                    <p className="text-[var(--text-secondary)]">
                      {pendingCard
                        ? '아래 카드는 후보입니다 — 당신이 남겨야 당신의 결정이 됩니다.'
                        : '이번 턴에는 결정 후보가 없습니다. 결정은 열려 있습니다.'}
                    </p>
                  </div>
                </div>
              </Panel>
            )}

            {pendingCard && (
              <Panel tone="accent">
                <Label>이대로 기록해둘까요?</Label>
                <p className="text-[12px] text-[var(--text-tertiary)] mb-3 leading-relaxed">
                  아래는 제안일 뿐입니다 — 당신이 채택해야 당신의 결정으로 기록됩니다. 고쳐서 남기면 고친 부분은 당신의 것으로 표시됩니다.
                </p>
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
                    <CardRow key={b.belief} k="중요 가정" v={`${b.belief} (${BELIEF_CONFIDENCE_KO[b.confidence] ?? b.confidence})`} />
                  ))}
                  {pendingCard.rationale.rejectedAlternative && (
                    <CardRow k="접어둔 대안" v={`${pendingCard.rationale.rejectedAlternative.alternative} — ${pendingCard.rationale.rejectedAlternative.reason}`} />
                  )}
                  {pendingCard.nextAction && <CardRow k="다음 행동" v={`${pendingCard.nextAction.action} (${pendingCard.nextAction.owner}, ${pendingCard.nextAction.byOrWhen})`} />}
                </dl>
                <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Btn kind="quiet" onClick={() => adopt('decline')}>기록 없이 끝내기</Btn>
                  <div className="flex gap-2">
                    {editingCard ? (
                      <Btn onClick={() => adopt('edit')}>수정해서 남기기</Btn>
                    ) : (
                      <>
                        <Btn kind="ghost" onClick={() => setEditingCard(true)}>고쳐서 남기기</Btn>
                        <Btn onClick={() => adopt('accept')}>이대로 남기기</Btn>
                      </>
                    )}
                  </div>
                </div>
              </Panel>
            )}
          </>
        )}

        {/* STEP 3 — 채택 후: 카드 + 돌아오기 대기 + 행동 보고 */}
        {(step === 'acting' || step === 'return_observe' || step === 'return_probe') && state.card && (
          <Panel>
            <Label>남겨둔 결정</Label>
            {step === 'return_observe' || step === 'return_probe' ? (
              <p className="text-[14px] leading-relaxed text-[var(--text-secondary)]">
                {/* 관찰 전에는 질문과 기다리던 signal만 (§7.3) — 선택·이유는 잠겨 있습니다 */}
                <span className="font-medium text-[var(--text-primary,inherit)]">{engine.openReturn().question}</span>
                <br />기다리던 것: {engine.openReturn().awaitedSignal}
                <br /><span className="text-[12px] text-[var(--text-tertiary)]">그때의 선택과 이유는, 무슨 일이 있었는지 들은 다음에 열려요.</span>
              </p>
            ) : (
              <pre className="whitespace-pre-wrap text-[14px] leading-relaxed font-sans">{koDisplay(projectCard(state, 'web').text)}</pre>
            )}
          </Panel>
        )}

        {step === 'acting' && state.card && (
          <Panel>
            <Label>지금 — {STATE_LABELS[state.state]}</Label>
            {activeReturn ? (
              <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-3">
                다음 돌아보기: {RETURN_KIND_LABELS[activeReturn.contract.kind] ?? activeReturn.contract.kind}
                {activeReturn.contract.trigger.type === 'date' && ` · ${new Date(activeReturn.contract.trigger.date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}쯤`}
                {state.queuedReturns.length > 0 && ` (그 다음 ${state.queuedReturns.length}번 더)`}
              </p>
            ) : (
              <p className="text-[13px] text-[var(--text-secondary)] mb-3">예정된 돌아보기가 없습니다.</p>
            )}
            <div className="flex items-center justify-between">
              <Btn kind="ghost" onClick={() => { engine.reportAction('행동 시작 보고', now()); persist(); }}>행동을 시작했어요</Btn>
              {activeReturn && (
                <Btn onClick={() => setStep('return_observe')} disabled={false}>
                  {returnDue ? '지금 돌아보기' : '미리 돌아보기'}
                </Btn>
              )}
            </div>
          </Panel>
        )}

        {/* STEP 4 — RETURN: 관찰이 기록보다 먼저 */}
        {step === 'return_observe' && (
          <Panel tone="accent">
            <Label>먼저 — 실제로 무슨 일이 있었나요?</Label>
            <textarea
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="일어난 일을 그대로 적어 주세요 — 숫자, 사건, 들은 말. 잘했다/못했다 판단은 잠시 미뤄두세요."
              className="w-full resize-none rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-[var(--surface)] px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-[var(--accent)]/50"
            />
            <div className="mt-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
                <select aria-label="관찰 출처" value={obsKind} onChange={(e) => setObsKind(e.target.value as 'direct' | 'relayed')} className="rounded-md border border-black/[0.08] dark:border-white/[0.1] bg-[var(--surface)] px-2 py-1 text-[13px]">
                  <option value="direct">직접 봤어요</option>
                  <option value="relayed">전해 들었어요</option>
                </select>
              </label>
              <Btn onClick={submitObservation} disabled={!observation.trim()}>기록</Btn>
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
              <Label>이제 — 그때의 기록</Label>
              <pre className="whitespace-pre-wrap text-[14px] leading-relaxed font-sans">{koDisplay(projectCard(state, 'web').text)}</pre>
              {state.recallProbeAnswer && (
                <div className="mt-3 rounded-lg bg-[var(--accent)]/[0.06] px-4 py-3">
                  <Label>방금의 기억 vs 그때의 기록</Label>
                  <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">기억: {state.recallProbeAnswer}</p>
                  <p className="mt-1.5 text-[11px] text-[var(--text-tertiary)] leading-relaxed">
                    둘이 다르다면 — 그 차이가 이 도구가 존재하는 이유입니다. 결과를 알고 나면 누구나 이유를 다시 씁니다.
                  </p>
                </div>
              )}
              {state.observations.length > 0 && (
                <div className="mt-3">
                  <Label>실제로 일어난 일</Label>
                  {state.observations.map((o) => (
                    <p key={o.id} className="text-[13px] leading-relaxed text-[var(--text-secondary)]">{o.text}</p>
                  ))}
                </div>
              )}
            </Panel>
            <Panel>
              <Label>같이 돌아보기 — 순서대로 하나씩</Label>
              <ol className="list-decimal ml-4 space-y-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                <li>일어난 일은 그때의 어떤 가정에 답했나요? (해석은 당신의 몫입니다)</li>
                <li>그때 알 수 있던 것만 놓고 보면, 결정 과정은 충분했나요?</li>
                <li>운이나 환경 변화는 무엇이었나요?</li>
                {state.card.rationale.rejectedAlternative && (
                  <li>접어뒀던 대안({state.card.rationale.rejectedAlternative.alternative})에 대한 생각도 달라지나요?</li>
                )}
                <li>다음 비슷한 결정에서 기억할 것이 있다면 아래에 — 없으면 비워두세요. &lsquo;배운 것 없음&rsquo;도 정직한 답입니다.</li>
              </ol>
              <div className="mt-3 space-y-2">
                <input value={lessonText} onChange={(e) => setLessonText(e.target.value)} maxLength={300} placeholder="다음에 기억할 것 (선택) — 한 문장으로" className="w-full rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]/50" />
                {lessonText.trim() && (
                  <input value={lessonScope} onChange={(e) => setLessonScope(e.target.value)} maxLength={120} placeholder="어떤 결정에서만 유효한가요? (예: 출시 범위 결정)" className="w-full rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]/50" />
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <Btn onClick={closeReturn}>돌아보기 마치기{state.queuedReturns.length > 0 ? ' — 다음 확인이 예약됩니다' : ''}</Btn>
              </div>
            </Panel>
          </>
        )}

        {step === 'reviewed' && (
          <Panel tone="accent">
            <Label>한 바퀴 완주</Label>
            <p className="text-[15px] leading-relaxed">
              한 결정이 현실까지 다녀왔습니다. 그때의 생각, 실제로 일어난 일, 방금의 기억 — 전부 시간 순서 그대로 남아 있고, 아무것도 덮어쓰이지 않았습니다.
            </p>
            {state.lessons.length > 0 && (
              <div className="mt-3">
                <Label>다음에 기억할 것</Label>
                {state.lessons.map((l) => (
                  <p key={l.id} className="text-[13px] text-[var(--text-secondary)]">{l.text} <span className="text-[var(--text-tertiary)]">— {l.scope}</span></p>
                ))}
              </div>
            )}
          </Panel>
        )}

        {/* 엔지니어 패널 — 계기판은 여기에만. 기본은 접힘. */}
        <details className="group rounded-xl border border-black/[0.05] dark:border-white/[0.06] px-5 py-3">
          <summary className="cursor-pointer select-none text-[12px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]">
            엔지니어 패널 — 내부 상태·모델 연결 (일반 사용에는 필요 없습니다)
          </summary>
          <div className="mt-3 space-y-4 text-[12px] text-[var(--text-secondary)]">
            <p>
              ledger {engine.ledger.all().length} events · 내부 상태 {state.state}
              {activeReturn && ` · return ${activeReturn.contract.kind}`}
            </p>
            <div>
              <Label>컴파일된 prompt packet (L0–L6)</Label>
              <pre className="max-h-64 overflow-auto rounded-lg bg-black/[0.04] dark:bg-white/[0.05] p-3 text-[11px] leading-relaxed whitespace-pre-wrap">
                {engine.compilePacket('web', utterance || '(이번 턴 입력)', 'diagnose_and_propose')}
              </pre>
            </div>
            <div>
              <Label>모델 응답(ArgusTurn envelope JSON) 직접 반영</Label>
              <textarea
                value={envelopeJson}
                onChange={(e) => setEnvelopeJson(e.target.value)}
                maxLength={20000}
                rows={4}
                placeholder='위 packet을 모델에 주고 받은 envelope JSON을 붙여넣으세요 — {"phase":"understand", ...}'
                className="w-full resize-none rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-transparent px-3 py-2.5 font-mono text-[12px] outline-none focus:border-[var(--accent)]/50"
                disabled={step !== 'coach'}
              />
              {step !== 'coach' && <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">점검 단계에서만 반영할 수 있습니다.</p>}
              {pasteError && <p className="mt-2 text-[13px] text-amber-600 dark:text-amber-400">{pasteError}</p>}
              <div className="mt-2 flex justify-end">
                <Btn onClick={pasteEnvelope} disabled={step !== 'coach' || !envelopeJson.trim()}>검증하고 반영</Btn>
              </div>
            </div>
          </div>
        </details>

        {/* footer */}
        <footer className="flex items-center justify-end pt-2 text-[12px] text-[var(--text-tertiary)]">
          <span className="flex gap-3">
            <button type="button" onClick={exportJson} className="hover:text-[var(--text-secondary)]">기록 내려받기</button>
            <button type="button" onClick={resetAll} className="hover:text-[var(--text-secondary)]">전부 삭제</button>
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

function stepJourney(step: FlowStep): number {
  switch (step) {
    case 'listen':
    case 'baseline': return 0;
    case 'coach': return 1;
    case 'acting': return 2;
    case 'return_observe':
    case 'return_probe':
    case 'return_reveal': return 3;
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
