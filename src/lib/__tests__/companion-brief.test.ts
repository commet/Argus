import { describe, it, expect } from 'vitest';
import { buildCompanionBrief, type DueReceiptBrief } from '../companion-brief';

const item: DueReceiptBrief = {
  source_title: '온보딩 리빌드 전략',
  core_question: '지금 온보딩을 다시 만들 때인가?',
  predicates: [
    { predicate: '2주 안에 activation이 오른다', pass_condition: '+5%p', fail_condition: '변화 없음', check_by: '2026-07-15' },
  ],
};

describe('buildCompanionBrief', () => {
  it('carries the sealed predicate and links to the review list', () => {
    const email = buildCompanionBrief([item], 'https://argus.voyage');
    expect(email.subject).toContain('온보딩 리빌드 전략');
    expect(email.markdown).toContain('2주 안에 activation이 오른다');
    expect(email.markdown).toContain('맞음: +5%p');
    expect(email.markdown).toContain('확인일: 2026-07-15');
    expect(email.url).toBe('https://argus.voyage/tools/review');
  });

  it('never asserts a verdict — the user records reality', () => {
    const md = buildCompanionBrief([item]).markdown;
    // spine: Argus does not say whether it came true
    expect(md).toContain('제가 정하지 않아요');
    expect(md).not.toMatch(/맞았습니다|틀렸습니다|성공|실패했/);
  });

  it('pluralizes the subject when multiple predicates are due', () => {
    const two: DueReceiptBrief = { ...item, predicates: [item.predicates[0], { ...item.predicates[0], predicate: 'p2' }] };
    expect(buildCompanionBrief([two]).subject).toContain('2가지');
  });
});
