# Decision taxonomy

Three tiers. When in doubt between two tiers, take the higher one once and ask the engineer where they want the line. Projects can override this in their CLAUDE.md or in `.slow-down/config.json` (`signals`).

## Tier 1: the engineer decides

Escalate, present options, record with `slow-down decide`.

| Area | Examples | Key |
| --- | --- | --- |
| Dependencies | a new package, a new SDK, a new external service, swapping a library | `dep:<name>` |
| Boundaries | a new module, package or service; moving responsibility between modules; a new layer | `module:<dir>` or `arch:<slug>` |
| Contracts | public API shape, event schemas, message formats, OpenAPI, protobuf, GraphQL, anything another team or service consumes | `contract:<path>` |
| Data model | new tables or collections, schema migrations, changing what is stored or how it is keyed, data retention | `schema:<path>` |
| Infrastructure | new queues, buckets, functions, stacks, IAM, CI pipelines, deployment topology | `infra:<path>` |
| Failure semantics | retries and backoff, idempotency, timeouts, dead-lettering, what happens on partial failure, transactions vs. eventual consistency | `arch:<slug>` |
| Concurrency | locking, ordering guarantees, parallelism, rate limits | `arch:<slug>` |
| Security | authn/authz model, secrets handling, data exposure, input trust boundaries | `arch:<slug>` |
| Cost and scale | anything that changes cost per request or scaling behaviour noticeably | `arch:<slug>` |

## Tier 2: Claude proposes, the engineer confirms

State the choice in one sentence with a short reason and ask for a quick yes. No option list needed. Record only if the engineer adds reasoning worth keeping.

- internal function and type signatures that several call sites will depend on
- choosing between two existing patterns already in the codebase
- test strategy for the change (unit vs. integration, what to mock)
- configuration defaults
- logging, metrics and alerting for the new code

## Tier 3: Claude decides

Just do it, the way the codebase already does it.

- naming, file-local structure, small helper functions
- idiomatic language choices, formatting, imports
- following an existing pattern the engineer already chose
- test cases for behaviour that is already decided
- refactors with no behaviour change inside one module

## Heuristics for the grey zone

- **Reversibility:** hard to undo (data, contracts, dependencies) means tier 1.
- **Blast radius:** affects other modules, teams or services means tier 1.
- **Surprise:** would the engineer be surprised to find it in the diff? Then at least tier 2.
- **Repetition:** the same kind of decision was already made and recorded? Follow it and mention the existing key.
