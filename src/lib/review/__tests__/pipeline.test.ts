import { describe, it, expect } from 'vitest';
import { ingest } from '../ingest';
import { runDocumentReview } from '../pipeline';
import { type ReviewLLM, type ReviewLLMArgs } from '../llm-adapter';
import { DEFAULT_BUDGET, type CanonicalArtifact } from '../schema';

const DOC = `# 온보딩 리빌드 전략\n\n온보딩을 3주 안에 리빌드한다.\n\n## 근거\n\n- 현재 retention이 낮다\n- 경쟁사가 더 빠르다\n\n## 리스크\n\n- 예산은 이번 분기 안에만 있다`;

/**
 * Deterministic mock: routes on the system prompt's stage marker and cites a
 * real unit_id parsed from the user prompt (so anchors resolve).
 */
function mockLLM(artifact: CanonicalArtifact): ReviewLLM {
  const firstUnitId = artifact.units[0]?.unit_id ?? 'missing';
  return {
    model_name: 'mock',
    model_provider: 'local',
    async json<T>(args: ReviewLLMArgs): Promise<T> {
      const sys = args.system;
      if (sys.includes('"추출"')) {
        return {
          profile: { document_type: 'strategy_memo', intent: 'request_approval', audience: 'executive', stakes: 'high', artifact_maturity: 'working_draft', source_confidence: 0.6 },
          core_question: 'retention 증거 없이 3주를 온보딩 리빌드에 써도 되는가?',
          main_claims: [
            { text: '온보딩 리빌드가 retention을 올린다', status: 'weak', unit_ids: [firstUnitId], rationale: '원문에 지표 근거 없음' },
          ],
          assumptions: [
            { text: '3주 안에 리빌드가 끝난다', unit_ids: [firstUnitId], if_false: '분기 예산을 초과한다' },
          ],
          decision_points: [
            { text: '지금 리빌드에 착수할지', human_only: true, unit_ids: [firstUnitId] },
          ],
          evidence_items: [],
          tradeoffs: [],
          stakeholders: [{ role: 'CFO', likely_objection: '예산 근거가 뭐냐', unit_ids: [firstUnitId] }],
          open_questions: [],
          missing_sections: [{ label: '성공 지표', why_it_matters: '판단 기준이 없다' }],
        } as T;
      }
      if (sys.includes('렌즈다')) {
        // one anchored high finding + one anchorless "high" (must be downgraded)
        return {
          findings: [
            { title: '근거 슬라이드에 retention 수치 없음', detail: '주장만 있고 지표가 없다', severity: 'critical', confidence: 'high', suggested_action: '현재 retention 수치를 문서에 추가', unit_ids: [firstUnitId] },
            { title: '경쟁사 속도 주장 출처 불명', detail: '비교 근거 없음', severity: 'caution', confidence: 'high', suggested_action: '비교 출처 명시', unit_ids: [] },
          ],
        } as T;
      }
      if (sys.includes('"종합"')) {
        return {
          core_question: 'retention 증거 없이 3주를 써도 되는가?',
          current_heading: '핵심 주장의 근거가 비어 있어, 지표를 채운 뒤 방향을 정하세요.',
          judgment_obligations: [
            { statement: '리빌드가 이번 분기 우선순위인지', owner: '사용자', why_human: '전략 우선순위는 근거로 대체할 수 없다', evidence_needed: '현재 retention 코호트', unit_ids: [firstUnitId] },
          ],
          followups: [
            { predicate: '2주 안에 retention 데이터를 확보한다', pass_condition: '코호트 지표 확보', fail_condition: '데이터 없음', check_by: '2020-01-01' },
          ],
        } as T;
      }
      return {} as T;
    },
  };
}

