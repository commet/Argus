/**
 * Browser-safe façade over the one Decision Knowledge Kernel implementation.
 *
 * The MCP package owns the semantic model. Web, Telegram, and plugin adapters
 * import this façade instead of keeping their own outcome enums or reducers.
 * Deliberately do not export the filesystem-backed MCP store from here.
 */
export {
  fold,
  foldAsOf,
  guardAppend,
  guardAppendBatch,
  projectJudgment,
} from '../../argus-mcp/dist/v3/reducer.js';

export {
  SemanticEventSchema,
} from '../../argus-mcp/dist/v3/types.js';

// The runtime always uses the built artifact above. These erased imports only
// retain the precise source declarations for web TypeScript consumers.
export type { JudgmentProjection, SemanticState } from '../../argus-mcp/src/v3/reducer.js';
export type { Resolution, SemanticEvent, SemanticEventName } from '../../argus-mcp/src/v3/types.js';
