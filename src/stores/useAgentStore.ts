/**
 * 통합 에이전트 스토어
 *
 * 체인 에이전트 (리서치, 전략): 해금 시스템
 * 독립 에이전트 (카피, 숫자, 기술, PM, 리스크, UX, 법률): 처음부터 사용 가능
 * 모든 에이전트: Lv.1 시작, XP 누적 성장
 *
 * localStorage first, Supabase async (기존 패턴 따름).
 */

import { create } from 'zustand';
import { generateId } from '@/lib/uuid';
import { getCurrentLanguage } from '@/lib/i18n';
import { getStorage, setStorage, STORAGE_KEYS } from '@/lib/storage';
import { loadAndMerge, upsertToSupabase, syncToSupabase, insertToSupabase } from '@/lib/db';
import type { Persona } from '@/stores/types';
import { personaToAgentInput } from '@/lib/agent-adapters';
import {
  type Agent,
  type AgentChain,
  type AgentObservation,
  type AgentActivity,
  type AgentActivityType,
  type AgentCapability,
  type AgentGroup,
  calculateLevel,
  XP_REWARDS,
  NAVIGATOR_SESSION_THRESHOLD,
} from '@/stores/agent-types';

// ─── Builtin Agent Definitions ───

const BUILTIN_AGENTS: Omit<Agent, 'xp' | 'level' | 'observations' | 'last_used_at' | 'created_at' | 'updated_at'>[] = [
  // ── 리서치 체인 ──
  {
    id: 'hayoon', name: '하윤', nameEn: 'Riley', role: '리서치 인턴', roleEn: 'Research Intern', emoji: '📝', color: '#06B6D4',
    origin: 'builtin', capabilities: ['task_execution', 'web_search'],
    group: 'research', chain_id: 'research',
    unlock_condition: { type: 'always', required: 0 }, unlocked: true,
    expertise: '기초 자료 정리, 벤치마킹, 사례 수집을 담당합니다. 열정적으로 찾아옵니다.',
    expertiseEn: 'Handles basic research, benchmarking, and case collection. Enthusiastic and thorough.',
    tone: '공손하고 열심히, 찾은 것을 빠짐없이 정리해서 보고합니다.',
    toneEn: 'Polite and eager; reports everything found without omission.',
    keywords: ['조사', '리서치', '자료', '사례', '벤치마크', '현황'],
    is_builtin: true, archived: false,
  },
  {
    id: 'sujin', name: '다은', nameEn: 'Sophie', role: '리서치 애널리스트', roleEn: 'Research Analyst', emoji: '🔍', color: '#3B82F6',
    origin: 'builtin', capabilities: ['task_execution', 'web_search'],
    group: 'research', chain_id: 'research',
    unlock_condition: { type: 'always', required: 0 }, unlocked: true,
    expertise: '자료 조사, 시장 분석, 데이터 수집에 강합니다. 빠짐없이 꼼꼼하게 찾아냅니다.',
    expertiseEn: 'Strong at desk research, market analysis, and data gathering. Thorough and exhaustive.',
    tone: '팩트 중심으로 간결하게, 출처를 명시하며 신뢰감 있게 정리합니다.',
    toneEn: 'Fact-first, concise, cites sources for credibility.',
    keywords: ['분석', '시장', '트렌드', '데이터', '출처'],
    is_builtin: true, archived: false,
  },
  {
    id: 'research_director', name: '도윤', nameEn: 'Marcus', role: '리서치 디렉터', roleEn: 'Research Director', emoji: '🧠', color: '#1D4ED8',
    origin: 'builtin', capabilities: ['task_execution', 'review', 'web_search'],
    group: 'research', chain_id: 'research',
    unlock_condition: { type: 'always', required: 0 }, unlocked: true,
    expertise: '종합적 인사이트 도출, 데이터 간 패턴 발견, 전략적 함의 제시에 강합니다.',
    expertiseEn: 'Strong at synthesizing insights, finding patterns across data, and articulating strategic implications.',
    tone: '핵심 인사이트를 먼저 제시하고, 근거를 간결하게 뒷받침합니다.',
    toneEn: 'Leads with the key insight, then briefly supports it with evidence.',
    keywords: ['인사이트', '종합', '패턴', '함의', '해석'],
    is_builtin: true, archived: false,
  },

  // ── 전략 체인 ──
  {
    id: 'strategy_jr', name: '정민', nameEn: 'Alex', role: '전략 주니어', roleEn: 'Junior Strategist', emoji: '🗺️', color: '#A78BFA',
    origin: 'builtin', capabilities: ['task_execution'],
    group: 'strategy', chain_id: 'strategy',
    unlock_condition: { type: 'always', required: 0 }, unlocked: true,
    expertise: '경쟁 비교, SWOT 정리, 기본 포지셔닝을 담당합니다.',
    expertiseEn: 'Handles competitor comparison, SWOT structuring, and basic positioning.',
    tone: '구조적으로 정리하고, 핵심 비교 포인트를 명확히 제시합니다.',
    toneEn: 'Structures thinking and states key comparison points clearly.',
    keywords: ['경쟁', '비교', 'SWOT', '포지셔닝'],
    is_builtin: true, archived: false,
  },
  {
    id: 'hyunwoo', name: '현우', nameEn: 'Nathan', role: '전략가', roleEn: 'Strategist', emoji: '🎯', color: '#8B5CF6',
    origin: 'builtin', capabilities: ['task_execution'],
    group: 'strategy', chain_id: 'strategy',
    unlock_condition: { type: 'always', required: 0 }, unlocked: true,
    expertise: '전략 수립, 포지셔닝, 경쟁 분석의 전문가입니다. 큰 그림을 그립니다.',
    expertiseEn: 'Expert in strategy formulation, positioning, and competitive analysis. Draws the big picture.',
    tone: '핵심만 짚되, 왜 그런지 한 줄로 설득력 있게 설명합니다.',
    toneEn: 'Hits the core points and explains why in a single persuasive line.',
    keywords: ['전략', '방향', '비전', '로드맵', '차별화'],
    is_builtin: true, archived: false,
  },
  {
    id: 'chief_strategist', name: '승현', nameEn: 'Victor', role: '수석 전략가', roleEn: 'Chief Strategist', emoji: '🏛️', color: '#6D28D9',
    origin: 'builtin', capabilities: ['task_execution', 'review'],
    group: 'strategy', chain_id: 'strategy',
    unlock_condition: { type: 'always', required: 0 }, unlocked: true,
    expertise: '시나리오 플래닝, 프레임 전환, 의사결정 구조 설계에 강합니다.',
    expertiseEn: 'Strong at scenario planning, reframing, and decision-structure design.',
    tone: '여러 시나리오를 제시하되, 권장안을 명확히 밝히고 논거를 붙입니다.',
    toneEn: 'Presents multiple scenarios, clearly recommends one with reasoning.',
    keywords: ['시나리오', '프레임', '의사결정', '구조'],
    is_builtin: true, archived: false,
  },

  // ── 실행 그룹 (독립) ──
  {
    id: 'seoyeon', name: '서연', nameEn: 'Claire', role: '카피라이터', roleEn: 'Copywriter', emoji: '✍️', color: '#F59E0B',
    origin: 'builtin', capabilities: ['task_execution'],
    group: 'production', chain_id: null,
    unlock_condition: { type: 'always', required: 0 }, unlocked: true,
    expertise: '문서 작성, 카피라이팅, 메시지 설계의 전문가입니다. 읽히는 글을 씁니다.',
    expertiseEn: 'Expert in document writing, copywriting, and message design. Writes prose that reads easily.',
    tone: '독자 관점에서 쓰고, 한 문장이 하나의 메시지를 전달하도록 다듬습니다.',
    toneEn: 'Writes from the reader\'s perspective; one sentence, one message.',
    keywords: ['작성', '문서', '카피', '초안', '보고서', '제안서', '정리', '요약', '슬라이드'],
    is_builtin: true, archived: false,
  },
  {
    id: 'minjae', name: '규민', nameEn: 'Ethan', role: '숫자 분석가', roleEn: 'Numbers Analyst', emoji: '📊', color: '#10B981',
    origin: 'builtin', capabilities: ['task_execution'],
    group: 'production', chain_id: null,
    unlock_condition: { type: 'always', required: 0 }, unlocked: true,
    expertise: '시장 규모 추정, Unit Economics, ROI/BEP 계산, 민감도 분석에 능합니다. 빠른 추정과 시나리오 비교로 의사결정을 돕습니다.',
    expertiseEn: 'Skilled at market sizing, unit economics, ROI/BEP calculation, and sensitivity analysis. Helps decisions via quick estimates and scenario comparison.',
    tone: '정량적 근거를 먼저 제시하고, 해석을 덧붙입니다. 표와 수치를 적극 활용합니다.',
    toneEn: 'Leads with quantitative evidence, adds interpretation. Uses tables and figures liberally.',
    keywords: ['수치', '숫자', 'ROI', 'TAM', '추정', '시나리오', '계산', '지표', 'KPI', 'estimate', 'numbers'],
    is_builtin: true, archived: false,
  },
  {
    id: 'hyeyeon', name: '혜연', nameEn: 'Diana', role: '재무·회계 전문가', roleEn: 'Finance & Accounting', emoji: '💰', color: '#059669',
    origin: 'builtin', capabilities: ['task_execution'],
    group: 'production', chain_id: null,
    unlock_condition: { type: 'always', required: 0 }, unlocked: true,
    expertise: '재무제표 분석, 손익 구조, 현금흐름 관리, 예산 편성, 세무 검토, 밸류에이션(DCF/멀티플)에 강합니다.',
    expertiseEn: 'Strong in financial-statement analysis, P&L structure, cash-flow management, budgeting, tax review, and valuation (DCF/multiples).',
    tone: '정확하고 보수적으로, 수치의 출처와 가정을 명시합니다. 리스크를 수치로 환산합니다.',
    toneEn: 'Precise and conservative; states source and assumption for every figure. Translates risk into numbers.',
    keywords: ['재무', '회계', '손익', '현금흐름', '예산', '세금', '밸류에이션', 'DCF', 'P&L', 'cash flow', 'budget', 'finance'],
    is_builtin: true, archived: false,
  },
  {
    id: 'sujin_hr', name: '수진', nameEn: 'Harper', role: '사람·문화 전략가', roleEn: 'People & Culture Strategist', emoji: '🤝', color: '#F472B6',
    origin: 'builtin', capabilities: ['task_execution'],
    group: 'production', chain_id: null,
    unlock_condition: { type: 'always', required: 0 }, unlocked: true,
    expertise: '조직 설계, 채용 계획, 변화 관리, 보상·평가 체계, 내부 커뮤니케이션, 팀 문화 전략에 강합니다.',
    expertiseEn: 'Strong in organizational design, hiring plans, change management, comp/eval systems, internal communications, and team-culture strategy.',
    tone: '사람 중심으로 생각하되, 비즈니스 임팩트로 설득합니다. 공감과 구조를 동시에 갖춥니다.',
    toneEn: 'Thinks people-first but argues via business impact. Combines empathy with structure.',
    keywords: ['채용', '조직', 'HR', '인사', '평가', '보상', '문화', '온보딩', '퇴사', '변화관리', '인력', '조직 계획', 'hiring', 'team', 'culture', 'org', 'people'],
    is_builtin: true, archived: false,
  },
  {
    id: 'minseo', name: '민서', nameEn: 'Stella', role: '마케팅·그로스 전략가', roleEn: 'Marketing & Growth', emoji: '📣', color: '#E11D48',
    origin: 'builtin', capabilities: ['task_execution'],
    group: 'production', chain_id: null,
    unlock_condition: { type: 'always', required: 0 }, unlocked: true,
    expertise: '채널 전략, 캠페인 설계, 퍼널 최적화, 그로스 루프, 마케팅 예산 배분에 강합니다. 전략을 실행 가능한 마케팅 계획으로 전환합니다.',
    expertiseEn: 'Strong at channel strategy, campaign design, funnel optimization, growth loops, and marketing budget allocation. Translates strategy into executable marketing plans.',
    tone: '데이터 기반으로 채널과 예산을 설계하되, 고객 심리를 놓치지 않습니다.',
    toneEn: 'Designs channels and budgets from data while keeping customer psychology in view.',
    keywords: ['마케팅', '캠페인', '채널', '퍼널', '그로스', '광고', 'SEO', 'SNS', '브랜딩', '콘텐츠', 'GTM', 'marketing', 'campaign', 'growth', 'funnel', 'channel', 'ads', 'brand'],
    is_builtin: true, archived: false,
  },
  {
    id: 'junseo', name: '준서', nameEn: 'Leo', role: '기술 설계자', roleEn: 'Engineer', emoji: '⚙️', color: '#14B8A6',
    origin: 'builtin', capabilities: ['task_execution'],
    group: 'production', chain_id: null,
    unlock_condition: { type: 'always', required: 0 }, unlocked: true,
    expertise: '기술 아키텍처, 구현 가능성 검토, 시스템 설계에 강합니다.',
    expertiseEn: 'Strong at technical architecture, feasibility review, and system design.',
    tone: '구조적으로 정리하고, 트레이드오프를 명확히 제시합니다.',
    toneEn: 'Structures thinking and states trade-offs clearly.',
    keywords: ['기술', '개발', '구현', '아키텍처', '시스템', 'API', '인프라', '서버'],
    is_builtin: true, archived: false,
  },
  {
    id: 'yerin', name: '예린', nameEn: 'Grace', role: 'PM', roleEn: 'PM', emoji: '📋', color: '#A855F7',
    origin: 'builtin', capabilities: ['task_execution'],
    group: 'production', chain_id: null,
    unlock_condition: { type: 'always', required: 0 }, unlocked: true,
    expertise: '일정 관리, 이해관계자 조율, 실행 계획 수립에 능합니다.',
    expertiseEn: 'Skilled at scheduling, stakeholder alignment, and execution planning.',
    tone: '액션 아이템 중심으로, 누가·언제·뭘 해야 하는지 명확하게 정리합니다.',
    toneEn: 'Action-item focused; crisp on who, when, and what.',
    keywords: ['일정', '계획', '마일스톤', '타임라인', '실행', '단계', '우선순위'],
    is_builtin: true, archived: false,
  },

  // ── 검증 그룹 (독립) ──
  {
    id: 'donghyuk', name: '동혁', nameEn: 'Blake', role: '리스크 검토자', roleEn: 'Risk Reviewer', emoji: '⚠️', color: '#EF4444',
    origin: 'builtin', capabilities: ['task_execution', 'review'],
    group: 'validation', chain_id: null,
    unlock_condition: { type: 'always', required: 0 }, unlocked: true,
    expertise: '리스크 분석, 반론 검토, 약점 파악의 전문가입니다. 놓치기 쉬운 걸 찾습니다.',
    expertiseEn: 'Expert in risk analysis, counterarguments, and weak-spot detection. Catches what others miss.',
    tone: '직설적이지만 건설적으로, "이건 위험하다" 다음에 반드시 "대신 이렇게"를 제시합니다.',
    toneEn: 'Direct but constructive — every "this is risky" is followed by "try this instead."',
    keywords: ['리스크', '위험', '반론', '약점', '검토', '비판', '문제점', '실패'],
    is_builtin: true, archived: false,
  },
  {
    id: 'jieun', name: '지은', nameEn: 'Maya', role: 'UX 설계자', roleEn: 'UX Designer', emoji: '🎨', color: '#EC4899',
    origin: 'builtin', capabilities: ['task_execution', 'review'],
    group: 'validation', chain_id: null,
    unlock_condition: { type: 'always', required: 0 }, unlocked: true,
    expertise: '사용자 경험, 인터페이스 설계, 사용성 평가에 강합니다.',
    expertiseEn: 'Strong at user experience, interface design, and usability evaluation.',
    tone: '사용자 입장에서 생각하고, 구체적인 시나리오로 설명합니다.',
    toneEn: 'Thinks from the user\'s perspective, explains with concrete scenarios.',
    keywords: ['UX', 'UI', '사용자', '인터페이스', '디자인', '화면', '프로토타입'],
    is_builtin: true, archived: false,
  },
  {
    id: 'taejun', name: '윤석', nameEn: 'Arthur', role: '법률·규정 검토자', roleEn: 'Legal Reviewer', emoji: '⚖️', color: '#6B7280',
    origin: 'builtin', capabilities: ['task_execution', 'review'],
    group: 'validation', chain_id: null,
    unlock_condition: { type: 'always', required: 0 }, unlocked: true,
    expertise: '법적 리스크, 규정 준수, 계약 조건 검토에 능합니다.',
    expertiseEn: 'Skilled at legal risk, compliance, and contract review.',
    tone: '명확하고 보수적으로, 가능/불가능을 확실히 구분합니다.',
    toneEn: 'Clear and conservative; draws firm lines between what is and isn\'t allowed.',
    keywords: ['법', '규정', '계약', '라이선스', '개인정보', '약관', '컴플라이언스'],
    is_builtin: true, archived: false,
  },

  // ── 특수: 항해장 ──
  {
    id: 'navigator', name: '항해장', nameEn: 'Navigator', role: '종합 검토자', roleEn: 'Chief Reviewer', emoji: '🧭', color: '#D97706',
    origin: 'builtin', capabilities: ['review'],
    group: 'special', chain_id: null,
    unlock_condition: { type: 'always', required: 0 }, unlocked: true,
    expertise: '메타 관찰, 품질 체크, 팀 간 모순 발견, 사용자 성장 미션 제안.',
    expertiseEn: 'Meta-observation, quality checks, surfacing contradictions across the team, and proposing growth missions.',
    tone: '관조적이고 때로 보수적. 놓치고 있는 관점을 짚어줍니다.',
    toneEn: 'Observational, at times conservative; points out the perspective being missed.',
    keywords: [],
    is_builtin: true, archived: false,
  },
];

