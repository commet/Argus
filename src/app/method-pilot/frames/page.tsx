'use client';

// 인지 구조 프레임 — Track R 파일럿 (BLUEPRINT §9.12 단일 예외 채널의 형제 라우트).
//
// 재정초 브리프(ARGUS-REFOUNDATION-BRIEF-2026-08-16)의 원형 E+B 를 일곱 축으로
// 일반화한 표면. 기존 /method-pilot 페이지는 손대지 않는다 — 그쪽은 R3-B 하네스
// 러너이고 여기는 인지 구조 기록이다. 초대 전용·비공개·폐기 전제는 동일.
//
// 이 화면의 규율 셋:
//   1. **판정하지 않는다.** 사람에 대한 점수·등급·성향 문장이 없다. 거울은
//      기록의 구조를 비추고, 문장의 주어는 항상 기록이다 (mirror.ts).
//   2. **두 세계를 다른 색으로 그린다.** 프레임 안 / 현실 접촉. 산문 불변식이
//      데이터에 없으면 화면은 둘을 같은 색으로 그린다 — 그래서 world 가 타입이다.
//   3. **공백을 메우지 않는다.** 빈 축은 비었다고 적는다. AI가 채우면 이 도구가
//      자기가 방어하려는 실패의 사례가 된다.
//   4. **사용자에게 일을 시키지 않는다.** 입력은 마찰 오름차순이고 기본값은
//      0클릭이다 — 플러그인이 이미 가져다 둔 것을 고르기만 한다. 파일을 직접
//      고르는 경로는 맨 아래 최후 수단이다 (2026-08-18 정정: 그걸 1차로 냈던
//      것은 이 저장소가 이미 가진 자동 수집보다 훨씬 나쁜 설계였다).
//      소스 목록·순서·빈 목록 문구는 전부 `cognition/sources.ts` 가 소유한다.
//      0클릭 경로의 실제 수집은 MIT 존이 한다 — 훅이 넘긴 경로가
//      `argus-mcp/src/v2/capture-cli.ts` → `queue.ts` → `harvest.ts` →
//      `candidate-capture.ts` 를 거쳐 민감정보 차단·인용 byte 대조를 통과한 뒤
//      `push-webapp.js` 로 `plugin_decisions` 에 도착한다. 이 화면은 그것을
//      **승인하는 자리**이지 수집하는 자리가 아니다. 읽기는 이미 있는
//      `usePluginStore` 를 쓴다 (전용 API 라우트를 새로 만들지 않는다).
//   5. **인트로에서 끝나지 않는다.** 봉인한 판단의 전제는 프레임 밖으로 나가
//      살아남고, 그 전제가 흔들리면 그것을 참조한 판단들이 한꺼번에 다시
//      올라온다. 이 되돌아오는 절반이 없으면 이 도구는 기록장일 뿐이다.
//
// 저자성 판정(`wording_source` 등)의 정본은 `src/lib/judgment-authorship.ts`
// 이고 `cognition/authorship.ts` 가 그것을 부른다 — 이 화면은 판정하지 않고
// 이미 판정된 것을 그리기만 한다.
//
// 판정 로직은 전부 src/lib/cognition/ 의 순수 엔진에 있다. 이 파일은 입력을
// 모아 엔진에 넘기고 결과를 그린다 — 화면에 판정을 두면 테스트가 닿지 못한다.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { STORAGE_KEYS, getStorage, setStorage } from '@/lib/storage';
import {
  AXES,
  acceptAsIs,
  addElement,
  blockMessage,
  corpusMirror,
  emptyFrame,
  evaluateRestatement,
  frameMirror,
  gateApplies,
  liveElements,
  makeElement,
  sealBlocks,
  sealFrame,
  settleFrame,
  extractCandidates,
  extractionSummary,
  isAiWorded,
  authorLine,
  SOURCES,
  DEFAULT_SOURCE,
  sourceSpec,
  sourceReport,
  turnsFromPluginCandidates,
  turnsFromPastedWriting,
  turnsFromTranscriptFile,
  type AxisId,
  type Candidate,
  type CognitiveFrame,
  type ExtractionResult,
  type FrameElement,
  type SourceId,
  type TranscriptTurn,
  makePremise,
  appendReading,
  referenceFrom,
  assessPremise,
  returnTriggers,
  premiseIdentityKey,
  watchBlocks,
  watchToBinding,
  watchToCusumPrior,
  watchToPortfolioPrior,
  readingFrom,
  watchStatus,
  type DurablePremise,
  type WatchSetup,
} from '@/lib/cognition';
import { usePluginStore } from '@/stores/usePluginStore';

