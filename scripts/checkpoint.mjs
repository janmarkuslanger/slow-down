// Stop: after enough change since the last checkpoint, send Claude into a short design defense.
import {
  readInput,
  emit,
  repoRoot,
  loadConfig,
  loadSession,
  saveSession,
  newSession,
  changedLines,
  skipState,
  latestDesignNote,
} from './lib.mjs';

const input = await readInput();
if (input.stop_hook_active) process.exit(0); // already continuing because of a stop hook: never loop

const cwd = input.cwd || process.cwd();
const root = repoRoot(cwd);
if (!root) process.exit(0);

const cfg = loadConfig(root);
if (!cfg.enabled || skipState(root)) process.exit(0);

let state = loadSession(input.session_id);
if (!state || state.root !== root) {
  // First time we see this session in this repo: start counting from here.
  saveSession(input.session_id, newSession(root, cfg));
  process.exit(0);
}

const changes = changedLines(root, state.startRef, cfg.ignore);
if (!changes) process.exit(0);

const delta = Math.max(0, changes.total - state.baseline);
if (delta < state.lastCheckpointDelta) state.lastCheckpointDelta = delta; // work was reverted
if (delta - state.lastCheckpointDelta < cfg.checkpointLines) {
  saveSession(input.session_id, state);
  process.exit(0);
}

const sinceLast = delta - state.lastCheckpointDelta;
state = { ...state, lastCheckpointDelta: delta, checkpoints: state.checkpoints + 1 };
saveSession(input.session_id, state);

const top = [...changes.files.entries()]
  .filter(([, n]) => n > 0)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .map(([file, n]) => `- ${file} (${n})`)
  .join('\n');

const note = latestDesignNote(root);
const noteLine = note
  ? `\nDesign note: ${note}. Compare the change against it and name every deviation. The engineer either accepts a deviation (and updates the note) or rejects it.\n`
  : '';

emit({
  decision: 'block',
  systemMessage: `🐢 slow down checkpoint: about ${sinceLast} changed lines since the last one.`,
  reason: `slow down checkpoint: about ${sinceLast} lines changed since the last checkpoint (intensity: ${cfg.intensity}).

Before handing back, run a short design defense with the engineer. Changed so far, largest first:
${top || '- (no file list available)'}
${noteLine}
How to run it:
- Ask 2-3 questions about the design, not about syntax: boundaries and responsibilities, failure modes (partial failure, retries, timeouts), data and consistency, how the change holds up when requirements shift, which alternative was rejected and why.
- Derive the questions from what this change actually does and point at concrete files and functions.
- Ask, then end your turn. When the engineer answers, give honest feedback: confirm what is right, name gaps precisely and explain them briefly. It is a pair-programming conversation, not an exam.
- If the engineer wants to skip, accept that. They can log a reason with: slow-down skip "<reason>"
The skill slow-down:architect-mode has the question bank and the feedback rubric.`,
});
