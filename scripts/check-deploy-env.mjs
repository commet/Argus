import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    out[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

const fileEnv = {
  ...parseEnvFile(resolve('.env')),
  ...parseEnvFile(resolve('.env.local')),
};
const env = { ...fileEnv, ...process.env };
const value = (key) => String(env[key] || '').trim();

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'CRON_SECRET',
  'RESEND_API_KEY',
  'EMAIL_FROM_DOMAIN',
];

const errors = [];
const warnings = [];
const looksLikePlaceholder = (current) => /^(your-|replace-with-|sk-ant-\.\.\.|re_\.\.\.|https:\/\/your-)|example\.com/i.test(current);
for (const key of required) {
  const current = value(key);
  if (!current) errors.push(`missing required variable: ${key}`);
  else if (looksLikePlaceholder(current)) errors.push(`${key} still contains an example placeholder`);
}

for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SITE_URL']) {
  const current = value(key);
  if (current) {
    try {
      const url = new URL(current);
      if (url.protocol !== 'https:') errors.push(`${key} must use https`);
    } catch {
      errors.push(`${key} must be a valid absolute URL`);
    }
  }
}

if (value('SUPABASE_SERVICE_ROLE_KEY') && value('SUPABASE_SERVICE_ROLE_KEY') === value('NEXT_PUBLIC_SUPABASE_ANON_KEY')) {
  errors.push('SUPABASE_SERVICE_ROLE_KEY must not equal NEXT_PUBLIC_SUPABASE_ANON_KEY');
}
if (value('CRON_SECRET') && value('CRON_SECRET').length < 24) {
  errors.push('CRON_SECRET must be at least 24 characters');
}

const groups = [
  ['Slack', ['SLACK_CLIENT_ID', 'SLACK_CLIENT_SECRET', 'SLACK_SIGNING_SECRET']],
  ['Telegram', ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_BOT_USERNAME', 'TELEGRAM_WEBHOOK_SECRET']],
  ['Turnstile', ['NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY']],
];
for (const [name, keys] of groups) {
  const present = keys.filter((key) => value(key));
  if (present.length > 0 && present.length < keys.length) {
    errors.push(`${name} is partially configured; set all of: ${keys.join(', ')}`);
  } else if (present.length === 0) {
    warnings.push(`${name} integration is disabled`);
  }
}

if (value('PREMISE_WATCH_ENABLED').toLowerCase() === 'true' && !value('BRAVE_SEARCH_API_KEY')) {
  errors.push('PREMISE_WATCH_ENABLED=true requires BRAVE_SEARCH_API_KEY');
}
if (!value('BRAVE_SEARCH_API_KEY')) warnings.push('web research is disabled');
if (!value('EMAIL_INBOUND_SECRET')) warnings.push('inbound email replies are disabled');

for (const warning of warnings) console.warn(`[deploy preflight] warning: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`[deploy preflight] error: ${error}`);
  console.error(`[deploy preflight] failed with ${errors.length} blocking issue(s)`);
  process.exit(1);
}

console.log('[deploy preflight] required production configuration is present');
