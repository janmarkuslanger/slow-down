# Checkpoint questions and feedback rubric

## Picking questions

Pick 2-3 questions from different categories. Each question names something concrete in the change: a file, a function, a call, a table. Prefer questions where a wrong answer would mean a real bug or a wrong mental model. Vary the categories across checkpoints in one session.

## Question bank

Templates, to be filled with specifics from the diff.

### Boundaries and responsibilities

- Why does `<logic>` live in `<module>` and not in `<other module>`?
- What does `<module>` know about `<other concern>` now that it didn't before? Is that coupling intended?
- If `<consumer>` needs this too next quarter, what would you have to change?

### Failure modes

- What happens when `<external call>` times out halfway through `<function>`?
- `<handler>` gets the same message twice. What happens?
- Which step leaves the system inconsistent if the process dies right after it?
- How would you notice in production that `<feature>` is failing silently?

### Data and consistency

- Where is the source of truth for `<field>` after this change?
- What happens to existing rows or records when this migration runs on production data?
- Two requests update `<entity>` at the same time. Which one wins, and is that fine?

### Evolution

- `<requirement>` changes from X to Y. Which files change?
- What would make you regret this structure in six months?
- What did you consider instead of `<approach>` and why did you drop it?

### Prediction

These work well because they make the engineer simulate the code before reading it.

- Before you look: what does `<function>` return for `<edge case input>`?
- Walk me through what happens from `<entry point>` to `<side effect>` for one request.

### Drift against the design note

- The note says `<X>`, the code does `<Y>`. Accept the deviation (and update the note) or change the code?

## Feedback rubric

Judge each answer, then respond in that order: what is right, what is missing, what it means.

- **Solid:** the answer matches the code and the reasoning holds. Confirm in one sentence, maybe add one non-obvious implication. No lecture.
- **Partial:** right direction, a gap or an imprecision. Name the gap precisely ("that covers the timeout, but not the case where the write succeeded and the ack was lost"), explain in two or three sentences, point at the line.
- **Gap:** the mental model differs from the code. Say so plainly and kindly, walk through the actual behaviour briefly, then ask one follow-up that lets the engineer close the gap themselves.
- **Real problem found:** if the answer (or the question) exposes an actual bug or design flaw, say so, and offer to fix it or to escalate it as a decision.

## Good and bad questions

- Bad: "Do you understand what this code does?" Good: "What happens in `syncOrders` when the commerce API returns a 409?"
- Bad: "What does `Array.prototype.flatMap` do?" Good: "Why is the dedupe in the consumer and not in the producer?"
- Bad: five questions at once. Good: two sharp ones, and a third only if the first two were answered well.
