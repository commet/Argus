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

/** The full registered tool set. There is deliberately no verdict/grade/score tool. */
export const TOOLS: ToolModule[] = [openDecision, review, premises, seal, recheck, settle, checkIn, recall, sync, amend, dismiss, watch, init, config];

export const TOOL_MAP: Map<string, ToolModule> = new Map(TOOLS.map((t) => [t.name, t]));
