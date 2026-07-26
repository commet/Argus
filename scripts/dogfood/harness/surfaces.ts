/**
 * Surface drivers. Each drives the REAL production module for its surface —
 * semantic-web command builder + ledger gateway (web), the shared
 * telegram-semantic handlers plus the real settlement callback codecs
 * (telegram), and semantic-plugin + the verbatim outbox→pull loop (plugin).
 * Only the Supabase client and the outbound Telegram sender are substituted.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  buildSemanticWebCommand,
  semanticWebCommandFromRequest,
  type SemanticWebCommand,
} from '../../../src/lib/semantic-web';
import {
  appendProjectSemanticEvents,
  readProjectSemanticEvents,
} from '../../../src/lib/semantic-ledger-gateway';
import {
  handleFoundationContractSettlement,
  handleSemanticContractClose,
  handleSemanticContractSettlement,
} from '../../../src/lib/telegram-semantic';
import {
  foundationPresentStandardReplyMarkup,
  foundationSettlementReplyMarkup,
  parseFoundationSettlementCallback,
  parseSemanticCloseCallback,
  parseSettlementIntent,
  semanticCloseReplyMarkup,
  settlementReplyMarkup,
  settlementToken,
  type TelegramSettlementIntent,
  type TelegramSettlementOutcome,
} from '../../../src/lib/telegram-settlement';
import { fold, type SemanticState } from '../../../src/lib/decision-kernel';
import {
  closePluginRecord,
  deferPluginReturn,
  recordPluginAnswer,
  reforgePluginDecision,
  type PluginSemanticRecord,
} from '../../../src/lib/semantic-plugin';
import type { DecisionContract, PluginDecision } from '../../../src/stores/types';
import { SupabaseEmulator } from './supabase-emulator';
import { Rng } from './rng';

export interface ActionResult {
  ok: boolean;
  code?: string;
  status?: number;
  duplicate?: boolean[];
  events?: unknown[];
  /** The candidate events the command built (present even on refusal). */
  built?: unknown[];
  note?: string;
}

/** The web route's exact outcome→HTTP mapping (route.ts POST). */
function webStatus(result: { ok: boolean; code?: string }): number {
  if (result.ok) return 200;
  if (result.code === 'INVALID_COMMAND' || result.code === 'INVALID_RECORDED_AT' || result.code === 'BAD_REQUEST') return 400;
  if (result.code === 'FORBIDDEN') return 403;
  if (result.code === 'APPEND_FAILED') return 500;
  return 409;
}

export class WebSurface {
  constructor(
    private readonly emu: SupabaseEmulator,
    private readonly userId: string,
  ) {}

  /**
   * Exactly the route POST body after auth: parse browser request shape,
   * build, gateway-append. `recordedAt` keeps runs deterministic.
   */
  async command(projectId: string, command: SemanticWebCommand, recordedAt?: string): Promise<ActionResult> {
    const input = semanticWebCommandFromRequest(projectId, { command });
    if (!input) return { ok: false, code: 'BAD_REQUEST', status: 400 };
    const built = buildSemanticWebCommand({ ...input, recorded_at: recordedAt ?? this.emu.tick() });
    if (!built.ok) return { ok: false, code: built.code, status: webStatus(built) };
    const appended = await appendProjectSemanticEvents(this.emu, this.userId, projectId, built.events);
    if (!appended.ok) return { ok: false, code: appended.code, status: webStatus(appended), built: built.events };
    const receipt = appended.receipt as Array<{ duplicate?: boolean }>;
    return { ok: true, status: 200, events: appended.events, duplicate: receipt.map((r) => r.duplicate === true), built: built.events };
  }

  /** Replay the EXACT same built events (idempotent retry, same wire bytes). */
  async replayExact(projectId: string, events: unknown[]): Promise<ActionResult> {
    const appended = await appendProjectSemanticEvents(this.emu, this.userId, projectId, events as never);
    if (!appended.ok) return { ok: false, code: appended.code, status: webStatus(appended) };
    const receipt = appended.receipt as Array<{ duplicate?: boolean }>;
    return { ok: true, status: 200, events: appended.events, duplicate: receipt.map((r) => r.duplicate === true) };
  }

