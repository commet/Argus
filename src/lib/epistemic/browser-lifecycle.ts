import { IndexedDbAuthorityCommandOutbox, type AuthorityCommandOutbox } from './indexeddb-outbox';

export interface BrowserLifecycleReceipt {
  account_id: string;
  outbox_records_removed: number;
  caches_removed: string[];
  session_keys_removed: string[];
  completed_at: string;
}

/** Browser-owned state cannot be erased by a server route. Logout/account
 * deletion calls this explicit local half and displays its receipt separately. */
export async function purgeBrowserAccountContinuity(args: {
  account_id: string;
  outbox: AuthorityCommandOutbox;
  cache_storage?: Pick<CacheStorage, 'keys' | 'delete'>;
  session_storage?: Pick<Storage, 'length' | 'key' | 'removeItem'>;
  now?: string;
}): Promise<BrowserLifecycleReceipt> {
  const outboxRemoved = await args.outbox.purgeAccount(args.account_id);
  const cachesRemoved: string[] = [];
  if (args.cache_storage) {
    for (const name of await args.cache_storage.keys()) {
      if (!name.startsWith('argus-')) continue;
      if (await args.cache_storage.delete(name)) cachesRemoved.push(name);
    }
  }
  const sessionKeys: string[] = [];
  if (args.session_storage) {
    const keys = Array.from({ length: args.session_storage.length }, (_, index) => args.session_storage!.key(index))
      .filter((key): key is string => !!key && (key.startsWith('argus:') || key.startsWith('sot_')));
    for (const key of keys) {
      args.session_storage.removeItem(key);
      sessionKeys.push(key);
    }
  }
  return {
    account_id: args.account_id,
    outbox_records_removed: outboxRemoved,
    caches_removed: cachesRemoved.sort(),
    session_keys_removed: sessionKeys.sort(),
    completed_at: args.now ?? new Date().toISOString(),
  };
}

export async function purgeCurrentBrowserContinuity(accountId: string): Promise<BrowserLifecycleReceipt> {
  if (typeof indexedDB === 'undefined') {
    return {
      account_id: accountId, outbox_records_removed: 0, caches_removed: [], session_keys_removed: [],
      completed_at: new Date().toISOString(),
    };
  }
  return purgeBrowserAccountContinuity({
    account_id: accountId,
    outbox: new IndexedDbAuthorityCommandOutbox(indexedDB),
    cache_storage: typeof caches === 'undefined' ? undefined : caches,
    session_storage: typeof sessionStorage === 'undefined' ? undefined : sessionStorage,
  });
}
