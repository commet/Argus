// 원격 커넥터 OAuth — 규칙층 테스트.
//
// 여기서 재는 것은 "커넥터가 붙는가"가 아니라 **붙지 말아야 할 것이 안 붙는가**다.
// 인가 코드가 흐르는 경로에서 조용히 틀릴 수 있는 자리는 셋뿐이고, 셋 다 순수
// 함수로 뽑아 뒀다: redirect_uri 검사, 등록 일치 검사, PKCE 계산.
//
// 라우트 자체(=DB가 필요한 부분)는 여기서 재지 않는다. 재는 척하려면 Supabase를
// 통째로 가짜로 만들어야 하고, 그러면 "정책이 맞는가"를 하나도 증명하지 못한 채
// 초록불만 얻는다 — 그것이 이 저장소가 금지하는 테스트 극장이다.

import { createHash, randomBytes } from 'crypto';
import { describe, expect, it } from 'vitest';
import {
  clientFingerprint,
  errorRedirect,
  isPkce,
  pkceChallenge,
  redirectUriRegistered,
  safeName,
  validRedirectUri,
} from '../oauth/lib';
import { authorizationServerMetadata, protectedResourceMetadata } from '@/lib/mcp-discovery';

const ORIGIN = 'https://argus.voyage';

describe('redirect_uri — 인가 코드가 흐르는 곳', () => {
  it('https 콜백을 받는다 (원격 커넥터의 정상 경로)', () => {
    expect(validRedirectUri('https://claude.ai/api/mcp/auth_callback')).toBe('https://claude.ai/api/mcp/auth_callback');
  });

  it('평문 http 원격 주소는 거부한다 — 코드가 평문으로 흐른다', () => {
    expect(validRedirectUri('http://example.com/cb')).toBeNull();
  });

  it('로컬 개발용 loopback 만 http 로 허용한다 (RFC 8252)', () => {
    expect(validRedirectUri('http://127.0.0.1:5173/cb')).toBeTruthy();
    expect(validRedirectUri('http://localhost:5173/cb')).toBeTruthy();
    expect(validRedirectUri('http://127.0.0.1.evil.com/cb')).toBeNull();
  });

  it('자격증명·프래그먼트가 붙은 URI 를 거부한다', () => {
    expect(validRedirectUri('https://user:pw@example.com/cb')).toBeNull();
    expect(validRedirectUri('https://example.com/cb#x')).toBeNull();
  });

  it('URI 가 아니거나 지나치게 긴 것을 거부한다', () => {
    expect(validRedirectUri('not a url')).toBeNull();
    expect(validRedirectUri(`https://x.com/${'a'.repeat(600)}`)).toBeNull();
    expect(validRedirectUri(null)).toBeNull();
    expect(validRedirectUri(123)).toBeNull();
  });

  it('접두사 일치를 허용하지 않는다 — 등록된 것과 정확히 같아야 한다', () => {
    const client = { client_id: 'c', client_name: 'n', redirect_uris: ['https://claude.ai/api/mcp/auth_callback'] };
    expect(redirectUriRegistered(client, 'https://claude.ai/api/mcp/auth_callback')).toBe(true);
    expect(redirectUriRegistered(client, 'https://claude.ai/api/mcp/auth_callback/../../steal')).toBe(false);
    expect(redirectUriRegistered(client, 'https://claude.ai/api/mcp/auth_callback2')).toBe(false);
    expect(redirectUriRegistered(client, 'https://evil.com/cb')).toBe(false);
  });
});

describe('PKCE — 공개 클라이언트의 유일한 증명', () => {
  it('S256 계산이 사양과 같다 (base64url, 패딩 없음)', () => {
    const verifier = randomBytes(40).toString('base64url');
    expect(pkceChallenge(verifier)).toBe(createHash('sha256').update(verifier).digest('base64url'));
    expect(pkceChallenge(verifier)).not.toContain('=');
  });

  it('길이·문자 규격을 벗어난 verifier 를 거부한다 (RFC 7636 §4.1)', () => {
    expect(isPkce(randomBytes(40).toString('base64url'))).toBe(true);
    expect(isPkce('too-short')).toBe(false);
    expect(isPkce('a'.repeat(129))).toBe(false);
    expect(isPkce('has spaces and !!')).toBe(false);
    expect(isPkce(undefined)).toBe(false);
  });

  it('다른 verifier 는 다른 challenge 를 낸다', () => {
    expect(pkceChallenge('a'.repeat(43))).not.toBe(pkceChallenge('b'.repeat(43)));
  });
});

