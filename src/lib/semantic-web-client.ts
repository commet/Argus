import { getSessionWithTimeout } from '@/lib/supabase';
import type { SemanticWebCommand } from '@/lib/semantic-web';

export class SemanticLedgerClientError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'SemanticLedgerClientError';
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const session = await getSessionWithTimeout();
  if (!session?.access_token) throw new SemanticLedgerClientError('NOT_SIGNED_IN');
  return { Authorization: `Bearer ${session.access_token}` };
}

async function bodyOrThrow(response: Response): Promise<{ events?: unknown[]; error?: string }> {
  let body: { events?: unknown[]; error?: string } = {};
  try { body = await response.json(); } catch { /* surface status below */ }
  if (!response.ok) throw new SemanticLedgerClientError(body.error ?? `HTTP_${response.status}`);
  return body;
}

export async function loadProjectSemanticEvents(projectId: string): Promise<unknown[]> {
  const response = await fetch(`/api/semantic/projects/${encodeURIComponent(projectId)}/events`, {
    headers: await authHeaders(),
    cache: 'no-store',
  });
  return (await bodyOrThrow(response)).events ?? [];
}

export async function submitProjectSemanticCommand(projectId: string, command: SemanticWebCommand, recordedAt = new Date().toISOString()): Promise<unknown[]> {
  const response = await fetch(`/api/semantic/projects/${encodeURIComponent(projectId)}/events`, {
    method: 'POST',
    headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, recorded_at: recordedAt }),
  });
  return (await bodyOrThrow(response)).events ?? [];
}
