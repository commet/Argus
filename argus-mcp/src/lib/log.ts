/**
 * Diagnostics go to stderr ONLY (addendum N4). A stdio MCP server must never
 * write to stdout — that channel carries JSON-RPC frames and any stray byte
 * corrupts the protocol. Verbose output is gated behind ARGUS_DEBUG.
 */
export function logError(msg: string, err?: unknown): void {
  const detail = err instanceof Error ? err.stack || err.message : err !== undefined ? String(err) : '';
  process.stderr.write(`argus-decision-mcp ERROR ${msg}${detail ? ' :: ' + detail : ''}\n`);
}

export function logDebug(msg: string): void {
  if (process.env['ARGUS_DEBUG']) {
    process.stderr.write(`argus-decision-mcp DEBUG ${msg}\n`);
  }
}