describe('오류 리다이렉트 (RFC 6749 §4.1.2.1)', () => {
  it('state 를 그대로 돌려준다 — 클라이언트가 요청을 맞춰볼 수 있어야 한다', () => {
    const u = new URL(errorRedirect('https://claude.ai/cb', 'st-1', 'invalid_request', 'why'));
    expect(u.searchParams.get('error')).toBe('invalid_request');
    expect(u.searchParams.get('error_description')).toBe('why');
    expect(u.searchParams.get('state')).toBe('st-1');
  });

  it('state 가 없으면 붙이지 않는다 (빈 state 를 지어내지 않는다)', () => {
    const u = new URL(errorRedirect('https://claude.ai/cb', null, 'access_denied'));
    expect(u.searchParams.has('state')).toBe(false);
  });
});

describe('클라이언트 이름 — 동의 화면과 토큰 라벨에 그대로 나온다', () => {
  it('제어문자를 지운다', () => {
    // 리터럴로 쓰지 않는다 — 저장소의 control-bytes 가드가 소스에 박힌 제어문자를
    // 금지한다(그 규칙이 옳다). 실행 시점에 만들어 넣는다.
    const withControl = `Cla${String.fromCharCode(0)}ude${String.fromCharCode(31)}`;
    expect(safeName(withControl)).toBe('Claude');
  });
  it('비었거나 문자열이 아니면 기본값으로 닫는다', () => {
    expect(safeName('   ')).toBe('MCP client');
    expect(safeName(undefined)).toBe('MCP client');
  });
  it('길이를 자른다', () => {
    expect(safeName('x'.repeat(200)).length).toBe(80);
  });
});

describe('발견 문서 — 401 이 막다른 길이 되지 않아야 한다', () => {
  const as = authorizationServerMetadata(ORIGIN);
  const pr = protectedResourceMetadata(ORIGIN);

  it('보호 리소스가 가리키는 인가 서버가 우리 자신이다', () => {
    expect(pr.authorization_servers).toEqual([ORIGIN]);
    expect(as.issuer).toBe(ORIGIN);
  });

  it('세 엔드포인트가 모두 실재하는 경로를 가리킨다', () => {
    expect(as.authorization_endpoint).toBe(`${ORIGIN}/api/mcp/v2/oauth/authorize`);
    expect(as.token_endpoint).toBe(`${ORIGIN}/api/mcp/v2/oauth/token`);
    expect(as.registration_endpoint).toBe(`${ORIGIN}/api/mcp/v2/oauth/register`);
  });

  it('지원하지 않는 것을 지원한다고 적지 않는다 (refresh_token 없음)', () => {
    expect(as.grant_types_supported).toEqual(['authorization_code']);
    expect(JSON.stringify(as)).not.toContain('refresh_token');
  });

  it('PKCE 를 필수로 선언하고, 공개 클라이언트만 받는다', () => {
    expect(as.code_challenge_methods_supported).toEqual(['S256']);
    expect(as.token_endpoint_auth_methods_supported).toEqual(['none']);
  });

  it('두 문서가 같은 리소스와 같은 scope 를 말한다', () => {
    expect(pr.resource).toBe(`${ORIGIN}/api/mcp/v2`);
    expect(pr.scopes_supported).toEqual(as.scopes_supported);
  });
});

describe('재등록 멱등 — 인증 없이 열린 표면을 무한히 쌓이지 않게', () => {
  const URIS = ['https://claude.ai/api/mcp/auth_callback', 'https://claude.ai/alt'];

  it('같은 (이름, 콜백)이면 같은 지문 — 콜백 순서가 달라도', () => {
    expect(clientFingerprint('Claude', URIS)).toBe(clientFingerprint('Claude', [...URIS].reverse()));
  });

  it('이름이 다르면 다른 지문', () => {
    expect(clientFingerprint('Claude', URIS)).not.toBe(clientFingerprint('ChatGPT', URIS));
  });

  it('콜백이 하나라도 다르면 다른 지문 — 다른 곳으로 코드가 갈 수 있으므로 같은 클라이언트가 아니다', () => {
    expect(clientFingerprint('Claude', URIS)).not.toBe(clientFingerprint('Claude', [...URIS, 'https://evil.com/cb']));
  });

  it('지문에서 원본을 되돌릴 수 없다 (해시)', () => {
    const fp = clientFingerprint('Claude', URIS);
    expect(fp).not.toContain('claude.ai');
    expect(fp).toMatch(/^[a-f0-9]{64}$/);
  });
});
