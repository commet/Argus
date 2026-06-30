import path from 'path';

// argus_dir is already the .argus/ directory (not the project root)
export const sessionDir = (argusDir: string, id: string) =>
  path.join(argusDir, 'sessions', id);

export const versionDir = (argusDir: string, id: string, label: string) =>
  path.join(argusDir, 'sessions', id, 'versions', label);

export const ledgerPath = (argusDir: string) =>
  path.join(argusDir, 'ledger', 'ledger.jsonl');

export const configPath = (argusDir: string) =>
  path.join(argusDir, 'config.yaml');

export const sessionsRoot = (argusDir: string) =>
  path.join(argusDir, 'sessions');

export const ledgerDir = (argusDir: string) =>
  path.join(argusDir, 'ledger');
