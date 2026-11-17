import { Command } from 'commander';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, extname, join, relative, resolve } from 'node:path';
import { createClientFromOptions } from '../lib/clientFactory.js';
import type { NoteRecord } from '../lib/apiClient.js';
import { printError, printJson } from '../lib/output.js';

const DEFAULT_EXTENSIONS = ['.md', '.markdown'];

/**
 * Hard ceiling on a single note, in words.
 *
 * An oversized note is not just a poor retrieval unit — retrieved verbatim into a
 * chat prompt it can crowd out everything else, and a document whose sections are
 * marked with bold text rather than `##` yields nothing for heading-splitting to cut.
 * Observed on a real file that imported as a single 27 691-word note.
 */
const DEFAULT_MAX_WORDS = 1500;

/** Directories that are never worth indexing. */
const SKIP_DIRS = new Set(['.git', 'node_modules', '.svelte-kit', 'dist', 'build', '.venv']);

interface ImportOptions {
  url?: string;
  token?: string;
  json?: boolean;
  ext?: string;
  split?: boolean;
  dryRun?: boolean;
  prefix?: string;
  maxWords?: string;
}

/**
 * Split a chunk that is still oversized after heading-splitting.
 *
 * Cuts on blank lines so paragraphs stay intact, and prefers not to cut inside a
 * fenced code block. Parts are suffixed `(1/3)`, `(2/3)` … so the pieces remain
 * recognisable as one document in search results.
 */
