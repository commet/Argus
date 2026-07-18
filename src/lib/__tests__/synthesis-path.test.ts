import { describe, expect, it } from 'vitest';
import { locateSynthesisSource } from '@/lib/synthesis-path';
import type { SynthesizeItem } from '@/stores/types';

const item: SynthesizeItem = {
  id: 'synthesis/one',
  raw_input: '',
  sources: [
    { name: '재무안', content: '# 현황\n현재 유료 전환율은 8%다.\n\n최근 전환율 상승 폭은 목표에 미치지 못했다.' },
    { name: '제품안', content: '# 실험\n온보딩 화면을 두 단계 줄인다.' },
  ],
  analysis: {
    sources_summary: [
      { name: '재무안', core_claim: '현재 유료 전환율은 8%다.' },
      { name: '제품안', core_claim: '온보딩 화면을 두 단계 줄인다.' },
    ],
    agreements: [],
    conflicts: [],
    questions_for_user: [],
  },
  final_synthesis: '',
  status: 'review',
  created_at: '',
  updated_at: '',
};

describe('synthesis source location', () => {
  it('returns an exact line for verbatim positions', () => {
    expect(locateSynthesisSource(item, '재무안', '현재 유료 전환율은 8%다.')).toMatchObject({
      sourceIndex: 0,
      lineStart: 2,
      lineEnd: 2,
      match: 'direct',
    });
  });

  it('labels paraphrase matching as inferred and weak matches as unresolved', () => {
    expect(locateSynthesisSource(item, '재무안', '전환율 상승 폭이 목표보다 부족하다')?.match).toBe('closest');
    expect(locateSynthesisSource(item, '재무안', '법무 승인과 보안 감사를 완료한다')?.match).toBe('unresolved');
  });
});
