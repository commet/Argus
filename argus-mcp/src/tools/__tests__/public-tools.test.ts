import { describe, expect, it } from 'vitest';
import fs from 'fs';
import { PUBLIC_TOOLS, TOOL_MAP } from '../index.js';
import { decide, history, settings } from '../public-tools.js';
import { body, isError, tmpArgusDir } from '../../test-helpers.js';
import { configPath } from '../../lib/layout.js';
import { toolJsonSchema } from '../tool-types.js';

describe('purpose-led public MCP surface', () => {
  it('exposes six user purposes while legacy tools remain callable aliases', () => {
    expect(PUBLIC_TOOLS.map((tool) => tool.name)).toEqual([
      'argus_capture', 'argus_predict', 'argus_check_in',
      'argus_resolve', 'argus_patterns', 'argus_settings',
    ]);
    expect(TOOL_MAP.has('argus_premises')).toBe(true);
    expect(TOOL_MAP.has('argus_recheck')).toBe(true);
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

    const recalled = await history.handler({ argus_dir: dir, view: 'decision_context', id: 'career', today_override: '2026-07-13' });
    expect(isError(recalled)).toBe(false);
    expect(body(recalled)['tool']).toBe('argus_patterns');
    const rows = ((body(recalled)['data'] as Record<string, unknown>)['premises'] as unknown[]);
    expect(rows).toHaveLength(1);
  });

  it('updates locale through the one public settings tool', async () => {
    const dir = tmpArgusDir();
    const updated = await settings.handler({ argus_dir: dir, action: 'update', locale: 'en', ambient_mute: true });
    expect(isError(updated)).toBe(false);
    expect(body(updated)['tool']).toBe('argus_settings');
    expect(fs.readFileSync(configPath(dir), 'utf8')).toContain('locale: en');
    expect(fs.readFileSync(configPath(dir), 'utf8')).toContain('ambient_mute: true');
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

  it('gives every public field a Korean explanation', () => {
    const missing: string[] = [];
    const visit = (toolName: string, node: unknown, path = ''): void => {
      if (!node || typeof node !== 'object') return;
      const record = node as Record<string, unknown>;
      const properties = record.properties;
      if (properties && typeof properties === 'object') {
        for (const [key, raw] of Object.entries(properties as Record<string, unknown>)) {
          const field = raw as Record<string, unknown>;
          if (!/[가-힣]/.test(String(field.description ?? ''))) missing.push(`${toolName}:${path}${key}`);
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
