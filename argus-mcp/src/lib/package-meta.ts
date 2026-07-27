import fs from 'fs';

interface PackageMeta {
  name: string;
  version: string;
}

export function packageMeta(): PackageMeta {
  for (const relative of ['../package.json', '../../package.json']) {
    try {
      const parsed = JSON.parse(fs.readFileSync(new URL(relative, import.meta.url), 'utf8')) as Partial<PackageMeta>;
      if (parsed.name === 'argus-decision-mcp' && parsed.version) {
        return { name: parsed.name, version: parsed.version };
      }
    } catch {
      // Try the source-tree or bundled-layout candidate.
    }
  }
  return { name: 'argus-decision-mcp', version: '0.0.0' };
}