  /** Push raw candidate events at the gateway (tamper probes bypass the builder). */
  async rawAppend(projectId: string, events: unknown[], asUserId?: string): Promise<ActionResult> {
    const appended = await appendProjectSemanticEvents(this.emu, asUserId ?? this.userId, projectId, events as never);
    if (!appended.ok) return { ok: false, code: appended.code, status: webStatus(appended) };
    const receipt = appended.receipt as Array<{ duplicate?: boolean }>;
    return { ok: true, status: 200, events: appended.events, duplicate: receipt.map((r) => r.duplicate === true) };
  }

  async read(projectId: string): Promise<unknown[] | null> {
    return readProjectSemanticEvents(this.emu, this.userId, projectId);
  }
}

export interface TelegramExchange {
  sent: Array<{ text: string; keyboard?: unknown }>;
}

export class TelegramSurface {
  constructor(
    private readonly emu: SupabaseEmulator,
    private readonly userId: string,
    private readonly rng: Rng,
  ) {}

  private deps(transcript: TelegramExchange) {
    return {
      admin: this.emu,
      send: async (_chat: number | string, text: string, keyboard?: unknown) => {
        transcript.sent.push({ text, keyboard });
      },
      now: () => new Date(this.emu.nowIso()),
      newId: () => this.rng.id('tg'),
    };
  }

  /**
   * A button tap, end to end through the REAL codec: render the settlement
   * keyboard, take the actual callback_data payload, parse it back into an
   * intent, then run the shared settlement brain. `update_id`/`callback_id`
   * style receipt evidence is carried in receiptRef exactly like the webhook.
   */
  async tapSettlementButton(
    projectId: string,
    contract: DecisionContract,
    outcome: TelegramSettlementOutcome,
    receiptRef: string,
  ): Promise<{ result: ActionResult; transcript: TelegramExchange; intent: TelegramSettlementIntent | null }> {
    if (outcome !== 'pending' && outcome !== 'mute' && contract.semantic_judgment_id) {
      const project = this.emu.projects.find((candidate) => candidate.id === projectId);
      const transcript: TelegramExchange = { sent: [] };
      if (!project || project.user_id !== this.userId) {
        return { result: { ok: false, code: 'OWNERSHIP_REFUSED' }, transcript, intent: null };
      }
      const state = fold(
        this.emu.snapshotStream(this.userId, projectId).map((event) => JSON.parse(event)),
      ) as SemanticState;
      const kind = state.judgments.get(contract.semantic_judgment_id)?.kind;
      if (!kind || kind === 'witness') {
        return { result: { ok: false, code: 'RETURN_KIND_UNAVAILABLE' }, transcript, intent: null };
      }
      const optionId = kind === 'prediction'
        ? (outcome === 'happened' ? 'condition_met' : outcome === 'avoided' ? 'condition_not_met' : 'mixed')
        : kind === 'commitment'
          ? (outcome === 'happened' ? 'enacted' : outcome === 'avoided' ? 'withdrawn' : 'revised')
          : (outcome === 'happened' ? 'maintained' : outcome === 'avoided' ? 'withdrawn' : 'revised');
      const firstButton = foundationSettlementReplyMarkup(projectId, contract.id, kind, 'ko')
        .inline_keyboard.flat()
        .find((button) => parseFoundationSettlementCallback(button.callback_data)?.optionId === optionId);
      const first = parseFoundationSettlementCallback(firstButton?.callback_data);
      if (!first) return { result: { ok: false, code: 'INTENT_PARSE_FAILED' }, transcript, intent: null };
      const before = this.emu.snapshotStream(this.userId, projectId).length;
      await handleFoundationContractSettlement(
        this.deps(transcript), 100, this.userId,
        { id: project.id, name: project.name, decision_contract: project.decision_contract },
        contract, first, receiptRef,
      );
      const status = outcome === 'partial' ? 'changed' : 'same';
      const secondButton = foundationPresentStandardReplyMarkup(projectId, contract.id, kind, optionId, 'ko')
        .inline_keyboard.flat()
        .find((button) => parseFoundationSettlementCallback(button.callback_data)?.presentStandard === status);
      const second = parseFoundationSettlementCallback(secondButton?.callback_data);
      if (!second) return { result: { ok: false, code: 'INTENT_PARSE_FAILED' }, transcript, intent: null };
      await handleFoundationContractSettlement(
        this.deps(transcript), 100, this.userId,
        { id: project.id, name: project.name, decision_contract: project.decision_contract },
        contract, second, receiptRef,
      );
      const after = this.emu.snapshotStream(this.userId, projectId).length;
      return {
        result: { ok: true, status: 200, note: `appended=${after - before}` },
        transcript,
        intent: null,
      };
    }
    const markup = settlementReplyMarkup(projectId, contract.id, 'ko');
    const flat = markup.inline_keyboard.flat();
    const byOutcome: Record<TelegramSettlementOutcome, number> = { happened: 0, avoided: 1, partial: 2, pending: 3, mute: 4 };
    const callbackData = flat[byOutcome[outcome]]!.callback_data;
    const intent = parseSettlementIntent({ callbackData });
    if (!intent) return { result: { ok: false, code: 'INTENT_PARSE_FAILED' }, transcript: { sent: [] }, intent: null };
    return this.settle(projectId, contract, intent, receiptRef);
  }

