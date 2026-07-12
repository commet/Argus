import { create } from 'zustand';
import type { SajuProfile, YearMonthProfile } from '@/lib/boss/saju-interpreter';
import { buildYearMonthProfile } from '@/lib/boss/saju-interpreter';
import type { PersonalityType } from '@/lib/boss/personality-types';
import { getPersonalityType, getLocalizedPersonalityType } from '@/lib/boss/personality-types';
import type { ZodiacProfile } from '@/lib/boss/zodiac';
import { buildZodiacProfile } from '@/lib/boss/zodiac';
import { useAgentStore } from '@/stores/useAgentStore';
import { summarizeBossChatTopic, extractBossChatObservation } from '@/lib/observation-engine';
import type { BossChatTurn } from '@/stores/agent-types';
import { getCurrentLanguage } from '@/lib/i18n';

// ━━━ Types ━━━

export interface BossConfig {
  typeCode: string;
  gender: '남' | '여';
  birthYear: number;
  birthMonth: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface BossState {
  // Setup
  axes: { ei: 'E' | 'I'; sn: 'S' | 'N'; tf: 'T' | 'F'; jp: 'J' | 'P' };
  gender: '남' | '여';
  birthYear: number;
  birthMonth: number;
  birthDay: number;

  // 사주 연월주 프로필 (클라이언트 계산) + full 사주 (API, optional)
  yearMonthProfile: YearMonthProfile | null;
  sajuProfile: SajuProfile | null;
  sajuLoading: boolean;
  /** 영어 로케일용 zodiac 프로필 (Western + Chinese) — parallel to yearMonthProfile */
  zodiacProfile: ZodiacProfile | null;

  // Chat
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;

  // Phase: 'setup' → 'chat'
  phase: 'setup' | 'chat';

  // 이면 (판정 후 팀장 속마음)
  innerMonologue: string;        // 완성된 독백 (빈 문자열이면 아직 공개 안 됨)
  innerStreamingText: string;    // 스트리밍 중 텍스트
  innerLoading: boolean;         // LLM 호출 중

  // Agent 연동
  loadedAgentId: string | null;   // 저장된 boss agent를 불러왔을 때

  // Optional one-liner the user wrote about this boss. Soft modulator in prompt.
  userContextHint: string;

  // Demo path: when an AutoDemo writes here, BossSetup picks it up on mount,
  // pre-fills the situation textarea, and auto-submits. Cleared on consumption.
  demoSituation: string | null;

  // Actions
  setAxis: (key: 'ei' | 'sn' | 'tf' | 'jp', value: string) => void;
  setGender: (g: '남' | '여') => void;
  setBirth: (y: number, m?: number, d?: number) => void;
  setUserContextHint: (v: string) => void;
  setDemoSituation: (v: string | null) => void;
  loadSaju: () => Promise<void>;
  startChat: () => void;
  addUserMessage: (content: string) => void;
  setStreaming: (v: boolean) => void;
  updateStreamingText: (text: string) => void;
  commitAssistantMessage: () => void;
  getPersonalityType: () => PersonalityType | undefined;
  reset: () => void;

  // 이면 actions
  startInnerMonologue: () => void;
  updateInnerStreamingText: (text: string) => void;
  commitInnerMonologue: () => void;
  resetInnerMonologue: () => void;

  // Retention — 리셋 + 컬렉션
  lastSituation: string;
  resetForNewSituation: () => void;

  // Agent 연동 액션
  saveAsAgent: (name?: string) => string | null;
  loadBossFromAgent: (agentId: string) => void;
}

const INITIAL_STATE = {
  axes: { ei: 'E' as const, sn: 'S' as const, tf: 'T' as const, jp: 'J' as const },
  gender: '남' as const,
  birthYear: 0,
  birthMonth: 0,
  birthDay: 0,
  yearMonthProfile: null,
  sajuProfile: null,
  sajuLoading: false,
  zodiacProfile: null,
  messages: [] as ChatMessage[],
  isStreaming: false,
  streamingText: '',
  phase: 'setup' as const,
  innerMonologue: '',
  innerStreamingText: '',
  innerLoading: false,
  loadedAgentId: null as string | null,
  lastSituation: '',
  userContextHint: '',
  demoSituation: null as string | null,
};

export const useBossStore = create<BossState>((set, get) => ({
  ...INITIAL_STATE,

  setAxis: (key, value) =>
    set((s) => ({ axes: { ...s.axes, [key]: value } })),

  setGender: (g) => set({ gender: g }),

  setUserContextHint: (v) => set({ userContextHint: v }),

  setDemoSituation: (v) => set({ demoSituation: v }),

  setBirth: (y, m?, d?) => {
    const yearNum = isNaN(y) ? 0 : Math.floor(y);
    const monthNum = m && !isNaN(m) ? Math.floor(m) : 0;
    const dayNum = d && !isNaN(d) ? Math.floor(d) : 0;
    const newState: Partial<BossState> = {
      birthYear: yearNum,
      birthMonth: monthNum,
      birthDay: dayNum,
      yearMonthProfile: null,
      zodiacProfile: null,
    };
    if (yearNum >= 1940 && yearNum <= 2006) {
      const validMonth = monthNum >= 1 && monthNum <= 12 ? monthNum : undefined;
      const validDay = dayNum >= 1 && dayNum <= 31 ? dayNum : undefined;
      newState.yearMonthProfile = buildYearMonthProfile(yearNum, validMonth);
      newState.zodiacProfile = buildZodiacProfile(yearNum, validMonth, validDay);
    }
    set(newState);
  },

  loadSaju: async () => {
    const { birthYear, birthMonth, birthDay, gender } = get();
    // The server profile includes a day master, so it is meaningful only with
    // a complete date. Partial dates already have the client-side year/month
    // profile. English uses the Western zodiac profile and needs no Saju call.
    if (
      getCurrentLanguage() !== 'ko'
      || birthYear < 1940
      || birthYear > 2006
      || birthMonth < 1
      || birthMonth > 12
      || birthDay < 1
      || birthDay > 31
    ) return;
    set({ sajuLoading: true });
    // Hard 5s ceiling so BossConfirmation never stalls if /api/boss/saju is slow.
    // Saju is optional — chat works without it.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch('/api/boss/saju', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: birthYear, month: birthMonth, day: birthDay, gender }),
        signal: controller.signal,
      });
      if (res.ok) {
        const profile = await res.json();
        set({ sajuProfile: profile });
      }
    } catch {
      // Saju is optional — chat works without it (timeout / network / abort all land here)
    } finally {
      clearTimeout(timeoutId);
      set({ sajuLoading: false });
    }
  },

