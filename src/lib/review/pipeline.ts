/**
 * Review pipeline orchestrator (design doc §"분석 아키텍처: Normalize Before
 * Review"). Ties the stages together:
 *
 *   Canonical Artifact → [extract] profile + judgment map → reviewability →
 *   [route] lenses → [review] findings (parallel) → [synthesize] receipt
 *
 * The pipeline depends on the ReviewLLM seam, so it is unit-testable with a
 * deterministic mock and provider-agnostic in production. Failure states
 * (unsupported extraction, no anchors, insufficient reviewability) are
 * first-class returns, never swallowed exceptions.
 */

import {
  type CanonicalArtifact,
  type DocumentProfile,
  type DocumentJudgmentMap,
  type JudgmentReceipt,
  type ReviewJob,
  type ReviewFailure,
  type AnalysisBudget,
  type UserReviewContext,
  type Finding,
  type JudgmentObligation,
  type FalsifiableFollowup,
  type Claim,
  type SourceAnchor,
  type ArtifactUnit,
  type LensId,
  type ReviewProvenance,
  type ReviewLocale,
  DEFAULT_BUDGET,
  REVIEW_SCHEMA_VERSION,
  reviewabilityBand,
} from './schema';
import { scoreReviewability } from './reviewability';
import { packUnitsForPrompt, chunkUnitsForReview, computeCoverage } from './coverage';
import { routeLenses } from './routing';
import { LENSES } from './lenses';
import { buildDocumentOutline, buildExtractionPrompt, buildLensPrompt, buildMapPrompt, buildQuickReviewPrompt, buildSynthesisPrompt, buildVisionReviewPrompt } from './prompts';
import { defaultReviewLLM, type ReviewLLM } from './llm-adapter';
import type { LLMContentBlock, LLMImageBlock } from '../llm';
import { djb2, stableId } from './ids';
import { translate } from '@/lib/i18n';
import { DAILY_LIMIT } from '@/lib/quota-config';

/** Max chunk map calls in flight at once (see the map-reduce path). */
const MAP_CONCURRENCY = 5;

/** Run `fn` over items with bounded concurrency, never rejecting — mirrors
 *  Promise.allSettled's result shape so a failed chunk is disclosed, not fatal. */
async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (let i = next++; i < items.length; i = next++) {
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i], i) };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/** Opt-in multimodal payload threaded from extraction (never persisted). A PDF
 *  rides as one native document block; a deck rides as its embedded images. */
export interface ReviewVisionSource {
  kind: 'pdf' | 'images';
  pdf_base64?: string;
  images?: Array<{ media_type: string; data: string }>;
  page_count?: number;
}

export interface RunReviewOptions {
  llm?: ReviewLLM;
  budget?: AnalysisBudget;
  context?: UserReviewContext;
  rootMode?: 'create' | 'review';
  today?: string; // YYYY-MM-DD
  /** Output language for LLM content AND progress labels. Defaults to 'ko' so
   *  existing callers/tests are unchanged; the web passes the reader's locale. */
  locale?: ReviewLocale;
  onProgress?: (job: ReviewJob) => void;
  signal?: AbortSignal;
  /** When present (user opted into vision), the review runs as a single
   *  multimodal pass over the attached document/deck instead of the text path. */
  vision?: ReviewVisionSource;
}

const IMG_MEDIA = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/** Turn a vision source into Anthropic content blocks (document/image). Returns
 *  [] when the payload is empty or malformed — the caller then stays text-only. */
function buildVisionAttachments(v: ReviewVisionSource): LLMContentBlock[] {
  if (v.kind === 'pdf' && v.pdf_base64) {
    return [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: v.pdf_base64 } }];
  }
  if (v.kind === 'images' && v.images?.length) {
    return v.images
      .filter((im) => IMG_MEDIA.has(im.media_type) && im.data)
      .slice(0, 40)
      .map((im) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: im.media_type as LLMImageBlock['source']['media_type'], data: im.data } }));
  }
  return [];
}

export interface ReviewResult {
  job: ReviewJob;
  receipt?: JudgmentReceipt;
}

