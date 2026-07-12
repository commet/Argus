'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, RotateCcw, Bookmark, Check, ArrowRight } from 'lucide-react';
import { LocaleLink } from '@/components/ui/LocaleLink';
import { ChatMessage } from './ChatMessage';
import { PostVerdictPanel } from './PostVerdictPanel';
import { VerdictShareCard } from './VerdictShareCard';
import { recordCollection } from './CollectionProgress';
import { useBossStore } from '@/stores/useBossStore';
import { callLLMStream } from '@/lib/llm';
import { buildBossSystemPrompt, buildBossSystemPromptFromAgent, buildFirstMessageContext, buildFollowUpContext, type BossMood } from '@/lib/boss/boss-prompt';
import { useAgentStore } from '@/stores/useAgentStore';
import { applyBossCalibration, applyExplicitCalibration } from '@/lib/observation-engine';
import { track } from '@/lib/analytics';
import { useAuth } from '@/lib/auth';
import { AnimatedPlaceholder } from '@/components/ui/AnimatedPlaceholder';
import { getLocalizedPersonalityType, getPersonalityType as getType } from '@/lib/boss/personality-types';
import { getYearElement } from '@/lib/boss/saju-interpreter';
import { DailyMoodIndicator } from './DailyMoodIndicator';
import { PastVerdictRecap } from './PastVerdictRecap';
import { getCurrentLanguage } from '@/lib/i18n';
import { useT } from '@/contexts/LocaleProvider';
import { useLocale } from '@/hooks/useLocale';
import { withLocale } from '@/lib/locale-path';

// ─── 대화 온도 추적 ───

type Reaction = 'strong' | 'weak' | 'emotional' | 'passive' | 'neutral';

// 근거/논리가 있는 발언
const STRONG_SIGNALS_KO = [
  '데이터', '숫자', '근거', '조사', '사례', '계획', '대안', '비교', '분석', '수치',
  '기한', '마감', '성과', '매출', '실적', '제안', '경쟁사', '오퍼', '시장',
  '왜냐하면', '이유는', '기준', '원칙', '합리', '논리', '따지면',
  '준비', '확인', '검토', '일하고 싶', '기여', '책임',
];
const STRONG_SIGNALS_EN = [
  'data', 'number', 'evidence', 'research', 'case', 'plan', 'alternative', 'compared', 'analysis', 'metric',
  'deadline', 'result', 'revenue', 'proposal', 'competitor', 'offer', 'market',
  'because', 'reason', 'criteria', 'principle', 'rational', 'logic',
  'prepared', 'verified', 'reviewed', 'contribute', 'responsibility',
];
// 감정적 발언 (캐주얼/감정 공존)
const EMOTIONAL_SIGNALS_KO = ['힘들', '지쳐', '불안', '걱정', '화나', '답답', '솔직히', '속상'];
const EMOTIONAL_SIGNALS_EN = ['tired', 'exhausted', 'anxious', 'worried', 'frustrated', 'honestly', 'upset', 'burned out'];
// 수동적/짧은 수용
const PASSIVE_SIGNALS_KO = ['네', '알겠', '그렇죠', 'ㅇㅇ', '넵', '네네', '그럴게'];
const PASSIVE_SIGNALS_EN = ['ok', 'okay', 'sure', 'got it', 'yeah', 'yep', 'fine', 'alright', 'noted'];

function getStrongSignals(): string[] {
  return getCurrentLanguage() === 'ko' ? STRONG_SIGNALS_KO : [...STRONG_SIGNALS_EN, ...STRONG_SIGNALS_KO];
}
function getEmotionalSignals(): string[] {
  return getCurrentLanguage() === 'ko' ? EMOTIONAL_SIGNALS_KO : [...EMOTIONAL_SIGNALS_EN, ...EMOTIONAL_SIGNALS_KO];
}
function getPassiveSignals(): string[] {
  return getCurrentLanguage() === 'ko' ? PASSIVE_SIGNALS_KO : [...PASSIVE_SIGNALS_EN, ...PASSIVE_SIGNALS_KO];
}

function classifyReaction(text: string): Reaction {
  const t = text.toLowerCase().trim();
  const len = t.length;

  // 극히 짧은 답변(10자 이하) = 수동적
  if (len <= 10 && getPassiveSignals().some(kw => t.includes(kw))) return 'passive';

  // 감정적 발언
  const emotionalHits = getEmotionalSignals().filter(kw => t.includes(kw)).length;
  if (emotionalHits >= 2 || (emotionalHits >= 1 && len < 30)) return 'emotional';

  // 근거/논리
  const strongHits = getStrongSignals().filter(kw => t.includes(kw)).length;
  if (strongHits >= 2) return 'strong';
  // 긴 답변(50자+)은 노력의 신호 — strong 1개만 있어도 인정
  if (strongHits >= 1 && len >= 50) return 'strong';
  // 긴 답변 자체가 설득 노력 (키워드 없어도)
  if (len >= 80) return 'strong';

  // 짧고 키워드 없음 = neutral (캐주얼 대화 포함)
  return 'neutral';
}

