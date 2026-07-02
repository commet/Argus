import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';
import { fetchAccountReceipts } from '../lib/push-account.js';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { replayLedger, type ContractEntry } from '../lib/ledger-replay.js';

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
  argus_dir: zArgusDir,
  due_only: z.boolean().default(false).describe('List only receipts whose check-by date has arrived.'),
  limit: z.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT).describe(`Max receipts to list (default ${DEFAULT_LIMIT}). Due items are ordered first.`),
});

export const sync: ToolModule = {
  name: 'argus_sync',
  description:
    'Pull your Argus account receipts into the terminal — live judgments and what is due. ' +
    'Returns: receipts (id, local_id, settle_path, title, state, next_check_by, due, open_predicates) with due items first, plus total/due/has_more. ' +
    'Account ids carry an mcp_ prefix for terminal-sealed judgments: settle those with argus_settle using local_id (NOT the account id). ' +
    'Web-sealed judgments (local_id null) settle in the web dashboard. ' +
    'A terminal-sealed judgment already settled on the web is flagged settled_in_account:true — record the same outcome locally with argus_settle if you want it in this ledger too. ' +
    'Seals/settles already push to the account automatically; this is the READ side. Use due_only:true to see just what needs settling. Requires ARGUS_TOKEN (Settings → sync token).',
  inputSchema,
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: 'Sync account receipts', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
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

      // ④ Reverse cross-check (best-effort, read-only): a judgment sealed here
      // but settled in the WEB stays 'sealed' in the local ledger forever, so
      // check_in / recall keep citing it as due. Compare account state against
      // the local ledger and FLAG the mismatch — never auto-settle locally
      // (recording an outcome without the user's own words would be a machine
      // settlement on an append-only ledger; the user runs argus_settle).
      let localContracts: Map<string, ContractEntry> | null = null;
      try {
        const dir = resolveToolArgusDir(a['argus_dir']);
        localContracts = replayLedger(dir, resolveToday({})).contracts;
      } catch {
        localContracts = null; // no local dir bound — account-only listing, skip the cross-check
      }
      const settledInAccount = (accountId: string, accountState: string): boolean => {
        if (!localContracts || accountState !== 'settled' || !accountId.startsWith('mcp_')) return false;
        const entry = localContracts.get(accountId.slice(4));
        return entry?.status === 'sealed'; // sealed locally (incl. derived-due) yet already settled in the account
      };
      const settledInAccountCount = pull.receipts.filter((r) => settledInAccount(r.id, r.state)).length;

      const baseSurface = dueCount > 0
        ? `계정에 살아 있는 판단 ${pull.receipts.length}개 · 확인할 차례 ${dueCount}개. ` +
          '이 터미널에서 봉인한 것은 local_id로 argus_settle, 웹에서 봉인한 것은 웹 대시보드에서 정산하세요.'
        : `계정에 살아 있는 판단 ${pull.receipts.length}개. 확인할 차례가 된 것은 없습니다.`;
      const crossCheckLine = settledInAccountCount > 0
        ? ` 웹에서 이미 정산된 것 ${settledInAccountCount}건 — 로컬 원장에도 남기려면 argus_settle로 같은 outcome을 기록하세요.`
        : '';

      return envelope({
        ok: true, tool: 'argus_sync',
        surface: baseSurface + crossCheckLine,
        next_actions: dueCount > 0 ? ['argus_settle', 'stop'] : ['stop'],
        data: {
          total: pull.receipts.length,
          due: dueCount,
          count: receipts.length,
          has_more: truncated,
          ...(truncated ? { truncation_note: `${matched.length}개 중 ${receipts.length}개만 표시. limit을 올리거나 due_only로 좁히세요.` } : {}),
          receipts: receipts.map((r) => {
            // Terminal-sealed judgments live in the account under an `mcp_` prefix
            // (webapp api/mcp/seal rowId). Settling with the ACCOUNT id always
            // fails (NO_PRIOR_SEAL: the local ledger knows the unprefixed id), so
            // hand the caller the exact id argus_settle expects — or route
            // web-sealed rows to the web dashboard.
            const localId = r.id.startsWith('mcp_') ? r.id.slice(4) : null;
            return {
              id: r.id,
              local_id: localId,
              settle_path: localId ? 'argus_settle (use local_id)' : 'webapp',
              title: r.source_title,
              state: r.state,
              next_check_by: r.next_check_by,
              due: r.due,
              open_predicates: r.open_predicates,
              // Settled in the account (web) while the local ledger still says
              // sealed. Flag only — the local record stays the user's to write.
              ...(settledInAccount(r.id, r.state) ? { settled_in_account: true } : {}),
            };
          }),
        },
      });
    } catch (e) {
      return handleToolException('argus_sync', e);
    }
  },
};