export async function runDocumentReview(
  artifact: CanonicalArtifact,
  options: RunReviewOptions = {},
): Promise<ReviewResult> {
  const llm = options.llm ?? defaultReviewLLM;
  const budget = options.budget ?? DEFAULT_BUDGET.standard;
  const ctx = options.context ?? {};
  const today = options.today ?? isoToday();
  const lang: ReviewLocale = options.locale ?? 'ko';
  // Progress-label + inline-message localizer (the LLM content is localized via
  // the prompt language directive; this covers the strings the pipeline itself
  // emits during the run).
  const t = (ko: string, en: string) => (lang === 'en' ? en : ko);
  const jobId = stableId('job', artifact.artifact_id, today);
  const promptParts: string[] = [];

  const emit = (status: ReviewJob['status'], label: string, extra?: Partial<ReviewJob>): ReviewJob => {
    const job: ReviewJob = { job_id: jobId, artifact_id: artifact.artifact_id, status, progress_label: label, ...extra };
    options.onProgress?.(job);
    return job;
  };

  // --- Gate 0: unsupported / empty extraction -----------------------------
  // A scanned PDF has zero text units — but that is exactly the vision case, so
  // when a vision payload is present we skip this gate and review from the images.
  if ((artifact.extraction_quality === 'unsupported' || artifact.units.length === 0) && !options.vision) {
    const error: ReviewFailure = {
      kind: artifact.extraction_quality === 'unsupported' ? 'unsupported_format' : 'extraction_low',
      message: artifact.extraction_notes[0] ?? t('이 문서는 자동 검수를 지원하지 않습니다.', 'This document cannot be reviewed automatically.'),
      recovery: t('본문 텍스트를 붙여넣으면 검수할 수 있습니다.', 'Paste the body text and it can be reviewed.'),
    };
    return { job: emit('needs_context', t('검수 불가 — 맥락 필요', 'Cannot review — context needed'), { error }) };
  }

  const unitMap = new Map<string, ArtifactUnit>(artifact.units.map((u) => [u.unit_id, u]));
  const resolveAnchors = (unitIds: unknown): SourceAnchor[] => {
    if (!Array.isArray(unitIds)) return [];
    const anchors: SourceAnchor[] = [];
    for (const id of unitIds) {
      const u = typeof id === 'string' ? unitMap.get(id) : undefined;
      if (u) anchors.push(u.source_anchor);
    }
    return anchors;
  };

  try {
    // --- Vision pass: a single multimodal review over the attached document ---
    // When the user opts in, the model SEES the PDF pages / deck images and reads
    // the visuals text extraction drops. One call → the full receipt, anchored by
    // page/slide. Falls through to the text path if the payload is empty.
    if (options.vision) {
      const attachments = buildVisionAttachments(options.vision);
      if (attachments.length) {
        emit('reviewing', t('문서를 이미지까지 함께 정밀 검수하는 중', 'Reviewing the document — including its images — closely'));
        const isDeck = artifact.detected_structure?.is_deck === true || artifact.source_kind === 'pptx';
        const resolvePageAnchors = (ids: unknown): SourceAnchor[] => {
          if (!Array.isArray(ids)) return [];
          const out: SourceAnchor[] = [];
          const seen = new Set<number>();
          for (const id of ids) {
            const m = /(\d+)/.exec(String(id));
            if (!m) continue;
            const n = parseInt(m[1], 10);
            if (!Number.isFinite(n) || n <= 0 || seen.has(n)) continue;
            seen.add(n);
            out.push(isDeck ? { slide: n } : { page: n });
          }
          return out;
        };
        const mapPagesToIds = (arr: unknown): void => {
          if (!Array.isArray(arr)) return;
          for (const it of arr) {
            if (it && typeof it === 'object' && 'pages' in it && !('unit_ids' in it)) {
              (it as Record<string, unknown>).unit_ids = (it as Record<string, unknown>).pages;
            }
          }
        };
        const packedV = packUnitsForPrompt(artifact.units, budget.max_units);
        const coverageV = computeCoverage(artifact, artifact.units.length);
        const vp = buildVisionReviewPrompt(packedV.units, ctx, packedV.units.length, today, lang, isDeck);
        promptParts.push(vp.system);
        const raw = await llm.json<Record<string, unknown>>({
          system: vp.system,
          user: vp.user,
          maxTokens: Math.min(budget.max_tokens || 8000, 6500),
          model: 'default',
          signal: options.signal,
          attachments,
          shape: {
            core_question: { type: 'string', default: '' },
            findings: { type: 'array', default: [] },
            judgment_obligations: { type: 'array', default: [] },
            followups: { type: 'array', default: [] },
            current_heading: { type: 'string', default: '' },
            main_claims: { type: 'array', default: [] },
            assumptions: { type: 'array', default: [] },
            decision_points: { type: 'array', default: [] },
          },
        });
        for (const k of ['findings', 'judgment_obligations', 'main_claims', 'assumptions', 'decision_points']) {
          mapPagesToIds(raw[k]);
        }
        const profileV = normalizeProfile(raw['profile'], ctx);
        const mapV = normalizeMap(raw, resolvePageAnchors, lang);
        const reviewabilityV = scoreReviewability(artifact, mapV);
        const routingV = routeLenses(profileV, artifact, { concerns: ctx.concerns, maxLensCalls: budget.max_lens_calls });
        const allowedV = new Set<LensId>(routingV.selected);
        const rawFindingsV = Array.isArray(raw['findings']) ? raw['findings'] : [];
        const normV = rawFindingsV.flatMap((finding) => {
          if (!finding || typeof finding !== 'object') return [];
          const lensId = String((finding as Record<string, unknown>)['lens_id']) as LensId;
          if (!allowedV.has(lensId)) return [];
          return normalizeFindings([finding], lensId, resolvePageAnchors, lang);
        }).slice(0, 6);
        const findingsV = dedupeFindings(supplementQuickFindings(normV, mapV, lang));
        const obligationsV = normalizeObligations(raw['judgment_obligations'], resolvePageAnchors, lang).slice(0, 3);
        const followupsV = normalizeFollowups(raw['followups'], today);
        const coreQ = String(raw['core_question'] || mapV.core_question || '').trim();
        const headingV = String(raw['current_heading'] || '').trim() || neutralHeading(mapV, lang);
        const receiptV = assembleReceipt({
          artifact, profile: profileV, reviewability: reviewabilityV, routing: routingV,
          map: { ...mapV, core_question: coreQ },
          findings: findingsV, obligations: obligationsV, followups: followupsV,
          currentHeading: headingV, coverage: coverageV,
          rootMode: options.rootMode ?? 'review', today, llm, promptHash: djb2(promptParts.join('')),
        });
        receiptV.provenance.vision = { mode: options.vision.kind, page_count: options.vision.page_count };
        return { job: emit('ready', t('검수 완료 (이미지 포함)', 'Review complete (images included)')), receipt: receiptV };
      }
      // empty attachments → fall through to the text path below.
    }

    // --- Stage 1: extraction → profile + judgment map ---------------------
    // Pack units ONCE under both the count cap and the prompt char budget, so a
    // large document degrades to "fewer units + a coverage note" instead of
    // hard-failing the server's per-message limit — and so coverage is honest.
    emit('profiling', t('주장을 분석하는 중', 'Analyzing the claims'));
    const packed = packUnitsForPrompt(artifact.units, budget.max_units);
    const unitsReviewed = packed.units.length;
    const coverage = computeCoverage(artifact, unitsReviewed);

    // A short document should not pay for three sequential model stages plus
    // five parallel lens calls. Quick mode keeps the complete judgment spine,
    // but asks for its map, findings, obligations, and follow-ups in one bounded
    // structured response. Standard/deep reviews retain the multi-stage path.
    if (budget.depth === 'quick') {
      emit('reviewing', t('핵심 판단 5가지를 한 번에 검수하는 중', 'Reviewing the five core judgments in one pass'));
      const quickPrompt = buildQuickReviewPrompt(packed.units, ctx, packed.units.length, today, lang);
      promptParts.push(quickPrompt.system);
      const raw = await llm.json<Record<string, unknown>>({
        system: quickPrompt.system,
        user: quickPrompt.user,
        // The quick JSON carries the full spine (map + findings + obligations +
        // followups). At 2800 it truncated the LAST fields — findings/obligations/
        // followups — so the receipt fell back to supplementQuickFindings' generic
        // "근거 부족" stand-ins. Give the product fields room to be specific.
        maxTokens: Math.min(budget.max_tokens, 6500),
        model: 'default',
        signal: options.signal,
        shape: {
          core_question: { type: 'string', default: '' },
          main_claims: { type: 'array', default: [] },
          assumptions: { type: 'array', default: [] },
          decision_points: { type: 'array', default: [] },
          findings: { type: 'array', default: [] },
          current_heading: { type: 'string', default: '' },
          judgment_obligations: { type: 'array', default: [] },
          followups: { type: 'array', default: [] },
        },
      });

      const profile = normalizeProfile(raw['profile'], ctx);
      const map = normalizeMap(raw, resolveAnchors, lang);
      emit('mapping', t('판단 지도와 근거 위치를 정리하는 중', 'Laying out the judgment map and where the evidence sits'));
      const reviewability = scoreReviewability(artifact, map, lang);
      const routing = routeLenses(profile, artifact, {
        concerns: ctx.concerns,
        maxLensCalls: budget.max_lens_calls,
        lang,
      });
      emit('routing', t('검수 범위를 확인하는 중', 'Confirming the review scope'));

      if (reviewabilityBand(reviewability.score) === 'insufficient') {
        const receipt = assembleReceipt({
          artifact, profile, reviewability, routing, map,
          findings: [], obligations: [], followups: [],
          currentHeading: neutralHeading(map, lang), coverage,
          rootMode: options.rootMode ?? 'review', today, llm, promptHash: djb2(promptParts.join('')),
        });
        receipt.state = 'draft';
        return { job: emit('needs_context', t('검수 가능성 낮음 — 부족한 맥락 표시', 'Low reviewability — showing what context is missing')), receipt };
      }

      const allowedLenses = new Set<LensId>(routing.selected);
      const rawFindings = Array.isArray(raw['findings']) ? raw['findings'] : [];
      const normalizedFindings = rawFindings.flatMap((finding) => {
        if (!finding || typeof finding !== 'object') return [];
        const lensId = String((finding as Record<string, unknown>)['lens_id']) as LensId;
        if (!allowedLenses.has(lensId)) return [];
        return normalizeFindings([finding], lensId, resolveAnchors, lang);
      }).slice(0, 5);
      const findings = supplementQuickFindings(normalizedFindings, map, lang);

      emit('synthesizing', t('Judgment Receipt를 정리하는 중', 'Assembling your Judgment Receipt'));
      const obligations = normalizeObligations(raw['judgment_obligations'], resolveAnchors, lang).slice(0, 3);
      const followups = normalizeFollowups(raw['followups'], today);
      const currentHeading = String(raw['current_heading'] || '').trim() || neutralHeading(map, lang);
      const coreQuestion = String(raw['core_question'] || map.core_question || '').trim();
      const receipt = assembleReceipt({
        artifact, profile, reviewability, routing,
        map: { ...map, core_question: coreQuestion },
        findings, obligations, followups, currentHeading, coverage,
        rootMode: options.rootMode ?? 'review', today, llm, promptHash: djb2(promptParts.join('')),
      });
      return { job: emit('ready', t('검수 완료', 'Review complete')), receipt };
    }

    // --- Map-Reduce for long documents ------------------------------------
    // A report that doesn't fit one prompt used to be reviewed on only its front
    // ~13% (packUnitsForPrompt takes the leading units up to the char budget).
    // Chunk the WHOLE document, map each chunk to a partial judgment map +
    // findings in one bounded call (parallel), then reduce: merge maps, de-dup
    // findings, and synthesize the receipt once. Docs that fit one prompt fall
    // through to the richer single-pass multi-lens path below (unchanged).
    const maxChunks = budget.depth === 'deep' ? 16 : 10;
    const chunked = chunkUnitsForReview(artifact.units, maxChunks);
    if (chunked.chunks.length > 1) {
      const chunks = chunked.chunks;
      emit('profiling', t(`문서를 ${chunks.length}개 구간으로 나눠 전체를 검수하는 중`, `Splitting the document into ${chunks.length} sections to review all of it`));
      let mapDone = 0;
      // Whole-document outline computed ONCE from every unit — the contextual
      // header each isolated chunk needs to catch cross-section conflicts.
      const outline = buildDocumentOutline(artifact.units);
      // Bounded concurrency: firing all chunks at once bursts past the browser's
      // ~6 sockets and risks a rate-limit spike. A small pool keeps the request
      // stream smooth while still overlapping the slow model calls.
      const mapResults = await mapPool(chunks, MAP_CONCURRENCY, async (chunk, i) => {
          const mp = buildMapPrompt(chunk, ctx, i, chunks.length, today, lang, outline);
          promptParts.push(mp.system);
          try {
            return await llm.json<Record<string, unknown>>({
              system: mp.system,
              user: mp.user,
              maxTokens: Math.min(budget.max_tokens, 3200),
              model: 'default',
              signal: options.signal,
              shape: {
                profile: { type: 'object', default: {} },
                core_question: { type: 'string', default: '' },
                main_claims: { type: 'array', default: [] },
                evidence_items: { type: 'array', default: [] },
                assumptions: { type: 'array', default: [] },
                decision_points: { type: 'array', default: [] },
                tradeoffs: { type: 'array', default: [] },
                stakeholders: { type: 'array', default: [] },
                open_questions: { type: 'array', default: [] },
                missing_sections: { type: 'array', default: [] },
                findings: { type: 'array', default: [] },
                current_heading: { type: 'string', default: '' },
              },
            });
          } finally {
            mapDone++;
            emit('reviewing', t(`근거 확인 중 (구간 ${mapDone}/${chunks.length})`, `Checking evidence (section ${mapDone}/${chunks.length})`));
          }
      });

      const partials = mapResults
        .filter((r): r is PromiseFulfilledResult<Record<string, unknown>> => r.status === 'fulfilled')
        .map((r) => r.value);
      // Honest coverage: a chunk that errored was NOT reviewed. Count only the
      // units in chunks whose map call actually returned.
      const unitsReviewed = chunks.reduce(
        (n, c, i) => (mapResults[i].status === 'fulfilled' ? n + c.length : n),
        0,
      );
      const coverage = computeCoverage(artifact, unitsReviewed);
      const failedChunks = chunks.length - partials.length;
      if (failedChunks > 0) {
        coverage.notes.push(t(
          `${chunks.length}개 구간 중 ${failedChunks}개 구간은 검수 중 오류로 빠졌습니다.`,
          `${failedChunks} of ${chunks.length} sections were dropped due to an error during review.`,
        ));
      }

      // If every chunk failed, this is a model error, not a thin review. When the
      // chunks failed for a known reason (login exhausted, rate limit), surface
      // that localized cause rather than the generic "all sections failed" line.
      if (partials.length === 0) {
        const firstReason = mapResults.find((r): r is PromiseRejectedResult => r.status === 'rejected');
        const error: ReviewFailure = firstReason
          ? localizeReviewError(firstReason.reason, lang, t)
          : {
              kind: 'model_error',
              message: t('문서 구간 검수가 모두 실패했습니다.', 'Every section of the document failed to review.'),
              recovery: t('잠시 후 다시 시도하거나, 더 짧은 문서로 나눠서 검수해 보세요.', 'Try again shortly, or split the document into smaller pieces.'),
            };
        return { job: emit('failed', t('검수 실패', 'Review failed'), { error }) };
      }

      const maps = partials.map((raw) => normalizeMap(raw, resolveAnchors, lang));
      const map = mergeMaps(maps);
      const profile = normalizeProfile(
        partials.find((p) => p['profile'] && typeof p['profile'] === 'object')?.['profile'],
        ctx,
      );

      const reviewability = scoreReviewability(artifact, map, lang);
      const routing = routeLenses(profile, artifact, {
        concerns: ctx.concerns,
        maxLensCalls: budget.max_lens_calls,
        lang,
      });

      if (reviewabilityBand(reviewability.score) === 'insufficient') {
        const receipt = assembleReceipt({
          artifact, profile, reviewability, routing, map,
          findings: [], obligations: [], followups: [],
          currentHeading: neutralHeading(map, lang), coverage,
          rootMode: options.rootMode ?? 'review', today, llm, promptHash: djb2(promptParts.join('')),
        });
        receipt.state = 'draft';
        return { job: emit('needs_context', t('검수 가능성 낮음 — 부족한 맥락 표시', 'Low reviewability — showing what context is missing')), receipt };
      }

      const allowedLenses = new Set<LensId>(routing.selected);
      const mappedFindings = partials
        .flatMap((p) => (Array.isArray(p['findings']) ? p['findings'] : []))
        .flatMap((finding) => {
          if (!finding || typeof finding !== 'object') return [];
          const lensId = String((finding as Record<string, unknown>)['lens_id']) as LensId;
          if (!allowedLenses.has(lensId)) return [];
          return normalizeFindings([finding], lensId, resolveAnchors, lang);
        });
      let findings = dedupeFindings(mappedFindings);
      if (findings.length === 0) findings = supplementQuickFindings([], map, lang);
      // A whole-document review surfaces more than a single prompt — keep the top
      // ranked handful so the receipt stays readable, deduped first so the cut
      // never drops a unique issue in favor of a near-duplicate, and diversified
      // by anchor so one dense section can't crowd every other slide out of the 10.
      findings = diversifyByAnchor(rankFindings(findings)).slice(0, 10);

      emit('synthesizing', t('Judgment Receipt를 만드는 중', 'Building your Judgment Receipt'));
      const mapSummary = summarizeMap(map);
      const synPrompt = buildSynthesisPrompt(mapSummary, summarizeFindings(findings), ctx, today, lang);
      promptParts.push(synPrompt.system);
      let syn: Record<string, unknown> = {};
      try {
        syn = await llm.json<Record<string, unknown>>({
          system: synPrompt.system,
          user: synPrompt.user,
          maxTokens: 2800,
          model: 'default',
          signal: options.signal,
          shape: {
            core_question: { type: 'string', default: map.core_question },
            current_heading: { type: 'string', default: '' },
            judgment_obligations: { type: 'array', default: [] },
            followups: { type: 'array', default: [] },
          },
        });
      } catch {
        syn = {};
      }

      const obligations = normalizeObligations(syn['judgment_obligations'], resolveAnchors, lang);
      const followups = normalizeFollowups(syn['followups'], today);
      const currentHeading = String(syn['current_heading'] || '').trim() || neutralHeading(map, lang);
      const coreQuestion = String(syn['core_question'] || map.core_question || '').trim();

      const receipt = assembleReceipt({
        artifact, profile, reviewability, routing,
        map: { ...map, core_question: coreQuestion },
        findings, obligations, followups, currentHeading, coverage,
        rootMode: options.rootMode ?? 'review', today, llm, promptHash: djb2(promptParts.join('')),
      });
      return { job: emit('ready', t('검수 완료', 'Review complete')), receipt };
    }

    const exPrompt = buildExtractionPrompt(packed.units, ctx, packed.units.length, lang);
    promptParts.push(exPrompt.system);
    const raw = await llm.json<Record<string, unknown>>({
      system: exPrompt.system,
      user: exPrompt.user,
      // The extraction shape is a compact map, not a document. A 6k allowance
      // encouraged minute-long profiles before lens review even began; 2500 in
      // turn truncated the map on a dense deck, starving the lenses downstream.
      maxTokens: Math.min(budget.max_tokens, 3200),
      model: 'default',
      signal: options.signal,
      shape: {
        core_question: { type: 'string', default: '' },
        main_claims: { type: 'array', default: [] },
        assumptions: { type: 'array', default: [] },
        decision_points: { type: 'array', default: [] },
      },
    });

    const profile = normalizeProfile(raw['profile'], ctx);
    const map = normalizeMap(raw, resolveAnchors, lang);

    emit('mapping', t('사람이 판단할 지점을 찾는 중', 'Finding the points a human must judge'));

    // --- Stage 2: reviewability + routing ---------------------------------
    const reviewability = scoreReviewability(artifact, map, lang);
    const routing = routeLenses(profile, artifact, {
      concerns: ctx.concerns,
      maxLensCalls: budget.max_lens_calls,
      lang,
    });
    emit('routing', t('문서 유형에 맞는 검수 렌즈를 고르는 중', 'Choosing review lenses for this document type'));

    // Insufficient reviewability → produce a "what is missing" receipt, no lenses.
    if (reviewabilityBand(reviewability.score) === 'insufficient') {
      const receipt = assembleReceipt({
        artifact, profile, reviewability, routing, map,
        findings: [], obligations: [], followups: [],
        currentHeading: t(
          '이 문서는 지금 상태로는 충분히 검수하기 어렵습니다. 무엇이 빠졌는지부터 봅니다.',
          'This document is hard to review as it stands. Let us start with what is missing.',
        ),
        coverage,
        rootMode: options.rootMode ?? 'review', today, llm, promptHash: djb2(promptParts.join('')),
      });
      receipt.state = 'draft';
      return { job: emit('needs_context', t('검수 가능성 낮음 — 부족한 맥락 표시', 'Low reviewability — showing what context is missing'), {}), receipt };
    }

    // --- Stage 3: lens reviews (parallel) ---------------------------------
    // This is the longest stage (N parallel model calls). Emit a completion
    // counter as each lens settles so the UI shows honest movement ("렌즈 3/7")
    // instead of a frozen bar — never a fabricated linear %.
    const lensTotal = routing.selected.length;
    let lensDone = 0;
    // Surface a few of the document's OWN premises (its stated assumptions, then
    // claims) so the longest stage shows specific work on the user's material —
    // verbatim source text, never a verdict about it (see ReviewJob.examining).
    const examining = sampleExaminingPremises(map);
    emit('reviewing', lensTotal > 0 ? t(`근거 확인 중 (렌즈 0/${lensTotal})`, `Checking evidence (lens 0/${lensTotal})`) : t('근거가 약한 곳을 확인하는 중', 'Checking where the evidence is weak'), { examining });
    const mapSummary = summarizeMap(map);
    const lensResults = await Promise.allSettled(
      routing.selected.map(async (lensId) => {
        const lens = LENSES[lensId];
        const lp = buildLensPrompt(lens, mapSummary, relevantUnits(packed.units, lens, packed.units.length), packed.units.length, lang);
        promptParts.push(lp.system);
        try {
          const out = await llm.json<{ findings?: unknown[] }>({
            system: lp.system,
            user: lp.user,
            // 1600 forced each lens to compress its findings into one-line
            // generic titles; a specific finding (exact claim + why + anchor)
            // needs room. Dedup downstream collapses any cross-lens repeats.
            maxTokens: 2800,
            model: 'default',
            signal: options.signal,
            shape: { findings: { type: 'array', default: [] } },
          });
          return normalizeFindings(out.findings, lensId, resolveAnchors, lang);
        } finally {
          lensDone++;
          emit('reviewing', t(`근거 확인 중 (렌즈 ${lensDone}/${lensTotal})`, `Checking evidence (lens ${lensDone}/${lensTotal})`), { examining });
        }
      }),
    );
    // De-dup across lenses: the same anchored issue can surface from more than
    // one lens (claim_evidence + stakeholder_objection both flag one weak claim).
    // Collapse them so the receipt shows the issue once (same fix the map-reduce
    // reduce step applies), keeping the strongest severity and unioning anchors.
    const findings: Finding[] = dedupeFindings(
      lensResults
        .filter((r): r is PromiseFulfilledResult<Finding[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value),
    );

    // Honesty: a lens that errored/timed out must NOT be silently counted as
    // applied. Move it out of `selected` into `skipped` so the disclosure and
    // provenance reflect what actually ran (design doc §"실패 UX / 소유권 정직성").
    const failedLenses: LensId[] = [];
    lensResults.forEach((r, i) => {
      if (r.status === 'rejected') failedLenses.push(routing.selected[i]);
    });
    if (failedLenses.length) {
      routing.selected = routing.selected.filter((id) => !failedLenses.includes(id));
      for (const id of failedLenses) routing.skipped.push({ id, reason: t('검수 중 오류로 이번 결과에서 제외', 'Excluded from this result due to an error during review') });
    }

    // --- Stage 4: synthesis → receipt fields ------------------------------
    // Wrapped like the map-reduce reduce step: a synthesis that errors or
    // truncates must degrade to "findings without obligations", NEVER fail the
    // whole review. The findings above are the load-bearing output; obligations
    // and follow-ups are additive. A bare await here turned one truncated JSON
    // into a total model_error with zero findings shown.
    emit('synthesizing', t('Judgment Receipt를 만드는 중', 'Building your Judgment Receipt'));
    const synPrompt = buildSynthesisPrompt(mapSummary, summarizeFindings(findings), ctx, today, lang);
    promptParts.push(synPrompt.system);
    let syn: Record<string, unknown> = {};
    try {
      syn = await llm.json<Record<string, unknown>>({
        system: synPrompt.system,
        user: synPrompt.user,
        maxTokens: 2800,
        model: 'default',
        signal: options.signal,
        shape: {
          core_question: { type: 'string', default: map.core_question },
          current_heading: { type: 'string', default: '' },
          judgment_obligations: { type: 'array', default: [] },
          followups: { type: 'array', default: [] },
        },
      });
    } catch {
      syn = {};
    }

    const obligations = normalizeObligations(syn['judgment_obligations'], resolveAnchors, lang);
    const followups = normalizeFollowups(syn['followups'], today);
    const currentHeading = String(syn['current_heading'] || '').trim() || neutralHeading(map, lang);
    const coreQuestion = String(syn['core_question'] || map.core_question || '').trim();

    const receipt = assembleReceipt({
      artifact, profile, reviewability, routing,
      map: { ...map, core_question: coreQuestion },
      findings, obligations, followups, currentHeading,
      coverage,
      rootMode: options.rootMode ?? 'review', today, llm, promptHash: djb2(promptParts.join('')),
    });

    return { job: emit('ready', t('검수 완료', 'Review complete')), receipt };
  } catch (err) {
    return { job: emit('failed', t('검수 실패', 'Review failed'), { error: localizeReviewError(err, lang, t) }) };
  }
}

/**
 * Localize a caught LLM/review error into a user-facing ReviewFailure. The LLM
 * layer (lib/llm.ts) tags failures with a `category` and raises Korean text — so
 * the review flow used to surface a raw Korean string (and leak the internal
 * "LOGIN_REQUIRED:" prefix) to an English reader. Map the category to the
 * single-source i18n message for the reader's `lang`; free-trial exhaustion gets
 * a review-specific line that keeps the "log in for more" context.
 */
function localizeReviewError(
  err: unknown,
  lang: ReviewLocale,
  t: (ko: string, en: string) => string,
): ReviewFailure {
  const raw = err instanceof Error ? err.message : '';
  const category = (err as { category?: string } | null)?.category;
  const loginRequired = raw.startsWith('LOGIN_REQUIRED');

  if (loginRequired) {
    return {
      kind: 'model_error',
      message: t(
        `무료 체험을 모두 사용했어요. 로그인하면 하루 ${DAILY_LIMIT}회까지 무료로 검수할 수 있어요.`,
        `You've used up the free trial. Log in to review up to ${DAILY_LIMIT} times a day for free.`,
      ),
      recovery: t('로그인한 뒤 다시 검수해 주세요 — 입력한 내용은 그대로 남아 있어요.',
        'Log in and run the review again — your input is kept.'),
    };
  }

  // Known LLM error categories → the app's single-source i18n copy, in `lang`.
  const KEY: Record<string, Parameters<typeof translate>[1]> = {
    auth: 'errorDisplay.authFailed',
    rate_limit: 'errorDisplay.rateLimit',
    overloaded: 'errorDisplay.overloaded',
    context_too_long: 'errorDisplay.contextTooLong',
    network: 'errorDisplay.network',
  };
  if (category && KEY[category]) {
    return {
      kind: 'model_error',
      message: translate(lang, KEY[category]),
      recovery: category === 'context_too_long'
        ? t('문서를 더 짧게 나눠서 검수해 보세요.', 'Split the document into shorter pieces and try again.')
        : t('잠시 후 다시 시도해 주세요 — 입력한 내용은 그대로 남아 있어요.', 'Try again shortly — your input is kept.'),
    };
  }

  // Any other LLMError (e.g. 'unknown') → the neutral localized fallback rather
  // than a raw provider/Korean string. A non-LLM Error keeps its own message.
  return {
    kind: 'model_error',
    message: category
      ? translate(lang, 'errorDisplay.unknown')
      : (raw || t('검수 중 오류가 발생했습니다.', 'An error occurred during review.')),
    recovery: t('잠시 후 다시 시도하거나, 더 짧은 문서로 나눠서 검수해 보세요.', 'Try again shortly, or split the document into smaller pieces.'),
  };
}

/** A few of the document's OWN premises to surface during the lens wait:
 *  its stated assumptions first (the load-bearing kind), then main claims to
 *  fill up to three. The source's stated premise text as the pipeline extracted
 *  it (currently rendered in Korean regardless of UI locale — see the pipeline
 *  i18n note) — no status, no rationale, no verdict. Whitespace-collapsed and
 *  length-capped for a calm one-line display. */
function sampleExaminingPremises(map: DocumentJudgmentMap): string[] {
  const clean = (t: unknown): string =>
    (typeof t === 'string' ? t : '').replace(/\s+/g, ' ').trim();
  const out: string[] = [];
  const push = (t: string) => {
    if (t && !out.includes(t)) out.push(t.length > 120 ? `${t.slice(0, 117)}…` : t);
  };
  for (const a of map.assumptions ?? []) { if (out.length >= 3) break; push(clean(a?.text)); }
  for (const c of map.main_claims ?? []) { if (out.length >= 3) break; push(clean(c?.text)); }
  return out;
}

// ---------------------------------------------------------------------------
// Normalizers (defensive: LLM output may omit fields or invent unit_ids).
// ---------------------------------------------------------------------------

function normalizeProfile(raw: unknown, ctx: UserReviewContext): DocumentProfile {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown, fb: string) => (typeof v === 'string' && v ? v : fb);
  return {
    document_type: str(p['document_type'], 'unknown') as DocumentProfile['document_type'],
    intent: str(p['intent'], 'inform') as DocumentProfile['intent'],
    audience: (ctx.audience_hint ? 'team' : str(p['audience'], 'unknown')) as DocumentProfile['audience'],
    stakes: (['low', 'medium', 'high'].includes(String(p['stakes'])) ? p['stakes'] : 'medium') as DocumentProfile['stakes'],
    artifact_maturity: str(p['artifact_maturity'], 'working_draft') as DocumentProfile['artifact_maturity'],
    source_confidence: clamp01(Number(p['source_confidence'] ?? 0.5)),
    inferred: {
      document_type: true,
      intent: true,
      audience: !ctx.audience_hint,
      stakes: true,
    },
  };
}

