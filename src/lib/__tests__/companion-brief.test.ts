import { describe, it, expect } from 'vitest';
import { buildCompanionBrief, companionBriefItemCount, type DueReceiptBrief } from '../companion-brief';

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

  it('counts only real brief items so the gate can silence empty briefs', () => {
    expect(companionBriefItemCount([{ source_title: '빈 브리프', core_question: '', predicates: [] }])).toBe(0);
    expect(companionBriefItemCount([item])).toBe(1);
  });

  it('includes a concrete Suggestion (a check action, not a verdict)', () => {
    const md = buildCompanionBrief([item]).markdown;
    expect(md).toContain('지금 확인할 것');
    expect(md).toContain('+5%p'); // the suggestion references the pass condition
  });

  it('surfaces the Delta line when the receipt changed since sealing', () => {
    const md = buildCompanionBrief([{ ...item, delta: '해소 2건 · 새로 발견 1건.' }]).markdown;
    expect(md).toContain('그 사이 바뀐 것');
    expect(md).toContain('해소 2건');
  });

  it('offers the settle/revise choices', () => {
    const md = buildCompanionBrief([item]).markdown;
    expect(md).toContain('날짜만 미루기');
  });

  it('carries the opt-out notice — one settlement email, an exit included (04 S5)', () => {
    const md = buildCompanionBrief([item]).markdown;
    expect(md).toContain('정산용 한 통');
    expect(md).toContain('답장으로 알려주세요');
  });

  it('names the terminal way home when a due judgment was sealed in the terminal (§9.4 귀환 봉합)', () => {
    const mcpItem: DueReceiptBrief = { ...item, origin: 'mcp' };
    const md = buildCompanionBrief([mcpItem]).markdown;
    expect(md).toContain('argus_record_result');
    expect(md).toContain('argus_settings');
    // web-only briefs stay untouched — no terminal jargon for web users
    expect(buildCompanionBrief([{ ...item, origin: 'web' }]).markdown).not.toContain('argus_record_result');
    expect(buildCompanionBrief([item]).markdown).not.toContain('argus_record_result');
  });

  it('renders a proactive change alert with fact + source + date + a neutral question (E)', () => {
    const change: DueReceiptBrief = {
      source_title: '금리 전제 메모', core_question: '지금 조달할까?', predicates: [],
      changes: [{ ordinal: 2, text: '기준금리가 3.5% 근처', fact: '기준금리 4.0%로 인상', source_url: 'https://bok.example/x', source_date: '2026-07-02' }],
    };
    const md = buildCompanionBrief([change]).markdown;
    expect(md).toContain('제가 대신 최신 웹을 확인했어요'); // honest authorship
    expect(md).toContain('기준금리 4.0%로 인상');            // the fact
    expect(md).toContain('출처 2026-07-02');                 // the date
    expect(md).toContain('https://bok.example/x');            // the source
    expect(md).toContain('결정을 다시 볼지는 당신의 몫이에요.'); // user owns the handle
    expect(md).not.toMatch(/틀렸습니다|잘못|당신이 실수/);   // never judges the user
    expect(buildCompanionBrief([change]).subject).toContain('금리 전제 메모');
  });

  it('phrases an open_question alert as new-info-to-decide, not a change (E5 trigger b)', () => {
    const openq: DueReceiptBrief = {
      source_title: '규제 메모', core_question: '진출할까?', predicates: [],
      changes: [{ ordinal: 1, text: '내년 규제 완화 여부', fact: '규제당국이 완화안 발표', source_url: 'https://reg.example/y', source_date: '2026-07-03', kind: 'open_question' }],
    };
    const md = buildCompanionBrief([openq]).markdown;
    expect(md).toContain('새 정보: 규제당국이 완화안 발표'); // new-info framing
    expect(md).toContain('지금 답이 생겼다면 적어두고, 아직이면 그대로 두세요.');
    expect(md).not.toContain('결정을 다시 볼지는 당신의 몫이에요.');
  });

  it('carries T3 open questions as a brief-only section', () => {
    const md = buildCompanionBrief([{
      source_title: '규제 메모',
      core_question: '진출할까?',
      predicates: [],
      open_questions: [{ ordinal: 1, text: '내년 규제 완화 여부' }],
    }]).markdown;
    expect(md).toContain('아직 열려 있는 질문');
    expect(md).toContain('지금 답이 생겼다면 적어두고, 아직이면 그대로 두세요.');
    expect(md).toContain('이 질문 접기');
  });
});
