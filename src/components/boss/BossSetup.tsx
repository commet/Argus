'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { TypeToggle } from './TypeToggle';
import { BehavioralToggle, type AnsweredAxes } from './BehavioralToggle';
import { useBossStore } from '@/stores/useBossStore';
import { AnimatedPlaceholder } from '@/components/ui/AnimatedPlaceholder';
import { getLocalizedPersonalityType } from '@/lib/boss/personality-types';
import { ArrowRight, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { SajuPreview } from './SajuPreview';
import { CollectionProgress } from './CollectionProgress';
import { BossConfirmation } from './BossConfirmation';
import { useT } from '@/contexts/LocaleProvider';
import { useLocale } from '@/hooks/useLocale';
import { track } from '@/lib/analytics';
import { classifyCrisis, type CrisisSignal } from '@/lib/crisis-gate';
import { CrisisConcernBanner } from '@/components/workspace/progressive/CrisisConcernBanner';

const EXAMPLE_SITUATIONS_KO = [
  '연봉 협상을 하고 싶은데요',
  '이번에 제가 잘한 건지 솔직히 알고 싶습니다',
  '회의를 좀 줄일 수 있을까요?',
  '재택근무를 좀 더 하고 싶은데요',
  '이 아이디어 한번 제안해보려고요',
  '일정이 2주 정도 밀릴 것 같습니다',
  '솔직히 요즘 좀 지쳐있습니다',
  '제가 이번에 리드 한번 맡아봐도 될까요?',
  '오늘 칼퇴 좀 해도 될까요',
  '다른 팀은 재택하던데 저희도 가능할까요',
  '이번 인센티브 기준이 좀 궁금해서요',
  '그 피드백 좀 다시 얘기해볼 수 있을까요',
  '퇴사를 고민하고 있습니다',
  '프로젝트 방향을 좀 재검토해보면 어떨까요',
  '제 업무 범위가 좀 애매한 것 같아서요',
];

const EXAMPLE_SITUATIONS_EN = [
  "I'd like to ask for a raise",
  "I honestly want to know if I did well this time",
  "Can we have fewer meetings?",
  "I'd like to work from home a bit more",
  "I want to pitch this idea",
  "The timeline might slip by about two weeks",
  "Honestly, I've been pretty burned out lately",
  "Could I take the lead on this one?",
  "Can I leave on time today?",
  "Other teams work remotely — could we?",
  "Curious about this cycle's incentive criteria",
  "Can we revisit that feedback?",
  "I'm thinking about leaving the company",
  "Could we reconsider the project direction?",
  "My scope of work feels a bit unclear",
];

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

const HINT_EXAMPLES_KO = [
  '예: 평소엔 좋은데 마감 가까우면 예민함',
  '예: 새로 온 임원이라 아직 어색함',
  '예: 데이터 좋아하는데 디자인은 약함',
  '예: 사적 얘기 잘 안 하는 편',
  '예: 회의 길어지면 짜증 냄',
];

const HINT_EXAMPLES_EN = [
  "e.g. usually fine, but tense near deadlines",
  "e.g. newly transferred — still warming up",
  "e.g. loves data, weak on design",
  "e.g. doesn't do small talk",
  "e.g. gets short when meetings run long",
];

export function BossSetup() {
  const t = useT();
  const locale = useLocale();
  const { axes, gender, birthYear, birthMonth, birthDay, sajuLoading, userContextHint, demoSituation, setupSituation: situation, setGender, setBirth, setUserContextHint, setDemoSituation, setSetupSituation: setSituation, loadSaju, startChat, addUserMessage } = useBossStore();
  const [isLaunching, setIsLaunching] = useState(false);
  const [confirmedSituation, setConfirmedSituation] = useState('');
  // Crisis backstop (crisis-gate.ts): the boss must not issue an authority verdict
  // (approved/rejected/conditional) on a self-harm / abuse / crisis input — incl.
  // the burnout prompts this UI itself seeds. On a clear signal we short-circuit to
  // a concern + a real resource (decision 3: warn, never hard-block — one conscious
  // override re-enters). Not a verdict about the user; the trigger is never shown.
  const [crisis, setCrisis] = useState<CrisisSignal | null>(null);
  // Default to "easy" mode — workplace-language quiz. Power users / Korean MBTI fans
  // can flip to MBTI-direct toggle. Both modes share the same axis state.
  const [axisMode, setAxisMode] = useState<'easy' | 'mbti'>('easy');
  const [showBossDetails, setShowBossDetails] = useState(false);
  // Lifted from BehavioralToggle so flipping Easy ↔ MBTI does not lose progress.
  const [answeredAxes, setAnsweredAxes] = useState<AnsweredAxes>({
    ei: false, sn: false, tf: false, jp: false,
  });
  const demoConsumedRef = useRef(false);

  const typeCode = `${axes.ei}${axes.sn}${axes.tf}${axes.jp}`;
  const answeredCount = (['ei', 'sn', 'tf', 'jp'] as const).filter((k) => answeredAxes[k]).length;
  const typeData = getLocalizedPersonalityType(typeCode, locale);
  const examples = locale === 'ko' ? EXAMPLE_SITUATIONS_KO : EXAMPLE_SITUATIONS_EN;
  const hintExamples = locale === 'ko' ? HINT_EXAMPLES_KO : HINT_EXAMPLES_EN;
  const birthYearValid = birthYear >= 1940 && birthYear <= 2006;
  const birthMonthValid = birthMonth >= 1 && birthMonth <= 12;
  const birthDayValid = birthDay >= 1 && birthDay <= 31;

  const launch = useCallback((trimmed: string) => {
    setConfirmedSituation(trimmed);
    setIsLaunching(true);
    addUserMessage(trimmed);
    track('boss_setup_complete', {
      mbti: typeCode,
      gender,
      hasBirthYear: birthYearValid,
      hasBirthMonth: birthMonthValid,
      hasBirthDay: birthDayValid,
      situation_length: trimmed.length,
    });
    // Fire Saju in background — confirmation panel shows loader until it lands.
    loadSaju();
  }, [loadSaju, addUserMessage, typeCode, gender, birthYearValid, birthMonthValid, birthDayValid]);

  const handleSubmit = useCallback(async () => {
    if (!situation.trim() || isLaunching) return;
    const trimmed = situation.trim();
    // Crisis backstop fires BEFORE any verdict machinery: a roleplayed authority
    // must not "approve/reject" a self-harm/abuse/crisis input.
    const sig = classifyCrisis(trimmed);
    if (sig.isCrisis) {
      setCrisis(sig);
      track('boss_crisis_gated', { category: sig.category });
      return;
    }
    launch(trimmed);
  }, [situation, isLaunching, launch]);

  // Conscious override (decision 3): the user has seen the concern + resource and
  // chooses to rehearse anyway. The concern stays surfaced; we do not re-gate.
  const handleCrisisOverride = useCallback(() => {
    const trimmed = situation.trim();
    if (!trimmed) return;
    track('boss_crisis_override');
    launch(trimmed);
  }, [situation, launch]);

  // Demo path: AutoDemo on /boss?demo=... pre-populates axes/birth and writes
  // a sample situation into the store. Consume it once, prefill the textarea,
  // then auto-submit on next tick so the visitor lands in chat without setup.
  useEffect(() => {
    if (!demoSituation || demoConsumedRef.current) return;
    demoConsumedRef.current = true;
    setSituation(demoSituation);
    setDemoSituation(null);
    const t = setTimeout(() => {
      // Use latest closure of handleSubmit by deferring through state read.
      const { setIsLaunching: _ } = { setIsLaunching: setIsLaunching };
      if (!isLaunching) {
        const trimmed = demoSituation.trim();
        const sig = classifyCrisis(trimmed);
        if (sig.isCrisis) {
          setCrisis(sig);
          return;
        }
        setConfirmedSituation(trimmed);
        setIsLaunching(true);
        addUserMessage(trimmed);
        track('boss_demo_started', {
          mbti: typeCode,
          situation_length: trimmed.length,
        });
        loadSaju();
      }
      void _;
    }, 250);
    return () => clearTimeout(t);
  }, [demoSituation, demoConsumedRef, setDemoSituation, setSituation, isLaunching, addUserMessage, loadSaju, typeCode]);

  const handleConfirmContinue = useCallback(() => {
    track('boss_chat_initiated', {
      mbti: typeCode,
      hasBirthData: birthYearValid,
      sawConfirmation: true,
    });
    startChat();
  }, [typeCode, birthYearValid, startChat]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isReady = situation.trim().length > 0;

  const situationInput = (
    <motion.div className="bs-input-block" variants={fadeUp}>
      <label
        htmlFor="bs-situation"
        style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}
      >
        {locale === 'ko' ? '어떤 대화를 앞두고 있나요?' : 'What conversation are you preparing for?'}
      </label>
      <div className="bs-input-wrap">
        <textarea
          id="bs-situation"
          value={situation}
          onChange={(e) => { setSituation(e.target.value); if (crisis) setCrisis(null); }}
          onKeyDown={handleKeyDown}
          className="bs-textarea"
          rows={3}
          maxLength={500}
        />
        <AnimatedPlaceholder
          texts={examples}
          visible={!situation}
          interval={2800}
          className="bs-placeholder"
        />
      </div>

      <div className="bs-hint-row">
        <label className="bs-hint-label" htmlFor="bs-hint">
          {locale === 'ko' ? '팀장 반응에 영향을 줄 특성 (선택)' : 'A trait that may shape your manager’s response (optional)'}
        </label>
        <div className="bs-hint-wrap">
          <input
            id="bs-hint"
            type="text"
            value={userContextHint}
            onChange={(e) => setUserContextHint(e.target.value.slice(0, 140))}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v.length > 0) track('boss_hint_typed', { length: v.length });
            }}
            className="bs-hint-input"
            maxLength={140}
            autoComplete="off"
          />
          <AnimatedPlaceholder
            texts={hintExamples}
            visible={!userContextHint}
            interval={3400}
            className="bs-hint-placeholder"
          />
        </div>
      </div>
      {crisis?.isCrisis && (
        <CrisisConcernBanner
          crisis={crisis}
          locale={locale}
          blocking={true}
          onContinue={handleCrisisOverride}
        />
      )}
      <div className="bs-cta-row">
        <p className="bs-fine">
          {t('boss.disclaimer')}
          <span className="block mt-1">
            {locale === 'ko'
              ? '작성 중인 초안은 이 브라우저에 30일 동안 자동 저장됩니다.'
              : 'Your draft is saved in this browser for up to 30 days.'}
          </span>
        </p>
        <motion.button
          type="button"
          onClick={handleSubmit}
          disabled={!isReady || isLaunching}
          className="bs-cta"
          whileTap={isReady ? { scale: 0.97 } : {}}
        >
          {isLaunching ? (
            <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.2 }}>
              {t('boss.summoning')}
            </motion.span>
          ) : (
            <>
              {locale === 'ko' ? '대화 리허설 시작' : 'Start conversation rehearsal'}
              <ArrowRight size={16} strokeWidth={2.5} />
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );

  if (isLaunching && typeData) {
    return (
      <BossConfirmation
        typeData={typeData}
        situation={confirmedSituation}
        birthYear={birthYear}
        birthMonth={birthMonthValid ? birthMonth : undefined}
        birthDay={birthDayValid ? birthDay : undefined}
        sajuLoading={sajuLoading}
        onContinue={handleConfirmContinue}
      />
    );
  }

  return (
    <motion.div
      className="bs"
      variants={stagger}
      // initial={false}: mount directly at the visible "show" state instead of
      // "hidden" (opacity:0). This is a required screen — if the staggered
      // enter animation fails to propagate to the fadeUp children they must
      // never be left invisible (P0 render trap). Exit animation is preserved.
      initial={false}
      animate="show"
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.3 } }}
    >
      {/* ── Hero (compact) ── */}
      <motion.div className="bs-hero" variants={fadeUp}>
        <h1 className="bs-title">
          {t('boss.heroTitle')} <span className="bs-title-accent">{t('boss.heroAccent')}</span>
        </h1>
        <p className="bs-sub">{t('boss.heroSub')}</p>
      </motion.div>

      {situationInput}

      <motion.button
        type="button"
        className="bs-customize-toggle"
        variants={fadeUp}
        onClick={() => setShowBossDetails((open) => !open)}
        aria-expanded={showBossDetails}
      >
        <SlidersHorizontal size={15} />
        <span className="bs-customize-copy">
          <strong>{locale === 'ko' ? '팀장 반응 더 현실적으로 맞추기' : 'Make the manager response more realistic'}</strong>
          <small>{typeData ? `${typeData.name} · ${typeData.bossVibe}` : (locale === 'ko' ? '선택 설정' : 'Optional settings')}</small>
        </span>
        <ChevronDown size={15} className={showBossDetails ? 'rotate-180' : ''} />
      </motion.button>

      <AnimatePresence initial={false}>
        {showBossDetails && (
          <motion.div
            key="boss-details"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24 }}
            className="bs-customize-panel"
          >
            <CollectionProgress />
            {/* ── MBTI selector ── */}
            <motion.div className="bs-type-section" variants={fadeUp}>
        <div className="bs-mode-row">
          <p className="text-[12px] text-[var(--text-tertiary)]">{t('boss.typeHint')}</p>
          <div className="bs-mode-toggle" role="group" aria-label={locale === 'ko' ? '입력 방식' : 'Input mode'}>
            <button
              type="button"
              onClick={() => {
                if (axisMode !== 'easy') {
                  const answeredCount = (['ei','sn','tf','jp'] as const).filter(k => answeredAxes[k]).length;
                  track('boss_axis_mode_switched', { from: axisMode, to: 'easy', answered_axes: answeredCount });
                  setAxisMode('easy');
                }
              }}
              data-active={axisMode === 'easy'}
              aria-pressed={axisMode === 'easy'}
            >
              {locale === 'ko' ? '🤔 쉽게' : '🤔 Easy'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (axisMode !== 'mbti') {
                  const answeredCount = (['ei','sn','tf','jp'] as const).filter(k => answeredAxes[k]).length;
                  track('boss_axis_mode_switched', { from: axisMode, to: 'mbti', answered_axes: answeredCount });
                  setAxisMode('mbti');
                }
              }}
              data-active={axisMode === 'mbti'}
              aria-pressed={axisMode === 'mbti'}
            >
              {locale === 'ko' ? '🎯 MBTI' : '🎯 MBTI'}
            </button>
          </div>
        </div>
        {axisMode === 'easy' ? (
          <BehavioralToggle
            answered={answeredAxes}
            onAnswered={(key) => setAnsweredAxes((s) => ({ ...s, [key]: true }))}
          />
        ) : (
          <TypeToggle />
        )}

        {/* Personality — always visible card */}
        <AnimatePresence mode="wait">
          {typeData && (
            <motion.div
              key={typeCode}
              className="bs-persona-card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="bs-persona-header">
                <span className="bs-persona-emoji">{typeData.emoji}</span>
                <div className="bs-persona-info">
                  <span className="bs-persona-name">{typeData.name}</span>
                  <span className="bs-persona-vibe">{typeData.bossVibe}</span>
                </div>
              </div>
              {/* The card always shows a fully-formed boss (defaults to ESTJ),
                  which reads as "already set" even at 0/4. Say it's a default
                  so the user knows answering the quiz changes it. */}
              {axisMode === 'easy' && answeredCount === 0 && (
                <p style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '0 0 8px', lineHeight: 1.4 }}>
                  {locale === 'ko'
                    ? '기본값이에요 — 위 질문에 답하면 이 팀장이 바뀌어요'
                    : "This is the default — answer above to shape this boss"}
                </p>
              )}
              <div className="bs-persona-speech">&ldquo;{typeData.speechPatterns[0]}&rdquo;</div>
              <div className="bs-persona-traits">
                <span className="bs-persona-trait">{typeData.shortDesc}</span>
                <span className="bs-persona-trait bs-persona-trait--accent">🎯 {typeData.triggers.split(',')[0].trim()}</span>
              </div>

              {/* Gender + Birth — 이면 공개 레이어 */}
              <div className="bs-persona-meta">
                <div className="bs-meta-header">
                  <span className="bs-meta-title">
                    <span className="bs-meta-sparkle">✨</span>
                    <span>{t('boss.insideTitle')}</span>
                  </span>
                  <span className="bs-meta-hint">
                    {birthYearValid
                      ? (birthMonthValid ? t('boss.birthHintFull') : t('boss.birthHintMonth'))
                      : t('boss.birthHintNone')}
                  </span>
                </div>
                <div className="bs-meta-row">
                  <div className="bs-gender">
                    {(['남', '여'] as const).map((g) => (
                      <button key={g} type="button" onClick={() => setGender(g)} className="bs-gen-btn" data-active={gender === g}>
                        {locale === 'ko' ? g : (g === '남' ? 'M' : 'F')}
                      </button>
                    ))}
                  </div>
                  <div className="bs-birth" data-valid={birthYearValid}>
                    <input
                      type="number"
                      placeholder="1990"
                      value={birthYear || ''}
                      onChange={(e) => setBirth(Number(e.target.value), birthMonth, birthDay)}
                      className="bs-num bs-num-y"
                      min={1940}
                      max={2006}
                      aria-label={t('boss.yearLabel')}
                    />
                    <span className="bs-num-suffix">{t('boss.yearSuffix')}</span>
                    <span className="bs-dot">·</span>
                    <input
                      type="number"
                      placeholder="6"
                      value={birthMonth || ''}
                      onChange={(e) => setBirth(birthYear, Number(e.target.value), birthDay)}
                      className="bs-num bs-num-m"
                      min={1}
                      max={12}
                      disabled={!birthYearValid}
                      aria-label={t('boss.monthLabel')}
                    />
                    <span className="bs-num-suffix">{t('boss.monthSuffix')}</span>
                  </div>
                </div>
                {birthYear > 0 && !birthYearValid && (
                  <p className="bs-meta-warn">{t('boss.yearRangeError')}</p>
                )}
                <SajuPreview year={birthYear} month={birthMonth} day={birthDay} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
