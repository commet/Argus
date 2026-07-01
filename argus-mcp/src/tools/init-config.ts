import fs from 'fs/promises';
import fsSync from 'fs';
import yaml from 'js-yaml';
import { configPath, sessionsRoot, ledgerDir } from '../lib/layout.js';
import { atomicWriteText } from '../lib/atomic-write.js';
import { detectLocale } from '../lib/locale.js';
import { resolveToolArgusDir, writeBoundMarker } from '../lib/argus-dir.js';
import { ensurePrivacyGitignore } from '../lib/privacy.js';
import { replayLedger } from '../lib/ledger-replay.js';
import { resolveToday } from '../lib/resolve-today.js';
import { SCHEMA_VERSION } from '../lib/spine.js';
import { z } from 'zod';
import { envelope, toolError } from '../lib/envelope.js';
import { ENVELOPE_OUTPUT_SCHEMA, zArgusDir, type ToolModule } from './tool-types.js';
import { handleToolException } from './errors.js';

interface ArgusConfig {
  schema_version: number;
  locale: 'ko' | 'en';
  boss: string | null;
  team: string | null;
  archive: boolean | null;
}

function readConfig(dir: string): ArgusConfig | null {
  try {
    return yaml.load(fsSync.readFileSync(configPath(dir), 'utf8')) as ArgusConfig;
  } catch {
    return null;
  }
}

export const init: ToolModule = {
  name: 'argus_init',
  description: 'Initialize the .argus directory (sessions, ledger, config, privacy .gitignore) and bind it for resource reads. Call once before other tools. Safe to call again.',
  inputSchema: z.strictObject({ argus_dir: zArgusDir }),
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: 'Initialize Argus', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      await fs.mkdir(sessionsRoot(dir), { recursive: true });
      await fs.mkdir(ledgerDir(dir), { recursive: true });
      await ensurePrivacyGitignore(dir);
      writeBoundMarker(dir);

      if (!fsSync.existsSync(configPath(dir))) {
        const cfg: ArgusConfig = { schema_version: SCHEMA_VERSION, locale: detectLocale(dir), boss: null, team: null, archive: null };
        await atomicWriteText(configPath(dir), yaml.dump(cfg));
      }

      const today = resolveToday({});
      const empty = replayLedger(dir, today).ids.size === 0;
      return envelope({
        ok: true, tool: 'argus_init',
        surface: empty
          ? 'Argus is ready. It does not give answers — it records a prediction + a check-by date and meets reality on that date. Open your first decision with argus_open_decision.'
          : 'Argus is ready.',
        next_actions: empty ? ['argus_open_decision'] : ['argus_check_in'],
        data: { initialized: true, argus_dir: dir },
      });
    } catch (e) {
      return handleToolException('argus_init', e);
    }
  },
};

export const config: ToolModule = {
  name: 'argus_config',
  description: 'Read or update non-spine settings (locale, boss, team, archive). Passing only argus_dir reads; passing fields merges and writes. There is no setting that turns off falsifiability, seal-before-settle, or honest provenance — the spine is not configurable.',
  inputSchema: z.strictObject({
    argus_dir: zArgusDir,
    locale: z.enum(['ko', 'en']).optional(),
    boss: z.string().optional(),
    team: z.string().optional(),
    archive: z.boolean().optional(),
  }),
  outputSchema: ENVELOPE_OUTPUT_SCHEMA,
  annotations: { title: 'Read/update settings', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (a) => {
    try {
      const dir = resolveToolArgusDir(a['argus_dir']);
      const writeKeys = ['locale', 'boss', 'team', 'archive'].filter((k) => k in a);

      const existing = readConfig(dir) ?? { schema_version: SCHEMA_VERSION, locale: detectLocale(dir), boss: null, team: null, archive: null };

      if (writeKeys.length === 0) {
        return envelope({ ok: true, tool: 'argus_config', surface: 'Config read.', next_actions: ['stop'], data: { config: existing, existed: !!readConfig(dir) } });
      }

      if ('locale' in a && a['locale'] !== 'ko' && a['locale'] !== 'en') {
        return toolError({ ok: false, tool: 'argus_config', error_code: 'INVALID_LOCALE', message: 'locale must be "ko" or "en".' });
      }

      const merged: ArgusConfig = {
        ...existing,
        schema_version: SCHEMA_VERSION,
        ...(('locale' in a) ? { locale: a['locale'] as 'ko' | 'en' } : {}),
        ...(('boss' in a) ? { boss: a['boss'] as string } : {}),
        ...(('team' in a) ? { team: a['team'] as string } : {}),
        ...(('archive' in a) ? { archive: a['archive'] as boolean } : {}),
      };
      await atomicWriteText(configPath(dir), yaml.dump(merged));
      return envelope({ ok: true, tool: 'argus_config', surface: 'Config updated.', next_actions: ['stop'], data: { config: merged } });
    } catch (e) {
      return handleToolException('argus_config', e);
    }
  },
};
