// 원격 MCP 표면 (v1.0 §15.5 pilot 채널 — 초대 전용·폐기 전제).
// 격리 가드의 두 번째 승인 예외 (harness.test.ts AUTHORIZED_CHANNELS 참조).
//
// 이 라우트는 **전송과 인증만** 한다. 방법은 method-harness가 갖는다.
// stateless: MCP 세션 상태를 서버 메모리에 두지 않는다 — 매 호출마다
// 토큰 → user_id → 원장 fold. 서버리스에서 유일하게 맞는 형태다.

import { NextRequest, NextResponse } from 'next/server';
import { authenticate, wwwAuthenticate } from './auth';
import {
  handleAdopt,
  handleOpen,
  handlePlan,
  handleRecall,
  handleReturn,
  handleSharpen,
} from './handlers';
import {
  isJsonRpcRequest,
  negotiateVersion,
  rpcError,
  rpcResult,
  RPC,
  SERVER_INFO,
  toolText,
  type JsonRpcId,
} from './protocol';
import { TOOLS } from './tools';

const MAX_BODY_BYTES = 256 * 1024;

// 도구 실행 — 하네스로 배선됨 (handlers.ts). 이 파일은 이름을 보고 넘길 뿐,
// 방법 규칙은 하나도 갖지 않는다.
async function callTool(name: string, args: Record<string, unknown>, userId: string) {
  switch (name) {
    case 'argus_open':
      return handleOpen(userId, args);
    case 'argus_sharpen':
      return handleSharpen(userId, args);
    case 'argus_plan':
      return handlePlan(userId, args);
    case 'argus_adopt':
      return handleAdopt(userId, args);
    case 'argus_return':
      return handleReturn(userId, args);
    case 'argus_recall':
      return handleRecall(userId, args);
    default:
      return toolText(`알 수 없는 도구: ${name}`, true);
  }
}

async function dispatch(method: string, params: Record<string, unknown>, id: JsonRpcId, userId: string) {
  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: negotiateVersion(params.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        // 이 문자열이 이 서버에서 가장 지렛대가 큰 문장이다 — 호스트가 모델의
        // 맥락에 얹는 유일한 사양이므로, 여기 없는 것은 모델이 하지 않는다.
        // 그래서 두 가지를 반드시 담는다: (1) 침묵이 기본값이라는 것,
        // (2) **조언하기 전에 지난 정산을 먼저 확인하라**는 것. (2)가 없으면
        // argus_recall 은 영영 불리지 않고, 이 제품은 계획만 내주는 범용 AI가 된다.
        instructions:
          'Argus는 사용자의 결정을 그의 것으로 기록하고, 실행 순서를 만들고, 기한이 되면 현실이 무엇이라 답했는지 정산합니다.\n\n' +
          '언제 부르는가:\n' +
          '· 사용자가 실제로 결정을 앞에 두었을 때만. 평평한 상황이나 이미 닫힌 결정에는 부르지 마십시오 — 침묵이 기본값입니다.\n' +
          '· 비슷한 결정이 다시 온 것 같으면 **조언하기 전에 argus_recall 을 먼저 부르십시오.** ' +
          '일반적인 조언은 어디서나 얻을 수 있지만, 이 사람이 지난번에 무엇을 가정했고 현실이 무엇이라 답했는지는 여기에만 있습니다.\n\n' +
          '무엇을 하지 않는가:\n' +
          '· 대신 결정하지 않습니다. 채택은 사용자가 명시적으로 말할 때만 argus_adopt 로 기록합니다.\n' +
          '· 돌아볼 때 그때의 기록을 먼저 보여주지 않습니다 — 무슨 일이 있었는지부터 듣습니다. 서버가 이 순서를 강제합니다.\n' +
          '· 사용자를 점수 매기거나 등급을 붙이지 않습니다.',
      });

    case 'ping':
      return rpcResult(id, {});

    case 'tools/list':
      return rpcResult(id, { tools: TOOLS });

    case 'tools/call': {
      const name = typeof params.name === 'string' ? params.name : '';
      if (!name) return rpcError(id, RPC.INVALID_PARAMS, 'tool name required');
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      return rpcResult(id, await callTool(name, args, userId));
    }

    default:
      return rpcError(id, RPC.METHOD_NOT_FOUND, `unknown method: ${method}`);
  }
}

export async function POST(req: NextRequest) {
  const origin = new URL(req.url).origin;

  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_BODY_BYTES) {
    return NextResponse.json(rpcError(null, RPC.INVALID_REQUEST, 'payload too large'), { status: 413 });
  }

  const auth = await authenticate(req.headers.get('authorization'));
  if (!auth.ok) {
    // 범위 부족은 재인증해도 열리지 않는 문이다 — 401 로 돌려주면 클라이언트가
    // OAuth 흐름을 무한히 다시 돈다. 403 으로 끝낸다 (RFC 6750 §3.1).
    if (auth.reason === 'insufficient_scope') {
      return NextResponse.json(rpcError(null, RPC.INVALID_REQUEST, 'forbidden: insufficient_scope'), {
        status: 403,
        headers: { 'WWW-Authenticate': `Bearer realm="argus", error="insufficient_scope"` },
      });
    }
    // MCP 클라이언트는 401 + WWW-Authenticate 를 보고 OAuth 흐름을 시작한다.
    return NextResponse.json(rpcError(null, RPC.INVALID_REQUEST, `unauthorized: ${auth.reason}`), {
      status: 401,
      headers: { 'WWW-Authenticate': wwwAuthenticate(origin) },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(rpcError(null, RPC.PARSE_ERROR, 'invalid JSON'), { status: 400 });
  }

  // 배치 요청도 사양의 일부다. 단건은 단건으로 답한다.
  const batch = Array.isArray(body);
  const items = (batch ? body : [body]) as unknown[];
  if (items.length === 0) {
    return NextResponse.json(rpcError(null, RPC.INVALID_REQUEST, 'empty batch'), { status: 400 });
  }

  const responses: unknown[] = [];
  for (const item of items) {
    if (!isJsonRpcRequest(item)) {
      responses.push(rpcError(null, RPC.INVALID_REQUEST, 'not a JSON-RPC 2.0 request'));
      continue;
    }
    // id가 없으면 notification — 사양상 응답하지 않는다.
    if (item.id === undefined) continue;
    try {
      responses.push(await dispatch(item.method, item.params ?? {}, item.id, auth.userId));
    } catch (e) {
      console.error('[mcp/v2] dispatch failed:', e);
      responses.push(rpcError(item.id, RPC.INTERNAL_ERROR, 'internal error'));
    }
  }

  // 전부 notification이었다면 본문 없이 202 (사양).
  if (responses.length === 0) return new NextResponse(null, { status: 202 });

  const res = NextResponse.json(batch ? responses : responses[0]);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

// 이 서버는 먼저 말하지 않으므로 SSE 스트림을 열지 않는다 (§3 설계 판단 2).
// 그래도 어디서 인증받는지는 알려준다.
export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  return NextResponse.json(
    { error: 'This endpoint speaks MCP over HTTP POST (JSON-RPC 2.0).' },
    { status: 405, headers: { 'WWW-Authenticate': wwwAuthenticate(origin), Allow: 'POST' } },
  );
}