function normalizeMap(raw: Record<string, unknown>, resolve: (ids: unknown) => SourceAnchor[], lang: ReviewLocale): DocumentJudgmentMap {
  const arr = (v: unknown): Record<string, unknown>[] =>
    Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : [];
  const s = (v: unknown, fb = ''): string => (typeof v === 'string' ? v : fb);

  // Build claims first (positional, no filter yet) so the argument's dependency
  // links can be resolved: the model references claims by their 1-based order
  // ("C1" = the first main_claim), which we map to the real claim_id. Empty
  // links stay undefined — we never manufacture a dependency the model omitted.
  const rawClaims = arr(raw['main_claims']);
  const builtClaims: Claim[] = rawClaims.map((c) => ({
    claim_id: stableId('claim', s(c['text'])),
    text: scrubIds(s(c['text']), lang),
    status: (['supported', 'weak', 'unsupported', 'human_check', 'contradicted'].includes(String(c['status']))
      ? c['status']
      : 'weak') as Claim['status'],
    anchors: resolve(c['unit_ids']),
    rationale: scrubIds(s(c['rationale']), lang),
    evidence_needed: s(c['evidence_needed']) ? scrubIds(s(c['evidence_needed']), lang) : undefined,
    fix_suggestion: s(c['fix_suggestion']) ? scrubIds(s(c['fix_suggestion']), lang) : undefined,
  }));
  const resolveClaimRefs = (refs: unknown): string[] => {
    if (!Array.isArray(refs)) return [];
    const out: string[] = [];
    for (const r of refs) {
      const m = /^[Cc]?(\d+)$/.exec(String(r).trim());
      if (!m) continue;
      const hit = builtClaims[parseInt(m[1], 10) - 1];
      if (hit && hit.text) out.push(hit.claim_id);
    }
    return [...new Set(out)];
  };
  builtClaims.forEach((c, i) => {
    const deps = resolveClaimRefs(rawClaims[i]['depends_on_claim_ids']).filter((id) => id !== c.claim_id);
    if (deps.length) c.depends_on_claim_ids = deps;
  });
  const mainClaims = builtClaims.filter((c) => c.text);
  const evidenceItems = arr(raw['evidence_items']).map((e) => ({
    evidence_id: stableId('ev', s(e['text'])),
    text: s(e['text']),
    anchors: resolve(e['unit_ids']),
    supports_claim_ids: resolveClaimRefs(e['supports_claim_ids']),
    kind: (['internal', 'external_cited', 'asserted'].includes(String(e['kind'])) ? e['kind'] : 'asserted') as 'internal' | 'external_cited' | 'asserted',
  })).filter((e) => e.text);

  return {
    core_question: s(raw['core_question']),
    explicit_recommendation: s(raw['explicit_recommendation']) || undefined,
    implicit_recommendation: s(raw['implicit_recommendation']) || undefined,
    main_claims: mainClaims,
    evidence_items: evidenceItems,
    assumptions: arr(raw['assumptions']).map((a) => ({
      assumption_id: stableId('asm', s(a['text'])),
      text: scrubIds(s(a['text']), lang),
      anchors: resolve(a['unit_ids']),
      if_false: scrubIds(s(a['if_false']), lang),
    })).filter((a) => a.text),
    tradeoffs: arr(raw['tradeoffs']).map((t) => ({
      tradeoff_id: stableId('to', s(t['text'])),
      text: s(t['text']),
      anchors: resolve(t['unit_ids']),
    })).filter((t) => t.text),
    stakeholders: arr(raw['stakeholders']).map((st) => ({
      role: s(st['role']),
      likely_objection: s(st['likely_objection']),
      anchors: resolve(st['unit_ids']),
    })).filter((st) => st.role),
    open_questions: arr(raw['open_questions']).map((o) => ({ text: s(o['text']), anchors: resolve(o['unit_ids']) })).filter((o) => o.text),
    decision_points: arr(raw['decision_points']).map((d) => ({
      text: s(d['text']),
      human_only: d['human_only'] !== false,
      anchors: resolve(d['unit_ids']),
    })).filter((d) => d.text),
    missing_sections: arr(raw['missing_sections']).map((m) => ({ label: s(m['label']), why_it_matters: s(m['why_it_matters']) })).filter((m) => m.label),
  };
}

