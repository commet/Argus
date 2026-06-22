/**
 * Workflow Review Integration — runWorkflowReview 통합 테스트
 *
 * 핵심 검증:
 * - 3개 렌즈(skeptic, optimizer, domain_*) 병렬 실행
 * - selectDomainType 간접 테스트 (시장/기술/조직/일반 키워드)
 * - Promise.allSettled: 부분 실패, 전체 실패 처리
 * - findings 매핑 정합성
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCallLLMJson = vi.fn();
vi.mock('@/lib/llm', () => ({
  callLLMJson: (...args: unknown[]) => mockCallLLMJson(...args),
}));

import { runWorkflowReview } from '@/lib/workflow-review';
import type { RecastStep, WorkflowReview } from '@/stores/types';
import { setModuleLocale } from '@/lib/i18n';

// i18n default is now 'en' (en-first). These suites verify the KOREAN prompt
// output, so pin the locale. The English branch is verified in Phase 3.
beforeEach(() => setModuleLocale('ko'));

function makeStep(overrides: Partial<RecastStep> = {}): RecastStep {
  return {
    task: '작업',
    actor: 'ai',
    actor_reasoning: '',
    expected_output: '산출물',
    checkpoint: false,
    checkpoint_reason: '',
    ...overrides,
  };
}

function mockReviewOutput(
  findings: {
    type: string;
    severity: string;
    text: string;
    affected_steps?: number[];
  }[],
) {
  return { findings };
}

describe('Workflow Review Integration', () => {
  beforeEach(() => {
    mockCallLLMJson.mockReset();
  });

  // ═══════════════════════════════════════
  // 1. 3개 렌즈 모두 성공
  // ═══════════════════════════════════════
  it('returns 3 reviews when all lenses succeed', async () => {
    mockCallLLMJson.mockResolvedValue(
      mockReviewOutput([
        { type: 'risk', severity: 'high', text: 'some finding', affected_steps: [1] },
      ]),
    );

    const results = await runWorkflowReview(
      [makeStep()],
      '핵심 방향',
      '목표 요약',
      [{ assumption: '가정1', if_wrong: '틀리면' }],
      '원래 과제',
    );

    expect(results).toHaveLength(3);
    const lensIds = results.map((r) => r.lens);
    expect(lensIds).toContain('skeptic');
    expect(lensIds).toContain('optimizer');
    expect(lensIds[2]).toMatch(/^domain_/);
    // Each has correct structure
    for (const review of results) {
      expect(review.lens_label).toBeTruthy();
      expect(review.reviewed_at).toBeTruthy();
      expect(Array.isArray(review.findings)).toBe(true);
    }
  });

  // ═══════════════════════════════════════
  // 2. 도메인 선택: 시장 키워드
  // ═══════════════════════════════════════
  it('selects domain_market when task contains market keywords', async () => {
    mockCallLLMJson.mockResolvedValue(mockReviewOutput([]));

    const results = await runWorkflowReview(
      [makeStep()],
      '고객 확보 전략',
      '시장 점유율',
      [],
      '시장 진출과 고객 분석',
    );

    const domainLens = results.find((r) => r.lens.startsWith('domain_'));
    expect(domainLens).toBeDefined();
    expect(domainLens!.lens).toBe('domain_market');
  });

  // ═══════════════════════════════════════
  // 3. 도메인 선택: 기술 키워드
  // ═══════════════════════════════════════
  it('selects domain_tech when task contains tech keywords', async () => {
    mockCallLLMJson.mockResolvedValue(mockReviewOutput([]));

    const results = await runWorkflowReview(
      [makeStep()],
      '시스템 아키텍처 설계',
      '플랫폼 구축',
      [],
      '개발 인프라 시스템 구현',
    );

    const domainLens = results.find((r) => r.lens.startsWith('domain_'));
    expect(domainLens).toBeDefined();
    expect(domainLens!.lens).toBe('domain_tech');
  });

  // ═══════════════════════════════════════
  // 4. 도메인 선택: 조직 키워드
  // ═══════════════════════════════════════
  it('selects domain_organization when task contains org keywords', async () => {
    mockCallLLMJson.mockResolvedValue(mockReviewOutput([]));

    const results = await runWorkflowReview(
      [makeStep()],
      '조직 문화 혁신',
      '팀 역량 강화',
      [],
      '조직 변화관리와 채용 프로세스',
    );

    const domainLens = results.find((r) => r.lens.startsWith('domain_'));
    expect(domainLens).toBeDefined();
    expect(domainLens!.lens).toBe('domain_organization');
  });

  // ═══════════════════════════════════════
  // 5. 도메인 선택: 일반 폴백
  // ═══════════════════════════════════════
  it('selects domain_general when no domain keywords match', async () => {
    mockCallLLMJson.mockResolvedValue(mockReviewOutput([]));

    const results = await runWorkflowReview(
      [makeStep()],
      'neutral direction',
      'neutral goal',
      [],
      'something unrelated to any domain',
    );

    const domainLens = results.find((r) => r.lens.startsWith('domain_'));
    expect(domainLens).toBeDefined();
    expect(domainLens!.lens).toBe('domain_general');
  });

  // ═══════════════════════════════════════
  // 6. 부분 렌즈 실패
  // ═══════════════════════════════════════
  it('handles partial lens failures gracefully', async () => {
    let callCount = 0;
    mockCallLLMJson.mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        return Promise.reject(new Error('LLM timeout'));
      }
      return Promise.resolve(
        mockReviewOutput([
          { type: 'risk', severity: 'medium', text: 'finding' },
        ]),
      );
    });

    const results = await runWorkflowReview(
      [makeStep()],
      '방향',
      '목표',
      [],
      '과제',
    );

    expect(results).toHaveLength(2);
    // All returned results should be valid reviews
    for (const review of results) {
      expect(review.lens).toBeTruthy();
      expect(Array.isArray(review.findings)).toBe(true);
    }
  });

  // ═══════════════════════════════════════
  // 7. 전체 렌즈 실패
  // ═══════════════════════════════════════
  it('returns empty array when all lenses fail', async () => {
    mockCallLLMJson.mockRejectedValue(new Error('All LLM calls failed'));

    const results = await runWorkflowReview(
      [makeStep()],
      '방향',
      '목표',
      [],
      '과제',
    );

    expect(results).toEqual([]);
  });

  // ═══════════════════════════════════════
  // 8. findings 매핑 정합성
  // ═══════════════════════════════════════
  it('correctly maps findings with type, severity, text, and affected_steps', async () => {
    mockCallLLMJson.mockResolvedValue(
      mockReviewOutput([
        { type: 'gap', severity: 'high', text: '중요한 빈틈', affected_steps: [1, 3] },
        { type: 'suggestion', severity: 'low', text: '개선 제안', affected_steps: [2] },
      ]),
    );

    const results = await runWorkflowReview(
      [makeStep(), makeStep(), makeStep()],
      '방향',
      '목표',
      [],
      '과제',
    );

    expect(results.length).toBeGreaterThan(0);
    const firstReview = results[0];
    expect(firstReview.findings).toHaveLength(2);

    const [f1, f2] = firstReview.findings;
    expect(f1.type).toBe('gap');
    expect(f1.severity).toBe('high');
    expect(f1.text).toBe('중요한 빈틈');
    expect(f1.affected_steps).toEqual([1, 3]);

    expect(f2.type).toBe('suggestion');
    expect(f2.severity).toBe('low');
    expect(f2.text).toBe('개선 제안');
    expect(f2.affected_steps).toEqual([2]);
  });

  // ═══════════════════════════════════════
  // 9. 빈 steps 배열 처리
  // ═══════════════════════════════════════
  it('handles empty steps array without crashing', async () => {
    mockCallLLMJson.mockResolvedValue(mockReviewOutput([]));

    const results = await runWorkflowReview(
      [],
      '방향',
      '목표',
      [],
      '과제',
    );

    expect(results).toHaveLength(3);
    // callLLMJson should still have been called 3 times
    expect(mockCallLLMJson).toHaveBeenCalledTimes(3);
  });

  // ═══════════════════════════════════════
  // 10. 핵심 가정 텍스트 포매팅
  // ═══════════════════════════════════════
  it('formats key assumptions with numbering in prompts', async () => {
    mockCallLLMJson.mockResolvedValue(mockReviewOutput([]));

    await runWorkflowReview(
      [makeStep()],
      '방향',
      '목표',
      [
        { assumption: '사용자가 비용을 지불할 것이다', if_wrong: '매출 없음' },
        { assumption: '기술적으로 구현 가능하다', if_wrong: '일정 지연' },
        { assumption: '팀이 충분하다', if_wrong: '' },
      ],
      '과제',
    );

    // Verify the prompt passed to callLLMJson contains numbered assumptions
    expect(mockCallLLMJson).toHaveBeenCalled();
    const firstCallArgs = mockCallLLMJson.mock.calls[0];
    const systemPrompt: string = firstCallArgs[1]?.system ?? '';

    expect(systemPrompt).toContain('1. 사용자가 비용을 지불할 것이다 (틀리면: 매출 없음)');
    expect(systemPrompt).toContain('2. 기술적으로 구현 가능하다 (틀리면: 일정 지연)');
    // Third assumption has empty if_wrong, so no parenthetical
    expect(systemPrompt).toContain('3. 팀이 충분하다');
    expect(systemPrompt).not.toContain('3. 팀이 충분하다 (틀리면:');
  });
});
