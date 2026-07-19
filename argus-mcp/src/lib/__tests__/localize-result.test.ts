import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { toolError } from '../envelope.js';
import { LOCALIZED_ERROR_CODES, localizeToolResult } from '../localize-result.js';
import { configPath } from '../layout.js';
import { tmpArgusDir, body } from '../../test-helpers.js';

function errorResult(code: string) {
  return toolError({
    ok: false,
    tool: 'argus_test',
    error_code: code,
    message: 'English diagnostic detail.',
    recovery: 'English recovery detail.',
  });
}

describe('dispatch-level MCP error localization', () => {
  it('localizes a known error when config pins Korean', () => {
    const dir = tmpArgusDir();
    fs.writeFileSync(configPath(dir), 'schema_version: 5\nlocale: ko\n', 'utf8');
    const result = localizeToolResult({ argus_dir: dir }, errorResult('PREMATURE_SETTLE'));
    expect(body(result)['message']).toBe('아직 확인일이 되지 않았습니다.');
    expect(String(body(result)['recovery'])).toContain('확인일');
    expect(result.content[0]?.text).not.toContain('English diagnostic');
  });

  it('uses Korean input when no config exists', () => {
    const result = localizeToolResult(
      { predicate: '출시 후 전환율이 10%를 넘는다' },
      errorResult('PROVENANCE_REQUIRED'),
    );
    expect(body(result)['message']).toContain('출처');
  });

  it('names the offending field and reason in Korean for INVALID_INPUT (not a generic collapse)', () => {
    const result = localizeToolResult(
      { predicate: '전환율 유지' },
      toolError({
        ok: false, tool: 'argus_predict', error_code: 'INVALID_INPUT',
        message: 'Invalid arguments. predicate: too small',
        invalid_fields: [{ field: 'predicate', code: 'too_small', minimum: 8, origin: 'string' }],
        recovery: 'English recovery detail.',
      } as never),
    );
    const message = String(body(result)['message']);
    // The Korean user must learn WHICH field and WHY — the piece the old
    // generic "입력값이 올바르지 않습니다" threw away.
    expect(message).toContain('predicate');
    expect(message).toContain('최소 8자');
    expect(result.content[0]?.text).not.toContain('English recovery detail');
  });

  it('falls back to the generic Korean INVALID_INPUT when no invalid_fields are present', () => {
    const result = localizeToolResult({ decision: '이 결정' }, errorResult('INVALID_INPUT'));
    expect(body(result)['message']).toBe('입력값이 올바르지 않습니다.');
  });

  it('keeps a handler-authored Korean message WITH its detail (INTERNAL_ERROR ko, 1.4.7)', () => {
    const result = localizeToolResult(
      { decision: '이 결정' },
      toolError({ ok: false, tool: 'argus_test', error_code: 'INTERNAL_ERROR', message: '내부 오류가 발생했습니다: EACCES /tmp/x', recovery: '같은 작업을 다시 시도하세요.' }),
    );
    // KO_ERRORS의 일반 문구가 핸들러의 한국어 상세를 덮어쓰지 않는다.
    expect(String(body(result)['message'])).toContain('EACCES /tmp/x');
  });

  it('carries the diagnostic detail across the language switch for an English INTERNAL_ERROR', () => {
    const result = localizeToolResult(
      { decision: '이 결정' },
      toolError({ ok: false, tool: 'argus_test', error_code: 'INTERNAL_ERROR', message: 'Internal error: ENOSPC no space left', recovery: 'Try again.' }),
    );
    const message = String(body(result)['message']);
    expect(message).toContain('내부 오류');
    expect(message).toContain('ENOSPC');
  });

  it('still replaces an English template that merely QUOTES Korean user text', () => {
    const result = localizeToolResult(
      { predicate: '매출 1억' },
      toolError({ ok: false, tool: 'argus_test', error_code: 'GOALPOST_MOVED', message: 'Sealed predicates cannot change: "매출 1억 넘는다"', recovery: 'Open a new decision.' }),
    );
    // 인용된 한국어만으로는 "한국어로 작성된 메시지"가 아니다 — ko 템플릿으로 교체.
    expect(String(body(result)['message'])).not.toContain('cannot change');
  });

  it('preserves the precise English diagnostic for English calls', () => {
    const result = localizeToolResult(
      { predicate: 'conversion exceeds ten percent' },
      errorResult('PROVENANCE_REQUIRED'),
    );
    expect(body(result)['message']).toBe('English diagnostic detail.');
    expect(body(result)['recovery']).toBe('English recovery detail.');
  });

  it('falls back safely for a new uncatalogued error code', () => {
    const result = localizeToolResult(
      { decision: '이 결정을 다시 볼까' },
      errorResult('NEW_UNCATALOGUED_ERROR'),
    );
    expect(body(result)['message']).toBe('요청을 처리하지 못했습니다.');
    expect(result.content[0]?.text).not.toContain('English diagnostic');
  });

  it('catalogs every literal tool error code with specific Korean recovery copy', () => {
    const toolsDir = fileURLToPath(new URL('../../tools', import.meta.url));
    const files = fs.readdirSync(toolsDir).filter((name) => name.endsWith('.ts'));
    const codes = new Set<string>();
    for (const file of files) {
      const source = fs.readFileSync(path.join(toolsDir, file), 'utf8');
      for (const match of source.matchAll(/error_code:\s*'([^']+)'/g)) codes.add(match[1]);
    }
    expect([...codes].filter((code) => !LOCALIZED_ERROR_CODES.has(code))).toEqual([]);
  });
});
