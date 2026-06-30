import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staticJsRoot = path.join(repoRoot, 'crates/ironclaw_webui_v2_static/static/js');
const staticStylesRoot = path.join(repoRoot, 'crates/ironclaw_webui_v2_static/static/styles');

const excludedDirs = new Set(['vendor']);
const excludedFiles = new Set(['main.bundle.js']);
const rawStatusColorPattern =
  /\b(?:text|bg|border|hover:text|hover:bg|hover:border|focus:text|focus:bg|focus:border|focus:ring|ring)-(?:red|yellow|amber|orange|emerald|green|lime)-\d+(?:\/\d+)?\b/g;

// Alias colour utilities (iron-N / signal / copper / mint, with optional
// /opacity and state variants) are NOT real Tailwind palette colours — they only
// render because app.css remaps them via `[class~="…"]` selectors (or bare
// `.class` rules). A class used in JS that has no matching remap rule and no real
// generated Tailwind rule is an invisible no-op: borders, dot fills, and panel
// backgrounds silently disappear. This pattern enumerates every such alias class
// referenced in shipped JS so the coverage gate below can prove each one resolves.
const aliasColorPattern =
  /\b((?:hover:|focus:|active:|group-hover:)?(?:bg|text|border|ring|from|to|via|fill|stroke)-(?:iron-\d+|signal|copper|mint)(?:\/(?:\[[^\]]+\]|\d+))?)\b/g;

// Known-unmapped alias classes. These render as no-ops today (rows 33/50 of
// docs/reviews/elite-audit-reverify-2026-06-29.md). Batch I maps them to real
// --v2 tokens in app.css and removes them from this allowlist; until then the
// coverage gate reports them but does not fail the build on them. Do NOT add new
// entries here — a newly-introduced unmapped alias class is a real defect.
// TODO(elite-audit #33,#50): remove these as Batch I maps them in app.css.
const KNOWN_UNMAPPED_ALIAS_CLASSES = Object.freeze([
  'bg-copper/20',
  'bg-iron-800/50',
  'bg-iron-800/60',
  'bg-iron-800/70',
  'bg-iron-900/70',
  'bg-iron-950/40',
  'bg-iron-950/50',
  'bg-iron-950/55',
  'bg-iron-950/70',
  'bg-iron-950/78',
  'bg-mint/10',
  'bg-mint/20',
  'bg-signal/50',
  'border-copper/25',
  'border-copper/40',
  'border-iron-700/40',
  'border-iron-700/60',
  'border-mint/15',
  'border-mint/30',
  'border-signal/20',
  'focus:border-signal/40',
  'group-hover:border-signal/35',
  'hover:bg-copper/10',
  'hover:bg-iron-800/80'
]);

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (excludedDirs.has(entry.name)) return [];
        return collectFiles(fullPath);
      }
      if (!entry.isFile()) return [];
      if (!entry.name.endsWith('.js')) return [];
      if (excludedFiles.has(entry.name)) return [];
      return [fullPath];
    })
  );
  return files.flat();
}

function lineAndColumn(source, index) {
  const before = source.slice(0, index);
  const lines = before.split('\n');
  return {
    line: lines.length,
    column: lines.at(-1).length + 1
  };
}

// Raw red/yellow/green status utilities must route through --v2 semantic tokens.
async function checkRawStatusTokens(files, sources) {
  const violations = [];
  for (const file of files) {
    const source = sources.get(file);
    for (const match of source.matchAll(rawStatusColorPattern)) {
      const position = lineAndColumn(source, match.index ?? 0);
      violations.push(
        `${path.relative(repoRoot, file)}:${position.line}:${position.column} uses ${match[0]}`
      );
    }
  }
  return violations;
}