function normalizeFindings(raw: unknown, lensId: LensId, resolve: (ids: unknown) => SourceAnchor[], lang: ReviewLocale): Finding[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map((f) => {
      const anchors = resolve(f['unit_ids']);
      const s = (v: unknown, fb = ''): string => (typeof v === 'string' ? v : fb);
      // Invariant: no anchor → cannot be high confidence.
      let confidence = (['low', 'medium', 'high'].includes(String(f['confidence'])) ? f['confidence'] : 'medium') as Finding['confidence'];
      if (anchors.length === 0 && confidence === 'high') confidence = 'low';
      return {
        finding_id: stableId('find', lensId, s(f['title'])),
        lens_id: lensId,
        title: scrubIds(s(f['title']), lang),
        detail: scrubIds(s(f['detail']), lang),
        severity: (['minor', 'caution', 'critical'].includes(String(f['severity'])) ? f['severity'] : 'caution') as Finding['severity'],
        confidence,
        suggested_action: s(f['suggested_action']) ? scrubIds(s(f['suggested_action']), lang) : undefined,
        anchors,
        provenance: 'ai_surfaced' as const,
      };
    })
    .filter((f) => f.title);
}

/**
 * Last-resort backfill for when the model returned zero explicit findings but
 * its judgment map already carries HARD defect verdicts. We surface only the
 * map's own strong signals — a claim the model itself marked `contradicted` or
 * `unsupported`, or an assumption whose stated `if_false` names a real
 * consequence. We never manufacture a generic "근거가 충분하지 않음" finding for a
 * merely `weak` claim: that is fabrication (CLAUDE.md — honest gap over
 * fabrication), and it was the exact source of the repeated "…근거 부족" the
 * receipt showed when the real findings had been truncated away by the token cap.
 */