// Cosmetic on-screen demeanor ONLY (avatar ring / vibe text). The verdict is
// never derived from this — see the spine note at the buildFollowUpContext call.
// §2.4-6: the round-7 auto-flip (warming→convinced / cooling→rejected / a bare
// neutral chat → 'convinced') was removed. That hard counter forced a directional
// verdict regardless of content — the un-launderable engine-weighted lean the
// stress rounds flagged. The boss now concludes only when the LLM reads enough in
// the actual conversation; this function never produces 'convinced'/'rejected'.
function updateMood(current: BossMood, reaction: Reaction): BossMood {
  if (current === 'convinced' || current === 'rejected') return current;

  // 강한 논거 → warming
  if (reaction === 'strong') {
    if (current === 'cooling') return 'neutral';
    return 'warming';
  }

  // 감정적 → 약간 warming (진심이 보이므로)
  if (reaction === 'emotional') {
    if (current === 'cooling') return 'neutral';
    // 이미 warming이면 유지, neutral이면 약간 warming
    return current === 'neutral' ? 'warming' : current;
  }

  // 수동적 → 약간 cooling (대화에 참여 안 함)
  if (reaction === 'passive') {
    if (current === 'warming') return 'neutral';
    return 'cooling';
  }

  // neutral → 변화 없음 (캐주얼 대화 시 과잉 반응 방지)
  return current;
}

// 업무/의사결정 관련 대화인지 감지 (키워드 3개 이상 매칭 시 true)
const WORK_SIGNALS_KO = [
  '기획', '보고', '제안', '예산', '일정', '프로젝트', '전략', '실행',
  '검토', '승인', '피드백', '수정', '방향', '목표', '성과', '발표',
  '회의', '결정', '판단', '계획', '분석', '데이터', '숫자', '시장',
  '고객', '매출', '비용', '투자', '경쟁', '리스크', '문서', '슬라이드',
  '부족', '다시 해', '이 부분', '보완', '개선', '준비', '마감',
];

const WORK_SIGNALS_EN = [
  'plan', 'report', 'proposal', 'budget', 'schedule', 'project', 'strategy', 'execution',
  'review', 'approval', 'feedback', 'revise', 'direction', 'goal', 'result', 'presentation',
  'meeting', 'decision', 'analysis', 'data', 'market',
  'customer', 'revenue', 'cost', 'investment', 'competition', 'risk', 'document', 'slide',
  'deadline', 'improve', 'preparation',
];

function isWorkRelated(messages: Array<{ role: string; content: string }>): boolean {
  const allText = messages.map(m => m.content).join(' ').toLowerCase();
  const signals = getCurrentLanguage() === 'ko' ? WORK_SIGNALS_KO : [...WORK_SIGNALS_EN, ...WORK_SIGNALS_KO];
  const hits = signals.filter(kw => allText.includes(kw));
  return hits.length >= 3;
}

const FOLLOW_UP_NEUTRAL_KO = [
  '그래도 저는 할 말은 해야겠는데요',
  '진짜요? 다른 팀은 안 그러던데',
  '그건 좀 아닌 것 같은데...',
  '알겠습니다... 근데 한 가지만 더요',
  '솔직히 말해도 되는 겁니까',
  '그 말씀은 좀 너무하신 것 같은데요',
];

const FOLLOW_UP_WARMING_KO = [
  '구체적인 숫자를 더 준비해왔는데요',
  '사실 이것 말고도 하나 더 말씀드릴 게 있어요',
  '그 부분은 이렇게 해결할 수 있을 것 같습니다',
  '감사합니다, 추가로 제안 하나만 더요',
];

const FOLLOW_UP_COOLING_KO = [
  '잠깐만요, 근거를 하나 더 말씀드려도 될까요',
  '다른 각도에서 다시 설명드리겠습니다',
  '제가 좀 더 준비해서 다시 말씀드릴게요',
  '아, 그 부분은 제가 잘못 전달한 것 같습니다',
];

const FOLLOW_UP_NEUTRAL_EN = [
  "I still need to make my case, though",
  "Really? Other teams don't seem to do that",
  "I'm not sure that sits right with me...",
  "Understood... but one more thing",
  "Can I be honest here?",
  "That feels a bit harsh, if I can say so",
];

const FOLLOW_UP_WARMING_EN = [
  "I've prepared more concrete numbers",
  "Actually there's one more thing I wanted to mention",
  "I think we can solve that part like this",
  "Thanks — one more proposal if I may",
];

const FOLLOW_UP_COOLING_EN = [
  "Wait — can I add one more reason?",
  "Let me explain from a different angle",
  "I'll prepare more and come back to this",
  "Ah, I think I miscommunicated that part",
];