  startChat: () => set({ phase: 'chat' }),

  addUserMessage: (content) => {
    const msg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    const isFirst = get().messages.length === 0;
    set((s) => ({
      messages: [...s.messages, msg],
      ...(isFirst ? { lastSituation: content } : {}),
    }));
  },

  setStreaming: (v) => set({ isStreaming: v, streamingText: v ? '' : get().streamingText }),

  updateStreamingText: (text) => set({ streamingText: text }),

  commitAssistantMessage: () => {
    const { streamingText } = get();
    if (!streamingText.trim()) return;
    const msg: ChatMessage = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      content: streamingText,
      timestamp: Date.now(),
    };
    set((s) => ({
      messages: [...s.messages, msg],
      streamingText: '',
      isStreaming: false,
    }));

    // Agent XP 기록 + 대화 스레드 저장
    const { loadedAgentId, messages: allMsgs } = get();
    if (loadedAgentId) {
      const agentStore = useAgentStore.getState();
      agentStore.recordActivity(loadedAgentId, 'boss_chat', getCurrentLanguage() === 'ko' ? '대화' : 'Conversation');

      // chat_history 저장 — 최근 20턴까지. 프롬프트 포함 목적이 아닌 UI 복원용.
      const thread: BossChatTurn[] = allMsgs
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp }));
      agentStore.updateAgent(loadedAgentId, { chat_history: thread });

      // 6번째 assistant 메시지마다 메타 관찰 추출 (비차단)
      const assistantCount = allMsgs.filter(m => m.role === 'assistant').length;
      if (assistantCount > 0 && assistantCount % 6 === 0) {
        const topic = summarizeBossChatTopic(allMsgs);
        if (topic) extractBossChatObservation(loadedAgentId, topic);
      }
    }
  },

  getPersonalityType: () => {
    const { axes } = get();
    const code = `${axes.ei}${axes.sn}${axes.tf}${axes.jp}`;
    return getPersonalityType(code);
  },

  reset: () => {
    set({ ...INITIAL_STATE });
  },

  // ─── 이면 ───
  startInnerMonologue: () => set({ innerLoading: true, innerStreamingText: '', innerMonologue: '' }),
  updateInnerStreamingText: (text) => set({ innerStreamingText: text }),
  commitInnerMonologue: () => {
    const { innerStreamingText } = get();
    set({ innerMonologue: innerStreamingText.trim(), innerStreamingText: '', innerLoading: false });
  },
  resetInnerMonologue: () => set({ innerMonologue: '', innerStreamingText: '', innerLoading: false }),

  // §2.4-4: resetForNewType (random next MBTI = slot-machine) removed. "Another
  // boss" now routes through reset() back to setup for a deliberate choice.

  resetForNewSituation: () => {
    set({
      messages: [],
      isStreaming: false,
      streamingText: '',
      loadedAgentId: null,
      innerMonologue: '',
      innerStreamingText: '',
      innerLoading: false,
      // Same situation, but agent association is dropped — clear hint so a saved
      // descriptor doesn't leak into a fresh, unsaved boss.
      userContextHint: '',
    });
  },

  // ─── Agent 연동 ───

  saveAsAgent: (name) => {
    const { axes, gender, sajuProfile, zodiacProfile, birthYear, birthMonth, birthDay, userContextHint } = get();
    const typeCode = `${axes.ei}${axes.sn}${axes.tf}${axes.jp}`;
    const locale: 'ko' | 'en' = getCurrentLanguage() === 'ko' ? 'ko' : 'en';
    // Use locale-aware personality data so EN bosses get English name/style/triggers persisted.
    const personalityType = getLocalizedPersonalityType(typeCode, locale);
    if (!personalityType) return null;

    const agentStore = useAgentStore.getState();
    if (agentStore.agents.length === 0) agentStore.loadAgents();

    const agentId = agentStore.createBossAgent({
      name: name || (locale === 'ko' ? `${personalityType.name} 팀장` : `${personalityType.name} Boss`),
      typeCode,
      gender,
      personalityProfile: {
        communicationStyle: personalityType.communicationStyle,
        decisionPattern: personalityType.decisionPattern,
        conflictStyle: personalityType.conflictStyle,
        feedbackStyle: personalityType.feedbackStyle,
        triggers: personalityType.triggers,
        speechPatterns: personalityType.speechPatterns,
        bossVibe: personalityType.bossVibe,
      },
      sajuProfile: sajuProfile ?? undefined,
      zodiacProfile: zodiacProfile ?? undefined,
      birthYear: birthYear || undefined,
      birthMonth: birthMonth || undefined,
      birthDay: birthDay || undefined,
      locale,
      userContextHint: userContextHint || undefined,
    });

    set({ loadedAgentId: agentId });
    return agentId;
  },

  loadBossFromAgent: (agentId) => {
    const agentStore = useAgentStore.getState();
    if (agentStore.agents.length === 0) agentStore.loadAgents();

    const agent = agentStore.getAgent(agentId);
    if (!agent || !agent.personality_code) return;

    const code = agent.personality_code;
    const bYear = agent.birth_year || 0;
    const bMonth = agent.birth_month || 0;
    const bDay = agent.birth_day || 0;

    // 저장된 대화 스레드 복원 — 이전 대화 연속성
    const restored: ChatMessage[] = (agent.chat_history || []).map((t, i) => ({
      id: `${t.role === 'user' ? 'u' : 'a'}-restore-${t.timestamp}-${i}`,
      role: t.role,
      content: t.content,
      timestamp: t.timestamp,
    }));
    const lastUserTurn = [...restored].reverse().find(m => m.role === 'user');

    set({
      axes: {
        ei: (code[0] as 'E' | 'I') || 'E',
        sn: (code[1] as 'S' | 'N') || 'S',
        tf: (code[2] as 'T' | 'F') || 'T',
        jp: (code[3] as 'J' | 'P') || 'J',
      },
      gender: agent.boss_gender || '남',
      birthYear: bYear,
      birthMonth: bMonth,
      birthDay: bDay,
      yearMonthProfile: bYear >= 1940 ? buildYearMonthProfile(bYear, bMonth >= 1 ? bMonth : undefined) : null,
      zodiacProfile: bYear >= 1940
        ? buildZodiacProfile(bYear, bMonth >= 1 ? bMonth : undefined, bDay >= 1 ? bDay : undefined)
        : null,
      sajuProfile: agent.saju_profile as SajuProfile | null,
      phase: 'chat',
      messages: restored,
      lastSituation: lastUserTurn?.content || '',
      loadedAgentId: agentId,
      userContextHint: agent.user_context_hint || '',
    });
  },
}));
