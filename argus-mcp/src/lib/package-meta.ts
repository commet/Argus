import fs from 'fs';

interface PackageMeta {
  name: string;
  version: string;
}

export function packageMeta(): PackageMeta {
  try {
    const raw = fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
    const parsed = JSON.parse(raw) as Partial<PackageMeta>;
    return {
      name: parsed.name || 'argus-decision-mcp',
      version: parsed.version || '0.0.0',
    };
  } catch {
    return { name: 'argus-decision-mcp', version: '0.0.0' };
  }
}
