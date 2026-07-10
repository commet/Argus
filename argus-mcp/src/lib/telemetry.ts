import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { packageMeta } from './package-meta.js';

/**
 * Anonymous, OPT-IN operational telemetry (see SECURITY.md → "Telemetry").
 *
 * OFF by default. The server makes NO telemetry network call unless the user
 * explicitly sets `ARGUS_TELEMETRY=1`, so the original promise — "with no
 * ARGUS_TOKEN the server makes no network calls" — still holds for everyone who
 * never opts in. `DO_NOT_TRACK=1` hard-disables it even if the flag is on.
 *
 * When ON, it sends ONLY:
 *   - a random, machine-local install id (`~/.argus/.telemetry-id`) — NOT a
 *     device fingerprint, NOT tied to your account/token, and regenerable by
 *     deleting the file;
 *   - which of OUR tools ran (the tool name) and whether it succeeded;
 *   - the MCP version, coarse OS platform, and Node major.
 *
 * It NEVER sends decision content, titles, predicates, file paths, `argus_dir`,
 * the account token, or anything user-authored. Fire-and-forget: it never blocks
 * a tool result and never throws — every path degrades to a silent no-op.
 */

const ENDPOINT_PATH = '/api/mcp/telemetry';
const TIMEOUT_MS = 3000;
const ON_VALUES = new Set(['1', 'true', 'on', 'yes']);

export type TelemetryEnv = Record<string, string | undefined>;

/**
 * OPT-IN gate: enabled only when ARGUS_TELEMETRY is an on-value AND DO_NOT_TRACK
 * is not set. DO_NOT_TRACK (https://consoledonottrack.com) always wins.
 */
export function telemetryEnabled(env: TelemetryEnv = process.env): boolean {
  const dnt = (env.DO_NOT_TRACK || '').trim().toLowerCase();
  if (ON_VALUES.has(dnt)) return false; // hard override — user opted out globally
  const flag = (env.ARGUS_TELEMETRY || '').trim().toLowerCase();
  return ON_VALUES.has(flag);
}

export interface TelemetryEvent {
  install_id: string;
  event: 'server_start' | 'tool_call';
  version: string;
  platform: string;
  node_major: number;
  tool?: string;
  ok?: boolean;
}

/**
 * Build the wire payload — pure and PII-free by construction (easy to assert in
 * tests: the key set is fixed and carries no user-authored data).
 */
export function buildEvent(
  event: TelemetryEvent['event'],
  installId: string,
  opts: { tool?: string; ok?: boolean } = {},
): TelemetryEvent {
  const nodeMajor = Number((process.versions.node || '0').split('.')[0]) || 0;
  const e: TelemetryEvent = {
    install_id: installId,
    event,
    version: packageMeta().version,
    platform: process.platform, // 'darwin' | 'linux' | 'win32' — coarse, not PII
    node_major: nodeMajor,
  };
  if (opts.tool) e.tool = opts.tool.slice(0, 64);
  if (typeof opts.ok === 'boolean') e.ok = opts.ok;
  return e;
}

function argusHome(): string {
  return path.join(os.homedir(), '.argus');
}

/**
 * Read (or lazily create) the anonymous install id. Only called when telemetry
 * is enabled, so an opted-out user never gets this file written. `baseDir` is
 * injectable for tests; production uses `~/.argus`.
 */
export function telemetryInstallId(baseDir: string = argusHome()): string {
  const p = path.join(baseDir, '.telemetry-id');
  try {
    const raw = fs.readFileSync(p, 'utf8').trim();
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(raw)) return raw;
  } catch {
    /* first run */
  }
  const fresh = randomUUID();
  try {
    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(p, fresh + '\n', 'utf8');
  } catch {
    /* read-only home — fall through with the in-memory id */
  }
  return fresh;
}

/** One-time stderr confirmation of exactly what's sent and how to turn it off. */
function maybeShowNotice(baseDir: string = argusHome()): void {
  const p = path.join(baseDir, '.telemetry-notice');
  try {
    if (fs.existsSync(p)) return;
  } catch {
    return;
  }
  process.stderr.write(
    'argus-decision-mcp: anonymous telemetry is ON (ARGUS_TELEMETRY=1). It sends a random ' +
      'install id + which tool ran + version/platform — never your decisions, titles, file ' +
      'paths, or account token. Turn it off with ARGUS_TELEMETRY=0 (or DO_NOT_TRACK=1).\n',
  );
  try {
    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(p, 'shown\n', 'utf8');
  } catch {
    /* read-only home — the notice just shows again next run, harmless */
  }
}

/**
 * Resolve the telemetry endpoint base, https-enforced (localhost allowed for
 * local dev). A non-https override returns null → we skip the send. No token
 * rides on this channel, but cleartext egress stays disallowed by default.
 */
function resolveApiBase(env: TelemetryEnv): string | null {
  const raw = (env.ARGUS_API_URL || 'https://argus.voyage').replace(/\/+$/, '');
  try {
    const u = new URL(raw);
    const localhost = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1';
    if (u.protocol !== 'https:' && !localhost) return null;
    return raw;
  } catch {
    return null;
  }
}

async function send(event: TelemetryEvent, env: TelemetryEnv): Promise<void> {
  const base = resolveApiBase(env);
  if (!base) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(`${base}${ENDPOINT_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(event),
      signal: controller.signal,
    });
  } catch {
    /* telemetry is best-effort — a failed send never surfaces */
  } finally {
    clearTimeout(timer);
  }
}

/** Fire-and-forget process-activation signal. Never blocks, never throws. */
export function recordServerStart(env: TelemetryEnv = process.env): void {
  try {
    if (!telemetryEnabled(env)) return;
    maybeShowNotice();
    void send(buildEvent('server_start', telemetryInstallId()), env);
  } catch {
    /* telemetry must never affect the server */
  }
}

/** Fire-and-forget tool-usage signal. Never blocks the tool result, never throws. */
export function recordToolCall(tool: string, ok: boolean, env: TelemetryEnv = process.env): void {
  try {
    if (!telemetryEnabled(env)) return;
    maybeShowNotice();
    void send(buildEvent('tool_call', telemetryInstallId(), { tool, ok }), env);
  } catch {
    /* telemetry must never affect a tool call */
  }
}
