import fs from 'fs';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';
import {
  ingest,
  scoreReviewability,
  routeLenses,
  buildExtractionPrompt,
  renderUnits,
  reviewabilityBand,
  LENSES,
  LENS_VERSION,
  REVIEW_SCHEMA_VERSION,
  type SourceKind,
  type ReviewConcern,
  type DocumentProfile,
  type UserReviewContext,
} from '../lib/review/index.js';

/**
 * argus_review — document Judgment Review parity with the webapp (design doc
 * §"웹앱과 MCP는 같은 Judgment Receipt"). Same ingest / anchoring / reviewability
 * / lens routing / SSOT prompt as src/lib/review — the ONLY difference is that
 * here the host agent is the model, so the tool hands it the scaffold instead of
 * calling an LLM. The falsifiable follow-up it produces is sealed through the
 * existing argus_seal → argus_settle loop (one receipt machine, no second store).
 *
 * Read-only: it computes + returns; it does not write to .argus. The write
 * happens at seal, where the user owns the prediction.
 */

const MAX_DOC_BYTES = 400_000;
const UNIT_LIMIT = 160;

const CONCERNS: ReviewConcern[] = [
  'strategic_fit',
  'evidence',
  'stakeholder_objection',
  'execution_risk',
  'ai_answer_trust',
  'full_judgment_review',
];

const EXT_KIND: Record<string, SourceKind> = {
  md: 'markdown', markdown: 'markdown', txt: 'txt', text: 'txt',
  pdf: 'pdf', docx: 'docx', pptx: 'pptx',
};

const inputSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    text: { type: 'string', maxLength: MAX_DOC_BYTES, description: 'The document body to review (paste). Provide this OR file_path.' },
    file_path: { type: 'string', maxLength: 1024, description: 'Absolute path to a TEXT document (.md/.txt). Binary decks/PDFs degrade honestly — paste their text instead.' },
    source_kind: { type: 'string', enum: ['paste', 'markdown', 'txt', 'pdf', 'docx', 'pptx', 'transcript', 'llm_answer', 'pr_diff'], description: 'Override the inferred source kind.' },
    title: { type: 'string', maxLength: 300 },
    concerns: { type: 'array', items: { type: 'string', enum: CONCERNS }, maxItems: 3, description: 'What to weight — drives lens routing.' },
    audience_hint: { type: 'string', maxLength: 200 },
    biggest_worry: { type: 'string', maxLength: 300 },
    stakes: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Optional stakes hint for lens routing (default medium).' },
  },
} as const;

