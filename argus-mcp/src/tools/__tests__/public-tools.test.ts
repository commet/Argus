import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'node:os';
import path from 'node:path';
import { PUBLIC_TOOLS, TOOL_MAP } from '../index.js';
import { decide, history, settings } from '../public-tools.js';
import { body, isError, tmpArgusDir } from '../../test-helpers.js';
import { configPath } from '../../lib/layout.js';
import { toolJsonSchema } from '../tool-types.js';

describe('purpose-led public MCP surface', () => {
  it('exposes exactly six user purposes and rejects legacy aliases', () => {
    expect(PUBLIC_TOOLS.map((tool) => tool.name)).toEqual([
      'argus_capture', 'argus_predict', 'argus_check_in',
      'argus_resolve', 'argus_patterns', 'argus_settings',
    ]);
    expect(TOOL_MAP.has('argus_record')).toBe(false);
    expect(TOOL_MAP.has('argus_premises')).toBe(false);
    expect(TOOL_MAP.has('argus_recheck')).toBe(false);
    expect(PUBLIC_TOOLS.some((tool) => tool.name === 'argus_premises')).toBe(false);
  });

  it('auto-initializes in the first decision language and records supplied premises', async () => {
    const dir = tmpArgusDir();
    const result = await decide.handler({
      argus_dir: dir,
      action: 'open',
      id: 'career',
      decision: '이직 제안을 받아들일지 결정한다',
      stakes: 'high',
      reversibility: 'costly_to_reverse',
      status_quo: '현재 회사에 남는다',
      premises: [{
        text: '새 팀의 핵심 프로젝트가 내년에도 유지된다',
        kind: 'premise',
        external: true,
        load_bearing: true,
        source: 'user_stated',
      }],
      today_override: '2026-07-13',
    });
    expect(isError(result)).toBe(false);
    expect(fs.readFileSync(configPath(dir), 'utf8')).toContain('locale: ko');
    expect(body(result)['tool']).toBe('argus_capture');
    expect(String(body(result)['surface'])).toMatch(/[가-힣]/);
    // The premise-add result is spliced into this surface RAW (outside runPublic),
    // so it must be publicCopy'd or it leaks the internal name "argus_premises".
    // Guard the whole merged result, not just the surface.
    expect(JSON.stringify(body(result))).not.toMatch(/argus_(premises|seal|settle|open_decision|recall|watch|init)\b/);

    const recalled = await history.handler({ argus_dir: dir, view: 'decision_context', id: 'career', today_override: '2026-07-13' });
    expect(isError(recalled)).toBe(false);
    expect(body(recalled)['tool']).toBe('argus_patterns');
    const rows = ((body(recalled)['data'] as Record<string, unknown>)['premises'] as unknown[]);
    expect(rows).toHaveLength(1);
  });

  it('update_fact works WITHOUT source — schema defaults to user_stated (1.4.1 regression)', async () => {
    // The runtime union validates before the handler-level default can apply, so
    // a required `source` made every real update_fact call fail INVALID_INPUT.
    const dir = tmpArgusDir();
    await decide.handler({
      argus_dir: dir, action: 'open', id: 'uf-src', decision: '재확인 스키마 테스트',
      status_quo: '그대로', stakes: 'low', reversibility: 'easily_reversible',
      premises: [{ text: '재료 수급이 안정적이다', kind: 'premise', external: true, load_bearing: true, source: 'user_stated' }],
    });
    const r = await decide.handler({
      argus_dir: dir, action: 'update_fact', id: 'uf-src', ref: 'P1',
      finding: '하루 지연되지만 기한 안에는 도착', changed: false,
    });
    expect(isError(r)).toBe(false);
  });

  it('turns premise monitoring off without erasing importance or verifiability', async () => {
    const dir = tmpArgusDir();
    await decide.handler({
      argus_dir: dir,
      action: 'open',
      id: 'monitoring-separation',
      decision: 'whether to sign the long supplier contract',
      status_quo: 'keep the current monthly contract',
      stakes: 'high',
      reversibility: 'costly_to_reverse',
      premises: [{
        text: 'the supplier keeps the quoted capacity through next year',
        kind: 'premise',
        external: true,
        load_bearing: true,
        monitoring_enabled: true,
        source: 'user_stated',
      }],
    });

    const amended = await decide.handler({
      argus_dir: dir,
      action: 'amend_context',
      id: 'monitoring-separation',
      ref: 'P1',
      amendment: 'accept',
      monitoring_enabled: false,
    });
    expect(isError(amended)).toBe(false);

    const recalled = await history.handler({
      argus_dir: dir,
      view: 'decision_context',
      id: 'monitoring-separation',
    });
    const row = (((body(recalled)['data'] as Record<string, unknown>)['premises']) as Array<Record<string, unknown>>)[0];
    expect(row['external']).toBe(true);
    expect(row['load_bearing']).toBe(true);
    expect(row['monitored']).toBe(false);
  });

  it('records supplied premises even on a low-stakes (restraint) open — record is never gated by ceremony', async () => {
    // Regression: on a flat/low-stakes open the over-fire gate does NOT fire,
    // and the premise-recording used to sit behind that gate → user premises
    // were silently dropped (no error, nothing to re-check later).
    const dir = tmpArgusDir();
    const result = await decide.handler({
      argus_dir: dir,
      action: 'open',
      id: 'ci-switch',
      decision: 'switch CI to GitHub Actions',
      stakes: 'low',
      reversibility: 'easily_reversible',
      status_quo: 'stay on the current CI',
      premises: [{
        text: 'our build stays under 10 minutes',
        kind: 'premise',
        external: true,
        load_bearing: true,
        source: 'user_stated',
      }],
      today_override: '2026-07-13',
    });
    expect(isError(result)).toBe(false);
    const recalled = await history.handler({ argus_dir: dir, view: 'decision_context', id: 'ci-switch', today_override: '2026-07-13' });
    const rows = ((body(recalled)['data'] as Record<string, unknown>)['premises'] as unknown[]);
    expect(rows).toHaveLength(1); // must survive the restraint path
  });

  it('updates locale through the one public settings tool', async () => {
    const dir = tmpArgusDir();
    const updated = await settings.handler({ argus_dir: dir, action: 'update', locale: 'en', ambient_mute: true });
    expect(isError(updated)).toBe(false);
    expect(body(updated)['tool']).toBe('argus_settings');
    expect(fs.readFileSync(configPath(dir), 'utf8')).toContain('locale: en');
    expect(fs.readFileSync(configPath(dir), 'utf8')).toContain('ambient_mute: true');
  });

  it('uses settings status as the one public repair handle for a missing v2 binding', async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-public-repair-'));
    const dir = path.join(repo, '.argus');
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    try {
      const first = await settings.handler({ argus_dir: dir, action: 'status' });
      expect(isError(first)).toBe(false);
      const binding = path.join(dir, 'project.json');
      expect(fs.existsSync(binding)).toBe(true);

      fs.rmSync(binding);
      const repaired = await settings.handler({ argus_dir: dir, action: 'status' });
      expect(isError(repaired)).toBe(false);
      expect(fs.existsSync(binding)).toBe(true);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it('does not leak hidden tool names through public result copy', async () => {
    const dir = tmpArgusDir();
    const saved = await TOOL_MAP.get('argus_predict')!.handler({
      argus_dir: dir,
      id: 'launch',
      predicate: '다음 달까지 베타를 공개한다',
      check_by: '2026-08-20',
      predicate_owner: 'user',
      today_override: '2026-07-13',
    });
    const serialized = JSON.stringify(body(saved));
    expect(serialized).not.toMatch(/argus_(seal|settle|recall|premises|recheck|open_decision)/);
    expect(body(saved)['tool']).toBe('argus_predict');
  });

  it('never rewrites a user sentence that happens to contain an old tool name', async () => {
    const dir = tmpArgusDir();
    const predicate = 'argus_init 문서를 2026년 8월까지 새 안내로 교체한다';
    const saved = await TOOL_MAP.get('argus_predict')!.handler({
      argus_dir: dir,
      id: 'rename-docs',
      predicate,
      check_by: '2026-08-20',
      predicate_owner: 'user',
      today_override: '2026-07-13',
    });
    expect(isError(saved)).toBe(false);
    const serialized = JSON.stringify(body(saved));
    expect(serialized).toContain(predicate);
    expect(serialized).not.toContain('argus_settings 문서를');
  });

  it('gives every public field one Korean and one English explanation', () => {
    const missing: string[] = [];
    const visit = (toolName: string, node: unknown, path = ''): void => {
      if (!node || typeof node !== 'object') return;
      const record = node as Record<string, unknown>;
      const properties = record.properties;
      if (properties && typeof properties === 'object') {
        for (const [key, raw] of Object.entries(properties as Record<string, unknown>)) {
          const field = raw as Record<string, unknown>;
          const description = String(field.description ?? '');
          const [ko = '', en = ''] = description.split('\n\n');
          if (!/[가-힣]/.test(ko) || !/[A-Za-z]{3}/.test(en)) missing.push(`${toolName}:${path}${key}`);
          visit(toolName, field, `${path}${key}.`);
        }
      }
      if (record.items) visit(toolName, record.items, path);
      for (const branch of ['anyOf', 'oneOf', 'allOf']) {
        if (Array.isArray(record[branch])) {
          for (const child of record[branch] as unknown[]) visit(toolName, child, path);
        }
      }
    };
    for (const tool of PUBLIC_TOOLS) visit(tool.name, toolJsonSchema(tool.inputSchema));
    expect(missing).toEqual([]);
  });
});

describe('INVALID_INPUT names a reason, not a dead end (§8 미제 — U8-3 payload)', () => {
  // The exact shape a journey run failed on five times in a row: action=open
  // with status_quo missing. The public schema's superRefine used to re-add
  // every inner issue as code:'custom', which the localizer's per-code switch
  // does not know — so the user got "status_quo: 값을 확인해 주세요" with no
  // reason. The repair forwards the inner issue AS-IS.
  const u83 = {
    argus_dir: '/tmp/x', action: 'open', id: 'vendor-choice',
    decision: '공급사를 A로 바꾼다', stakes: 'moderate', reversibility: 'costly_to_reverse',
  };

  it('preserves the inner issue code through the public superRefine', () => {
    const parsed = decide.inputSchema.safeParse(u83);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const statusQuo = parsed.error.issues.find((i) => i.path.join('.') === 'status_quo');
    expect(statusQuo).toBeDefined();
    // The laundering bug turned every inner code into 'custom'; the whole point
    // of the repair is that the real code survives so per-code copy can speak.
    expect(statusQuo?.code).not.toBe('custom');
    expect(statusQuo?.code).toBe('invalid_type');
  });

  it('yields an actionable localized reason in both locales, with no raw Zod prose', async () => {
    const { localizeToolResult } = await import('../../lib/localize-result.js');
    const parsed = decide.inputSchema.safeParse(u83);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    // Mirror server.ts's structural mapping (the contract this test guards).
    const invalidFields = parsed.error.issues.map((i) => {
      const raw = i as unknown as Record<string, unknown>;
      return {
        field: i.path.join('.') || '(root)',
        code: i.code,
        message: i.message,
        ...(typeof raw['minimum'] === 'number' ? { minimum: raw['minimum'] } : {}),
        ...(raw['expected'] !== undefined ? { expected: String(raw['expected']) } : {}),
        ...(raw['origin'] !== undefined ? { origin: String(raw['origin']) } : {}),
      };
    });
    // Locale resolves from the CALL ARGS (server.ts hands the original args in)
    // — Korean text in the payload → Korean surface; English text → English.
    const envelope = (callArgs: Record<string, unknown>) => localizeToolResult(callArgs, {
      content: [{ type: 'text' as const, text: '' }],
      structuredContent: {
        ok: false, tool: 'argus_capture', error_code: 'INVALID_INPUT',
        message: 'Invalid arguments.', invalid_fields: invalidFields,
        recovery: 'Fix the named argument(s) and call the same tool again.',
      },
      isError: true,
    });
    const ko = String((envelope(u83).structuredContent as Record<string, unknown>)['message']);
    const en = String((envelope({ ...u83, decision: 'switch our supplier to A' }).structuredContent as Record<string, unknown>)['message']);
    // Named field + a real reason (required/type), in place of the dead end.
    expect(ko).toContain('status_quo');
    expect(ko).not.toContain('값을 확인해 주세요');
    expect(ko).toMatch(/필수|형식/);
    expect(en).toContain('status_quo');
    expect(en).not.toContain('needs checking');
    expect(en).toMatch(/required/);
    // The previous repair attempt leaked raw Zod internals — never again.
    expect(ko).not.toMatch(/received undefined|expected string,/);
    expect(en).not.toMatch(/received undefined|expected string,/);
  });
});
