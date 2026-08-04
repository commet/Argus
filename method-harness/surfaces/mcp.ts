// MCP surface — the SECOND surface (v1.0 §11.2): ambient, inside the user's
// working tools. Two characters define it:
//
//  1. THE STRICTEST FIRE-GATE (§4.6). MCP context is unsolicited by default —
//     the gate runs BEFORE any form, and a flat context produces silence with
//     a machine-readable reason, not a manufactured intervention.
//  2. PROPOSALS ONLY. A host's "approve" is not a user act (§11.2): this
//     adapter cannot adopt. It emits candidate patches carrying instructions
//     for where real adoption happens.

import { projectCard, semanticCore } from '../projection';
import { userPulledRecommendation, Ledger } from '../ledger';
import { foldCase } from '../reducer';
import { type CaseState, type DecisionCardDraft } from '../types';

export interface McpContext {
  caseId?: string; // an existing open case the host references, if any
  hostUtterance: string; // what the user just said inside the host tool
  userInvokedArgus: boolean; // explicit invocation (slash command / mention)
}

export type FireDecision =
  | { fire: true; reason: 'user_invoked' | 'open_case_referenced' | 'explicit_decision_ask' }
  | { fire: false; reason: 'flat_context' | 'no_open_decision' | 'closed_decision' };

// Signals that the user is actually opening a decision, not just working.
// The gold-eval battery caught the first version missing "~할까 해" (the
// thinking-of-doing opener, gc03) — widened, with an explicit flatness
// suppressor so gc02-style "딱히 상관없어" still gets restraint. Flatness
// beats opening: a stated don't-care is the user answering the fire-gate.
const DECISION_ASK_PATTERNS = [/할까\s*말까/, /해야\s*할까/, /[할일]까(\s*해|\s*하는|\s*싶|요)?[.\s]|[할일]까$/, /고민/, /결정/, /정해야/, /[을를지]\s*정할/, /어떻게\s*하지/, /선택/, /갈림길/, /should\s+(i|we)\b/i, /deciding\s+(between|whether)/i, /torn\s+between/i];
const FLATNESS_PATTERNS = [/상관없/, /딱히/, /아무래도\s*좋/, /either\s+way/i, /doesn.t\s+really\s+matter/i];
const CLOSED_PATTERNS = [/이미\s*(결정|정)했/, /끝난\s*일/, /already\s+decided/i, /signed/i];

export function fireGate(ledger: Ledger, ctx: McpContext): FireDecision {
  if (ctx.userInvokedArgus) return { fire: true, reason: 'user_invoked' };
  if (CLOSED_PATTERNS.some((p) => p.test(ctx.hostUtterance))) return { fire: false, reason: 'closed_decision' };
  if (FLATNESS_PATTERNS.some((p) => p.test(ctx.hostUtterance))) return { fire: false, reason: 'flat_context' };
  if (ctx.caseId) {
    const state = foldCase(ledger, ctx.caseId);
    if (state.state !== 'REVIEWED' && state.state !== 'STOPPED') {
      return { fire: true, reason: 'open_case_referenced' };
    }
  }
  if (DECISION_ASK_PATTERNS.some((p) => p.test(ctx.hostUtterance))) {
    return { fire: true, reason: 'explicit_decision_ask' };
  }
  // Restraint is the ambient default (§4.6): no decision opened, no fire.
  return { fire: false, reason: ctx.caseId ? 'no_open_decision' : 'flat_context' };
}

export interface McpResponse {
  kind: 'silent' | 'restore' | 'proposal';
  text?: string;
  silenceReason?: FireDecision['reason'];
  // Candidate patch: NEVER adopted here. The instruction names where the real
  // user act happens (web adoption UI, or an explicit MCP user command).
  candidatePatch?: { draft: DecisionCardDraft; adoptionInstruction: string };
  pulled?: boolean; // ledger-verified — feeds the initiative hierarchy upstream
}

export function handleMcp(ledger: Ledger, ctx: McpContext): McpResponse {
  const gate = fireGate(ledger, ctx);
  if (!gate.fire) {
    return { kind: 'silent', silenceReason: gate.reason };
  }
  if (ctx.caseId) {
    const state = foldCase(ledger, ctx.caseId);
    if (state.card) {
      // Continuity (§11.3): the web-adopted decision restores as the SAME
      // decision — compact rendering, identical semantic core.
      return {
        kind: 'restore',
        text: projectCard(state, 'mcp').text,
        pulled: userPulledRecommendation(ledger, ctx.caseId),
      };
    }
  }
  return {
    kind: 'proposal',
    text: '결정이 열려 있습니다 — 후보를 제안할 수 있습니다.',
    pulled: ctx.caseId ? userPulledRecommendation(ledger, ctx.caseId) : false,
  };
}

// The adoption path that must NOT exist gets a loud tombstone instead of a
// silent absence, so a future refactor cannot quietly add it.
export function adoptViaHost(): never {
  throw new Error(
    'MCP_CANNOT_ADOPT: a host "approve" is not a user act (v1.0 §11.2). Return a candidate patch; adoption happens on the web surface or via an explicit user command that appends a user-authored adoption event.',
  );
}

export function parityCore(ledger: Ledger, caseId: string): ReturnType<typeof semanticCore> {
  return semanticCore(foldCase(ledger, caseId));
}

export type { CaseState };
