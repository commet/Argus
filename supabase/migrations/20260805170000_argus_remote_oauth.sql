-- 원격 MCP 커넥터용 OAuth (RFC 7591 동적 등록 + RFC 6749 인가 코드 + PKCE)
--
-- 왜 mcp_account_authorizations 를 재사용하지 않는가: 그 테이블은 로컬 CLI 흐름의
-- 제약(loopback redirect_uri, client_id 없음)을 CHECK 로 굳혀 놓았다. 원격 흐름을
-- 거기 얹으려면 그 제약을 풀어야 하고, 그 순간 로컬 흐름의 방어가 같이 풀린다.
-- 파일럿 존의 argus_* 테이블과 같은 규칙으로 나란히 둔다 — 통째로 drop 가능.
--
-- 발급되는 자격증명은 공유한다: 두 흐름 다 결국 plugin_tokens 의 `argus_pat_*` 를
-- 만든다. 그래서 폐기·만료·개수 제한이 한 곳에서 관리된다.

-- ── 동적으로 등록된 클라이언트 ────────────────────────────────────────────
create table if not exists public.argus_oauth_clients (
  client_id       text primary key,
  client_name     text not null default 'MCP client',
  redirect_uris   text[] not null,
  -- 같은 (이름, 콜백 목록)으로 다시 등록하면 새 행을 만들지 않고 기존 것을 돌려준다.
  -- 등록은 사양상 **인증 없이** 열려 있으므로(그 시점엔 아직 자격증명이 없다)
  -- 무한히 쌓일 수 있는 표면이다. 재등록을 멱등으로 만들면 행 수가 "서로 다른
  -- 커넥터 종류"로 묶인다 — 커넥터는 재연결 때마다 다시 등록하므로 이것이
  -- 정상 동작이기도 하다. client_id 는 사양상 공개 식별자이고, 그것만으로는
  -- 아무 권한도 없다(PKCE + 사용자 동의 + redirect_uri 정확 일치가 모두 필요).
  fingerprint     text not null unique,
  -- 공개 클라이언트만 지원한다: 비밀을 안전하게 보관할 수 없는 곳(브라우저·
  -- 커넥터)이므로 client_secret 대신 PKCE 가 유일한 증명이다. 비밀을 발급하면
  -- 보관되지 않는 비밀을 검증하는 척하게 된다.
  token_endpoint_auth_method text not null default 'none'
                  check (token_endpoint_auth_method = 'none'),
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz
);

-- ── 인가 코드 (1회용, 해시로만 저장) ─────────────────────────────────────
create table if not exists public.argus_oauth_grants (
  id              uuid primary key default gen_random_uuid(),
  client_id       text not null references public.argus_oauth_clients(client_id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  code_hash       text not null unique,
  code_challenge  text not null,               -- S256 만 받는다
  redirect_uri    text not null,               -- 교환 때 정확히 일치해야 한다
  scope           text not null default 'argus.decisions',
  status          text not null default 'issued' check (status in ('issued', 'consumed')),
  expires_at      timestamptz not null,
  consumed_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists argus_oauth_grants_expiry_idx on public.argus_oauth_grants (expires_at);
create index if not exists argus_oauth_grants_user_idx on public.argus_oauth_grants (user_id, created_at desc);

-- RLS 를 켜되 정책을 만들지 않는다 = service role 만 접근한다.
-- 사용자 브라우저가 인가 코드 테이블을 직접 읽을 이유는 없다.
alter table public.argus_oauth_clients enable row level security;
alter table public.argus_oauth_grants  enable row level security;

comment on table public.argus_oauth_clients is
  'R3-B 원격 MCP 파일럿 — RFC 7591 동적 등록 클라이언트. 공개 클라이언트만(PKCE 필수).';
comment on table public.argus_oauth_grants is
  'R3-B 원격 MCP 파일럿 — 1회용 인가 코드(해시). 지속 자격증명은 plugin_tokens 로 간다.';