const BUILTIN_CHAINS: Omit<AgentChain, 'total_tasks'>[] = [
  { id: 'research', name: '리서치', agent_ids: ['hayoon', 'sujin', 'research_director'] },
  { id: 'strategy', name: '전략', agent_ids: ['strategy_jr', 'hyunwoo', 'chief_strategist'] },
];

// ─── Helper ───

function now(): string {
  return new Date().toISOString();
}

function makeAgent(def: typeof BUILTIN_AGENTS[number]): Agent {
  const ts = now();
  return {
    ...def,
    xp: 0,
    level: 1,
    observations: [],
    last_used_at: null,
    created_at: ts,
    updated_at: ts,
  };
}

function persistAgents(agents: Agent[]) {
  setStorage(STORAGE_KEYS.AGENTS, agents);
}

function persistChains(chains: AgentChain[]) {
  setStorage(STORAGE_KEYS.AGENT_CHAINS, chains);
}

function persistActivities(activities: AgentActivity[]) {
  // 최근 500개만 localStorage에 보관
  setStorage(STORAGE_KEYS.AGENT_ACTIVITIES, activities.slice(-500));
}

// ─── Store ───

interface AgentState {
  agents: Agent[];
  chains: AgentChain[];
  activities: AgentActivity[];
  lastUnlockedIds: string[];

