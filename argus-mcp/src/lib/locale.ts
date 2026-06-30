import fs from 'fs';
import { configPath } from './layout.js';

export function detectLocale(argusDir: string): 'ko' | 'en' {
  try {
    const cfg = fs.readFileSync(configPath(argusDir), 'utf8');
    const m = cfg.match(/^locale:\s*(ko|en)\b/m);
    if (m) return m[1] as 'ko' | 'en';
  } catch { /* no config */ }
  const env = process.env['LANG'] || process.env['LC_ALL'] || '';
  if (/^ko/i.test(env)) return 'ko';
  try {
    if (/^ko/i.test(Intl.DateTimeFormat().resolvedOptions().locale)) return 'ko';
  } catch { /* Intl unavailable */ }
  return 'en';
}
