import { atomicWriteJson } from '../lib/atomic-write.js';
import { bearingPath } from '../lib/layout.js';
import { requireArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { guardTransition } from '../lib/state-machine.js';
import { validateSeal } from '../lib/validate-seal.js';
import { appendLedger } from '../lib/ledger-append.js';
import { SCHEMA_VERSION } from '../lib/spine.js';
import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zId, zDate, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

export const amend: ToolModule = {
  name: 'argus_amend',
  description:
    'Adjust an open or not-yet-due sealed decision\'s predicate or check-by date. Refused once the check-by date has arrived (no moving the goalpost after the fact).',
  inputSchema: z.strictObject({
    argus_dir: zArgusDir,
    id: zId,
    predicate: z.string().min(8).max(400).optional(),
    check_by: zDate.optional(),
    today_override: zDate.optional(),
  }),
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = requireArgusDir(a['argus_dir']);
      const id = String(a['id'] ?? '');
      const today = resolveToday({ override: a['today_override'] as string | undefined });
      const current = resolveContract(dir, id, today);
      guardTransition(current.state, 'amend'); // GOALPOST_MOVED / DECISION_CLOSED / ILLEGAL_TRANSITION

      const predicate = (a['predicate'] as string | undefined) ?? current.predicate;
      const checkBy = (a['check_by'] as string | undefined) ?? current.check_by;
      if (a['check_by'] != null || a['predicate'] != null) {
        const vErr = validateSeal(predicate, checkBy, today);
        if (vErr) return toolError({ ok: false, tool: 'argus_amend', error_code: vErr.code, message: vErr.message, recovery: vErr.recovery });
      }

      const now = new Date().toISOString();
      await appendLedger(dir, [{ id, event: 'amend', predicate: a['predicate'] as string | undefined, check_by: a['check_by'] as string | undefined }], now);
      if (predicate && checkBy) {
        await atomicWriteJson(bearingPath(dir, id), { v: SCHEMA_VERSION, id, contract_seed: { predicate, check_by: checkBy } });
      }
      return envelope({
        ok: true, tool: 'argus_amend',
        surface: `Amended. Now: "${predicate}" — check-by ${checkBy}.`,
        next_actions: ['argus_check_in', 'stop'],
        data: { id, predicate, check_by: checkBy },
      });
    } catch (e) {
      return handleToolException('argus_amend', e);
    }
  },
};

export const dismiss: ToolModule = {
  name: 'argus_dismiss',
  description: 'Close a decision without settling it — the user moved on, decided elsewhere, or it became irrelevant. Terminal; not reopened.',
  inputSchema: z.strictObject({
    argus_dir: zArgusDir,
    id: zId,
    dismiss_reason: z.enum(['became_irrelevant', 'decided_elsewhere', 'changed_mind', 'other']),
    note: z.string().max(300).optional(),
    today_override: zDate.optional(),
  }),
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = requireArgusDir(a['argus_dir']);
      const id = String(a['id'] ?? '');
      const today = resolveToday({ override: a['today_override'] as string | undefined });
      const current = resolveContract(dir, id, today);
      guardTransition(current.state, 'dismiss');

      const now = new Date().toISOString();
      await appendLedger(dir, [{ id, event: 'dismiss', dismiss_reason: a['dismiss_reason'] as string, decision: a['note'] as string | undefined }], now);
      return envelope({
        ok: true, tool: 'argus_dismiss',
        surface: 'Dismissed. Closed without a verdict.',
        next_actions: ['stop'],
        data: { id, dismiss_reason: a['dismiss_reason'] },
      });
    } catch (e) {
      return handleToolException('argus_dismiss', e);
    }
  },
};
