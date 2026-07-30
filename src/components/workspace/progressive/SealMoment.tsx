'use client';

/**
 * SealMoment — the voyage's closing scene (W1.1 봉인 종막).
 *
 * This is the LAST interaction of a completed voyage: a standalone, screen-
 * transition-grade question that asks, in the plugin's own voice, whether to
 * come back later and see how the decision actually turned out.
 *
 *   "이 결정, {날짜}에 어떻게 됐는지 물어봐 드릴까요?"
 *
 * Constitution (internal design notes §0):
 *  - "물어봐 줄까요?" 화법 only. The surface NEVER says 내기 / predicate / 반증.
 *    The internal schema (predicate / falsified_if / check_by) is untouched —
 *    only the words the user sees change.
 *  - Accept = 1 tap (the bet draft is auto-derived; an editable drawer lets the
 *    user adjust the date or trim predictions, but is never required).
 *  - Reject = 1 tap, lossless — every artifact above stays fully accessible.
 *  - Silence is output (P3): with nothing falsifiable to predict, renders null.
 *
 * State machine (derived, never stored):
 *   no contract + has predicates → ASK     (the standalone question)
 *   just sealed this session     → SEALED  (calm confirmation + edit drawer)
 *   contract exists (reload/due) → delegate to <DecisionContractCard> so the
 *                                  WAITING / GRADE / VERIFIED loop has a single
 *                                  source of truth (no duplicated grading UI).
 *
 * All user/LLM text renders through JSX → React auto-escapes (no XSS). The
 * contract is read defensively so legacy localStorage sessions never crash.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Anchor, CalendarPlus, Check, ChevronDown, Target, AlertTriangle, GitBranch, Image as ImageIcon } from 'lucide-react';
import { ArgusMascot } from '@/components/brand/ArgusMascot';
import { useLocale } from '@/hooks/useLocale';
import { useAuth } from '@/lib/auth';
import { useProjectStore } from '@/stores/useProjectStore';
import type { Project, Predicate, PredicateSource, CheckInInterval, OpenCheck, DecisionKind } from '@/stores/types';
import { deriveDecisionKind } from '@/lib/decision-kernel';
import {
  contractFromPredicates,
  withCheckIn,
  withoutReturn,
  withDecisionFoundation,
  augmentContract,
  adoptionLineageForSeal,
  shouldSealContract,
  buildEarlyContract,
  CHECK_IN_MS,
  DEFAULT_CHECK_IN_INTERVAL,
  intervalFromExistingContract,
  stablePredicateId,
  webUserAttribution,
  MAX_PREDICATES,
} from '@/lib/decision-contract';
import { buildJudgmentCard } from '@/lib/judgment-card';
import { closingJudgmentAuthorship } from '@/lib/judgment-authorship';
import { derivePrimaryCheckpoint } from '@/lib/checkpoint-core';
import { buildAutoTrackedPremiseItems } from '@/lib/auto-track-premises';
import { sameClaim } from '@/lib/premise-shape';
import { useDecisionItemsStore } from '@/stores/useDecisionItemsStore';
import { useProgressiveStore } from '@/stores/useProgressiveStore';
import { recordSignal } from '@/lib/signal-recorder';
import { syncSealToTelegram } from '@/lib/telegram-sync';
import { withLocale } from '@/lib/locale-path';
import { track } from '@/lib/analytics';
import { getStorage, setStorage, STORAGE_KEYS } from '@/lib/storage';
import { DecisionContractCard } from '@/components/projects/DecisionContractCard';
import { JudgmentAttributionLine } from '@/components/projects/JudgmentAttributionLine';
import { JudgmentReceipt, deriveReceiptFields } from '@/components/projects/JudgmentReceipt';
import { RetroBadge } from '@/components/projects/RetroBadge';
import { SealStamp } from './SealStamp';
import { Graticule } from '@/components/ui/VoyageElements';
import { EASE } from './shared/constants';

const SOURCE_ICON: Record<PredicateSource, typeof Target> = {
  governing_idea: Target,
  user_lean: Target,
  risk: AlertTriangle,
  actor: GitBranch,
};

const INTERVALS: { value: CheckInInterval; ko: string; en: string }[] = [
  // '3d' is a PURE EQUAL option (베팅③ 1-B): a short check-in for decisions whose
  // answer lands in a day or two, so a first sealer who'd otherwise wait 2 weeks
  // (and maybe never return) can taste the settle sooner. No nudge, no urgency
  // copy, no default preselection — it's just another neutral date chip. Far
  // horizons keep 2w/1m; nothing is artificially shortened (no fake settlement).
  { value: '1d', ko: '1일 뒤', en: 'tomorrow' },
  { value: '3d', ko: '3일 뒤', en: 'in 3 days' },
  { value: '1w', ko: '1주 뒤', en: 'in 1 week' },
  { value: '2w', ko: '2주 뒤', en: 'in 2 weeks' },
  { value: '1m', ko: '1달 뒤', en: 'in 1 month' },
];

/** [활성화 계측 · 항목10] first_real_seal_after_retro — fires exactly once, on
 *  the user's first REAL (blind) seal AFTER a retro practice loop was settled.
 *  Consumes the RETRO_SETTLED flag (set by SettlementModal when a retro loop
 *  closes) so this can never double-fire. Every seal reaching SealMoment is a
 *  real seal (retro contracts are built by RetroSeal, never through this path),
 *  so there's no retro-vs-real ambiguity here. Silent no-op when no retro was
 *  ever settled — the normal seal is unaffected. */
function fireFirstRealSealAfterRetro() {
  if (!getStorage(STORAGE_KEYS.RETRO_SETTLED, false)) return;
  setStorage(STORAGE_KEYS.RETRO_SETTLED, false);
  track('first_real_seal_after_retro', {});
}

