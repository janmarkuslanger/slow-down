// PreToolUse: hold back changes that carry an architecture decision the engineer hasn't made yet.
import fs from 'node:fs';
import path from 'node:path';
import {
  readInput,
  emit,
  repoRoot,
  loadConfig,
  relToRoot,
  readDecisions,
  isDecided,
  skipState,
} from './lib.mjs';

const SCHEMA_RE =
  /(^|\/)(migrations?|db\/migrate|alembic|flyway)\/|(^|\/)(schema\.prisma|schema\.sql|structure\.sql)$|\.sql$/i;
const INFRA_RE =
  /(^|\/)(cdk|infra|infrastructure|terraform|helm|k8s|kubernetes|deploy|\.github\/workflows)\/|\.tf$|(^|\/)(Dockerfile|docker-compose[^/]*\.ya?ml|compose\.ya?ml|serverless\.ya?ml|cdk\.json)$/i;
const CONTRACT_RE = /(^|\/)(openapi|swagger)[^/]*\.(ya?ml|json)$|\.proto$|\.graphqls?$|\.avsc$/i;
const NOT_A_MODULE_RE = /(^|\/)(__tests__|tests?|spec|specs|fixtures|__mocks__|mocks|docs?|\.slow-down)(\/|$)/i;

const input = await readInput();
const cwd = input.cwd || process.cwd();
const root = repoRoot(cwd);
if (!root) process.exit(0);

const cfg = loadConfig(root);
if (!cfg.enabled || skipState(root)) process.exit(0);

const tool = input.tool_name;
const ti = input.tool_input || {};
const signals = [];

if (tool === 'Bash') {
  for (const name of installedPackages(String(ti.command || ''))) {
    signals.push({ kind: 'dependency', key: `dep:${name}`, what: `adds the dependency "${name}"` });
  }
} else if (['Write', 'Edit', 'MultiEdit'].includes(tool)) {
  const rel = relToRoot(root, ti.file_path);
  if (rel) fileSignals(rel, path.join(root, rel));
}

const decisions = readDecisions(root);
const open = dedupe(signals)
  .filter((s) => cfg.signals.includes(s.kind))
  .filter((s) => !isDecided(decisions, s.key));

if (!open.length) process.exit(0);

const list = open.map((s) => `- ${s.key}: ${s.what}`).join('\n');
const example = open[0].key;

emit({
  systemMessage: `🐢 slow down: ${open.map((s) => s.key).join(', ')}. Your call, Claude lays out the options.`,
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: `slow down: this change carries an architecture decision the engineer has not made yet.

Open decision(s):
${list}

This decision belongs to the engineer, not to Claude. Pause the implementation and hand it over:
1. Name the decision and why it matters for this codebase, in one or two sentences.
2. Lay out 2-3 real options with their trade-offs, including not doing it (for a dependency: no new dependency).
3. Ask the engineer to choose and to say why. Hold back your own recommendation until they have committed; then agree or push back honestly.

Once the engineer has decided, record it with their reasoning in their own words, for example:
  slow-down decide "${example}" "<engineer's reasoning>"
Then retry the change, adjusted to what they decided.`,
  },
});

// ---------------------------------------------------------------------------

function fileSignals(rel, abs) {
  const base = path.posix.basename(rel);
  const { before, after } = proposedContent(abs);

  if (base === 'package.json') {
    for (const name of added(npmDeps(before), npmDeps(after))) {
      signals.push({ kind: 'dependency', key: `dep:${name}`, what: `adds the dependency "${name}" in ${rel}` });
    }
  } else if (/^requirements[^/]*\.txt$/i.test(base)) {
    for (const name of added(pipDeps(before), pipDeps(after))) {
      signals.push({ kind: 'dependency', key: `dep:${name}`, what: `adds the dependency "${name}" in ${rel}` });
    }
  } else if (base === 'go.mod') {
    for (const name of added(goDeps(before), goDeps(after))) {
      signals.push({ kind: 'dependency', key: `dep:${name}`, what: `adds the module "${name}" in ${rel}` });
    }
  }

  if (SCHEMA_RE.test(rel)) {
    signals.push({ kind: 'schema', key: `schema:${rel}`, what: `changes the data model or schema (${rel})` });
  }
  if (INFRA_RE.test(rel)) {
    signals.push({ kind: 'infra', key: `infra:${rel}`, what: `changes infrastructure or deployment (${rel})` });
  }
  if (CONTRACT_RE.test(rel)) {
    signals.push({ kind: 'contract', key: `contract:${rel}`, what: `changes a public contract (${rel})` });
  }
  const pathSignal = SCHEMA_RE.test(rel) || INFRA_RE.test(rel) || CONTRACT_RE.test(rel);
  if (tool === 'Write' && !pathSignal) {
    const mod = newModuleDir(rel);
    if (mod) signals.push({ kind: 'module', key: `module:${mod}`, what: `creates a new module or boundary (${mod}/)` });
  }
}

