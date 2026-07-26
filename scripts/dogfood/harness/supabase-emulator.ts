/**
 * In-memory emulation of the production Supabase surface the DKK v6 adapters
 * touch. The RPC below is a line-by-line port of
 * `supabase/migrations/20260714_project_semantic_events.sql` —
 * `append_project_semantic_events` — SAME checks, SAME order, SAME error
 * tokens, so the gateway's error mapping and the adapters' recovery paths are
 * exercised exactly as in production. If the SQL changes, this port must
 * change in the same commit (see scripts/dogfood/README.md).
 *
 * Fidelity notes:
 * - the advisory xact lock serializes one (user, project) stream → emulated by
 *   running each rpc body atomically (single JS turn) behind a per-stream
 *   promise queue, so interleaved async callers cannot observe partial state;
 * - Postgres `now()` is constant within a transaction → one timestamp per rpc
 *   call, event_id as the ORDER BY tiebreak;
 * - jsonb `IS DISTINCT FROM` is key-order-insensitive → stable-stringify
 *   deep-compare here.
 */

export interface EmuProjectRow {
  id: string;
  user_id: string;
  name?: string;
  decision_contract?: Record<string, unknown> | null;
}

export interface EmuSemanticRow {
  user_id: string;
  project_id: string;
  space_id: string;
  event_id: string;
  idempotency_key: string;
  event: Record<string, unknown>;
  created_at: string;
}

export interface EmuTelegramDecisionRow {
  id: string;
  user_id: string;
  status: string;
  check_by?: string | null;
  reminded_at?: string | null;
  settled_at?: string | null;
}

export interface EmuPluginEventRow {
  id: string;
  user_id: string;
  plugin_decision_id?: string;
  ledger_id?: string;
  event_id: string;
  event: string;
  payload: Record<string, unknown>;
  source?: string;
  created_at: string;
}

export interface FaultPlan {
  /** Fail the next N reads of project_semantic_events (gateway → READ_FAILED). */
  failReads?: number;
  /** Fail the next N rpc calls with this raw message (gateway maps it). */
  failRpc?: { count: number; message: string };
  /** Fail the next N projects.update calls (mute/pending projection paths). */
  failProjectUpdate?: number;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/** jsonb equality (key-order-insensitive), as `IS DISTINCT FROM` sees it. */
export function jsonbEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

/**
 * Idempotency fingerprint — MUST mirror `public._argus_semantic_idem_fingerprint`
 * (SQL) and the v3 reducer (argus-mcp/src/v3/reducer.ts). Strips the volatile
 * bookkeeping fields so an honest retry (fresh time.*) is a duplicate while an
 * altered payload still conflicts. Strip: event_id, idempotency_key,
 * causal_parent_ids, atomic_batch_id, time.{occurred_at,recorded_at,authorized_at},
 * authority.recorded_by, kind_evidence.recorded_at. Keep: event kind + payload,
 * substantive kind evidence, time.temporal_mode,
 * authority.{originated_by,authorized_by,authorization_mode,authorization_ref}.
 */
export function semanticIdemFingerprint(event: unknown): unknown {
  if (!event || typeof event !== 'object') return event;
  const { event_id, idempotency_key, causal_parent_ids, atomic_batch_id, time, authority, ...rest } =
    event as Record<string, unknown>;
  void event_id; void idempotency_key; void causal_parent_ids; void atomic_batch_id;
  const t = (time && typeof time === 'object' ? time : {}) as Record<string, unknown>;
  const a = (authority && typeof authority === 'object' ? authority : {}) as Record<string, unknown>;
  const { recorded_by, ...authRest } = a;
  void recorded_by;
  const kindEvidence = rest.kind_evidence && typeof rest.kind_evidence === 'object'
    ? Object.fromEntries(Object.entries(rest.kind_evidence as Record<string, unknown>).filter(([key]) => key !== 'recorded_at'))
    : rest.kind_evidence;
  return {
    ...rest,
    ...(kindEvidence === undefined ? {} : { kind_evidence: kindEvidence }),
    time: { temporal_mode: t.temporal_mode },
    authority: authRest,
  };
}

type Row = Record<string, unknown>;

interface QueryResult { data: unknown; error: { message: string } | null }

/**
 * Minimal PostgREST-style chainable query over an in-memory table. Supports
 * exactly the verbs the gateway/adapters use: select/eq/gt/order/limit/single,
 * update().eq()..., insert(). Thenable like the real client.
 */
class Query implements PromiseLike<QueryResult> {
  private filters: Array<(row: Row) => boolean> = [];
  private orders: Array<{ key: string; ascending: boolean }> = [];
  private limitN: number | null = null;
  private selectCols: string[] | null = null;
  private mode: 'select' | 'update' | 'insert' = 'select';
  private patch: Row | null = null;
  private insertRow: Row | null = null;
  private wantSingle = false;