export const review: ToolModule = {
  name: 'argus_review',
  description:
    'Review an existing document (strategy memo / PRD / deck text / AI answer) for judgment risk. Returns a reviewability score, the routed review lenses, the source units with anchors, and the extraction prompt — then hands YOU (the model) the analysis to run. Anchor every finding to a unit; never deliver a verdict. End by sealing ONE falsifiable follow-up via argus_seal.',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (a) => {
    try {
      const filePath = typeof a['file_path'] === 'string' ? (a['file_path'] as string) : '';
      let text = typeof a['text'] === 'string' ? (a['text'] as string) : '';
      let inferredKind: SourceKind | undefined = a['source_kind'] as SourceKind | undefined;
      let title = typeof a['title'] === 'string' ? (a['title'] as string) : '';

      if (!text && filePath) {
        const ext = (filePath.split('.').pop() || '').toLowerCase();
        inferredKind = inferredKind ?? EXT_KIND[ext] ?? 'txt';
        if (['pdf', 'docx', 'pptx'].includes(inferredKind)) {
          return toolError({
            ok: false, tool: 'argus_review', error_code: 'BINARY_UNSUPPORTED',
            message: `${inferredKind.toUpperCase()} files aren't text-extracted in the MCP.`,
            recovery: 'Paste the document text into `text`, or convert to markdown/txt first.',
          });
        }
        try {
          const stat = fs.statSync(filePath);
          if (stat.size > MAX_DOC_BYTES) {
            return toolError({
              ok: false, tool: 'argus_review', error_code: 'TOO_LARGE',
              message: `Document exceeds ${MAX_DOC_BYTES} bytes.`,
              recovery: 'Review the most decision-bearing section, or split the document.',
            });
          }
          text = fs.readFileSync(filePath, 'utf8');
          if (!title) title = filePath.split(/[\\/]/).pop() || '';
        } catch {
          return toolError({
            ok: false, tool: 'argus_review', error_code: 'READ_FAILED',
            message: `Could not read file: ${filePath}`,
            recovery: 'Check the path (absolute), or paste the text into `text`.',
          });
        }
      }

      if (!text.trim() || text.trim().length < 20) {
        return toolError({
          ok: false, tool: 'argus_review', error_code: 'EMPTY',
          message: 'No reviewable text was provided.',
          recovery: 'Pass `text` (≥ 20 chars) or a readable `file_path`.',
        });
      }

      const concerns: ReviewConcern[] = Array.isArray(a['concerns'])
        ? (a['concerns'] as ReviewConcern[])
        : ['full_judgment_review'];
      const artifact = ingest({ source_kind: inferredKind ?? 'paste', title, text, privacy_mode: 'receipt_only' });

      // Honest degrade — never a confident review over unextractable input.
      if (artifact.extraction_quality === 'unsupported' || artifact.units.length === 0) {
        return envelope({
          ok: true, tool: 'argus_review',
          surface: '이 문서는 지금 상태로는 전체 검수가 어렵습니다. 무엇이 빠졌는지부터 확인하세요.',
          next_actions: ['skip'],
          data: {
            needs_context: true,
            extraction_quality: artifact.extraction_quality,
            notes: artifact.extraction_notes,
          },
        });
      }

      const reviewability = scoreReviewability(artifact);
      const band = reviewabilityBand(reviewability.score);

      // Routing needs a profile; without an LLM pass we use a neutral default
      // (disclosed) — the agent's own extraction refines it. Concerns still steer.
      const profile: DocumentProfile = {
        artifact_maturity: 'working_draft',
        document_type: 'unknown',
        intent: 'decide',
        audience: 'unknown',
        stakes: (a['stakes'] as DocumentProfile['stakes']) ?? 'medium',
        source_confidence: 0.3,
        inferred: { document_type: true, intent: true, audience: true, stakes: true },
      };
      const routing = routeLenses(profile, artifact, { concerns, maxLensCalls: 7 });

      const ctx: UserReviewContext = {
        audience_hint: typeof a['audience_hint'] === 'string' ? (a['audience_hint'] as string) : undefined,
        biggest_worry: typeof a['biggest_worry'] === 'string' ? (a['biggest_worry'] as string) : undefined,
        concerns,
      };
      const extraction = buildExtractionPrompt(artifact.units, ctx, UNIT_LIMIT);

      const lenses = routing.selected.map((id) => ({
        id,
        label: LENSES[id].label,
        purpose: LENSES[id].purpose,
        review_questions: LENSES[id].review_questions,
        avoid: LENSES[id].failure_modes,
      }));

      return envelope({
        ok: true, tool: 'argus_review',
        surface: `검수 준비 완료 — "${artifact.source_title}" · 검수 가능성 ${reviewability.score}/100 (${band}) · 렌즈 ${lenses.length}개. 아래 단위를 근거로, 렌즈별로 검토한 뒤 사람이 판단할 것과 반증 가능한 예측 하나를 뽑아 argus_seal로 봉인하세요.`,
        next_actions: ['argus_seal', 'skip'],
        data: {
          schema_version: REVIEW_SCHEMA_VERSION,
          lens_version: LENS_VERSION,
          artifact_id: artifact.artifact_id,
          source_title: artifact.source_title,
          reviewability: { score: reviewability.score, band, reasons: reviewability.reasons },
          structure: artifact.detected_structure,
          routing: { selected: routing.selected, disclosure: routing.disclosure, note: '라우팅은 기본 프로파일 기준의 제안입니다 — 추출 단계에서 문서 프로파일을 확정하면 렌즈를 조정하세요.' },
          lenses,
          // The SSOT extraction prompt — run this on the units first to build the
          // judgment map, then apply each lens, then synthesize.
          extraction_prompt: extraction,
          units: renderUnits(artifact.units, UNIT_LIMIT),
          protocol: [
            '1) extraction_prompt를 units에 적용해 문서 판단 지도(profile + claims/assumptions/decision_points)를 만든다.',
            '2) lenses의 각 렌즈로 검토한다 — 모든 finding은 unit을 근거로 하고, 산문에는 unit_id를 노출하지 않는다.',
            '3) 사람이 직접 판단해야 할 항목(judgment obligations)을 분리한다. 평결하지 않는다.',
            '4) 현실이 pass/fail로 답할 반증 가능한 예측 1개를 뽑아 argus_seal로 봉인한다 — 예측·pass/fail 조건·check_by는 사용자의 것이다.',
          ],
        },
      });
    } catch (e) {
      return handleToolException('argus_review', e);
    }
  },
};