function supplementQuickFindings(findings: Finding[], map: DocumentJudgmentMap, lang: ReviewLocale): Finding[] {
  const t = (ko: string, en: string) => (lang === 'en' ? en : ko);
  const out = [...findings];
  const alreadyCovered = (text: string) => {
    const needle = text.trim().slice(0, 24);
    return needle.length > 0 && out.some((f) => `${f.title} ${f.detail}`.includes(needle));
  };

  for (const claim of map.main_claims) {
    if (out.length >= 2) break;
    // Only the model's own hard verdicts — a `weak` or `human_check` claim is
    // not a defect we may assert on the user's behalf.
    if (claim.status !== 'contradicted' && claim.status !== 'unsupported') continue;
    if (claim.anchors.length === 0 || alreadyCovered(claim.text)) continue;
    const contradicted = claim.status === 'contradicted';
    out.push({
      finding_id: stableId('find', 'claim_evidence', claim.claim_id),
      lens_id: 'claim_evidence',
      title: contradicted
        ? t(`“${claim.text}” 주장이 문서의 다른 서술과 충돌`, `The claim “${claim.text}” conflicts with another statement in the document`)
        : t(`“${claim.text}” 주장을 뒷받침하는 근거가 문서에 없음`, `No evidence in the document supports the claim “${claim.text}”`),
      detail: claim.rationale || (contradicted
        ? t('문서 안의 다른 서술과 이 주장이 어긋납니다.', 'This claim contradicts another statement in the document.')
        : t('이 주장을 뒷받침하는 근거가 문서 안에서 확인되지 않습니다.', 'No supporting evidence for this claim was found within the document.')),
      severity: 'critical',
      confidence: 'medium',
      suggested_action: claim.evidence_needed || claim.fix_suggestion,
      anchors: claim.anchors,
      provenance: 'ai_surfaced',
    });
  }

  for (const assumption of map.assumptions) {
    if (out.length >= 2) break;
    // Surface an assumption only when the model named a concrete consequence of
    // its being false; a bare "unverified assumption" is noise, not a finding.
    if (!assumption.if_false || assumption.anchors.length === 0 || alreadyCovered(assumption.text)) continue;
    out.push({
      finding_id: stableId('find', 'hidden_assumption', assumption.assumption_id),
      lens_id: 'hidden_assumption',
      title: t(`검증되지 않은 가정: ${assumption.text}`, `Untested assumption: ${assumption.text}`),
      detail: t(`이 가정이 틀리면 ${assumption.if_false}`, `If this assumption is wrong, ${assumption.if_false}`),
      severity: 'caution',
      confidence: 'medium',
      suggested_action: t('이 가정을 확인할 근거와 통과·실패 조건을 명시하세요.', 'Specify the evidence and the pass/fail conditions that would confirm this assumption.'),
      anchors: assumption.anchors,
      provenance: 'ai_surfaced',
    });
  }

  return out.slice(0, 5);
}

