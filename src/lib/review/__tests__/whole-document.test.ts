import { describe, it, expect } from 'vitest';
import { ingest } from '../ingest';
import { runDocumentReview } from '../pipeline';
import { pdfHeadingTitle } from '../extract-file';
import { type ReviewLLM, type ReviewLLMArgs } from '../llm-adapter';

/**
 * End-to-end proof that the map-reduce path reviews the WHOLE document, not just
 * the front slice that fits one prompt (the regression this fixes). The mock only
 * reports an issue for a unit it was actually handed, so a finding citing a
 * BACK-half unit can only exist if chunking sent that unit to a map call.
 */

// A realistic long report: 12 sections, single-line paragraphs (~1k chars each).
function buildLongReport(): string {
  const filler = (s: string) =>
    `${s} ` + '이 문단은 본문 분량을 채우기 위한 서술로, 배경과 맥락을 길게 설명하며 여러 부수적 논거를 나열한다. '.repeat(22);
  const out: string[] = [];
  for (let s = 1; s <= 12; s++) {
    out.push(`## ${s}. ${s}장 제목 섹션`);
    for (let p = 0; p < 5; p++) {
      let line = filler(`${s}.${p} 소주제.`);
      if (s === 2 && p === 1) line = '근거 없이 매출 30% 성장을 단정한다. ' + filler('초반부 주장');     // chunk 1 (front)
      if (s === 10 && p === 0) line = '근거 없이 매출 30% 성장을 단정한다. ' + filler('중반 중복 주장');   // duplicate
      if (s === 11 && p === 2) line = '예산 5억의 근거를 제시하지 않고 단정한다. ' + filler('후반부 주장'); // back half
      out.push(line);
    }
  }
  return out.join('\n\n');
}

/** Reads the units it is handed and flags any whose text contains "단정". */
function readingMock(): ReviewLLM {
  return {
    model_name: 'mock', model_provider: 'local',
    async json<T>(args: ReviewLLMArgs): Promise<T> {
      if (args.system.includes('"종합"')) {
        return { core_question: '이 계획에 착수할 것인가', current_heading: '근거가 빈 주장이 있습니다', judgment_obligations: [], followups: [] } as T;
      }
      const findings: unknown[] = [];
      for (const line of args.user.split('\n')) {
        const m = /^\[([a-z0-9_]+)\] \([^)]*\)\s+(.*)$/i.exec(line);
        if (m && m[2].includes('단정')) {
          findings.push({
            lens_id: 'claim_evidence', title: m[2].slice(0, 22), detail: '근거가 문서 안에 없다',
            severity: 'critical', confidence: 'medium', suggested_action: '근거 수치를 제시', unit_ids: [m[1]],
          });
        }
      }
      return {
        profile: { document_type: 'strategy_memo', intent: 'decide', audience: 'team', stakes: 'high', artifact_maturity: 'working_draft', source_confidence: 0.6 },
        core_question: '이 계획에 착수할 것인가',
        main_claims: [], evidence_items: [], assumptions: [], decision_points: [],
        tradeoffs: [], stakeholders: [], open_questions: [], missing_sections: [],
        findings, current_heading: 'h',
      } as T;
    },
  };
}

describe('runDocumentReview — whole-document (map-reduce) coverage', () => {
  it('reviews the back half of a long report and de-dups a cross-chunk issue', async () => {
    const artifact = ingest({ source_kind: 'markdown', text: buildLongReport() });
    let mapCalls = 0;
    const base = readingMock();
    const llm: ReviewLLM = {
      model_name: base.model_name, model_provider: base.model_provider,
      async json<T>(args: ReviewLLMArgs): Promise<T> {
        if (!args.system.includes('"종합"')) mapCalls++;
        return base.json<T>(args);
      },
    };

    const { job, receipt } = await runDocumentReview(artifact, { llm, today: '2026-07-01' });
    const r = receipt!;

    expect(job.status).toBe('ready');
    expect(mapCalls).toBeGreaterThan(1);                              // genuinely chunked
    expect(r.coverage!.units_reviewed).toBe(r.coverage!.units_total); // whole doc
    expect(r.coverage!.band).toBe('full');

    // The late "예산 5억" issue can only surface if the tail was reviewed.
    const backHalf = r.findings.find((f) => f.title.includes('예산 5억'));
    expect(backHalf, 'back-half issue must be found → chunking read the tail').toBeTruthy();
    expect(backHalf!.anchors.length).toBeGreaterThan(0);

    // The identical issue planted in two sections collapses to one finding that
    // carries BOTH source anchors.
    const dup = r.findings.filter((f) => f.title.includes('매출 30% 성장'));
    expect(dup.length).toBe(1);
    expect(dup[0].anchors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('pdfHeadingTitle — numbered/keyword headings, not prose', () => {
  it('detects numbered and keyword section headers (incl. spaced Korean)', () => {
    for (const h of ['1. 개요', '2.1 현황 분석', '제 3 장 결론', '제3장 서론', 'Executive Summary', 'Chapter 4', 'Ⅱ. 시장 규모', '3) 실행 계획', '부록 A', '요약', '개요:']) {
      expect(pdfHeadingTitle(h), h).toBe(h);
    }
  });

  it('does not mislabel running prose as a heading', () => {
    for (const body of [
      '우리는 이번 분기에 매출이 크게 늘었다고 본다.',
      '이 문단은 배경과 맥락을 길게 설명하며 여러 부수적 논거를 나열하는 본문 서술이다. 따라서 길다.',
      '매출은 전년 대비 30% 증가하였으며 이는 신규 고객 유입에 기인한다',
      '개요를 정리하면 다음과 같다',
      '요약하자면 우리는 성장했다',
      '',
    ]) {
      expect(pdfHeadingTitle(body), body).toBeNull();
    }
  });
});
