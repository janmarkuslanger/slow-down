---
name: defend
description: Run a design-defense checkpoint on the current changes right now, as /slow-down:defend. Claude asks 2-3 architecture questions about the diff and gives honest feedback on the answers.
argument-hint: "[optional focus, e.g. error handling]"
disable-model-invocation: true
---

# Design defense on demand

Focus from the engineer, if any: $ARGUMENTS

1. Look at the current changes: `git status` and `git diff` (plus `git diff --staged`). If the working tree is clean, use the last commit (`git show --stat HEAD`, then the relevant parts).
2. If `.slow-down/designs/` has a note for this work, read it and note deviations.
3. Pick 2-3 questions following `${CLAUDE_PLUGIN_ROOT}/skills/architect-mode/references/questions.md`, from different categories, each pointing at concrete files or functions. With a focus given, at least two questions address it.
4. Ask the questions and end your turn. Do not answer them yourself.
5. When the engineer answers, give feedback per the rubric in the same file: what is right, what is missing, what it means. If an answer exposes a real problem in the code, say so and offer to fix it.
