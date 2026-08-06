// 리소스 경로를 붙인 변형 (`/.well-known/oauth-protected-resource/api/mcp/v2`).
// RFC 9728 이 정의하는 형태이고, 여러 커넥터가 이쪽만 읽는다.

import { NextRequest, NextResponse } from 'next/server';
import { protectedResourceMetadata } from '@/lib/mcp-discovery';

export function GET(req: NextRequest) {
  return NextResponse.json(protectedResourceMetadata(new URL(req.url).origin), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
