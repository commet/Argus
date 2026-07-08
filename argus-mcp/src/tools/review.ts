import fs from 'fs';
import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { resolveResponseLocale } from '../lib/surfaces.js';
import { ENVELOPE_OUTPUT_SCHEMA, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';
import {
  ingest,
  scoreReviewability,
  routeLenses,
  buildExtractionPrompt,
  reviewabilityBand,
  LENSES,
  LENS_VERSION,
  REVIEW_SCHEMA_VERSION,
  type SourceKind,
  type ReviewConcern,
  type DocumentProfile,
  type UserReviewContext,
  type CanonicalArtifact,
  type SourceCaps,
} from '../lib/review/index.js';
import { extractFileFromPath, type ExtractedText } from '../lib/review/extract-file-node.js';

const BINARY_KINDS: SourceKind[] = ['pdf', 'docx', 'pptx'];

function capsFrom(bx: ExtractedText): SourceCaps | undefined {
  const caps: SourceCaps = {};
  if (typeof bx.pages_total === 'number') caps.pages_total = bx.pages_total;
  if (typeof bx.pages_read === 'number') caps.pages_read = bx.pages_read;
  if (typeof bx.slides_total === 'number') caps.slides_total = bx.slides_total;
  if (typeof bx.slides_read === 'number') caps.slides_read = bx.slides_read;
  if (typeof bx.units_capped === 'boolean') caps.units_capped = bx.units_capped;
  return Object.keys(caps).length ? caps : undefined;
}

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
// Cap the units block so a large doc can't return a giant tool response
// (mcp-builder §CHARACTER_LIMIT). Whichever bound hits first — count or chars.
const CHAR_BUDGET = 20_000;

const CONCERNS = ['strategic_fit', 'evidence', 'stakeholder_objection', 'execution_risk', 'ai_answer_trust', 'full_judgment_review'] as const;

const EXT_KIND: Record<string, SourceKind> = {
  md: 'markdown', markdown: 'markdown', txt: 'txt', text: 'txt',
  pdf: 'pdf', docx: 'docx', pptx: 'pptx',
};

const inputSchema = z.strictObject({
  text: z.string().max(MAX_DOC_BYTES).describe('The document body to review (paste). Provide this OR file_path.').optional(),
  file_path: z.string().max(1024).describe('Absolute path to a document (.md/.txt/.pdf/.docx/.pptx). PDF/DOCX/PPTX are text-extracted with page/slide anchors; scanned or image-only files degrade honestly.').optional(),
  source_kind: z.enum(['paste', 'markdown', 'txt', 'pdf', 'docx', 'pptx', 'transcript', 'llm_answer', 'pr_diff']).describe('Override the inferred source kind.').optional(),
  title: z.string().max(300).optional(),
  concerns: z.array(z.enum(CONCERNS)).max(3).describe('What to weight — drives lens routing.').optional(),
  audience_hint: z.string().max(200).optional(),
  biggest_worry: z.string().max(300).optional(),
  stakes: z.enum(['low', 'medium', 'high']).describe('Optional stakes hint for lens routing (default medium).').optional(),
});

export const review: ToolModule = {
  name: 'argus_review',
  description:
    'Review an EXISTING document (strategy memo / PRD / deck text / AI answer) for judgment risk. ' +
    'Returns: a reviewability score+band, the routed review lenses, and the extraction prompt (which embeds the anchored source units + output schema) — then hands YOU (the model) the analysis to run. ' +
    'Anchor every finding to the source; never deliver a verdict on the document. End by sealing ONE falsifiable follow-up via argus_seal. ' +
    'Use for a document the user already wrote; to open a FRESH decision use argus_open_decision instead. Accepts pasted text or a file path — PDF/DOCX/PPTX are parsed with page/slide anchors; scanned/image-only files degrade honestly.',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: 'Review a document', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (a) => {
    try {
      const filePath = typeof a['file_path'] === 'string' ? (a['file_path'] as string) : '';
      let text = typeof a['text'] === 'string' ? (a['text'] as string) : '';
      let inferredKind: SourceKind | undefined = a['source_kind'] as SourceKind | undefined;
      let title = typeof a['title'] === 'string' ? (a['title'] as string) : '';
      let binaryExtract: ExtractedText | null = null;

      if (!text && filePath) {
        const ext = (filePath.split('.').pop() || '').toLowerCase();
        inferredKind = inferredKind ?? EXT_KIND[ext] ?? 'txt';
        try {
          const stat = fs.statSync(filePath);
          if (stat.size > MAX_DOC_BYTES) {
            return toolError({
              ok: false, tool: 'argus_review', error_code: 'TOO_LARGE',
              message: `Document exceeds ${MAX_DOC_BYTES} bytes.`,
              recovery: 'Review the most decision-bearing section, or split the document.',
            });
          }
        } catch {
          return toolError({
            ok: false, tool: 'argus_review', error_code: 'READ_FAILED',
            message: `Could not read file: ${filePath}`,
            recovery: 'Check the path (absolute), or paste the text into `text`.',
          });
        }
        if (!title) title = filePath.split(/[\\/]/).pop() || '';

        if (BINARY_KINDS.includes(inferredKind)) {
          // Real Node parsing (mammoth / pdf.js / jszip), same anchored units as
          // the webapp. Scanned/empty binaries degrade honestly below, never crash.
          try {
            binaryExtract = await extractFileFromPath(filePath, inferredKind);
          } catch {
            return toolError({
              ok: false, tool: 'argus_review', error_code: 'EXTRACT_FAILED',
              message: `Could not parse ${inferredKind.toUpperCase()}: ${filePath}`,
              recovery: 'Paste the document text into `text`, or convert to markdown/txt first.',
            });
          }
        } else {
          try {
            text = fs.readFileSync(filePath, 'utf8');
          } catch {
            return toolError({
              ok: false, tool: 'argus_review', error_code: 'READ_FAILED',
              message: `Could not read file: ${filePath}`,
              recovery: 'Check the path (absolute), or paste the text into `text`.',
            });
          }
        }
      }

      const concerns: ReviewConcern[] = Array.isArray(a['concerns'])
        ? (a['concerns'] as ReviewConcern[])
        : ['full_judgment_review'];

      // Honest degrade for a binary that yielded too little (scanned PDF, image
      // deck) — surface the parser's own note, never a confident fake review.
      if (binaryExtract) {
        const bx = binaryExtract;
        const empty = !bx.units?.length && !bx.text.trim();
        if (bx.quality === 'unsupported' || bx.quality === 'low' || empty) {
          return envelope({
            ok: true, tool: 'argus_review',
            surface: bx.note || '이 문서는 지금 상태로는 전체 검수가 어렵습니다. 핵심 본문을 붙여넣으면 더 정확합니다.',
            next_actions: ['skip'],
            data: { needs_context: true, extraction_quality: bx.quality, notes: bx.note ? [bx.note] : [] },
          });
        }
      } else if (!text.trim() || text.trim().length < 20) {
        return toolError({
          ok: false, tool: 'argus_review', error_code: 'EMPTY',
          message: 'No reviewable text was provided.',
          recovery: 'Pass `text` (≥ 20 chars) or a readable `file_path`.',
        });
      }

      const artifact: CanonicalArtifact = binaryExtract
        ? ingest({
            source_kind: inferredKind ?? 'paste',
            title,
            ...(binaryExtract.units?.length
              ? { pre_extracted_units: binaryExtract.units }
              : { pre_extracted: binaryExtract.text }),
            extraction_quality: binaryExtract.quality,
            extraction_notes: binaryExtract.note ? [binaryExtract.note] : undefined,
            source_caps: capsFrom(binaryExtract),
            privacy_mode: 'receipt_only',
          })
        : ingest({ source_kind: inferredKind ?? 'paste', title, text, privacy_mode: 'receipt_only' });

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
      // Effective unit count: min of UNIT_LIMIT and however many fit the char budget.
      let charAcc = 0;
      let effLimit = 0;
      for (const u of artifact.units) {
        if (effLimit >= UNIT_LIMIT) break;
        charAcc += u.text.length + 48; // rough per-rendered-line overhead (id + kind + loc)
        if (charAcc > CHAR_BUDGET && effLimit > 0) break;
        effLimit++;
      }
      const extraction = buildExtractionPrompt(artifact.units, ctx, effLimit);

      const lenses = routing.selected.map((id) => ({
        id,
        label: LENSES[id].label,
        purpose: LENSES[id].purpose,
        review_questions: LENSES[id].review_questions,
        avoid: LENSES[id].failure_modes,
      }));

      // Voice follows the document's own language (M4), the same way seal/settle
      // follow the predicate. Review was ko-hardcoded, so an English draft got a
      // Korean scaffold line (experience-loop / backlog find). Detect from the
      // doc body, fall back to the title.
      const docSample = (typeof a['text'] === 'string' && a['text']) || artifact.source_title || '';
      const ko = resolveResponseLocale(null, docSample) === 'ko';
      // The reviewability SCORE stays in data for lens routing only — surfacing
      // "74/100" to the user read as a grade on their document (experience-loop
      // spine find: the reviewer came to see weak spots, not be scored; the
      // spine forbids an uncalibrated score to the user). When the material is
      // thin, say only that THIS REVIEW's confidence is limited — a caveat about
      // the read, never a grade of the draft.
      const thin = band === 'limited' || band === 'insufficient';
      const caveat = thin ? (ko ? '근거로 삼을 내용이 적어 검수가 제한적일 수 있습니다. ' : 'There is limited material to work from, so this review may be partial. ') : '';
      return envelope({
        ok: true, tool: 'argus_review',
        surface: ko
          ? `${caveat}검수 준비를 마쳤습니다. "${artifact.source_title}" · 렌즈 ${lenses.length}개. 아래 단위를 근거로 렌즈별로 검토한 뒤, 사람이 판단할 부분과 반증 가능한 예측 하나를 뽑아 argus_seal로 봉인하세요.`
          : `${caveat}Review scaffold ready. "${artifact.source_title}" · ${lenses.length} lens(es). Using the units below, review lens by lens, then pull out what a human must judge and one falsifiable prediction to seal with argus_seal.`,
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
          // The SSOT extraction prompt already embeds the anchored units + the
          // output schema — the agent works off THIS single block for every
          // stage (no separate units dump; the source text is heavy and should
          // not be sent twice).
          extraction_prompt: extraction,
          units_shown: Math.min(artifact.units.length, effLimit),
          units_total: artifact.units.length,
          ...(artifact.units.length > effLimit
            ? { units_truncated_note: `문서 단위 ${artifact.units.length}개 중 앞 ${effLimit}개만 실었습니다(응답 크기 제한). 더 검수하려면 뒷부분을 따로 넣으세요.` }
            : {}),
          protocol: [
            '1) extraction_prompt(그 안의 units + 출력 스키마)를 적용해 문서 판단 지도(profile + claims/assumptions/decision_points)를 만든다.',
            '2) lenses의 각 렌즈로 그 units를 근거로 검토한다 — 모든 finding은 unit을 근거로 하고, 산문에는 unit_id를 노출하지 않는다.',
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