  /** A typed reply to the reminder message (token-matched free text). */
  async replyToReminder(
    projectId: string,
    contract: DecisionContract,
    text: string,
    receiptRef: string,
  ): Promise<{ result: ActionResult; transcript: TelegramExchange; intent: TelegramSettlementIntent | null }> {
    const replyText = `reminder…\n${settlementToken(projectId, contract.id)}`;
    const intent = parseSettlementIntent({ text, replyText });
    if (!intent) return { result: { ok: false, code: 'INTENT_PARSE_FAILED' }, transcript: { sent: [] }, intent: null };
    return this.settle(projectId, contract, intent, receiptRef);
  }

  private async settle(
    projectId: string,
    contract: DecisionContract,
    intent: TelegramSettlementIntent,
    receiptRef: string,
  ): Promise<{ result: ActionResult; transcript: TelegramExchange; intent: TelegramSettlementIntent }> {
    const project = this.emu.projects.find((p) => p.id === projectId);
    const transcript: TelegramExchange = { sent: [] };
    if (!project || project.user_id !== this.userId || (intent.contractId && contract.id && contract.id !== intent.contractId)) {
      // The webhook's ownership gate (handleContractSettlement) refuses first.
      return { result: { ok: false, code: 'OWNERSHIP_REFUSED' }, transcript, intent };
    }
    const before = this.emu.snapshotStream(this.userId, projectId).length;
    const handled = await handleSemanticContractSettlement(
      this.deps(transcript), 100, this.userId,
      { id: project.id, name: project.name, decision_contract: project.decision_contract },
      contract, intent, receiptRef,
    );
    const after = this.emu.snapshotStream(this.userId, projectId).length;
    return {
      result: { ok: handled, status: handled ? 200 : undefined, note: `appended=${after - before}` },
      transcript,
      intent,
    };
  }

  /** The separate close: real close-callback payload → real parser → shared brain. */
  async tapCloseButton(projectId: string, contract: DecisionContract, receiptRef: string): Promise<{ result: ActionResult; transcript: TelegramExchange }> {
    const markup = semanticCloseReplyMarkup(projectId, contract.id, 'ko');
    const callbackData = markup.inline_keyboard[0]![0]!.callback_data;
    const parsed = parseSemanticCloseCallback(callbackData);
    const transcript: TelegramExchange = { sent: [] };
    if (!parsed) return { result: { ok: false, code: 'CLOSE_PARSE_FAILED' }, transcript };
    await handleSemanticContractClose(this.deps(transcript), 100, this.userId, parsed.projectId, parsed.contractId, receiptRef);
    return { result: { ok: true, status: 200 }, transcript };
  }
}

