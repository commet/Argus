-- Anonymous, opt-in MCP operational telemetry (argus-decision-mcp).
--
-- Rows carry NO user_id, NO PII, and NO decision content — only a random,
-- machine-local install id, which of our tools ran, and coarse version/platform.
-- Because there is no identity here, this is deliberately NOT a user-scoped
-- table: it is absent from user-data-tables.ts / erasure-coverage on purpose
-- (there is nothing to erase or export per-account).
--
-- Written exclusively by the service role via /api/mcp/telemetry. The MCP server
-- only POSTs when the user sets ARGUS_TELEMETRY=1 (off by default), so the
-- long-standing "no network calls without a token" promise still holds for
-- everyone who never opts in.

create table if not exists public.mcp_telemetry (
  id          bigint generated always as identity primary key,
  install_id  text not null,
  event       text not null,          -- 'server_start' | 'tool_call'
  tool        text,                   -- our tool name for tool_call events, else null
  ok          boolean,                -- did the tool run without crashing
  version     text,                   -- MCP package version
  platform    text,                   -- 'darwin' | 'linux' | 'win32' — coarse, not PII
  node_major  integer,
  created_at  timestamptz not null default now()
);

create index if not exists mcp_telemetry_created_at_idx on public.mcp_telemetry (created_at desc);
create index if not exists mcp_telemetry_install_id_idx on public.mcp_telemetry (install_id);

-- RLS on with NO policies: anon/authenticated clients cannot read or write; only
-- the service role (the server route) may, which bypasses RLS by design.
alter table public.mcp_telemetry enable row level security;