const MAX_TEXT = 2000;
const MAX_TITLE = 200;

/** 축별 초안 상태 — 화면이 소유하는 유일한 것. */
interface AxisDraft {
  text: string;
  aiDraft: string;
  touched: boolean;
  rounds: number;
  restatement: string;
}

const emptyDraft = (): AxisDraft => ({ text: '', aiDraft: '', touched: false, rounds: 0, restatement: '' });

/**
 * 파일럿용 초안 문구. **모델을 부르지 않는다** — 이 화면의 목적은 저자성과
 * 이해를 측정하는 것이므로, 초안이 어디서 왔는지가 고정돼야 한다. 실제 제품에서
 * 이 자리는 LLM이 되고, 그때도 `aiDraft` 로 들어가 같은 게이트를 통과한다.
 */
const PILOT_DRAFTS: Partial<Record<AxisId, string>> = {
  premises: '이 판단은 현재 전환율이 유지된다는 것을 전제한다',
  falsifier: '4주 안에 전환율이 절반으로 떨어지면 이 판단은 틀렸다',
  inference: '전제가 유지되면 지금 속도로 목표에 닿는다',
  alternatives: '더 기다렸다가 신호를 더 모으는 길을 버렸다',
};

function loadPremises(): DurablePremise[] {
  const raw = getStorage<DurablePremise[]>(STORAGE_KEYS.COGNITIVE_PREMISES, []);
  return Array.isArray(raw) ? raw : [];
}

const emptyWatch = (): WatchSetup => ({ what: '', where: '', normal: '', wobble: '', broken: '', why: '' });

function loadFrames(): CognitiveFrame[] {
  // getStorage 가 파싱·fallback·손상 가드를 이미 한다 — 여기서 다시 JSON.parse 하면
  // 그 가드를 우회하는 두 번째 경로가 생긴다.
  const parsed = getStorage<CognitiveFrame[]>(STORAGE_KEYS.COGNITIVE_FRAMES, []);
  return Array.isArray(parsed) ? parsed : [];
}

const WORLD_LABEL: Record<FrameElement['world'], string> = {
  in_frame: '아직 안 맞춰봄',
  reality_contact: '맞춰봄',
};

const COMPREHENSION_LABEL: Record<FrameElement['comprehension']['state'], string> = {
  own_words: '내 말로 씀',
  echo: 'AI 문장과 거의 같음',
  absent: '아직 AI 문장 그대로',
  not_required: '',
};

