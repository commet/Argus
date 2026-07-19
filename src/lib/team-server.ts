import 'server-only';

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TeamRole = 'owner' | 'admin' | 'member';

export interface TeamRequestAuth {
  user: User;
  admin: SupabaseClient;
}

export interface TeamAccess {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  created_at: string;
}

export async function authenticateTeamRequest(req: NextRequest): Promise<TeamRequestAuth | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const header = req.headers.get('authorization');
  if (!url || !anonKey || !serviceKey || !header?.startsWith('Bearer ')) return null;

  const authClient = createClient(url, anonKey);
  const { data: { user }, error } = await authClient.auth.getUser(header.slice(7));
  if (error || !user) return null;
  return { user, admin: createClient(url, serviceKey) };
}

export async function getTeamAccess(
  admin: SupabaseClient,
  teamId: string,
  userId: string,
): Promise<TeamAccess | null> {
  const { data, error } = await admin
    .from('team_members')
    .select('id, team_id, user_id, role, created_at')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as TeamAccess;
}

export function canManageTeam(access: TeamAccess | null): boolean {
  return access?.role === 'owner' || access?.role === 'admin';
}

export function userDisplayName(user: User | null | undefined): string | null {
  if (!user) return null;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const value = meta?.full_name || meta?.name || meta?.display_name;
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 100) : null;
}

export async function getUsersById(admin: SupabaseClient, ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  const entries = await Promise.all(unique.map(async (id) => {
    const { data, error } = await admin.auth.admin.getUserById(id);
    return [id, error ? null : data.user] as const;
  }));
  return new Map(entries);
}

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function normalizeTeamName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  return name && name.length <= 50 ? name : null;
}

export function teamSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'team';
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}
