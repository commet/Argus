/**
 * Argus review core — ported verbatim from the webapp's src/lib/review so the
 * MCP and the webapp share ONE ingest / anchoring / reviewability / routing /
 * prompt brain (design doc §"웹앱과 MCP는 같은 Judgment Receipt"). The only
 * difference is the `.js` import extensions NodeNext requires. A drift guard
 * (webapp review-mcp-drift.test.ts) fails CI if the two copies diverge.
 *
 * NOT ported: llm-adapter.ts + pipeline.ts. In the MCP the host agent IS the
 * model, so the tool hands it the SSOT prompts instead of calling an LLM itself.
 */

export * from './schema.js';
export { ingest, type IngestInput } from './ingest.js';
export { scoreReviewability } from './reviewability.js';
export { LENSES, getLens, ALL_LENS_IDS, LENS_VERSION } from './lenses.js';
export { routeLenses, applies } from './routing.js';
export { buildExtractionPrompt, buildLensPrompt, buildSynthesisPrompt, renderUnits } from './prompts.js';
export { receiptToMarkdown } from './render.js';
export { fingerprint, stableId, djb2 } from './ids.js';
