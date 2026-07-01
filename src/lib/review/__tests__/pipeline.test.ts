import { describe, it, expect } from 'vitest';
import { ingest } from '../ingest';
import { runDocumentReview } from '../pipeline';
import { type ReviewLLM, type ReviewLLMArgs } from '../llm-adapter';
import { type CanonicalArtifact } from '../schema';

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