// Does an alias class have a real rule in tailwind.generated.css or an app.css
// remap (`[class~="cls"]` selector or a bare `.cls` rule)?
function aliasClassIsMapped(cls, appCss, tailwindCss) {
  if (appCss.includes(`[class~="${cls}"]`)) return true;
  // Escape CSS-significant characters for a bare/real-rule selector probe.
  const escaped = '.' + cls.replace(/[:/.[\]]/g, (ch) => `\\${ch}`);
  if (
    tailwindCss.includes(`${escaped}{`) ||
    tailwindCss.includes(`${escaped} `) ||
    tailwindCss.includes(`${escaped},`) ||
    tailwindCss.includes(`${escaped}:`)
  ) {
    return true;
  }
  // Bare app.css rule, e.g. `.text-iron-100, .text-iron-200 { … }`.
  if (appCss.includes(`.${cls},`) || appCss.includes(`.${cls} `) || appCss.includes(`.${cls}\n`)) {
    return true;
  }
  return false;
}

// Coverage gate: every alias colour class shipped in JS must resolve to a real
// rule (tailwind.generated.css) or an app.css remap. Unmapped classes outside the
// known-unmapped allowlist fail the build.
async function checkAliasClassCoverage(files, sources) {
  const usedClasses = new Set();
  for (const file of files) {
    const source = sources.get(file);
    for (const match of source.matchAll(aliasColorPattern)) usedClasses.add(match[1]);
  }

  const appCss = await readFile(path.join(staticStylesRoot, 'app.css'), 'utf8');
  const tailwindCss = await readFile(path.join(staticStylesRoot, 'tailwind.generated.css'), 'utf8');
  const allowlist = new Set(KNOWN_UNMAPPED_ALIAS_CLASSES);

  const unmapped = [];
  const allowed = [];
  for (const cls of [...usedClasses].sort()) {
    if (aliasClassIsMapped(cls, appCss, tailwindCss)) continue;
    if (allowlist.has(cls)) {
      allowed.push(cls);
      continue;
    }
    unmapped.push(cls);
  }

  // Keep the allowlist honest: if an allowlisted class became mapped (Batch I) it
  // must be removed from the allowlist so the constant cannot rot.
  const staleAllowlist = [...allowlist].filter((cls) =>
    aliasClassIsMapped(cls, appCss, tailwindCss)
  );

  return { used: usedClasses.size, unmapped, allowed, staleAllowlist };
}

export async function runStaticStatusTokenLint() {
  const files = await collectFiles(staticJsRoot);
  const sources = new Map();
  await Promise.all(
    files.map(async (file) => {
      sources.set(file, await readFile(file, 'utf8'));
    })
  );

  const errors = [];

  const rawViolations = await checkRawStatusTokens(files, sources);
  if (rawViolations.length > 0) {
    errors.push('Static UI status states must use --v2 semantic tokens.');
    errors.push('Replace raw red/yellow/green Tailwind status utilities with v2 tokens.');
    for (const violation of rawViolations) errors.push(`- ${violation}`);
  }

  const coverage = await checkAliasClassCoverage(files, sources);
  if (coverage.unmapped.length > 0) {
    errors.push(
      'Alias colour classes used in shipped JS must resolve to a real Tailwind rule ' +
        'or an app.css remap; the following render as invisible no-ops:'
    );
    for (const cls of coverage.unmapped) errors.push(`- ${cls}`);
  }
  if (coverage.staleAllowlist.length > 0) {
    errors.push(
      'KNOWN_UNMAPPED_ALIAS_CLASSES is stale — these classes are now mapped and must ' +
        'be removed from the allowlist (see elite-audit #33,#50):'
    );
    for (const cls of coverage.staleAllowlist) errors.push(`- ${cls}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    scannedFiles: files.length,
    aliasClassesUsed: coverage.used,
    aliasClassesAllowlisted: coverage.allowed.length
  };
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const result = await runStaticStatusTokenLint();
  if (!result.ok) {
    for (const line of result.errors) console.error(line);
    process.exit(1);
  }
  console.log(
    `Static status token lint OK: ${result.scannedFiles} shipped JS files scanned; ` +
      `${result.aliasClassesUsed} alias colour classes verified ` +
      `(${result.aliasClassesAllowlisted} known-unmapped allowlisted).`
  );
}
