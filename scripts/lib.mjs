// Shared helpers for the slow down hooks and CLI. No dependencies, Node >= 18.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

export const INTENSITIES = {
  light: { checkpointLines: 400, signals: ['dependency', 'schema', 'infra'] },
  normal: { checkpointLines: 150, signals: ['dependency', 'schema', 'infra', 'contract', 'module'] },
  deep: { checkpointLines: 50, signals: ['dependency', 'schema', 'infra', 'contract', 'module'] },
};

// Never counted towards checkpoints: lockfiles, build output, snapshots, slow down's own files.
const ALWAYS_IGNORED = [
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|poetry\.lock|uv\.lock|Cargo\.lock|go\.sum|composer\.lock|Gemfile\.lock)$/,
  /\.min\.(js|css)$/,
  /\.snap$/,
  /(^|\/)(dist|build|out|coverage|node_modules|\.next|\.turbo|cdk\.out)\//,
  /(^|\/)\.slow-down\//,
];

export async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function emit(obj) {
  process.stdout.write(JSON.stringify(obj));
}

export function git(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    maxBuffer: 64 * 1024 * 1024,
  });
}

export function repoRoot(cwd) {
  try {
    return git(['rev-parse', '--show-toplevel'], cwd).trim();
  } catch {
    return null;
  }
}

export function headRef(root) {
  try {
    return git(['rev-parse', 'HEAD'], root).trim();
  } catch {
    return EMPTY_TREE; // repository without commits yet
  }
}

export function toPosix(p) {
  return p.split(path.sep).join('/');
}

export function relToRoot(root, file) {
  if (!file) return null;
  const abs = path.isAbsolute(file) ? file : path.join(root, file);
  const rel = toPosix(path.relative(root, abs));
  if (!rel || rel.startsWith('..')) return null;
  return rel;
}

export function loadConfig(root) {
  let project = {};
  try {
    project = JSON.parse(fs.readFileSync(path.join(root, '.slow-down', 'config.json'), 'utf8'));
  } catch {
    // no project config: plugin defaults apply
  }
  const intensity =
    [project.intensity, process.env.CLAUDE_PLUGIN_OPTION_INTENSITY, 'normal'].find(
      (v) => typeof v === 'string' && INTENSITIES[v],
    ) || 'normal';
  const base = INTENSITIES[intensity];
  return {
    enabled: project.enabled !== false,
    intensity,
    checkpointLines: Number.isFinite(project.checkpointLines) ? project.checkpointLines : base.checkpointLines,
    signals: Array.isArray(project.signals) ? project.signals : base.signals,
    ignore: (Array.isArray(project.ignore) ? project.ignore : []).map(globToRegExp),
  };
}

// Minimal glob support for config "ignore" entries: ** any depth, * one segment.
export function globToRegExp(glob) {
  const escaped = String(glob)
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\/?/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${escaped}$`);
}

export function isIgnored(file, extra = []) {
  return ALWAYS_IGNORED.some((re) => re.test(file)) || extra.some((re) => re.test(file));
}

function countLines(abs) {
  try {
    const stat = fs.statSync(abs);
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) return 0;
    const buf = fs.readFileSync(abs);
    if (buf.includes(0)) return 0; // binary
    let n = 0;
    for (const byte of buf) if (byte === 10) n += 1;
    return buf.length && buf[buf.length - 1] !== 10 ? n + 1 : n;
  } catch {
    return 0;
  }
}

// Lines added + removed in the working tree compared to baseRef, including untracked files.
export function changedLines(root, baseRef, extraIgnore = []) {
  let numstat;
  try {
    numstat = git(['diff', '--numstat', baseRef], root);
  } catch {
    return null;
  }
  const files = new Map();
  for (const line of numstat.split('\n')) {
    if (!line.trim()) continue;
    const [added, removed, ...rest] = line.split('\t');
    const file = rest.join('\t');
    if (isIgnored(file, extraIgnore)) continue;
    const n = (added === '-' ? 0 : Number(added)) + (removed === '-' ? 0 : Number(removed));
    files.set(file, n);
  }
  let untracked = '';
  try {
    untracked = git(['ls-files', '--others', '--exclude-standard'], root);
  } catch {
    // ignore
  }
  for (const file of untracked.split('\n')) {
    if (!file || isIgnored(file, extraIgnore)) continue;
    files.set(file, countLines(path.join(root, file)));
  }
  let total = 0;
  for (const n of files.values()) total += n;
  return { total, files };
}

// ---- per-session state (hooks only), kept outside the repository ----

function sessionDir() {
  const base = process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), 'slow-down');
  const dir = path.join(base, 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sessionFile(sessionId) {
  const safe = String(sessionId || 'unknown').replace(/[^A-Za-z0-9_-]/g, '_');
  return path.join(sessionDir(), `${safe}.json`);
}

export function loadSession(sessionId) {
  try {
    return JSON.parse(fs.readFileSync(sessionFile(sessionId), 'utf8'));
  } catch {
    return null;
  }
}

export function saveSession(sessionId, state) {
  try {
    fs.writeFileSync(sessionFile(sessionId), JSON.stringify(state, null, 2));
  } catch {
    // state is best effort
  }
}

export function newSession(root, cfg) {
  const startRef = headRef(root);
  const now = changedLines(root, startRef, cfg.ignore);
  return {
    root,
    startRef,
    startedAt: new Date().toISOString(),
    baseline: now ? now.total : 0, // lines that were already dirty before the session
    lastCheckpointDelta: 0,
    checkpoints: 0,
  };
}

// ---- project files (.slow-down/ in the repository, created only when used) ----

export function projectDir(root) {
  return path.join(root, '.slow-down');
}

export function ensureProjectDir(root) {
  const dir = projectDir(root);
  fs.mkdirSync(path.join(dir, '.state'), { recursive: true });
  const gitignore = path.join(dir, '.gitignore');
  if (!fs.existsSync(gitignore)) fs.writeFileSync(gitignore, '# local, per-engineer state\n.state/\n');
  return dir;
}

export const DECISIONS_HEADER = `# Decisions

Architecture decisions made by the engineer, recorded with \`slow-down decide\`.
Each entry is keyed so the slow down hooks know the decision was made.

`;

export function readDecisions(root) {
  try {
    return fs.readFileSync(path.join(projectDir(root), 'decisions.md'), 'utf8');
  } catch {
    return '';
  }
}

export function isDecided(decisionsText, key) {
  return decisionsText.includes(`\`${key}\``);
}

export function skipState(root) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(projectDir(root), '.state', 'skip.json'), 'utf8'));
    if (s && Date.parse(s.until) > Date.now()) return s;
  } catch {
    // no active skip
  }
  return null;
}

export function latestDesignNote(root) {
  const dir = path.join(projectDir(root), 'designs');
  try {
    const notes = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    return notes.length ? `.slow-down/designs/${notes[0].f}` : null;
  } catch {
    return null;
  }
}