  // Load
  loadAgents: () => void;

  // CRUD
  createAgent: (data: Partial<Agent> & Pick<Agent, 'name' | 'role' | 'emoji' | 'color'>) => string;
  updateAgent: (id: string, data: Partial<Agent>) => void;
  archiveAgent: (id: string) => void;
  getAgent: (id: string) => Agent | undefined;

  // Query
  getUnlockedAgents: () => Agent[];
  getAgentsByGroup: (group: AgentGroup) => Agent[];
  getAgentsByCapability: (cap: AgentCapability) => Agent[];
  getChain: (chainId: string) => AgentChain | undefined;

  // Activity + XP
  recordActivity: (agentId: string, type: AgentActivityType, context: string, sessionId?: string) => void;

  // Observations
  addObservation: (
    agentId: string,
    obs: Pick<AgentObservation, 'category' | 'observation'> & { source?: AgentObservation['source'] },
  ) => void;
  reinforceObservation: (agentId: string, obsId: string) => void;

  // 작업 배정
  assignAgentToTask: (task: string, expectedOutput: string, usedIds: Set<string>) => Agent;

  // Boss 생성
  createBossAgent: (config: {
    name: string;
    typeCode: string;
    gender: '남' | '여';
    personalityProfile: Agent['personality_profile'];
    sajuProfile?: unknown;
    zodiacProfile?: unknown;
    birthYear?: number;
    birthMonth?: number;
    birthDay?: number;
    locale?: 'ko' | 'en';
    userContextHint?: string;
  }) => string;