  constructor(
    private readonly table: string,
    private readonly emu: SupabaseEmulator,
  ) {}

  select(cols?: string): this {
    if (this.mode === 'select') {
      this.selectCols = cols && cols !== '*' ? cols.split(',').map((c) => c.trim()) : null;
    }
    return this;
  }

  eq(key: string, value: unknown): this {
    this.filters.push((row) => String(row[key]) === String(value));
    return this;
  }

  gt(key: string, value: unknown): this {
    this.filters.push((row) => String(row[key]) > String(value));
    return this;
  }

  order(key: string, opts?: { ascending?: boolean }): this {
    this.orders.push({ key, ascending: opts?.ascending !== false });
    return this;
  }

  limit(n: number): this {
    this.limitN = n;
    return this;
  }

  single(): this {
    this.wantSingle = true;
    return this;
  }

  update(patch: Row): this {
    this.mode = 'update';
    this.patch = patch;
    return this;
  }

  insert(row: Row): this {
    this.mode = 'insert';
    this.insertRow = row;
    return this;
  }

  private run(): QueryResult {
    return this.emu._execute(this);
  }

  then<T1 = QueryResult, T2 = never>(
    onfulfilled?: ((value: QueryResult) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this.run()).then(onfulfilled, onrejected);
  }

  /** @internal */
  _plan() {
    return {
      table: this.table,
      filters: this.filters,
      orders: this.orders,
      limitN: this.limitN,
      selectCols: this.selectCols,
      mode: this.mode,
      patch: this.patch,
      insertRow: this.insertRow,
      wantSingle: this.wantSingle,
    };
  }
}

export class SupabaseEmulator {
  projects: EmuProjectRow[] = [];
  semanticEvents: EmuSemanticRow[] = [];
  telegramDecisions: EmuTelegramDecisionRow[] = [];
  pluginEvents: EmuPluginEventRow[] = [];
  faults: FaultPlan = {};

  /** Logical clock: deterministic, strictly monotonic per tick. */
  private clockMs = Date.parse('2026-07-14T00:00:00.000Z');
  /** Serializes rpc bodies per (user, project) — the advisory-lock analogue. */
  private streamQueues = new Map<string, Promise<unknown>>();
  /** Count of rpc invocations, for evidence. */
  rpcCalls = 0;

  tick(): string {
    this.clockMs += 1000;
    return new Date(this.clockMs).toISOString();
  }

  nowIso(): string {
    return new Date(this.clockMs).toISOString();
  }

  from(table: string): Query {
    return new Query(table, this);
  }

