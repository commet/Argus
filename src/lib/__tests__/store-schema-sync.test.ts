/**
 * Store Schema Sync — 스토어 creator/defaults와 TypeScript 인터페이스 일치 검증
 *
 * CLAUDE.md 체크리스트:
 * "Store creator가 타입의 모든 필드를 명시적으로 매핑하는가?"
 * "DEFAULT 값이 현실적인 값을 포함하는가?"
 *
 * 이 테스트는 런타임에 생성된 객체가 TypeScript 인터페이스의 필수 필드를 모두 갖는지 검증한다.
 * 컴파일러만으로는 잡을 수 없는 런타임 누락 (예: data spread에서 빠진 필드)을 잡는다.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock all external dependencies
vi.mock('@/lib/storage', () => ({
  getStorage: vi.fn(() => []),
  setStorage: vi.fn(),
  STORAGE_KEYS: {
    PERSONAS: 'sot_personas',
    FEEDBACK_HISTORY: 'sot_feedback_history',
    REFRAME_LIST: 'sot_reframe_list',
    RECAST_LIST: 'sot_recast_list',
    REFINE_LOOPS: 'sot_refine_loops',
    PROJECTS: 'sot_projects',
    JUDGMENTS: 'sot_judgments',
    ACCURACY_RATINGS: 'sot_accuracy_ratings',
    SYNTHESIZE_LIST: 'sot_synthesize_list',
    SETTINGS: 'sot_settings',
  },
}));

vi.mock('@/lib/db', () => ({
  upsertToSupabase: vi.fn(),
  deleteFromSupabase: vi.fn(),
  softDeleteFromSupabase: vi.fn(),
  loadAndMerge: vi.fn(() => Promise.resolve([])),
  insertToSupabase: vi.fn(),
}));

vi.mock('@/lib/uuid', () => ({
  generateId: vi.fn(() => `test-${Date.now()}-${Math.random().toString(36).slice(2)}`),
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}));

vi.mock('@/lib/convergence', () => ({
  checkLoopConvergence: vi.fn(() => ({ converged: false, total_issues: 0, critical_risks: 0 })),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(() => null),
}));

import { usePersonaStore } from '@/stores/usePersonaStore';
import { useReframeStore } from '@/stores/useReframeStore';
import { useRecastStore } from '@/stores/useRecastStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useJudgmentStore } from '@/stores/useJudgmentStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

describe('Store Schema Sync', () => {

  // ═══════════════════════════════════════
  // Persona Store
  // ═══════════════════════════════════════
  describe('usePersonaStore.createPersona', () => {
    it('최소 데이터로 생성해도 모든 Persona 필수 필드가 존재', () => {
      const store = usePersonaStore.getState();
      const id = store.createPersona({ name: 'Test' });
      const persona = store.getPersona(id);

      expect(persona).toBeDefined();
      // Persona 인터페이스의 필수 필드들
      expect(persona!.id).toBeTruthy();
      expect(typeof persona!.name).toBe('string');
      expect(typeof persona!.role).toBe('string');
      expect(typeof persona!.organization).toBe('string');
      expect(typeof persona!.priorities).toBe('string');
      expect(typeof persona!.communication_style).toBe('string');
      expect(typeof persona!.known_concerns).toBe('string');
      expect(typeof persona!.relationship_notes).toBe('string');
      expect(['high', 'medium', 'low']).toContain(persona!.influence);
      expect(Array.isArray(persona!.extracted_traits)).toBe(true);
      expect(Array.isArray(persona!.feedback_logs)).toBe(true);
      expect(persona!.created_at).toBeTruthy();
      expect(persona!.updated_at).toBeTruthy();
    });

    it('빈 Partial로 생성해도 crash 안됨', () => {
      const store = usePersonaStore.getState();
      const id = store.createPersona({});
      const persona = store.getPersona(id);
      expect(persona).toBeDefined();
      expect(persona!.name).toBe('');
      expect(persona!.influence).toBe('medium'); // default
    });

    it('모든 필드를 명시적으로 전달하면 그대로 반영', () => {
      const store = usePersonaStore.getState();
      const id = store.createPersona({
        name: '테스트',
        role: 'CTO',
        organization: 'Tech',
        priorities: '기술',
        communication_style: '직설적',
        known_concerns: '보안',
        relationship_notes: '신뢰',
        influence: 'high',
        decision_style: 'analytical',
        risk_tolerance: 'low',
        success_metric: 'uptime',
        extracted_traits: ['trait1'],
      });
      const p = store.getPersona(id)!;
      expect(p.name).toBe('테스트');
      expect(p.role).toBe('CTO');
      expect(p.decision_style).toBe('analytical');
      expect(p.risk_tolerance).toBe('low');
      expect(p.success_metric).toBe('uptime');
    });
  });

  describe('DEFAULT_PERSONAS 완성도', () => {
    it('seedDefaultPersonas가 3개를 생성', () => {
      usePersonaStore.setState({ personas: [] });
      usePersonaStore.getState().seedDefaultPersonas();
      expect(usePersonaStore.getState().personas).toHaveLength(3);
    });

    it('각 기본 페르소나가 모든 필수 필드를 가짐', () => {
      usePersonaStore.setState({ personas: [] });
      usePersonaStore.getState().seedDefaultPersonas();

      for (const persona of usePersonaStore.getState().personas) {
        expect(persona.id).toBeTruthy();
        expect(persona.name.length).toBeGreaterThan(0);
        expect(persona.role.length).toBeGreaterThan(0);
        expect(persona.priorities.length).toBeGreaterThan(0);
        expect(persona.communication_style.length).toBeGreaterThan(0);
        expect(persona.known_concerns.length).toBeGreaterThan(0);
        expect(['high', 'medium', 'low']).toContain(persona.influence);
        expect(persona.decision_style).toBeTruthy();
        expect(persona.risk_tolerance).toBeTruthy();
        expect(persona.success_metric).toBeTruthy();
        expect(persona.extracted_traits.length).toBeGreaterThan(0);
        expect(persona.is_example).toBe(true);
        expect(persona.feedback_logs).toEqual([]);
        expect(persona.created_at).toBeTruthy();
        expect(persona.updated_at).toBeTruthy();
      }
    });

    it('이미 페르소나가 있으면 seed 안함', () => {
      const count = usePersonaStore.getState().personas.length;
      usePersonaStore.getState().seedDefaultPersonas();
      expect(usePersonaStore.getState().personas.length).toBe(count);
    });
  });

  // ═══════════════════════════════════════
  // Reframe Store
  // ═══════════════════════════════════════
  describe('useReframeStore.createItem', () => {
    it('ReframeItem 필수 필드 존재', () => {
      const store = useReframeStore.getState();
      store.createItem('테스트 입력');
      const item = store.getCurrentItem();

      expect(item).toBeDefined();
      expect(item!.id).toBeTruthy();
      expect(item!.input_text).toBe('테스트 입력');
      expect(item!.analysis).toBeNull();
      expect(item!.selected_question).toBe('');
      expect(item!.status).toBe('input');
      expect(item!.created_at).toBeTruthy();
      expect(item!.updated_at).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════
  // Recast Store
  // ═══════════════════════════════════════
  describe('useRecastStore.createItem', () => {
    it('RecastItem 필수 필드 존재', () => {
      const store = useRecastStore.getState();
      store.createItem();
      const item = store.getCurrentItem();

      expect(item).toBeDefined();
      expect(item!.id).toBeTruthy();
      expect(item!.input_text).toBe('');
      expect(item!.analysis).toBeNull();
      expect(Array.isArray(item!.steps)).toBe(true);
      expect(item!.status).toBe('input');
      expect(item!.created_at).toBeTruthy();
      expect(item!.updated_at).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════
  // Project Store
  // ═══════════════════════════════════════
  describe('useProjectStore.createProject', () => {
    it('Project 필수 필드 존재', () => {
      const store = useProjectStore.getState();
      const id = store.createProject('테스트 프로젝트', '설명');
      const project = store.getProject(id);

      expect(project).toBeDefined();
      expect(project!.id).toBeTruthy();
      expect(project!.name).toBe('테스트 프로젝트');
      expect(project!.description).toBe('설명');
      expect(Array.isArray(project!.refs)).toBe(true);
      expect(project!.created_at).toBeTruthy();
      expect(project!.updated_at).toBeTruthy();
    });

    it('description 기본값 빈 문자열', () => {
      const store = useProjectStore.getState();
      const id = store.createProject('이름만');
      const project = store.getProject(id);
      expect(project!.description).toBe('');
    });
  });

  // ═══════════════════════════════════════
  // Judgment Store
  // ═══════════════════════════════════════
  describe('useJudgmentStore.addJudgment', () => {
    it('JudgmentRecord 필수 필드 존재', () => {
      useJudgmentStore.getState().addJudgment({
        type: 'actor_override',
        context: 'test',
        decision: 'human',
        original_ai_suggestion: 'ai suggested',
        user_changed: true,
        tool: 'recast',
      });
      const judgments = useJudgmentStore.getState().judgments;
      expect(judgments.length).toBeGreaterThan(0);
      const j = judgments[judgments.length - 1];
      expect(j.id).toBeTruthy();
      expect(j.type).toBe('actor_override');
      expect(j.user_changed).toBe(true);
      expect(j.created_at).toBeTruthy();
    });
  });

  // ═══════════════════════════════════════
  // Settings Store
  // ═══════════════════════════════════════
  describe('useSettingsStore defaults', () => {
    it('Settings 인터페이스의 모든 필드에 기본값 존재', () => {
      const store = useSettingsStore.getState();
      const s = store.settings;

      expect(typeof s.anthropic_api_key).toBe('string');
      expect(typeof s.openai_api_key).toBe('string');
      expect(['anthropic', 'openai']).toContain(s.llm_provider);
      expect(['proxy', 'direct', 'local']).toContain(s.llm_mode);
      expect(typeof s.local_endpoint).toBe('string');
      expect(['ko', 'en']).toContain(s.language);
      expect(typeof s.audio_enabled).toBe('boolean');
      expect(typeof s.audio_volume).toBe('number');
    });

    it('기본 LLM 모드는 proxy', () => {
      expect(useSettingsStore.getState().settings.llm_mode).toBe('proxy');
    });

    it('기본 언어는 영어 (en-first)', () => {
      // en-first launch: a fresh install with no stored preference defaults to
      // English. A returning user's stored choice still wins via loadSettings.
      expect(useSettingsStore.getState().settings.language).toBe('en');
    });
  });

  // ═══════════════════════════════════════
  // Cross-store: ID 유일성
  // ═══════════════════════════════════════
  describe('Cross-store: ID 생성 유일성', () => {
    it('같은 스토어에서 연속 생성 시 ID가 다름', () => {
      const store = usePersonaStore.getState();
      const id1 = store.createPersona({ name: 'A' });
      const id2 = store.createPersona({ name: 'B' });
      expect(id1).not.toBe(id2);
    });
  });
});