  // 해금
  checkUnlocks: () => string[];
  clearUnlocked: () => void;

  // Seed + Migration
  seedBuiltinAgents: (opts?: { deferSync?: boolean }) => void;
  migrateFromPersonas: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  chains: [],
  activities: [],
  lastUnlockedIds: [],

  // ─── Load ───

  loadAgents: () => {
    const agents = getStorage<Agent[]>(STORAGE_KEYS.AGENTS, []);
    const chains = getStorage<AgentChain[]>(STORAGE_KEYS.AGENT_CHAINS, []);
    const activities = getStorage<AgentActivity[]>(STORAGE_KEYS.AGENT_ACTIVITIES, []);

    let seededThisLoad = false;
    if (agents.length === 0) {
      // 최초 실행: seed — 그리고 아래 Supabase 머지로 계속 진행한다.
      // (예전엔 여기서 return해서 새 기기 첫 로드에 원격 에이전트가 안 보였다.)
      // deferSync: 시드 직후 즉시 upsert하면 새 기기의 "방금 만든" 시드가
      // mergeByTimestamp(최신 승)에서 원격의 진짜 XP/활동을 이기고, 원격
      // 행까지 0으로 덮는다 — 머지가 끝난 뒤에 이긴 쪽을 올린다.
      get().seedBuiltinAgents({ deferSync: true });
      seededThisLoad = true;
    } else {
      // 기존 데이터 마이그레이션 (v4.1 W1.5: 해금 게이트 제거 — 빌트인 17명은
      // 전부 즉시 사용 가능, XP/레벨은 코스메틱). 옛 localStorage에 남은
      // unlocked:false / chain_tasks 조건을 'always'로 강제한다.
      // 사용자가 만든 에이전트는 건드리지 않는다.
      const builtinIds = new Set(BUILTIN_AGENTS.map(b => b.id));
      let migrated = false;
      const migratedAgents = agents.map(a => {
        if (builtinIds.has(a.id) && (!a.unlocked || a.unlock_condition?.type !== 'always')) {
          migrated = true;
          return { ...a, unlocked: true, unlock_condition: { type: 'always' as const, required: 0 }, updated_at: now() };
        }
        return a;
      });
      if (migrated) persistAgents(migratedAgents);

      set({ agents: migratedAgents, chains, activities });

      // 기존 Persona 마이그레이션 (아직 안 됐으면)
      get().migrateFromPersonas();

      // 해금 상태 재계산
      get().checkUnlocks();
    }

    // Supabase async merge
    loadAndMerge<Agent>('agents', STORAGE_KEYS.AGENTS)
      .then((merged) => {
        if (merged.length > 0) {
          const current = get().agents;
          const newLocal = current.filter(c => !merged.find(m => m.id === c.id));
          set({ agents: [...merged, ...newLocal] });
          get().checkUnlocks();
        }
        // Fresh-device seed deferred its upsert until after the merge —
        // now push whatever won (remote XP intact, or the seeds for a
        // genuinely-new user). persistAgents keeps localStorage in step.
        if (seededThisLoad) {
          persistAgents(get().agents);
          syncToSupabase('agents', get().agents);
        }
      });
    loadAndMerge<AgentChain>('agent_chains', STORAGE_KEYS.AGENT_CHAINS)
      .then((merged) => {
        if (merged.length > 0) {
          const current = get().chains;
          const newLocal = current.filter(c => !merged.find(m => m.id === c.id));
          set({ chains: [...merged, ...newLocal] });
        }
        if (seededThisLoad) {
          persistChains(get().chains);
          syncToSupabase('agent_chains', get().chains);
        }
      });
  },