describe('runDocumentReview — end to end with a mock model', () => {
  it('produces a receipt with resolved anchors, ranked findings, and future check-by', async () => {
    const artifact = ingest({ source_kind: 'markdown', title: '온보딩 전략', text: DOC });
    const { job, receipt } = await runDocumentReview(artifact, {
      llm: mockLLM(artifact),
      today: '2026-07-01',
    });

    expect(job.status).toBe('ready');
    expect(receipt).toBeTruthy();
    const r = receipt!;

    // core surfaces
    expect(r.core_question).toContain('retention');
    expect(r.current_heading).not.toMatch(/진행하세요|틀렸/);
    expect(r.judgment_obligations[0].owned_by_user).toBe(false);
    expect(r.judgment_obligations[0].anchors.length).toBeGreaterThan(0);

    // findings ranked (critical first) and anchor invariant enforced
    expect(r.findings[0].severity).toBe('critical');
    const anchorless = r.findings.find((f) => f.anchors.length === 0);
    expect(anchorless?.confidence).not.toBe('high'); // downgraded

    // follow-up: past check_by replaced with a future date
    expect(r.falsifiable_followups[0].check_by > '2026-07-01').toBe(true);
    expect(r.falsifiable_followups[0].predicate_owner).toBe('ai_surfaced');

    // provenance present
    expect(r.provenance.schema_version).toBe('1');
    expect(r.provenance.model_provider).toBe('local');
    expect(Object.keys(r.provenance.lens_versions).length).toBeGreaterThan(0);
  });

  it('resolves the model\'s 1-based "C#" claim links into real claim_id dependencies', async () => {
    const artifact = ingest({ source_kind: 'markdown', title: '온보딩 전략', text: DOC });
    const uid = artifact.units[0].unit_id;
    const base = mockLLM(artifact);
    const llm: ReviewLLM = {
      model_name: base.model_name, model_provider: base.model_provider,
      async json<T>(args: ReviewLLMArgs): Promise<T> {
        if (args.system.includes('"추출"')) {
          return {
            profile: { document_type: 'strategy_memo', intent: 'decide', audience: 'team', stakes: 'high', artifact_maturity: 'working_draft', source_confidence: 0.6 },
            core_question: '리빌드에 착수할지',
            main_claims: [
              { text: 'retention이 낮다', status: 'weak', unit_ids: [uid], rationale: 'r' },
              { text: '온보딩이 원인이다', status: 'weak', unit_ids: [uid], rationale: 'r', depends_on_claim_ids: ['C1'] },
              { text: '3주 리빌드가 옳다', status: 'weak', unit_ids: [uid], rationale: 'r', depends_on_claim_ids: ['C1', 'C2', 'C99'] },
            ],
            evidence_items: [{ text: '지난 분기 코호트', unit_ids: [uid], kind: 'internal', supports_claim_ids: ['C1'] }],
            assumptions: [], decision_points: [], tradeoffs: [], stakeholders: [], open_questions: [], missing_sections: [],
          } as T;
        }
        return base.json<T>(args);
      },
    };
    const { receipt } = await runDocumentReview(artifact, { llm, today: '2026-07-01' });
    const claims = receipt!.claim_ledger;
    expect(claims.length).toBe(3);
    // C2 rests on C1
    expect(claims[1].depends_on_claim_ids).toEqual([claims[0].claim_id]);
    // C3 rests on C1 + C2; the dangling "C99" is dropped, not invented
    expect(claims[2].depends_on_claim_ids).toEqual([claims[0].claim_id, claims[1].claim_id]);
    // C1 has no dependency → field stays absent (never a manufactured link)
    expect(claims[0].depends_on_claim_ids).toBeUndefined();
  });

  it('never fills user-owned settlement fields', async () => {
    const artifact = ingest({ source_kind: 'markdown', text: DOC });
    const { receipt } = await runDocumentReview(artifact, { llm: mockLLM(artifact), today: '2026-07-01' });
    for (const f of receipt!.falsifiable_followups) {
      expect(f.outcome).toBeUndefined();
      expect(f.settled_at).toBeUndefined();
    }
  });

  it('rejects an impossible check_by (2026-13-45) and falls back to a real future date', async () => {
    const artifact = ingest({ source_kind: 'markdown', text: DOC });
    const base = mockLLM(artifact);
    const llm: ReviewLLM = {
      model_name: base.model_name, model_provider: base.model_provider,
      async json<T>(args: ReviewLLMArgs): Promise<T> {
        if (args.system.includes('"종합"')) {
          return { core_question: 'q', current_heading: 'h', judgment_obligations: [],
            followups: [{ predicate: 'p', pass_condition: 'a', fail_condition: 'b', check_by: '2026-13-45' }] } as T;
        }
        return base.json<T>(args);
      },
    };
    const { receipt } = await runDocumentReview(artifact, { llm, today: '2026-07-01' });
    const cb = receipt!.falsifiable_followups[0].check_by;
    expect(/^\d{4}-\d{2}-\d{2}$/.test(cb)).toBe(true);
    expect(new Date(cb + 'T00:00:00Z').toISOString().slice(0, 10)).toBe(cb); // a real date
    expect(cb > '2026-07-01').toBe(true);
  });

  it('moves a failed lens out of selected and into skipped (honest disclosure)', async () => {
    const artifact = ingest({ source_kind: 'markdown', text: DOC });
    const base = mockLLM(artifact);
    let threw = false;
    const llm: ReviewLLM = {
      model_name: base.model_name, model_provider: base.model_provider,
      async json<T>(args: ReviewLLMArgs): Promise<T> {
        if (args.system.includes('렌즈다') && !threw) { threw = true; throw new Error('lens boom'); }
        return base.json<T>(args);
      },
    };
    const { receipt } = await runDocumentReview(artifact, { llm, today: '2026-07-01' });
    const r = receipt!;
    // exactly one lens failed → it must appear in skipped with an error reason,
    // and must not remain in selected / provenance.lens_versions.
    const errored = r.routing.skipped.filter((s) => s.reason.includes('오류'));
    expect(errored.length).toBe(1);
    expect(r.routing.selected).not.toContain(errored[0].id);
    expect(r.provenance.lens_versions[errored[0].id]).toBeUndefined();
  });

  it('collapses the same issue reworded across lenses, but keeps a distinct issue on the same anchor', async () => {
    const artifact = ingest({ source_kind: 'markdown', text: DOC });
    const uid = artifact.units[0].unit_id;
    const base = mockLLM(artifact);
    // Every lens re-surfaces the SAME runway-gap issue under a different Korean
    // wording (the exact failure mode the real Series-A deck produced: one issue
    // reported 5× across core_question/claim_evidence/hidden_assumption/…), plus
    // one genuinely distinct issue that shares the same anchor.
    const runway = [
      { title: '18개월 런웨이와 24개월 BEP 사이 6개월 공백에 대한 재원 계획이 원문에 없다', detail: '40억으로 18개월 런웨이, 24개월 BEP를 병기하지만 그 사이 6개월 자금 출처가 없다', severity: 'critical', confidence: 'high', suggested_action: '6개월 자금 계획', unit_ids: [uid] },
      { title: '18개월 런웨이 종료와 24개월 BEP 사이 6개월 자금 공백 미언급', detail: '런웨이 소진 후 BEP까지 6개월간 어떤 현금으로 운영하는지 자금 조달 방법이 없다', severity: 'critical', confidence: 'medium', suggested_action: '자금 공백 해소', unit_ids: [uid] },
      { title: '런웨이 18개월인데 BEP는 24개월: 6개월 자금 공백 판단은 투자자 몫', detail: '18개월 런웨이와 24개월 BEP 사이 6개월을 트랜치로 구조화할지는 사람의 판단이다', severity: 'critical', confidence: 'medium', suggested_action: '트랜치 조건', unit_ids: [uid] },
    ];
    const distinct = { title: '92% 정확도의 측정 기준과 검증 방식이 원문에 없다', detail: 'precision·recall·F1 중 무엇인지, 평가 데이터셋 구성이 명시되지 않았다', severity: 'caution', confidence: 'medium', suggested_action: '측정 기준 명시', unit_ids: [uid] };
    const llm: ReviewLLM = {
      model_name: base.model_name, model_provider: base.model_provider,
      async json<T>(args: ReviewLLMArgs): Promise<T> {
        if (args.system.includes('렌즈다')) return { findings: [...runway, distinct] } as T;
        return base.json<T>(args);
      },
    };
    const { receipt } = await runDocumentReview(artifact, { llm, today: '2026-07-01' });
    const fs = receipt!.findings;
    const runwayHits = fs.filter((f) => /런웨이/.test(`${f.title} ${f.detail}`));
    const distinctHits = fs.filter((f) => /정확도/.test(f.title));
    // The three runway framings collapse to one row; the distinct issue on the
    // same anchor survives (shared anchor is a safety net, not a merge trigger).
    expect(runwayHits.length).toBe(1);
    expect(distinctHits.length).toBe(1);
    // the surviving runway row keeps the strongest severity and unions anchors.
    expect(runwayHits[0].severity).toBe('critical');
  });

  it('runs a single multimodal vision pass — attaches the PDF and anchors findings by page', async () => {
    // A PDF artifact with page-anchored units.
    const artifact = ingest({
      source_kind: 'pdf',
      title: 'deck.pdf',
      pre_extracted_units: [
        { unit_id: 'u1', kind: 'paragraph', text: '시장 규모 12조 원을 전제로 한다', source_anchor: { page: 2 }, confidence: 0.8 },
        { unit_id: 'u2', kind: 'paragraph', text: '결론: 즉시 착수를 권고한다', source_anchor: { page: 9 }, confidence: 0.8 },
      ],
    });
    let sawAttachment = false;
    const llm: ReviewLLM = {
      model_name: 'mock', model_provider: 'anthropic',
      async json<T>(args: ReviewLLMArgs): Promise<T> {
        if (args.attachments?.some((a) => a.type === 'document')) sawAttachment = true;
        // The vision prompt asks for page-anchored findings.
        if (args.system.includes('You can SEE the document')) {
          return {
            profile: { document_type: 'deck', intent: 'decide', audience: 'exec', stakes: 'high', artifact_maturity: 'draft', source_confidence: 0.6 },
            core_question: '지금 착수할 것인가?',
            findings: [
              { lens_id: 'claim_evidence', title: 'slide 4 매출 차트가 본문 주장과 반대로 꺾인다', detail: '차트는 하락 추세인데 본문은 성장으로 서술', severity: 'critical', confidence: 'high', suggested_action: '차트와 본문 정합', seen_in_visual: true, pages: [4] },
            ],
            judgment_obligations: [{ statement: '시장 규모 전제를 검증할지', owner: 'CEO', why_human: '전제 채택은 사람 판단', pages: [2] }],
            followups: [{ predicate: '차트 데이터 출처를 확인한다', pass_condition: '출처 명시', fail_condition: '없음', check_by: '2026-09-01' }],
            current_heading: 'h', main_claims: [], assumptions: [], decision_points: [{ text: '착수 여부', human_only: true, pages: [9] }],
          } as T;
        }
        return {} as T;
      },
    };
    const { job, receipt } = await runDocumentReview(artifact, {
      today: '2026-07-01',
      vision: { kind: 'pdf', pdf_base64: 'JVBERi0xLjQK', page_count: 9 },
      llm,
    });
    expect(job.status).toBe('ready');
    expect(sawAttachment, 'the PDF document block must reach the model').toBe(true);
    // Findings are anchored by PAGE (the model saw pages, not our unit ids).
    const f = receipt!.findings.find((x) => x.title.includes('차트'));
    expect(f).toBeTruthy();
    expect(f!.anchors.some((a) => a.page === 4)).toBe(true);
    // Provenance records the multimodal pass.
    expect(receipt!.provenance.vision?.mode).toBe('pdf');
    expect(receipt!.provenance.vision?.page_count).toBe(9);
  });

  it('reviews a scanned PDF (zero text units) from rendered page images — Gate 0 is bypassed', async () => {
    // A scanned PDF extracts NO text, so ingest yields an artifact with no units.
    const artifact = ingest({ source_kind: 'pdf', title: 'scan.pdf' });
    expect(artifact.units.length).toBe(0); // nothing for the text path to chew on
    let sawImages = 0;
    const llm: ReviewLLM = {
      model_name: 'mock', model_provider: 'anthropic',
      async json<T>(args: ReviewLLMArgs): Promise<T> {
        sawImages = args.attachments?.filter((a) => a.type === 'image').length ?? 0;
        return {
          profile: { document_type: 'report', intent: 'inform', audience: 'team', stakes: 'medium', artifact_maturity: 'final', source_confidence: 0.5 },
          core_question: '이 보고서의 결론을 수용할 것인가?',
          findings: [{ lens_id: 'claim_evidence', title: '표지의 수치와 3쪽 표가 불일치', detail: '스캔 이미지에서만 보이는 표 값이 요약과 다르다', severity: 'critical', confidence: 'medium', suggested_action: '표 대조', seen_in_visual: true, pages: [3] }],
          judgment_obligations: [], followups: [], current_heading: 'h',
          main_claims: [], assumptions: [], decision_points: [],
        } as T;
      },
    };
    const { job, receipt } = await runDocumentReview(artifact, {
      today: '2026-07-01',
      vision: { kind: 'images', images: [{ media_type: 'image/jpeg', data: 'x'.repeat(40) }, { media_type: 'image/jpeg', data: 'y'.repeat(40) }], page_count: 45 },
      llm,
    });
    expect(job.status).toBe('ready'); // NOT needs_context — vision bypassed Gate 0
    expect(sawImages).toBe(2);        // the rendered page images reached the model
    expect(receipt!.provenance.vision?.mode).toBe('images');
    expect(receipt!.findings.some((f) => f.anchors.some((a) => a.page === 3))).toBe(true);
  });

  it('diversifies the visible top so one dense slide cannot crowd out the rest', async () => {
    const artifact = ingest({ source_kind: 'markdown', text: DOC });
    const uid = artifact.units[0].unit_id;
    const base = mockLLM(artifact);
    // Five DISTINCT critical issues all anchored to the same unit (a dense
    // section), plus two issues on other anchors. Dedup must keep all five (they
    // are not restatements — low mutual overlap), but the receipt's top-3 must
    // NOT be five copies of the same anchor.
    const dense = [
      { title: '예산 40억 산술이 맞지 않는다', detail: '엔지니어 25명 인건비가 런웨이와 충돌', severity: 'critical', confidence: 'high', suggested_action: 'a', unit_ids: [uid] },
      { title: '경쟁사 없음 주장의 범위가 불명확', detail: '글로벌 플레이어 비교 부재', severity: 'critical', confidence: 'high', suggested_action: 'b', unit_ids: [uid] },
      { title: '92% 정확도 측정 기준 없음', detail: 'precision recall 정의 부재', severity: 'critical', confidence: 'high', suggested_action: 'c', unit_ids: [uid] },
      { title: 'NRR 140% 코호트 미정의', detail: '기간과 표본이 없다', severity: 'critical', confidence: 'high', suggested_action: 'd', unit_ids: [uid] },
      { title: '금융권 규제 선결조건 누락', detail: '망분리 미언급', severity: 'critical', confidence: 'high', suggested_action: 'e', unit_ids: [uid] },
    ];
    // two findings on a DIFFERENT anchor (last unit)
    const otherUid = artifact.units[artifact.units.length - 1].unit_id;
    const other = [
      { title: '리스크를 실행 속도로 단일화', detail: '다른 리스크 은폐', severity: 'critical', confidence: 'high', suggested_action: 'f', unit_ids: [otherUid] },
      { title: '시장 규모 출처 없음', detail: '12조 근거 미제시', severity: 'caution', confidence: 'medium', suggested_action: 'g', unit_ids: [otherUid] },
    ];
    const llm: ReviewLLM = {
      model_name: base.model_name, model_provider: base.model_provider,
      async json<T>(args: ReviewLLMArgs): Promise<T> {
        if (args.system.includes('렌즈다')) return { findings: [...dense, ...other] } as T;
        return base.json<T>(args);
      },
    };
    const { receipt } = await runDocumentReview(artifact, { llm, today: '2026-07-01' });
    const top3 = receipt!.findings.slice(0, 3);
    const anchorsInTop3 = new Set(top3.map((f) => JSON.stringify(f.anchors[0])));
    // top-3 must span at least two different anchors, never three of one slide.
    expect(anchorsInTop3.size).toBeGreaterThanOrEqual(2);
    // all seven distinct issues still survive somewhere in the receipt.
    expect(receipt!.findings.length).toBeGreaterThanOrEqual(7);
  });

  it('scrubs internal unit ids the model leaks into user-facing prose', async () => {
    const artifact = ingest({ source_kind: 'markdown', text: DOC });
    const uid = artifact.units[0].unit_id;
    const base = mockLLM(artifact);
    const llm: ReviewLLM = {
      model_name: base.model_name, model_provider: base.model_provider,
      async json<T>(args: ReviewLLMArgs): Promise<T> {
        if (args.system.includes('렌즈다')) {
          return { findings: [{ title: `${uid}의 결론에 근거 없음`, detail: `${uid} 문장이 문제`, severity: 'critical', confidence: 'high', suggested_action: '확인', unit_ids: [uid] }] } as T;
        }
        return base.json<T>(args);
      },
    };
    const { receipt } = await runDocumentReview(artifact, { llm, today: '2026-07-01' });
    const f = receipt!.findings[0];
    expect(f.title).not.toContain('u_');
    expect(f.detail).not.toContain('u_');
    expect(f.anchors.length).toBeGreaterThan(0); // anchor still resolved from the array
  });

  it('returns needs_context for an unsupported artifact without calling the model', async () => {
    const artifact = ingest({ source_kind: 'pdf', title: 'scan.pdf' });
    let called = false;
    const llm: ReviewLLM = {
      model_name: 'mock', model_provider: 'local',
      async json<T>(): Promise<T> { called = true; return {} as T; },
    };
    const { job, receipt } = await runDocumentReview(artifact, { llm, today: '2026-07-01' });
    expect(job.status).toBe('needs_context');
    expect(job.error?.kind).toBe('unsupported_format');
    expect(receipt).toBeUndefined();
    expect(called).toBe(false);
  });

  it('emits progress statuses in pipeline order', async () => {
    const artifact = ingest({ source_kind: 'markdown', text: DOC });
    const seen: string[] = [];
    await runDocumentReview(artifact, {
      llm: mockLLM(artifact), today: '2026-07-01',
      onProgress: (j) => seen.push(j.status),
    });
    expect(seen).toContain('profiling');
    expect(seen).toContain('reviewing');
    expect(seen).toContain('synthesizing');
    expect(seen[seen.length - 1]).toBe('ready');
  });

  it('runs the complete quick-review spine in one model call', async () => {
    const artifact = ingest({ source_kind: 'markdown', text: DOC });
    const uid = artifact.units[0].unit_id;
    let calls = 0;
    const seen: string[] = [];
    const llm: ReviewLLM = {
      model_name: 'mock', model_provider: 'local',
      async json<T>(args: ReviewLLMArgs): Promise<T> {
        calls++;
        expect(args.system).toContain('bounded quick-review path');
        expect(args.model).toBe('default');
        return {
          profile: { document_type: 'strategy_memo', intent: 'decide', audience: 'team', stakes: 'high', artifact_maturity: 'working_draft', source_confidence: 0.7 },
          core_question: '가격을 지금 올릴 것인가?',
          main_claims: [{ text: '가격 인상으로 매출이 오른다', status: 'weak', unit_ids: [uid], rationale: '가격 수용 근거가 없다' }],
          evidence_items: [],
          assumptions: [{ text: '고객이 인상 가격을 수용한다', if_false: '매출이 줄 수 있다', unit_ids: [uid] }],
          decision_points: [{ text: '전면 인상 여부', human_only: true, unit_ids: [uid] }],
          findings: [{ lens_id: 'claim_evidence', title: '가격 수용 근거가 없다', detail: '문의 증가는 인상 가격 수용 증거가 아니다', severity: 'critical', confidence: 'high', suggested_action: '고객 반응을 확인한다', unit_ids: [uid] }],
          current_heading: '가격 인상을 제안하지만 고객 수용 근거는 비어 있습니다.',
          judgment_obligations: [{ statement: '전면 인상 여부를 결정한다', owner: 'CEO', why_human: '고객 이탈 위험을 감수할 책임이 필요하다', unit_ids: [uid] }],
          followups: [{ predicate: '인상 가격을 제시한 고객 반응을 기록한다', pass_condition: '과반이 수용한다', fail_condition: '과반이 거절한다', check_by: '2026-07-15' }],
          tradeoffs: [], stakeholders: [], open_questions: [], missing_sections: [],
        } as T;
      },
    };

    const { job, receipt } = await runDocumentReview(artifact, {
      llm, budget: DEFAULT_BUDGET.quick, today: '2026-07-01',
      onProgress: (j) => seen.push(j.status),
    });

    expect(calls).toBe(1);
    expect(job.status).toBe('ready');
    expect(receipt?.routing.selected).toHaveLength(5);
    expect(receipt?.findings[0].lens_id).toBe('claim_evidence');
    expect(receipt?.findings.length).toBeGreaterThanOrEqual(2);
    expect(receipt?.findings.every((finding) => finding.anchors.length > 0)).toBe(true);
    expect(receipt?.judgment_obligations).toHaveLength(1);
    expect(receipt?.falsifiable_followups).toHaveLength(1);
    expect(seen).toEqual(expect.arrayContaining(['profiling', 'reviewing', 'mapping', 'routing', 'synthesizing', 'ready']));
  });

  it('supplement surfaces only the model\'s hard verdicts — never a "근거 부족" stand-in for a weak claim', async () => {
    const artifact = ingest({ source_kind: 'markdown', text: DOC });
    const uid = artifact.units[0].unit_id;
    const llm: ReviewLLM = {
      model_name: 'mock', model_provider: 'local',
      async json<T>(): Promise<T> {
        // The model returned ZERO explicit findings (the truncation scenario),
        // but a map with one `weak`, one `contradicted`, and one `unsupported` claim.
        return {
          profile: { document_type: 'memo', intent: 'decide', audience: 'team', stakes: 'high', artifact_maturity: 'draft', source_confidence: 0.6 },
          core_question: '지금 올릴 것인가?',
          main_claims: [
            { text: '가격 인상으로 매출이 오른다', status: 'weak', unit_ids: [uid], rationale: '지표 없음' },
            { text: 'A안이 B안보다 낫다', status: 'contradicted', unit_ids: [uid], rationale: '3장과 5장이 어긋난다' },
            { text: '경쟁사보다 빠르다', status: 'unsupported', unit_ids: [uid], rationale: '비교 근거 없음' },
          ],
          assumptions: [],
          decision_points: [{ text: '착수 여부', human_only: true, unit_ids: [uid] }],
          findings: [], current_heading: '', judgment_obligations: [], followups: [],
          evidence_items: [], tradeoffs: [], stakeholders: [], open_questions: [], missing_sections: [],
        } as T;
      },
    };
    const { receipt } = await runDocumentReview(artifact, { llm, budget: DEFAULT_BUDGET.quick, today: '2026-07-01' });
    const fs = receipt!.findings;
    // The old code manufactured "…근거가 충분하지 않음" from the WEAK claim. That
    // fabrication is gone (CLAUDE.md — honest gap over fabrication).
    expect(fs.some((f) => f.title.includes('근거가 충분하지 않음'))).toBe(false);
    expect(fs.some((f) => f.title.includes('가격 인상으로 매출이 오른다'))).toBe(false);
    // The model's own hard verdicts (contradicted / unsupported) DO surface.
    expect(fs.some((f) => f.title.includes('충돌'))).toBe(true);
  });

  it('attaches full coverage to a small document that fits entirely', async () => {
    const artifact = ingest({ source_kind: 'markdown', text: DOC });
    const { receipt } = await runDocumentReview(artifact, { llm: mockLLM(artifact), today: '2026-07-01' });
    expect(receipt!.coverage).toBeTruthy();
    expect(receipt!.coverage!.band).toBe('full');
    expect(receipt!.coverage!.units_reviewed).toBe(receipt!.coverage!.units_total);
    expect(receipt!.coverage!.notes).toEqual([]);
  });

  it('drops an obligation that merely restates a finding (same anchor + wording)', async () => {
    const artifact = ingest({ source_kind: 'markdown', text: DOC });
    const uid = artifact.units[0].unit_id;
    const base = mockLLM(artifact);
    const llm: ReviewLLM = {
      model_name: base.model_name, model_provider: base.model_provider,
      async json<T>(args: ReviewLLMArgs): Promise<T> {
        if (args.system.includes('렌즈다')) {
          return { findings: [{ title: '예산 근거 없음', detail: '수치 근거 없음', severity: 'critical', confidence: 'medium', suggested_action: '수치 확인', unit_ids: [uid] }] } as T;
        }
        if (args.system.includes('"종합"')) {
          // restates the finding as an obligation on the SAME anchor + words → dropped
          return { core_question: 'q', current_heading: 'h',
            judgment_obligations: [
              { statement: '예산 근거 없음 여부를 판단', owner: '사용자', why_human: 'w', unit_ids: [uid] },
              { statement: '전혀 다른 조직 구조를 바꿀지 결정', owner: '사용자', why_human: 'w', unit_ids: [] },
            ], followups: [] } as T;
        }
        return base.json<T>(args);
      },
    };
    const { receipt } = await runDocumentReview(artifact, { llm, today: '2026-07-01' });
    const statements = receipt!.judgment_obligations.map((o) => o.statement);
    expect(statements).not.toContain('예산 근거 없음 여부를 판단');       // restatement dropped
    expect(statements).toContain('전혀 다른 조직 구조를 바꿀지 결정');    // distinct obligation kept
  });

  it('de-dups an issue surfaced by multiple lenses in the single-pass path', async () => {
    const artifact = ingest({ source_kind: 'markdown', text: DOC });
    const uid = artifact.units[0].unit_id;
    const base = mockLLM(artifact);
    // Every lens returns the SAME anchored finding — they must collapse to one.
    const llm: ReviewLLM = {
      model_name: base.model_name, model_provider: base.model_provider,
      async json<T>(args: ReviewLLMArgs): Promise<T> {
        if (args.system.includes('렌즈다')) {
          return { findings: [{ title: '핵심 주장에 근거가 없음', detail: 'd', severity: 'critical', confidence: 'medium', suggested_action: 'a', unit_ids: [uid] }] } as T;
        }
        return base.json<T>(args);
      },
    };
    const { receipt } = await runDocumentReview(artifact, { llm, today: '2026-07-01' });
    expect(receipt!.findings.filter((f) => f.title.includes('핵심 주장에 근거가 없음')).length).toBe(1);
  });

  it('reviews a long document end-to-end via chunking (full coverage, not just the front)', async () => {
    // 400 paragraphs → far past one prompt. The map-reduce path must cover the
    // WHOLE document (the old front-slice reviewed only the first ~160/13%).
    const bigText = Array.from({ length: 400 }, (_, i) => `문단 ${i}: 이건 검수 대상 문장입니다.`).join('\n\n');
    const artifact = ingest({ source_kind: 'markdown', text: bigText });
    const { job, receipt } = await runDocumentReview(artifact, { llm: mockLLM(artifact), today: '2026-07-01' });
    expect(job.status).toBe('ready');
    const cov = receipt!.coverage!;
    expect(cov.units_total).toBe(400);
    expect(cov.units_reviewed).toBe(400); // every unit reviewed, not just 160
    expect(cov.band).toBe('full');
  });

  it('still discloses partial coverage when a document exceeds total chunk capacity', async () => {
    // 1400 units > maxChunks(10) × UNITS_PER_CHUNK(100) = 1000 reviewable.
    const hugeText = Array.from({ length: 1400 }, (_, i) => `문단 ${i}: 검수 대상 문장.`).join('\n\n');
    const artifact = ingest({ source_kind: 'markdown', text: hugeText });
    const { receipt } = await runDocumentReview(artifact, { llm: mockLLM(artifact), today: '2026-07-01' });
    const cov = receipt!.coverage!;
    expect(cov.units_total).toBeGreaterThan(1000);
    expect(cov.units_reviewed).toBe(1000);
    expect(cov.band).not.toBe('full');
    expect(cov.notes.some((n) => n.includes('개만 검수'))).toBe(true);
  });

  it('map-reduce de-dups an issue repeated across chunks into one finding', async () => {
    const bigText = Array.from({ length: 250 }, (_, i) => `문단 ${i}: 근거 없이 매출이 오른다고 단정한다.`).join('\n\n');
    const artifact = ingest({ source_kind: 'markdown', text: bigText });
    let mapCalls = 0;
    const llm: ReviewLLM = {
      model_name: 'mock', model_provider: 'local',
      async json<T>(args: ReviewLLMArgs): Promise<T> {
        // synthesis (reduce) stage
        if (args.system.includes('"종합"')) {
          return { core_question: '가격을 올릴 것인가', current_heading: '근거가 비어 있습니다', judgment_obligations: [], followups: [] } as T;
        }
        // map stage: every chunk reports the SAME issue with its own unit_id.
        mapCalls++;
        const uid = (args.user.match(/\[([a-z0-9_]+)\]/i) ?? [])[1] ?? 'x';
        return {
          profile: { document_type: 'strategy_memo', intent: 'decide', audience: 'team', stakes: 'high', artifact_maturity: 'working_draft', source_confidence: 0.6 },
          core_question: '가격을 올릴 것인가',
          main_claims: [{ text: '매출이 오른다', status: 'weak', unit_ids: [uid], rationale: '근거 없음' }],
          evidence_items: [], assumptions: [], decision_points: [], tradeoffs: [], stakeholders: [], open_questions: [], missing_sections: [],
          findings: [{ lens_id: 'claim_evidence', title: '근거 없이 매출 상승을 단정함', detail: '지표가 없다', severity: 'critical', confidence: 'medium', suggested_action: '수치 확인', unit_ids: [uid] }],
          current_heading: 'h',
        } as T;
      },
    };
    const { job, receipt } = await runDocumentReview(artifact, { llm, today: '2026-07-01' });
    expect(job.status).toBe('ready');
    expect(mapCalls).toBeGreaterThan(1); // genuinely chunked
    // Same title across chunks collapses to a single finding + a single claim.
    expect(receipt!.findings.length).toBe(1);
    expect(receipt!.findings[0].anchors.length).toBeGreaterThan(0);
    expect(receipt!.claim_ledger.length).toBe(1);
  });

  it('forwards the abort signal to the model and turns a cancel into a failed job (never throws)', async () => {
    const artifact = ingest({ source_kind: 'markdown', text: DOC });
    const controller = new AbortController();
    let sawSignal = false;
    // Mirror the real adapter: honor the caller's abort by throwing, exactly as
    // the /api/llm client does. The pipeline must catch it and resolve to a
    // 'failed' job so ReviewFlow's cancel returns cleanly instead of rejecting.
    const llm: ReviewLLM = {
      model_name: 'mock', model_provider: 'local',
      async json<T>(args: ReviewLLMArgs): Promise<T> {
        if (args.signal) sawSignal = true;
        if (args.signal?.aborted) throw new Error('요청이 취소되었습니다.');
        return {} as T;
      },
    };
    controller.abort();
    const result = await runDocumentReview(artifact, {
      llm, today: '2026-07-01', signal: controller.signal,
    });
    expect(sawSignal).toBe(true);        // signal reached the model call
    expect(result.job.status).toBe('failed'); // abort surfaced as failure, not a throw
    expect(result.receipt).toBeUndefined();
  });
});
