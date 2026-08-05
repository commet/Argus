// 원격 MCP 전송 계층 테스트 — 실제 JSON-RPC 페이로드로.
//
// 이 계층을 SDK 대신 직접 구현했으므로(protocol.ts 상단의 판단 참조), 사양
// 준수를 테스트가 대신 보증해야 한다. 각 케이스는 "클라이언트가 실제로 보내는
// 바이트"를 그대로 쓴다.

import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  isJsonRpcRequest,
  negotiateVersion,
  rpcError,
  rpcResult,
  RPC,
  SUPPORTED_PROTOCOL_VERSIONS,
  toolText,
} from '../protocol';
import { DELIBERATELY_ABSENT, TOOLS } from '../tools';

describe('JSON-RPC 봉투', () => {
  it('진짜 요청만 요청으로 인정한다', () => {
    expect(isJsonRpcRequest({ jsonrpc: '2.0', id: 1, method: 'initialize' })).toBe(true);
    expect(isJsonRpcRequest({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBe(true); // notification
    expect(isJsonRpcRequest({ jsonrpc: '1.0', id: 1, method: 'x' })).toBe(false);
    expect(isJsonRpcRequest({ id: 1, method: 'x' })).toBe(false);
    expect(isJsonRpcRequest('nope')).toBe(false);
    expect(isJsonRpcRequest(null)).toBe(false);
  });

  it('id가 0이나 빈 문자열이어도 유효한 id다 (falsy 함정)', () => {
    expect(rpcResult(0, {}).id).toBe(0);
    expect(rpcResult('', {}).id).toBe('');
  });

  it('오류 응답은 result를 갖지 않고, 정상 응답은 error를 갖지 않는다', () => {
    const err = rpcError(1, RPC.METHOD_NOT_FOUND, 'nope');
    expect(err).not.toHaveProperty('result');
    expect(err.error.code).toBe(-32601);
    const ok = rpcResult(1, { a: 1 });
    expect(ok).not.toHaveProperty('error');
  });
});

describe('프로토콜 버전 협상', () => {
  it('클라이언트가 지원 목록의 버전을 요청하면 그 버전으로 답한다', () => {
    for (const v of SUPPORTED_PROTOCOL_VERSIONS) {
      expect(negotiateVersion(v)).toBe(v);
    }
  });

  it('모르는/없는 버전이면 최신으로 답한다 (침묵 실패 금지)', () => {
    expect(negotiateVersion('1999-01-01')).toBe(SUPPORTED_PROTOCOL_VERSIONS[0]);
    expect(negotiateVersion(undefined)).toBe(SUPPORTED_PROTOCOL_VERSIONS[0]);
    expect(negotiateVersion(42)).toBe(SUPPORTED_PROTOCOL_VERSIONS[0]);
  });
});

describe('도구 결과 형태', () => {
  it('실패는 프로토콜 오류가 아니라 result 안의 isError로 보고된다', () => {
    const r = toolText('실패했습니다', true);
    expect(r.isError).toBe(true);
    expect(r.content[0]).toEqual({ type: 'text', text: '실패했습니다' });
  });

  it('성공에는 isError 키 자체가 없다', () => {
    expect(toolText('좋아요')).not.toHaveProperty('isError');
  });
});

describe('도구 표면 (기획서 §4 — 여섯 개 고정)', () => {
  it('정확히 여섯 개이고 이름이 확정돼 있다', () => {
    expect(TOOLS.map((t) => t.name).sort()).toEqual([
      'argus_adopt',
      'argus_open',
      'argus_plan',
      'argus_recall',
      'argus_return',
      'argus_sharpen',
    ]);
  });

  it('모든 도구가 설명과 입력 스키마를 갖는다 — 모델이 읽는 유일한 사양이다', () => {
    for (const t of TOOLS) {
      expect(t.description.length, t.name).toBeGreaterThan(30);
      expect(t.inputSchema.type, t.name).toBe('object');
    }
  });

  it('금지된 도구는 존재하지 않으며, 왜 없는지가 기록돼 있다', () => {
    const names = new Set(TOOLS.map((t) => t.name));
    for (const forbidden of Object.keys(DELIBERATELY_ABSENT)) {
      expect(names.has(forbidden), `${forbidden}은(는) 만들면 안 된다`).toBe(false);
    }
    expect(Object.keys(DELIBERATELY_ABSENT)).toContain('argus_host_approve');
  });

  it('채택 도구의 설명이 "사용자 명시 행위"를 못박는다 (§11.2)', () => {
    const adopt = TOOLS.find((t) => t.name === 'argus_adopt')!;
    expect(adopt.description).toMatch(/명시적|사용자/);
    expect(adopt.description).toMatch(/호스트의 승인으로 대신할 수 없다|대신할 수 없다/);
  });

  it('돌아보기 도구의 설명이 관찰-우선 순서를 못박는다 (§7.3)', () => {
    const ret = TOOLS.find((t) => t.name === 'argus_return')!;
    expect(ret.description).toMatch(/먼저 실제로 무슨 일/);
    expect(ret.description).toMatch(/오염/);
  });

  it('계획 도구가 채택 이후에만 도는 것으로 선언돼 있다 (process 추천 경계)', () => {
    const plan = TOOLS.find((t) => t.name === 'argus_plan')!;
    expect(plan.description).toMatch(/채택/);
    expect(plan.description).toMatch(/확인 필요/); // 정직한 공백
  });
});

// initialize 의 instructions 는 호스트가 모델 맥락에 얹는 **유일한** 사양이다.
// 여기 없는 것은 모델이 하지 않으므로, 이 문자열이 전략을 담고 있어야 한다.
describe('서버 지시문 (모델이 읽는 유일한 사양)', () => {
  // route.ts 를 직접 import 하면 next/server 와 인증 배관이 딸려 온다.
  // 여기서 재는 것은 문자열이므로 소스에서 읽는다.
  const routeSrc = readFileSync(join(__dirname, '..', 'route.ts'), 'utf8');

  it('침묵이 기본값임을 못박는다 (과발화 방지)', () => {
    expect(routeSrc).toMatch(/침묵이 기본값/);
    expect(routeSrc).toMatch(/평평한 상황/);
  });

  it('조언보다 지난 정산을 먼저 보라고 말한다 — 없으면 argus_recall 은 영영 불리지 않는다', () => {
    expect(routeSrc).toMatch(/조언하기 전에 argus_recall 을 먼저/);
  });

  it('대신 결정하지 않는다는 것과 관찰 우선 순서를 담는다', () => {
    expect(routeSrc).toMatch(/대신 결정하지 않습니다/);
    expect(routeSrc).toMatch(/무슨 일이 있었는지부터 듣습니다/);
  });

  it('사용자 점수·등급 금지를 담는다 (zero-judgment 규칙 2)', () => {
    expect(routeSrc).toMatch(/점수 매기거나 등급을 붙이지 않습니다/);
  });
});
