import { BIND_DISCIPLINE, SETTLE_DISCIPLINE, REFRAME_DISCIPLINE } from './lib/discipline.js';
import { resolveArgusDirForResource } from './lib/argus-dir.js';
import { resolveToday } from './lib/resolve-today.js';
import { replayLedger, bearingContracts } from './lib/ledger-replay.js';

/**
 * MCP Prompts (blueprint §4.2). The discipline shipped as user-triggered
 * rituals instead of a pasted system prompt. /argus-settle reads the due
 * contracts at GetPrompt time and bakes them into the message so the model
 * settles against the real ledger.
 */
export const PROMPTS = [
  { name: 'argus-bind', title: 'Argus: bind a decision', description: 'Run the fire-gate → one neutral question → seal a falsifiable bet ritual.', arguments: [{ name: 'decision', description: 'The decision you are facing.', required: false }] },
  { name: 'argus-settle', title: 'Argus: settle against reality', description: 'Check decisions whose check-by date has arrived against what actually happened.', arguments: [] },
  { name: 'argus-reframe', title: 'Argus: reframe the question', description: 'Surface the hidden assumptions in your question before you ask the AI.', arguments: [{ name: 'question', description: 'The question or problem to sharpen.', required: false }] },
] as const;

export function listPrompts() {
  return { prompts: PROMPTS.map((p) => ({ name: p.name, title: p.title, description: p.description, arguments: p.arguments })) };
}

function userText(text: string) {
  return { role: 'user' as const, content: { type: 'text' as const, text } };
}

export function getPrompt(name: string, args: Record<string, string> | undefined): { description: string; messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }> } {
  if (name === 'argus-bind') {
    const decision = args?.['decision'];
    return {
      description: 'Argus bind ritual',
      messages: [userText(BIND_DISCIPLINE + (decision ? `\n\nThe decision: ${decision}` : ''))],
    };
  }

  if (name === 'argus-reframe') {
    const question = args?.['question'];
    return {
      description: 'Argus reframe lens',
      messages: [userText(REFRAME_DISCIPLINE + (question ? `\n\nThe question: ${question}` : ''))],
    };
  }

  if (name === 'argus-settle') {
    const dir = resolveArgusDirForResource();
    let context = '';
    if (dir) {
      const today = resolveToday({});
      const l = replayLedger(dir, today);
      const seeds = bearingContracts(dir, today, l);
      const due = [
        ...l.overdue.map((c) => ({ id: c.id, predicate: c.text, check_by: c.date })),
        ...seeds.filter((s) => !l.contracts.has(s.id)).map((s) => ({ id: s.id, predicate: s.predicate, check_by: s.check_by })),
      ];
      context = due.length
        ? '\n\nDue now:\n' + due.map((d) => `- [${d.id}] "${d.predicate}" (check-by ${d.check_by})`).join('\n')
        : '\n\nNothing is due right now.';
    }
    return { description: 'Argus settle ritual', messages: [userText(SETTLE_DISCIPLINE + context)] };
  }

  return { description: 'unknown prompt', messages: [userText(`Unknown prompt: ${name}`)] };
}