  // ─── CRUD ───

  createAgent: (data) => {
    const id = data.id || generateId();
    // 중복 ID 방지
    if (get().agents.some(a => a.id === id)) return id;
    const ts = now();
    const agent: Agent = {
      id,
      name: data.name,
      role: data.role,
      emoji: data.emoji,
      color: data.color,
      origin: data.origin || 'custom',
      capabilities: data.capabilities || ['task_execution'],
      group: data.group || 'people',
      chain_id: data.chain_id ?? null,
      unlock_condition: data.unlock_condition || { type: 'always', required: 0 },
      unlocked: data.unlocked ?? true,
      expertise: data.expertise,
      tone: data.tone,
      keywords: data.keywords,
      organization: data.organization,
      priorities: data.priorities,
      communication_style: data.communication_style,
      known_concerns: data.known_concerns,
      relationship_notes: data.relationship_notes,
      influence: data.influence,
      decision_style: data.decision_style,
      risk_tolerance: data.risk_tolerance,
      success_metric: data.success_metric,
      extracted_traits: data.extracted_traits,
      feedback_logs: data.feedback_logs,
      personality_code: data.personality_code,
      personality_profile: data.personality_profile,
      boss_gender: data.boss_gender,
      birth_year: data.birth_year,
      birth_month: data.birth_month,
      birth_day: data.birth_day,
      saju_profile: data.saju_profile,
      zodiac_profile: data.zodiac_profile,
      boss_locale: data.boss_locale,
      user_context_hint: data.user_context_hint,
      chat_history: data.chat_history,
      inner_monologue_archive: data.inner_monologue_archive,
      xp: data.xp || 0,
      level: calculateLevel(data.xp || 0),
      observations: data.observations || [],
      is_builtin: data.is_builtin || false,
      is_example: data.is_example,
      archived: data.archived || false,
      last_used_at: null,
      created_at: ts,
      updated_at: ts,
    };
    const agents = [...get().agents, agent];
    persistAgents(agents);
    set({ agents });
    upsertToSupabase('agents', agent);
    return id;
  },

