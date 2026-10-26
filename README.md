<p align="center">
  <img src="assets/logo.svg" width="160" alt="slow down logo: a smug face with one raised eyebrow and steam from the nose">
</p>

<h1 align="center">slow down</h1>

<p align="center"><b>Claude implements. You decide.</b><br>
A Claude Code plugin that keeps the engineer in the architect seat.</p>

---

AI coding makes it easy to ship code you never really designed. The diff looks fine, the tests pass, you click accept, and three weeks later nobody can explain why the retry logic lives where it lives.

**slow down** puts a little friction exactly where it matters. Claude still writes the code. But dependencies, boundaries, contracts, schema, infrastructure and failure semantics are your call, and after larger changes Claude asks you to defend the design, like a good senior colleague would in a pairing session.

It is built for engineers who want to stay sharp, not for managers who want to police them. There is no lock-in and no enforcement from above. You can pause it any time, with a reason.

## How it works

| Piece | What it does |
| --- | --- |
| **SessionStart hook** | Gives Claude the working agreement: you are the architect, Claude implements within your decisions. |
| **PreToolUse hook** | Holds back a change that carries an architecture decision you haven't made yet: a new dependency, a migration, an infra file, a public contract, a new module. Claude then lays out the options and lets you choose. |
| **Stop hook** | After enough change since the last checkpoint, Claude runs a short design defense: 2-3 questions about boundaries, failure modes, data and evolution, followed by honest feedback on your answers. |
| **`architect-mode` skill** | The protocol: intent before proposal, options before recommendation (so you aren't anchored), the decision taxonomy, the question bank and the feedback rubric. |
| **`/slow-down:design`** | You design, Claude interviews and writes it down. Produces a design note in `.slow-down/designs/`. Claude's critique comes after you committed to your approach. |
| **`/slow-down:defend`** | A design-defense checkpoint on demand. |
| **`architect` output style** | Optional, for the full experience: `/output-style slow-down:architect`. |
| **`slow-down` CLI** | `decide`, `skip`, `status`, `init`. On the PATH inside Claude Code while the plugin is enabled. |

### The decision loop

```text
Claude wants to add axios
  → hook holds the change: "dep:axios is your call"
  → Claude: what the decision is, 2-3 options incl. "no new dependency", trade-offs
  → you choose and say why
  → Claude records it: slow-down decide "dep:axios" "<your reasoning>"
  → the change goes through, adjusted to your decision
```

Decisions land in `.slow-down/decisions.md`. Commit it: it becomes a lightweight decision log for your team, written in the words of the people who made the decisions.

## Install

```bash
claude plugin marketplace add janmarkuslanger/slow-down
claude plugin install slow-down@janmarkuslanger
```

Or inside a session: `/plugin marketplace add janmarkuslanger/slow-down`, then `/plugin install slow-down@janmarkuslanger`.

## Use

Nothing to do for the basics. Work as usual and slow down steps in when a decision or a checkpoint is due.

```bash
slow-down init                                  # optional: .slow-down/ with config, decision log, designs/
slow-down status                                # intensity, skip state, recent decisions
slow-down skip --for 1h "incident, hotfixing"   # pause, with a reason that stays in a local log
slow-down unskip
```

You rarely type `slow-down decide` yourself; Claude records your decision with your reasoning. For decisions without a hook signal (retry policy, caching, consistency model) Claude uses keys like `arch:retry-policy`.

## Configure

**Intensity**, per user, via `/config` or `/plugin configure slow-down@janmarkuslanger`:

| Intensity | Holds back | Checkpoint every |
| --- | --- | --- |
| `light` | dependencies, schema, infra | ~400 changed lines |
| `normal` (default) | + contracts, new modules | ~150 changed lines |
| `deep` | same as normal | ~50 changed lines |

**Per repository**, in `.slow-down/config.json` (overrides the user setting):

```json
{
  "intensity": "normal",
  "checkpointLines": 200,
  "signals": ["dependency", "schema", "infra", "contract", "module"],
  "ignore": ["**/*.generated.ts", "src/legacy/**"],
  "enabled": true
}
```

Changed lines are counted against the commit the session started on, so committing mid-session doesn't reset the count. Lockfiles, build output and snapshots never count.

## What gets detected

- **Dependencies:** additions to `package.json`, `requirements*.txt`, `go.mod`; `npm/pnpm install|add`, `yarn/bun add`, `pip install`, `poetry/uv add`, `cargo add`, `go get`.
- **Schema:** `migrations/`, `db/migrate/`, `alembic/`, `schema.prisma`, `*.sql`.
- **Infrastructure:** `cdk/`, `infra/`, `terraform/`, `helm/`, `k8s/`, `deploy/`, `.github/workflows/`, `*.tf`, `Dockerfile`, compose files, `serverless.yml`, `cdk.json`.
- **Contracts:** OpenAPI/Swagger files, `*.proto`, `*.graphql`, `*.avsc`.
- **Modules:** a new directory up to three levels below the repo root (tests, docs and fixtures excluded).

Everything else in the taxonomy (failure semantics, concurrency, security) is handled by the skill, not by a hook, because no regex can see it.

## Honest limits

- It is a helper, not a guard. A determined Claude or engineer can route around it, and that's fine: the point is to make the right path the easy one.
- Signals are heuristics. Expect the occasional false positive; tune `signals` and `ignore` per repo.
- A decision key covers later edits of the same file. Changing a schema file again after its decision was recorded won't be held back.
- Checkpoints are only as good as the questions. If they feel generic, open an issue with an example.

## Requirements

- Claude Code v2.1.271 or later (for the intensity picker)
- Node.js 18 or later on the PATH
- git (outside a git repository slow down stays quiet)

## Develop

```bash
claude --plugin-dir .          # load the working copy for one session
claude plugin validate .       # check manifests
```

## License

MIT
