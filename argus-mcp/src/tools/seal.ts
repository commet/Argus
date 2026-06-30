import { atomicWriteJson } from '../lib/atomic-write.js';
import { bearingPath } from '../lib/layout.js';
import { requireArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { resolveContract } from '../lib/resolve-contract.js';
import { guardTransition } from '../lib/state-machine.js';
import { validateSeal } from '../lib/validate-seal.js';
import { appendLedger, type LedgerEventInput } from '../lib/ledger-append.js';
import { writeSealReceipt } from '../lib/receipt.js';
import { ensurePrivacyGitignore } from '../lib/privacy.js';
import { SCHEMA_VERSION } from '../lib/spine.js';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

const inputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['argus_dir', 'id', 'predicate', 'check_by', 'predicate_owner'],
  properties: {
    argus_dir: { type: 'string' },
    id: { type: 'string', pattern: '^[A-Za-z0-9._-]+$', description: 'The id from argus_open_decision.' },
    predicate: { type: 'string', minLength: 8, maxLength: 400, description: 'A prediction reality can mark true/false. Good: "cutover downtime < 5 min". Bad: "it will go well".' },
    check_by: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'YYYY-MM-DD, a real future date — when you will come back to settle.' },
    predicate_owner: { type: 'string', enum: ['user', 'ai_surfaced'], description: 'Provenance. Never forge. "user" = the user wrote or affirmed it. "ai_surfaced" = Argus drafted, unconfirmed.' },
    basis: { type: 'string', enum: ['judgment', 'luck', 'mixed', 'unsure'] },
    real_question: { type: 'string', maxLength: 400, description: 'The real question behind the answer (receipt).' },
    unverified_assumption: { type: 'string', maxLength: 400, description: 'The core assumption not yet verified (receipt).' },
    human_only: { type: 'string', maxLength: 400, description: 'What only a human can judge here (receipt).' },
    human_judgment: { type: 'string', maxLength: 400, description: "The user's one-line call. MUST be the user's words — never an Argus-drafted line relabeled." },
    today_override: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
  },
} as const;

export const seal: ToolModule = {
  name: 'argus_seal',
  description:
    'Seal a falsifiable prediction (predicate + check-by date) for an open decision. Captures the seal-time Judgment Receipt fields. Refuses an empty/non-falsifiable predicate or a non-future date.',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = requireArgusDir(a['argus_dir']);
      const id = String(a['id'] ?? '');
      const today = resolveToday({ override: a['today_override'] as string | undefined });

      const current = resolveContract(dir, id, today);
      guardTransition(current.state, 'seal'); // throws DECISION_CLOSED / ILLEGAL_TRANSITION

      const vErr = validateSeal(a['predicate'], a['check_by'], today);
      if (vErr) {
        return toolError({ ok: false, tool: 'argus_seal', error_code: vErr.code, message: vErr.message, recovery: vErr.recovery });
      }

      const predicate = String(a['predicate']);
      const checkBy = String(a['check_by']);
      const now = new Date().toISOString();

      await ensurePrivacyGitignore(dir);

      // seal-time receipt (the rich fields that make the receipt not blank)
      await writeSealReceipt(dir, {
        id, predicate, check_by: checkBy,
        real_question: a['real_question'] as string | undefined,
        unverified_assumption: a['unverified_assumption'] as string | undefined,
        human_only: a['human_only'] as string | undefined,
        human_judgment: a['human_judgment'] as string | undefined,
        basis: a['basis'] as 'judgment' | 'luck' | 'mixed' | 'unsure' | undefined,
      }, now);

      // bearing seed (so a due contract is visible even before the ledger is replayed elsewhere)
      await atomicWriteJson(bearingPath(dir, id), {
        v: SCHEMA_VERSION, id, contract_seed: { predicate, check_by: checkBy }, predicate_owner: a['predicate_owner'],
      });

      // ledger: self-create harvest if the decision was sealed without an explicit open
      const events: LedgerEventInput[] = [];
      if (current.state === 'absent') events.push({ id, event: 'harvest', decision: predicate });
      events.push({ id, event: 'seal', predicate, check_by: checkBy, basis: a['basis'] as string | undefined });
      await appendLedger(dir, events, now);

      return envelope({
        ok: true, tool: 'argus_seal',
        surface: `Sealed. "${predicate}" — reality answers on ${checkBy}. Come back then with argus_settle.`,
        next_actions: ['argus_check_in', 'stop'],
        data: {
          id, predicate, check_by: checkBy, predicate_owner: a['predicate_owner'],
          status: 'sealed', ledger_events_written: events.map((e) => e.event),
          falsifiability_note: vErr ? 'weak heuristic passed' : undefined,
        },
      });
    } catch (e) {
      return handleToolException('argus_seal', e);
    }
  },
};
