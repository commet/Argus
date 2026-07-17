import type { AuthorityCommand } from './domain/commands';

export type AuthorityOutboxStatus = 'pending' | 'attempted' | 'succeeded' | 'abandoned';

export interface AuthorityOutboxRecord {
  account_id: string;
  command_id: string;
  command: AuthorityCommand;
  status: AuthorityOutboxStatus;
  attempts: number;
  next_retry_at: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthorityCommandOutbox {
  enqueue(accountId: string, command: AuthorityCommand, now?: string): Promise<AuthorityOutboxRecord>;
  list(accountId: string, statuses?: readonly AuthorityOutboxStatus[]): Promise<AuthorityOutboxRecord[]>;
  markAttempt(commandId: string, nextRetryAt: string, error?: string): Promise<void>;
  acknowledge(commandId: string, now?: string): Promise<void>;
  abandon(commandId: string, reason: string, now?: string): Promise<void>;
  purgeAccount(accountId: string): Promise<number>;
}

export type AuthorityCommandDelivery = (command: AuthorityCommand) => Promise<
  | { ok: true }
  | { ok: false; code: string; retryable: boolean }
>;

export interface AuthorityOutboxDrainResult {
  attempted: number;
  succeeded: number;
  retry_scheduled: number;
  abandoned: number;
}

function nowIso(value?: string): string {
  return value ?? new Date().toISOString();
}

function clone(record: AuthorityOutboxRecord): AuthorityOutboxRecord {
  return structuredClone(record);
}

export class MemoryAuthorityCommandOutbox implements AuthorityCommandOutbox {
  protected readonly records = new Map<string, AuthorityOutboxRecord>();

  async enqueue(accountId: string, command: AuthorityCommand, now?: string): Promise<AuthorityOutboxRecord> {
    const existing = this.records.get(command.command_id);
    if (existing) {
      if (existing.account_id !== accountId
        || existing.command.semantic_fingerprint !== command.semantic_fingerprint) {
        throw new Error('OUTBOX_COMMAND_CONFLICT');
      }
      return clone(existing);
    }
    const timestamp = nowIso(now);
    const record: AuthorityOutboxRecord = {
      account_id: accountId,
      command_id: command.command_id,
      command: structuredClone(command),
      status: 'pending',
      attempts: 0,
      next_retry_at: timestamp,
      created_at: timestamp,
      updated_at: timestamp,
    };
    this.records.set(record.command_id, record);
    return clone(record);
  }

  async list(accountId: string, statuses?: readonly AuthorityOutboxStatus[]): Promise<AuthorityOutboxRecord[]> {
    const allow = statuses ? new Set(statuses) : null;
    return [...this.records.values()]
      .filter((record) => record.account_id === accountId && (!allow || allow.has(record.status)))
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.command_id.localeCompare(b.command_id))
      .map(clone);
  }

  async markAttempt(commandId: string, nextRetryAt: string, error?: string): Promise<void> {
    const record = this.records.get(commandId);
    if (!record || record.status === 'succeeded' || record.status === 'abandoned') {
      throw new Error('OUTBOX_COMMAND_NOT_RETRYABLE');
    }
    record.status = 'attempted';
    record.attempts += 1;
    record.next_retry_at = nextRetryAt;
    record.last_error = error;
    record.updated_at = nowIso();
  }

  async acknowledge(commandId: string, now?: string): Promise<void> {
    const record = this.records.get(commandId);
    if (!record) throw new Error('OUTBOX_COMMAND_NOT_FOUND');
    record.status = 'succeeded';
    record.last_error = undefined;
    record.updated_at = nowIso(now);
  }

  async abandon(commandId: string, reason: string, now?: string): Promise<void> {
    const record = this.records.get(commandId);
    if (!record || record.status === 'succeeded') throw new Error('OUTBOX_COMMAND_NOT_ABANDONABLE');
    record.status = 'abandoned';
    record.last_error = reason;
    record.updated_at = nowIso(now);
  }

  async purgeAccount(accountId: string): Promise<number> {
    let count = 0;
    for (const [commandId, record] of this.records) {
      if (record.account_id === accountId) {
        this.records.delete(commandId);
        count += 1;
      }
    }
    return count;
  }
}

const DATABASE_NAME = 'argus-jcr';
const DATABASE_VERSION = 1;
const STORE = 'authority_command_outbox';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('INDEXEDDB_REQUEST_FAILED'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('INDEXEDDB_TRANSACTION_ABORTED'));
    transaction.onerror = () => reject(transaction.error ?? new Error('INDEXEDDB_TRANSACTION_FAILED'));
  });
}

export class IndexedDbAuthorityCommandOutbox implements AuthorityCommandOutbox {
  private database?: Promise<IDBDatabase>;

  constructor(private readonly factory: IDBFactory = indexedDB) {}