function normalizeObligations(raw: unknown, resolve: (ids: unknown) => SourceAnchor[], lang: ReviewLocale): JudgmentObligation[] {
  if (!Array.isArray(raw)) return [];
  const s = (v: unknown, fb = ''): string => (typeof v === 'string' ? v : fb);
  return raw
    .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
    .map((o) => ({
      obligation_id: stableId('obl', s(o['statement'])),
      statement: scrubIds(s(o['statement']), lang),
      owner: s(o['owner'], lang === 'en' ? 'You' : '사용자'),
      why_human: scrubIds(s(o['why_human']), lang),
      decision_needed_by: s(o['decision_needed_by']) || undefined,
      evidence_needed: s(o['evidence_needed']) ? scrubIds(s(o['evidence_needed']), lang) : undefined,
      anchors: resolve(o['unit_ids']),
      owned_by_user: false,
    }))
    .filter((o) => o.statement);
}

function normalizeFollowups(raw: unknown, today: string): FalsifiableFollowup[] {
  if (!Array.isArray(raw)) return [];
  const s = (v: unknown, fb = ''): string => (typeof v === 'string' ? v : fb);
  return raw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
    .map((f) => {
      let checkBy = s(f['check_by']);
      // Must be a *real* future calendar date — the regex alone would pass
      // "2026-13-45", so parse and verify, else fall back to today+14d.
      if (!isRealFutureDate(checkBy, today)) checkBy = addDays(today, 14);
      return {
        followup_id: stableId('fu', s(f['predicate'])),
        predicate: s(f['predicate']),
        predicate_owner: 'ai_surfaced' as const, // user confirms/edits on seal
        pass_condition: s(f['pass_condition']),
        fail_condition: s(f['fail_condition']),
        check_by: checkBy,
      };
    })
    .filter((f) => f.predicate)
    .slice(0, 3);
}