  /** @internal executes a finished query chain synchronously (atomic). */
  _execute(query: Query): QueryResult {
    const plan = query._plan();
    const table = this.tableRows(plan.table);
    if (!table) return { data: null, error: { message: `relation "${plan.table}" does not exist` } };

    if (plan.mode === 'insert') {
      const row = { ...(plan.insertRow as Row), created_at: this.tick() };
      table.push(row as never);
      return { data: null, error: null };
    }

    if (plan.mode === 'update') {
      if (plan.table === 'projects' && (this.faults.failProjectUpdate ?? 0) > 0) {
        this.faults.failProjectUpdate! -= 1;
        return { data: null, error: { message: 'injected projects update failure' } };
      }
      const targets = (table as Row[]).filter((row) => plan.filters.every((f) => f(row)));
      for (const row of targets) Object.assign(row, plan.patch);
      return { data: null, error: null };
    }

    // select
    if (plan.table === 'project_semantic_events' && (this.faults.failReads ?? 0) > 0) {
      this.faults.failReads! -= 1;
      return { data: null, error: { message: 'injected read failure' } };
    }
    let rows = (table as Row[]).filter((row) => plan.filters.every((f) => f(row)));
    for (const order of [...plan.orders].reverse()) {
      rows = [...rows].sort((a, b) => {
        const av = String(a[order.key] ?? '');
        const bv = String(b[order.key] ?? '');
        const cmp = av < bv ? -1 : av > bv ? 1 : 0;
        return order.ascending ? cmp : -cmp;
      });
    }
    if (plan.limitN !== null) rows = rows.slice(0, plan.limitN);
    const projected = plan.selectCols
      ? rows.map((row) => Object.fromEntries(plan.selectCols!.map((c) => [c, row[c]])))
      : rows.map((row) => ({ ...row }));
    if (plan.wantSingle) {
      if (projected.length !== 1) {
        return { data: null, error: { message: projected.length === 0 ? 'PGRST116: no rows' : 'PGRST116: multiple rows' } };
      }
      return { data: projected[0], error: null };
    }
    return { data: projected, error: null };
  }

  private tableRows(table: string): unknown[] | null {
    switch (table) {
      case 'projects': return this.projects;
      case 'project_semantic_events': return this.semanticEvents;
      case 'telegram_decisions': return this.telegramDecisions;
      case 'plugin_events': return this.pluginEvents;
      default: return null;
    }
  }

  async rpc(fn: string, args: Record<string, unknown>): Promise<QueryResult> {
    if (fn !== 'append_project_semantic_events') {
      return { data: null, error: { message: `function ${fn} does not exist` } };
    }
    this.rpcCalls += 1;
    if (this.faults.failRpc && this.faults.failRpc.count > 0) {
      this.faults.failRpc.count -= 1;
      return { data: null, error: { message: this.faults.failRpc.message } };
    }
    const userId = String(args.p_user_id);
    const projectId = String(args.p_project_id);
    const streamKey = `${userId}:${projectId}`;
    const prior = this.streamQueues.get(streamKey) ?? Promise.resolve();
    const run = prior.then(() => this.appendRpcBody(userId, projectId, args.p_events));
    this.streamQueues.set(streamKey, run.catch(() => undefined));
    return run;
  }

