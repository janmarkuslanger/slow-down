---
name: design
description: Write a short design note before implementing, with the engineer as the author and Claude as interviewer and scribe. Run it as /slow-down:design before a non-trivial feature, refactor or integration.
argument-hint: "[what you want to build]"
disable-model-invocation: true
---

# Design note: the engineer designs, Claude interviews

Task from the engineer: $ARGUMENTS

Produce a design note at `.slow-down/designs/<YYYY-MM-DD>-<slug>.md`. The engineer is the author. Claude asks, listens, writes down and challenges. Claude does not fill sections with its own design.

## Before the interview

Read the code the task touches so your questions are concrete. Keep that reading short and quiet: no summary lecture, one or two sentences on what you looked at.

## Interview

Go through the sections in order, one or two questions per message. Wait for the answer before moving on.

1. **Problem and goal:** what changes for whom, and how do we know it worked?
2. **Constraints:** performance, cost, deadlines, compatibility, things that must not change.
3. **Approach:** how the engineer wants to build it. Ask for their approach first, before you mention anything you noticed in the code.
4. **Boundaries and interfaces:** which modules own what, what the new or changed interfaces look like.
5. **Data and consistency:** what is stored where, source of truth, migrations.
6. **Failure modes:** partial failure, retries, idempotency, timeouts, how failure becomes visible.
7. **Alternatives considered:** at least one, and why it lost.

After each answer: write down what the engineer said, in their words and condensed. If an answer has a gap or conflicts with the code, say so in one or two sentences and ask once more. If the engineer says "you decide" on a tier 1 topic (see the architect-mode skill), lay out 2-3 options and let them pick.

## The note

```markdown
# <Title>

Status: draft
Author: <engineer>, written down by Claude

## Problem and goal
## Constraints
## Approach
## Boundaries and interfaces
## Data and consistency
## Failure modes
## Alternatives considered
## Open questions
## Decisions
- `<key>`: <one line>
```

Write the file once the interview is through, show the engineer the path, and ask if anything is wrong.

## Then, and only then, your critique

Now that the engineer has committed, give your honest review: the two or three biggest risks or gaps you see, each with a concrete suggestion. Mark the note `Status: decided` once the engineer agrees.

Record the tier 1 decisions from the note with `slow-down decide` (keys as in the architect-mode skill, reasoning from the engineer's answers), so the hooks know they were made.
