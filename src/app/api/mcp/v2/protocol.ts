// MCP over Streamable HTTP — 프로토콜 계층 (전송만, 방법은 하네스가 갖는다).
//
// 왜 SDK의 StreamableHTTPServerTransport를 쓰지 않는가 (2026-08-05 판단):
// SDK 전송기는 Node의 req/res 객체를 받도록 만들어져 있고, Next.js App Router의
// 라우트 핸들러는 Web 표준 Request/Response를 준다. 그 사이를 어댑터로 메우면
// 스트림 수명주기가 서버리스 함수 수명주기와 어긋나는 지점이 생긴다.
//
// 우리가 필요한 표면은 좁다: stateless 요청/응답, 서버가 먼저 말하지 않고
// (샘플링·알림 없음), 도구 6개. 그 부분의 JSON-RPC는 사양이 명확하고 작으므로
// 직접 구현하고 실제 페이로드로 테스트한다. 서버가 클라이언트에게 먼저 말해야
// 하는 기능이 생기면 그때 SSE와 SDK 전송기를 다시 검토한다.

export const PROTOCOL_VERSION = '2025-06-18';
// 클라이언트가 더 오래된 버전을 요청하면 그 버전으로 응답한다 (사양의 협상 규칙).
export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

export const SERVER_INFO = { name: 'argus-remote', version: '0.1.0' } as const;

// JSON-RPC 2.0 표준 코드 + MCP 규약
export const RPC = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: JsonRpcId; // 없으면 notification — 응답하지 않는다
  method: string;
  params?: Record<string, unknown>;
}

export function isJsonRpcRequest(v: unknown): v is JsonRpcRequest {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return r.jsonrpc === '2.0' && typeof r.method === 'string';
}

export function rpcResult(id: JsonRpcId, result: unknown) {
  return { jsonrpc: '2.0' as const, id, result };
}

export function rpcError(id: JsonRpcId, code: number, message: string, data?: unknown) {
  return { jsonrpc: '2.0' as const, id, error: { code, message, ...(data === undefined ? {} : { data }) } };
}

// 도구 결과의 MCP 표준 형태. isError는 프로토콜 오류가 아니라 "도구가 실패를
// 보고했다"이며, 모델이 읽고 대응할 수 있어야 하므로 result 안에 담긴다.
export function toolText(text: string, isError = false) {
  return { content: [{ type: 'text' as const, text }], ...(isError ? { isError: true } : {}) };
}

export function negotiateVersion(requested: unknown): string {
  return typeof requested === 'string' && SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
    ? requested
    : PROTOCOL_VERSION;
}
