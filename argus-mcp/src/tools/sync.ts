import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';
import { fetchAccountReceipts } from '../lib/push-account.js';

/**
 * argus_sync — the explicit, bidirectional bridge (design doc §연결 방식).
 *
 * PUSH is automatic: argus_seal / argus_settle already mirror to the account
 * when ARGUS_TOKEN is set. PULL is this tool: it lists your account receipts —
 * live judgments + what's due — so the terminal can settle without the web app.
 * Read-only and opt-in; with no token it explains how to connect.
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const inputSchema = z.strictObject({
  due_only: z.boolean().default(false).describe('List only receipts whose check-by date has arrived.'),
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe(`Max receipts to list (default ${DEFAULT_LIMIT}). Due items are ordered first.`),
});

export const sync: ToolModule = {
  name: 'argus_sync',
  description:
    'Pull your Argus account receipts into the terminal — live judgments and what is due — so you can settle here. Seals/settles already push to the account automatically; this is the read side. Requires ARGUS_TOKEN.',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  handler: async (a) => {
    try {
      const pull = await fetchAccountReceipts();
      if (!pull.ok && pull.reason === 'no_token') {
        return toolError({
          ok: false, tool: 'argus_sync', error_code: 'NOT_CONNECTED',
          message: 'This terminal is not connected to an Argus account.',
          recovery: 'Issue a token in the web app (Settings → sync token) and set ARGUS_TOKEN in your MCP config.',
        });
      }
      if (!pull.ok) {
        return toolError({
          ok: false, tool: 'argus_sync', error_code: 'SYNC_FAILED',
          message: `Could not reach the account (${pull.reason}).`,
          recovery: 'Check your network / ARGUS_API_URL, then try again. Local seals are unaffected.',
        });
      }

      const dueOnly = a['due_only'] === true;
      const rawLimit = typeof a['limit'] === 'number' ? Math.floor(a['limit'] as number) : DEFAULT_LIMIT;
      const limit = Math.max(1, Math.min(MAX_LIMIT, rawLimit));
      const matched = dueOnly ? pull.receipts.filter((r) => r.due) : pull.receipts;
      const receipts = matched.slice(0, limit);
      const dueCount = pull.receipts.filter((r) => r.due).length;
      const truncated = matched.length > receipts.length;

      return envelope({
        ok: true, tool: 'argus_sync',
        surface: dueCount > 0
          ? `계정에 살아 있는 판단 ${pull.receipts.length}개 · 확인할 차례 ${dueCount}개. 정산은 argus_settle로.`
          : `계정에 살아 있는 판단 ${pull.receipts.length}개. 확인할 차례가 된 것은 없습니다.`,
        next_actions: dueCount > 0 ? ['argus_settle', 'stop'] : ['stop'],
        data: {
          total: pull.receipts.length,
          due: dueCount,
          count: receipts.length,
          has_more: truncated,
          ...(truncated ? { truncation_note: `${matched.length}개 중 ${receipts.length}개만 표시. limit을 올리거나 due_only로 좁히세요.` } : {}),
          receipts: receipts.map((r) => ({
            id: r.id,
            title: r.source_title,
            state: r.state,
            next_check_by: r.next_check_by,
            due: r.due,
            open_predicates: r.open_predicates,
          })),
        },
      });
    } catch (e) {
      return handleToolException('argus_sync', e);
    }
  },
};
