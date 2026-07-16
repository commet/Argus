import fs from 'fs';
import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { resolveResponseLocale } from '../lib/surfaces.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';
import { resolveReviewFile, ReviewPathError } from '../lib/review-path.js';
import {
  ingest,
  scoreReviewability,
  routeLenses,
  buildExtractionPrompt,
  reviewabilityBand,
  LENSES,
  lensLabel,
  LENS_VERSION,
  REVIEW_SCHEMA_VERSION,
  type SourceKind,
  type ReviewConcern,
  type DocumentProfile,
  type UserReviewContext,
  type CanonicalArtifact,
  type SourceCaps,
  type LensId,
  type ReviewLocale,
} from '../lib/review/index.js';
import { extractFileFromPath, type ExtractedText } from '../lib/review/extract-file-node.js';

const BINARY_KINDS: SourceKind[] = ['pdf', 'docx', 'pptx', 'hwpx'];

/** The five-part judgment spine (+ deck narrative for a deck) — the lenses a
 *  VISION review applies to what it SEES. Same lens objects the text path hands
 *  the host, so the framework is identical across modalities. */
function visionLensIds(isDeck: boolean): LensId[] {
  const ids: LensId[] = ['core_question', 'claim_evidence', 'hidden_assumption', 'human_judgment', 'falsifiable_followup'];
  if (isDeck) ids.push('deck_narrative' as LensId);
  return ids.filter((id) => id in LENSES);
}

function buildLensList(ids: LensId[]) {
  return ids.map((id) => ({
    id,
    label: LENSES[id].label,
    purpose: LENSES[id].purpose,
    review_questions: LENSES[id].review_questions,
    avoid: LENSES[id].failure_modes,
  }));
}

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
  pdf: 'pdf', docx: 'docx', pptx: 'pptx', hwpx: 'hwpx',
};

const inputSchema = z.strictObject({
  text: z.string().max(MAX_DOC_BYTES).describe('The document body to review (paste). Provide this OR file_path.').optional(),
  file_path: z.string().max(1024).describe('Absolute path to a DOCUMENT (.md/.txt/.pdf/.docx/.pptx/.hwpx) inside this project, the working directory, or another project already known to Argus. Other paths and non-document types are refused. PDF/DOCX/PPTX/HWPX are text-extracted with page/slide anchors where the format has them. A scanned or image-only PDF/deck (no extractable text) returns a VISION scaffold instead of failing: open the file and review its pages by eye with the same lenses.').optional(),
  argus_dir: zArgusDir.describe('Optional: scope the readable root to this project.').optional(),
  source_kind: z.enum(['paste', 'markdown', 'txt', 'pdf', 'docx', 'pptx', 'hwpx', 'transcript', 'llm_answer', 'pr_diff']).describe('Override the inferred source kind.').optional(),
  title: z.string().max(300).optional(),
  concerns: z.array(z.enum(CONCERNS)).max(3).describe('What to weight — drives lens routing.').optional(),
  audience_hint: z.string().max(200).optional(),
  biggest_worry: z.string().max(300).optional(),
  stakes: z.enum(['low', 'medium', 'high']).describe('Optional stakes hint for lens routing (default medium).').optional(),
  response_locale: z.enum(['ko', 'en']).describe("검수의 모든 사용자 노출 문자열(렌즈 라벨·라우팅 설명·추출 프롬프트의 출력 언어 지시)에 쓸 독자 로케일. MCP 호스트는 UI 로케일을 넘기지 않으므로 출력 언어를 고정하려면 지정하고, 생략하면 문서 본문에서 언어를 감지한다. The reader's locale for every user-facing string in the review; omitted, it is detected from the document body.").optional(),
});