/** RFC 5545 TEXT escaping — commas/semicolons/backslashes/newlines. */
function icsEscape(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function SealMoment({
  project,
  predicates,
  gate,
  closing = false,
  openChecks = [],
}: {
  project: Project;
  /** Falsifiable predictions derived from this voyage (live path). */
  predicates: Predicate[];
  /** loop-17 B — unverified facts (world_fact + source) to carry into the contract
   *  so settle can ask "did you check it?". Auto-carried; the user can drop any before
   *  sealing (founder setting). Empty when the scan found nothing carriable. */
  openChecks?: OpenCheck[];
  /** §0 sealing restraint inputs (from the analysis snapshot). When routine +
   *  reversible + confident, the seal records a single light check instead of the
   *  full multi-predicate contract (CLAUDE.md mirror clause — don't over-fire
   *  ceremony on a low-stakes reversible call). Absent → full ceremony (safe). */
  gate?: { stakes?: 'routine' | 'important' | 'critical'; reversibility?: 'reversible' | 'partial' | 'irreversible'; framingConfidence?: number };
  /** The voyage's CLOSING scene (arrive/닿기). When an early rope already made a
   *  contract at OPEN, the closing SealMoment would otherwise divert straight to
   *  the plain contract card (line ~298) and skip the stamp→certificate ceremony.
   *  `closing` lets a not-yet-`closed_at` contract play the ceremony ONCE (the seal
   *  augments the early rope and stamps `closed_at`); reloads then show the card. */
  closing?: boolean;
}) {
  const locale = useLocale();
  const ko = locale === 'ko';
  const L = (k: string, e: string) => (ko ? k : e);
  const updateProject = useProjectStore((s) => s.updateProject);
  const addDecisionItems = useDecisionItemsStore((s) => s.addItems);
  const currentVoyage = useProgressiveStore((s) => s.currentSession);
  const setSealPromptDismissed = useProgressiveStore((s) => s.setSealPromptDismissed);
  const persistedDismissedAt = useProgressiveStore((s) => {
    const active = s.sessions.find((item) => item.id === s.currentSessionId && item.project_id === project.id);
    if (active) return active.seal_prompt_dismissed_at ?? null;
    for (let i = s.sessions.length - 1; i >= 0; i -= 1) {
      if (s.sessions[i].project_id === project.id) return s.sessions[i].seal_prompt_dismissed_at ?? null;
    }
    return null;
  });
  const { user, session, signInWithGoogle } = useAuth();
  const [signInError, setSignInError] = useState<string | null>(null);
  const [cardBusy, setCardBusy] = useState(false);

  // ── 추적될 전제의 deny 배선 (2026-07-30) ─────────────────────────────
  // 봉인 화면에서 ×로 뺀 것은 추적 저장소에도 저장되지 않아야 한다. 그전까지
  // autoTrackPremises 는 화면의 선택을 전혀 받지 않아, 사용자가 "이건 아니야"라고
  // 뺀 전제가 추적 목록에 그대로 active 로 남았다 — 기획 2단계(accept/deny)의
  // deny 쪽이 끊긴 배선이었다.
  //
  // 뺄 수 있는 자리는 둘이고 둘 다 반영한다:
  //   · 봉인 카드의 술어 ×      → dropped (술어 id) → 그 술어의 문장
  //   · 서랍의 "추적할 전제" ×  → droppedPremiseTexts (문장 자체)
  const [droppedPremiseTexts, setDroppedPremiseTexts] = useState<Set<string>>(new Set());
  // 종 끔 목록 (2026-07-30): premise 는 기본 켬(서버 감시), 끄는 스위치가 이
  // 서랍에 보인다 — 숨은 opt-in(실측 22건 중 0건 켜짐)을 보이는 opt-out 으로.
  const [bellOffTexts, setBellOffTexts] = useState<Set<string>>(new Set());
  // 인라인 수정 (2026-07-30): 원문 → 고친 문장. 저장은 recordEdit('refine')로
  // 가므로 AI 원문 보존 + 내 문장 승격이 자동이다. 키는 항상 풀의 원문 —
  // 서랍 행의 정체성(×·종·수정 전부)이 한 키를 쓴다.
  const [editedPremiseTexts, setEditedPremiseTexts] = useState<Map<string, string>>(new Map());
  const [editingPremiseKey, setEditingPremiseKey] = useState<string | null>(null);

  /** 화면의 두 deny 를 합친 제외 목록. autoTrackPremises 와 서랍 미리보기가 같이 쓴다. */
  function excludedPremiseTexts(): string[] {
    const fromPredicates = (Array.isArray(predicates) ? predicates : [])
      .filter((p) => dropped.has(p.id))
      .map((p) => (typeof p.text === 'string' ? p.text : ''))
      .filter(Boolean);
    return [...fromPredicates, ...droppedPremiseTexts];
  }

  /** §3.4 — the decision's premises become tracked items at seal (auto, not a
   *  manual import). Idempotent. premise 는 기본 종 켬(서랍의 보이는 스위치가
   *  정본), open_question 은 종 대상 아님. */
  function autoTrackPremises(now: number) {
    const voyage = currentVoyage();
    if (!voyage || voyage.project_id !== project.id) return; // only this project's flow
    const items = buildAutoTrackedPremiseItems(project.id, voyage, now, {
      excludeTexts: excludedPremiseTexts(),
      bellOffTexts: [...bellOffTexts],
      overrides: [...editedPremiseTexts].map(([from, to]) => ({ from, to })),
    });
    if (items.length > 0) addDecisionItems(items);
  }

  /**
   * 서랍에 보여줄 "추가로 추적될 전제" — 술어 편집기에 이미 보이는 문장은 빼고,
   * 사용자가 ×로 뺀 것도 뺀 나머지. **저장 함수와 같은 빌더를 쓴다** — 미리보기가
   * 딴 계산을 하면 화면이 보여준 것과 저장된 것이 달라지고, 그건 확인 표면이
   * 아니라 장식이 된다.
   */
  const extraTrackedPremises = useMemo(() => {
    const voyage = currentVoyage();
    if (!voyage || voyage.project_id !== project.id) return [];
    const predicateTexts = (Array.isArray(predicates) ? predicates : [])
      .map((p) => (typeof p.text === 'string' ? p.text : ''))
      .filter(Boolean);
    return buildAutoTrackedPremiseItems(project.id, voyage, 0, {
      excludeTexts: [...droppedPremiseTexts],
      bellOffTexts: [...bellOffTexts],
      overrides: [...editedPremiseTexts].map(([from, to]) => ({ from, to })),
    })
      .filter((item) => !predicateTexts.some((t) => t === item.text || sameClaim(t, item.text)));
    // currentVoyage 는 store selector 라 참조가 매번 같지 않다 — 봉인 전 화면에서
    // 세션 내용이 더 바뀌지 않으므로 프로젝트/드롭/종/수정 기준으로만 다시 계산한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, predicates, droppedPremiseTexts, bellOffTexts, editedPremiseTexts]);

  // 묶기(밧줄)에서 이미 확인일을 정했다면 그 선택이 이 카드의 시작값이다.
  // 실주행 재실사(2026-07-08)에서 발견: 1일로 묶었는데 완료 카드가 조용히
  // 1주 디폴트를 제안 — 사용자가 정한 날을 기계 디폴트가 덮어쓰는 배선 절단.
  const [interval, setInterval] = useState<CheckInInterval>(() =>
    intervalFromExistingContract(project?.decision_contract?.check_in_at) ?? DEFAULT_CHECK_IN_INTERVAL);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  // Scene machine for a seal performed in THIS session (P1-A3 / 07 S3):
  //   'ask'     — nothing sealed here yet (delegates to the contract card if a
  //               contract already exists from a previous session).
  //   'sealing' — the 2.6s press ceremony. Identical for EVERY seal (no
  //               content/direction variation — spine §4), tap anywhere to
  //               skip, and prefers-reduced-motion jumps straight past it.
  //   'sealed'  — the certificate plate + actions.
  const [scene, setScene] = useState<'ask' | 'sealing' | 'sealed'>('ask');
  const reducedMotion = useReducedMotion();
  const [dismissedLocally, setDismissedLocally] = useState(false);
  const dismissed = dismissedLocally || !!persistedDismissedAt;
  // ── 마무리 판단 칸 ────────────────────────────────────────────────────
  // 2026-07-29 실주행: 이 칸은 **빈칸으로 떠 있었다.** 그리고 밑에 회색 작은 글씨로
  // "비워두면 검토 전 기준점을 그대로 최종 판단으로 남겨요"라고만 적혀 있었다.
  // 빈칸은 채워지지 않는다 — 그래서 30분 검토가 끝나도 봉인되는 문장은 **시작 전에
  // 아무 생각 없이 적은 한 줄**이었다("일단" 두 글자가 봉인된 기록도 실재한다).
  //
  // 고치는 방향: 새 LLM 호출도, 강제 타이핑도 아니다. 초안 흐름이 이미 만들어둔
  // `decision_read`("먼저 읽을 한 줄 — 행동 + 이유 하나")를 **연한 초안으로 미리
  // 넣어둔다.** 빈칸에는 반응할 수 없지만 틀린 문장에는 반응할 수 있다 —
  // "아니, 그게 아니라"가 사람이 제일 쉽게 하는 편집이다.
  //
  // 그대로 두고 확정해도 거짓말이 되지 않는 이유는 아래 judgmentAuthorship 이
  // 처리한다: 손대지 않은 초안은 `ai_surfaced` + `user_adopted` 로 기록되고,
  // 인증서·공유 카드에 "AI가 짚은 문장을 그대로 뒀음"으로 찍힌다.
  // 지어내도 되지만 누가 썼는지는 숨기지 않는다 (CLAUDE.md A1).
  const aiDraftJudgment = useMemo(() => {
    const v = currentVoyage();
    if (!v || v.project_id !== project.id) return '';
    return (v.final_mix?.decision_read ?? v.mix?.decision_read ?? '').trim();
    // currentVoyage 는 store selector 라 매 렌더 같은 참조가 아니다 — 프로젝트가
    // 바뀔 때만 다시 읽으면 충분하다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);
  const [humanJudgment, setHumanJudgment] = useState(aiDraftJudgment);
  const [judgmentTouched, setJudgmentTouched] = useState(false);
  /** 손대지 않은 초안을 그대로 확정했는가 — 출처를 정직하게 가르는 유일한 기준. */
  const keptAiDraft = !judgmentTouched
    && !!aiDraftJudgment
    && humanJudgment.trim() === aiDraftJudgment;
  const [kindOverride, setKindOverride] = useState<DecisionKind | null>(null);
  const [reviewCondition, setReviewCondition] = useState('');
  const [returnEvent, setReturnEvent] = useState('');
  const sealedSceneRef = useRef<HTMLDivElement>(null);

  // Ceremony clock — the press lands ~380ms, the ink line finishes ~1650ms,
  // the certificate crossfades in at 1700ms. Cleanup guards unmount mid-scene.
  useEffect(() => {
    if (scene !== 'sealing') return;
    const t = setTimeout(() => setScene('sealed'), 1700);
    return () => clearTimeout(t);
  }, [scene]);

  // Defensive: legacy sessions may carry a malformed contract.
  const contract = project?.decision_contract ?? null;
  const baselineJudgment = (contract?.judgment_receipt?.baseline_judgment
    || contract?.predicates?.find((p) => p.source === 'user_lean')?.text
    || '').trim();

  // The certificate is the completion beat. Keep its first line below the sticky
  // header instead of preserving a stale scroll position from the long document.
  useEffect(() => {
    if (scene !== 'sealed') return;
    const frame = requestAnimationFrame(() => {
      sealedSceneRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [scene, reducedMotion]);

  // A genuinely flat decision (routine + reversible) is where NOT sealing is the
  // correct, spine-mandated restraint (P3 / over-fire clause). Everything else is a
  // "non-trivial frame": a consequential decision where reaching the seal with zero
  // predicates means the loop BROKE, not that restraint fired. Absent gate inputs
  // default to the safe non-trivial side (same default as the seal ceremony itself).
  const flatDecision =
    (gate?.stakes ?? 'important') === 'routine' &&
    (gate?.reversibility ?? 'partial') === 'reversible';

  // §D.2 restraint observability: the seal used to render null on zero predicates in
  // BOTH the "correctly silent on a flat decision" case AND the "engine produced
  // nothing" case — restraint and a broken loop looked identical, laundering the
  // broken-loop rate into restraint. Split the signal by reason so the broken loop
  // is measurable (internal routing only — never surfaced to the user).
  const silentNoSeal = !contract && (Array.isArray(predicates) ? predicates.length : 0) === 0;
  useEffect(() => {
    if (!silentNoSeal) return;
    const reason = flatDecision ? 'flat' : 'extraction_empty';
    recordSignal({ project_id: project.id, tool: 'voyage', signal_type: 'seal_not_armed', signal_data: { predicates: 0, reason } });
    track('seal_not_armed', { project_id: project.id, reason });
  }, [silentNoSeal, flatDecision, project.id]);

  const kept = useMemo(
    () => (Array.isArray(predicates) ? predicates : []).filter((p) => !dropped.has(p.id)),
    [predicates, dropped],
  );
  const kindSentence = (
    humanJudgment.trim()
    || baselineJudgment
    || kept[0]?.text?.trim()
    || (typeof project.name === 'string' ? project.name.trim() : '')
  );
  const derivedKind = useMemo(
    () => deriveDecisionKind({ statement: kindSentence, has_return_handle: true }),
    [kindSentence],
  );
  // An existing authorial kind is the current projection. Re-running the
  // wording heuristic must never manufacture a user correction on re-seal.
  const selectedKind = kindOverride ?? contract?.kind ?? derivedKind.kind;
  // loop-17 B — open checks the user hasn't dropped. Auto-carried by default; a ×
  // removes one before sealing (founder setting: auto + one-tap drop). Preserve any
  // already on an existing contract (re-seal) so a prior carry isn't silently lost.
  const [droppedChecks, setDroppedChecks] = useState<Set<string>>(new Set());
  const keptChecks = useMemo(
    () => (Array.isArray(openChecks) ? openChecks : []).filter((c) => !droppedChecks.has(c.id)),
    [openChecks, droppedChecks],
  );

  function fmtDate(ms: number): string {
    const d = new Date(ms);
    const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
    // A promise that crosses the year boundary must say which year it means.
    if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
    return d.toLocaleDateString(ko ? 'ko-KR' : 'en-US', opts);
  }
  const dateFor = (iv: CheckInInterval) => fmtDate(Date.now() + CHECK_IN_MS[iv]);

  // The COMMITTED check-in date (ms) — what was actually sealed, not the chip
  // currently selected in the drawer (selection no longer re-seals).
  const sealedAtMs = (() => {
    if (!contract?.check_in_at) return null;
    const t = new Date(contract.check_in_at).getTime();
    return Number.isNaN(t) ? null : t;
  })();

  // `iv` lets callers seal with a freshly-picked interval without waiting for the
  // setInterval state update to flush (React batches it, so reading `interval`
  // here would be stale).
  function seal(iv: CheckInInterval = interval) {
    if (kept.length === 0) return;
    const now = Date.now();
    const existing = project.decision_contract;
    // §0 restraint gate (CLAUDE.md mirror clause): a routine + reversible + confident
    // decision gets ONE light check, not the full multi-predicate ceremony. It NEVER
    // drops the decision — single_check still seals (the user's early rope alone if one
    // exists, else the single sharpest predicate). Absent gate inputs → full contract.
    const decision = selectedKind === 'witness' ? { mode: 'full_contract' as const } : shouldSealContract({
      stakes: gate?.stakes ?? 'important',
      reversibility: gate?.reversibility ?? 'partial',
      framingConfidence: gate?.framingConfidence ?? 0,
      predicates: kept,
    });
    if (decision.mode === 'none') return;
    const toSeal = decision.mode === 'single_check'
      ? (existing ? [] : kept.slice(0, 1)) // keep only the user's early rope, or one predicate
      : kept;
    // If an EARLY rope already exists (Phase 1 BIND at project-OPEN), AUGMENT it —
    // merge onto it, preserving id/created_at and the user's own user_lean predicate,
    // and re-confirm the check-in. Never clobber ("bind tighter at peak temptation").
    const base = existing
      ? augmentContract(existing, toSeal, now, selectedKind === 'witness' ? undefined : iv)
      : contractFromPredicates(project.id, toSeal, now);
    const next = base
      ? (selectedKind === 'witness' ? withoutReturn(base, now) : (existing ? base : withCheckIn(base, iv, now)))
      : null;
    if (!next) return;
    setDismissedLocally(false);
    setSealPromptDismissed(false);
    const receiptFields = deriveReceiptFields(toSeal, typeof project.name === 'string' ? project.name : '');
    // 2026-07-29 (되돌림): 잠깐 여기에 "시험 단계에서 적은 전제"를 폴백으로 끼워넣었다가
    // 뺐다. 그 전제는 "다음 분기 매출이 지금 수준을 유지한다" 같은 문장 — **결정이 아니다.**
    // 판단 자리에 전제를 넣으면 종류가 다른 문장이 봉인되고, 확인일 질문이 어긋난다.
    // 전제는 governing_idea 술어로 제자리에 남는다. 여기 오는 건 판단뿐이다.
    const finalJudgment = humanJudgment.trim() || baselineJudgment;
    if (!humanJudgment.trim() && finalJudgment) setHumanJudgment(finalJudgment);
    // The pre-review baseline is evidence of change, not the final prediction to
    // score. When the user writes a closing judgment, replace the baseline
    // predicate with that exact line and make it the primary return checkpoint.
    // 문장을 누가 썼는지의 판정은 **순수 함수 한 곳**에 있다 (judgment-authorship.ts).
    // 여기 인라인으로 두면 순수 테스트가 못 읽고, 검사기가 못 읽는 규칙은 없는 규칙이다.
    const authorship = finalJudgment
      ? closingJudgmentAuthorship({
          text: finalJudgment, aiDraft: aiDraftJudgment, touched: judgmentTouched, now,
        })
      : null;
    const finalPredicate = finalJudgment && authorship
      ? {
          id: stablePredicateId('user_lean', finalJudgment),
          text: finalJudgment,
          source: 'user_lean' as const,
          authored: authorship.authored,
          attribution: authorship.attribution,
        }
      : null;
    // 같은 문장이 두 번 실리지 않게 **글자로도** 거른다. 마무리 판단이 시험 단계의
    // 베팅에서 왔으면 그 술어는 governing_idea 로 이미 목록에 있고 id 가 달라
    // id/source 필터만으로는 안 걸린다 — 그러면 사용자는 자기 문장을 두 줄로 본다.
    const sameLine = (a: string, b: string) => a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim();
    const finalizedDraft = finalPredicate
      ? {
          ...next,
          predicates: [
            finalPredicate,
            ...(next.predicates || []).filter((p) => p.source !== 'user_lean'
              && p.id !== finalPredicate.id
              && !(typeof p.text === 'string' && sameLine(p.text, finalPredicate.text))),
          ].slice(0, MAX_PREDICATES),
        }
      : next;
    const adoptionLineage = adoptionLineageForSeal(
      finalizedDraft.predicates,
      finalizedDraft.open_checks ?? keptChecks,
      finalPredicate ? undefined : finalizedDraft.predicates[0]?.id,
    );
    const originUtterance = currentVoyage()?.problem_text?.trim()
      || (typeof project.name === 'string' ? project.name.trim() : '')
      || finalJudgment;
    const finalized = withDecisionFoundation(finalizedDraft, {
      kind: selectedKind,
      sealedStatement: finalJudgment || finalizedDraft.predicates[0]?.text || originUtterance,
      derivedKind: derivedKind.kind,
      kindRule: derivedKind.rule,
      kindQuestion: L('이 기록은 나중에 무엇을 확인하면 좋을까요?', 'What should this record revisit later?'),
      kindAnswer: finalJudgment || finalizedDraft.predicates[0]?.text,
      originUtterance,
      reviewConditionStatus: selectedKind === 'witness'
        ? 'not_asked'
        : reviewCondition.trim() ? 'answered' : 'skipped',
      reviewCondition: reviewCondition.trim() || undefined,
      returnEvent: returnEvent.trim() || undefined,
      adoptionLineage,
    }, now);
    const check_by = finalized.check_in_at ? new Date(finalized.check_in_at).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'long', day: 'numeric' }) : '';
    // ALWAYS attach the receipt. The machine-derived fields (그때의 진짜 질문 /
    // 검증 안 된 가정) are computed regardless; only human_judgment is optional.
    // Previously the whole receipt was gated on the user typing a line, so the
    // express 1-tap path (the default) saved NO receipt → settlement collapsed to a
    // bare date + verdict chip with no then↔now to re-verify against. Empty
    // human_judgment renders nothing in JudgmentReceipt, so this costs the user
    // zero extra work while keeping the premise recall alive at settlement.
    const judgment_receipt = {
      ...receiptFields,
      baseline_judgment: baselineJudgment || undefined,
      human_judgment: finalJudgment,
      judgment_attribution: finalPredicate?.attribution,
      check_by,
    };
    // Closing seal (닫는 봉인): stamp closed_at so a later reload shows the calm
    // contract card instead of re-playing the ceremony (the 298 gate reads it).
    const closed_at = closing ? new Date(now).toISOString() : next.closed_at;
    // checkpoints v2 §12 Phase 0 (W1): designate the primary checkpoint at seal —
    // preserve a carried one, else auto-construct from the top predicate + the
    // date handle. jsonb-nested (no migration); the return loop focuses here.
    const primary_checkpoint = selectedKind === 'witness'
      ? undefined
      : derivePrimaryCheckpoint(
          finalized,
          finalPredicate ? {
            predicate_id: finalPredicate.id,
            check_prompt: finalPredicate.text,
            authorship: 'user_authored',
          } : finalized.primary_checkpoint,
          new Date(now).toISOString().slice(0, 10),
        ) ?? undefined;
    // loop-17 B — carry the kept open checks (preserve any already sealed on a re-seal).
    const open_checks = finalized.open_checks ?? (keptChecks.length ? keptChecks : undefined);
    updateProject(project.id, {
      decision_contract: {
        ...finalized,
        judgment_receipt,
        closed_at,
        ...(primary_checkpoint ? { primary_checkpoint } : {}),
        open_checks,
      },
    });
    autoTrackPremises(now);
    // Cross-surface return loop: if this logged-in user connected Telegram, mirror
    // the sealed contract into the one push channel that actually fires on the date
    // (the daily cron reads telegram_decisions, which web seals never wrote). Server
    // no-ops for unconnected users; fire-and-forget so it never blocks the seal.
    const sharp = finalized.predicates[0]?.text;
    if (selectedKind !== 'witness' && user && session?.access_token && finalized.check_in_at && sharp) {
      syncSealToTelegram({
        accessToken: session.access_token,
        projectId: project.id,
        decision: typeof project.name === 'string' ? project.name : '',
        predicate: sharp,
        checkInAt: finalized.check_in_at,
      });
    }
    setInterval(iv);
    // First seal this session → play the ceremony (or skip it under
    // reduced-motion). A re-seal from the sealed drawer stays calmly on the
    // certificate — the ceremony plays once per session, not per adjustment.
    const firstSeal = scene === 'ask';
    setScene((s) => (s === 'sealed' ? 'sealed' : reducedMotion ? 'sealed' : 'sealing'));
    // Learning signal (2026-06-13 data-wiring fix) — the new flow recorded
    // nothing. Accepting the seal is the strongest engagement signal the
    // product has. Not already sealed → only count the first seal.
    if (firstSeal) {
      recordSignal({ project_id: project.id, tool: 'voyage', signal_type: 'seal_accepted', signal_data: { interval: iv, predicates: finalized.predicates.length, kind: selectedKind } });
      // Also in the main funnel (user_events) — this is the activation north-star.
      track('decision_sealed', { interval: iv, predicates: finalized.predicates.length, augmented: !!existing, mode: decision.mode, kind: selectedKind });
      // Retro→real conversion signal (항목10): only if a retro loop was settled first.
      fireFirstRealSealAfterRetro();
    }
  }

  // Recovery seal for the extraction_empty case: a consequential decision reached
  // the seal with zero machine-derived predicates (the loop would silently break).
  // Seal the user's OWN one-line decision summary as the sole predicate, authored
  // 'user' (buildEarlyContract's user_lean path) — lossless, and never offered on a
  // genuinely flat decision (see the render gate below). Mirrors seal()'s side
  // effects so the artifact behaves identically downstream.
  function manualSeal(iv: CheckInInterval = interval) {
    const summary = (typeof project?.name === 'string' ? project.name : '').trim();
    const recoveryJudgment = humanJudgment.trim() || baselineJudgment;
    if (!summary || !recoveryJudgment) return;
    const now = Date.now();
    const existing = project.decision_contract;
    // In the CLOSING case an early rope may already exist with zero fresh
    // predicates — never clobber it with a rebuilt contract; augment (preserve
    // id/created_at + the user's own lean) and re-confirm the check-in instead.
    const draft = existing
      ? augmentContract(existing, [], now, selectedKind === 'witness' ? undefined : iv)
      : buildEarlyContract(project.id, { lean: recoveryJudgment, ...(selectedKind === 'witness' ? {} : { interval: iv }) }, now);
    const c = draft ? (selectedKind === 'witness' ? withoutReturn(draft, now) : draft) : null;
    if (!c) return;
    const recoveryBaseline = c.judgment_receipt?.baseline_judgment
      || c.predicates.find((p) => p.source === 'user_lean')?.text
      || '';
    const finalJudgment = recoveryJudgment;
    const finalPredicate = {
      id: stablePredicateId('user_lean', finalJudgment),
      text: finalJudgment,
      source: 'user_lean' as const,
      authored: 'user' as const,
      attribution: webUserAttribution(now, 'workspace:closing_judgment_recovery'),
    };
    const finalizedDraft = {
      ...c,
      predicates: [
        finalPredicate,
        ...c.predicates.filter((p) => p.source !== 'user_lean' && p.id !== finalPredicate.id),
      ].slice(0, MAX_PREDICATES),
    };
    const adoptionLineage = adoptionLineageForSeal(
      finalizedDraft.predicates,
      finalizedDraft.open_checks ?? keptChecks,
    );
    const originUtterance = currentVoyage()?.problem_text?.trim() || summary;
    const finalized = withDecisionFoundation(finalizedDraft, {
      kind: selectedKind,
      sealedStatement: finalJudgment,
      derivedKind: derivedKind.kind,
      kindRule: derivedKind.rule,
      kindQuestion: L('이 기록은 나중에 무엇을 확인하면 좋을까요?', 'What should this record revisit later?'),
      kindAnswer: finalJudgment,
      originUtterance,
      reviewConditionStatus: selectedKind === 'witness'
        ? 'not_asked'
        : reviewCondition.trim() ? 'answered' : 'skipped',
      reviewCondition: reviewCondition.trim() || undefined,
      returnEvent: returnEvent.trim() || undefined,
      adoptionLineage,
    }, now);
    setDismissedLocally(false);
    setSealPromptDismissed(false);
    const check_by = finalized.check_in_at ? new Date(finalized.check_in_at).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { month: 'long', day: 'numeric' }) : '';
    // ALWAYS attach the receipt (match the main seal path) so this recovery seal
    // also keeps a then↔now anchor at settlement; human_judgment stays optional.
    const judgment_receipt = {
      real_question: summary,
      unverified_assumption: '',
      human_only: '',
      baseline_judgment: recoveryBaseline || undefined,
      human_judgment: finalJudgment,
      judgment_attribution: finalPredicate.attribution,
      check_by,
    };
    const closed_at = closing ? new Date(now).toISOString() : finalized.closed_at;
    const primary_checkpoint = selectedKind === 'witness'
      ? undefined
      : derivePrimaryCheckpoint(
          finalized,
          {
            predicate_id: finalPredicate.id,
            check_prompt: finalPredicate.text,
            authorship: 'user_authored',
          },
          new Date(now).toISOString().slice(0, 10),
        ) ?? undefined;
    const open_checks = finalized.open_checks ?? (keptChecks.length ? keptChecks : undefined);
    updateProject(project.id, {
      decision_contract: {
        ...finalized,
        judgment_receipt,
        closed_at,
        ...(primary_checkpoint ? { primary_checkpoint } : {}),
        open_checks,
      },
    });
    autoTrackPremises(now);
    const sharp = finalized.predicates[0]?.text;
    if (selectedKind !== 'witness' && user && session?.access_token && finalized.check_in_at && sharp) {
      syncSealToTelegram({
        accessToken: session.access_token,
        projectId: project.id,
        decision: summary,
        predicate: sharp,
        checkInAt: finalized.check_in_at,
      });
    }
    setInterval(iv);
    setScene(reducedMotion ? 'sealed' : 'sealing');
    recordSignal({ project_id: project.id, tool: 'voyage', signal_type: 'seal_accepted', signal_data: { interval: iv, predicates: finalized.predicates.length, mode: 'manual_recovery', kind: selectedKind } });
    track('decision_sealed', { interval: iv, predicates: finalized.predicates.length, mode: 'manual_recovery', kind: selectedKind });
    // Retro→real conversion signal (항목10): only if a retro loop was settled first.
    fireFirstRealSealAfterRetro();
  }

  // ── 캘린더에 약속 넣기 — a client-built .ics, because there is no outbound
  //    channel yet: the calendar is the user's own reminder, honestly framed. ──
  function downloadIcs() {
    const target = new Date(sealedAtMs ?? Date.now() + CHECK_IN_MS[interval]);
    const ymd = `${target.getFullYear()}${String(target.getMonth() + 1).padStart(2, '0')}${String(target.getDate()).padStart(2, '0')}`;
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const name = typeof project?.name === 'string' ? project.name : '';
    const summary = L(`그래서, 어떻게 됐어요? — ${name}`, `So, how did it go? — ${name}`);
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Argus//Decision Check-in//EN',
      'BEGIN:VEVENT',
      `UID:argus-checkin-${project.id}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd}`,
      `SUMMARY:${icsEscape(summary)}`,
      // 열면 그 결정으로 바로 (2026-07-30, 알림 메일과 같은 ?open= 문).
      `DESCRIPTION:${icsEscape(`${window.location.origin}${withLocale(locale, '/project')}?open=${project.id}`)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `argus-checkin-${ymd}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── 판단 카드 — 봉인한 판단을 그림 한 장으로. 남에게 보여줄 수 있는 유일한
  //    수단이 "텍스트 복사"뿐이면, 좋다고 느낀 사람도 아무에게도 못 보여준다.
  //
  //    카드에 무엇이 실리고 무엇이 실리지 않는지는 lib/judgment-card.ts 가 전부
  //    정한다. 여기서는 그 결과를 그리고 내려받게만 한다 — 이 컴포넌트가 문장을
  //    보태면 그 순간 "사용자가 확정하지 않은 문장"이 서명 없이 유통된다.
  //
  //    카드를 만들 수 없으면(봉인 문장 없음) 버튼 자체를 렌더하지 않는다. 눌렀는데
  //    빈 카드가 나오는 것보다 버튼이 없는 게 정직하다.
  const judgmentCard = useMemo(
    () => buildJudgmentCard(project?.decision_contract ?? null, typeof project?.name === 'string' ? project.name : null),
    [project?.decision_contract, project?.name],
  );

  async function downloadCard() {
    if (!judgmentCard || cardBusy) return;
    setCardBusy(true);
    try {
      // 렌더러는 캔버스를 쓰므로 브라우저에서만 산다 — 봉인 화면 첫 페인트에
      // 끌고 들어오지 않도록 누를 때 불러온다.
      const { renderJudgmentCard, judgmentCardFilename } = await import('@/lib/judgment-card-render');
      const blob = await renderJudgmentCard(judgmentCard, locale === 'ko' ? 'ko' : 'en');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = judgmentCardFilename(judgmentCard);
      a.click();
      URL.revokeObjectURL(url);
      track('judgment_card_downloaded', { authorship: judgmentCard.authorship, has_check: !!judgmentCard.checkOn });
    } catch {
      // 카드는 부가 기능이다. 실패해도 봉인은 이미 끝났으므로 화면을 흔들지 않는다.
    } finally {
      setCardBusy(false);
    }
  }

  // ── Already-sealed loop (reload / waiting / due / verified): single source of
  //    truth lives in DecisionContractCard. We only own the fresh ASK + the
  //    just-sealed confirmation. ──
  // A contract already exists (usually an early rope tied at OPEN). Normally the
  // already-sealed loop lives in DecisionContractCard and we delegate. EXCEPTION:
  // the CLOSING scene on a not-yet-closed contract falls through to the ASK card
  // so the seal augments the rope and plays the stamp→certificate ceremony ONCE.
  // After it stamps closed_at (or on a return-day / non-closing surface), delegate.
  const playClosingCeremony = closing && !contract?.closed_at;
  if (contract && scene === 'ask' && !playClosingCeremony) {
    return <DecisionContractCard project={project} livePredicates={predicates} />;
  }

  // Zero machine-derived predicates. Two very different worlds (see flatDecision):
  //  - FLAT decision → silence IS the output (P3 / over-fire spine). Render nothing.
  //  - NON-FLAT frame → the loop would silently break: a consequential decision with
  //    no return-hook. Offer ONE quiet, skippable manual seal of the user's own
  //    summary. Not a forced gate, not a fork — just a way to not lose the artifact.
  if ((Array.isArray(predicates) ? predicates.length : 0) === 0 && scene === 'ask') {
    if (flatDecision || dismissed) return null;
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mt-12"
      >
        <div className="flex items-center gap-3 mb-8 text-[var(--text-tertiary)]/50">
          <div className="h-px flex-1 bg-[var(--border-subtle)]" />
          <span className="text-[12.5px] font-medium tracking-wide uppercase">{L('마지막으로', 'One last thing')}</span>
          <div className="h-px flex-1 bg-[var(--border-subtle)]" />
        </div>
        <div className="rounded-3xl border border-[var(--accent)]/30 bg-[var(--surface)] px-6 py-7 md:px-10 md:py-9 text-center">
          <div className="w-11 h-11 rounded-2xl mx-auto flex items-center justify-center bg-[var(--ai)] text-[var(--accent)]">
            <Anchor size={20} />
          </div>
          <h3 className="mt-4 text-[18px] md:text-[20px] font-bold text-[var(--text-primary)] leading-[1.35] max-w-md mx-auto">
            {selectedKind === 'witness'
              ? L('지금 남기고 싶은 문장을 원문 그대로 보관할까요?', 'Keep the sentence you want to remember exactly as written?')
              : L(`지금 남긴 문장을 ${dateFor(interval)}에 다시 확인할까요?`, `Revisit the sentence you keep here on ${dateFor(interval)}?`)}
          </h3>
          <p className="mt-2.5 text-[13px] text-[var(--text-secondary)] leading-[1.5] max-w-sm mx-auto">
            {baselineJudgment
              ? L('검토 전에 직접 남긴 문장을 기준으로 기록합니다.', 'This uses the sentence you wrote before the review.')
              : L('분석에서 확인할 문장을 뽑지 못했어요. 남길 문장을 한 줄로 적어 주세요.', 'Argus could not extract a reliable line to revisit. Write the sentence you want to keep.')}
          </p>
          <div className="mx-auto mt-5 max-w-md text-left">
            {!baselineJudgment && (
              <label className="block text-[12px] font-semibold text-[var(--text-secondary)]">
                {L('내가 남길 문장', 'The sentence I want to keep')}
                <textarea
                  value={humanJudgment}
                  onChange={(event) => setHumanJudgment(event.target.value)}
                  maxLength={4000}
                  rows={3}
                  placeholder={L('예: 권한과 역할이 문서에 적힐 때만 옮긴다.', 'Example: I will move only if the role and authority are written down.')}
                  className="mt-2 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3 text-[13px] font-normal leading-6 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/55 focus:outline-none"
                />
              </label>
            )}
            <KindChoice
              value={selectedKind}
              onChange={(value) => setKindOverride(value)}
              L={L}
            />
          </div>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => manualSeal()}
              disabled={!humanJudgment.trim() && !baselineJudgment}
              className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-2xl text-[var(--accent-fg)] text-[14px] font-semibold cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 transition-transform duration-150 active:scale-[0.96]"
              style={{ background: 'var(--gradient-gold)' }}
            >
              <Check size={15} />
              {selectedKind === 'witness'
                ? L('이 원문 그대로 기록', 'Save exactly as written')
                : L(`이 문장 기록 · ${dateFor(interval)}에 확인`, `Save this sentence · check on ${dateFor(interval)}`)}
            </button>
            <button
              onClick={() => {
                setDismissedLocally(true);
                setSealPromptDismissed(true);
                recordSignal({ project_id: project.id, tool: 'voyage', signal_type: 'seal_declined', signal_data: { predicates: 0, mode: 'manual_recovery' } });
                track('decision_seal_declined', { predicates: 0, mode: 'manual_recovery' });
              }}
              className="inline-flex items-center justify-center px-7 py-3 rounded-2xl text-[14px] font-medium text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--text-secondary)]/40 cursor-pointer transition-colors"
            >
              {L('아니요, 괜찮아요', 'No, thanks')}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // ════ DISMISSED — rejected, lossless. A quiet way back, nothing forced. ════
  if (dismissed) {
    return (
      <div className="mt-10 text-center">
        <p className="text-[12.5px] text-[var(--text-tertiary)]">
          {L('마음이 바뀌면 언제든 이 기록을 다시 열 수 있어요.', 'You can reopen this record anytime you change your mind.')}{' '}
          <button onClick={() => { setDismissedLocally(false); setSealPromptDismissed(false); }} className="font-medium text-[var(--accent)] hover:underline cursor-pointer">
            {L('질문 다시 보기', 'Show the question again')}
          </button>
        </p>
      </div>
    );
  }

  // ── Certificate / ceremony derived facts (all reads defensive — legacy
  //    contracts may lack the receipt; empty strings simply don't render). ──
  const displayedKind = contract?.kind ?? selectedKind;
  const checkDateStr = displayedKind === 'witness'
    ? ''
    : sealedAtMs ? fmtDate(sealedAtMs) : dateFor(interval);
  const stampD = new Date(sealedAtMs ?? Date.now() + CHECK_IN_MS[interval]);
  const stampDate = `${stampD.getMonth() + 1}.${stampD.getDate()}`;
  const sealedOnStr = fmtDate(Date.now());
  // The screenshot's heart: the user's OWN line (human_judgment). Falls back to
  // the sharpest predicate WITH the honest ai_surfaced label — never silently
  // promoted to look user-authored (CLAUDE.md rule 1).
  const certQuote = (contract?.judgment_receipt?.human_judgment || humanJudgment).trim();
  const certPredicate = (contract?.predicates?.[0]?.text || kept[0]?.text || '').trim();
  const certAttribution = contract?.judgment_receipt?.judgment_attribution;

  // ════ ASK → SEALING → SEALED — one keyed scene under AnimatePresence, so the
  //      ask card exits like paper being pressed away instead of vanishing. ════
  return (
    <AnimatePresence mode="wait">
    {scene === 'sealing' ? (
      // ════ SEALING — the 2.6s press ceremony (07 S3). One identical play for
      //      every seal; tap (or Enter/Space) anywhere = skip immediately.
      //      reduced-motion never reaches this scene (seal() jumps to 'sealed').
      <motion.div
        key="sealing"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        role="button"
        tabIndex={0}
        aria-label={L('건너뛰기', 'Skip')}
        onClick={() => setScene('sealed')}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setScene('sealed'); } }}
        className="seal-thud mt-10 rounded-3xl border border-[var(--accent)]/30 bg-[var(--surface)] px-6 py-12 md:py-14 text-center cursor-pointer"
      >
        <div className="flex justify-center">
          <SealStamp animate date={stampDate} />
        </div>
        <div className="mt-7 flex flex-col items-center gap-2.5">
          {/* '제가 먼저 물어볼게요' — 약속하는 그 Argus가 직접 */}
          <ArgusMascot moment="witness" size="md" alt={L('약속을 기억하는 Argus', 'Argus remembering the promise')} />
          <p className="seal-line-write text-[15px] font-semibold text-[var(--text-primary)] leading-[1.5]">
            {displayedKind === 'witness'
              ? L('원문 그대로 기록했어요. 다시 묻지 않을게요.', 'Saved exactly as written. I will not reopen it.')
              : L(`기록했어요 — ${checkDateStr}에 제가 먼저 물어볼게요.`, `Saved — I'll ask you first on ${checkDateStr}.`)}
          </p>
        </div>
      </motion.div>
    ) : scene === 'sealed' ? (
      // ════ SEALED — the seal certificate (07 S4): the plate above is the
      //      screenshot object (graticule texture + the user's own line in
      //      serif), the actions below arrive late so the moment stays quiet.
      <motion.div
        key="sealed"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        ref={sealedSceneRef}
        className="mt-10 scroll-mt-24"
      >
        {/* ── 증서 플레이트 — the object worth keeping ── */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 md:p-8 text-left">
          <Graticule opacity={0.05} spacing={26} />
          <div className="absolute top-4 right-4 md:top-5 md:right-5">
            <SealStamp date={stampDate} size={64} />
          </div>
          <div className="relative pr-16 md:pr-20">
            {/* [C2] 봉인증서 표면의 「연습 · 회고」 상시 배지 — retro 계약일 때만.
                정상 봉인은 origin 부재 → 미렌더(무영향). */}
            {contract?.origin === 'retro' && (
              <div className="mb-2">
                <RetroBadge ko={ko} />
              </div>
            )}
            <p className="text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
              {L('판단 기록 · 저장됨', 'Decision record · saved')} · {sealedOnStr}
            </p>
            {typeof project?.name === 'string' && project.name.trim() && (
              <p className="mt-2 text-[15px] font-semibold text-[var(--text-primary)] leading-[1.4]">{project.name}</p>
            )}
            {certQuote ? (
              baselineJudgment && baselineJudgment !== certQuote ? (
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                      {L('검토 전 기준점', 'Before the review')}
                    </p>
                    <p className="mt-1 text-[13px] leading-[1.55] text-[var(--text-secondary)]" style={{ fontFamily: 'var(--font-voice, serif)' }}>
                      &ldquo;{baselineJudgment}&rdquo;
                    </p>
                  </div>
                  <div className="border-t border-[var(--border)] pt-3">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                      {L('검토 뒤 내가 확정한 판단', 'My judgment after the review')}
                    </p>
                    <p className="mt-1 text-[16px] leading-[1.6] text-[var(--text-primary)]" style={{ fontFamily: 'var(--font-voice, serif)' }}>
                      &ldquo;{certQuote}&rdquo;
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-[16px] text-[var(--text-primary)] leading-[1.6]" style={{ fontFamily: 'var(--font-voice, serif)' }}>
                  &ldquo;{certQuote}&rdquo;
                </p>
              )
            ) : certPredicate ? (
              <div className="mt-3">
                <p className="text-[12.5px] text-[var(--text-tertiary)]">{L('AI가 대신 적어둔 확인 질문', 'A check question Argus drafted for you')}</p>
                <p className="mt-1 text-[14px] text-[var(--text-secondary)] leading-[1.6]" style={{ fontFamily: 'var(--font-voice, serif)' }}>
                  &ldquo;{certPredicate}&rdquo;
                </p>
              </div>
            ) : null}
            {certQuote && (
              <JudgmentAttributionLine
                attribution={certAttribution}
                locale={ko ? 'ko' : 'en'}
                className="mt-2"
              />
            )}
          </div>
          <p className="relative mt-5 pt-3 border-t border-[var(--border)] text-[13px] text-[var(--text-secondary)] leading-[1.6]">
            {displayedKind === 'witness'
              ? L('이 기록은 다시 묻지 않고, 오늘의 원문 그대로 남겨둘게요.', 'This stays exactly as written today. Argus will not reopen it.')
              : displayedKind === 'commitment'
                ? L(`${checkDateStr}에, 실제로 실행했는지만 사실대로 확인할게요.`, `On ${checkDateStr}, we’ll only check what you actually did.`)
                : displayedKind === 'declaration'
                  ? L(`${checkDateStr}에, 지금도 같은 기준인지 다시 물을게요.`, `On ${checkDateStr}, we’ll ask whether this standard still holds for you.`)
                  : L(`이 판단의 답은 이제 현실만 갖고 있어요 — ${checkDateStr}, 「그래서, 어떻게 됐어요?」 ⚓`,
                      `Only reality holds the answer now — ${checkDateStr}, "So, how did it go?" ⚓`)}
          </p>
        </div>

        {/* ── 아래 = 행동. 기존 요소 그대로, 의식이 끝나기 전 붐비지 않게 늦게 등장. ── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="mt-5 text-center"
        >
          {/* The certificate above already carries the date + "그래서, 어떻게
              됐어요?". One line here, and only the NEW bit: where it comes back
              (the project page). The old second <p> just re-poeticized the cert. */}
          <p className="text-[14px] font-semibold text-[var(--text-primary)] leading-[1.5]">
            {displayedKind === 'witness'
              ? L('저장됐어요. 다시 묻거나 알림을 만들지 않습니다.', 'Saved. No reminder or follow-up was created.')
              : L('좋아요 — 그날 프로젝트 페이지에서 제가 먼저 물어볼게요.', "Done — I'll bring it up first on the project page that day.")}
          </p>

          {/* Peak-ownership conversion: the artifact was just minted on THIS device.
              For an anon user this is the one moment they have something worth keeping,
              so offer the durable path here — not as resignation copy, but as one tap.
              The contract is already in localStorage (updateProject above), so the
              full-page OAuth round-trip preserves it and auth.tsx runs
              migrateLocalToAccount on SIGNED_IN return — the just-sealed decision
              follows them into the account. Local seal stays lossless either way. */}
          {!user && (
            <div className="mt-4 flex flex-col items-center gap-2">
              {/* Say the true thing before the ask (2026-07-29). The record IS saved
                  — server-side too — but it is reachable only from this browser's
                  anonymous session, and the check-in email needs an address we do
                  not have. Stating that is not pressure; withholding it while
                  promising a return date would be the dishonest version. */}
              <p className="max-w-[30rem] text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
                {L(
                  '이 기록은 지금 이 브라우저에 묶여 있어요. 다른 기기에서는 열리지 않고, 확인일에 알려드릴 주소도 아직 없어요.',
                  'This record is tied to this browser. It will not open on another device, and there is no address to reach you at on the check-in date.',
                )}
              </p>
              <button
                onClick={async () => {
                  track('seal_signin_cta', { placement: 'sealed' });
                  setSignInError(null);
                  const result = await signInWithGoogle('/workspace');
                  if (result.error) setSignInError(result.error);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold text-[var(--accent-fg)] cursor-pointer transition-transform hover:scale-[1.02]"
                style={{ background: 'var(--gradient-gold)' }}
              >
                <Anchor size={14} />
                {L('로그인하고 어디서나 이어보기', 'Sign in to keep this everywhere')}
              </button>
              {/* The gold button is Google-only. Email/password sign-up is a real
                  path (and the one that has actually converted lately), so it must
                  be reachable from the peak-ownership moment too — not just from
                  the header.
                  `?signup=1` 로 **가입 모드에 바로 내려놓는다** — 전에는 로그인
                  모드로 떨어져서 한 번 더 전환 링크를 찾아야 했다. `redirect` 는
                  가입이 끝나면 방금 봉인한 이 자리로 돌려보낸다. */}
              <LocaleLink
                href="/login?signup=1&redirect=/workspace"
                onClick={() => track('seal_signin_cta', { placement: 'sealed_email' })}
                className="text-[12px] font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)] hover:underline"
              >
                {/* 무엇을 얻는지로 말한다. "가입하기"는 우리가 원하는 것이고,
                    "그날 물어봐 준다"는 그 사람이 얻는 것이다 — 그리고 그게
                    바로 위에서 "알려드릴 주소가 아직 없어요"라고 말한 그 구멍이다. */}
                {L(`이메일 남기고 ${dateFor(interval)}에 알림 받기`, `Leave an email and get the ${dateFor(interval)} nudge`)}
              </LocaleLink>
            </div>
          )}
          {signInError && (
            <p role="alert" className="mt-2 text-[12px] text-[var(--danger)]">
              {signInError}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <LocaleLink href="/project" className="text-[12.5px] font-medium text-[var(--accent)] hover:underline">
              {L('프로젝트 페이지 보기 →', 'See the project page →')}
            </LocaleLink>
            {judgmentCard && <button
              onClick={downloadCard}
              disabled={cardBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors cursor-pointer disabled:opacity-50"
            >
              <ImageIcon size={13} />
              {L('이미지로 저장', 'Save as image')}
            </button>}
            {displayedKind !== 'witness' && <button
              onClick={downloadIcs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              <CalendarPlus size={13} />
              {L('캘린더에 약속 넣기', 'Add to my calendar')}
            </button>}
          </div>

          {/* Email return-path opt-in (P1-B2 / 03 S5): the seal moment is the ONE
              moment a user picks their way back, so the switch lives here in the
              same "돌아오는 길" bundle as the .ics button. Writes the existing
              decision_contract.email_reminder flag (jsonb-internal, checkin-due
              cron already gates on it) — the flag simply had no UI until now.
              Logged-in only: the cron mails the account address. Anonymous users
              keep the login CTA above as their durable path (§5-20: no new
              channel for anonymous sealers). */}
          {displayedKind !== 'witness' && user && contract && (
            <label className="mt-3 inline-flex items-center justify-center gap-2 text-[12px] text-[var(--text-secondary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!contract.email_reminder}
                onChange={(e) =>
                  updateProject(project.id, { decision_contract: { ...contract, email_reminder: e.target.checked } })
                }
                className="w-3.5 h-3.5 accent-[var(--accent)] cursor-pointer"
              />
              {user.email
                ? L(`그날 이메일로도 물어봐 주세요 (${user.email})`, `Ask me by email that day too (${user.email})`)
                : L('그날 이메일로도 물어봐 주세요', 'Ask me by email that day too')}
            </label>
          )}

          <button
            onClick={() => setDrawerOpen((o) => !o)}
            className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
          >
            {displayedKind === 'witness'
              ? L('함께 보관한 항목 보기', 'Review saved details')
              : L('돌아올 때·함께 볼 항목 손보기', 'Adjust the return and saved checks')}
            <ChevronDown size={13} className={`transition-transform ${drawerOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {drawerOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="overflow-hidden"
              >
                <div className="pt-4 text-left">
                  {/* Selection-only — one control, one contract: the explicit
                      "이대로 다시 봉인" button below is the single commit point. */}
                  {displayedKind !== 'witness' && <DateChips interval={interval} onPick={setInterval} dateFor={dateFor} L={L} />}
                  <div className="mt-4">
                    <PredicateEditor
                      predicates={Array.isArray(predicates) ? predicates : []}
                      dropped={dropped}
                      onToggle={(id) => {
                        setDropped((prev) => {
                          const next = new Set(prev);
                          if (next.has(id)) next.delete(id); else next.add(id);
                          return next;
                        });
                      }}
                      L={L}
                    />
                  </div>
                  {kept.length === 0 && (
                    <p className="mt-2 text-[13px] text-amber-600 dark:text-amber-400">
                      {L('최소 1개는 남겨야 물어볼 수 있어요.', 'Keep at least one so I have something to ask about.')}
                    </p>
                  )}
                  <button
                    onClick={() => seal()}
                    disabled={kept.length === 0}
                    className="mt-4 w-full py-2.5 rounded-xl text-[13px] font-semibold text-[var(--accent-fg)] disabled:opacity-50 cursor-pointer"
                    style={{ background: 'var(--gradient-gold)' }}
                  >
                    {displayedKind === 'witness'
                      ? L('이대로 다시 기록', 'Save these details')
                      : L('이대로 다시 저장', 'Save these changes')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    ) : (
    // ════ ASK — the standalone closing question (the last interaction) ════
    <motion.div
      key="ask"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.985, transition: { duration: 0.22 } }}
      transition={{ duration: 0.6, ease: EASE }}
      className="mt-12"
    >
      {/* This is not a second copy of the opening capture. The opening line was
          the pre-review baseline; this closes the reviewed judgment. */}
      <div className="flex items-center gap-3 mb-8 text-[var(--text-tertiary)]/50">
        <div className="h-px flex-1 bg-[var(--border-subtle)]" />
        <span className="text-[12.5px] font-medium tracking-wide uppercase">{L('검토의 끝 · 판단 기록', 'Close the review · decision record')}</span>
        <div className="h-px flex-1 bg-[var(--border-subtle)]" />
      </div>

      <div className="rounded-3xl border border-[var(--accent)]/30 bg-[var(--surface)] px-6 py-7 md:px-10 md:py-9 text-center">
        <div className="w-11 h-11 rounded-2xl mx-auto flex items-center justify-center bg-[var(--ai)] text-[var(--accent)]">
          <Anchor size={20} />
        </div>
        <h3 className="mt-4 text-[19px] md:text-[21px] font-bold text-[var(--text-primary)] leading-[1.35] max-w-md mx-auto">
          {selectedKind === 'witness'
            ? L('오늘의 판단을 원문 그대로 남길까요?', 'Keep today’s decision exactly as written?')
            : selectedKind === 'commitment'
              ? L(`지금의 약속을 남기고, ${dateFor(interval)}에 실행했는지 확인할까요?`, `Keep this commitment and check what you did on ${dateFor(interval)}?`)
              : selectedKind === 'declaration'
                ? L(`지금의 기준을 남기고, ${dateFor(interval)}에 다시 생각해볼까요?`, `Keep this standard and revisit it on ${dateFor(interval)}?`)
                : L(`검토 뒤의 판단을 남기고, ${dateFor(interval)}에 현실과 확인할까요?`, `Keep the judgment after this review and check it against reality on ${dateFor(interval)}?`)}
        </h3>
        {/* Nothing between the question and the choice (cleared 2026-07-20).
            The old pre-consent paragraphs — the channel ("프로젝트 페이지·텔레그램·
            광고 메일 없음") and the anon caveat ("이 기기에만 저장돼요…") — both
            said what the SEALED scene below already says at the right moment:
            post-seal it reads "좋아요, {date}에 물어볼게요 — 프로젝트 페이지에 오시면
            먼저 물어요" and offers anon a one-tap "로그인하고 어디서나 이어보기".
            Explaining delivery + device-scope BEFORE the yes was pure friction;
            the honest disclosure lands after commitment, framed as action not
            alarm. Here the user just chooses. */}

        <KindChoice
          value={selectedKind}
          onChange={(value) => setKindOverride(value)}
          L={L}
        />

        {/* Judgment Receipt — seal과 settle을 하나의 오브젝트로 묶는 진입점.
            사용자가 human_judgment를 작성하면 봉인 시 함께 저장된다. */}
        {kept.length > 0 && (() => {
          const rf = deriveReceiptFields(kept, typeof project.name === 'string' ? project.name : '');
          const check_by = dateFor(interval);
          return (rf.real_question || rf.unverified_assumption || rf.human_only) ? (
            <div className="mt-6 text-left">
              <JudgmentReceipt
                mode="seal"
                real_question={rf.real_question}
                unverified_assumption={rf.unverified_assumption}
                human_only={rf.human_only}
                check_by={check_by}
                baselineJudgment={baselineJudgment}
                humanJudgment={humanJudgment}
                isAiDraft={keptAiDraft}
                onJudgmentChange={(v) => { setJudgmentTouched(true); setHumanJudgment(v); }}
                locale={ko ? 'ko' : 'en'}
              />
            </div>
          ) : null;
        })()}

        {selectedKind !== 'witness' && (
          <div className="mx-auto mt-5 max-w-md text-left">
            <label className="block text-[12px] font-semibold text-[var(--text-secondary)]" htmlFor={`review-condition-${project.id}`}>
              {selectedKind === 'commitment'
                ? L('무엇이 생기면 이 약속을 바꿔도 될까요?', 'What would justify changing this commitment?')
                : selectedKind === 'declaration'
                  ? L('무엇이 달라지면 이 기준을 다시 볼까요?', 'What change would make you revisit this standard?')
                  : L('어떤 결과가 나오면 다시 생각할까요?', 'What result would make you reconsider?')}
            </label>
            <input
              id={`review-condition-${project.id}`}
              value={reviewCondition}
              onChange={(event) => setReviewCondition(event.target.value)}
              maxLength={400}
              placeholder={L('선택사항 · 비워두면 건너뛴 것으로 기록돼요', 'Optional · leave blank to record that you skipped it')}
              className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-[13px] leading-5 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/55 focus:outline-none"
            />
          </div>
        )}

        {/* loop-17 B — the unverified facts, carried into the seal. Auto-listed;
            a × drops one. Background-tint block (no left-accent bar — banned). On
            the check-in date the settle screen asks "did you check these?". */}
        {keptChecks.length > 0 && (
          <div className="mt-6 text-left rounded-lg bg-[var(--accent)]/[0.04] px-4 py-3">
            <p className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">
              {L('기록 전에 — 확인하면 좋은 것', 'Before saving — worth checking')}
            </p>
            <ul className="space-y-1.5">
              {keptChecks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-[12.5px] text-[var(--text-secondary)] leading-relaxed">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]/60" />
                  <span className="flex-1">
                    {c.text}
                    {c.where && <span className="text-[var(--text-tertiary)]">{L(` · ${c.where}에서 확인`, ` · check in ${c.where}`)}</span>}
                  </span>
                  <button
                    onClick={() => setDroppedChecks((s) => new Set(s).add(c.id))}
                    className="shrink-0 -mt-0.5 text-[14px] leading-none text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] px-1 cursor-pointer"
                    title={L('빼기', 'remove')}
                    aria-label={L('이 항목 빼기', 'remove this item')}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => seal()}
            disabled={kept.length === 0}
            className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-2xl text-[var(--accent-fg)] text-[14px] font-semibold disabled:opacity-50 cursor-pointer transition-transform duration-150 active:scale-[0.96]"
            style={{ background: 'var(--gradient-gold)' }}
          >
            <Check size={15} />
            {selectedKind === 'witness'
              ? L('이 원문 그대로 기록', 'Save exactly as written')
              : L(`판단 기록 확정 · ${dateFor(interval)}에 확인`, `Confirm this judgment · check on ${dateFor(interval)}`)}
          </button>
          <button
            onClick={() => {
              setDismissedLocally(true);
              setSealPromptDismissed(true);
              // A decline is as informative as an accept — the product learns
              // which decisions users don't want followed up.
              recordSignal({ project_id: project.id, tool: 'voyage', signal_type: 'seal_declined', signal_data: { predicates: kept.length } });
              track('decision_seal_declined', { predicates: kept.length });
            }}
            className="inline-flex items-center justify-center px-7 py-3 rounded-2xl text-[14px] font-medium text-[var(--text-secondary)] border border-[var(--border)] hover:border-[var(--text-secondary)]/40 cursor-pointer transition-colors"
          >
            {L('아니요, 괜찮아요', 'No, thanks')}
          </button>
        </div>

        {/* The editable drawer — auto draft is ready; this only refines it. */}
        <button
          onClick={() => setDrawerOpen((o) => !o)}
          className="mt-5 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors cursor-pointer"
        >
          {selectedKind === 'witness'
            ? L('함께 보관할 항목 보기', 'See what will be kept with it')
            : L('돌아올 때·함께 볼 항목 설정', 'Set the return and what to revisit')}
          <ChevronDown size={13} className={`transition-transform ${drawerOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {drawerOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="overflow-hidden"
            >
              <div className="pt-5 text-left max-w-md mx-auto">
                {selectedKind !== 'witness' && <DateChips interval={interval} onPick={setInterval} dateFor={dateFor} L={L} />}
                {selectedKind !== 'witness' && (
                  <label className="mt-4 block text-[12px] font-semibold text-[var(--text-secondary)]">
                    {L('이 일이 생기면 날짜보다 먼저 돌아오기 (선택)', 'Return when this happens, even before the date (optional)')}
                    <input
                      value={returnEvent}
                      onChange={(event) => setReturnEvent(event.target.value)}
                      maxLength={300}
                      placeholder={L('예: 최종 제안서를 받으면', 'Example: when the final offer arrives')}
                      className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-[13px] font-normal leading-5 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)]/55 focus:outline-none"
                    />
                  </label>
                )}
                <div className="mt-4">
                  <PredicateEditor
                    predicates={Array.isArray(predicates) ? predicates : []}
                    dropped={dropped}
                    onToggle={(id) => {
                      setDropped((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id); else next.add(id);
                        return next;
                      });
                    }}
                    L={L}
                  />
                </div>
                {kept.length === 0 && (
                  <p className="mt-2 text-[13px] text-amber-600 dark:text-amber-400">
                    {L('최소 1개는 남겨야 물어볼 수 있어요.', 'Keep at least one so I have something to ask about.')}
                  </p>
                )}
                {/* ── 확인일에 함께 볼 전제 (2026-07-30, 기획 2단계의 확인 표면) ──
                    봉인하면 분석이 짚은 가정들이 추적 목록(decision_items)에
                    저장된다. 그전까지는 **무엇이 저장되는지 봉인 전에 보여주는
                    자리가 없었다** — 위 술어 편집기는 계약의 술어만 다루고, 추적
                    풀에는 술어에 없는 문장(분석의 hidden_assumptions)도 들어간다.
                    보지 못한 것은 accept 도 deny 도 할 수 없다.
                    ×로 빼면 저장되지 않는다 (deny → 저장 안 함, MCP 픽커의
                    Decline 과 같은 의미). 전부 AI가 짚은 문장이므로 그렇게 말한다. */}
                {extraTrackedPremises.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[12px] font-semibold text-[var(--text-secondary)]">
                      {L('확인일에 함께 볼 전제 · AI가 분석에서 짚음', 'Premises to revisit · surfaced by the analysis')}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">
                      {L('바뀌면 알려드려요 — 종을 끄면 조용히 추적만 하고, ×로 빼면 추적하지 않아요.', 'You will hear when one moves — mute the bell to track quietly, remove with × to not track.')}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {extraTrackedPremises.map((item) => {
                        const watched = item.type === 'premise' && item.alert?.mode === 'on_change';
                        // 행의 정체성 = 풀의 원문. 고쳐 쓴 행은 edits[0].from 이 원문이다 —
                        // ×·종·수정이 전부 이 키로 움직여야 수정 후에도 스위치가 안 끊긴다.
                        const rowKey = item.edits?.[0]?.from || item.text;
                        const edited = editedPremiseTexts.has(rowKey);
                        const isEditing = editingPremiseKey === rowKey;
                        return (
                        <li key={item.id} className="flex items-start gap-2 rounded-lg bg-[var(--bg)]/60 px-3 py-2 text-[12.5px] leading-[1.5] text-[var(--text-secondary)]">
                          {isEditing ? (
                            /* 인라인 수정 (2026-07-30) — 고친 문장은 recordEdit('refine')로
                               저장돼 AI 원문이 이력에 남고 내 문장으로 승격된다. */
                            <input
                              autoFocus
                              defaultValue={item.text}
                              maxLength={400}
                              aria-label={L('전제 문장 고쳐 쓰기', 'rewrite this premise')}
                              className="flex-1 bg-transparent border-b border-[var(--accent)]/40 outline-none text-[12.5px] leading-[1.5] text-[var(--text-primary)] pb-0.5"
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') { setEditingPremiseKey(null); return; }
                                if (e.key !== 'Enter') return;
                                const next = (e.target as HTMLInputElement).value.trim();
                                setEditingPremiseKey(null);
                                if (next.length < 4 || next === item.text) return;
                                setEditedPremiseTexts((prev) => new Map(prev).set(rowKey, next));
                              }}
                              onBlur={(e) => {
                                const next = e.target.value.trim();
                                setEditingPremiseKey(null);
                                if (next.length < 4 || next === item.text) return;
                                setEditedPremiseTexts((prev) => new Map(prev).set(rowKey, next));
                              }}
                            />
                          ) : (
                          <span className="flex-1">
                            {item.text}
                            {item.type === 'open_question' && (
                              <span className="ml-1.5 text-[11px] text-[var(--text-tertiary)]">
                                {L('· 미결 질문으로 보관', '· kept as an open question')}
                              </span>
                            )}
                            {edited && (
                              <span className="ml-1.5 text-[11px] text-[var(--text-tertiary)]">
                                {L('· 내 문장으로 기록', '· recorded as your words')}
                              </span>
                            )}
                          </span>
                          )}
                          {!isEditing && (
                            <button
                              type="button"
                              onClick={() => setEditingPremiseKey(rowKey)}
                              className="shrink-0 -mt-0.5 px-1 text-[12px] leading-none text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer"
                              title={L('고쳐 쓰기', 'rewrite')}
                              aria-label={L('이 전제 고쳐 쓰기', 'rewrite this premise')}
                            >
                              ✎
                            </button>
                          )}
                          {/* 종 = 서버 감시 스위치 (2026-07-30). premise 만 —
                              미결 질문은 현실이 답해주지 않으니 종 대상이 아니다. */}
                          {item.type === 'premise' && (
                            <button
                              type="button"
                              aria-pressed={watched}
                              onClick={() => setBellOffTexts((prev) => {
                                const next = new Set(prev);
                                if (next.has(rowKey)) next.delete(rowKey); else next.add(rowKey);
                                return next;
                              })}
                              className={`shrink-0 -mt-0.5 px-1 text-[13px] leading-none cursor-pointer ${watched ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)] opacity-60'}`}
                              title={watched ? L('바뀌면 알림 — 끄려면 클릭', 'alerts on change — click to mute') : L('조용히 추적 — 켜려면 클릭', 'tracking quietly — click to watch')}
                              aria-label={watched ? L('이 전제 알림 끄기', 'mute alerts for this premise') : L('이 전제 알림 켜기', 'watch this premise for change')}
                            >
                              {watched ? '🔔' : '🔕'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDroppedPremiseTexts((prev) => new Set(prev).add(rowKey))}
                            className="shrink-0 -mt-0.5 px-1 text-[14px] leading-none text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer"
                            title={L('빼기', 'remove')}
                            aria-label={L('이 전제 추적하지 않기', 'do not track this premise')}
                          >
                            ×
                          </button>
                        </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
    )}
    </AnimatePresence>
  );
}

function KindChoice({
  value,
  onChange,
  L,
}: {
  value: DecisionKind;
  onChange: (kind: DecisionKind) => void;
  L: (k: string, e: string) => string;
}) {
  const choices: Array<{ value: DecisionKind; ko: string; en: string }> = [
    { value: 'prediction', ko: '현실에서 확인', en: 'Check against reality' },
    { value: 'commitment', ko: '내가 했는지 확인', en: 'Check what I did' },
    { value: 'declaration', ko: '나중에 다시 생각', en: 'Revisit my standard' },
    { value: 'witness', ko: '기록만 남기기', en: 'Keep only the record' },
  ];
  return (
    <fieldset className="mx-auto mt-5 max-w-xl">
      <legend className="sr-only">{L('이 기록으로 나중에 무엇을 할지', 'What this record should do later')}</legend>
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[var(--bg)] p-1.5 sm:grid-cols-4">
        {choices.map((choice) => {
          const selected = choice.value === value;
          return (
            <button
              key={choice.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(choice.value)}
              className={`min-h-10 rounded-xl px-2.5 py-2 text-[13px] font-semibold leading-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
                selected
                  ? 'bg-[var(--surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              }`}
            >
              {L(choice.ko, choice.en)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function DateChips({
  interval,
  onPick,
  dateFor,
  L,
}: {
  interval: CheckInInterval;
  onPick: (iv: CheckInInterval) => void;
  dateFor: (iv: CheckInInterval) => string;
  L: (k: string, e: string) => string;
}) {
  return (
    <div>
      <p className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">
        {L('언제 물어볼까요?', 'When should I ask?')}
      </p>
      <div className="flex flex-wrap gap-2">
        {INTERVALS.map((iv) => (
          <button
            key={iv.value}
            onClick={() => onPick(iv.value)}
            className={`px-3 py-1.5 rounded-lg text-[12.5px] font-medium border transition-colors cursor-pointer ${
              interval === iv.value
                ? 'border-[var(--accent)] bg-[var(--ai)] text-[var(--accent)]'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)]/40'
            }`}
          >
            {L(iv.ko, iv.en)} · {dateFor(iv.value)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Read + trim the auto-derived predictions. Surface language stays plain —
 *  "물어볼 것들" (the things I'll ask about), never 내기/predicate. */
function PredicateEditor({
  predicates,
  dropped,
  onToggle,
  L,
}: {
  predicates: Predicate[];
  dropped: Set<string>;
  onToggle: (id: string) => void;
  L: (k: string, e: string) => string;
}) {
  if (predicates.length === 0) return null;
  return (
    <div>
      <p className="text-[12px] font-semibold text-[var(--text-secondary)] mb-2">
        {L('그날 물어볼 것들', "What I'll ask you about")}
      </p>
      <ul className="space-y-1.5">
        {predicates.map((p) => {
          const Icon = SOURCE_ICON[p.source] ?? AlertTriangle;
          const off = dropped.has(p.id);
          return (
            <li key={p.id}>
              <button
                onClick={() => onToggle(p.id)}
                className={`w-full flex items-start gap-2 text-left rounded-lg border px-3 py-2.5 min-h-[44px] transition-colors cursor-pointer ${
                  off
                    ? 'border-[var(--border)] opacity-45 line-through'
                    : 'border-[var(--border)] hover:border-[var(--accent)]/40'
                }`}
              >
                <Icon size={13} className="text-[var(--text-tertiary)] mt-0.5 shrink-0" />
                <span className="flex-1 min-w-0 text-[12.5px] text-[var(--text-primary)] leading-[1.5]">{p.text}</span>
                <span className="text-[12.5px] text-[var(--text-tertiary)] shrink-0 mt-0.5">
                  {off ? L('뺌', 'off') : L('뺄까요?', 'remove?')}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