  updateAgent: (id, data) => {
    const agents = get().agents.map(a =>
      a.id === id ? { ...a, ...data, updated_at: now() } : a,
    );
    persistAgents(agents);
    set({ agents });
    const updated = agents.find(a => a.id === id);
    if (updated) upsertToSupabase('agents', updated);
  },

  archiveAgent: (id) => {
    get().updateAgent(id, { archived: true });
  },

  getAgent: (id) => {
    return get().agents.find(a => a.id === id);
  },

  // ─── Query ───

  getUnlockedAgents: () => {
    // W1.5① 게이트 제거 (창업자 결정): the unlock gate no longer filters the
    // main flow — all 17 personas are available from the first session. The
    // `unlocked` flag and XP/level survive as COSMETIC progression only
    // (UnlockToast / CollectionProgress); they must never gate capability.
    // Function name kept for API stability across ~10 call sites.
    return get().agents.filter(a => !a.archived);
  },

  getAgentsByGroup: (group) => {
    return get().agents.filter(a => a.group === group && !a.archived);
  },

  getAgentsByCapability: (cap) => {
    return get().agents.filter(a => a.capabilities.includes(cap) && !a.archived);
  },

  getChain: (chainId) => {
    return get().chains.find(c => c.id === chainId);
  },

  // ─── Activity + XP ───

