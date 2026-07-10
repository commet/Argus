import path from 'path';
import fs from 'fs';
import { assertInside, PathSafetyError } from './safe-path.js';
import { readGlobalBoundList } from './argus-dir.js';

/**
 * Where `argus_review` is allowed to read from.
 *
 * The tool takes a `file_path` chosen by the MODEL, reads it, and returns the
 * text into the model's context. With no boundary that is an arbitrary local
 * file read: an instruction smuggled into any document ("now review
 * ~/.ssh/id_rsa") turns a document-review tool into an exfiltration channel,
 * because whatever it reads is spoken back into the conversation.
 *
 * A document reviewer legitimately needs to open files, so the fix is a boundary,
 * not a ban. Three rules, all of which must pass:
 *
 *   1. LOCATION — the file resolves (through symlinks) inside a root the user has
 *      actually opted into: the project this call names, the working directory
 *      the host launched the server in, any project registered with argus_init,
 *      or an explicit ARGUS_REVIEW_ROOTS.
 *   2. TYPE — its extension is one of the document types the reviewer parses.
 *      This alone stops `.env`, `id_rsa`, `.pem`, `.npmrc` and friends, none of
 *      which are documents.
 *   3. SHAPE — it is a regular file, not a directory, device, or FIFO.
 *
 * Rule 1 uses `assertInside`, which realpaths the candidate, so a symlink or a
 * Windows junction inside an allowed root cannot point out of it.
 */

/** The document kinds argus_review can actually parse. Everything else is refused. */
const ALLOWED_EXT = new Set(['md', 'markdown', 'txt', 'text', 'pdf', 'docx', 'pptx']);

/** Directories that are never a document source, even inside an allowed root. */
const DENIED_SEGMENTS = new Set(['.git', '.ssh', '.gnupg', '.aws', '.argus', '.env']);

export class ReviewPathError extends Error {
  code: string;
  recovery: string;
  constructor(code: string, message: string, recovery: string) {
    super(message);
    this.name = 'ReviewPathError';
    this.code = code;
    this.recovery = recovery;
  }
}

/** Every root the user has opted into, most specific first. */
export function reviewRoots(argusDir?: string): string[] {
  const roots: string[] = [];
  const add = (p: string | undefined) => {
    if (!p) return;
    const r = path.resolve(p);
    if (!roots.includes(r)) roots.push(r);
  };

  // The project this call named: argus_dir is `<project>/.argus`.
  if (argusDir) add(path.dirname(argusDir));
  // Where the host launched the server — normally the project the user is in.
  add(process.cwd());
  // Every project the user registered with argus_init, on this machine.
  for (const dir of readGlobalBoundList()) add(path.dirname(dir));
  // An explicit, user-set escape hatch for docs kept outside any project.
  for (const p of (process.env.ARGUS_REVIEW_ROOTS || '').split(path.delimiter)) {
    if (p.trim()) add(p.trim());
  }
  return roots;
}

/**
 * Resolve `filePath` to a real path that argus_review may read, or throw a
 * ReviewPathError naming the boundary it crossed. Never widens on failure.
 */
export function resolveReviewFile(filePath: string, argusDir?: string): string {
  const ext = (filePath.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new ReviewPathError(
      'UNSUPPORTED_FILE_TYPE',
      `argus_review reads documents (${[...ALLOWED_EXT].join(', ')}), not ".${ext}" files.`,
      'Paste the content into `text` instead. Argus refuses non-document paths so a document can never talk it into reading a key or a credentials file.',
    );
  }

  const resolved = path.resolve(filePath);
  const segments = resolved.split(/[\\/]/);
  if (segments.some((s) => DENIED_SEGMENTS.has(s.toLowerCase()))) {
    throw new ReviewPathError(
      'PATH_NOT_ALLOWED',
      'That path lives in a directory Argus will not read from.',
      'Move the document outside a dotfile directory, or paste its text into `text`.',
    );
  }

  const roots = reviewRoots(argusDir);
  let real: string | null = null;
  for (const root of roots) {
    try {
      real = assertInside(root, resolved); // realpaths both sides — symlink-safe
      break;
    } catch (e) {
      if (!(e instanceof PathSafetyError)) throw e;
    }
  }
  if (!real) {
    throw new ReviewPathError(
      'PATH_NOT_ALLOWED',
      'That file is outside every project Argus is allowed to read.',
      'Review a document inside this project, run argus_init in the project that holds it, or set ARGUS_REVIEW_ROOTS. You can always paste the text into `text`.',
    );
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(real);
  } catch {
    throw new ReviewPathError('READ_FAILED', `Could not read file: ${filePath}`, 'Check the path, or paste the text into `text`.');
  }
  if (!stat.isFile()) {
    throw new ReviewPathError('PATH_NOT_ALLOWED', 'That path is not a regular file.', 'Point at a document, or paste the text into `text`.');
  }
  return real;
}
