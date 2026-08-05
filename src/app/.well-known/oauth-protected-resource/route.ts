// RFC 9728 — Protected Resource Metadata.
// /api/mcp/v2 가 401과 함께 이 URL을 가리킨다. MCP 클라이언트(Claude·ChatGPT
// 커넥터)는 여기를 읽고 "어느 인가 서버로 가야 하는지"를 알아낸다.
// 이 문서가 없으면 401은 막다른 길이 된다 — 가리키는 곳이 실재해야 한다.

import { NextRequest, NextResponse } from 'next/server';
import { protectedResourceMetadata } from '@/lib/mcp-discovery';

export function GET(req: NextRequest) {
  return NextResponse.json(protectedResourceMetadata(new URL(req.url).origin), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
