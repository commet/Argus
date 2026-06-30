import fs from 'fs/promises';
import fsSync from 'fs';
import yaml from 'js-yaml';
import { configPath, ledgerDir, sessionsRoot } from '../lib/layout.js';
import { detectLocale } from '../lib/locale.js';
import { ok, err, type ToolResult } from './types.js';

interface ArgusConfig {
  locale: 'ko' | 'en';
  boss: unknown;
  team: unknown;
  archive: unknown;
}

export async function argus_config_read(args: { argus_dir: string }): Promise<ToolResult> {
  try {
    const cfgPath = configPath(args.argus_dir);
    try {
      const raw = await fs.readFile(cfgPath, 'utf8');
      const config = yaml.load(raw) as ArgusConfig;
      return ok({ ...config, existed: true });
    } catch {
      const locale = detectLocale(args.argus_dir);
      return ok({ locale, boss: null, team: null, archive: null, existed: false });
    }
  } catch (e) {
    return err('config_read_failed', String(e));
  }
}

export async function argus_config_write(args: { argus_dir: string; config: ArgusConfig }): Promise<ToolResult> {
  try {
    const cfgPath = configPath(args.argus_dir);
    await fs.mkdir(args.argus_dir, { recursive: true });
    const validLocales = ['ko', 'en'];
    if (!validLocales.includes(args.config.locale)) {
      return err('invalid_locale', `locale must be one of: ${validLocales.join(', ')}`);
    }
    await fs.writeFile(cfgPath, yaml.dump(args.config), 'utf8');
    return ok({ written: true });
  } catch (e) {
    return err('config_write_failed', String(e));
  }
}

export const argus_init = argusInit;

export async function argusInit(args: { argus_dir: string }): Promise<ToolResult> {
  try {
    await fs.mkdir(args.argus_dir, { recursive: true });
    await fs.mkdir(sessionsRoot(args.argus_dir), { recursive: true });
    await fs.mkdir(ledgerDir(args.argus_dir), { recursive: true });

    const p = configPath(args.argus_dir);
    if (!fsSync.existsSync(p)) {
      const cfg = { locale: detectLocale(args.argus_dir), boss: null, team: null, archive: null };
      await fs.writeFile(p, yaml.dump(cfg), 'utf8');
    }

    return ok({ initialized: true, argus_dir: args.argus_dir });
  } catch (e) {
    return err('init_failed', String(e));
  }
}