export default function CognitiveFramesPilot() {
  const [frames, setFrames] = useState<CognitiveFrame[]>([]);
  const [title, setTitle] = useState('');
  const [drafts, setDrafts] = useState<Record<string, AxisDraft>>({});
  const [notice, setNotice] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [reading, setReading] = useState(false);
  /** 지금 보고 있는 입력 경로. 기본값은 마찰 0 — 목록 순서에서 파생한다. */
  const [source, setSource] = useState<SourceId>(DEFAULT_SOURCE);
  const [sourceLines, setSourceLines] = useState<string[]>([]);
  const [pasted, setPasted] = useState('');
  /** 프레임 밖에 사는 전제들. 여러 판단이 같은 전제를 참조한다. */
  const [premises, setPremises] = useState<DurablePremise[]>([]);
  /** 감시 설정 중인 전제 id → 사람이 답하는 다섯 칸. */
  const [watchDraft, setWatchDraft] = useState<Record<string, WatchSetup>>({});
  /** 오늘 본 값 입력 (전제 id → 값). */
  const [readingDraft, setReadingDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setFrames(loadFrames());
    setPremises(loadPremises());
    setHydrated(true);
  }, []);

  // 0클릭의 뜻은 **누르지 않아도 와 있다**는 것이다. 탭을 눌러야 뜨면 그건 1클릭이다.
  // 실패해도 화면은 산다 — loadAuto 가 예외를 밖으로 내보내지 않는다.
  useEffect(() => {
    void loadAuto();
    // 최초 1회. loadAuto 는 ingest 에만 의존하고 ingest 는 안정적이다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback((next: CognitiveFrame[]) => {
    setFrames(next);
    setStorage(STORAGE_KEYS.COGNITIVE_FRAMES, next);
  }, []);

  const persistPremises = useCallback((next: DurablePremise[]) => {
    setPremises(next);
    setStorage(STORAGE_KEYS.COGNITIVE_PREMISES, next);
  }, []);

  const draftFor = useCallback((axis: AxisId): AxisDraft => drafts[axis] ?? emptyDraft(), [drafts]);

  const setDraft = useCallback((axis: AxisId, patch: Partial<AxisDraft>) => {
    setDrafts((prev) => ({ ...prev, [axis]: { ...(prev[axis] ?? emptyDraft()), ...patch } }));
  }, []);

  /**
   * 턴이 어디서 왔든 여기 한 곳으로 모인다.
   *
   * **자동으로 칸에 넣지 않는다** — 사람이 고른다. 넣는 순간 사용자의 판단이
   * 기계가 고른 문장으로 대체되기 때문이다. 0건이어도 결과를 세팅한다:
   * 빈 목록을 말없이 보여주는 대신 "못 찾았습니다"를 그릴 수 있어야 한다.
   */
  const ingest = useCallback((id: SourceId, turns: TranscriptTurn[]) => {
    setSource(id);
    setSourceLines(sourceReport(id, turns));
    setExtraction(turns.length === 0 ? null : extractCandidates(turns, { perAxis: 4 }));
  }, []);

  /** 0클릭 경로 — 플러그인이 이미 가져다 둔 것. 실패해도 화면은 산다. */
  const loadAuto = useCallback(async () => {
    setReading(true);
    try {
      await usePluginStore.getState().loadData();
      const { decisions, loadError } = usePluginStore.getState();
      if (loadError) {
        setSource('plugin_auto');
        setSourceLines([
          '플러그인이 가져다 둔 것을 불러오지 못했습니다 (로그인 안 됐거나 연결이 끊겼습니다).',
          '아래에 직접 붙여넣어도 됩니다.',
        ]);
        setExtraction(null);
        return;
      }
      ingest(
        'plugin_auto',
        turnsFromPluginCandidates(
          decisions.filter((d) => d.status === 'candidate' || d.status === 'sealed'),
        ),
      );
    } finally {
      setReading(false);
    }
  }, [ingest]);

  /** 1클릭 경로 — 자기가 쓴 것. 설치도 로그인도 필요 없다. */
  const loadPaste = useCallback(() => {
    ingest('paste', turnsFromPastedWriting(pasted, new Date().toISOString()));
  }, [ingest, pasted]);

  /** 최후 수단 — 세션 파일 직접. 여기만 사람·AI 턴이 다 와서 인용 대조가 된다. */
  const loadFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setReading(true);
      try {
        ingest('file', turnsFromTranscriptFile(await file.text(), { maxTurns: 20000 }));
      } catch {
        setSource('file');
        setSourceLines(['이 파일을 읽지 못했습니다. Claude Code 세션의 .jsonl 파일이 맞는지 확인해 주세요.']);
        setExtraction(null);
      } finally {
        setReading(false);
      }
    },
    [ingest],
  );

  /**
   * 후보를 칸에 넣는다. 저자는 **로그가 증명한다** — 사람 턴이면 사용자 문장이라
   * 초안 없이(aiDraft='') 넣고, AI 턴이거나 AI 인용이면 그 문장을 초안으로 넣어
   * 손대지 않으면 AI 문장으로 남게 한다.
   */
  const applyCandidate = useCallback(
    (c: Candidate) => {
      // isAiWorded 를 쓴다 — quoted_from_ai 는 세 값이라 그냥 조건문에 넣으면
      // 'no' 도 참이 되어 모든 후보가 AI 문장이 된다.
      const fromAi = isAiWorded(c);
      setDraft(c.axis, {
        text: c.text,
        aiDraft: fromAi ? c.text : '',
        touched: false,
        rounds: 0,
        restatement: '',
      });
    },
    [setDraft],
  );

  /** 초안을 불러온다 — 그대로 확정하면 기계 문장으로 기록된다. */
  const applyPilotDraft = useCallback(
    (axis: AxisId) => {
      const d = PILOT_DRAFTS[axis];
      if (!d) return;
      setDraft(axis, { text: d, aiDraft: d, touched: false, rounds: 0 });
    },
    [setDraft],
  );

  /** 현재 초안들로 프레임을 조립한다 (봉인 전 미리보기 겸 검사용). */
  const assembled = useMemo(() => {
    const now = 0; // 결정론: 조립 미리보기는 시각에 의존하지 않는다.
    let f = emptyFrame({ id: 'draft', userId: null, title, now });
    for (const spec of AXES) {
      const d = draftFor(spec.id);
      if (!d.text.trim()) continue;
      f = addElement(
        f,
        makeElement({
          id: `draft-${spec.id}`,
          axis: spec.id,
          text: d.text,
          aiDraft: d.aiDraft,
          touched: d.touched,
          revisionRounds: d.rounds,
          restatement: d.restatement,
          now,
        }),
        now,
      );
    }
    return f;
  }, [title, draftFor]);

  const blocks = useMemo(() => sealBlocks(assembled), [assembled]);
  const mirror = useMemo(() => frameMirror(assembled), [assembled]);
  const corpus = useMemo(() => corpusMirror(frames), [frames]);

  const onSeal = useCallback(() => {
    const now = Date.now();
    const id = `frame_${now.toString(36)}`;
    let f = emptyFrame({ id, userId: null, title, now });
    for (const spec of AXES) {
      const d = draftFor(spec.id);
      if (!d.text.trim()) continue;
      f = addElement(
        f,
        makeElement({
          id: `${id}_${spec.id}`,
          axis: spec.id,
          text: d.text,
          aiDraft: d.aiDraft,
          touched: d.touched,
          revisionRounds: d.rounds,
          restatement: d.restatement,
          now,
        }),
        now,
      );
    }
    const res = sealFrame({ frame: f, now });
    if (!res.ok) {
      setNotice(res.messages);
      return;
    }
    setNotice([]);
    setTitle('');
    setDrafts({});
    persist([res.frame, ...frames]);

    // 봉인한 판단의 전제를 **프레임 밖으로** 꺼낸다. 이게 있어야 같은 전제를
    // 쓴 다른 판단이 무엇인지 알 수 있고, 그 전제가 흔들렸을 때 그것들이
    // 한꺼번에 깨어난다. 같은 문장인지의 판정은 premises-core 의 정규화를
    // 그대로 쓴다 — 두 곳이 갈라지면 이 연결이 조용히 끊긴다.
    let nextPremises = premises;
    for (const el of res.frame.elements) {
      if (el.axis !== 'premises' || !el.text.trim()) continue;
      const key = premiseIdentityKey(el.text);
      const existing = nextPremises.find((x) => premiseIdentityKey(x.text) === key);
      if (existing) {
        nextPremises = nextPremises.map((x) =>
          x.id === existing.id ? referenceFrom(x, res.frame.id, now) : x,
        );
      } else {
        nextPremises = [
          referenceFrom(
            makePremise({ id: `premise_${now.toString(36)}_${el.id}`, userId: null, text: el.text, now }),
            res.frame.id,
            now,
          ),
          ...nextPremises,
        ];
      }
    }
    persistPremises(nextPremises);
  }, [title, draftFor, frames, persist, premises, persistPremises]);

  /**
   * 이 전제의 감시 설정. 편집 중이면 그 초안, 아니면 이미 걸린 감시에서 되살린다.
   * 되살리지 않으면 새로고침 후 판독을 남길 수 없다 — 저장은 됐는데 이어서
   * 못 쓰는 것이 이 저장소가 반복해서 겪은 조용한 실패다.
   */
  const watchFor = useCallback(
    (p: DurablePremise): WatchSetup => {
      const draft = watchDraft[p.id];
      if (draft) return draft;
      const b = p.bindings[0];
      if (!b) return emptyWatch();
      return { what: b.kind, where: b.target, normal: '', wobble: '', broken: '', why: b.threshold_rationale };
    },
    [watchDraft],
  );

  /** 감시를 건다 — 사람이 답한 다섯 칸이 전부 통과했을 때만. */
  const onArmWatch = useCallback(
    (premiseId: string) => {
      const w = watchDraft[premiseId];
      if (!w || watchBlocks(w).length > 0) return;
      const now = Date.now();
      persistPremises(
        premises.map((p) =>
          p.id !== premiseId
            ? p
            : {
                ...p,
                bindings: [watchToBinding(w)],
                cusum_prior: watchToCusumPrior(w),
                portfolio_prior: watchToPortfolioPrior(w),
                updated_at: new Date(now).toISOString(),
              },
        ),
      );
      setWatchDraft((prev) => ({ ...prev, [premiseId]: w }));
    },
    [watchDraft, premises, persistPremises],
  );

  /** 오늘 본 값을 원장에 append 한다. 덮어쓰지 않는다. */
  const onAddReading = useCallback(
    (premiseId: string) => {
      const p = premises.find((x) => x.id === premiseId);
      if (!p) return;
      const w = watchFor(p);
      const now = Date.now();
      persistPremises(
        premises.map((x) =>
          x.id !== premiseId
            ? x
            : appendReading(
                x,
                readingFrom(w, {
                  value: readingDraft[premiseId] ?? '',
                  unreadReason: '값을 적지 않았습니다.',
                  observedAt: new Date(now).toISOString(),
                }),
                now,
              ),
        ),
      );
      setReadingDraft((prev) => ({ ...prev, [premiseId]: '' }));
    },
    [premises, watchFor, readingDraft, persistPremises],
  );

  const onSettle = useCallback(
    (frameId: string, observed: boolean) => {
      const now = Date.now();
      const next = frames.map((f) => {
        if (f.id !== frameId || f.status !== 'sealed') return f;
        return settleFrame({
          frame: f,
          settlement: {
            falsifier_observed: observed,
            observed: observed ? '반증 조건이 관찰됐다' : '반증 조건이 관찰되지 않았다',
            evidence_ref: `pilot:settle:${frameId}`,
            observed_at: new Date(now).toISOString(),
            retrospective: '',
          },
          now,
        });
      });
      persist(next);
    },
    [frames, persist],
  );

  /**
   * 흔들린 전제가 깨우는 판단들. **엔진이 정하고 화면은 그리기만 한다** —
   * 여기에 조건을 더 얹으면 테스트가 닿지 못하는 판정이 화면에 생긴다.
   */
  const triggers = useMemo(() => returnTriggers(premises, frames), [premises, frames]);

  if (!hydrated) return <main className="mx-auto max-w-3xl px-5 py-10 text-sm opacity-60">불러오는 중…</main>;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-wider opacity-50">시험판</p>
        <h1 className="mt-1 text-2xl font-semibold">지금 내린 결정, 적어두기</h1>
        <p className="mt-3 text-sm leading-relaxed opacity-70">
          나중에 &ldquo;내가 그때 왜 이렇게 했더라&rdquo; 할 때 꺼내보려고 적는 겁니다. 빈칸은 비워둬도 됩니다 —
          AI가 대신 채우지 않습니다.
        </p>
      </header>

      {/* 두 상태 안내 — 좋고 나쁨이 아니라 어디쯤 와 있는지 */}
      <section className="mb-8 rounded-lg bg-[var(--accent)]/[0.04] px-4 py-3">
        <p className="text-sm leading-relaxed">
          문장 옆에 <strong>아직 안 맞춰봄</strong> 또는 <strong>맞춰봄</strong>이 붙습니다. 머릿속에서 말이 되는
          것과 실제로 숫자·결과로 확인된 것은 다르니까요. 확인했다고 그냥 표시할 수는 없고, 실제 결과가 있어야
          바뀝니다.
        </p>
      </section>

      {/* 어디서 가져올까 — 마찰 오름차순, 기본은 0클릭 */}
      <section className="mb-8 rounded-lg border border-[var(--border)] px-4 py-4">
        <h2 className="text-sm font-semibold">문장 가져오기</h2>
        <p className="mt-1 text-xs leading-relaxed opacity-65">
          결정으로 보이는 문장을 찾아 보여줍니다. 문장은 <strong>그대로</strong> 가져오고 요약하거나 다듬지
          않습니다. 자동으로 칸을 채우지도 않습니다 — 맞는 것만 골라 넣으세요.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {SOURCES.map((sp) => (
            <button
              key={sp.id}
              type="button"
              onClick={() => {
                setSource(sp.id);
                setSourceLines([]);
                setExtraction(null);
                if (sp.id === 'plugin_auto') void loadAuto();
              }}
              className={`rounded-full px-3 py-1 text-xs ${
                source === sp.id
                  ? 'bg-[var(--accent)]/[0.12] font-medium'
                  : 'bg-[var(--accent)]/[0.04] opacity-70'
              }`}
            >
              {sp.label}
              {sp.clicks === 0 && <span className="ml-1 opacity-60">· 할 일 없음</span>}
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs leading-relaxed opacity-65">{sourceSpec(source).arrives}</p>

        {source === 'plugin_auto' && (
          <button
            type="button"
            onClick={() => void loadAuto()}
            className="mt-3 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs"
          >
            다시 확인하기
          </button>
        )}

        {source === 'paste' && (
          <>
            <textarea
              value={pasted}
              maxLength={20000}
              onChange={(e) => setPasted(e.target.value)}
              rows={5}
              placeholder="그 결정에 대해 자기가 쓴 글을 그대로 붙여넣으세요."
              className="mt-3 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-xs leading-relaxed"
            />
            <button
              type="button"
              onClick={loadPaste}
              disabled={pasted.trim().length === 0}
              className="mt-2 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-40"
            >
              여기서 찾기
            </button>
          </>
        )}

        {source === 'file' && (
          <input
            type="file"
            accept=".jsonl,application/json,text/plain"
            onChange={(e) => void loadFile(e.target.files?.[0])}
            className="mt-3 block w-full text-xs"
          />
        )}

        {reading && <p className="mt-2 text-xs opacity-60">읽는 중…</p>}

        {/* 0건도 한 줄을 받는다 — 빈 목록을 말없이 보여주지 않는다. */}
        {sourceLines.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs opacity-75">
            {sourceLines.map((line, i) => (
              <li key={i}>· {line}</li>
            ))}
          </ul>
        )}
        {extraction && (
          <ul className="mt-1 space-y-1 text-xs opacity-75">
            {extractionSummary(extraction).map((line, i) => (
              <li key={i}>· {line}</li>
            ))}
          </ul>
        )}
      </section>

      <label className="block text-sm font-medium" htmlFor="frame-title">
        무슨 결정인가요
      </label>
      <input
        id="frame-title"
        value={title}
        maxLength={MAX_TITLE}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="예: 채용을 한 분기 미룬다"
        className="mt-2 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
      />

      <div className="mt-8 space-y-6">
        {AXES.map((spec) => {
          const d = draftFor(spec.id);
          const el = liveElements(assembled).find((e) => e.axis === spec.id);
          const needsRestatement = el ? gateApplies(spec.id, el.authorship) : false;
          const comp = el && needsRestatement
            ? evaluateRestatement({
                axis: spec.id,
                authorship: el.authorship,
                sourceText: el.text,
                restatement: d.restatement,
              })
            : null;

          return (
            <section key={spec.id} className="rounded-lg border border-[var(--border)] px-4 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold">{spec.label}</h2>
                <span className="text-xs opacity-50">
                  {spec.optionalForSeal ? '선택' : '필수'}
                  {spec.authority === 'human_only' ? ' · 사람만' : ''}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed opacity-60">{spec.prompt}</p>

              <textarea
                value={d.text}
                maxLength={MAX_TEXT}
                rows={2}
                onChange={(e) =>
                  setDraft(spec.id, {
                    text: e.target.value,
                    touched: true,
                    rounds: d.touched ? d.rounds + 1 : 1,
                  })
                }
                className="mt-3 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
              />

              {extraction && (
                <div className="mt-3">
                  {extraction.byAxis[spec.id].length === 0 ? (
                    <p className="text-xs opacity-55">대화에서 못 찾았습니다 — 직접 써주세요.</p>
                  ) : (
                    <ul className="space-y-2">
                      {extraction.byAxis[spec.id].map((c) => (
                        <li key={c.turn_id + c.text.slice(0, 12)}>
                          <button
                            type="button"
                            onClick={() => applyCandidate(c)}
                            className="w-full rounded-lg bg-[var(--accent)]/[0.04] px-3 py-2 text-left text-xs leading-relaxed"
                          >
                            <span className="opacity-90">{c.text}</span>
                            <span className="mt-1 block opacity-50">
                              {authorLine(c)}
                              {' · '}
                              {c.at.slice(5, 16).replace('T', ' ')}
                              {' · '}
                              {c.why}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {PILOT_DRAFTS[spec.id] && spec.authority !== 'human_only' && (
                <button
                  type="button"
                  onClick={() => applyPilotDraft(spec.id)}
                  className="mt-2 rounded-md bg-[var(--accent)]/[0.08] px-3 py-1.5 text-xs"
                >
                  AI 예시 넣기 (안 고치면 AI 문장으로 남습니다)
                </button>
              )}

              {el && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-70">
                  <span>
                    {el.authorship.wording_source === 'ai_surfaced'
                      ? 'AI가 쓴 문장'
                      : el.authorship.wording_source === 'user_reworded'
                        ? 'AI 문장을 고쳐 씀'
                        : '내가 쓴 문장'}
                  </span>
                  <span>{WORLD_LABEL[el.world]}</span>
                  {COMPREHENSION_LABEL[el.comprehension.state] && (
                    <span>{COMPREHENSION_LABEL[el.comprehension.state]}</span>
                  )}
                </div>
              )}

              {needsRestatement && (
                <div className="mt-3 rounded-lg bg-[var(--accent)]/[0.04] px-3 py-3">
                  <p className="text-xs leading-relaxed">
                    이건 AI가 쓴 문장입니다. <strong>무슨 뜻인지 한 줄로 다시 써보시겠어요?</strong> 쓰다 보면
                    &ldquo;어, 이게 말이 되나&rdquo; 싶은 데가 보일 때가 있습니다.
                  </p>
                  <textarea
                    value={d.restatement}
                    maxLength={MAX_TEXT}
                    rows={2}
                    onChange={(e) => setDraft(spec.id, { restatement: e.target.value })}
                    placeholder="쉽게 말하면…"
                    className="mt-2 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setDraft(spec.id, { restatement: acceptAsIs(d.text).restatement })}
                      className="rounded-md bg-[var(--accent)]/[0.08] px-3 py-1.5 text-xs"
                    >
                      그냥 이대로 쓸게요
                    </button>
                    {comp && comp.state !== 'not_required' && (
                      <span className="text-xs opacity-60">
                        {COMPREHENSION_LABEL[comp.state]} — AI 문장과 낱말이 {Math.round(comp.overlap * 100)}%
                        겹칩니다 ({Math.round(comp.echo_threshold * 100)}% 넘으면 &lsquo;거의 같음&rsquo;)
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* 거울 — 주어는 항상 기록이다 */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold">지금 이 기록은</h2>
        <ul className="mt-3 space-y-2">
          {mirror.sentences.map((s, i) => (
            <li key={i} className="rounded-lg bg-[var(--accent)]/[0.04] px-4 py-3 text-sm leading-relaxed">
              {s}
            </li>
          ))}
        </ul>
      </section>

      {blocks.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold">저장하기 전에 남은 것</h2>
          <ul className="mt-2 space-y-1 text-sm opacity-80">
            {blocks.map((b, i) => (
              <li key={i}>· {blockMessage(b)}</li>
            ))}
          </ul>
        </section>
      )}

      {notice.length > 0 && (
        <section className="mt-6 rounded-lg bg-[var(--accent)]/[0.06] px-4 py-3">
          <ul className="space-y-1 text-sm">
            {notice.map((m, i) => (
              <li key={i}>· {m}</li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={onSeal}
        disabled={blocks.length > 0 || !title.trim()}
        className="mt-6 w-full rounded-md bg-[var(--accent)] px-4 py-3 text-sm font-medium text-[var(--accent-fg,#fff)] disabled:opacity-40"
      >
        봉인하기
      </button>
      <p className="mt-2 text-xs leading-relaxed opacity-55">
        잠그면 문장이 더 이상 바뀌지 않습니다. 나중에 생각이 바뀌면 새로 적으면 됩니다. 지금 쓴 말을 그대로 남겨두는
        게 나중에 자기를 속이지 않는 유일한 방법이라서요.
      </p>

      {/* 지금 흔들린 것 — 이 도구가 인트로에서 끝나지 않는 이유 */}
      {triggers.length > 0 && (
        <section className="mt-10 rounded-lg bg-[var(--accent)]/[0.06] px-4 py-4">
          <h2 className="text-sm font-semibold">지금 흔들린 것</h2>
          <p className="mt-1 text-xs leading-relaxed opacity-70">
            아래 전제가 흔들렸습니다. 이 전제 위에 세운 판단들이 그래서 다시 올라왔습니다. 고치라는 말이 아니라,
            지금 다시 볼지는 직접 정하시라는 뜻입니다.
          </p>
          <ul className="mt-3 space-y-3">
            {triggers.map((t) => (
              <li key={t.premise_id} className="text-xs leading-relaxed">
                <p className="font-medium">{t.premise_text}</p>
                <p className="mt-0.5 opacity-70">{t.reason}</p>
                <p className="mt-1 opacity-80">
                  다시 볼 판단 {t.wake_frame_ids.length}개
                  {t.wake_frame_ids.length > 0 && (
                    <>
                      {': '}
                      {t.wake_frame_ids
                        .map((id) => frames.find((f) => f.id === id)?.title || id)
                        .join(' · ')}
                    </>
                  )}
                </p>
                {t.already_settled_ids.length > 0 && (
                  <p className="mt-0.5 opacity-55">
                    이미 결과를 적은 판단 {t.already_settled_ids.length}개는 깨우지 않았습니다.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 지켜보는 것 — 전제를 현실에 묶는 자리 */}
      {premises.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold">지켜보는 것 {premises.length}개</h2>
          <p className="mt-1 text-xs leading-relaxed opacity-65">
            봉인한 판단에서 꺼낸 전제들입니다. 무엇을 보면 이 전제가 깨진 걸 알 수 있는지 정해두면, 그 숫자가
            움직였을 때 이 전제 위에 세운 판단들이 다시 올라옵니다. 정하지 않으면 아무 일도 일어나지 않습니다 —
            저희가 대신 기준을 정하지는 않습니다.
          </p>

          <ul className="mt-4 space-y-4">
            {premises.map((p) => {
              const w = watchFor(p);
              const armed = !!p.cusum_prior;
              const blocks = watchBlocks(w);
              const a = assessPremise(p);
              return (
                <li key={p.id} className="rounded-lg border border-[var(--border)] px-4 py-3">
                  <p className="text-xs font-medium leading-relaxed">{p.text}</p>
                  <p className="mt-1 text-xs opacity-55">
                    이 전제를 쓴 판단 {p.referenced_by.length}개 · {watchStatus(p.readings.length)}
                  </p>

                  {armed ? (
                    <>
                      <p className="mt-2 rounded-lg bg-[var(--accent)]/[0.04] px-3 py-2 text-xs leading-relaxed opacity-80">
                        {a.statement}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <input
                          value={readingDraft[p.id] ?? ''}
                          maxLength={200}
                          onChange={(e) => setReadingDraft((prev) => ({ ...prev, [p.id]: e.target.value }))}
                          placeholder={`오늘 ${p.bindings[0]?.kind || '그 숫자'}는 얼마였나요`}
                          className="flex-1 rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => onAddReading(p.id)}
                          className="rounded-md border border-[var(--border)] px-3 py-2 text-xs"
                        >
                          적기
                        </button>
                      </div>
                      <p className="mt-1 text-xs opacity-50">
                        못 봤으면 비워둔 채로 눌러주세요. 안 본 것을 본 것처럼 적지 않습니다.
                      </p>
                    </>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {(
                        [
                          ['what', '무엇을 보면 되나요', '예: 전환율'],
                          ['where', '어디서 보나요', '예: 대시보드 A'],
                          ['normal', '평소엔 얼마인가요', '예: 3%'],
                          ['wobble', '평소에도 이만큼은 왔다갔다 해요', '예: 0.2%p'],
                          ['broken', '얼마가 되면 이 전제가 틀린 건가요', '예: 2%'],
                          ['why', '왜 그 값인가요', '예: 그 아래면 광고비가 안 빠집니다'],
                        ] as const
                      ).map(([field, label, ph]) => (
                        <label key={field} className="block text-xs">
                          <span className="opacity-70">{label}</span>
                          <input
                            value={w[field]}
                            maxLength={MAX_TEXT}
                            onChange={(e) =>
                              setWatchDraft((prev) => ({
                                ...prev,
                                [p.id]: { ...(prev[p.id] ?? emptyWatch()), [field]: e.target.value },
                              }))
                            }
                            placeholder={ph}
                            className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-1.5"
                          />
                        </label>
                      ))}
                      {blocks.length > 0 && (
                        <ul className="space-y-1 text-xs opacity-70">
                          {blocks.map((b, i) => (
                            <li key={i}>· {b}</li>
                          ))}
                        </ul>
                      )}
                      <button
                        type="button"
                        onClick={() => onArmWatch(p.id)}
                        disabled={blocks.length > 0}
                        className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs disabled:opacity-40"
                      >
                        지켜보기 시작
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {frames.length > 0 && (
        <section className="mt-12">
          <h2 className="text-sm font-semibold">적어둔 결정 {frames.length}개</h2>
          <ul className="mt-3 space-y-3">
            {corpus.sentences.map((s, i) => (
              <li key={`c${i}`} className="rounded-lg bg-[var(--accent)]/[0.04] px-4 py-3 text-sm leading-relaxed">
                {s}
              </li>
            ))}
          </ul>

          <ul className="mt-5 space-y-3">
            {frames.map((f) => {
              const m = frameMirror(f);
              return (
                <li key={f.id} className="rounded-lg border border-[var(--border)] px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{f.title || '(제목 없음)'}</span>
                    <span className="text-xs opacity-50">
                      {f.status === 'settled' ? '결과 확인함' : '잠김'} · 맞춰본 문장 {m.world.reality_contact}/{m.world.total}
                    </span>
                  </div>
                  {f.status === 'sealed' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => onSettle(f.id, false)}
                        className="rounded-md bg-[var(--accent)]/[0.08] px-3 py-1.5 text-xs"
                      >
                        예상대로 안 됐다 (내 판단이 맞았다)
                      </button>
                      <button
                        type="button"
                        onClick={() => onSettle(f.id, true)}
                        className="rounded-md bg-[var(--accent)]/[0.08] px-3 py-1.5 text-xs"
                      >
                        그 일이 실제로 일어났다 (내가 틀렸다)
                      </button>
                    </div>
                  )}
                  {f.settlement && (
                    <p className="mt-2 text-xs leading-relaxed opacity-70">
                      확인: {f.settlement.observed} · 그때 쓴 문장은 그대로입니다.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <footer className="mt-16 text-xs leading-relaxed opacity-45">
        <p>
          이 화면은 당신에 대한 점수를 만들지 않습니다. 비추는 것은 기록의 구조이고, 그것이 무엇을 뜻하는지는 당신이
          해석합니다. 축마다 기계에게 허용된 권한이 다르며(
          {AXES.filter((a) => a.authority === 'human_only').map((a) => a.label).join(' · ')} 은 사람만 씁니다), 근거는
          <code className="mx-1">src/lib/cognition/axes.ts</code>에 문헌과 함께 적혀 있습니다.
        </p>
      </footer>
    </main>
  );
}
