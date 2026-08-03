// The three influence instruments — v1.0 §9.5, with the Goodhart hardening
// from v0.7: verbatim counting uses MATERIAL edits (semantic-unit diff ratio,
// sealed threshold), the recall probe wording is a frozen constant, and
// baseline coverage is a regression-testable function.
//
// All three are diagnostics for the product pipeline. None of them is ever a
// user-facing score (zero-judgment rule 2).

import { type AdoptionMode, type CaseState } from './types';

// ---------------------------------------------------------------------------
// 1. Verbatim adoption rate — with material-edit detection
// ---------------------------------------------------------------------------

// Sealed in the measurement contract (v1.0 §9.5). An edit changing less than
// this fraction of semantic units is cosmetic: the adoption still counts as
// verbatim. Changing the threshold post-observation is an amendment, not a fix.
// (0.25 is the pre-seal placeholder; the cosmetic/material fixture pair in
// harness.test.ts is the regression anchor for whatever value gets sealed.)
export const MATERIAL_EDIT_THRESHOLD = 0.25;

// Character bigrams, spacing/punctuation-normalized. Word-level units misfire
// on agglutinative Korean (swapping a particle rewrites a third of a short
// sentence's "words"); bigrams keep a particle swap cosmetic and a real
// rewrite material. Deterministic by design — an embedding similarity would
// reintroduce a model into the measuring instrument.
const toUnits = (s: string): string[] => {
  const flat = s.toLowerCase().replace(/[\s.,;:!?"'()[\]{}~\-–—·]/g, '');
  if (flat.length <= 1) return flat ? [flat] : [];
  const grams: string[] = [];
  for (let i = 0; i < flat.length - 1; i += 1) grams.push(flat.slice(i, i + 2));
  return grams;
};

export function editMateriality(draft: string, adopted: string): number {
  const a = toUnits(draft);
  const b = toUnits(adopted);
  if (a.length === 0 && b.length === 0) return 0;
  const countA = new Map<string, number>();
  for (const u of a) countA.set(u, (countA.get(u) ?? 0) + 1);
  let shared = 0;
  const countB = new Map<string, number>();
  for (const u of b) countB.set(u, (countB.get(u) ?? 0) + 1);
  for (const [u, n] of countA) shared += Math.min(n, countB.get(u) ?? 0);
  const union = a.length + b.length - shared;
  return union === 0 ? 0 : (union - shared) / union;
}

export function isMaterialEdit(draft: string, adopted: string): boolean {
  return editMateriality(draft, adopted) >= MATERIAL_EDIT_THRESHOLD;
}

export interface AdoptionRecord {
  draftText: string;
  adoptedText: string;
  adoption: AdoptionMode;
}

// Rubber-stamp detector input: fraction of adoptions that were effectively
// verbatim (accept, or edit below the materiality threshold).
export function verbatimAdoptionRate(records: AdoptionRecord[]): number {
  const adopted = records.filter((r) => r.adoption.mode !== 'decline');
  if (adopted.length === 0) return 0;
  const verbatim = adopted.filter(
    (r) => r.adoption.mode === 'accept' || !isMaterialEdit(r.draftText, r.adoptedText),
  );
  return verbatim.length / adopted.length;
}

// ---------------------------------------------------------------------------
// 2. Blind recall probe — frozen wording
// ---------------------------------------------------------------------------

// Frozen by the measurement contract (v0.7 amendment 8). One open sentence.
// Any rephrasing — especially a leading one ("당신의 원래 생각은 X였죠?") —
// is a contract amendment, not a copy tweak. Code that composes return turns
// must use this constant, never inline prose.
export const RECALL_PROBE_WORDING = '당시 왜 그렇게 정했는지, 기억나는 대로 말씀해 주시겠어요?' as const;

export interface RecallComparison {
  probeAnswer: string;
  // Filled by human/evaluator judgment in R3 — the machine records, it does
  // not judge memory against record (that comparison needs semantics).
  materialFactsMissedByRecall: string[];
  aiProposalRememberedAsOwn: boolean; // H2 falsification signal when true
}

// ---------------------------------------------------------------------------
// 3. Baseline coverage — extraction misses are defects, absences are honest
// ---------------------------------------------------------------------------

export interface BaselineCoverageCase {
  utterance: string;
  // Ground-truth annotation from the gold corpus: did the utterance actually
  // state a lean / reasons?
  utteranceContainsLean: boolean;
  captured: CaseState['baseline'];
}

export interface BaselineCoverageReport {
  total: number;
  shouldHaveCaptured: number;
  missed: number; // utterance had a lean, capture recorded none — a defect
  coverage: number; // 1 - missed/shouldHaveCaptured
}

export function baselineCoverage(cases: BaselineCoverageCase[]): BaselineCoverageReport {
  const shouldHave = cases.filter((c) => c.utteranceContainsLean);
  const missed = shouldHave.filter(
    (c) => c.captured === undefined || c.captured === 'not_captured' || c.captured.lean === 'none_stated',
  );
  return {
    total: cases.length,
    shouldHaveCaptured: shouldHave.length,
    missed: missed.length,
    coverage: shouldHave.length === 0 ? 1 : 1 - missed.length / shouldHave.length,
  };
}
