import type { ToolModule } from './tool-types.js';
import { openDecision } from './open-decision.js';
import { seal } from './seal.js';
import { settle } from './settle.js';
import { checkIn } from './check-in.js';
import { recall } from './recall.js';
import { amend, dismiss } from './amend-dismiss.js';
import { init, config } from './init-config.js';
import { review } from './review.js';
import { sync } from './sync.js';
import { premises } from './premises.js';
import { recheck } from './recheck.js';
import { watch } from './watch.js';
import { candidates } from './candidates.js';
import { decide, history, settings, publicReview, publicSeal, publicCheckIn, publicSettle, publicCopy } from './public-tools.js';
import { toolJsonSchema } from './tool-types.js';
import { bilingualToolPresentation } from '../lib/tool-presentation.js';

/** The full registered tool set. There is deliberately no verdict/grade/score tool. */
export const TOOLS: ToolModule[] = [openDecision, review, premises, seal, recheck, settle, checkIn, recall, sync, amend, dismiss, candidates, watch, init, config];

/** The small, purpose-led surface returned by tools/list. Legacy tools stay in
 * TOOL_MAP for cached clients and one-version compatibility, but new users and
 * models no longer have to choose among internal state-machine parts. */
export const PUBLIC_TOOLS: ToolModule[] = [decide, publicReview, publicSeal, publicCheckIn, publicSettle, history, settings];

export const TOOL_MAP: Map<string, ToolModule> = new Map([...TOOLS, ...PUBLIC_TOOLS].map((t) => [t.name, t]));

/**
 * The exact tool descriptors returned by tools/list — single source shared by
 * the server and the host-surface guard test. inputSchema runs through
 * publicCopy so that a legacy tool name embedded in a Zod field description
 * (e.g. seal's "no prior argus_open_decision is needed") is rewritten to the
 * public name before it reaches a host. Without this, the tool-call RESULTS are
 * translated but the tool SCHEMAS still leaked the old vocabulary.
 */
export function servedPublicTools(): Record<string, unknown>[] {
  return PUBLIC_TOOLS.map((t) => {
    const presentation = bilingualToolPresentation(t.name, t.annotations?.title, t.description);
    return {
      name: t.name,
      title: presentation.title,
      description: publicCopy(presentation.description),
      inputSchema: publicCopy(toolJsonSchema(t.inputSchema)),
      ...(t.outputSchema ? { outputSchema: t.outputSchema } : {}),
      ...(t.annotations ? { annotations: t.annotations } : {}),
    };
  });
}