export const review: ToolModule = {
  name: 'argus_review',
  description:
    'Review an EXISTING document (strategy memo / PRD / deck text / AI answer) for judgment risk. ' +
    'Returns: a reviewability score+band, the routed review lenses, and the extraction prompt (which embeds the anchored source units + output schema) — then hands YOU (the model) the analysis to run. ' +
    'Anchor every finding to the source; never deliver a verdict on the document. End by sealing ONE falsifiable follow-up via argus_seal. ' +
    'Use for a document the user already wrote; to open a FRESH decision use argus_open_decision instead. Accepts pasted text or a file path — PDF/DOCX/PPTX are parsed with page/slide anchors. If a PDF/deck has no extractable text (scanned/image-only), the tool returns a VISION scaffold (vision_required + file_path): open the file and review its pages visually with the same lenses. For a text PDF/deck, a visual_hint asks you to also read its charts/figures by eye.',
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
      /** The confined, realpath-resolved file. Reads use ONLY this, never the raw arg. */
      let filePathSafe = '';

      if (!text && filePath) {
        const ext = (filePath.split('.').pop() || '').toLowerCase();
        inferredKind = inferredKind ?? EXT_KIND[ext] ?? 'txt';
        // The path came from the MODEL, and whatever we read is spoken back into
        // its context. Confine it to a project the user opted into, and to real
        // document types, BEFORE any stat/read touches the filesystem.
        let safePath: string;
        try {
          safePath = resolveReviewFile(filePath, a['argus_dir'] as string | undefined);
        } catch (e) {
          if (e instanceof ReviewPathError) {
            return toolError({ ok: false, tool: 'argus_review', error_code: e.code, message: e.message, recovery: e.recovery });
          }
          throw e;
        }
        try {
          const stat = fs.statSync(safePath);
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
        // From here on, only the resolved+confined path is used.
        filePathSafe = safePath;

        if (BINARY_KINDS.includes(inferredKind)) {
          // Real Node parsing (mammoth / pdf.js / jszip), same anchored units as
          // the webapp. Scanned/empty binaries degrade honestly below, never crash.
          try {
            binaryExtract = await extractFileFromPath(filePathSafe, inferredKind);
          } catch {
            return toolError({
              ok: false, tool: 'argus_review', error_code: 'EXTRACT_FAILED',
              message: `Could not parse ${inferredKind.toUpperCase()}: ${filePath}`,
              recovery: 'Paste the document text into `text`, or convert to markdown/txt first.',
            });
          }
        } else {
          try {
            text = fs.readFileSync(filePathSafe, 'utf8');
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
      // Reader's locale for the WHOLE review (M4) — one value threaded through
      // ingest, reviewability, routing, and the extraction prompt's output
      // directive, so the review answers in one language instead of a Korean
      // scaffold wrapping an English doc. Prefer the explicit tool arg
      // (`response_locale`); the MCP host has no UI locale to fall back on, so
      // otherwise we detect it from the document body/title.
      const argLocale: ReviewLocale | undefined =
        a['response_locale'] === 'ko' || a['response_locale'] === 'en'
          ? (a['response_locale'] as ReviewLocale)
          : undefined;
      const lang: ReviewLocale =
        argLocale ??
        (resolveResponseLocale(
          typeof a['argus_dir'] === 'string' ? a['argus_dir'] : null,
          text || title || filePath,
        ) === 'ko'
          ? 'ko'
          : 'en');
      const ko = lang === 'ko';

      // A binary that yielded too little text (scanned PDF, image-only deck).
      // The text extractor is blind here — but the HOST is a vision model and can
      // OPEN the file and read its pages by eye. Rather than dead-end it, hand it a
      // VISION scaffold: read the pages visually, apply the SAME lenses/spine/seal
      // loop, anchor by page/slide. Only pdf/pptx (docx has no visual layer).
      if (binaryExtract) {
        const bx = binaryExtract;
        const empty = !bx.units?.length && !bx.text.trim();
        if (bx.quality === 'unsupported' || bx.quality === 'low' || empty) {
          const isDeck = inferredKind === 'pptx';
          // A HARD failure (encrypted / corrupt / empty) is NOT a vision case —
          // the host can't open the file by eye either. Report it honestly and stop.
          const hardFail = bx.error_kind === 'encrypted' || bx.error_kind === 'corrupt' || bx.error_kind === 'empty';
          if (hardFail) {
            return envelope({
              ok: true, tool: 'argus_review',
              surface: bx.note || (ko ? '이 문서는 지금 상태로는 검수할 수 없습니다.' : 'This document cannot be reviewed in its current form.'),
              next_actions: ['skip'],
              data: { needs_context: true, extraction_quality: bx.quality, error_kind: bx.error_kind, notes: bx.note ? [bx.note] : [] },
            });
          }
          if ((inferredKind === 'pdf' || inferredKind === 'pptx') && filePathSafe) {
            const vlenses = buildLensList(visionLensIds(isDeck));
            const anchorWord = isDeck ? 'slide' : '쪽';
            return envelope({
              ok: true, tool: 'argus_review',
              surface: ko
                ? `이 문서는 추출 가능한 텍스트가 없습니다(스캔·이미지). 파일을 직접 눈으로 읽어 렌즈별로 검수하세요. "${title}" · 렌즈 ${vlenses.length}개.`
                : `This document has no extractable text (scanned / image-only). Open it and review its pages visually, lens by lens. "${title}" · ${vlenses.length} lens(es).`,
              next_actions: ['argus_predict', 'skip'],
              data: {
                schema_version: REVIEW_SCHEMA_VERSION,
                lens_version: LENS_VERSION,
                vision_required: true,
                file_path: filePath,          // the host opens THIS path with its own file reader
                anchors_by: isDeck ? 'slide' : 'page',
                extraction_quality: bx.quality,
                notes: bx.note ? [bx.note] : [],
                lenses: vlenses,
                protocol: ko ? [
                  `1) "${filePath}" 파일을 직접 열어 페이지를 눈으로 읽어라 — 너의 파일 읽기/비전 능력을 쓴다. 이 문서는 추출 가능한 텍스트가 없어 반드시 눈으로 봐야 한다.`,
                  `2) 본 것(차트·표·수치·도표·레이아웃)을 근거로 아래 lenses를 적용해 판단 지도(claims/assumptions/decision_points)와 finding을 만든다. 모든 finding은 위치("${isDeck ? 'slide 4' : '3쪽'}")에 앵커한다.`,
                  '3) 사람이 직접 판단해야 할 항목을 분리한다. 문서에 평결("틀렸다/진행하라")을 내리지 않는다. 짧고 날카롭게, 지적 유형을 다양하게(모순·미검증 가정·미충족 선결조건·수치 불일치·이해관계자 반론).',
                  '4) 현실이 pass/fail로 답할 반증 가능한 예측 1개를 찾고, 사용자가 원하면 argus_predict로 저장한다. 예측·조건·check_by는 사용자의 것이다.',
                ] : [
                  `1) Open the file at "${filePath}" and read its pages by eye — use your own file-reading / vision capability. This document has no extractable text, so you MUST read it visually.`,
                  `2) Apply the lenses below to what you SEE (charts, tables, figures, numbers-in-images, layout): build the judgment map (claims/assumptions/decision points) and findings. Anchor every finding to a location ("${isDeck ? 'slide 4' : 'page 3'}").`,
                  '3) Separate the points that require human judgment. Do not deliver a verdict. Keep findings short and sharp, and vary their TYPE (a contradiction, an untested assumption, an unmet precondition, a number that does not add up, a stakeholder objection).',
                  '4) Find one falsifiable prediction reality can answer pass/fail; save it with argus_predict only if the user wants. The prediction, conditions, and check_by belong to the user.',
                ],
                anchor_word: anchorWord,
              },
            });
          }
          // docx or no file path → genuinely unreviewable; keep the honest degrade.
          return envelope({
            ok: true, tool: 'argus_review',
            surface: bx.note || (ko
              ? '이 문서는 지금 상태로는 전체 검수가 어렵습니다. 핵심 본문을 붙여넣으면 더 정확합니다.'
              : 'This document cannot be reviewed reliably in its current form. Paste the decision-bearing text for a more accurate review.'),
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
            locale: lang,
          })
        : ingest({ source_kind: inferredKind ?? 'paste', title, text, privacy_mode: 'receipt_only', locale: lang });

      // Honest degrade — never a confident review over unextractable input.
      if (artifact.extraction_quality === 'unsupported' || artifact.units.length === 0) {
        return envelope({
          ok: true, tool: 'argus_review',
          surface: ko
            ? '이 문서는 지금 상태로는 전체 검수가 어렵습니다. 무엇이 빠졌는지부터 확인하세요.'
            : 'This document cannot be reviewed reliably in its current form. Check what content could not be extracted first.',
          next_actions: ['skip'],
          data: {
            needs_context: true,
            extraction_quality: artifact.extraction_quality,
            notes: artifact.extraction_notes,
          },
        });
      }

      const reviewability = scoreReviewability(artifact, undefined, lang);
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
      const routing = routeLenses(profile, artifact, { concerns, maxLensCalls: 7, lang });

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
      const extraction = buildExtractionPrompt(artifact.units, ctx, effLimit, lang);

      const lenses = routing.selected.map((id) => ({
        id,
        label: lensLabel(id, lang),
        purpose: LENSES[id].purpose,
        review_questions: LENSES[id].review_questions,
        avoid: LENSES[id].failure_modes,
      }));

      // The reviewability SCORE stays in data for lens routing only — surfacing
      // "74/100" to the user read as a grade on their document (experience-loop
      // spine find: the reviewer came to see weak spots, not be scored; the
      // spine forbids an uncalibrated score to the user). When the material is
      // thin, say only that THIS REVIEW's confidence is limited — a caveat about
      // the read, never a grade of the draft.
      const thin = band === 'limited' || band === 'insufficient';
      const caveat = thin ? (ko ? '근거로 삼을 내용이 적어 검수가 제한적일 수 있습니다. ' : 'There is limited material to work from, so this review may be partial. ') : '';
      // Text extracted fine, but a PDF/deck also carries charts/figures/tables the
      // text can't convey. Nudge the vision-capable host to ALSO read them by eye —
      // so the text and visual reads go together (framework parity with the webapp's
      // vision pass), anchored by page/slide.
      const visualHint = (inferredKind === 'pdf' || inferredKind === 'pptx') && filePathSafe
        ? (ko
            ? `이 문서는 ${inferredKind === 'pptx' ? '덱' : 'PDF'}입니다 — 차트·도표·표가 있으면 "${filePath}"를 직접 열어 눈으로도 확인하고 판단에 반영하세요(그 finding은 ${inferredKind === 'pptx' ? 'slide' : '쪽'}에 앵커).`
            : `This is a ${inferredKind === 'pptx' ? 'deck' : 'PDF'} — if it contains charts or figures, also open "${filePath}" and read them by eye, factoring them into the review (anchor those findings by ${inferredKind === 'pptx' ? 'slide' : 'page'}).`)
        : undefined;
      return envelope({
        ok: true, tool: 'argus_review',
        surface: ko
          ? `${caveat}검수 준비를 마쳤습니다. "${artifact.source_title}" · 렌즈 ${lenses.length}개. 아래 단위를 근거로 렌즈별로 검토하고, 사람이 직접 판단할 부분과 확인 가능한 후속 예측 하나를 찾으세요. 저장 여부는 사용자가 정합니다.`
          : `${caveat}Review scaffold ready. "${artifact.source_title}" · ${lenses.length} lens(es). Review the units lens by lens, identify what a human must judge, and find one falsifiable follow-up prediction. The user decides whether to save it.`,
        next_actions: ['argus_predict', 'skip'],
        data: {
          schema_version: REVIEW_SCHEMA_VERSION,
          lens_version: LENS_VERSION,
          artifact_id: artifact.artifact_id,
          source_title: artifact.source_title,
          reviewability: { score: reviewability.score, band, reasons: reviewability.reasons },
          structure: artifact.detected_structure,
          routing: {
            selected: routing.selected,
            disclosure: routing.disclosure,
            note: ko
              ? '라우팅은 기본 프로파일 기준의 제안입니다 — 추출 단계에서 문서 프로파일을 확정하면 렌즈를 조정하세요.'
              : 'Routing is a suggestion based on the default profile — adjust the lenses after confirming the document profile during extraction.',
          },
          lenses,
          // The SSOT extraction prompt already embeds the anchored units + the
          // output schema — the agent works off THIS single block for every
          // stage (no separate units dump; the source text is heavy and should
          // not be sent twice).
          extraction_prompt: extraction,
          ...(visualHint ? { visual_hint: visualHint } : {}),
          units_shown: Math.min(artifact.units.length, effLimit),
          units_total: artifact.units.length,
          ...(artifact.units.length > effLimit
            ? { units_truncated_note: ko
                ? `문서 단위 ${artifact.units.length}개 중 앞 ${effLimit}개만 실었습니다(응답 크기 제한). 더 검수하려면 뒷부분을 따로 넣으세요.`
                : `Included the first ${effLimit} of ${artifact.units.length} source units because of the response-size limit. Submit the remaining section separately to review it.` }
            : {}),
          protocol: ko ? [
            '1) extraction_prompt(그 안의 units + 출력 스키마)를 적용해 문서 판단 지도(profile + claims/assumptions/decision_points)를 만든다.',
            '2) lenses의 각 렌즈로 그 units를 근거로 검토한다. 모든 finding은 unit을 근거로 하고, 사용자에게 보여주는 산문에는 unit_id를 노출하지 않는다.',
            '3) 사람이 직접 판단해야 할 항목(judgment obligations)을 분리한다. 평결하지 않는다.',
            '4) 현실이 pass/fail로 답할 반증 가능한 예측 1개를 찾고, 사용자가 원하면 argus_predict로 저장한다. 예측·pass/fail 조건·check_by는 사용자의 것이다.',
          ] : [
            '1) Apply extraction_prompt, including its units and output schema, to build the document judgment map: profile, claims, assumptions, and decision points.',
            '2) Review those units through each selected lens. Every finding needs unit evidence; do not expose internal unit_id values in user-facing prose.',
            '3) Separate the points that require human judgment. Do not deliver a verdict.',
            '4) Find one falsifiable prediction that reality can answer pass/fail. Save it with argus_predict only if the user wants; the prediction, conditions, and check_by belong to the user.',
          ],
        },
      });
    } catch (e) {
      return handleToolException('argus_review', e);
    }
  },
};