  private open(): Promise<IDBDatabase> {
    if (!this.database) {
      this.database = new Promise((resolve, reject) => {
        const request = this.factory.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(STORE)) {
            const store = database.createObjectStore(STORE, { keyPath: 'command_id' });
            store.createIndex('account_id', 'account_id', { unique: false });
            store.createIndex('account_status', ['account_id', 'status'], { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('INDEXEDDB_OPEN_FAILED'));
      });
    }
    return this.database;
  }

  private async mutate(
    commandId: string,
    update: (record: AuthorityOutboxRecord | undefined) => AuthorityOutboxRecord,
  ): Promise<AuthorityOutboxRecord> {
    const database = await this.open();
    const transaction = database.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const existing = await requestResult(store.get(commandId)) as AuthorityOutboxRecord | undefined;
    const next = update(existing);
    store.put(next);
    await transactionDone(transaction);
    return clone(next);
  }

  async enqueue(accountId: string, command: AuthorityCommand, now?: string): Promise<AuthorityOutboxRecord> {
    return this.mutate(command.command_id, (existing) => {
      if (existing) {
        if (existing.account_id !== accountId
          || existing.command.semantic_fingerprint !== command.semantic_fingerprint) {
          throw new Error('OUTBOX_COMMAND_CONFLICT');
        }
        return existing;
      }
      const timestamp = nowIso(now);
      return {
        account_id: accountId,
        command_id: command.command_id,
        command: structuredClone(command),
        status: 'pending',
        attempts: 0,
        next_retry_at: timestamp,
        created_at: timestamp,
        updated_at: timestamp,
      };
    });
  }

  async list(accountId: string, statuses?: readonly AuthorityOutboxStatus[]): Promise<AuthorityOutboxRecord[]> {
    const database = await this.open();
    const transaction = database.transaction(STORE, 'readonly');
    const index = transaction.objectStore(STORE).index('account_id');
    const records = await requestResult(index.getAll(IDBKeyRange.only(accountId))) as AuthorityOutboxRecord[];
    await transactionDone(transaction);
    const allow = statuses ? new Set(statuses) : null;
    return records
      .filter((record) => !allow || allow.has(record.status))
      .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.command_id.localeCompare(b.command_id))
      .map(clone);
  }

  async markAttempt(commandId: string, nextRetryAt: string, error?: string): Promise<void> {
    await this.mutate(commandId, (record) => {
      if (!record || record.status === 'succeeded' || record.status === 'abandoned') {
        throw new Error('OUTBOX_COMMAND_NOT_RETRYABLE');
      }
      return {
        ...record,
        status: 'attempted',
        attempts: record.attempts + 1,
        next_retry_at: nextRetryAt,
        last_error: error,
        updated_at: nowIso(),
      };
    });
  }

  async acknowledge(commandId: string, now?: string): Promise<void> {
    await this.mutate(commandId, (record) => {
      if (!record) throw new Error('OUTBOX_COMMAND_NOT_FOUND');
      return { ...record, status: 'succeeded', last_error: undefined, updated_at: nowIso(now) };
    });
  }

  async abandon(commandId: string, reason: string, now?: string): Promise<void> {
    await this.mutate(commandId, (record) => {
      if (!record || record.status === 'succeeded') throw new Error('OUTBOX_COMMAND_NOT_ABANDONABLE');
      return { ...record, status: 'abandoned', last_error: reason, updated_at: nowIso(now) };
    });
  }

  async purgeAccount(accountId: string): Promise<number> {
    const database = await this.open();
    const transaction = database.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const index = store.index('account_id');
    const keys = await requestResult(index.getAllKeys(IDBKeyRange.only(accountId)));
    for (const key of keys) store.delete(key);
    await transactionDone(transaction);
    return keys.length;
  }
}

/**
 * At-least-once command delivery over an exactly-idempotent server gateway.
 * A crash after server ack but before local acknowledge only produces an exact
 * retry; it cannot duplicate canonical events.
 */
export async function drainAuthorityCommandOutbox(args: {
  outbox: AuthorityCommandOutbox;
  account_id: string;
  deliver: AuthorityCommandDelivery;
  now?: string;
  limit?: number;
}): Promise<AuthorityOutboxDrainResult> {
  const now = nowIso(args.now);
  const due = (await args.outbox.list(args.account_id, ['pending', 'attempted']))
    .filter((record) => Date.parse(record.next_retry_at) <= Date.parse(now))
    .slice(0, args.limit ?? 20);
  const result: AuthorityOutboxDrainResult = {
    attempted: 0,
    succeeded: 0,
    retry_scheduled: 0,
    abandoned: 0,
  };
  for (const record of due) {
    result.attempted += 1;
    try {
      const delivery = await args.deliver(record.command);
      if (delivery.ok) {
        await args.outbox.acknowledge(record.command_id, now);
        result.succeeded += 1;
      } else if (!delivery.retryable) {
        await args.outbox.abandon(record.command_id, delivery.code, now);
        result.abandoned += 1;
      } else {
        const backoffMs = Math.min(60_000, 1_000 * (2 ** Math.min(record.attempts, 6)));
        await args.outbox.markAttempt(
          record.command_id,
          new Date(Date.parse(now) + backoffMs).toISOString(),
          delivery.code,
        );
        result.retry_scheduled += 1;
      }
    } catch (error) {
      const backoffMs = Math.min(60_000, 1_000 * (2 ** Math.min(record.attempts, 6)));
      await args.outbox.markAttempt(
        record.command_id,
        new Date(Date.parse(now) + backoffMs).toISOString(),
        error instanceof Error ? error.message : 'DELIVERY_FAILED',
      );
      result.retry_scheduled += 1;
    }
  }
  return result;
}
