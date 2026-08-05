// MCP 커넥터가 읽는 두 개의 발견 문서 — 한 곳에서 만든다.
//
// 왜 lib 에 두는가: 같은 문서를 여러 경로에서 서빙해야 하기 때문이다. MCP 사양은
// 클라이언트가 리소스 경로를 붙인 변형(`/.well-known/oauth-authorization-server/api/mcp/v2`)
// 을 먼저 시도하고 없으면 루트를 시도하도록 정의한다(RFC 8414 §3.1 + MCP 인가
// 사양). 두 경로가 **다른 내용**을 말하면 클라이언트마다 다른 곳으로 가서
// 재현되지 않는 실패가 된다. 그래서 문서는 하나, 경로만 여럿이다.

export const RESOURCE_PATH = '/api/mcp/v2';
export const REMOTE_SCOPE = 'argus.decisions';

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}${RESOURCE_PATH}`,
    authorization_servers: [origin],
    bearer_methods_supported: ['header'],
    scopes_supported: [REMOTE_SCOPE],
    resource_documentation: `${origin}/method-pilot`,
  };
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}${RESOURCE_PATH}/oauth/authorize`,
    token_endpoint: `${origin}${RESOURCE_PATH}/oauth/token`,
    registration_endpoint: `${origin}${RESOURCE_PATH}/oauth/register`,
    scopes_supported: [REMOTE_SCOPE],
    response_types_supported: ['code'],
    // refresh_token 을 발급하지 않으므로 선언하지도 않는다. 지원하지 않는 것을
    // 적어 두면 클라이언트가 만료 후 조용히 막다른 길로 간다.
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    service_documentation: `${origin}/method-pilot`,
  };
}
