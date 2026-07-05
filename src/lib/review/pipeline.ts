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
  type Assumption,
  type SourceAnchor,
  type ArtifactUnit,
  type LensId,
  type ReviewProvenance,
  DEFAULT_BUDGET,
  REVIEW_SCHEMA_VERSION,
  reviewabilityBand,
} from './schema';
import { scoreReviewability } from './reviewability';
import { packUnitsForPrompt, computeCoverage } from './coverage';
import { routeLenses } from './routing';
import { LENSES, LENS_VERSION } from './lenses';
import { buildExtractionPrompt, buildLensPrompt, buildSynthesisPrompt } from './prompts';
import { defaultReviewLLM, type ReviewLLM } from './llm-adapter';
import { djb2, stableId } from './ids';

export interface RunReviewOptions {
  llm?: ReviewLLM;
  budget?: AnalysisBudget;
  context?: UserReviewContext;
  rootMode?: 'create' | 'review';
  today?: string; // YYYY-MM-DD
  onProgress?: (job: ReviewJob) => void;
  signal?: AbortSignal;
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
  const jobId = stableId('job', artifact.artifact_id, today);
  const promptParts: string[] = [];

  const emit = (status: ReviewJob['status'], label: string, extra?: Partial<ReviewJob>): ReviewJob => {
    const job: ReviewJob = { job_id: jobId, artifact_id: artifact.artifact_id, status, progress_label: label, ...extra };
    options.onProgress?.(job);
    return job;
  };

