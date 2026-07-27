import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setAppsCapability, resetAppsCapability, withUiMeta, appsResourceListEntry, readAppsResource, SETTLE_APP_URI, UI_MIME } from '../apps-ui.js';
import { SETTLE_APP_HTML } from '../apps-ui-html.js';
import { listResources, readResource } from '../../resources.js';
import { setElicitor } from '../elicit.js';
import { seal } from '../../tools/seal.js';
import { settle } from '../../tools/settle.js';

/**
 * MCP Apps 정산 카드 (SEP-1865) — 배선 계약.
 *
 * 무엇이 이걸 빨간불로 만드나: ①카드 리소스가 목록/읽기에서 빠진다 ②HTML이
 * 외부 원점을 참조한다(기본 CSP가 차단해 조용히 깨짐) ③캐퍼빌리티 없는
 * 호스트의 툴 목록/정산 흐름이 변한다(회귀) ④캐퍼빌리티 있는 호스트에서
 * outcome 없는 정산이 elicitation으로 새거나 awaiting_picker 데이터가 빈다.
 */

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'argus-apps-'));
});
afterEach(() => {
  resetAppsCapability();
  setElicitor(null);
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('settle card resource', () => {
  it('is listed with the spec mime and readable as self-contained HTML', () => {
    const listed = listResources().resources.find((r) => r.uri === SETTLE_APP_URI);
    expect(listed?.mimeType).toBe(UI_MIME);
    const read = readResource(SETTLE_APP_URI);
    const text = read.contents[0]?.text ?? '';
    expect(read.contents[0]?.mimeType).toBe(UI_MIME);
    expect(text).toContain('ui/initialize');
    expect(text).toContain('tools/call');
    expect(text).toContain('argus_resolve');
  });

  it('references no external origin (default restrictive CSP must suffice)', () => {
    expect(SETTLE_APP_HTML).not.toMatch(/https?:\/\//);
    expect(SETTLE_APP_HTML).not.toMatch(/<link\s/i);
    expect(SETTLE_APP_HTML).not.toMatch(/src\s*=\s*["'](?!data:)/i);
  });

  it('carries both voices and all five reality outcomes', () => {
    for (const o of ['held', 'avoided', 'partial', 'still_pending', 'missed']) expect(SETTLE_APP_HTML).toContain(o);
    expect(SETTLE_APP_HTML).toContain('예측대로');
    expect(SETTLE_APP_HTML).toContain('지금은 넘어가기'); // friction escape stays visible
  });

  it('readAppsResource ignores foreign uris', () => {
    expect(readAppsResource('argus://ledger')).toBeNull();
  });
});

describe('tool _meta.ui link', () => {
  const tools = [{ name: 'argus_resolve' }, { name: 'argus_predict' }];

  it('absent without the declared extension (non-apps hosts see the old list)', () => {
    expect(withUiMeta(tools)).toEqual(tools);
  });

  it('attaches only to argus_resolve when the client declared the extension', () => {
    setAppsCapability(() => true);
    const out = withUiMeta(tools) as Array<Record<string, unknown>>;
    expect((out[0] as { _meta?: { ui?: { resourceUri?: string } } })._meta?.ui?.resourceUri).toBe(SETTLE_APP_URI);
    expect('_meta' in out[1]!).toBe(false);
  });

  it('entry shape matches the spec fields', () => {
    expect(appsResourceListEntry()).toMatchObject({ uri: SETTLE_APP_URI, mimeType: UI_MIME });
  });
});

describe('settle awaiting_picker path', () => {
  async function sealOne(): Promise<void> {
    await seal.handler({ argus_dir: dir, id: 'card', predicate: '신규 온보딩 개편으로 D7 잔존이 25%를 넘는다', check_by: '2026-07-20', predicate_owner: 'user', today_override: '2026-07-01' });
  }

  it('apps host + no outcome → awaiting card data, and elicitation is NEVER touched', async () => {
    setAppsCapability(() => true);
    setElicitor(() => { throw new Error('elicit must not fire when the card is up'); }, () => true);
    await sealOne();
    const r = await settle.handler({ argus_dir: dir, id: 'card', today_override: '2026-07-27' });
    const data = (r.structuredContent as { data?: Record<string, unknown> }).data ?? {};
    expect(data['status']).toBe('awaiting_picker');
    expect(data['predicate']).toContain('D7 잔존');
    expect(data['check_by']).toBe('2026-07-20');
    expect(data['days_overdue']).toBe(7);
    expect(data['locale']).toBe('ko');
  });

  it('apps host + outcome present → settles normally (the card click round-trip)', async () => {
    setAppsCapability(() => true);
    await sealOne();
    const r = await settle.handler({ argus_dir: dir, id: 'card', outcome: 'held', outcome_source: 'user_stated', what_happened: 'D7 잔존 27%로 마감', today_override: '2026-07-27' });
    const sc = r.structuredContent as { ok?: boolean; data?: Record<string, unknown> };
    expect(sc.ok).toBe(true);
    expect(sc.data?.['outcome']).toBe('held');
    expect(sc.data?.['what_happened_echo']).toBe('D7 잔존 27%로 마감');
  });

  it('non-apps host is byte-identically on the old path (honest OUTCOME_REQUIRED without elicitation)', async () => {
    await sealOne();
    const r = await settle.handler({ argus_dir: dir, id: 'card', today_override: '2026-07-27' });
    const sc = r.structuredContent as { ok?: boolean; error_code?: string };
    expect(sc.ok).toBe(false);
    expect(sc.error_code).toBe('OUTCOME_REQUIRED');
  });
});