// ---------------------------------------------------------------------------
// Assembly + summaries
// ---------------------------------------------------------------------------

function assembleReceipt(args: {
  artifact: CanonicalArtifact;
  profile: DocumentProfile;
  reviewability: NonNullable<JudgmentReceipt['reviewability']>;
  routing: NonNullable<JudgmentReceipt['routing']>;
  map: DocumentJudgmentMap;
  findings: Finding[];
  obligations: JudgmentObligation[];
  followups: FalsifiableFollowup[];
  currentHeading: string;
  coverage: JudgmentReceipt['coverage'];
  rootMode: 'create' | 'review';
  today: string;
  llm: ReviewLLM;
  promptHash: string;
}): JudgmentReceipt {
  const { artifact, profile, map, findings, llm } = args;
  const now = new Date().toISOString();

  const lensVersions: Record<string, string> = {};
  for (const id of args.routing.selected) lensVersions[id] = LENSES[id].version;

  const provenance: ReviewProvenance = {
    schema_version: REVIEW_SCHEMA_VERSION,
    extraction_tool: 'argus-review-ingest',
    extraction_version: '1',
    lens_versions: lensVersions,
    model_provider: llm.model_provider,
    model_name: llm.model_name,
    prompt_hash: args.promptHash,
    created_at: now,
  };

  return {
    receipt_id: stableId('rcpt', artifact.artifact_id, args.today),
    root_mode: args.rootMode,
    // A completed analysis is 'reviewed' even when it found nothing wrong —
    // "no issues" ≠ "not reviewed". The insufficient-reviewability path
    // overrides this back to 'draft' after assembly.
    state: 'reviewed',
    coverage: args.coverage,
    artifact_id: artifact.artifact_id,
    source_kind: artifact.source_kind,
    source_title: artifact.source_title,
    source_fingerprint: artifact.source_fingerprint,
    profile,
    reviewability: args.reviewability,
    routing: args.routing,
    core_question: map.core_question,
    judgment_obligations: dropObligationsCoveredByFindings(args.obligations, rankFindings(findings)),
    claim_ledger: map.main_claims,
    hidden_assumptions: map.assumptions,
    forks: [], // MVP: only real alternatives; surfaced later, never manufactured
    findings: diversifyByAnchor(rankFindings(findings)),
    current_heading: args.currentHeading,
    falsifiable_followups: args.followups,
    companion_thread: [],
    provenance,
    created_at: now,
    updated_at: now,
  };
}

const SEVERITY_RANK: Record<Finding['severity'], number> = { critical: 0, caution: 1, minor: 2 };
const CONF_RANK: Record<Finding['confidence'], number> = { high: 0, medium: 1, low: 2 };

function rankFindings(findings: Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
      CONF_RANK[a.confidence] - CONF_RANK[b.confidence] ||
      b.anchors.length - a.anchors.length,
  );
}

/**
 * Reorder ranked findings so the VISIBLE top spans the document instead of one
 * dense section flooding it. A rich deck can genuinely carry five distinct but
 * related issues on one slide (the Series-A deck's financials); dedup keeps them
 * (they aren't restatements) but the receipt should still lead with breadth.
 * Keeps at most `perAnchor` findings per primary anchor in the head, appends the
 * overflow in rank order — every finding survives, only the order changes, so
 * the scannable top-3 reads across the document, not one slide five times.
 */
function diversifyByAnchor(ranked: Finding[], perAnchor = 2): Finding[] {
  const count = new Map<string, number>();
  const head: Finding[] = [];
  const tail: Finding[] = [];
  for (const f of ranked) {
    const k = f.anchors[0] ? anchorKey(f.anchors[0]) : '';
    const n = count.get(k) ?? 0;
    if (!k || n < perAnchor) { head.push(f); count.set(k, n + 1); }
    else tail.push(f);
  }
  return [...head, ...tail];
}

// ---------------------------------------------------------------------------
// Reduce helpers (map-reduce path): merge chunk maps + de-dup findings.
// ---------------------------------------------------------------------------

/** Normalize a user-facing string for near-duplicate comparison (case/space/
 *  punctuation-insensitive, leading 40 chars). */
function dedupKey(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 40);
}

/** A stable key for "the same place in the source". */
function anchorKey(a: SourceAnchor): string {
  if (a.slide !== undefined) return `s${a.slide}`;
  if (a.page !== undefined) return `p${a.page}`;
  if (a.section_path?.length) return `sec:${a.section_path.join('/')}`;
  if (a.line_start !== undefined) return `l${a.line_start}`;
  return '';
}

function unionAnchors(a: SourceAnchor[], b: SourceAnchor[]): SourceAnchor[] {
  const seen = new Set(a.map(anchorKey).filter(Boolean));
  const out = [...a];
  for (const x of b) {
    const k = anchorKey(x);
    if (k && !seen.has(k)) { seen.add(k); out.push(x); }
  }
  return out;
}

/** Content words (≥2 chars) for a loose topical-overlap check. */
function contentTokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length >= 2),
  );
}

/** Character bigrams over the letters/digits of a string — a similarity signal
 *  that survives Korean agglutination. Whitespace word tokens treat "런웨이와",
 *  "런웨이를", "런웨이" as three different words, so two findings about the SAME
 *  issue score low on word overlap; their bigrams (런웨/웨이/…) still match. */
function charBigrams(s: string): Set<string> {
  const c = s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const out = new Set<string>();
  for (let i = 0; i < c.length - 1; i++) out.add(c.slice(i, i + 2));
  return out;
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / Math.min(a.size, b.size);
}

/** Back-compat alias — word-token overlap (used by the obligation dedup). */
function tokenOverlap(a: Set<string>, b: Set<string>): number {
  return overlap(a, b);
}

/** How much two findings say the same thing — the max of word-token overlap and
 *  character-bigram overlap, so it catches both English restatements and Korean
 *  morphological variants of one issue. */
function findingTextSim(a: string, b: string): number {
  return Math.max(
    overlap(contentTokens(a), contentTokens(b)),
    overlap(charBigrams(a), charBigrams(b)),
  );
}

/**
 * Drop an obligation that merely restates a finding. The `human_judgment` lens
 * and the synthesis obligations both draw on `decision_points`, so the same
 * issue used to appear twice (once as a Finding, once as an Obligation). Kept
 * conservative — an obligation is only removed when it shares a source anchor
 * with a finding AND overlaps it heavily in words, so distinct decisions stay.
 */
function dropObligationsCoveredByFindings(
  obligations: JudgmentObligation[],
  findings: Finding[],
): JudgmentObligation[] {
  if (!findings.length) return obligations;
  const findingAnchors = findings.map((f) => new Set(f.anchors.map(anchorKey).filter(Boolean)));
  const findingTokens = findings.map((f) => contentTokens(`${f.title} ${f.detail}`));
  return obligations.filter((o) => {
    const oTokens = contentTokens(o.statement);
    const oAnchors = new Set(o.anchors.map(anchorKey).filter(Boolean));
    const isRestatement = findings.some((_, i) => {
      const shareAnchor = [...oAnchors].some((k) => findingAnchors[i].has(k));
      return shareAnchor && tokenOverlap(oTokens, findingTokens[i]) >= 0.5;
    });
    return !isRestatement;
  });
}

/** Collapse items that repeat the same text across chunks, keeping the first and
 *  merging (e.g. unioning anchors) each later duplicate into it. */
