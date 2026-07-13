/**
 * argus_candidates (M-잔여-2) — 캡처 후보의 목록·연결·정리.
 *
 * v2-네이티브 툴: 후보(candidate)는 v2 내구 원장에만 존재하므로 v1 원장을
 * 거치지 않는다. 바인딩이 없으면 정직하게 INIT_REQUIRED로 거절한다.
 *
 * 스파인:
 *  - 무권유 — 목록은 사실만 보여주고, 봉인/정리/방치(14일 소멸) 중 무엇도
 *    권하지 않는다. 방치도 유효한 선택지로 명시한다.
 *  - promote는 결정을 만들지 않는다 — 결정을 만드는 동사는 argus_seal
 *    하나다(사용자의 말로). promote는 이미 봉인된 결정에 후보를 "연결"만
 *    한다 (출처 기록).
 *  - quote는 untrusted 데이터 — 렌더 시 sanitize + 명시 구분 노트 (규칙 19).
 */
import { z } from 'zod';
import { envelope } from '../lib/envelope.js';
import { resolveToolArgusDir } from '../lib/argus-dir.js';
import { resolveToday } from '../lib/resolve-today.js';
import { resolveResponseLocale, SURFACES } from '../lib/surfaces.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, zDate, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';
import { argusHome } from '../v2/ledger.js';
import { loadState } from '../v2/reducer.js';
import { deriveBrief } from '../v2/brief.js';
import { gitCommonDirOf } from '../v2/git-discovery.js';
import { candidateActionV2, contextFor, InitRequiredError } from '../v2/bridge.js';
import { sanitizeLine } from '../v2/sanitize.js';

const zSlug = z.string().min(1).max(120);

function v2Context(argusDir: string, today: string) {
  const commonDir = gitCommonDirOf(argusDir);
  if (!commonDir) throw new InitRequiredError(argusDir);
  return contextFor({
    home: argusHome(), gitCommonDir: commonDir, workspaceArgusDir: argusDir,
    sessionId: `mcp-${process.pid}`, producerVersion: '2.0.0', today,
  });
}

export const candidates: ToolModule = {
  name: 'argus_candidates',
  description:
    'List captured decision candidates, or act on one: link it to a sealed decision (promote), close it (drop), or quiet it until a date (snooze). Candidates come from opt-in harvest or manual capture; left alone they expire after 14 days. Listing never recommends an action.',
  inputSchema: z.strictObject({
    argus_dir: zArgusDir,
    action: z.enum(['list', 'promote', 'drop', 'snooze']).default('list'),
    candidate_id: zSlug.optional(),
    /** promote 대상 — 이미 argus_seal로 봉인된 결정의 id. */
    decision_id: zSlug.optional(),
    snooze_until: zDate.optional(),
    today_override: zDate.optional(),
  })
    .refine((a) => a.action === 'list' || a.candidate_id !== undefined,
      { message: 'candidate_id is required for promote/drop/snooze' })
    .refine((a) => a.action !== 'promote' || a.decision_id !== undefined,
      { message: 'promote links a candidate to an existing saved prediction — pass decision_id (save it first with argus_predict)' })
    .refine((a) => a.action !== 'snooze' || a.snooze_until !== undefined,
      { message: 'snooze requires snooze_until (YYYY-MM-DD)' }),
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: 'Captured decision candidates', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      const today = resolveToday({ override: a['today_override'] as string | undefined });
      const locale = resolveResponseLocale(dir, undefined);
      const T = SURFACES[locale].tools.candidates;
      const ctx = v2Context(dir, today);
      const action = (a['action'] as string | undefined) ?? 'list';

      if (action === 'list') {
        const brief = deriveBrief(loadState(ctx.home, ctx.repository_id), today);
        const state = loadState(ctx.home, ctx.repository_id);
        const rows = brief.candidates_active.map((c) => {
          const rec = state.candidates.get(c.candidate_id);
          const quote = sanitizeLine(rec?.quote ?? '', 80);
          const grade = rec?.verification ?? 'unknown';
          return T.item(c.candidate_id, c.kind, grade, quote);
        });
        const surface = rows.length === 0
          ? T.none
          : [T.header(brief.candidates_active.length, brief.candidates_expired), ...rows, T.quote_note].join('\n');
        return envelope({
          ok: true, tool: 'argus_candidates', surface,
          next_actions: rows.length === 0 ? ['stop'] : ['argus_predict', 'stop'],
          data: {
            candidates: brief.candidates_active.map((c) => {
              const rec = state.candidates.get(c.candidate_id);
              return {
                candidate_id: c.candidate_id, kind: c.kind, state: c.state,
                verification: rec?.verification ?? 'unknown',
                quote: sanitizeLine(rec?.quote ?? '', 400),
                created_on: rec?.created_on,
              };
            }),
            expired_count: brief.candidates_expired, today,
          },
        });
      }

      const candidateId = String(a['candidate_id']);
      if (action === 'promote') {
        candidateActionV2(ctx, {
          candidateId, action: 'promote',
          promotedTo: { kind: 'decision', id: String(a['decision_id']) },
          idempotencyKey: `promote-${candidateId}`,
        });
        return envelope({
          ok: true, tool: 'argus_candidates',
          surface: T.promoted(candidateId, String(a['decision_id'])),
          next_actions: ['argus_predict'],
          data: { candidate_id: candidateId, action, decision_id: a['decision_id'], today },
        });
      }
      if (action === 'drop') {
        candidateActionV2(ctx, { candidateId, action: 'drop', idempotencyKey: `drop-${candidateId}` });
        return envelope({
          ok: true, tool: 'argus_candidates', surface: T.dropped(candidateId),
          next_actions: ['stop'], data: { candidate_id: candidateId, action, today },
        });
      }
      // snooze
      candidateActionV2(ctx, {
        candidateId, action: 'snooze', snoozeUntil: String(a['snooze_until']),
        idempotencyKey: `snooze-${candidateId}-${String(a['snooze_until'])}`,
      });
      return envelope({
        ok: true, tool: 'argus_candidates',
        surface: T.snoozed(candidateId, String(a['snooze_until'])),
        next_actions: ['stop'],
        data: { candidate_id: candidateId, action, snooze_until: a['snooze_until'], today },
      });
    } catch (e) {
      return handleToolException('argus_candidates', e);
    }
  },
};