function splitByWords(title: string, content: string, maxWords: number): Candidate[] {
  if (content.split(/\s+/).filter(Boolean).length <= maxWords) {
    return [{ title, content, sourcePath: '' }];
  }
  const paras = content.split(/\n\s*\n/);
  const chunks: string[] = [];
  let buf: string[] = [];
  let count = 0;
  let inFence = false;
  // ⚠️A HARD CEILING THAT IGNORES `inFence`. Keeping a code block intact is a
  // nice-to-have; emitting a 22 000-word note is a correctness failure. Real markdown
  // contains unbalanced fences — one stray ``` leaves `inFence` stuck on, and without
  // this valve every paragraph after it accumulates into a single chunk. Found on a
  // real file whose only fence marker was unmatched.
  const hardCeiling = maxWords * 3;
  for (const para of paras) {
    const fences = (para.match(/```/g) ?? []).length;
    const words = para.split(/\s+/).filter(Boolean).length;
    const overHard = count > 0 && count + words > hardCeiling;
    if (count > 0 && count + words > maxWords && (!inFence || overHard)) {
      chunks.push(buf.join('\n\n'));
      buf = [];
      count = 0;
      if (overHard) inFence = false; // fence state is untrustworthy; reset it
    }
    buf.push(para);
    count += words;
    if (fences % 2 === 1) inFence = !inFence;
  }
  if (buf.length) chunks.push(buf.join('\n\n'));
  if (chunks.length <= 1) return [{ title, content, sourcePath: '' }];
  return chunks.map((c, i) => ({
    title: `${title} (${i + 1}/${chunks.length})`,
    content: c,
    sourcePath: '',
  }));
}

interface Candidate {
  title: string;
  content: string;
  sourcePath: string;
}

async function walk(dir: string, exts: string[], out: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(full, exts, out);
    } else if (exts.includes(extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Split a document on its top-level `##` headings.
 *
 * A very long single note is a poor retrieval unit: chunking is coarse and the
 * whole document comes back as the answer to everything. Splitting on section
 * headings gives the index units that are about one thing. Content before the
 * first heading is kept as its own note so nothing is dropped.
 */
function splitSections(title: string, content: string): Candidate[] {
  const lines = content.split('\n');
  const cuts: number[] = [];
  let inFence = false;
  lines.forEach((line, i) => {
    if (/^\s*```/.test(line)) inFence = !inFence;
    // A heading inside a fenced code block is not a heading. Bash comments like
    // `## step 2` in an example block would otherwise split the document.
    if (!inFence && /^##\s+\S/.test(line)) cuts.push(i);
  });
  if (cuts.length === 0) return [{ title, content, sourcePath: '' }];

  const out: Candidate[] = [];
  const preamble = lines.slice(0, cuts[0]).join('\n').trim();
  if (preamble) out.push({ title, content: preamble, sourcePath: '' });

  cuts.forEach((start, idx) => {
    const end = idx + 1 < cuts.length ? cuts[idx + 1] : lines.length;
    const body = lines.slice(start, end).join('\n').trim();
    if (!body) return;
    const heading = lines[start].replace(/^#+\s*/, '').trim().slice(0, 120);
    out.push({ title: `${title} — ${heading}`, content: body, sourcePath: '' });
  });
  return out;
}

/** Stable id so re-running an import updates notes instead of duplicating them. */
function stableId(sourcePath: string, title: string): string {
  return createHash('sha1').update(`${sourcePath}::${title}`).digest('hex').slice(0, 24);
}

export const importCommand = new Command('import')
  .description('Import markdown files from a directory or file into notes')
  .argument('<path>', 'File or directory to import')
  .option('--url <url>', 'API base URL')
  .option('--token <token>', 'API bearer token')
  .option('--ext <list>', 'Comma-separated extensions', DEFAULT_EXTENSIONS.join(','))
  .option('--split', 'Split each file into one note per top-level "##" section')
  .option('--max-words <n>', 'Further split any note longer than this many words', String(DEFAULT_MAX_WORDS))
  .option('--prefix <prefix>', 'Prepend a prefix to every note title')
  .option('--dry-run', 'List what would be imported without writing')
  .option('--json', 'Output machine-readable JSON')
  .action(async (target: string, opts: ImportOptions) => {
    try {
      const root = resolve(target);
      const info = await stat(root);
      const exts = (opts.ext ?? DEFAULT_EXTENSIONS.join(','))
        .split(',')
        .map((e) => (e.startsWith('.') ? e : `.${e}`).trim().toLowerCase());

      const files = info.isDirectory() ? await walk(root, exts) : [root];
      files.sort();

      const candidates: Candidate[] = [];
      for (const file of files) {
        const raw = await readFile(file, 'utf8');
        if (!raw.trim()) continue;
        const rel = info.isDirectory() ? relative(root, file) : basename(file);
        const base = rel.replace(/\.(md|markdown)$/i, '');
        const titled = opts.prefix ? `${opts.prefix}${base}` : base;
        const maxWords = Number(opts.maxWords ?? DEFAULT_MAX_WORDS);
        const sections = opts.split
          ? splitSections(titled, raw)
          : [{ title: titled, content: raw, sourcePath: '' }];
        const parts = Number.isFinite(maxWords) && maxWords > 0
          ? sections.flatMap((s) => splitByWords(s.title, s.content, maxWords))
          : sections;
        for (const part of parts) candidates.push({ ...part, sourcePath: rel });
      }

      if (opts.dryRun) {
        const preview = candidates.map((c) => ({
          title: c.title,
          words: c.content.split(/\s+/).filter(Boolean).length,
          source: c.sourcePath,
        }));
        if (opts.json) {
          printJson({ ok: true, dryRun: true, count: preview.length, notes: preview });
          return;
        }
        for (const p of preview) console.log(`${String(p.words).padStart(7)} words  ${p.title}`);
        console.log(`\n${preview.length} note(s) would be imported from ${files.length} file(s).`);
        return;
      }

      const { client } = createClientFromOptions(opts);
      const failures: { title: string; error: string }[] = [];
      let imported = 0;

      for (const c of candidates) {
        const note: NoteRecord = {
          id: stableId(c.sourcePath, c.title),
          title: c.title,
          content: c.content,
          dateModified: Date.now(),
          isPinned: false,
        };
        try {
          await client.upsertNote(note);
          imported += 1;
          if (!opts.json) console.log(`imported  ${c.title}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          // `notes-cli login` requests read-only scopes by default, which is the
          // right least-privilege default for a CLI that could not write until now.
          // Fail loudly with the exact fix rather than repeating the same 403 for
          // every file in the directory.
          if (/403|Forbidden|notes:write/i.test(message)) {
            throw new Error(
              'Import needs a token with the "notes:write" scope, and `notes-cli login` ' +
                'requests read-only scopes by default.\n' +
                'Create a write-capable token with:\n' +
                '  notes-cli login --scopes notes:read,notes:write,query:read,graph:read,skills:read'
            );
          }
          failures.push({ title: c.title, error: message });
        }
      }

      if (opts.json) {
        printJson({ ok: failures.length === 0, imported, failed: failures.length, failures });
        return;
      }
      console.log(`\n${imported} note(s) imported from ${files.length} file(s).`);
      if (failures.length) {
        console.log(`${failures.length} failed:`);
        for (const f of failures) console.log(`  ${f.title}: ${f.error}`);
        process.exitCode = 1;
      }
    } catch (err) {
      printError(err, opts.json);
    }
  });