/**
 * Plugin surface: the web-side store flow (reforge/answer/defer/close via the
 * real semantic-plugin builders + plugin_events outbox rows exactly as
 * usePluginStore writes them), then the pull side — the same dedupe-and-write-
 * verbatim loop as argus-plugin-v2/scripts/push-webapp.js pull() — into a real
 * on-disk semantic-v3.jsonl.
 */
export class PluginSurface {
  private applied = new Set<string>();

  constructor(
    private readonly emu: SupabaseEmulator,
    private readonly userId: string,
    private readonly rng: Rng,
    readonly ledgerDir: string,
  ) {
    fs.mkdirSync(ledgerDir, { recursive: true });
  }

  get ledgerFile(): string {
    return path.join(this.ledgerDir, 'semantic-v3.jsonl');
  }

  /** usePluginStore.writeSemantic, verbatim shape. */
  async writeOutbox(decision: PluginDecision, events: PluginSemanticRecord['events']): Promise<void> {
    await this.emu.from('plugin_events').insert({
      id: this.rng.uuid(), user_id: this.userId, plugin_decision_id: decision.id,
      ledger_id: decision.ledger_id, event_id: `web:plugin:v3:${decision.ledger_id}:${this.rng.id('pe')}`,
      event: 'semantic_v3', payload: { semantic_events: events }, source: 'webapp',
    });
  }

  reforge(decision: PluginDecision, now: string): PluginSemanticRecord {
    return reforgePluginDecision(decision, this.rng.id('req'), now);
  }

  answer(decision: PluginDecision, record: PluginSemanticRecord, outcome: 'happened' | 'avoided' | 'partial', now: string) {
    return recordPluginAnswer(decision, record, this.rng.id('req'), outcome, now);
  }

  defer(decision: PluginDecision, record: PluginSemanticRecord, checkBy: string, now: string) {
    return deferPluginReturn(decision, record, this.rng.id('req'), checkBy, now);
  }

  close(decision: PluginDecision, record: PluginSemanticRecord, resolutionId: string, now: string) {
    return closePluginRecord(decision, record, this.rng.id('req'), resolutionId, now);
  }

  /**
   * push-webapp.js pull(): read outbox rows in created_at order, skip applied
   * event ids, envelope-check, append VERBATIM (never reinterpreted), remember
   * applied ids. Returns counts plus any visible errors.
   */
  pull(): { written: number; skipped: number; errors: string[] } {
    const rows = [...this.emu.pluginEvents].sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    let written = 0; let skipped = 0; const errors: string[] = [];
    for (const item of rows) {
      if (item.user_id !== this.userId) continue;
      if (!item.event_id || this.applied.has(item.event_id)) { skipped += 1; continue; }
      if (item.event !== 'semantic_v3') { skipped += 1; continue; }
      const semanticEvents = Array.isArray((item.payload as { semantic_events?: unknown }).semantic_events)
        ? (item.payload as { semantic_events: unknown[] }).semantic_events
        : null;
      if (!semanticEvents || semanticEvents.length === 0) { skipped += 1; continue; }
      try {
        // push-webapp.js appendSemanticEvents: envelope check + verbatim append.
        for (const event of semanticEvents) {
          const envelope = event as { event?: unknown; event_id?: unknown; v?: unknown };
          if (!event || typeof event !== 'object' || !envelope.event || !envelope.event_id || envelope.v !== 3) {
            throw new Error('semantic event batch contains an invalid v3 envelope');
          }
        }
        fs.appendFileSync(this.ledgerFile, `${semanticEvents.map((event) => JSON.stringify(event)).join('\n')}\n`);
      } catch (error) {
        errors.push(`Skipped invalid semantic batch ${item.event_id}: ${(error as Error).message}`);
        skipped += 1;
        continue;
      }
      this.applied.add(item.event_id);
      for (const event of semanticEvents) {
        const id = (event as { event_id?: unknown }).event_id;
        if (id) this.applied.add(String(id));
      }
      written += semanticEvents.length;
    }
    return { written, skipped, errors };
  }

  readLedgerLines(): string[] {
    try {
      return fs.readFileSync(this.ledgerFile, 'utf8').split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}
