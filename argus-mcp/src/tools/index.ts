import type { ToolModule } from './tool-types.js';
import { openDecision } from './open-decision.js';
import { seal } from './seal.js';
import { settle } from './settle.js';
import { checkIn } from './check-in.js';
import { recall } from './recall.js';
import { amend, dismiss } from './amend-dismiss.js';
import { init, config } from './init-config.js';

/** The full registered tool set. There is deliberately no verdict/grade/score tool. */
export const TOOLS: ToolModule[] = [openDecision, seal, settle, checkIn, recall, amend, dismiss, init, config];

export const TOOL_MAP: Map<string, ToolModule> = new Map(TOOLS.map((t) => [t.name, t]));
