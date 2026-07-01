/**
 * Argus Document Judgment Review — public module surface.
 * Import from '@/lib/review' rather than reaching into individual files.
 */

export * from './schema';
export { ingest, type IngestInput } from './ingest';
export { scoreReviewability } from './reviewability';
export { LENSES, getLens, ALL_LENS_IDS, LENS_VERSION } from './lenses';
export { routeLenses, applies } from './routing';
export { runDocumentReview, type RunReviewOptions, type ReviewResult } from './pipeline';
export { defaultReviewLLM, type ReviewLLM, type ReviewLLMArgs } from './llm-adapter';
export { receiptToMarkdown } from './render';
export {
  summarizeReceipt,
  sortByUrgency,
  daysBetween,
  type ReceiptStatus,
  type DerivedStatus,
} from './status';
export { fingerprint, stableId, djb2 } from './ids';
