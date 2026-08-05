// 리소스 경로를 붙인 변형 (`/.well-known/oauth-authorization-server/api/mcp/v2`).
// MCP 클라이언트는 이쪽을 먼저 시도하는 경우가 있다 — 같은 문서를 돌려준다.
// 다른 내용을 말하면 클라이언트마다 다른 곳으로 가서 재현 안 되는 실패가 된다.

import { NextRequest, NextResponse } from 'next/server';
import { authorizationServerMetadata } from '@/lib/mcp-discovery';

export function GET(req: NextRequest) {
  return NextResponse.json(authorizationServerMetadata(new URL(req.url).origin), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
