// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const currentLocale: { value: 'ko' | 'en' } = { value: 'ko' };
const query = new URLSearchParams({
  client_id: 'client-test',
  client_name: 'Claude',
  redirect_uri: 'https://claude.ai/api/mcp/auth_callback',
  state: 'state-test',
  code_challenge: 'a'.repeat(43),
  scope: 'argus.decisions offline_access',
  resource: 'https://argus.voyage/api/mcp/v2',
});

vi.mock('next/navigation', () => ({ useSearchParams: () => query }));
vi.mock('@/hooks/useLocale', () => ({ useLocale: () => currentLocale.value }));
vi.mock('@/lib/auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'owner@example.com' },
    session: { access_token: 'session-token' },
    loading: false,
  }),
}));
vi.mock('@/components/ui/LocaleLink', () => ({
  LocaleLink: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) =>
    createElement('a', { href, className }, children),
}));

const { RemoteConnectApproval } = await import('../page');

let container: HTMLDivElement;
let root: Root;

function visibleText(): string {
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe('Remote MCP consent', () => {
  it('한국어에서 결정 권한과 연결 유지 권한을 따로 설명한다', async () => {
    currentLocale.value = 'ko';
    await act(async () => root.render(createElement(RemoteConnectApproval)));
    const text = visibleText();
    expect(text).toContain('Claude에 연결');
    expect(text).toContain('argus.decisions offline_access');
    expect(text).toContain('연결 유지: 만료되는 접근 토큰을 안전하게 갱신');
    expect(text).toContain('대신 결정하거나 실행하지 않습니다');
    expect(text).toContain('owner@example.com');
    expect(container.querySelectorAll('button')).toHaveLength(2);
  });

  it('영어에서도 같은 권한·비역할·철회 약속을 보인다', async () => {
    currentLocale.value = 'en';
    await act(async () => root.render(createElement(RemoteConnectApproval)));
    const text = visibleText();
    expect(text).toContain('Connect to Claude');
    expect(text).toContain('Stay connected: securely renew expiring access tokens');
    expect(text).toContain('It will not decide or act for you');
    expect(text).toContain('You can revoke this in Settings at any time');
  });
});