  recordActivity: (agentId, type, context, sessionId) => {
    const agent = get().getAgent(agentId);
    if (!agent) return;

    const xpKey = type as keyof typeof XP_REWARDS;
    const xpEarned = XP_REWARDS[xpKey] || 0;

    // Activity 기록
    const activity: AgentActivity = {
      id: generateId(),
      agent_id: agentId,
      type,
      context,
      session_id: sessionId,
      xp_earned: xpEarned,
      created_at: now(),
    };
    const activities = [...get().activities, activity];
    persistActivities(activities);

    // XP 적립 + 레벨 재계산
    const newXP = Math.max(0, agent.xp + xpEarned);
    const newLevel = calculateLevel(newXP);

    const agents = get().agents.map(a =>
      a.id === agentId
        ? { ...a, xp: newXP, level: newLevel, last_used_at: now(), updated_at: now() }
        : a,
    );
    persistAgents(agents);

    // 체인 작업 카운트 (task_completed만)
    let chains = get().chains;
    if (type === 'task_completed' && agent.chain_id) {
      chains = chains.map(c =>
        c.id === agent.chain_id
          ? { ...c, total_tasks: c.total_tasks + 1 }
          : c,
      );
      persistChains(chains);
    }

    set({ agents, chains, activities });

    // Supabase async
    upsertToSupabase('agents', agents.find(a => a.id === agentId)!);
    if (type === 'task_completed' && agent.chain_id) {
      syncToSupabase('agent_chains', chains);
    }
    insertToSupabase('agent_activities', activity);

    // 해금 체크
    if (type === 'task_completed') {
      get().checkUnlocks();
    }
  },

  // ─── Observations ───

  addObservation: (agentId, obs) => {
    const agent = get().getAgent(agentId);
    if (!agent) return;

    // source별 초기 confidence — 사용자 입력이 가장 높고, 자동 추출이 가장 낮음
    const source = obs.source || 'auto';
    const initialConfidence =
      source === 'user' ? 0.8 :
      source === 'calibration' ? 0.6 :
      source === 'refined' ? 0.5 :
      0.3;

    const newObs: AgentObservation = {
      id: generateId(),
      category: obs.category,
      observation: obs.observation,
      confidence: initialConfidence,
      evidence_count: 1,
      created_at: now(),
      source,
    };

    // 에이전트당 최대 20개
    const observations = [...agent.observations, newObs].slice(-20);
    get().updateAgent(agentId, { observations });
  },

  reinforceObservation: (agentId, obsId) => {
    const agent = get().getAgent(agentId);
    if (!agent) return;

    const observations = agent.observations
      .map(o => {
        if (o.id !== obsId) return o;
        return {
          ...o,
          confidence: Math.min(0.95, o.confidence + 0.15),
          evidence_count: o.evidence_count + 1,
        };
      })
      .filter(o => o.confidence >= 0.1);  // 0.1 미만 자동 삭제

    get().updateAgent(agentId, { observations });
  },

  // ─── 작업 배정 ───

