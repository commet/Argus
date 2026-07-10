import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  telemetryEnabled,
  buildEvent,
  telemetryInstallId,
  recordToolCall,
  recordServerStart,
  type TelemetryEnv,
} from '../telemetry.js';

describe('telemetry opt-in gate', () => {
  it('is OFF by default (no env) — honors the "no network without a token" promise', () => {
    expect(telemetryEnabled({})).toBe(false);
  });

  it('turns on only for explicit on-values of ARGUS_TELEMETRY', () => {
    for (const v of ['1', 'true', 'on', 'yes', 'YES', 'On']) {
      expect(telemetryEnabled({ ARGUS_TELEMETRY: v })).toBe(true);
    }
    for (const v of ['0', 'false', 'off', 'no', '', 'maybe']) {
      expect(telemetryEnabled({ ARGUS_TELEMETRY: v })).toBe(false);
    }
  });

  it('DO_NOT_TRACK hard-disables even when ARGUS_TELEMETRY=1', () => {
    expect(telemetryEnabled({ ARGUS_TELEMETRY: '1', DO_NOT_TRACK: '1' })).toBe(false);
    expect(telemetryEnabled({ ARGUS_TELEMETRY: '1', DO_NOT_TRACK: 'true' })).toBe(false);
    // DO_NOT_TRACK unset / off does not force-disable an opted-in user
    expect(telemetryEnabled({ ARGUS_TELEMETRY: '1', DO_NOT_TRACK: '0' })).toBe(true);
  });
});

describe('telemetry payload is anonymous and content-free', () => {
  const ALLOWED_KEYS = new Set(['install_id', 'event', 'version', 'platform', 'node_major', 'tool', 'ok']);

  it('only ever carries the allow-listed keys — no user-authored data can leak', () => {
    const e = buildEvent('tool_call', 'anon-id', { tool: 'argus_seal', ok: true });
    for (const k of Object.keys(e)) expect(ALLOWED_KEYS.has(k)).toBe(true);
    // The things that must NEVER appear:
    for (const forbidden of ['argus_dir', 'token', 'predicate', 'title', 'path', 'content', 'user_id']) {
      expect(e).not.toHaveProperty(forbidden);
    }
  });

  it('caps the tool name and omits ok when not a boolean', () => {
    const long = 'x'.repeat(200);
    const e = buildEvent('tool_call', 'anon-id', { tool: long });
    expect(e.tool!.length).toBe(64);
    expect(e).not.toHaveProperty('ok');
  });

  it('server_start carries no tool/ok', () => {
    const e = buildEvent('server_start', 'anon-id');
    expect(e.event).toBe('server_start');
    expect(e).not.toHaveProperty('tool');
    expect(e).not.toHaveProperty('ok');
    expect(typeof e.version).toBe('string');
    expect(typeof e.platform).toBe('string');
    expect(typeof e.node_major).toBe('number');
  });
});

describe('anonymous install id', () => {
  it('is a random UUID, stable across reads, and stored under the given dir only', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-tele-'));
    try {
      const first = telemetryInstallId(dir);
      expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      // Persisted and returned identically on the next read.
      expect(telemetryInstallId(dir)).toBe(first);
      expect(fs.existsSync(path.join(dir, '.telemetry-id'))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('recorders never throw and no-op when disabled', () => {
  const disabled: TelemetryEnv = {}; // opt-in default off → no fs write, no network

  it('recordToolCall is a safe no-op when telemetry is off', () => {
    expect(() => recordToolCall('argus_seal', true, disabled)).not.toThrow();
  });

  it('recordServerStart is a safe no-op when telemetry is off', () => {
    expect(() => recordServerStart(disabled)).not.toThrow();
  });
});