  /**
   * Port of append_project_semantic_events. Comments cite the SQL stage.
   * The whole body is synchronous → atomic under the JS event loop, which is
   * the advisory-lock guarantee we need for interleaving scenarios.
   */
  private appendRpcBody(userId: string, projectId: string, rawEvents: unknown): QueryResult {
    const err = (message: string): QueryResult => ({ data: null, error: { message } });

    // SQL: jsonb_typeof(p_events) <> 'array' OR length = 0 → INVALID_BATCH
    if (!Array.isArray(rawEvents) || rawEvents.length === 0) return err('INVALID_BATCH');
    const events = rawEvents as Array<Record<string, unknown>>;

    // SQL: project exists AND owned → else PROJECT_NOT_FOUND_OR_FORBIDDEN
    const project = this.projects.find((p) => p.id === projectId && p.user_id === userId);
    if (!project) return err('PROJECT_NOT_FOUND_OR_FORBIDDEN');

    // SQL: distinct idempotency_key count must equal batch count
    const batchKeys = events.map((e) => String(e.idempotency_key ?? ''));
    if (new Set(batchKeys).size !== events.length) return err('IDEMPOTENCY_CONFLICT');

    // SQL: per-event envelope check + single space per batch
    let spaceId: string | null = null;
    for (const event of events) {
      if (typeof event !== 'object' || event === null
        || !String(event.event_id ?? '') || !String(event.idempotency_key ?? '') || !String(event.space_id ?? '')) {
        return err('INVALID_EVENT');
      }
      if (spaceId === null) spaceId = String(event.space_id);
      else if (spaceId !== String(event.space_id)) return err('MIXED_SPACE_BATCH');
    }

    // SQL: space must be the account-project space of this project
    if (spaceId !== `account-project:${projectId}`) return err('SPACE_MISMATCH');

    // SQL: at most one seal; a seal must carry a judgment_id
    const seals = events.filter((e) => e.event === 'judgment_sealed');
    const judgmentId = seals.length === 1 ? String(seals[0]!.judgment_id ?? '') : null;
    if (seals.length > 1 || (seals.length === 1 && !judgmentId)) return err('INVALID_SEAL_BATCH');

    // SQL: pointer repair-or-refuse (runs BEFORE the duplicate check — keep it)
    if (judgmentId) {
      const contract = (project.decision_contract ?? {}) as Record<string, unknown>;
      const pointer = contract.semantic_judgment_id;
      if (pointer == null || pointer === judgmentId) {
        project.decision_contract = { ...contract, semantic_judgment_id: judgmentId };
      } else {
        return err('SEMANTIC_JUDGMENT_CONFLICT');
      }
    }

    // SQL: all-exact retry → duplicate receipt; partial/altered → conflict
    const existingForKey = (key: string) =>
      this.semanticEvents.find((r) => r.user_id === userId && r.space_id === spaceId && r.idempotency_key === key);
    const matches = batchKeys.map(existingForKey);
    const matchCount = matches.filter(Boolean).length;
    if (matchCount > 0) {
      if (matchCount !== events.length) return err('IDEMPOTENCY_CONFLICT');
      for (const [index, existing] of matches.entries()) {
        // Fingerprint compare (not raw): an honest retry re-stamps time.* → duplicate.
        if (!jsonbEqual(semanticIdemFingerprint(existing!.event), semanticIdemFingerprint(events[index])))
          return err('IDEMPOTENCY_CONFLICT');
      }
      const receipt = this.receiptRows(userId, spaceId, batchKeys, true);
      return { data: receipt, error: null };
    }

    // SQL: explicit event_id collision check (never hidden by a unique index)
    for (const event of events) {
      const clash = this.semanticEvents.find(
        (r) => r.user_id === userId && r.space_id === spaceId && r.event_id === String(event.event_id),
      );
      if (clash) return err('EVENT_ID_CONFLICT');
    }

    // SQL: INSERT ... SELECT (one now() per transaction)
    const createdAt = this.tick();
    for (const event of events) {
      this.semanticEvents.push({
        user_id: userId,
        project_id: projectId,
        space_id: spaceId!,
        event_id: String(event.event_id),
        idempotency_key: String(event.idempotency_key),
        event: JSON.parse(JSON.stringify(event)) as Record<string, unknown>,
        created_at: createdAt,
      });
    }
    return { data: this.receiptRows(userId, spaceId!, batchKeys, false), error: null };
  }

  private receiptRows(userId: string, spaceId: string, keys: string[], duplicate: boolean) {
    const keySet = new Set(keys);
    return this.semanticEvents
      .filter((r) => r.user_id === userId && r.space_id === spaceId && keySet.has(r.idempotency_key))
      .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1
        : a.event_id < b.event_id ? -1 : a.event_id > b.event_id ? 1 : 0))
      .map((r) => ({ event: JSON.parse(JSON.stringify(r.event)), created_at: r.created_at, duplicate }));
  }

  /** Deep snapshot of the admitted stream for append-only/byte-stability checks. */
  snapshotStream(userId: string, projectId: string): string[] {
    return this.semanticEvents
      .filter((r) => r.user_id === userId && r.project_id === projectId)
      .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1
        : a.event_id < b.event_id ? -1 : a.event_id > b.event_id ? 1 : 0))
      .map((r) => stableStringify(r.event));
  }
}