  assignAgentToTask: (task, expectedOutput, usedIds) => {
    const unlocked = get().getUnlockedAgents()
      .filter(a => a.capabilities.includes('task_execution'));

    const text = `${task} ${expectedOutput}`.toLowerCase();

    // 키워드 매칭 점수 계산
    let bestAgent: Agent | null = null;
    let bestScore = 0;

    for (const agent of unlocked) {
      if (usedIds.has(agent.id)) continue;
      const keywords = agent.keywords || [];
      const score = keywords.filter(kw => text.includes(kw)).length;

      // 동일 점수면 높은 레벨 우선
      if (score > bestScore || (score === bestScore && score > 0 && agent.level > (bestAgent?.level || 0))) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    if (bestAgent) {
      usedIds.add(bestAgent.id);
      return bestAgent;
    }

    // Fallback: 첫 번째 미사용 에이전트
    const unused = unlocked.find(a => !usedIds.has(a.id));
    if (unused) {
      usedIds.add(unused.id);
      return unused;
    }

    // 최종 fallback: 하윤 (중복 허용)
    const hayoon = get().agents.find(a => a.id === 'hayoon');
    return hayoon || unlocked[0];
  },

  // ─── Boss 생성 ───

  createBossAgent: (config) => {
    const locale = config.locale ?? (getCurrentLanguage() === 'ko' ? 'ko' : 'en');
    return get().createAgent({
      name: config.name,
      role: locale === 'ko' ? '팀장' : 'Boss',
      roleEn: 'Boss',
      emoji: '👔',
      color: '#92400E',
      origin: 'boss_sim',
      capabilities: ['boss_chat', 'review'],
      group: 'people',
      chain_id: null,
      unlock_condition: { type: 'always', required: 0 },
      unlocked: true,
      personality_code: config.typeCode,
      personality_profile: config.personalityProfile,
      boss_gender: config.gender,
      birth_year: config.birthYear,
      birth_month: config.birthMonth,
      birth_day: config.birthDay,
      saju_profile: config.sajuProfile,
      zodiac_profile: config.zodiacProfile,
      boss_locale: locale,
      user_context_hint: config.userContextHint?.trim() || undefined,
    });
  },

  // ─── 해금 체크 ───

  checkUnlocks: () => {
    const { agents, chains } = get();
    const newlyUnlocked: string[] = [];

    // 전체 작업 수 (모든 에이전트)
    const totalTasks = chains.reduce((sum, c) => sum + c.total_tasks, 0)
      + agents
        .filter(a => !a.chain_id && a.is_builtin)
        .reduce((sum, a) => {
          // 독립 에이전트의 task count: activities에서 계산
          const taskCount = get().activities.filter(
            act => act.agent_id === a.id && act.type === 'task_completed',
          ).length;
          return sum + taskCount;
        }, 0);

    const updated = agents.map(agent => {
      if (agent.unlocked || agent.archived) return agent;

      let shouldUnlock = false;

      switch (agent.unlock_condition.type) {
        case 'always':
          shouldUnlock = true;
          break;
        case 'chain_tasks': {
          const chain = chains.find(c => c.id === agent.unlock_condition.chain_id);
          shouldUnlock = (chain?.total_tasks || 0) >= agent.unlock_condition.required;
          break;
        }
        case 'total_tasks': {
          // 태스크 수 OR 세션 수 (항해장 조기 해금)
          const sessionCount = getStorage<unknown[]>(STORAGE_KEYS.PROGRESSIVE_SESSIONS, []).length;
          shouldUnlock = totalTasks >= agent.unlock_condition.required
            || sessionCount >= NAVIGATOR_SESSION_THRESHOLD;
          break;
        }
        case 'sessions': {
          const sessions = getStorage<unknown[]>(STORAGE_KEYS.PROGRESSIVE_SESSIONS, []).length;
          shouldUnlock = sessions >= agent.unlock_condition.required;
          break;
        }
      }

      if (shouldUnlock) {
        newlyUnlocked.push(agent.id);
        return { ...agent, unlocked: true, updated_at: now() };
      }
      return agent;
    });

    if (newlyUnlocked.length > 0) {
      persistAgents(updated);
      set({ agents: updated, lastUnlockedIds: newlyUnlocked });
    }

    return newlyUnlocked;
  },

  clearUnlocked: () => {
    set({ lastUnlockedIds: [] });
  },

  // ─── Seed ───

  seedBuiltinAgents: (opts?: { deferSync?: boolean }) => {
    const existing = get().agents;
    if (existing.some(a => a.is_builtin)) return; // idempotent

    // Seeds carry an EPOCH updated_at: they're static defaults, so any real
    // record (remote XP from another device, or any later local mutation)
    // must out-rank them in mergeByTimestamp. A now() stamp made a fresh
    // device's seed "newer" than months of remote history.
    const SEED_TS = '1970-01-01T00:00:00.000Z';
    const agents = BUILTIN_AGENTS.map(makeAgent).map(a => ({ ...a, updated_at: SEED_TS }));
    const chains: AgentChain[] = BUILTIN_CHAINS.map(c => ({ ...c, total_tasks: 0 }));

    persistAgents(agents);
    persistChains(chains);
    set({ agents, chains });

    // Supabase async — deferSync lets loadAgents push AFTER the remote merge.
    if (!opts?.deferSync) {
      syncToSupabase('agents', agents);
      syncToSupabase('agent_chains', chains);
    }
  },

  // ─── Migration ───

  migrateFromPersonas: () => {
    const existingPeople = get().agents.filter(a => a.origin === 'stakeholder');
    if (existingPeople.length > 0) return; // 이미 마이그레이션됨

    const personas = getStorage<Persona[]>(STORAGE_KEYS.PERSONAS, []);
    if (personas.length === 0) return;

    for (const persona of personas) {
      const input = personaToAgentInput(persona);
      get().createAgent({
        ...input,
        name: input.name || persona.name,
        role: input.role || persona.role,
        emoji: input.emoji || '👤',
        color: input.color || '#6B7280',
      });
    }
  },
}));