function dedupeByText<T>(items: T[], key: (t: T) => string, merge: (kept: T, dup: T) => T): T[] {
  const byKey = new Map<string, number>();
  const out: T[] = [];
  for (const it of items) {
    const k = dedupKey(key(it));
    if (!k) { out.push(it); continue; }
    const idx = byKey.get(k);
    if (idx === undefined) { byKey.set(k, out.length); out.push(it); }
    else out[idx] = merge(out[idx], it);
  }
  return out;
}

/** Merge many chunk maps into one document map, de-duplicating repeated
 *  claims/assumptions/etc. A claim restated in intro + conclusion collapses to
 *  one row (union of anchors); claim_ids are stable text hashes, so any C#
 *  dependency links survive concatenation. */
function mergeMaps(maps: DocumentJudgmentMap[]): DocumentJudgmentMap {
  const withAnchors = <T extends { anchors: SourceAnchor[] }>(a: T, b: T): T => ({ ...a, anchors: unionAnchors(a.anchors, b.anchors) });
  let core = '';
  let explicit: string | undefined;
  let implicit: string | undefined;
  for (const m of maps) {
    if (m.core_question && m.core_question.length > core.length) core = m.core_question;
    explicit = explicit || m.explicit_recommendation;
    implicit = implicit || m.implicit_recommendation;
  }
  return {
    core_question: core,
    explicit_recommendation: explicit,
    implicit_recommendation: implicit,
    main_claims: dedupeByText(maps.flatMap((m) => m.main_claims), (c) => c.text, withAnchors),
    evidence_items: dedupeByText(maps.flatMap((m) => m.evidence_items), (e) => e.text, withAnchors),
    assumptions: dedupeByText(maps.flatMap((m) => m.assumptions), (a) => a.text, withAnchors),
    tradeoffs: dedupeByText(maps.flatMap((m) => m.tradeoffs), (t) => t.text, withAnchors),
    stakeholders: dedupeByText(maps.flatMap((m) => m.stakeholders), (s) => `${s.role} ${s.likely_objection}`, withAnchors),
    open_questions: dedupeByText(maps.flatMap((m) => m.open_questions), (o) => o.text, withAnchors),
    decision_points: dedupeByText(maps.flatMap((m) => m.decision_points), (d) => d.text, withAnchors),
    missing_sections: dedupeByText(maps.flatMap((m) => m.missing_sections), (x) => x.label, (a) => a),
  };
}

/** Collapse near-duplicate findings that repeat one issue — same normalized
 *  title, an overlapping anchor plus a shared title stem, OR (the parallel-lens
 *  case) an overlapping anchor plus heavy content-word overlap on title+detail.
 *  The last branch is what collapses the SAME issue surfaced from five different
 *  lenses under five different titles ("런웨이 18 vs BEP 24" from claim_evidence,
 *  core_question, hidden_assumption, human_judgment, falsifiable_followup) into
 *  one row — the reduce step's title-stem check alone could not, because each
 *  lens rewords the headline. Keeps the strongest severity/confidence, lets the
 *  sharpest (most severe) framing's text win, and unions anchors. */
function dedupeFindings(findings: Finding[]): Finding[] {
  const out: Finding[] = [];
  const outText: string[] = [];
  for (const f of findings) {
    const key = dedupKey(f.title);
    const fAnchors = new Set(f.anchors.map(anchorKey).filter(Boolean));
    const fText = `${f.title} ${f.detail}`;
    const idx = out.findIndex((g, i) => {
      const gk = dedupKey(g.title);
      if (key && gk === key) return true;
      const shareAnchor = g.anchors.some((a) => fAnchors.has(anchorKey(a)));
      if (!shareAnchor) return false;
      const stemHit = key.length >= 8 && (gk.startsWith(key.slice(0, 8)) || key.startsWith(gk.slice(0, 8)));
      // Shared anchor is the safety net (distinct issues on the same slide have
      // low text overlap); 0.42 catches the same issue reworded across lenses.
      return stemHit || findingTextSim(fText, outText[i]) >= 0.42;
    });
    if (idx === -1) { out.push(f); outText.push(fText); continue; }
    const hit = out[idx];
    // The more severe framing wins the visible text (anchors merge regardless),
    // so the surviving row reads as the sharpest statement of the shared issue.
    if (SEVERITY_RANK[f.severity] < SEVERITY_RANK[hit.severity]) {
      hit.title = f.title;
      hit.detail = f.detail;
      hit.lens_id = f.lens_id;
      hit.severity = f.severity;
      outText[idx] = `${hit.title} ${hit.detail}`;
    }
    if (CONF_RANK[f.confidence] < CONF_RANK[hit.confidence]) hit.confidence = f.confidence;
    hit.anchors = unionAnchors(hit.anchors, f.anchors);
    if (!hit.suggested_action && f.suggested_action) hit.suggested_action = f.suggested_action;
  }
  return out;
}

function summarizeMap(map: DocumentJudgmentMap): string {
  const lines: string[] = [`핵심 질문: ${map.core_question}`];
  if (map.main_claims.length) {
    lines.push('주장:');
    map.main_claims.slice(0, 12).forEach((c) => lines.push(`- (${c.status}) ${c.text}`));
  }
  if (map.assumptions.length) {
    lines.push('가정:');
    map.assumptions.slice(0, 8).forEach((a) => lines.push(`- ${a.text} → 틀리면: ${a.if_false}`));
  }
  if (map.decision_points.length) {
    lines.push('결정 지점:');
    map.decision_points.slice(0, 8).forEach((d) => lines.push(`- ${d.text}`));
  }
  return lines.join('\n');
}

function summarizeFindings(findings: Finding[]): string {
  if (!findings.length) return '(발견된 finding 없음)';
  return findings
    .slice(0, 20)
    .map((f) => `- [${f.severity}] (${f.lens_id}) ${f.title}${f.suggested_action ? ` → ${f.suggested_action}` : ''}`)
    .join('\n');
}

function neutralHeading(map: DocumentJudgmentMap, lang: ReviewLocale): string {
  return lang === 'en'
    ? `This document is about “${map.core_question || 'the core judgment'}”. Review the items below, then decide the direction.`
    : `이 문서는 "${map.core_question || '핵심 판단'}"을 다룹니다. 아래 항목을 확인한 뒤 방향을 정하세요.`;
}

function relevantUnits(units: ArtifactUnit[], lens: { id: LensId }, limit: number): ArtifactUnit[] {
  // MVP: pass the (budget-capped) units. A later slice can pre-select per lens.
  void lens;
  return units.slice(0, limit);
}

// ---------------------------------------------------------------------------
// Small pure utils
// ---------------------------------------------------------------------------

/**
 * Belt-and-suspenders: strip any internal unit id (u_abc123) the model leaked
 * into user-facing prose, so the receipt never shows raw identifiers. The
 * prompt already forbids this; this is the fallback. Anchors still come from the
 * unit_ids arrays, untouched.
 */
function scrubIds(s: string, lang: ReviewLocale): string {
  return s
    .replace(/\bu_[0-9a-f]{4,12}\b/gi, lang === 'en' ? 'that part' : '해당 부분')
    .replace(/\s{2,}/g, ' ')
    .replace(/\(\s*[·,]\s*/g, '(')
    .trim();
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** True only for a well-formed YYYY-MM-DD that is a real calendar date after `today`. */
function isRealFutureDate(candidate: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return false;
  const d = new Date(candidate + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return false;
  // reject rolled-over dates like 2026-13-45 → Date silently normalizes them
  if (d.toISOString().slice(0, 10) !== candidate) return false;
  return candidate > today;
}