  // --- Gate 0: unsupported / empty extraction -----------------------------
  if (artifact.extraction_quality === 'unsupported' || artifact.units.length === 0) {
    const error: ReviewFailure = {
      kind: artifact.extraction_quality === 'unsupported' ? 'unsupported_format' : 'extraction_low',
      message: artifact.extraction_notes[0] ?? '이 문서는 자동 검수를 지원하지 않습니다.',
      recovery: '본문 텍스트를 붙여넣으면 검수할 수 있습니다.',
    };
    return { job: emit('needs_context', '검수 불가 — 맥락 필요', { error }) };
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
    // --- Stage 1: extraction → profile + judgment map ---------------------
    // Pack units ONCE under both the count cap and the prompt char budget, so a
    // large document degrades to "fewer units + a coverage note" instead of
    // hard-failing the server's per-message limit — and so coverage is honest.
    emit('profiling', '주장을 분석하는 중');
    const packed = packUnitsForPrompt(artifact.units, budget.max_units);
    const unitsReviewed = packed.units.length;
    const coverage = computeCoverage(artifact, unitsReviewed);
    const exPrompt = buildExtractionPrompt(packed.units, ctx, packed.units.length);
    promptParts.push(exPrompt.system);
    const raw = await llm.json<Record<string, unknown>>({
      system: exPrompt.system,
      user: exPrompt.user,
      maxTokens: Math.min(budget.max_tokens, 6000),
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
    const map = normalizeMap(raw, resolveAnchors);

    emit('mapping', '사람이 판단할 지점을 찾는 중');

    // --- Stage 2: reviewability + routing ---------------------------------
    const reviewability = scoreReviewability(artifact, map);
    const routing = routeLenses(profile, artifact, {
      concerns: ctx.concerns,
      maxLensCalls: budget.max_lens_calls,
    });
    emit('routing', '문서 유형에 맞는 검수 렌즈를 고르는 중');

    // Insufficient reviewability → produce a "what is missing" receipt, no lenses.
    if (reviewabilityBand(reviewability.score) === 'insufficient') {
      const receipt = assembleReceipt({
        artifact, profile, reviewability, routing, map,
        findings: [], obligations: [], followups: [],
        currentHeading: '이 문서는 지금 상태로는 충분히 검수하기 어렵습니다. 무엇이 빠졌는지부터 봅니다.',
        coverage,
        rootMode: options.rootMode ?? 'review', today, llm, promptHash: djb2(promptParts.join('')),
      });
      receipt.state = 'draft';
      return { job: emit('needs_context', '검수 가능성 낮음 — 부족한 맥락 표시', {}), receipt };
    }

    // --- Stage 3: lens reviews (parallel) ---------------------------------
    // This is the longest stage (N parallel model calls). Emit a completion
    // counter as each lens settles so the UI shows honest movement ("렌즈 3/7")
    // instead of a frozen bar — never a fabricated linear %.
    const lensTotal = routing.selected.length;
    let lensDone = 0;
    emit('reviewing', lensTotal > 0 ? `근거 확인 중 (렌즈 0/${lensTotal})` : '근거가 약한 곳을 확인하는 중');
    const mapSummary = summarizeMap(map);
    const lensResults = await Promise.allSettled(
      routing.selected.map(async (lensId) => {
        const lens = LENSES[lensId];
        const lp = buildLensPrompt(lens, mapSummary, relevantUnits(packed.units, lens, packed.units.length), packed.units.length);
        promptParts.push(lp.system);
        try {
          const out = await llm.json<{ findings?: unknown[] }>({
            system: lp.system,
            user: lp.user,
            maxTokens: 2000,
            model: 'default',
            signal: options.signal,
            shape: { findings: { type: 'array', default: [] } },
          });
          return normalizeFindings(out.findings, lensId, resolveAnchors);
        } finally {
          lensDone++;
          emit('reviewing', `근거 확인 중 (렌즈 ${lensDone}/${lensTotal})`);
        }
      }),
    );
    const findings: Finding[] = lensResults
      .filter((r): r is PromiseFulfilledResult<Finding[]> => r.status === 'fulfilled')
      .flatMap((r) => r.value);

    // Honesty: a lens that errored/timed out must NOT be silently counted as
    // applied. Move it out of `selected` into `skipped` so the disclosure and
    // provenance reflect what actually ran (design doc §"실패 UX / 소유권 정직성").
    const failedLenses: LensId[] = [];
    lensResults.forEach((r, i) => {
      if (r.status === 'rejected') failedLenses.push(routing.selected[i]);
    });
    if (failedLenses.length) {
      routing.selected = routing.selected.filter((id) => !failedLenses.includes(id));
      for (const id of failedLenses) routing.skipped.push({ id, reason: '검수 중 오류로 이번 결과에서 제외' });
    }

    // --- Stage 4: synthesis → receipt fields ------------------------------
    emit('synthesizing', 'Judgment Receipt를 만드는 중');
    const synPrompt = buildSynthesisPrompt(mapSummary, summarizeFindings(findings), ctx, today);
    promptParts.push(synPrompt.system);
    const syn = await llm.json<Record<string, unknown>>({
      system: synPrompt.system,
      user: synPrompt.user,
      maxTokens: 3000,
      model: 'default',
      signal: options.signal,
      shape: {
        core_question: { type: 'string', default: map.core_question },
        current_heading: { type: 'string', default: '' },
        judgment_obligations: { type: 'array', default: [] },
        followups: { type: 'array', default: [] },
      },
    });

    const obligations = normalizeObligations(syn['judgment_obligations'], resolveAnchors);
    const followups = normalizeFollowups(syn['followups'], today);
    const currentHeading = String(syn['current_heading'] || '').trim() || neutralHeading(map);
    const coreQuestion = String(syn['core_question'] || map.core_question || '').trim();

    const receipt = assembleReceipt({
      artifact, profile, reviewability, routing,
      map: { ...map, core_question: coreQuestion },
      findings, obligations, followups, currentHeading,
      coverage,
      rootMode: options.rootMode ?? 'review', today, llm, promptHash: djb2(promptParts.join('')),
    });

    return { job: emit('ready', '검수 완료'), receipt };
  } catch (err) {
    const error: ReviewFailure = {
      kind: 'model_error',
      message: err instanceof Error ? err.message : '검수 중 오류가 발생했습니다.',
      recovery: '잠시 후 다시 시도하거나, 더 짧은 문서로 나눠서 검수해 보세요.',
    };
    return { job: emit('failed', '검수 실패', { error }) };
  }
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

function normalizeMap(raw: Record<string, unknown>, resolve: (ids: unknown) => SourceAnchor[]): DocumentJudgmentMap {
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
    text: scrubIds(s(c['text'])),
    status: (['supported', 'weak', 'unsupported', 'human_check', 'contradicted'].includes(String(c['status']))
      ? c['status']
      : 'weak') as Claim['status'],
    anchors: resolve(c['unit_ids']),
    rationale: scrubIds(s(c['rationale'])),
    evidence_needed: s(c['evidence_needed']) ? scrubIds(s(c['evidence_needed'])) : undefined,
    fix_suggestion: s(c['fix_suggestion']) ? scrubIds(s(c['fix_suggestion'])) : undefined,
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
      text: scrubIds(s(a['text'])),
      anchors: resolve(a['unit_ids']),
      if_false: scrubIds(s(a['if_false'])),
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

function normalizeFindings(raw: unknown, lensId: LensId, resolve: (ids: unknown) => SourceAnchor[]): Finding[] {
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
        title: scrubIds(s(f['title'])),
        detail: scrubIds(s(f['detail'])),
        severity: (['minor', 'caution', 'critical'].includes(String(f['severity'])) ? f['severity'] : 'caution') as Finding['severity'],
        confidence,
        suggested_action: s(f['suggested_action']) ? scrubIds(s(f['suggested_action'])) : undefined,
        anchors,
        provenance: 'ai_surfaced' as const,
      };
    })
    .filter((f) => f.title);
}

function normalizeObligations(raw: unknown, resolve: (ids: unknown) => SourceAnchor[]): JudgmentObligation[] {
  if (!Array.isArray(raw)) return [];
  const s = (v: unknown, fb = ''): string => (typeof v === 'string' ? v : fb);
  return raw
    .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
    .map((o) => ({
      obligation_id: stableId('obl', s(o['statement'])),
      statement: scrubIds(s(o['statement'])),
      owner: s(o['owner'], '사용자'),
      why_human: scrubIds(s(o['why_human'])),
      decision_needed_by: s(o['decision_needed_by']) || undefined,
      evidence_needed: s(o['evidence_needed']) ? scrubIds(s(o['evidence_needed'])) : undefined,
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
  reviewability: JudgmentReceipt['reviewability'];
  routing: JudgmentReceipt['routing'];
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
    judgment_obligations: args.obligations,
    claim_ledger: map.main_claims,
    hidden_assumptions: map.assumptions,
    forks: [], // MVP: only real alternatives; surfaced later, never manufactured
    findings: rankFindings(findings),
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

function neutralHeading(map: DocumentJudgmentMap): string {
  return `이 문서는 "${map.core_question || '핵심 판단'}"을 다룹니다. 아래 항목을 확인한 뒤 방향을 정하세요.`;
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
function scrubIds(s: string): string {
  return s
    .replace(/\bu_[0-9a-f]{4,12}\b/gi, '해당 부분')
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