// The file content before and after the tool call, so dependency changes can be diffed.
function proposedContent(abs) {
  let current = null;
  try {
    current = fs.readFileSync(abs, 'utf8');
  } catch {
    // new file
  }
  if (tool === 'Write') return { before: current, after: String(ti.content ?? '') };
  const edits = Array.isArray(ti.edits) ? ti.edits : [ti];
  let after = current ?? '';
  for (const e of edits) {
    if (typeof e.old_string !== 'string' || typeof e.new_string !== 'string') continue;
    after = e.replace_all
      ? after.split(e.old_string).join(e.new_string)
      : after.replace(e.old_string, () => e.new_string);
  }
  return { before: current, after };
}

function added(beforeSet, afterSet) {
  if (!afterSet) return [];
  return [...afterSet].filter((name) => !(beforeSet && beforeSet.has(name)));
}

function npmDeps(text) {
  if (text == null) return new Set();
  try {
    const pkg = JSON.parse(text);
    const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
    return new Set(sections.flatMap((k) => Object.keys(pkg[k] || {})));
  } catch {
    return null; // mid-edit invalid JSON: no reliable signal
  }
}

function pipDeps(text) {
  if (text == null) return new Set();
  const names = text
    .split('\n')
    .map((l) => l.replace(/#.*/, '').trim())
    .filter((l) => l && !l.startsWith('-'))
    .map((l) => l.split(/[<>=!~[;\s@]/)[0].trim().toLowerCase())
    .filter(Boolean);
  return new Set(names);
}

function goDeps(text) {
  if (text == null) return new Set();
  const names = [];
  let inBlock = false;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\/\/.*/, '').trim();
    if (/^require\s*\($/.test(line)) inBlock = true;
    else if (inBlock && line === ')') inBlock = false;
    else if (inBlock && line) names.push(line.split(/\s+/)[0]);
    else if (/^require\s+\S+/.test(line)) names.push(line.split(/\s+/)[1]);
  }
  return new Set(names);
}

function installedPackages(command) {
  const names = [];
  const patterns = [
    { re: /\b(?:npm|pnpm)\s+(?:install|i|add)\s+(.+)/, clean: npmName },
    { re: /\b(?:yarn|bun)\s+add\s+(.+)/, clean: npmName },
    { re: /\bpip3?\s+install\s+(.+)/, clean: (a) => a.split(/[<>=!~[;@]/)[0].toLowerCase() },
    { re: /\b(?:poetry|uv)\s+add\s+(.+)/, clean: (a) => a.split(/[<>=!~[;@]/)[0].toLowerCase() },
    { re: /\bcargo\s+add\s+(.+)/, clean: (a) => a.split('@')[0] },
    { re: /\bgo\s+get\s+(.+)/, clean: (a) => a.split('@')[0] },
  ];
  for (const segment of command.split(/&&|\|\||;|\||\n/)) {
    for (const { re, clean } of patterns) {
      const m = segment.match(re);
      if (!m) continue;
      const args = m[1].trim().split(/\s+/);
      if (args.some((a) => a === '-r' || a === '--requirement' || a === '-e' || a === '--editable')) continue;
      for (const raw of args) {
        const arg = raw.replace(/^['"]|['"]$/g, '');
        if (!isPackageArg(arg)) continue;
        const name = clean(arg);
        if (name) names.push(name);
      }
    }
  }
  return [...new Set(names)];
}

// Package names, scoped npm packages and Go module paths count; flags and local paths don't.
function isPackageArg(arg) {
  if (!arg || arg.startsWith('-') || arg.startsWith('.') || arg.startsWith('/')) return false;
  if (!arg.includes('/')) return true;
  return arg.startsWith('@') || /^[\w-]+(\.[\w-]+)+\//.test(arg);
}

function npmName(arg) {
  if (arg.startsWith('@')) {
    const [scope, rest = ''] = arg.slice(1).split('/');
    return rest ? `@${scope}/${rest.split('@')[0]}` : '';
  }
  return arg.split('@')[0];
}

// A Write into a directory that doesn't exist yet, near the top of the repo, is a new module.
function newModuleDir(rel) {
  const parts = rel.split('/').slice(0, -1);
  for (let i = 1; i <= parts.length; i += 1) {
    const dir = parts.slice(0, i).join('/');
    if (!fs.existsSync(path.join(root, dir))) {
      if (i > 3 || NOT_A_MODULE_RE.test(dir)) return null;
      return dir;
    }
  }
  return null;
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((s) => (seen.has(s.key) ? false : seen.add(s.key)));
}
