// SessionStart: remember where the session started and give Claude the working agreement.
import { readInput, emit, repoRoot, loadConfig, loadSession, saveSession, newSession } from './lib.mjs';

const input = await readInput();
const cwd = input.cwd || process.cwd();
const root = repoRoot(cwd);
if (!root) process.exit(0); // outside a git repository slow down stays quiet

const cfg = loadConfig(root);
if (!cfg.enabled) process.exit(0);

const existing = loadSession(input.session_id);
if (!existing || existing.root !== root) saveSession(input.session_id, newSession(root, cfg));

const context = `slow down (Claude Code plugin) is active in this repository. Intensity: ${cfg.intensity}.

Working agreement for this session: the engineer is the architect and owns the architecture decisions. Claude implements within the decisions the engineer has made.
- Architecture decisions are: new dependencies, module and service boundaries, public interfaces and API contracts, data model and schema changes, infrastructure, error handling and retry or consistency semantics, concurrency, and security-relevant choices.
- For a non-trivial task, Claude asks for the engineer's intended approach before proposing its own.
- For an architecture decision, Claude names the decision, lays out 2-3 options with trade-offs, and lets the engineer choose. Claude's own recommendation comes only after the engineer has committed to a choice.
- Decisions are recorded with \`slow-down decide "<key>" "<the engineer's reasoning in their words>"\` in .slow-down/decisions.md.
- Hooks back this up: some changes are held until the decision is recorded, and after larger changes a short design-defense checkpoint runs.
- The skill slow-down:architect-mode holds the full protocol, the decision taxonomy and the checkpoint question bank.`;

emit({
  hookSpecificOutput: {
    hookEventName: 'SessionStart',
    additionalContext: context,
  },
});