function getFollowUps(mood: BossMood): string[] {
  if (mood === 'warming' || mood === 'convinced') return getCurrentLanguage() === 'ko' ? FOLLOW_UP_WARMING_KO : FOLLOW_UP_WARMING_EN;
  if (mood === 'cooling' || mood === 'rejected') return getCurrentLanguage() === 'ko' ? FOLLOW_UP_COOLING_KO : FOLLOW_UP_COOLING_EN;
  return getCurrentLanguage() === 'ko' ? FOLLOW_UP_NEUTRAL_KO : FOLLOW_UP_NEUTRAL_EN;
}

// Extract the trailing verdict JSON the boss appends. The old single regex
// (`{[^{}]*"verdict"...}`) failed silently whenever `reason` contained a brace
// or the JSON was slightly malformed — leaving the user with no verdict. This
// grabs the final {...} block, then falls back to field-level regexes if
// JSON.parse fails, and returns the message text with that block removed.
function extractVerdict(
  raw: string,
): { verdict: { verdict: string; reason: string; tip?: string }; clean: string } | null {
  if (!raw.includes('"verdict"')) return null;
  const end = raw.lastIndexOf('}');
  if (end === -1) return null;
  const start = raw.lastIndexOf('{', end);
  if (start === -1) return null;
  const block = raw.slice(start, end + 1);
  const vm = block.match(/"verdict"\s*:\s*"(approved|rejected|conditional)"/);
  if (!vm) return null;

  let verdict: string = vm[1];
  let reason = '';
  let tip: string | undefined;
  try {
    const parsed = JSON.parse(block);
    verdict = parsed.verdict || vm[1];
    reason = parsed.reason || '';
    tip = parsed.tip || undefined;
  } catch {
    reason = block.match(/"reason"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] ?? '';
    tip = block.match(/"tip"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1] || undefined;
  }
  const clean = (raw.slice(0, start) + raw.slice(end + 1)).trim();
  return { verdict: { verdict, reason, tip }, clean };
}

