#!/usr/bin/env node
// Secret redaction — the MECHANICAL version of clarify's "redact before use" rule.
//
// Argus reads git diffs / file contents / PR bodies and injects them into prompts.
// Those can carry live secrets (a modified-but-gitignored .env, a pasted key). The
// rule lived only as prose in clarify SKILL.md — prose is a floor, not enforcement.
// This is a tested function the skill pipes untrusted text through before injection.
//
// Usage (programmatic):  import { redactSecrets } from './redact.mjs'
// Usage (CLI):           git diff HEAD | node argus-plugin-v2/scripts/redact.mjs

// Each rule: a regex + a replacement that keeps enough shape to stay readable.
const RULES = [
  // PEM private key blocks (multi-line) → single placeholder
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED PRIVATE KEY]'],
  // KEY=value / KEY: value where the key name looks secret
  [/\b([A-Z0-9_]*(?:SECRET|TOKEN|API[_-]?KEY|ACCESS[_-]?KEY|PRIVATE[_-]?KEY|PASSWORD|PASSWD|CLIENT[_-]?SECRET|SERVICE[_-]?ROLE)[A-Z0-9_]*)\s*[:=]\s*["']?[^\s"']{6,}["']?/gi, '$1=[REDACTED]'],
  // Common provider key shapes
  [/\bsk-[A-Za-z0-9]{16,}\b/g, '[REDACTED sk-key]'],                 // OpenAI-style
  [/\bsk-ant-[A-Za-z0-9_-]{16,}\b/g, '[REDACTED anthropic-key]'],     // Anthropic
  [/\bgh[pousr]_[A-Za-z0-9]{16,}\b/g, '[REDACTED github-token]'],     // GitHub PAT
  [/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED aws-key-id]'],                 // AWS access key id
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, '[REDACTED slack-token]'],    // Slack
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED jwt]'], // JWT
  [/\b(?:[a-z0-9]+:\/\/)?[^\s:@/]+:([^\s:@/]{6,})@[^\s/]+/g, (m) => m.replace(/:[^:@/]+@/, ':[REDACTED]@')], // url creds user:pass@host
];

// Heuristic: long high-entropy tokens (likely keys) outside the rules above.
function redactHighEntropy(text) {
  return text.replace(/\b[A-Za-z0-9+/_-]{32,}\b/g, (tok) => {
    // Skip obvious non-secrets: hex-ish git sha (<=40), pure words, repeated chars.
    const distinct = new Set(tok).size;
    const hasMixedClasses = /[A-Z]/.test(tok) && /[a-z]/.test(tok) && /[0-9]/.test(tok);
    if (tok.length <= 40 && /^[0-9a-f]+$/i.test(tok)) return tok; // git sha / hex digest
    if (distinct < 8) return tok;                                  // low entropy
    if (!hasMixedClasses && tok.length < 48) return tok;           // likely a path/word
    return '[REDACTED high-entropy]';
  });
}

export function redactSecrets(input) {
  if (!input || typeof input !== 'string') return '';
  let out = input;
  for (const [re, rep] of RULES) out = out.replace(re, rep);
  out = redactHighEntropy(out);
  return out;
}

// Skip a path entirely if it looks like a secret file (clarify rule).
export function isSecretPath(p) {
  return /(^|\/)\.env(\.|$)|\.pem$|\.key$|secret|credential|\.p12$|id_rsa/i.test(p || '');
}

import { pathToFileURL } from 'node:url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (buf += c));
  process.stdin.on('end', () => process.stdout.write(redactSecrets(buf)));
}
