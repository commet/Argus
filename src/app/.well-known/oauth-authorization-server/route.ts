// RFC 8414 — Authorization Server Metadata.
// oauth-protected-resource 가 authorization_servers: [origin] 을 가리키므로,
// 클라이언트는 곧바로 이 문서를 읽는다. 이것이 없으면 401 → 메타데이터 →
// **404** 로 끝나고 커넥터 추가가 "OAuth 설정 실패"가 된다. 실제로 그 상태였다.

import { NextRequest, NextResponse } from 'next/server';
import { authorizationServerMetadata } from '@/lib/mcp-discovery';

export function GET(req: NextRequest) {
  return NextResponse.json(authorizationServerMetadata(new URL(req.url).origin), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