export function BossChat() {
  const {
    axes, gender, birthYear, sajuProfile, yearMonthProfile, zodiacProfile,
    messages, isStreaming, streamingText,
    setStreaming, updateStreamingText, commitAssistantMessage,
    addUserMessage, reset,
    loadedAgentId, saveAsAgent,
  } = useBossStore();

  const locale = useLocale();
  const t = useT();
  const L = (k: string, e: string) => (locale === 'ko' ? k : e);
  const { user } = useAuth();
  const isAnon = !user;
  const [input, setInput] = useState('');
  const [saved, setSaved] = useState(!!useBossStore.getState().loadedAgentId);
  const [ctaDismissed, setCtaDismissed] = useState(false);
  const [bossState, setBossState] = useState<'idle' | 'reading' | 'typing'>('idle');
  const [calibrationStep, setCalibrationStep] = useState<'none' | 'similarity' | 'detail' | 'done'>('none');
  const [bossMood, setBossMood] = useState<BossMood>('neutral');
  const [shareMode, setShareMode] = useState(false);
  // Two-tap reset guard — a single click used to wipe the whole conversation
  // with no confirmation. First tap arms (3s), second tap actually resets.
  const [resetArmed, setResetArmed] = useState(false);
  const [verdict, setVerdict] = useState<{ verdict: string; reason: string; tip?: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const postVerdictRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const hasTriggeredFirst = useRef(false);
  // Set by the "여기까지" button — consumed (and cleared) by the next LLM call
  // so the boss issues a verdict in the next reply instead of asking another
  // question.
  const forceVerdictRef = useRef(false);

  const typeCode = `${axes.ei}${axes.sn}${axes.tf}${axes.jp}`;
  const typeData = getLocalizedPersonalityType(typeCode, locale);
  const elementInfo = getYearElement(birthYear);
  const ymp = yearMonthProfile;
  // 저장된 팀장이면 관찰 개수 (구체성 지표)
  const loadedAgent = useAgentStore(s => loadedAgentId ? s.agents.find(a => a.id === loadedAgentId) : undefined);
  const observationCount = loadedAgent?.observations?.length ?? 0;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // When a verdict lands, the most distinctive moment of the product is the
  // inner-monologue (이면) card. Pull it into view so the user does not miss it.
  useEffect(() => {
    if (!verdict) return;
    const t = setTimeout(() => {
      postVerdictRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 700);
    return () => clearTimeout(t);
  }, [verdict]);

  // Esc dismisses an open calibration step — keyboard users get out without
  // accidentally clicking a rating just to make it go away.
  useEffect(() => {
    if (calibrationStep !== 'similarity' && calibrationStep !== 'detail') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setCalibrationStep('none');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [calibrationStep]);

  // Calibration ("얼마나 비슷해?") is NOT auto-fired. Pushing a rating prompt in
  // on a 5s timer right as the verdict lands grades the user at the emotional
  // peak — the mirror-clause over-fire the spine forbids (don't push engagement
  // when "do nothing" is right). It now surfaces only on the user's explicit
  // Save action (which sets calibrationStep). Anon visitors who don't save
  // simply aren't interrupted — losing that analytics signal is the correct
  // trade against the spine.

  // 컴포넌트 언마운트 시 패시브 교정 자동 적용
  useEffect(() => {
    return () => {
      const { loadedAgentId: agentId, messages: msgs } = useBossStore.getState();
      if (agentId && msgs.length >= 4) {
        applyBossCalibration(agentId, msgs);
      }
    };
  }, []);

  useEffect(() => {
    if (messages.length === 1 && messages[0].role === 'user' && !hasTriggeredFirst.current) {
      hasTriggeredFirst.current = true;
      sendToLLM(messages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const sendToLLM = useCallback(async (chatMessages: typeof messages, retry = 0) => {
    if (!typeData) return;

    const isFirst = chatMessages.length === 1;
    const round = Math.floor(chatMessages.filter(m => m.role === 'user').length);

    // mood를 동기적으로 계산 (setState 비동기 문제 해결)
    let currentMood = bossMood;
    const lastUserMsg = [...chatMessages].reverse().find(m => m.role === 'user');
    if (lastUserMsg && !isFirst) {
      const reaction = classifyReaction(lastUserMsg.content);
      currentMood = updateMood(currentMood, reaction);
      setBossMood(currentMood); // 화면 데메이너용(아바타 링/바이브) — 판정에는 안 쓰임
    }

    // Agent에서 로드된 boss면 agent 프롬프트 사용 (Lv.2+ observation 주입)
    const agent = loadedAgentId ? useAgentStore.getState().getAgent(loadedAgentId) : undefined;
    const bossLocale: 'ko' | 'en' = (agent?.boss_locale as 'ko' | 'en') ?? (locale === 'ko' ? 'ko' : 'en');

    const consumeForceVerdict = forceVerdictRef.current;
    if (consumeForceVerdict) forceVerdictRef.current = false;
    // Spine (§2.4-6): the verdict must be the LLM's read of the ACTUAL
    // conversation — never tilted by a client-side keyword counter. `currentMood`
    // still drives the boss's cosmetic on-screen demeanor, but the verdict-bearing
    // prompt always receives a neutral mood so no keyword-derived lean
    // ("you're persuaded" / "their reasoning is thin") pre-tilts the conclusion.
    const contextSuffix = isFirst
      ? buildFirstMessageContext(bossLocale)
      : buildFollowUpContext(round, 'neutral', bossLocale, consumeForceVerdict);

    const zodiac = useBossStore.getState().zodiacProfile;
    const userContextHint = useBossStore.getState().userContextHint;
    const system = (agent?.personality_profile
      ? buildBossSystemPromptFromAgent(agent)
      : buildBossSystemPrompt({ type: typeData, saju: sajuProfile, yearMonth: yearMonthProfile, zodiac, gender, locale: bossLocale, userContextHint })
    ) + contextSuffix;
    const llmMessages = chatMessages.map((m) => ({ role: m.role, content: m.content }));

    abortRef.current = new AbortController();

    // "읽는 중" → 짧은 딜레이 → "타이핑" (첫 메시지는 빠르게)
    setBossState('reading');
    setStreaming(true);
    const readDelay = isFirst ? 250 : 300 + Math.random() * 300;
    await new Promise(r => setTimeout(r, readDelay));
    if (abortRef.current?.signal.aborted) return;
    setBossState('typing');

    await callLLMStream(
      llmMessages,
      { system, maxTokens: 350, signal: abortRef.current.signal },
      {
        onToken: (text) => updateStreamingText(text),
        onComplete: () => {
          // Verdict JSON 추출 (응답 끝에 있을 수 있음) — tolerant parse so a
          // verdict never silently vanishes on a brace/quote in the reason.
          const raw = useBossStore.getState().streamingText;
          const ext = extractVerdict(raw);
          if (ext) {
            setVerdict(ext.verdict);
            const tc = `${useBossStore.getState().axes.ei}${useBossStore.getState().axes.sn}${useBossStore.getState().axes.tf}${useBossStore.getState().axes.jp}`;
            const tp = getType(tc);
            recordCollection({
              typeCode: tc,
              verdict: ext.verdict.verdict as 'approved' | 'rejected' | 'conditional',
              situation: useBossStore.getState().lastSituation,
              completedAt: new Date().toISOString(),
              emoji: tp?.emoji || '👔',
            });
            track('boss_verdict_received', {
              verdict: ext.verdict.verdict,
              mbti: tc,
              turns: useBossStore.getState().messages.length,
              triggered_by: consumeForceVerdict ? 'force' : (round >= 7 ? 'late' : 'natural'),
            });
            useBossStore.getState().updateStreamingText(ext.clean);
          }
          // Per-turn metric — count + length of the assistant message just committed.
          const turnIdx = useBossStore.getState().messages.length; // 0-based count BEFORE commit
          const turnText = useBossStore.getState().streamingText;
          track('boss_chat_turn', { turn_index: turnIdx + 1, message_length: turnText.length });
          commitAssistantMessage();
          setBossState('idle');
        },
        onError: async (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          const isOverloaded = msg.includes('과부하') || msg.includes('503') || msg.includes('529') || msg.includes('서버') || msg.toLowerCase().includes('overloaded') || msg.toLowerCase().includes('server');
          const ko = locale === 'ko';
          if (isOverloaded && retry < 2) {
            console.warn(`[boss] overloaded, retry ${retry + 1}...`);
            updateStreamingText(ko ? '잠시만...' : 'One moment...');
            await new Promise((r) => setTimeout(r, 2000 * (retry + 1)));
            sendToLLM(chatMessages, retry + 1);
            return;
          }

          console.error('[boss] LLM error:', msg);
          if (msg.includes('LOGIN_REQUIRED') || msg.includes('로그인')) {
            updateStreamingText(ko
              ? '로그인이 필요해요. 무료 체험 횟수를 다 썼을 수 있어요.'
              : "Please sign in — you may have used up your free tries.");
          } else if (msg.includes('사용량') || msg.includes('429') || msg.includes('한도') || msg.toLowerCase().includes('rate')) {
            updateStreamingText(ko
              ? '오늘 사용량을 다 썼어요. 설정에서 API 키를 입력하면 계속 쓸 수 있어요.'
              : "You've used up today's quota. Add your API key in Settings to keep going.");
          } else {
            updateStreamingText(ko
              ? '연결 오류가 발생했어요. 잠시 후 다시 시도해주세요.'
              : 'Connection error. Please try again in a moment.');
          }
          commitAssistantMessage();
          setBossState('idle');
        },
      },
    );
  }, [typeData, sajuProfile, yearMonthProfile, gender, bossMood, loadedAgentId, setStreaming, updateStreamingText, commitAssistantMessage, locale]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    addUserMessage(text);
    const updated = [...messages, { id: `u-${Date.now()}`, role: 'user' as const, content: text, timestamp: Date.now() }];
    sendToLLM(updated);
  }, [input, isStreaming, addUserMessage, messages, sendToLLM]);

  const handleForceVerdict = useCallback(() => {
    if (isStreaming || verdict) return;
    const text = locale === 'ko' ? '여기까지 듣고 결정 부탁드려요.' : 'Make the call from what you have so far.';
    forceVerdictRef.current = true;
    addUserMessage(text);
    const updated = [...messages, { id: `u-${Date.now()}`, role: 'user' as const, content: text, timestamp: Date.now() }];
    track('boss_force_verdict_requested', { mbti: typeCode, turns: messages.length });
    sendToLLM(updated);
  }, [isStreaming, verdict, locale, addUserMessage, messages, sendToLLM, typeCode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleReset = () => {
    if (abortRef.current) abortRef.current.abort();
    reset();
  };

  return (
    <motion.div
      className="bc"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      {/* Header — boss identity card */}
      <div className="bc-header">
        <div className="bc-profile-strip">
          <motion.div
            className="bc-avatar-ring"
            style={{
              borderColor: bossMood === 'warming' || bossMood === 'convinced' ? '#2d8a4e'
                : bossMood === 'cooling' || bossMood === 'rejected' ? '#dc3545'
                : elementInfo?.color || 'var(--border)',
              transition: 'border-color 0.6s',
            }}
            animate={isStreaming ? {
              boxShadow: [
                bossMood === 'warming' ? '0 0 8px rgba(45,138,78,0.2)' : elementInfo ? `0 0 8px ${elementInfo.glow}` : '0 0 8px rgba(120,120,120,0.15)',
                bossMood === 'warming' ? '0 0 18px rgba(45,138,78,0.55)' : elementInfo ? `0 0 22px ${elementInfo.color}` : '0 0 18px rgba(184,150,62,0.35)',
                bossMood === 'warming' ? '0 0 8px rgba(45,138,78,0.2)' : elementInfo ? `0 0 8px ${elementInfo.glow}` : '0 0 8px rgba(120,120,120,0.15)',
              ],
              scale: [1, 1.035, 1],
            } : {
              boxShadow: bossMood === 'warming' ? '0 0 12px rgba(45,138,78,0.3)'
                : bossMood === 'cooling' ? '0 0 12px rgba(220,53,69,0.2)'
                : elementInfo ? `0 0 12px ${elementInfo.glow}` : 'none',
              scale: 1,
            }}
            transition={isStreaming
              ? { repeat: Infinity, duration: 1.8, ease: 'easeInOut' }
              : { duration: 0.6 }}
          >
            <motion.span
              className="bc-avatar-em"
              animate={bossState === 'reading' ? { y: [0, -1.5, 0] } : { y: 0 }}
              transition={bossState === 'reading' ? { repeat: Infinity, duration: 1.4, ease: 'easeInOut' } : {}}
            >
              {typeData?.emoji || '👔'}
            </motion.span>
          </motion.div>
          <div className="bc-identity">
            <div className="bc-name-row">
              <strong className="bc-name">{typeData?.name || typeCode}</strong>
              <span className="bc-type-name">{typeCode}</span>
            </div>
            <span className="bc-vibe" style={{
              color: bossMood === 'warming' ? 'var(--success)' : bossMood === 'cooling' ? 'var(--danger)' : undefined,
              transition: 'color 0.6s',
            }}>
              {bossMood === 'warming' ? t('boss.mood.warming')
                : bossMood === 'cooling' ? t('boss.mood.cooling')
                : bossMood === 'convinced' ? t('boss.mood.convinced')
                : bossMood === 'rejected' ? t('boss.mood.rejected')
                : typeData?.bossVibe}
            </span>
            {/* Zodiac flavor line — Korean saju animal for KO; the English
                zodiac (Chinese + Western, from zodiacProfile) for EN so the
                line never shows Korean text to English readers. */}
            {locale === 'ko' && ymp && (
              <span className="bc-element" style={{ color: ymp.yearElement.color }}>
                {ymp.animal.emoji} {ymp.animal.animal}{t('boss.zodiacSuffix')}
                {ymp.zodiacSign ? ` · ${ymp.zodiacSign.emoji} ${ymp.zodiacSign.sign}` : ''}
              </span>
            )}
            {locale !== 'ko' && zodiacProfile && (zodiacProfile.chinese || zodiacProfile.western) && (
              <span className="bc-element" style={{ color: ymp?.yearElement.color || 'var(--text-tertiary)' }}>
                {zodiacProfile.chinese ? `${zodiacProfile.chinese.emoji} ${zodiacProfile.chinese.labelEn}` : ''}
                {zodiacProfile.chinese && zodiacProfile.western ? ' · ' : ''}
                {zodiacProfile.western ? `${zodiacProfile.western.emoji} ${zodiacProfile.western.labelEn}` : ''}
              </span>
            )}
            {observationCount > 0 && (
              <span className="bc-concreteness" title={t('boss.observationsTooltip')}>
                {t('boss.observationsShaped', { count: observationCount })}
              </span>
            )}
            {ymp && (
              <DailyMoodIndicator profile={ymp} variant="inline" />
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* 저장 버튼 — 첫 대화 후, 아직 저장 안 했을 때 */}
          {messages.length >= 2 && !saved && !loadedAgentId && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bc-reset"
              title={isAnon
                ? L('이 팀장 저장하기 (이 브라우저에만 임시 저장)', 'Save this boss (temporary, this browser only)')
                : L('이 팀장 저장하기', 'Save this boss')}
              onClick={() => {
                const id = saveAsAgent();
                if (id) {
                  setSaved(true);
                  applyBossCalibration(id, messages);
                  setCalibrationStep('similarity');
                  track('boss_saved_as_agent', { turns: messages.length, mbti: typeCode, anonymous: isAnon });
                }
              }}
              style={{ color: 'var(--accent)' }}
            >
              <Bookmark size={14} />
            </motion.button>
          )}
          {saved && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Check size={10} /> {isAnon ? L('임시 저장됨', 'Saved (this browser)') : L('저장됨', 'Saved')}
              </span>
              {isAnon && (
                <LocaleLink
                  href="/login"
                  style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
                  title={L('로그인하면 다른 기기에서도 이 팀장을 다시 만날 수 있어요', 'Sign in to keep this boss on all your devices')}
                >
                  {L('로그인하면 영구 저장', 'Sign in to keep')}
                </LocaleLink>
              )}
              <LocaleLink
                href={`/workspace?reviewer=${loadedAgentId || ''}`}
                style={{ fontSize: 10, color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
                title={L('이 팀장이 리뷰어가 돼요', 'This boss becomes your reviewer')}
              >
                {L('워크스페이스로 데려가기 →', 'Bring them into your workspace →')}
              </LocaleLink>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              if (resetArmed) { handleReset(); return; }
              setResetArmed(true);
              setTimeout(() => setResetArmed(false), 3000);
            }}
            className="bc-reset"
            title={resetArmed
              ? L('한 번 더 누르면 대화가 초기화돼요', 'Tap again to reset the chat')
              : L('대화 초기화', 'Restart chat')}
            style={resetArmed
              ? { color: 'var(--danger)', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0 8px' }
              : undefined}
          >
            <RotateCcw size={14} />
            {/* Color alone isn't enough on touch (no hover tooltip) — say it. */}
            {resetArmed && (
              <span style={{ fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>
                {L('초기화?', 'Reset?')}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="bc-messages">
        <AnimatePresence>
          {messages.map((msg) => (
            <ChatMessage key={msg.id} role={msg.role} content={msg.content} bossType={typeData} />
          ))}
        </AnimatePresence>
        {isStreaming && streamingText && (
          <ChatMessage role="assistant" content={streamingText} isStreaming bossType={typeData} />
        )}
        {isStreaming && !streamingText && (
          <motion.div
            className="bm bm-boss"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bm-avatar">
              <span className="bm-avatar-emoji">{typeData?.emoji || '👔'}</span>
            </div>
            <div className="bm-bubble bm-bubble-boss">
              {bossState === 'reading' ? (
                <motion.div
                  className="bm-reading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <motion.span
                    className="bm-reading-eye"
                    animate={{ y: [0, -2, 0], opacity: [0.6, 1, 0.6] }}
                    transition={{ repeat: Infinity, duration: 1.3, ease: 'easeInOut' }}
                  >
                    👀
                  </motion.span>
                  <motion.span
                    animate={{ opacity: [0.35, 0.9, 0.35] }}
                    transition={{ repeat: Infinity, duration: 1.6 }}
                  >
                    {L('읽는 중', 'Reading')}
                  </motion.span>
                  <span className="bm-reading-dots">
                    <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0 }}>.</motion.span>
                    <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.2 }}>.</motion.span>
                    <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ repeat: Infinity, duration: 1.2, delay: 0.4 }}>.</motion.span>
                  </span>
                </motion.div>
              ) : (
                <div className="bm-typing">
                  <span /><span /><span />
                </div>
              )}
            </div>
          </motion.div>
        )}
        {/* 복원된 스레드의 이전 결론 복구 — verdict state는 local이라 복원 안 됨 */}
        {!verdict && !isStreaming && loadedAgentId && messages.length >= 2 && (
          <PastVerdictRecap agentId={loadedAgentId} />
        )}

        {/* Verdict 카드 — boss가 결론을 내렸을 때 */}
        {verdict && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="bc-verdict"
            data-result={verdict.verdict}
          >
            <div className="bc-verdict-icon">
              {verdict.verdict === 'approved' ? '✅' : verdict.verdict === 'conditional' ? '🤔' : '❌'}
            </div>
            <div className="bc-verdict-body" role="status" aria-live="polite">
              <p className="bc-verdict-label" role="heading" aria-level={3}>
                {verdict.verdict === 'approved'
                  ? t('boss.verdict.approved')
                  : verdict.verdict === 'conditional'
                    ? t('boss.verdict.conditional')
                    : t('boss.verdict.rejected')}
              </p>
              <p className="bc-verdict-reason">{verdict.reason}</p>
              {verdict.tip && (
                <p className="bc-verdict-tip">💡 {verdict.tip}</p>
              )}
            </div>
          </motion.div>
        )}

        {/* Post-verdict actions */}
        {verdict && !isStreaming && !shareMode && (
          <div ref={postVerdictRef}>
            <PostVerdictPanel verdict={verdict} onShare={() => setShareMode(true)} />
          </div>
        )}
        {verdict && shareMode && (
          <VerdictShareCard
            verdict={verdict}
            typeCode={typeCode}
            situation={useBossStore.getState().lastSituation}
            onClose={() => setShareMode(false)}
          />
        )}

        <div ref={chatEndRef} />
      </div>

      {/* 스마트 전환 CTA — 업무/의사결정 대화 감지 시만 */}
      {!ctaDismissed && !saved && !isStreaming
        && messages.filter(m => m.role === 'assistant').length >= 2
        && isWorkRelated(messages) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          style={{
            margin: '0 16px 8px',
            padding: '12px 16px',
            borderRadius: 14,
            background: 'rgba(184,150,62,0.04)',
            border: '1px solid rgba(184,150,62,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}
        >
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {L('이 피드백, 워크스페이스에서 바로 반영해볼 수 있어요', 'Take this feedback straight into your workspace.')}
          </p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <LocaleLink
              href={`/workspace?reviewer=${loadedAgentId || ''}`}
              onClick={(e) => {
                if (!loadedAgentId) {
                  const id = saveAsAgent();
                  if (id) {
                    // 저장 후 URL에 ID 반영
                    e.preventDefault();
                    window.location.href = withLocale(locale, `/workspace?reviewer=${id}`);
                  }
                }
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '5px 12px', borderRadius: 99,
                background: 'var(--gradient-gold)', color: 'white',
                fontSize: 11, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              {L('시작', 'Start')} <ArrowRight size={10} />
            </LocaleLink>
            <button
              onClick={() => setCtaDismissed(true)}
              style={{ fontSize: 10, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
            >
              ✕
            </button>
          </div>
        </motion.div>
      )}

      {/* 저장 후 캘리브레이션 */}
      <AnimatePresence>
        {calibrationStep === 'similarity' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="bc-calibration"
          >
            <button
              onClick={() => setCalibrationStep('none')}
              aria-label={L('닫기', 'Dismiss')}
              className="bc-cal-dismiss"
            >×</button>
            {/* §2.4-5: rehearsal frame, not prediction. The old "how close to
                your ACTUAL boss?" + "😮 소름/Eerie" rating sold the sim as a
                supernatural predictor of the real person at the emotional peak,
                with no caveat. We ask how true-to-life the PRACTICE felt, drop the
                eerie/predictive label, and restate the "may differ" caveat here. */}
            <p className="bc-cal-q">{L('리허설로 얼마나 실감 났어?', 'How true-to-life did this rehearsal feel?')}</p>
            <p className="bc-cal-caveat">{L('연습용 시뮬이라, 실제 반응은 다를 수 있어요', "It's a practice sim — the real reaction may differ")}</p>
            <div className="bc-cal-options">
              <button onClick={() => {
                track('boss_calibration_similarity', { rating: 'a_bit_off', mbti: typeCode, turns: messages.length });
                setCalibrationStep('detail');
              }} className="bc-cal-btn">{L('😐 좀 달랐어', '😐 A bit off')}</button>
              <button onClick={() => {
                if (loadedAgentId) {
                  const agent = useAgentStore.getState().getAgent(loadedAgentId);
                  const tonObs = agent?.observations.find(o => o.observation.includes('톤이 잘 맞'));
                  if (tonObs) useAgentStore.getState().reinforceObservation(loadedAgentId, tonObs.id);
                }
                track('boss_calibration_similarity', { rating: 'pretty_close', mbti: typeCode, turns: messages.length });
                setCalibrationStep('done');
              }} className="bc-cal-btn bc-cal-btn-active">{L('🤔 꽤 그럴듯', '🤔 Pretty convincing')}</button>
              <button onClick={() => {
                if (loadedAgentId) {
                  const agent = useAgentStore.getState().getAgent(loadedAgentId);
                  agent?.observations.forEach(o => {
                    if (o.category === 'communication_style' && o.observation.includes('잘 맞')) {
                      useAgentStore.getState().reinforceObservation(loadedAgentId!, o.id);
                    }
                  });
                }
                track('boss_calibration_similarity', { rating: 'very_lifelike', mbti: typeCode, turns: messages.length });
                setCalibrationStep('done');
              }} className="bc-cal-btn bc-cal-btn-active">{L('👍 정말 그럴듯했어', '👍 Very convincing')}</button>
            </div>
          </motion.div>
        )}
        {calibrationStep === 'detail' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="bc-calibration"
          >
            <button
              onClick={() => setCalibrationStep('none')}
              aria-label={L('닫기', 'Dismiss')}
              className="bc-cal-dismiss"
            >×</button>
            <p className="bc-cal-q">{L('어떤 점이 달라?', 'What feels different?')}</p>
            <div className="bc-cal-options">
              <button
                onClick={() => {
                  if (loadedAgentId) applyExplicitCalibration(loadedAgentId, 'more_direct');
                  track('boss_calibration_detail', { delta: 'more_direct', mbti: typeCode });
                  setCalibrationStep('done');
                }}
                className="bc-cal-btn"
              >{L('실제 팀장은 더 직설적', 'The real one\'s more direct')}</button>
              <button
                onClick={() => {
                  if (loadedAgentId) applyExplicitCalibration(loadedAgentId, 'more_soft');
                  track('boss_calibration_detail', { delta: 'more_soft', mbti: typeCode });
                  setCalibrationStep('done');
                }}
                className="bc-cal-btn"
              >{L('실제 팀장은 더 부드러움', 'The real one\'s softer')}</button>
              <button
                onClick={() => {
                  if (loadedAgentId) applyExplicitCalibration(loadedAgentId, 'different_tone');
                  track('boss_calibration_detail', { delta: 'different_tone', mbti: typeCode });
                  setCalibrationStep('done');
                }}
                className="bc-cal-btn"
              >{L('말투가 좀 다름', 'The tone is different')}</button>
            </div>
          </motion.div>
        )}
        {calibrationStep === 'done' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="bc-calibration"
            onAnimationComplete={() => setTimeout(() => setCalibrationStep('none'), 2000)}
          >
            <p style={{ fontSize: 12, color: 'var(--accent)', textAlign: 'center' }}>
              {L('✓ 반영됨 — 다음 대화부터 적용돼요', '✓ Applied — takes effect from the next reply')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Force-verdict shortcut — appears after the first in-chat reply
          (situation + at least one back-and-forth). Lower threshold so casual
          visitors who exit early still reach a verdict / shareable moment. */}
      {!verdict && !isStreaming && messages.filter(m => m.role === 'user').length >= 2 && (
        <div className="bc-force-verdict-row">
          <button
            type="button"
            onClick={handleForceVerdict}
            className="bc-force-verdict-btn"
          >
            {L('여기까지 듣고 결정 부탁 →', 'Make the call from this →')}
          </button>
        </div>
      )}

      {/* Input */}
      <div className="bc-input-bar">
        <div className="bc-input-wrap">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bc-textarea"
            rows={1}
            maxLength={500}
            disabled={isStreaming}
            aria-label={L('팀장에게 보낼 답변', 'Reply to manager')}
          />
          <AnimatedPlaceholder
            texts={getFollowUps(bossMood)}
            visible={!input && !isStreaming}
            interval={3500}
            className="bc-placeholder"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="bc-send"
            aria-label={L('답변 보내기', 'Send reply')}
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
